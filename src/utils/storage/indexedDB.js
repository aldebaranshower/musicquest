import { openDB } from 'idb';

const DB_NAME = 'MusicQuestDB';
const DB_VERSION = 3;
const STORES = {
  LISTENS: 'listens',
  GENRES: 'genres',
  SETTINGS: 'settings',
  PROGRESS: 'progress',
  API_CONFIG: 'api_config'
};

let db = null;

export const initDB = async () => {
  try {
    db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains(STORES.LISTENS)) {
          db.createObjectStore(STORES.LISTENS, { keyPath: 'id', autoIncrement: true });
        }

        if (!db.objectStoreNames.contains(STORES.GENRES)) {
          const genreStore = db.createObjectStore(STORES.GENRES, { keyPath: 'artist' });
          genreStore.createIndex('lastFetched', 'lastFetched');
          genreStore.createIndex('source', 'source');
        }

        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORES.PROGRESS)) {
          const progressStore = db.createObjectStore(STORES.PROGRESS, { keyPath: 'id' });
          progressStore.createIndex('timestamp', 'timestamp');
        }

        if (!db.objectStoreNames.contains(STORES.API_CONFIG)) {
          db.createObjectStore(STORES.API_CONFIG, { keyPath: 'key' });
        }

        if (oldVersion < 2 && db.objectStoreNames.contains(STORES.GENRES)) {
          const genreStore = transaction.objectStore(STORES.GENRES);
          if (!genreStore.indexNames.contains('source')) {
            genreStore.createIndex('source', 'source');
          }
        }
      },
    });
    return db;
  } catch (error) {
    console.error('Failed to initialize IndexedDB:', error);
    throw error;
  }
};

export const saveListeningData = async (data, replace = false) => {
  try {
    if (!db) await initDB();

    const tx = db.transaction(STORES.LISTENS, 'readwrite');

    if (replace) {
      await tx.objectStore(STORES.LISTENS).clear();
    }

    for (const item of data) {
      await tx.objectStore(STORES.LISTENS).add(item);
    }

    await tx.done;
    return true;
  } catch (error) {
    console.error('Failed to save listening data:', error);
    return false;
  }
};

export const mergeListeningData = async (newData) => {
  try {
    if (!db) await initDB();

    console.log('🔄 Merging listening data...');

    const existingData = await db.getAll(STORES.LISTENS);

    // Normalize timestamps in existing data
    const normalizedExisting = existingData.map(listen => {
      const normalized = { ...listen };

      if (normalized.timestamp && normalized.timestamp > 10000000000) {
        normalized.timestamp = Math.floor(normalized.timestamp / 1000);
      }

      if (normalized.listened_at && normalized.listened_at > 10000000000) {
        normalized.listened_at = Math.floor(normalized.listened_at / 1000);
      } else if (!normalized.listened_at && normalized.timestamp) {
        normalized.listened_at = normalized.timestamp;
      }

      return normalized;
    });

    // Normalize timestamps in new data
    const normalizedNew = newData.map(listen => {
      const normalized = { ...listen };

      if (normalized.timestamp && normalized.timestamp > 10000000000) {
        normalized.timestamp = Math.floor(normalized.timestamp / 1000);
      }

      if (normalized.listened_at && normalized.listened_at > 10000000000) {
        normalized.listened_at = Math.floor(normalized.listened_at / 1000);
      } else if (!normalized.listened_at && normalized.timestamp) {
        normalized.listened_at = normalized.timestamp;
      }

      return normalized;
    });

    const allListens = [...normalizedExisting, ...normalizedNew];

    const seenKeys = new Map();
    const duplicates = [];

    allListens.forEach(listen => {
      const trackName = (listen.trackName || listen.track_metadata?.track_name || '').toLowerCase().trim();
      const artistName = (listen.artistName || listen.track_metadata?.artist_name || '').toLowerCase().trim();
      const timestamp = listen.timestamp || listen.listened_at || 0;

      const key = `${trackName}|||${artistName}|||${timestamp}`;

      if (seenKeys.has(key)) {
        duplicates.push({
          track: listen.trackName || listen.track_metadata?.track_name,
          artist: listen.artistName || listen.track_metadata?.artist_name,
          date: new Date(timestamp * 1000).toISOString().split('T')[0]
        });
      } else {
        seenKeys.set(key, listen);
      }
    });

    const uniqueListens = Array.from(seenKeys.values());

    uniqueListens.sort((a, b) => {
      const aTime = a.timestamp || a.listened_at || 0;
      const bTime = b.timestamp || b.listened_at || 0;
      return aTime - bTime;
    });

    const duplicateCount = allListens.length - uniqueListens.length;
    const duplicateRate = allListens.length > 0
      ? ((duplicateCount / allListens.length) * 100).toFixed(1)
      : 0;

    const timestamps = uniqueListens.map(l => l.timestamp || l.listened_at || 0);
    const dateRange = timestamps.length > 0 ? {
      earliest: new Date(Math.min(...timestamps) * 1000),
      latest: new Date(Math.max(...timestamps) * 1000),
      yearSpan: ((Math.max(...timestamps) - Math.min(...timestamps)) / (365.25 * 24 * 60 * 60)).toFixed(1)
    } : null;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DATA MERGE COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Cached:             ${existingData.length.toLocaleString()} listens`);
    console.log(`   Imported:           ${newData.length.toLocaleString()} listens`);
    console.log(`   ─────────────────────────────────`);
    console.log(`   Combined total:     ${allListens.length.toLocaleString()} listens`);
    console.log(`   Duplicates removed: ${duplicateCount.toLocaleString()} (${duplicateRate}%)`);
    console.log(`   ─────────────────────────────────`);
    console.log(`   Final unique:       ${uniqueListens.length.toLocaleString()} listens`);
    if (dateRange) {
      console.log(`   Date range:         ${dateRange.earliest.getFullYear()} - ${dateRange.latest.getFullYear()} (${dateRange.yearSpan} years)`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (duplicates.length > 0) {
      console.log(`   Sample duplicates (first 5):`);
      duplicates.slice(0, 5).forEach((dup, i) => {
        console.log(`   ${i + 1}. "${dup.track}" by ${dup.artist} (${dup.date})`);
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    const tx = db.transaction(STORES.LISTENS, 'readwrite');
    await tx.objectStore(STORES.LISTENS).clear();

    for (const item of uniqueListens) {
      await tx.objectStore(STORES.LISTENS).add(item);
    }

    await tx.done;

    const mergeInfo = {
      existing: existingData.length,
      new: newData.length,
      duplicates: duplicateCount,
      duplicateRate: parseFloat(duplicateRate),
      total: uniqueListens.length,
      sampleDuplicates: duplicates.slice(0, 5)
    };

    return { success: true, data: uniqueListens, mergeInfo };
  } catch (error) {
    console.error('Failed to merge listening data:', error);
    return { success: false, error: error.message };
  }
};

export const getListeningData = async () => {
  try {
    if (!db) await initDB();
    return await db.getAll(STORES.LISTENS);
  } catch (error) {
    console.error('Failed to get listening data:', error);
    return [];
  }
};

export const saveGenreCache = async (artist, genres, mbid = null, source = 'unknown') => {
  try {
    if (!db) await initDB();

    const cacheEntry = {
      artist,
      mbid,
      genres,
      source,
      lastFetched: Date.now(),
      fetchAttempts: 1,
      lastError: null
    };

    await db.put(STORES.GENRES, cacheEntry);
    console.log(`💾 Cached genres for "${artist}" (source: ${source}):`, genres);
    return true;
  } catch (error) {
    console.error('Failed to save genre cache:', error);
    return false;
  }
};

export const getGenreCache = async (artist) => {
  try {
    if (!db) await initDB();

    const cached = await db.get(STORES.GENRES, artist);
    if (!cached) {
      console.log(`Genre cache MISS: ${artist}`);
      return null;
    }

    const daysSinceFetch = (Date.now() - cached.lastFetched) / (1000 * 60 * 60 * 24);
    if (daysSinceFetch > 30) {
      console.log(`Genre cache EXPIRED (${daysSinceFetch.toFixed(1)} days): ${artist}`);
      return null;
    }

    console.log(`Genre cache HIT (${daysSinceFetch.toFixed(1)} days old, source: ${cached.source}): ${artist}`);
    return cached.genres;
  } catch (error) {
    console.error('Failed to get genre cache:', error);
    return null;
  }
};

export const clearGenreCache = async () => {
  try {
    if (!db) await initDB();
    await db.clear(STORES.GENRES);
    return true;
  } catch (error) {
    console.error('Failed to clear genre cache:', error);
    return false;
  }
};

export const clearAllData = async () => {
  try {
    if (!db) await initDB();
    await db.clear(STORES.LISTENS);
    await db.clear(STORES.GENRES);
    await db.clear(STORES.SETTINGS);
    return true;
  } catch (error) {
    console.error('Failed to clear all data:', error);
    return false;
  }
};

export const getDataSize = async () => {
  try {
    if (!db) await initDB();
    const listens = await db.getAll(STORES.LISTENS);
    const genres = await db.getAll(STORES.GENRES);

    const sizeInBytes = JSON.stringify({ listens, genres }).length;
    return sizeInBytes;
  } catch (error) {
    console.error('Failed to get data size:', error);
    return 0;
  }
};

export const saveProgress = async (progressData) => {
  try {
    if (!db) await initDB();
    await db.put(STORES.PROGRESS, {
      id: 'genre_classification',
      ...progressData,
      timestamp: Date.now()
    });
    return true;
  } catch (error) {
    console.error('Failed to save progress:', error);
    return false;
  }
};

export const getProgress = async () => {
  try {
    if (!db) await initDB();
    return await db.get(STORES.PROGRESS, 'genre_classification');
  } catch (error) {
    console.error('Failed to get progress:', error);
    return null;
  }
};

export const clearProgress = async () => {
  try {
    if (!db) await initDB();
    await db.delete(STORES.PROGRESS, 'genre_classification');
    return true;
  } catch (error) {
    console.error('Failed to clear progress:', error);
    return false;
  }
};

export const saveAPIConfig = async (key, value) => {
  try {
    if (!db) await initDB();
    await db.put(STORES.API_CONFIG, { key, value });
    return true;
  } catch (error) {
    console.error('Failed to save API config:', error);
    return false;
  }
};

export const getAPIConfig = async (key) => {
  try {
    if (!db) await initDB();
    const config = await db.get(STORES.API_CONFIG, key);
    return config?.value || null;
  } catch (error) {
    console.error('Failed to get API config:', error);
    return null;
  }
};

export const getAllAPIConfigs = async () => {
  try {
    if (!db) await initDB();
    const configs = await db.getAll(STORES.API_CONFIG);
    const configMap = {};
    configs.forEach(({ key, value }) => {
      configMap[key] = value;
    });
    return configMap;
  } catch (error) {
    console.error('Failed to get all API configs:', error);
    return {};
  }
};

export const exportData = async () => {
  try {
    if (!db) await initDB();

    console.log('📤 Exporting cache backup...');

    const listens = await db.getAll(STORES.LISTENS);
    const genres = await db.getAll(STORES.GENRES);
    const settings = await db.getAll(STORES.SETTINGS);
    const progress = await db.getAll(STORES.PROGRESS);

    // Normalize all listens to use SECONDS (10 digits)
    const normalizedListens = listens.map(listen => {
      const normalized = { ...listen };

      // Ensure timestamp is in SECONDS
      if (normalized.timestamp) {
        normalized.timestamp = normalized.timestamp > 10000000000
          ? Math.floor(normalized.timestamp / 1000)
          : normalized.timestamp;
      }

      // Ensure listened_at matches timestamp and is in SECONDS
      if (normalized.listened_at) {
        normalized.listened_at = normalized.listened_at > 10000000000
          ? Math.floor(normalized.listened_at / 1000)
          : normalized.listened_at;
      } else if (normalized.timestamp) {
        normalized.listened_at = normalized.timestamp;
      }

      return normalized;
    });

    const timestamps = normalizedListens.map(l => l.timestamp || l.listened_at).filter(Boolean);
    const metadata = timestamps.length > 0 ? {
      totalListens: normalizedListens.length,
      dateRange: {
        earliest: Math.min(...timestamps),
        latest: Math.max(...timestamps)
      }
    } : {
      totalListens: 0,
      dateRange: null
    };

    console.log(`✅ Exported ${normalizedListens.length} listens (timestamps in Unix seconds)`);

    return {
      version: '2.0',
      exportDate: new Date().toISOString(),
      listens: normalizedListens,
      genres,
      settings,
      progress,
      metadata
    };
  } catch (error) {
    console.error('Failed to export data:', error);
    return null;
  }
};

export const importData = async (data) => {
  try {
    if (!db) await initDB();

    console.log('📥 Importing cache backup...');

    if (data.listens && Array.isArray(data.listens)) {
      let convertedCount = 0;

      // Normalize timestamps in all listens
      const normalizedListens = data.listens.map(listen => {
        const normalized = { ...listen };

        // Convert milliseconds to seconds
        if (normalized.timestamp && normalized.timestamp > 10000000000) {
          normalized.timestamp = Math.floor(normalized.timestamp / 1000);
          convertedCount++;
        }

        // Ensure listened_at exists and is in seconds
        if (normalized.listened_at && normalized.listened_at > 10000000000) {
          normalized.listened_at = Math.floor(normalized.listened_at / 1000);
        } else if (!normalized.listened_at && normalized.timestamp) {
          normalized.listened_at = normalized.timestamp;
        }

        return normalized;
      });

      if (convertedCount > 0) {
        console.log(`🔄 Converted ${convertedCount} timestamps from milliseconds to seconds`);
      }

      console.log(`✅ Normalized ${normalizedListens.length} listens`);

      const tx = db.transaction(STORES.LISTENS, 'readwrite');
      await tx.objectStore(STORES.LISTENS).clear();
      for (const item of normalizedListens) {
        await tx.objectStore(STORES.LISTENS).add(item);
      }
      await tx.done;
    }

    if (data.genres && Array.isArray(data.genres)) {
      const tx = db.transaction(STORES.GENRES, 'readwrite');
      await tx.objectStore(STORES.GENRES).clear();
      for (const item of data.genres) {
        await tx.objectStore(STORES.GENRES).put(item);
      }
      await tx.done;
    }

    if (data.progress && Array.isArray(data.progress)) {
      const tx = db.transaction(STORES.PROGRESS, 'readwrite');
      for (const item of data.progress) {
        await tx.objectStore(STORES.PROGRESS).put(item);
      }
      await tx.done;
    }

    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
};

export const getGenreCacheStats = async () => {
  try {
    if (!db) await initDB();
    const genres = await db.getAll(STORES.GENRES);

    const stats = {
      total: genres.length,
      bySource: {},
      oldestCache: null,
      newestCache: null
    };

    genres.forEach((entry) => {
      const source = entry.source || 'unknown';
      stats.bySource[source] = (stats.bySource[source] || 0) + 1;

      if (!stats.oldestCache || entry.lastFetched < stats.oldestCache) {
        stats.oldestCache = entry.lastFetched;
      }
      if (!stats.newestCache || entry.lastFetched > stats.newestCache) {
        stats.newestCache = entry.lastFetched;
      }
    });

    return stats;
  } catch (error) {
    console.error('Failed to get genre cache stats:', error);
    return { total: 0, bySource: {}, oldestCache: null, newestCache: null };
  }
};
