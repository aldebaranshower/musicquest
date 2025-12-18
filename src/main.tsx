import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './utils/cacheDebugger.js';
import { migrateOldData } from './utils/dataMigration.js';

migrateOldData().then((result) => {
  if (result.success && result.migrated) {
    console.log('🎉 Welcome to MusicQuest! Your data has been migrated successfully.');
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
