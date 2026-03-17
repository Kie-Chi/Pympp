import axios from 'axios';
import { LoadResponse, ResetResponse, Snapshot, CycleInfo, MemoryPageResponse } from '../types/schema';

// Generate or retrieve session ID
const getSessionId = () => {
  let sessionId = localStorage.getItem('mips_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('mips_session_id', sessionId);
  }
  return sessionId;
};

// 根据环境配置 API 地址
const getApiBaseUrl = () => {
  // 生产环境优先使用环境变量；默认走同源 /api（由反向代理转发到后端）
  if (import.meta.env.PROD) {
    if (import.meta.env.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL;
    }
    return '/api';
  }
  // 开发环境使用代理
  return '/api';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
});

// Add interceptor to include Session ID in all requests
api.interceptors.request.use((config) => {
  config.headers['X-Session-ID'] = getSessionId();
  return config;
});

export const loadProgram = async (asmSource: string): Promise<LoadResponse> => {
  const res = await api.post<LoadResponse>('/load_program', { asm_source: asmSource });
  return res.data;
};

export const stepCycle = async (): Promise<Snapshot> => {
  const res = await api.post<Snapshot>('/step_cycle');
  return res.data;
};

export const stepBack = async (): Promise<Snapshot> => {
  const res = await api.post<Snapshot>('/step_back');
  return res.data;
};

export const continueExec = async (): Promise<Snapshot> => {
  const res = await api.post<Snapshot>('/continue');
  return res.data;
};

export const runUntilEnd = async (maxCycles: number = 1000): Promise<Snapshot[]> => {
  const res = await api.post<Snapshot[]>('/run_until_end', null, { params: { max_cycles: maxCycles } });
  return res.data;
};

export const resetSimulator = async (): Promise<ResetResponse> => {
  const res = await api.post<ResetResponse>('/reset');
  return res.data;
};

export const getSnapshot = async (cycle: number): Promise<Snapshot> => {
  const res = await api.get<Snapshot>(`/get_snapshot/${cycle}`);
  return res.data;
};

export const getCurrentCycle = async (): Promise<CycleInfo> => {
  const res = await api.get<CycleInfo>('/get_current_cycle');
  return res.data;
};

export const getSourceMap = async (): Promise<Record<string, number>> => {
  const res = await api.get<Record<string, number>>('/get_source_map');
  return res.data;
};

export const findCycleByPc = async (pc: string): Promise<{ cycle: number | null }> => {
  const res = await api.get<{ cycle: number | null }>(`/find_cycle_by_pc/${pc}`);
  return res.data;
};

export const getMemoryPage = async (startAddr: string, lines: number = 16, cycle?: number): Promise<MemoryPageResponse> => {
  const params: any = { start_addr: startAddr, lines };
  if (cycle !== undefined) {
      params.cycle = cycle;
  }
  const res = await api.get<MemoryPageResponse>('/get_memory_page', { params });
  return res.data;
};
