import { useEffect, useRef, useState, useCallback } from 'react';
import { useData } from '../../context/DataContext';
import { groupListensByTimePeriod } from '../../utils/timePeriodGrouping';
import { detectGatewayArtists } from '../../utils/gatewayArtistDetection';
import { generateMilestones } from '../../utils/dataPreparation';
import SankeyFlowVisualization from './SankeyFlowVisualization';
import GenreGalaxyVisualization from './GenreGalaxyVisualization';
import MilestoneTimelineVisualization from './MilestoneTimelineVisualization';
import GenreStreamGraph from './GenreStreamGraph';
import ListeningClockVisualization from './ListeningClockVisualization';
import ListeningFingerprintRadar from './ListeningFingerprintRadar';
import GenreTooltip from './GenreTooltip';
import TimelineControls from './TimelineControls';
import ClassificationProgress from './ClassificationProgress';
import { DataHealthIndicator } from '../DataHealthIndicator';

const GenreTimeline = () => {
  const { state, dispatch, actionTypes } = useData();
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [groupedData, setGroupedData] = useState([]);
  const [gatewayArtists, setGatewayArtists] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [currentPeriodIndex, setCurrentPeriodIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [unknownDisplay, setUnknownDisplay] = useState('faded');
  const [classificationDismissed, setClassificationDismissed] = useState(false);

  useEffect(() => {
    const savedDisplay = localStorage.getItem('viz_unknownDisplay');
    if (savedDisplay) {
      setUnknownDisplay(savedDisplay);
    }
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height: Math.max(500, width * 0.7) });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!state.listens.length || !state.genreMap.size) return;

    const data = groupListensByTimePeriod(state.listens, state.timePeriod, state.genreMap);
    setGroupedData(data);

    const artists = detectGatewayArtists(data, state.genreMap, state.listens);
    setGatewayArtists(artists);

    const milestoneData = generateMilestones(data, state.genreMap, artists);
    setMilestones(milestoneData);

    setCurrentPeriodIndex(Math.max(0, data.length - 1));
  }, [state.listens, state.genreMap, state.timePeriod]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'ArrowLeft':
          setCurrentPeriodIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
          setCurrentPeriodIndex(prev => Math.min(groupedData.length - 1, prev + 1));
          break;
        case ' ':
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;
        case 'Escape':
          setSelectedGenre(null);
          break;
        case 'g':
          setSelectedGenre(null);
          break;
        case 'h':
          setTooltipData(null);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [groupedData.length]);

  const handleGenreHover = useCallback((data, position) => {
    setTooltipData(data);
    setTooltipPosition(position);
  }, []);

  const handleGenreClick = useCallback((genre) => {
    setSelectedGenre(prev => prev === genre ? null : genre);
  }, []);

  const handleGatewayArtistClick = useCallback((gateway) => {
    setCurrentPeriodIndex(gateway.periodIndex);
    setSelectedGenre(gateway.triggerGenre);
  }, []);

  const handleMilestoneClick = useCallback((milestone) => {
    setCurrentPeriodIndex(milestone.periodIndex);
    if (milestone.genre) {
      setSelectedGenre(milestone.genre);
    }
  }, []);

  if (!state.listens.length) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
        <p className="text-gray-500 dark:text-gray-400">
          Upload listening data to see visualizations
        </p>
      </div>
    );
  }

  if (!groupedData.length) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-xl">
        <p className="text-gray-500 dark:text-gray-400">
          Processing your listening data...
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full space-y-6">
      {!classificationDismissed && (
        <ClassificationProgress
          current={state.genreClassificationProgress.current}
          total={state.genreClassificationProgress.total}
          currentArtist={state.genreClassificationProgress.currentArtist}
          isClassifying={state.isLoading}
          estimatedTimeRemaining={
            state.genreClassificationProgress.total > 0
              ? `${Math.ceil((state.genreClassificationProgress.total - state.genreClassificationProgress.current) / 5)} min`
              : null
          }
          onPause={() => {}}
          onResume={() => {}}
          onCancel={() => {
            setClassificationDismissed(true);
            dispatch({ type: actionTypes.SET_LOADING, payload: false });
          }}
          onRunInBackground={() => {
            setClassificationDismissed(true);
          }}
        />
      )}

      <DataHealthIndicator listens={state.listens} />

      {state.visualizationMode === 'milestone' && (
        <div className="mb-8 px-4">
          <div className="bg-gradient-to-br from-gray-900/50 via-gray-800/30 to-gray-900/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-pink-500/5 blur-2xl pointer-events-none" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">🎵</span>
                <h2 className="text-3xl md:text-4xl font-bold text-white">
                  Your Music Journey
                </h2>
              </div>

              <p className="text-lg md:text-xl text-cyan-400 font-medium mb-4">
                Discover how your taste evolved through{' '}
                <span className="font-bold text-cyan-300">{gatewayArtists.length} gateway artists</span>
              </p>

              <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">📊</span>
                  <span>{state.listens.length.toLocaleString()} total listens</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">🎤</span>
                  <span>{new Set(state.listens.map(l => l.artistName)).size.toLocaleString()} unique artists</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">🎸</span>
                  <span>{state.genreMap.size} genres tracked</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {state.visualizationMode === 'milestone' ? 'Key Milestones' : 'Your Music Genre Evolution'}
          </h2>
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
            <span>
              <strong className="text-gray-900 dark:text-white">
                {state.listens.length.toLocaleString()}
              </strong>{' '}
              total listens
            </span>
            <span>
              <strong className="text-gray-900 dark:text-white">
                {new Set(state.listens.map(l => l.artistName)).size.toLocaleString()}
              </strong>{' '}
              unique artists
            </span>
            <span>
              <strong className="text-gray-900 dark:text-white">
                {gatewayArtists.length}
              </strong>{' '}
              gateway artists
            </span>
            {state.genreClassificationProgress.total > 0 && (
              <span>
                <strong className="text-gray-900 dark:text-white">
                  {Math.round((state.genreClassificationProgress.current / state.genreClassificationProgress.total) * 100)}%
                </strong>{' '}
                classified
              </span>
            )}
            {classificationDismissed &&
             state.genreClassificationProgress.current < state.genreClassificationProgress.total &&
             state.genreClassificationProgress.total > 0 && (
              <button
                onClick={() => setClassificationDismissed(false)}
                className="ml-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
              >
                <span className="text-sm">🔄</span>
                <div className="text-left">
                  <div className="font-semibold">Resume Classification</div>
                  <div className="text-[10px] opacity-90">
                    {state.genreClassificationProgress.current.toLocaleString()} / {state.genreClassificationProgress.total.toLocaleString()} ({
                      Math.round((state.genreClassificationProgress.current / state.genreClassificationProgress.total) * 100)
                    }%)
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>

        {selectedGenre && (() => {
          const genreListens = state.listens.filter(l => {
            const genres = state.genreMap.get(l.artistName) || ['Unknown'];
            return genres.includes(selectedGenre);
          });
          const genrePercentage = (genreListens.length / state.listens.length) * 100;
          const topArtists = Array.from(
            genreListens.reduce((acc, l) => {
              acc.set(l.artistName, (acc.get(l.artistName) || 0) + 1);
              return acc;
            }, new Map())
          )
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

          return (
            <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Filtering by genre: <span className="text-cyan-600 dark:text-cyan-400">{selectedGenre}</span>
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                    <span>
                      <strong className="text-blue-900 dark:text-blue-100">
                        {genreListens.length.toLocaleString()}
                      </strong>{' '}
                      listens ({genrePercentage.toFixed(1)}%)
                    </span>
                    {topArtists.length > 0 && (
                      <span className="flex items-center gap-1">
                        Top:{' '}
                        {topArtists.map((a, i) => (
                          <span key={i} className="text-blue-900 dark:text-blue-100">
                            {a[0]}{i < topArtists.length - 1 ? ',' : ''}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedGenre(null)}
                  className="px-4 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
                >
                  Clear Filter
                </button>
              </div>
            </div>
          );
        })()}

        <div className="relative">
          {state.visualizationMode === 'sankey' && (
            <SankeyFlowVisualization
              groupedData={groupedData}
              gatewayArtists={gatewayArtists}
              genreMap={state.genreMap}
              listens={state.listens}
              width={dimensions.width - 48}
              height={dimensions.height}
              onGenreHover={handleGenreHover}
              onGenreClick={handleGenreClick}
              onGatewayArtistClick={handleGatewayArtistClick}
              selectedGenre={selectedGenre}
              unknownDisplay={unknownDisplay}
            />
          )}

          {state.visualizationMode === 'galaxy' && (
            <GenreGalaxyVisualization
              groupedData={groupedData}
              gatewayArtists={gatewayArtists}
              genreMap={state.genreMap}
              listens={state.listens}
              width={dimensions.width - 48}
              height={dimensions.height}
              onGenreHover={handleGenreHover}
              onGenreClick={handleGenreClick}
              onGatewayArtistClick={handleGatewayArtistClick}
              selectedGenre={selectedGenre}
              currentPeriodIndex={currentPeriodIndex}
              unknownDisplay={unknownDisplay}
            />
          )}

          {state.visualizationMode === 'milestone' && (
            <MilestoneTimelineVisualization
              groupedData={groupedData}
              milestones={milestones}
              genreMap={state.genreMap}
              listens={state.listens}
              width={dimensions.width - 48}
              height={dimensions.height}
              onGenreHover={handleGenreHover}
              onGenreClick={handleGenreClick}
              onMilestoneClick={handleMilestoneClick}
              selectedGenre={selectedGenre}
              unknownDisplay={unknownDisplay}
            />
          )}

          {state.visualizationMode === 'stream' && (
            <GenreStreamGraph
              listens={state.listens}
              width={dimensions.width - 48}
              height={dimensions.height}
            />
          )}

          {state.visualizationMode === 'clock' && (
            <ListeningClockVisualization
              listens={state.listens}
              width={Math.min(dimensions.width - 48, 600)}
              height={Math.min(dimensions.width - 48, 600)}
            />
          )}

          {state.visualizationMode === 'fingerprint' && (
            <ListeningFingerprintRadar
              listens={state.listens}
              width={Math.min(dimensions.width - 48, 600)}
              height={Math.min(dimensions.width - 48, 600)}
            />
          )}

          <GenreTooltip
            data={tooltipData}
            position={tooltipPosition}
            visible={!!tooltipData}
          />
        </div>
      </div>

      {state.visualizationMode === 'galaxy' && (
        <TimelineControls
          groupedData={groupedData}
          currentPeriodIndex={currentPeriodIndex}
          onPeriodChange={setCurrentPeriodIndex}
          isPlaying={isPlaying}
          onPlayPauseToggle={setIsPlaying}
          playbackSpeed={1}
        />
      )}

      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Keyboard Shortcuts
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 dark:text-gray-400">
          <div>
            <kbd className="px-2 py-1 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">←→</kbd>
            <span className="ml-1">Navigate</span>
          </div>
          <div>
            <kbd className="px-2 py-1 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">Space</kbd>
            <span className="ml-1">Play/Pause</span>
          </div>
          <div>
            <kbd className="px-2 py-1 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">Esc</kbd>
            <span className="ml-1">Clear Filter</span>
          </div>
          <div>
            <kbd className="px-2 py-1 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">G</kbd>
            <span className="ml-1">Toggle Gateway</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenreTimeline;
