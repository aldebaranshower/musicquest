export const detectGatewayArtists = (groupedData, genreMap, listens) => {
  console.log('🔍 Starting gateway artist detection...');
  console.log(`📊 Input: ${groupedData?.length || 0} periods, ${listens?.length || 0} listens, ${genreMap?.size || 0} artists mapped`);

  const gatewayArtists = [];
  const artistFirstAppearance = new Map();
  const artistFirstTrack = new Map();

  listens.forEach(listen => {
    const artist = listen.artistName;
    if (!artistFirstAppearance.has(artist)) {
      artistFirstAppearance.set(artist, listen.timestamp);
      artistFirstTrack.set(artist, listen.trackName);
    }
  });

  console.log(`👤 Tracking ${artistFirstAppearance.size} unique artists`);

  for (let i = 0; i < groupedData.length; i++) {
    const currentPeriod = groupedData[i];
    const periodStart = currentPeriod.periodStart;
    const periodEnd = i < groupedData.length - 1 ? groupedData[i + 1].periodStart : Date.now();

    const artistsInPeriod = new Map();
    currentPeriod.listens.forEach(listen => {
      const artist = listen.artistName;
      const firstAppearance = artistFirstAppearance.get(artist);

      if (firstAppearance >= periodStart && firstAppearance < periodEnd) {
        artistsInPeriod.set(artist, (artistsInPeriod.get(artist) || 0) + 1);
      }
    });

    artistsInPeriod.forEach((count, artist) => {
      if (count >= 10) {
        const artistGenres = genreMap.get(artist) || ['Unknown'];
        const primaryGenre = artistGenres[0];

        const beforeGenres = calculateGenreDistribution(
          groupedData.slice(Math.max(0, i - 2), i),
          genreMap
        );
        const afterGenres = calculateGenreDistribution(
          groupedData.slice(i + 1, Math.min(groupedData.length, i + 3)),
          genreMap
        );

        const beforePercentage = beforeGenres.get(primaryGenre) || 0;
        const afterPercentage = afterGenres.get(primaryGenre) || 0;
        const genreGrowth = afterPercentage - beforePercentage;

        if (genreGrowth >= 5) {
          const firstTrack = artistFirstTrack.get(artist);
          const totalPlays = listens.filter(l => l.artistName === artist).length;
          const playsInFirstQuarter = count;

          gatewayArtists.push({
            artist,
            firstTrack,
            firstListen: new Date(artistFirstAppearance.get(artist)),
            triggerGenre: primaryGenre,
            genreGrowth: `+${genreGrowth.toFixed(1)}%`,
            genreGrowthNumeric: genreGrowth,
            genreGrowthBefore: beforePercentage.toFixed(1),
            genreGrowthAfter: afterPercentage.toFixed(1),
            percentageIncrease: genreGrowth.toFixed(1),
            subsequentListens: count,
            totalPlays,
            playsInFirstQuarter,
            periodIndex: i,
            periodLabel: currentPeriod.periodLabel,
            beforePercentage: beforePercentage.toFixed(1),
            afterPercentage: afterPercentage.toFixed(1)
          });
        }
      }
    });
  }

  console.log(`✅ Found ${gatewayArtists.length} gateway artists`);
  if (gatewayArtists.length > 0) {
    console.log('🎯 Top 3 gateway artists:', gatewayArtists.slice(0, 3).map(a => `${a.artist} (${a.triggerGenre}, +${a.genreGrowth})`));
  }

  return gatewayArtists.sort((a, b) => b.genreGrowthNumeric - a.genreGrowthNumeric);
};

const calculateGenreDistribution = (periods, genreMap) => {
  const genreCounts = new Map();
  let totalListens = 0;

  periods.forEach(period => {
    period.listens.forEach(listen => {
      const genres = genreMap.get(listen.artistName) || ['Unknown'];
      genres.forEach(genre => {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
        totalListens++;
      });
    });
  });

  const distribution = new Map();
  genreCounts.forEach((count, genre) => {
    distribution.set(genre, (count / totalListens) * 100);
  });

  return distribution;
};

export const getTopArtistsForGenre = (listens, genreMap, genre, limit = 20) => {
  const artistCounts = new Map();

  listens.forEach(listen => {
    const artist = listen.artistName;
    const genres = genreMap.get(artist) || ['Unknown'];

    if (genres.includes(genre)) {
      artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
    }
  });

  return Array.from(artistCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([artist, count]) => ({ artist, count }));
};

export const getGenrePeakPeriod = (groupedData, genre) => {
  let maxPercentage = 0;
  let peakPeriod = null;

  groupedData.forEach(period => {
    const genreData = period.genres.find(g => g.genre === genre);
    if (genreData && genreData.percentage > maxPercentage) {
      maxPercentage = genreData.percentage;
      peakPeriod = {
        periodLabel: period.periodLabel,
        percentage: genreData.percentage,
        count: genreData.count
      };
    }
  });

  return peakPeriod;
};

export const getGenreDiscoveryDate = (listens, genreMap, genre) => {
  for (const listen of listens) {
    const genres = genreMap.get(listen.artistName) || ['Unknown'];
    if (genres.includes(genre)) {
      return new Date(listen.timestamp);
    }
  }
  return null;
};
