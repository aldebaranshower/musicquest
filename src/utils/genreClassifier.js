import { fetchSimilarArtists } from './api/listenbrainz';
import { searchArtist, fetchArtistTags } from './api/musicbrainz';
import { fetchArtistInfo, fetchTopTags } from './api/lastfm';
import { getGenreCache, saveGenreCache, saveProgress } from './storage/indexedDB';
import { classifyByHeuristics, mergeGenres } from './heuristicGenreClassifier';

export const classifyArtist = async (artistName, onProgress, abortSignal = null) => {
  try {
    if (abortSignal?.aborted) {
      throw new Error('Classification cancelled');
    }

    const cached = await getGenreCache(artistName);
    if (cached && cached.length > 0) {
      console.log(`✅ Using cached genres for "${artistName}":`, cached);
      if (onProgress) onProgress({ artist: artistName, status: 'cached', genres: cached });
      return { success: true, genres: cached, source: 'cache' };
    }

    console.log(`🔍 Fetching genres for "${artistName}"...`);
    if (onProgress) onProgress({ artist: artistName, status: 'fetching' });

    const heuristicGenres = classifyByHeuristics(artistName);

    if (abortSignal?.aborted) {
      throw new Error('Classification cancelled');
    }

    const artistSearch = await searchArtist(artistName);
    if (!artistSearch.success) {
      await saveGenreCache(artistName, heuristicGenres, null, 'heuristic');
      if (onProgress) onProgress({ artist: artistName, status: 'complete', genres: heuristicGenres });
      return { success: true, genres: heuristicGenres, source: 'heuristic' };
    }

    const mbid = artistSearch.mbid;

    if (abortSignal?.aborted) {
      throw new Error('Classification cancelled');
    }

    const lastfmResult = await fetchArtistInfo(artistName);
    if (lastfmResult.success && lastfmResult.genres.length > 0) {
      const mergedGenres = mergeGenres(heuristicGenres, lastfmResult.genres);
      await saveGenreCache(artistName, mergedGenres, mbid, 'lastfm');
      if (onProgress) onProgress({ artist: artistName, status: 'complete', genres: mergedGenres });
      return { success: true, genres: mergedGenres, source: 'lastfm' };
    }

    if (abortSignal?.aborted) {
      throw new Error('Classification cancelled');
    }

    const similarResult = await fetchSimilarArtists(mbid);
    if (similarResult.success && similarResult.data) {
      const genres = extractGenresFromSimilarArtists(similarResult.data);
      if (genres.length > 0) {
        const mergedGenres = mergeGenres(heuristicGenres, genres);
        await saveGenreCache(artistName, mergedGenres, mbid, 'listenbrainz');
        if (onProgress) onProgress({ artist: artistName, status: 'complete', genres: mergedGenres });
        return { success: true, genres: mergedGenres, source: 'listenbrainz' };
      }
    }

    if (abortSignal?.aborted) {
      throw new Error('Classification cancelled');
    }

    const tagsResult = await fetchArtistTags(mbid);
    if (tagsResult.success && tagsResult.tags.length > 0) {
      const genres = tagsResult.tags
        .sort((a, b) => (b.count || 0) - (a.count || 0))
        .slice(0, 3)
        .map(tag => tag.name);

      if (genres.length > 0) {
        const mergedGenres = mergeGenres(heuristicGenres, genres);
        await saveGenreCache(artistName, mergedGenres, mbid, 'musicbrainz');
        if (onProgress) onProgress({ artist: artistName, status: 'complete', genres: mergedGenres });
        return { success: true, genres: mergedGenres, source: 'musicbrainz' };
      }
    }

    await saveGenreCache(artistName, heuristicGenres, mbid, 'heuristic');
    if (onProgress) onProgress({ artist: artistName, status: 'complete', genres: heuristicGenres });
    return { success: true, genres: heuristicGenres, source: 'heuristic' };

  } catch (error) {
    if (error.message === 'Classification cancelled') {
      throw error;
    }
    console.error(`Failed to classify artist ${artistName}:`, error);
    const heuristicGenres = classifyByHeuristics(artistName);
    await saveGenreCache(artistName, heuristicGenres, null, 'heuristic_fallback');
    return { success: true, genres: heuristicGenres, source: 'heuristic_fallback' };
  }
};

const extractGenresFromSimilarArtists = (data) => {
  const genreMap = new Map();

  if (data.artist && data.artist.tag && Array.isArray(data.artist.tag)) {
    data.artist.tag.forEach(tag => {
      const name = tag.name || tag;
      if (name) {
        genreMap.set(name, (genreMap.get(name) || 0) + 1);
      }
    });
  }

  const sortedGenres = Array.from(genreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre]) => genre);

  return sortedGenres;
};

export const classifyMultipleArtists = async (
  artists,
  onProgress,
  onComplete,
  abortSignal = null,
  batchSize = 5,
  resumeFrom = null
) => {
  const uniqueArtists = [...new Set(artists)];
  const results = new Map();
  let processed = 0;

  if (resumeFrom && resumeFrom.results) {
    const resumedResults = new Map(Object.entries(resumeFrom.results));
    resumedResults.forEach((genres, artist) => {
      results.set(artist, genres);
      processed++;
    });
  }

  const remainingArtists = resumeFrom
    ? uniqueArtists.filter(artist => !results.has(artist))
    : uniqueArtists;

  try {
    for (let i = 0; i < remainingArtists.length; i += batchSize) {
      if (abortSignal?.aborted) {
        throw new Error('Classification cancelled');
      }

      const batch = remainingArtists.slice(i, i + batchSize);

      const batchPromises = batch.map(async (artist) => {
        try {
          const result = await classifyArtist(artist, onProgress, abortSignal);
          return { artist, genres: result.genres, source: result.source };
        } catch (error) {
          if (error.message === 'Classification cancelled') {
            throw error;
          }
          console.error(`Failed to classify ${artist}:`, error);
          const heuristicGenres = classifyByHeuristics(artist);
          return { artist, genres: heuristicGenres, source: 'error_fallback' };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      batchResults.forEach(({ artist, genres }) => {
        results.set(artist, genres);
        processed++;

        if (onProgress) {
          onProgress({
            artist,
            status: 'complete',
            genres,
            progress: { current: processed, total: uniqueArtists.length }
          });
        }
      });

      const progressData = {
        processedArtists: Array.from(results.keys()),
        results: Object.fromEntries(results),
        currentIndex: processed,
        total: uniqueArtists.length,
        timestamp: Date.now()
      };
      await saveProgress(progressData);

      if (onComplete) {
        onComplete(results);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  } catch (error) {
    if (error.message === 'Classification cancelled') {
      const progressData = {
        processedArtists: Array.from(results.keys()),
        results: Object.fromEntries(results),
        currentIndex: processed,
        total: uniqueArtists.length,
        timestamp: Date.now(),
        cancelled: true
      };
      await saveProgress(progressData);

      if (onComplete) {
        onComplete(results);
      }
    }
    throw error;
  }
};
