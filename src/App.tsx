import { useState } from 'react';
import { DataProvider } from './context/DataContext';
import FileUpload from './components/FileUpload/FileUpload';
import SettingsPanel from './components/Settings/SettingsPanel';
import GenreTimeline from './components/Timeline/GenreTimeline';
import ErrorLogViewer from './components/ErrorLog/ErrorLogViewer';
import { Music, AlertCircle } from 'lucide-react';

function App() {
  const [showErrorLog, setShowErrorLog] = useState(false);

  return (
    <DataProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-200">
        <div className="container mx-auto px-4 py-8">
          <header className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Music className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                MusicQuest
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Discover gateway artists, visualize genre evolution, and explore your music listening journey
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <FileUpload />
            </div>

            <div>
              <SettingsPanel />
            </div>
          </div>

          <div className="mb-8">
            <GenreTimeline />
          </div>

          <footer className="text-center text-sm text-gray-500 dark:text-gray-400 mt-12 pb-8">
            <p>Open source music listening history visualizer</p>
            <p className="mt-2">
              Supports ListenBrainz and Spotify data exports (JSON/JSONL)
            </p>
            <button
              onClick={() => setShowErrorLog(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-gray-700 dark:text-gray-300"
            >
              <AlertCircle className="w-4 h-4" />
              <span>View Error Logs</span>
            </button>
          </footer>
        </div>
      </div>

      <ErrorLogViewer isOpen={showErrorLog} onClose={() => setShowErrorLog(false)} />
    </DataProvider>
  );
}

export default App;
