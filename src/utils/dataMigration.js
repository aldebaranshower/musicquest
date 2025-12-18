import { initDB, getListeningData, saveListeningData, getGenreCacheStats } from './storage/indexedDB';

export async function migrateOldData() {
  try {
    console.log('🔄 Checking for legacy Music Genre Evolution data...');

    let migrationPerformed = false;

    const oldDBNames = [
      'MusicGenreEvolutionDB',
      'MusicGenomeDB',
      'GenreVisualizerDB'
    ];

    const databases = await indexedDB.databases();

    for (const oldDBName of oldDBNames) {
      const oldDB = databases.find(db => db.name === oldDBName);

      if (oldDB) {
        console.log(`📦 Found legacy database: ${oldDBName}`);
        console.log('🔄 Migrating to MusicQuestDB...');

        try {
          const oldDatabase = await new Promise((resolve, reject) => {
            const req = indexedDB.open(oldDBName);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });

          const storeNames = Array.from(oldDatabase.objectStoreNames);
          console.log(`   Object stores found: ${storeNames.join(', ')}`);

          const newDB = await initDB();

          const possibleListenStores = ['listens', 'listening_data', 'tracks'];
          const possibleGenreStores = ['genres', 'genreCache', 'genre_cache', 'artists'];

          for (const storeName of storeNames) {
            if (possibleListenStores.includes(storeName)) {
              console.log(`   📥 Migrating listens from "${storeName}"...`);
              const data = await getAllFromStore(oldDatabase, storeName);
              if (data && data.length > 0) {
                await saveListeningData(data, false);
                console.log(`   ✅ Migrated ${data.length.toLocaleString()} listens`);
                migrationPerformed = true;
              }
            } else if (possibleGenreStores.includes(storeName)) {
              console.log(`   📥 Migrating genre cache from "${storeName}"...`);
              const data = await getAllFromStore(oldDatabase, storeName);
              if (data && data.length > 0) {
                const tx = newDB.transaction('genres', 'readwrite');
                for (const item of data) {
                  await tx.store.put(item);
                }
                await tx.done;
                console.log(`   ✅ Migrated ${data.length.toLocaleString()} cached genres`);
                migrationPerformed = true;
              }
            }
          }

          oldDatabase.close();

          console.log(`🗑️  Deleting legacy database: ${oldDBName}`);
          await indexedDB.deleteDatabase(oldDBName);
          console.log(`   ✅ Removed ${oldDBName}`);

        } catch (error) {
          console.error(`   ❌ Error migrating ${oldDBName}:`, error);
        }
      }
    }

    const oldLocalStorageKeys = [
      'music-genre-settings',
      'music-genre-theme',
      'music-genome-cache',
      'genre-viz-settings',
      'viz-theme',
      'listening-data-cache'
    ];

    const newKeyMap = {
      'music-genre-settings': 'musicquest_settings',
      'music-genre-theme': 'musicquest_theme',
      'music-genome-cache': 'musicquest_cache',
      'genre-viz-settings': 'musicquest_settings',
      'viz-theme': 'musicquest_theme',
      'listening-data-cache': 'musicquest_cache'
    };

    for (const oldKey of oldLocalStorageKeys) {
      const value = localStorage.getItem(oldKey);
      if (value) {
        const newKey = newKeyMap[oldKey] || oldKey.replace(/^(music-gene(re|ome)|genre-viz|viz)/, 'musicquest');

        const existingValue = localStorage.getItem(newKey);
        if (!existingValue) {
          localStorage.setItem(newKey, value);
          console.log(`✅ Migrated localStorage: ${oldKey} → ${newKey}`);
          migrationPerformed = true;
        }

        localStorage.removeItem(oldKey);
        console.log(`🗑️  Removed legacy key: ${oldKey}`);
      }
    }

    if (migrationPerformed) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ MIGRATION COMPLETE');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const listens = await getListeningData();
      const genreStats = await getGenreCacheStats();

      console.log(`   Total listens: ${listens.length.toLocaleString()}`);
      console.log(`   Cached genres: ${genreStats.total.toLocaleString()}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      return {
        success: true,
        migrated: true,
        listens: listens.length,
        genres: genreStats.total
      };
    } else {
      console.log('✅ No legacy data found - fresh MusicQuest installation');
      return {
        success: true,
        migrated: false
      };
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (error) {
      resolve([]);
    }
  });
}

export function shouldShowMigrationNotice() {
  const migrationCompleted = localStorage.getItem('musicquest_migration_completed');
  return !migrationCompleted;
}

export function markMigrationComplete() {
  localStorage.setItem('musicquest_migration_completed', Date.now().toString());
}

if (typeof window !== 'undefined') {
  window.migrateLegacyData = migrateOldData;
  console.log('💡 Manual migration available: window.migrateLegacyData()');
}
