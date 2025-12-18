import { useState } from 'react';
import { Moon, Sun, Settings as SettingsIcon, Sliders } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { TimePeriod } from '../../utils/timePeriodGrouping';
import AdvancedSettingsModal from './AdvancedSettingsModal';

const SettingsPanel = () => {
  const { state, dispatch, actionTypes } = useData();
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const visualizationModes = [
    { value: 'sankey', label: 'Sankey Flow', description: 'Genre transitions over time' },
    { value: 'galaxy', label: 'Genre Galaxy', description: 'Orbital view with timeline spiral' },
    { value: 'milestone', label: 'Milestone Timeline', description: 'Story mode with key moments' },
    { value: 'stream', label: 'Stream Graph', description: 'Top genres flowing over time' },
    { value: 'clock', label: 'Listening Clock', description: '24-hour listening pattern' },
    { value: 'fingerprint', label: 'Listening Fingerprint', description: 'Your listening habits radar' }
  ];

  const timePeriods = [
    { value: TimePeriod.DAILY, label: 'Daily' },
    { value: TimePeriod.WEEKLY, label: 'Weekly' },
    { value: TimePeriod.MONTHLY, label: 'Monthly' },
    { value: TimePeriod.QUARTERLY, label: 'Quarterly' },
    { value: TimePeriod.YEARLY, label: 'Yearly' }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Settings</h2>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Theme
            </label>
            <button
              onClick={() => dispatch({ type: actionTypes.TOGGLE_DARK_MODE })}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="Toggle dark mode"
            >
              {state.darkMode ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
            Visualization Mode
          </label>
          <div className="grid grid-cols-1 gap-2">
            {visualizationModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => dispatch({ type: actionTypes.SET_VISUALIZATION_MODE, payload: mode.value })}
                className={`p-3 rounded-lg text-left transition-all border-2 ${
                  state.visualizationMode === mode.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="font-medium text-sm text-gray-800 dark:text-gray-200">
                  {mode.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {mode.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
            Time Period
          </label>
          <div className="grid grid-cols-2 gap-2">
            {timePeriods.map((period) => (
              <button
                key={period.value}
                onClick={() => dispatch({ type: actionTypes.SET_TIME_PERIOD, payload: period.value })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                  state.timePeriod === period.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {state.listens.length > 0 && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <div className="flex justify-between mb-1">
                <span>Total Listens:</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {state.listens.length.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Unique Artists:</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {new Set(state.listens.map(l => l.artistName)).size.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowAdvancedSettings(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
          >
            <Sliders className="w-4 h-4" />
            <span className="text-sm font-medium">Advanced Settings</span>
          </button>
        </div>
      </div>

      <AdvancedSettingsModal
        isOpen={showAdvancedSettings}
        onClose={() => setShowAdvancedSettings(false)}
      />
    </div>
  );
};

export default SettingsPanel;
