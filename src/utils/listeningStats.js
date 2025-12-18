export function calculateListeningFingerprint(listens) {
  if (!listens || listens.length === 0) {
    return {
      consistency: 50,
      discovery: 50,
      variety: 50,
      replayRate: 50,
      exploration: 50
    };
  }

  const consistency = calculateConsistency(listens);
  const discovery = calculateDiscovery(listens);
  const variety = calculateVariety(listens);
  const replayRate = calculateReplayRate(listens);
  const exploration = calculateExploration(listens);

  return {
    consistency,
    discovery,
    variety,
    replayRate,
    exploration
  };
}

function calculateConsistency(listens) {
  const listensByDay = {};
  listens.forEach(listen => {
    const timestamp = listen.timestamp || listen.listened_at;
    if (!timestamp) return;

    const date = new Date(timestamp * 1000);
    const dayKey = date.toISOString().split('T')[0];
    listensByDay[dayKey] = (listensByDay[dayKey] || 0) + 1;
  });

  const days = Object.keys(listensByDay).length;

  const timestamps = listens
    .map(l => l.timestamp || l.listened_at)
    .filter(Boolean);

  if (timestamps.length === 0) return 50;

  const totalDays = Math.max(
    1,
    Math.ceil(
      (Math.max(...timestamps) - Math.min(...timestamps)) / 86400
    )
  );

  const consistency = Math.round((days / totalDays) * 100);

  console.log(`📅 Consistency: ${days} active days / ${totalDays} total days = ${consistency}%`);

  return Math.min(consistency, 100);
}

function calculateDiscovery(listens) {
  const sorted = [...listens].sort((a, b) =>
    (a.timestamp || a.listened_at) - (b.timestamp || b.listened_at)
  );

  const seenArtists = new Set();
  let newArtistCount = 0;

  sorted.forEach(listen => {
    const artist = listen.artistName;
    if (artist && !seenArtists.has(artist)) {
      seenArtists.add(artist);
      newArtistCount++;
    }
  });

  const discoveryRate = (newArtistCount / listens.length) * 100 * 10;
  const discovery = Math.round(Math.min(discoveryRate, 100));

  console.log(`🔍 Discovery: ${newArtistCount} unique artists discovered = ${discovery}/100`);

  return discovery;
}

function calculateVariety(listens) {
  const uniqueArtists = new Set(
    listens.map(l => l.artistName).filter(Boolean)
  ).size;
  const totalListens = listens.length;

  const uniqueTracks = new Set(
    listens.map(l => `${l.artistName}-${l.trackName}`).filter(k => k !== '-')
  ).size;

  const genreCounts = {};
  listens.forEach(listen => {
    const genre = listen.genres?.[0] || listen.normalizedGenre || listen.genre || 'Unknown';
    if (genre !== 'Unknown') {
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    }
  });

  const uniqueGenres = Object.keys(genreCounts).length;

  if (uniqueGenres === 0) {
    const basicVariety = Math.round(
      ((uniqueArtists / totalListens) * 100 * 5 +
       (uniqueTracks / totalListens) * 100 * 3) / 2
    );
    return Math.min(basicVariety, 100);
  }

  let entropy = 0;
  for (const count of Object.values(genreCounts)) {
    const p = count / totalListens;
    entropy -= p * Math.log2(p);
  }

  const maxEntropy = uniqueGenres > 1 ? Math.log2(uniqueGenres) : 1;
  const normalizedEntropy = entropy / maxEntropy;

  const artistDiversity = (uniqueArtists / totalListens) * 100;
  const trackDiversity = (uniqueTracks / totalListens) * 100;

  const varietyScore = Math.round(
    (normalizedEntropy * 100 * 0.4) +
    (Math.min(artistDiversity * 5, 100) * 0.3) +
    (Math.min(trackDiversity * 3, 100) * 0.3)
  );

  console.log(`🎨 Variety calculation:
    - Unique artists: ${uniqueArtists}/${totalListens} (${artistDiversity.toFixed(1)}%)
    - Unique tracks: ${uniqueTracks}/${totalListens} (${trackDiversity.toFixed(1)}%)
    - Unique genres: ${uniqueGenres}
    - Genre entropy: ${entropy.toFixed(2)} (normalized: ${(normalizedEntropy * 100).toFixed(1)}%)
    → Variety Score: ${varietyScore}/100
  `);

  return Math.min(Math.max(varietyScore, 0), 100);
}

function calculateReplayRate(listens) {
  const trackCounts = {};

  listens.forEach(listen => {
    const key = `${listen.artistName}-${listen.trackName}`;
    if (key !== '-') {
      trackCounts[key] = (trackCounts[key] || 0) + 1;
    }
  });

  const replayedTracks = Object.values(trackCounts).filter(count => count > 1).length;
  const totalUniqueTracks = Object.keys(trackCounts).length;

  if (totalUniqueTracks === 0) return 50;

  const replayRate = (replayedTracks / totalUniqueTracks) * 100;
  const result = Math.round(Math.min(replayRate, 100));

  console.log(`🔁 Replay Rate: ${replayedTracks}/${totalUniqueTracks} tracks replayed = ${result}%`);

  return result;
}

function calculateExploration(listens) {
  const sorted = [...listens].sort((a, b) =>
    (a.timestamp || a.listened_at) - (b.timestamp || b.listened_at)
  );

  let genreSwitches = 0;
  let validComparisons = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prevGenre = sorted[i - 1].genres?.[0] || sorted[i - 1].normalizedGenre || sorted[i - 1].genre || 'Unknown';
    const currGenre = sorted[i].genres?.[0] || sorted[i].normalizedGenre || sorted[i].genre || 'Unknown';

    if (prevGenre !== 'Unknown' && currGenre !== 'Unknown') {
      validComparisons++;
      if (prevGenre !== currGenre) {
        genreSwitches++;
      }
    }
  }

  if (validComparisons === 0) return 50;

  const exploration = (genreSwitches / validComparisons) * 100 * 2;
  const result = Math.round(Math.min(exploration, 100));

  console.log(`🌍 Exploration: ${genreSwitches}/${validComparisons} genre switches = ${result}%`);

  return result;
}

export function validateFingerprintData(fingerprint) {
  if (!fingerprint || typeof fingerprint !== 'object') {
    console.error('❌ Invalid fingerprint data:', fingerprint);
    return null;
  }

  const validated = {
    consistency: Number(fingerprint.consistency) || 50,
    discovery: Number(fingerprint.discovery) || 50,
    variety: Number(fingerprint.variety) || 50,
    replayRate: Number(fingerprint.replayRate) || 50,
    exploration: Number(fingerprint.exploration) || 50
  };

  const hasInvalid = Object.values(validated).some(v =>
    isNaN(v) || v === undefined || v === null
  );

  if (hasInvalid) {
    console.error('❌ Invalid fingerprint values detected:', validated);
    return null;
  }

  console.log('✅ Validated fingerprint:', validated);
  return validated;
}

if (typeof window !== 'undefined') {
  window.calculateListeningFingerprint = calculateListeningFingerprint;
  window.validateFingerprintData = validateFingerprintData;

  console.log('💡 Listening stats tools available:');
  console.log('   - window.calculateListeningFingerprint(listens)');
  console.log('   - window.validateFingerprintData(fingerprint)');
}
