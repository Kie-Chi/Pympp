import React, { useState } from 'react';
import { Settings, Save, CheckCircle, XCircle } from 'lucide-react';
import { GlobalConfig } from '../types/schema';
import { updateGlobalConfig } from '../api/client';

interface ConfigPanelProps {
  className?: string;
  globalConfig: GlobalConfig;
  authToken: string;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ className = '', globalConfig, authToken }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState<GlobalConfig>(globalConfig);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);

  // Only sync localConfig with globalConfig when there are no local changes
  // This prevents SSE updates from overwriting user's modifications
  React.useEffect(() => {
    if (!hasLocalChanges) {
      setLocalConfig(globalConfig);
    }
  }, [globalConfig, hasLocalChanges]);

  const toggleConfig = (key: keyof GlobalConfig) => {
    setHasLocalChanges(true);
    if (typeof localConfig[key] === 'boolean') {
      setLocalConfig(prev => ({
        ...prev,
        [key]: !prev[key]
      }));
    }
  };

  const handleSave = async () => {
    if (!authToken) return;

    setSaving(true);
    setSaveResult(null);

    try {
      await updateGlobalConfig(localConfig, authToken);
      setSaveResult('success');
      setHasLocalChanges(false); // Allow sync with server after successful save
      setTimeout(() => setSaveResult(null), 3000);
    } catch (err) {
      console.error('Failed to update config:', err);
      setSaveResult('error');
    } finally {
      setSaving(false);
    }
  };

  // Config groups
  const configGroups = [
    {
      title: 'Feature Toggles',
      color: 'purple',
      items: [
        { key: 'show_quiz', label: 'Quiz Mode', desc: 'Show Quiz button' },
        { key: 'show_exercise', label: 'Exercise Mode', desc: 'Show Exercise button' },
        { key: 'show_exercise_part1', label: 'Exercise Part 1 (AT)', desc: 'AT Method option' },
        { key: 'show_exercise_part2', label: 'Exercise Part 2 (Matrix)', desc: 'Strategy Matrix option' },
      ]
    },
    {
      title: 'Editor',
      color: 'blue',
      items: [
        { key: 'editor_fullscreen', label: 'Fullscreen', desc: 'Enable fullscreen mode' },
        { key: 'editor_editing', label: 'Code Editing', desc: 'Allow editing code' },
      ]
    },
    {
      title: 'Controls',
      color: 'green',
      items: [
        { key: 'controls_step', label: 'Step', desc: 'Single step execution' },
        { key: 'controls_step_back', label: 'Step Back', desc: 'Step backward' },
        { key: 'controls_run', label: 'Run', desc: 'Run until end' },
        { key: 'controls_continue', label: 'Continue', desc: 'Jump to current cycle' },
        { key: 'controls_pause', label: 'Pause/Stop', desc: 'Stop execution' },
        { key: 'controls_reset', label: 'Reset', desc: 'Reset simulator' },
      ]
    },
    {
      title: 'UI',
      color: 'indigo',
      items: [
        { key: 'ui_show_pipeline', label: 'Pipeline View', desc: 'Show pipeline visualization' },
        { key: 'ui_show_registers', label: 'Registers View', desc: 'Show register file' },
        { key: 'ui_show_memory', label: 'Memory View', desc: 'Show memory panel' },
        { key: 'ui_forwarding_visualization', label: 'Forwarding Lines', desc: 'Show forwarding arrows' },
        { key: 'ui_change_visualization', label: 'Change Animation', desc: 'Highlight changes' },
      ]
    },
    {
      title: 'Debug',
      color: 'orange',
      items: [
        { key: 'debug_pc_input', label: 'PC Input', desc: 'Show PC input field' },
        { key: 'debug_manual_pc', label: 'Manual PC', desc: 'Allow manual PC setting' },
        { key: 'debug_cycle_slider', label: 'Cycle Slider', desc: 'Enable cycle slider' },
      ]
    },
  ];

  return (
    <div className={`relative ${className}`}>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        title="Configuration Settings"
      >
        <Settings size={18} />
      </button>

      {/* Config panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl w-[360px] z-50 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-slate-50">
            <h3 className="font-semibold text-slate-700">Global Configuration</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          {/* Auth status */}
          <div className="p-4 border-b border-gray-100 bg-green-50">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-600" />
              <span className="text-sm font-medium text-green-700">Authenticated - You can modify configuration</span>
            </div>
          </div>

          {/* Config groups */}
          <div className="p-4 space-y-4">
            {configGroups.map(group => (
              <div key={group.title}>
                <h4 className={`text-sm font-semibold mb-2 text-${group.color}-700 border-b border-${group.color}-200 pb-1`}>
                  {group.title}
                </h4>
                <div className="space-y-2">
                  {group.items.map(item => (
                    <div
                      key={item.key}
                      onClick={() => toggleConfig(item.key as keyof GlobalConfig)}
                      className={`flex items-center justify-between p-2 rounded border transition-colors cursor-pointer hover:bg-slate-50 ${
                        localConfig[item.key as keyof GlobalConfig]
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div>
                        <span className="text-sm font-medium text-slate-700">{item.label}</span>
                        <span className="text-xs text-slate-500 ml-2">{item.desc}</span>
                      </div>
                      <div className={`w-8 h-5 rounded-full transition-colors ${
                        localConfig[item.key as keyof GlobalConfig]
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                      }`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                          localConfig[item.key as keyof GlobalConfig]
                            ? 'translate-x-4'
                            : 'translate-x-0.5'
                        } mt-0.5`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Save button */}
          <div className="p-4 border-t border-gray-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
              {saveResult === 'success' && (
                <CheckCircle size={20} className="text-green-600" />
              )}
              {saveResult === 'error' && (
                <XCircle size={20} className="text-red-600" />
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">
              Changes will be synced to all active sessions
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigPanel;