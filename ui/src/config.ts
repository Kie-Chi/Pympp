import { GlobalConfig } from './types/schema';
import { getGlobalConfig, createConfigStream } from './api/client';

// Legacy AppConfig interface for backward compatibility
export interface AppConfig {
  editor: {
    enableFullscreen: boolean;
    enableEditing: boolean;
  };
  controls: {
    enableStep: boolean;
    enableStepBack: boolean;
    enableRun: boolean;
    enableContinue: boolean;
    enablePause: boolean;
    enableReset: boolean;
  };
  ui: {
    showPipeline: boolean;
    showRegisters: boolean;
    showMemory: boolean;
    enableForwardingVisualization: boolean;
    enableChangeVisualization: boolean;
    showRegisterTimingDetail: boolean;
  };
  debug: {
    showPCInput: boolean;
    enableManualPC: boolean;
    enableCycleSlider: boolean;
  };
}

// Feature toggle interface (new)
export interface FeatureConfig {
  showQuiz: boolean;
  showExercise: boolean;
  showExercisePart1: boolean;
  showExercisePart2: boolean;
}

// Default configs (used as fallback)
export const defaultConfig: AppConfig = {
  editor: { enableFullscreen: true, enableEditing: true },
  controls: { enableStep: true, enableStepBack: true, enableRun: true, enableContinue: true, enablePause: true, enableReset: true },
  ui: { showPipeline: true, showRegisters: true, showMemory: true, enableForwardingVisualization: true, enableChangeVisualization: true, showRegisterTimingDetail: false },
  debug: { showPCInput: true, enableManualPC: true, enableCycleSlider: true },
};

export const demoConfig: AppConfig = {
  editor: { enableFullscreen: true, enableEditing: true },
  controls: { enableStep: true, enableStepBack: true, enableRun: true, enableContinue: true, enablePause: true, enableReset: false },
  ui: { showPipeline: true, showRegisters: true, showMemory: true, enableForwardingVisualization: true, enableChangeVisualization: true, showRegisterTimingDetail: false },
  debug: { showPCInput: true, enableManualPC: true, enableCycleSlider: true },
};

const defaultFeatureConfig: FeatureConfig = {
  showQuiz: true,
  showExercise: true,
  showExercisePart1: true,
  showExercisePart2: true,
};

// Global state
type ConfigChangeListener = (config: GlobalConfig) => void;

let globalConfig: GlobalConfig | null = null;
let configListeners: ConfigChangeListener[] = [];
let sseConnection: EventSource | null = null;
let initialized = false;

// Convert GlobalConfig to legacy AppConfig
export const globalToAppConfig = (global: GlobalConfig): AppConfig => ({
  editor: {
    enableFullscreen: global.editor_fullscreen,
    enableEditing: global.editor_editing,
  },
  controls: {
    enableStep: global.controls_step,
    enableStepBack: global.controls_step_back,
    enableRun: global.controls_run,
    enableContinue: global.controls_continue,
    enablePause: global.controls_pause,
    enableReset: global.controls_reset,
  },
  ui: {
    showPipeline: global.ui_show_pipeline,
    showRegisters: global.ui_show_registers,
    showMemory: global.ui_show_memory,
    enableForwardingVisualization: global.ui_forwarding_visualization,
    enableChangeVisualization: global.ui_change_visualization,
    showRegisterTimingDetail: false, // Not in GlobalConfig yet
  },
  debug: {
    showPCInput: global.debug_pc_input,
    enableManualPC: global.debug_manual_pc,
    enableCycleSlider: global.debug_cycle_slider,
  },
});

// Convert GlobalConfig to FeatureConfig
export const globalToFeatureConfig = (global: GlobalConfig): FeatureConfig => ({
  showQuiz: global.show_quiz,
  showExercise: global.show_exercise,
  showExercisePart1: global.show_exercise_part1,
  showExercisePart2: global.show_exercise_part2,
});

// Get current global config (with fallback)
export const getGlobalConfigState = (): GlobalConfig => {
  if (globalConfig) {
    return globalConfig;
  }
  // Return default if not initialized
  return {
    id: 1,
    show_quiz: true,
    show_exercise: true,
    show_exercise_part1: true,
    show_exercise_part2: true,
    editor_fullscreen: true,
    editor_editing: true,
    controls_step: true,
    controls_step_back: true,
    controls_run: true,
    controls_continue: true,
    controls_pause: true,
    controls_reset: true,
    ui_show_pipeline: true,
    ui_show_registers: true,
    ui_show_memory: true,
    ui_forwarding_visualization: true,
    ui_change_visualization: true,
    debug_pc_input: true,
    debug_manual_pc: true,
    debug_cycle_slider: true,
    updated_at: null,
  };
};

// Get app config (for backward compatibility)
export const appConfig: AppConfig = defaultConfig;

// Update legacy appConfig from GlobalConfig
const updateAppConfigFromGlobal = (global: GlobalConfig) => {
  const appCfg = globalToAppConfig(global);
  Object.assign(appConfig, appCfg);
};

// Initialize config from backend
export const initializeConfig = async (): Promise<void> => {
  if (initialized) return;

  try {
    const config = await getGlobalConfig();
    globalConfig = config;
    updateAppConfigFromGlobal(config);
    initialized = true;

    // Start SSE connection for real-time updates
    startConfigStream();
  } catch (err) {
    console.warn('Failed to fetch global config, using defaults:', err);
    initialized = true;
  }
};

// Start SSE stream for config updates
const startConfigStream = () => {
  if (sseConnection) return;

  try {
    sseConnection = createConfigStream();

    sseConnection.onmessage = (event) => {
      try {
        const config: GlobalConfig = JSON.parse(event.data);
        globalConfig = config;
        updateAppConfigFromGlobal(config);

        // Notify listeners
        configListeners.forEach(listener => listener(config));
      } catch (err) {
        console.warn('Failed to parse config update:', err);
      }
    };

    sseConnection.onerror = (err) => {
      console.warn('SSE connection error:', err);
      // Reconnect after delay
      setTimeout(() => {
        if (sseConnection) {
          sseConnection.close();
          sseConnection = null;
          startConfigStream();
        }
      }, 5000);
    };
  } catch (err) {
    console.warn('Failed to start SSE connection:', err);
  }
};

// Subscribe to config changes
export const subscribeConfig = (listener: ConfigChangeListener): () => void => {
  configListeners.push(listener);

  // Return unsubscribe function
  return () => {
    configListeners = configListeners.filter(l => l !== listener);
  };
};

// Legacy functions for backward compatibility
export const getConfig = (): AppConfig => appConfig;

export const setConfig = (config: AppConfig) => {
  Object.assign(appConfig, config);
};

export const setConfigPreset = (preset: 'default' | 'demo') => {
  const targetConfig = preset === 'demo' ? demoConfig : defaultConfig;
  Object.assign(appConfig, targetConfig);
};

// Cleanup SSE connection
export const cleanupConfig = () => {
  if (sseConnection) {
    sseConnection.close();
    sseConnection = null;
  }
  configListeners = [];
};