export interface AppConfig {
  editor: {
    enableFullscreen: boolean;      // 是否启用全屏功能
    enableEditing: boolean;          // 是否允许编辑代码
  };
  controls: {
    enableStep: boolean;             // 是否启用单步执行
    enableStepBack: boolean;         // 是否启用回退
    enableRun: boolean;              // 是否启用运行
    enableContinue: boolean;         // 是否启用继续执行
    enablePause: boolean;            // 是否启用暂停
    enableReset: boolean;            // 是否启用重置
  };
  ui: {
    showPipeline: boolean;           // 是否显示流水线
    showRegisters: boolean;          // 是否显示寄存器
    showMemory: boolean;             // 是否显示内存
    enableForwardingVisualization: boolean;  // 是否显示 forwarding 线条
    enableChangeVisualization: boolean;      // 是否显示数值变化动画
    showRegisterTimingDetail: boolean;       // 是否显示寄存器详细时序信息（detail 模式）
  };
  debug: {
    showPCInput: boolean;            // 是否显示 PC 输入框
    enableManualPC: boolean;         // 是否允许手动设置 PC
    enableCycleSlider: boolean;      // 是否允许使用 cycle 滑块
  };
}

export const defaultConfig: AppConfig = {
  editor: {
    enableFullscreen: true,
    enableEditing: true,
  },
  controls: {
    enableStep: true,
    enableStepBack: true,
    enableRun: true,
    enableContinue: true,
    enablePause: true,
    enableReset: true,
  },
  ui: {
    showPipeline: true,
    showRegisters: true,
    showMemory: true,
    enableForwardingVisualization: true,
    enableChangeVisualization: true,
    showRegisterTimingDetail: false,  // 默认不显示详细时序
  },
  debug: {
    showPCInput: true,
    enableManualPC: true,
    enableCycleSlider: true,
  },
};

export const demoConfig: AppConfig = {
  editor: {
    enableFullscreen: true,         // 禁用全屏
    enableEditing: true,            // 禁止编辑
  },
  controls: {
    enableStep: true,    
    enableStepBack: true,           // 禁用回退    
    enableRun: true,
    enableContinue: true,
    enablePause: true,
    enableReset: false,              // 禁用重置
  },
  ui: {
    showPipeline: true,
    showRegisters: true,
    showMemory: true,
    enableForwardingVisualization: true,    
    enableChangeVisualization: true,        // 禁用变化动画
    showRegisterTimingDetail: false,
  },
  debug: {
    showPCInput: true,              // 隐藏 PC 输入
    enableManualPC: true,           // 禁止手动设置 PC
    enableCycleSlider: true,        // 禁止使用 cycle 滑块
  },
};

// Initialize config from localStorage or use default
const CONFIG_STORAGE_KEY = 'mips-simulator-config-preset';
const getInitialConfig = (): AppConfig => {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const savedPreset = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (savedPreset === 'demo') {
      return { ...demoConfig };
    }
  }
  return { ...defaultConfig };
};

// 当前使用的配置（运行时可修改）
export const appConfig: AppConfig = getInitialConfig();

// 如果需要在运行时切换配置，可以导出一个函数
let currentConfig: AppConfig = appConfig;

export const getConfig = (): AppConfig => currentConfig;

export const setConfig = (config: AppConfig) => {
  currentConfig = config;
  Object.assign(appConfig, config);
};

export const setConfigPreset = (preset: 'default' | 'demo') => {
  const targetConfig = preset === 'demo' ? demoConfig : defaultConfig;
  currentConfig = { ...targetConfig };
  Object.assign(appConfig, targetConfig);
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem(CONFIG_STORAGE_KEY, preset);
  }
};
