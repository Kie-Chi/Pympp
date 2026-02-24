export interface PipelineStage {
  pc: string;
  instr: string;
  render_str?: string;  // Rendered instruction with annotations
  is_bubble: boolean;
  is_stall: boolean;
  // Register information
  rs?: number;
  rt?: number;
  rd?: number;
  wreg?: number | null;  // Write register
  rregs?: number[];  // Read registers list
  // Timing information
  tuse_rs?: number;  // Remaining cycles until rs is needed
  tuse_rt?: number;  // Remaining cycles until rt is needed
  tnew?: number;  // Remaining cycles until result is ready
}

export interface Register {
  name: string;
  value: string;
}

export interface Change {
  origin: string;
  new: string;
  reason: string;
}

export interface RegisterWithChange extends Register {
  change?: Change;
}

export interface Forwarding {
  from_stage: string;
  to_stage: string;
  reg: number;
}

export interface Events {
  registers_written: number[];
  memory_written: string[];
  forwarding: Forwarding[];
  register_changes?: Record<string, Change>;
  memory_changes?: Record<string, Change>;
}

export interface Snapshot {
  outofbound?: boolean;
  cycle: number;
  pc: string;
  pipeline: {
    IF: PipelineStage | null;
    ID: PipelineStage | null;
    EX: PipelineStage | null;
    MEM: PipelineStage | null;
    WB: PipelineStage | null;
  };
  registers: Record<string, Register>;
  memory: Record<string, string>;
  events: Events;
}

export interface LoadResponse {
  success: boolean;
  message: string;
}

export interface ResetResponse {
  success: boolean;
  message: string;
}

export interface CycleInfo {
  cycle: number;
}

export interface MemoryPageResponse {
  start_addr: string;
  values: string[];
}
