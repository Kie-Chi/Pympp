export interface PipelineStage {
  pc: string;
  instr: string;
  render_str?: string;  // Rendered instruction with annotations
  is_bubble: boolean;
  is_stall: boolean;
  is_stall_src?: boolean;  // Is Stall Src Stage
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

// === Quiz API Types ===

export interface QuizStartRequest {
  total_questions: number;
}

export interface QuizStartResponse {
  quiz_session_id: string;
  started_at: string;
}

export interface QuizAnswerRequest {
  quiz_session_id: string;
  instruction_name: string;
  question_index: number;
  user_tuse_rs: number | null;  // null for '-', -99 for UNKNOWN
  user_tuse_rt: number | null;
  user_tnew: number | null;
  correct_tuse_rs: string;
  correct_tuse_rt: string;
  correct_tnew: string;
  is_correct: boolean;
}

export interface QuizAnswerResponse {
  record_id: number;
  success: boolean;
}

export interface QuizEndRequest {
  quiz_session_id: string;
  correct_count: number;
}

export interface QuizSessionSummary {
  quiz_session_id: string;
  total_questions: number;
  correct_count: number;
  started_at: string | null;
  ended_at: string | null;
}

export interface QuizRecordItem {
  id: number;
  instruction_name: string;
  question_index: number;
  user_tuse_rs: number | null;
  user_tuse_rt: number | null;
  user_tnew: number | null;
  correct_tuse_rs: string;
  correct_tuse_rt: string;
  correct_tnew: string;
  is_correct: boolean;
  created_at: string | null;
}

export interface QuizHistoryResponse {
  sessions: QuizSessionSummary[];
  records: QuizRecordItem[];
}

export interface QuizStatsResponse {
  total_sessions: number;
  total_questions: number;
  correct_count: number;
  accuracy_rate: number;
  most_wrong_instructions: string[];
}
