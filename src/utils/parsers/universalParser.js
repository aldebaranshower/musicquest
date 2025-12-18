import DOMPurify from 'dompurify';

export function detectDataFormat(data, fileName = '') {
  if (!data) {
    throw new Error('No data provided');
  }

  const dataArray = Array.isArray(data) ? data : [data];

  if (dataArray.length === 0) {
    throw new Error('Data array is empty');
  }

  const firstItem = dataArray[0];

  if (firstItem.listened_at && firstItem.track_metadata) {
    return 'listenbrainz';
  }

  if (firstItem.ts && (firstItem.master_metadata_track_name || firstItem.spotify_track_uri)) {
    return 'spotify';
  }

  if (firstItem.date?.uts && firstItem.artist) {
    return 'lastfm';
  }

  const lowerFileName = fileName.toLowerCase();
  if (lowerFileName.includes('spotify') || lowerFileName.includes('streaming_history')) {
    return 'spotify';
  }
  if (lowerFileName.includes('listenbrainz')) {
    return 'listenbrainz';
  }
  if (lowerFileName.includes('lastfm') || lowerFileName.includes('last.fm')) {
    return 'lastfm';
  }

  throw new Error('Unknown data format. Please upload ListenBrainz or Spotify extended streaming history JSON files.');
}

export function parseListenBrainzFormat(data) {
  try {
    if (!data || !Array.isArray(data)) {
      throw new Error('Invalid ListenBrainz JSON format: expected array');
    }

    const parsedListens = data.map((listen, index) => {
      const trackMetadata = listen.track_metadata || {};
      const listenedAt = listen.listened_at || Math.floor(Date.now() / 1000);

      return {
        id: `lb-${index}-${listenedAt}`,
        listened_at: listenedAt,
        timestamp: listenedAt * 1000,
        trackName: DOMPurify.sanitize(trackMetadata.track_name || 'Unknown Track'),
        artistName: DOMPurify.sanitize(trackMetadata.artist_name || 'Unknown Artist'),
        albumName: DOMPurify.sanitize(trackMetadata.release_name || 'Unknown Album'),
        recordingMsid: listen.recording_msid || null,
        additionalInfo: trackMetadata.additional_info || {},
        source: 'listenbrainz'
      };
    });

    console.log(`✅ Parsed ${parsedListens.length} ListenBrainz listens`);

    return {
      success: true,
      listens: parsedListens,
      count: parsedListens.length,
      format: 'listenbrainz'
    };
  } catch (error) {
    console.error('ListenBrainz parsing error:', error);
    return {
      success: false,
      error: error.message,
      listens: []
    };
  }
}

export function parseSpotifyFormat(data) {
  try {
    if (!data || !Array.isArray(data)) {
      throw new Error('Invalid Spotify JSON format: expected array');
    }

    const validListens = data.filter(item => {
      return item.ts &&
             (item.master_metadata_track_name || item.spotify_track_uri) &&
             item.master_metadata_album_artist_name &&
             (item.ms_played || 0) >= 30000;
    });

    const parsedListens = validListens.map((listen, index) => {
      const isoTimestamp = listen.ts;
      const timestampMs = new Date(isoTimestamp).getTime();
      const listenedAt = Math.floor(timestampMs / 1000);

      return {
        id: `spotify-${index}-${listenedAt}`,
        listened_at: listenedAt,
        timestamp: timestampMs,
        trackName: DOMPurify.sanitize(
          listen.master_metadata_track_name ||
          listen.spotify_track_uri?.split(':')[2] ||
          'Unknown Track'
        ),
        artistName: DOMPurify.sanitize(
          listen.master_metadata_album_artist_name ||
          'Unknown Artist'
        ),
        albumName: DOMPurify.sanitize(
          listen.master_metadata_album_album_name ||
          'Unknown Album'
        ),
        msPlayed: listen.ms_played || 0,
        additionalInfo: {
          spotify_track_uri: listen.spotify_track_uri,
          reason_start: listen.reason_start,
          reason_end: listen.reason_end,
          shuffle: listen.shuffle,
          skipped: listen.skipped,
          offline: listen.offline
        },
        source: 'spotify'
      };
    });

    const filteredCount = data.length - validListens.length;
    if (filteredCount > 0) {
      console.log(`🔍 Filtered out ${filteredCount} entries (skipped/short tracks)`);
    }

    console.log(`✅ Parsed ${parsedListens.length} Spotify listens`);

    return {
      success: true,
      listens: parsedListens,
      count: parsedListens.length,
      totalEntries: data.length,
      filtered: filteredCount,
      format: 'spotify'
    };
  } catch (error) {
    console.error('Spotify parsing error:', error);
    return {
      success: false,
      error: error.message,
      listens: []
    };
  }
}

export function parseLastFmFormat(data) {
  throw new Error('Last.fm format support coming soon');
}

export function parseUniversalData(fileContent, fileName) {
  try {
    const parsed = JSON.parse(fileContent);

    const format = detectDataFormat(parsed, fileName);

    console.log(`📥 Detected format: ${format} (${fileName})`);

    switch (format) {
      case 'listenbrainz':
        return parseListenBrainzFormat(parsed);
      case 'spotify':
        return parseSpotifyFormat(parsed);
      case 'lastfm':
        return parseLastFmFormat(parsed);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  } catch (error) {
    console.error('Parse error:', error);
    throw new Error(`Failed to parse file: ${error.message}`);
  }
}

export function validateUniversalData(data) {
  if (!data || !data.listens || data.listens.length === 0) {
    return {
      isValid: false,
      error: 'No listens found in uploaded file.',
      details: 'Please upload a valid ListenBrainz or Spotify extended streaming history file.'
    };
  }

  const MIN_TIMESTAMP = 946684800;
  const MAX_TIMESTAMP = 2147483647;

  const timestamps = data.listens.map(l => l.listened_at);

  const validTimestamps = timestamps.filter(
    ts => typeof ts === 'number' && ts > MIN_TIMESTAMP && ts < MAX_TIMESTAMP
  );

  const validPercentage = (validTimestamps.length / timestamps.length) * 100;

  if (validPercentage < 90) {
    return {
      isValid: false,
      error: `Data contains too many invalid timestamps (${validPercentage.toFixed(1)}% valid).`,
      details: `Found ${validTimestamps.length} valid out of ${timestamps.length} total listens. ` +
               `Please check your export file format.`,
      debugInfo: {
        sampleInvalidTimestamp: timestamps.find(ts => typeof ts !== 'number' || ts < MIN_TIMESTAMP || ts > MAX_TIMESTAMP),
        expectedFormat: 'Unix timestamp (e.g., 1609459200)',
        detectedFormat: typeof timestamps[0],
        firstTimestamp: timestamps[0]
      }
    };
  }

  const earliest = Math.min(...validTimestamps);
  const latest = Math.max(...validTimestamps);
  const yearSpan = (latest - earliest) / (365.25 * 24 * 60 * 60);

  if (yearSpan < 0.08) {
    return {
      isValid: false,
      error: 'Data span too short.',
      details: `Found only ${(yearSpan * 365).toFixed(0)} days of listening history. Need at least 1 month.`
    };
  }

  return {
    isValid: true,
    data: data,
    dateRange: {
      earliest: new Date(earliest * 1000),
      latest: new Date(latest * 1000)
    },
    yearSpan: Math.round(yearSpan * 10) / 10,
    stats: {
      totalListens: data.listens.length,
      validTimestamps: validTimestamps.length,
      validPercentage: validPercentage.toFixed(1)
    }
  };
}
