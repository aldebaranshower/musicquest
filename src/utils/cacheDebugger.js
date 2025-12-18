import { getGenreCacheStats, getGenreCache } from './storage/indexedDB';

export const logCacheStatistics = async () => {
  const stats = await getGenreCacheStats();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 GENRE CACHE STATISTICS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Total cached artists: ${stats.total.toLocaleString()}`);
  console.log('   ─────────────────────────────────');
  console.log('   By source:');

  Object.entries(stats.bySource)
    .sort((a, b) => b[1] - a[1])
    .forEach(([source, count]) => {
      const percentage = ((count / stats.total) * 100).toFixed(1);
      console.log(`     ${source.padEnd(20)} ${count.toString().padStart(6)} (${percentage}%)`);
    });

  if (stats.oldestCache) {
    const oldestDate = new Date(stats.oldestCache);
    const newestDate = new Date(stats.newestCache);
    const oldestAge = ((Date.now() - stats.oldestCache) / (1000 * 60 * 60 * 24)).toFixed(1);
    const newestAge = ((Date.now() - stats.newestCache) / (1000 * 60 * 60 * 24)).toFixed(1);

    console.log('   ─────────────────────────────────');
    console.log(`   Oldest cache: ${oldestDate.toLocaleDateString()} (${oldestAge} days ago)`);
    console.log(`   Newest cache: ${newestDate.toLocaleDateString()} (${newestAge} days ago)`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return stats;
};

export const testCacheLookup = async (artistName) => {
  console.log(`🔍 Testing cache lookup for: "${artistName}"`);
  const cached = await getGenreCache(artistName);

  if (cached) {
    console.log('✅ Cache HIT:', cached);
  } else {
    console.log('❌ Cache MISS');
  }

  return cached;
};

export const enableCacheDebugMode = () => {
  window.__CACHE_DEBUG__ = true;
  console.log('🐛 Cache debug mode ENABLED - All cache operations will be logged');
};

export const disableCacheDebugMode = () => {
  window.__CACHE_DEBUG__ = false;
  console.log('🐛 Cache debug mode DISABLED');
};

if (typeof window !== 'undefined') {
  window.cacheDebug = {
    stats: logCacheStatistics,
    test: testCacheLookup,
    enableDebug: enableCacheDebugMode,
    disableDebug: disableCacheDebugMode
  };

  console.log('💡 Cache debugging tools available:');
  console.log('   window.cacheDebug.stats()           - View cache statistics');
  console.log('   window.cacheDebug.test("Artist")    - Test cache lookup');
  console.log('   window.cacheDebug.enableDebug()     - Enable verbose logging');
  console.log('   window.cacheDebug.disableDebug()    - Disable verbose logging');
}
