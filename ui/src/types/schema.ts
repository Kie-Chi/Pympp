export interface PipelineStage {
  pc: string;
  instr: string;
  is_bubble: boolean;
  is_stall: boolean;
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
