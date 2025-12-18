import { useState, useRef, useEffect } from 'react';
import { Upload, FileJson, AlertCircle, CheckCircle, Folder, Files, X, Play, Download } from 'lucide-react';
import { useDataParser } from '../../hooks/useDataParser';
import { useGenreFetch } from '../../hooks/useGenreFetch';
import { useData } from '../../context/DataContext';
import errorLogger from '../../utils/errorLogger';
import ListenBrainzImport from './ListenBrainzImport';
import { MergeInfoReport, GenreCleanupReport } from '../DataHealthIndicator';

const FileUpload = () => {
  const { state, dispatch, actionTypes } = useData();
  const { parseFiles, parseProgress } = useDataParser();
  const { fetchGenres, isFetching, canResume, checkForResumableProgress, cancelFetch } = useGenreFetch();
  const [isDragging, setIsDragging] = useState(false);
  const [fileType, setFileType] = useState('auto');
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadMode, setUploadMode] = useState('file');
  const [importMode, setImportMode] = useState('file');
  const [mergeInfo, setMergeInfo] = useState(null);
  const [genreReport, setGenreReport] = useState(null);
  const fileInputRef = useRef(null);
  const directoryInputRef = useRef(null);

  useEffect(() => {
    checkForResumableProgress();
  }, []);

  const handleResume = async () => {
    setUploadStatus({ success: null, message: 'Resuming genre classification...' });
    const listens = state.listens;
    const result = await fetchGenres(listens, true);
    if (result.success) {
      setUploadStatus({ success: true, message: 'Genre classification completed!' });
    } else if (result.cancelled) {
      setUploadStatus({ success: false, message: 'Classification cancelled. You can resume later.' });
    } else {
      setUploadStatus({ success: false, message: result.error });
    }
  };

  const handleCancel = () => {
    cancelFetch();
    setUploadStatus({ success: false, message: 'Classification cancelled. You can resume later.' });
  };

  const handleListenBrainzImport = async (listens) => {
    dispatch({ type: actionTypes.SET_LISTENS, payload: listens });
    setUploadStatus({ success: null, message: 'Fetching genres...' });
    const result = await fetchGenres(listens);
    if (result.success) {
      setUploadStatus({ success: true, message: 'Data loaded successfully!' });
    } else if (result.cancelled) {
      setUploadStatus({ success: false, message: 'Classification cancelled. You can resume later.' });
    } else {
      setUploadStatus({ success: false, message: result.error });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);

    const items = Array.from(e.dataTransfer.items || []);
    const files = [];

    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          if (entry.isDirectory) {
            const dirFiles = await readDirectory(entry);
            files.push(...dirFiles);
          } else {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        } else {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
    }

    if (files.length > 0) {
      await handleFiles(files);
    }
  };

  const readDirectory = async (directoryEntry) => {
    const files = [];
    const reader = directoryEntry.createReader();

    const readEntries = () => {
      return new Promise((resolve, reject) => {
        reader.readEntries(
          async (entries) => {
            if (entries.length === 0) {
              resolve();
              return;
            }

            for (const entry of entries) {
              if (entry.isFile) {
                const file = await new Promise((res) => entry.file(res));
                if (file.name.endsWith('.json') || file.name.endsWith('.jsonl')) {
                  files.push(file);
                }
              } else if (entry.isDirectory) {
                const subFiles = await readDirectory(entry);
                files.push(...subFiles);
              }
            }

            await readEntries();
            resolve();
          },
          reject
        );
      });
    };

    await readEntries();
    return files;
  };

  const handleFileInput = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await handleFiles(files);
    }
  };

  const handleFiles = async (files) => {
    const validFiles = files.filter(f =>
      f.name.endsWith('.json') || f.name.endsWith('.jsonl')
    );

    if (validFiles.length === 0) {
      const error = new Error('Please upload JSON or JSONL files');
      errorLogger.log(error, { context: 'file upload', files: files.map(f => f.name) });
      setUploadStatus({ success: false, message: 'Please upload JSON or JSONL files' });
      return;
    }

    const totalSize = validFiles.reduce((sum, f) => sum + f.size, 0);
    const maxSize = 250 * 1024 * 1024;

    if (totalSize > maxSize) {
      const error = new Error(`Total file size exceeds 250MB limit. Total: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
      errorLogger.log(error, {
        context: 'file upload',
        totalSize,
        maxSize,
        fileCount: validFiles.length
      });
      setUploadStatus({
        success: false,
        message: `Total file size exceeds 250MB limit. Total: ${(totalSize / 1024 / 1024).toFixed(2)}MB`
      });
      return;
    }

    if (totalSize > 200 * 1024 * 1024) {
      errorLogger.warn(`Large file upload: ${(totalSize / 1024 / 1024).toFixed(2)}MB`, {
        context: 'file upload',
        fileCount: validFiles.length
      });
      console.warn(`Large file upload: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
    }

    setUploadStatus({ success: null, message: `Processing ${validFiles.length} file${validFiles.length > 1 ? 's' : ''}...` });

    try {
      const result = await parseFiles(validFiles, fileType);

      if (result.success) {
        if (result.mergeInfo) {
          setMergeInfo({
            ...result.mergeInfo,
            dateRange: result.dateRange
          });
        }

        if (result.genreReport) {
          setGenreReport(result.genreReport);
        }

        const dateStr = result.dateRange
          ? `${result.dateRange.earliest.getFullYear()}-${result.dateRange.latest.getFullYear()}`
          : '';

        const duplicatesRemoved = result.mergeInfo?.duplicates || 0;
        const newListensAdded = (result.mergeInfo?.new || result.count) - duplicatesRemoved;

        let message = '';
        if (duplicatesRemoved > 0) {
          message = `Added ${newListensAdded.toLocaleString()} new listens. Removed ${duplicatesRemoved.toLocaleString()} duplicates (${result.mergeInfo.duplicateRate}%). Total: ${result.count.toLocaleString()} from ${dateStr}`;
        } else {
          message = `Added ${result.mergeInfo?.new || result.count} listens. Total: ${result.count.toLocaleString()} from ${dateStr}`;
        }

        setUploadStatus({
          success: true,
          message: message
        });

        setUploadStatus({ success: null, message: 'Fetching genres...' });
        const listens = state.listens.length > 0 ? state.listens : result.listens;
        await fetchGenres(listens);

        setUploadStatus({ success: true, message: 'Data loaded successfully!' });
      } else {
        errorLogger.log(new Error(result.error), {
          context: 'file parsing',
          fileCount: validFiles.length
        });
        setUploadStatus({ success: false, message: result.error });
      }
    } catch (error) {
      errorLogger.log(error, {
        context: 'file upload',
        fileCount: validFiles.length
      });
      setUploadStatus({ success: false, message: error.message });
    }
  };

  const handleClick = () => {
    if (uploadMode === 'directory') {
      directoryInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-6">
        <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
          Import Method
        </label>
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setImportMode('file')}
            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
              importMode === 'file'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" />
              <span className="font-medium">File Upload</span>
            </div>
          </button>
          <button
            onClick={() => setImportMode('api')}
            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
              importMode === 'api'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              <span className="font-medium">API Import</span>
            </div>
          </button>
        </div>
      </div>

      {importMode === 'api' ? (
        <ListenBrainzImport onImportComplete={handleListenBrainzImport} />
      ) : (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
              File Format Detection
            </label>
            <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setFileType('auto')}
            className={`px-4 py-3 rounded-lg border-2 transition-all ${
              fileType === 'auto'
                ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300'
                : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <div className="font-medium">Auto-Detect</div>
            <div className="text-xs mt-1 opacity-75">Recommended</div>
          </button>
          <button
            onClick={() => setFileType('listenbrainz')}
            className={`px-4 py-3 rounded-lg border-2 transition-all ${
              fileType === 'listenbrainz'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <div className="font-medium">ListenBrainz</div>
            <div className="text-xs mt-1 opacity-75">JSON/JSONL</div>
          </button>
          <button
            onClick={() => setFileType('spotify')}
            className={`px-4 py-3 rounded-lg border-2 transition-all ${
              fileType === 'spotify'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <div className="font-medium">Spotify</div>
            <div className="text-xs mt-1 opacity-75">Streaming History</div>
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
          Upload Mode
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => setUploadMode('file')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
              uploadMode === 'file'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Files className="w-4 h-4" />
            <span className="text-sm font-medium">Multiple Files</span>
          </button>
          <button
            onClick={() => setUploadMode('directory')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
              uploadMode === 'directory'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Folder className="w-4 h-4" />
            <span className="text-sm font-medium">Directory</span>
          </button>
        </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.jsonl"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
        <input
          ref={directoryInputRef}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="flex flex-col items-center">
          {parseProgress.percentage > 0 && parseProgress.percentage < 100 ? (
            <>
              <FileJson className="w-16 h-16 mb-4 text-blue-500 animate-pulse" />
              <div className="w-full max-w-xs mb-4">
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${parseProgress.percentage}%` }}
                  />
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{parseProgress.status}</p>
              {parseProgress.currentFile && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {parseProgress.currentFile}
                </p>
              )}
            </>
          ) : (
            <>
              {uploadMode === 'directory' ? (
                <Folder className="w-16 h-16 mb-4 text-gray-400 dark:text-gray-400" />
              ) : (
                <Upload className="w-16 h-16 mb-4 text-gray-400 dark:text-gray-400" />
              )}
              <h3 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200">
                {uploadMode === 'directory'
                  ? 'Drop a directory here or click to browse'
                  : 'Drop JSON/JSONL files here or click to browse'
                }
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-300 mb-2">
                ListenBrainz or Spotify extended streaming history
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-400 mb-1">
                Supports multiple files and directories
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-400">
                Maximum total size: 250MB
              </p>
            </>
          )}
        </div>
      </div>

      {uploadStatus && (
        <div
          className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
            uploadStatus.success === true
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : uploadStatus.success === false
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
          }`}
        >
          {uploadStatus.success === true ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : uploadStatus.success === false ? (
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />
          )}
          <p className="text-sm">{uploadStatus.message}</p>
        </div>
      )}

      {mergeInfo && (
        <div className="mt-4">
          <MergeInfoReport
            mergeInfo={mergeInfo}
            dateRange={mergeInfo.dateRange}
            onClose={() => setMergeInfo(null)}
          />
        </div>
      )}

      {genreReport && (
        <div className="mt-4">
          <GenreCleanupReport
            report={genreReport}
            onClose={() => setGenreReport(null)}
          />
        </div>
      )}

      {canResume && !isFetching && (
        <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                Resume previous classification
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                You have an incomplete genre classification that can be resumed
              </p>
            </div>
            <button
              onClick={handleResume}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />
              <span className="text-sm font-medium">Resume</span>
            </button>
          </div>
        </div>
      )}

      {state.genreClassificationProgress.total > 0 && isFetching && (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Fetching genres...
            </span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-blue-600 dark:text-blue-400">
                {state.genreClassificationProgress.current} / {state.genreClassificationProgress.total}
              </span>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-xs font-medium"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            </div>
          </div>
          <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{
                width: `${(state.genreClassificationProgress.current / state.genreClassificationProgress.total) * 100}%`
              }}
            />
          </div>
          {state.genreClassificationProgress.currentArtist && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              Current: {state.genreClassificationProgress.currentArtist}
            </p>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default FileUpload;
