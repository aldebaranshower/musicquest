import { useState, useRef } from 'react';
import { Download, Calendar, User, AlertCircle, CheckCircle, Loader, StopCircle } from 'lucide-react';
import { fetchAllUserListens } from '../../utils/api/listenbrainz';

const ListenBrainzImport = ({ onImportComplete }) => {
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [maxRecords, setMaxRecords] = useState(10000);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [progress, setProgress] = useState({ fetched: 0, total: 0 });
  const abortControllerRef = useRef(null);

  const stopImport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setImportStatus({
        type: 'error',
        message: 'Import stopped by user'
      });
      setIsImporting(false);
    }
  };

  const handleImport = async () => {
    if (!username.trim()) {
      setImportStatus({ type: 'error', message: 'Please enter a username' });
      return;
    }

    abortControllerRef.current = new AbortController();
    setIsImporting(true);
    setImportStatus({ type: 'info', message: 'Fetching listens from ListenBrainz...' });

    let allFormattedListens = [];
    let lastBatchSize = 0;

    try {
      const result = await fetchAllUserListens(
        username.trim(),
        token.trim() || null,
        async (progressData) => {
          setProgress(progressData);
          setImportStatus({
            type: 'info',
            message: `Fetched ${progressData.fetched} listens...`
          });

          // Progressive rendering: Update visualizations every 5000 records
          if (progressData.fetched >= 10000 && progressData.fetched % 5000 === 0 && progressData.fetched !== lastBatchSize) {
            lastBatchSize = progressData.fetched;
            console.log(`📊 Rendering preview with ${progressData.fetched} listens`);

            // Trigger intermediate visualization update
            if (onImportComplete && allFormattedListens.length > 0) {
              setImportStatus({
                type: 'info',
                message: `Rendering preview with ${progressData.fetched} listens...`
              });
            }
          }
        },
        maxRecords,
        abortControllerRef.current.signal
      );

      if (result.success) {
        const formattedListens = result.listens.map((listen) => {
          const track = listen.track_metadata;
          return {
            timestamp: listen.listened_at,
            trackName: track.track_name,
            artistName: track.artist_name,
            albumName: track.release_name || '',
            mbid: track.additional_info?.recording_mbid || null
          };
        });

        allFormattedListens = formattedListens;

        setImportStatus({
          type: 'success',
          message: `Successfully imported ${formattedListens.length} listens!`
        });

        if (onImportComplete) {
          onImportComplete(formattedListens);
        }
      } else {
        setImportStatus({
          type: 'error',
          message: result.error || 'Failed to fetch listens'
        });
      }
    } catch (error) {
      console.error('ListenBrainz import error:', error);
      if (error.name === 'AbortError') {
        setImportStatus({
          type: 'error',
          message: 'Import stopped by user'
        });
      } else {
        setImportStatus({
          type: 'error',
          message: error.message || 'An error occurred during import'
        });
      }
    } finally {
      setIsImporting(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Download className="w-5 h-5 text-green-600 dark:text-green-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Import from ListenBrainz
        </h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>Username</span>
            </div>
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your-listenbrainz-username"
            disabled={isImporting}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            User Token (Optional)
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Optional: for private listens"
            disabled={isImporting}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Get your token at{' '}
            <a
              href="https://listenbrainz.org/profile/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 dark:text-green-400 hover:underline"
            >
              listenbrainz.org/profile
            </a>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Maximum Records to Import
          </label>
          <input
            type="number"
            min="1000"
            max="100000"
            step="1000"
            value={maxRecords}
            onChange={(e) => setMaxRecords(parseInt(e.target.value) || 10000)}
            disabled={isImporting}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Limit the number of listens to import (1,000 - 100,000)
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={isImporting || !username.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {isImporting ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Import Listens</span>
              </>
            )}
          </button>

          {isImporting && (
            <button
              onClick={stopImport}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <StopCircle className="w-5 h-5" />
              <span>Stop</span>
            </button>
          )}
        </div>

        {importStatus && (
          <div
            className={`p-4 rounded-lg flex items-start gap-3 ${
              importStatus.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                : importStatus.type === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
            }`}
          >
            {importStatus.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : importStatus.type === 'error' ? (
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <Loader className="w-5 h-5 flex-shrink-0 mt-0.5 animate-spin" />
            )}
            <div className="flex-1">
              <p className="text-sm">{importStatus.message}</p>
              {progress.total > 0 && (
                <div className="mt-2">
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${(progress.fetched / progress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs mt-1">
                    {progress.fetched.toLocaleString()} / {progress.total.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Import your listening history directly from ListenBrainz. You can stop the import at any time.
            For larger histories, consider exporting a file from ListenBrainz and uploading it.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ListenBrainzImport;
