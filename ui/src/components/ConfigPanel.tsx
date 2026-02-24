import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { appConfig, defaultConfig, demoConfig, AppConfig } from '../config';

interface ConfigPanelProps {
  className?: string;
}

const CONFIG_STORAGE_KEY = 'mips-simulator-config-preset';

const ConfigPanel: React.FC<ConfigPanelProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Initialize from localStorage
  const getInitialPreset = (): 'default' | 'demo' => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      return (saved === 'demo' || saved === 'default') ? saved : 'default';
    }
    return 'default';
  };
  
  const [currentPreset, setCurrentPreset] = useState<'default' | 'demo' | 'custom'>(getInitialPreset());

  const applyPreset = (preset: 'default' | 'demo') => {
    // Save to localStorage before reload
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(CONFIG_STORAGE_KEY, preset);
    }
    setCurrentPreset(preset);
    const targetConfig = preset === 'demo' ? demoConfig : defaultConfig;
    Object.assign(appConfig, targetConfig);
    window.location.reload();
  };

  return (
    <div className={`relative ${className}`}>
      {/* 切换按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        title="Configuration Settings"
      >
        <Settings size={18} />
      </button>

      {/* 配置面板 */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-80 z-50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-700">Configuration Presets</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            {/* 默认配置 */}
            <button
              onClick={() => applyPreset('default')}
              className={`w-full text-left p-3 rounded-md border-2 transition-all ${
                currentPreset === 'default'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="font-semibold text-slate-700">Default Mode</div>
              <div className="text-xs text-slate-500 mt-1">
                All features enabled, full development experience
              </div>
            </button>

            {/* 演示配置 */}
            <button
              onClick={() => applyPreset('demo')}
              className={`w-full text-left p-3 rounded-md border-2 transition-all ${
                currentPreset === 'demo'
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 hover:border-amber-300'
              }`}
            >
              <div className="font-semibold text-slate-700">Demo Mode</div>
              <div className="text-xs text-slate-500 mt-1">
                Limited editing and features, suitable for demonstrations
              </div>
            </button>
          </div>

          {/* Quick Toggle for Register Timing Detail */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-700 font-medium">Register Timing Detail Mode</span>
              <input
                type="checkbox"
                checked={appConfig.ui.showRegisterTimingDetail}
                onChange={(e) => {
                  appConfig.ui.showRegisterTimingDetail = e.target.checked;
                  setCurrentPreset('custom');
                  // Force re-render
                  setIsOpen(false);
                  setTimeout(() => setIsOpen(true), 0);
                }}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
            </label>
            <div className="text-xs text-slate-500 mt-1">
              {appConfig.ui.showRegisterTimingDetail 
                ? "Showing tuse/tnew values (Detail Mode)" 
                : "Showing remaining cycles (Simple Mode)"}
            </div>
          </div>

          {/* 当前配置状态 */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs text-slate-600 space-y-1">
              <div className="font-semibold mb-2">Current Configuration:</div>
              <div className="flex justify-between">
                <span>Editor Fullscreen:</span>
                <span className={appConfig.editor.enableFullscreen ? 'text-green-600' : 'text-red-600'}>
                  {appConfig.editor.enableFullscreen ? '✓ Enabled' : '✗ Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Code Editing:</span>
                <span className={appConfig.editor.enableEditing ? 'text-green-600' : 'text-red-600'}>
                  {appConfig.editor.enableEditing ? '✓ Enabled' : '✗ Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Step Back Button:</span>
                <span className={appConfig.controls.enableStepBack ? 'text-green-600' : 'text-red-600'}>
                  {appConfig.controls.enableStepBack ? '✓ Enabled' : '✗ Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Run Button:</span>
                <span className={appConfig.controls.enableRun ? 'text-green-600' : 'text-red-600'}>
                  {appConfig.controls.enableRun ? '✓ Enabled' : '✗ Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Forwarding Visualization:</span>
                <span className={appConfig.ui.enableForwardingVisualization ? 'text-green-600' : 'text-red-600'}>
                  {appConfig.ui.enableForwardingVisualization ? '✓ Enabled' : '✗ Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Change Animation:</span>
                <span className={appConfig.ui.enableChangeVisualization ? 'text-green-600' : 'text-red-600'}>
                  {appConfig.ui.enableChangeVisualization ? '✓ Enabled' : '✗ Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Register Timing Detail:</span>
                <span className={appConfig.ui.showRegisterTimingDetail ? 'text-green-600' : 'text-red-600'}>
                  {appConfig.ui.showRegisterTimingDetail ? '✓ Detail Mode' : '✗ Simple Mode'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>PC Input:</span>
                <span className={appConfig.debug.showPCInput ? 'text-green-600' : 'text-red-600'}>
                  {appConfig.debug.showPCInput ? '✓ Shown' : '✗ Hidden'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Cycle Slider:</span>
                <span className={appConfig.debug.enableCycleSlider ? 'text-green-600' : 'text-red-600'}>
                  {appConfig.debug.enableCycleSlider ? '✓ Enabled' : '✗ Disabled'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-400 text-center">
            Page will reload after switching configuration
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigPanel;
