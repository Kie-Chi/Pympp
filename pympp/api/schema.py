from typing import List, Dict, Optional, Any
from pydantic import BaseModel
from datetime import datetime


# === Quiz API Schemas ===

class QuizStartRequest(BaseModel):
    total_questions: int


class QuizStartResponse(BaseModel):
    quiz_session_id: str
    started_at: datetime


class QuizAnswerRequest(BaseModel):
    quiz_session_id: str
    instruction_name: str
    question_index: int
    user_tuse_rs: Optional[int] = None  # null for '-', -99 for UNKNOWN
    user_tuse_rt: Optional[int] = None
    user_tnew: Optional[int] = None
    correct_tuse_rs: str
    correct_tuse_rt: str
    correct_tnew: str
    is_correct: bool


class QuizAnswerResponse(BaseModel):
    record_id: int
    success: bool


class QuizEndRequest(BaseModel):
    quiz_session_id: str
    correct_count: int


class QuizSessionSummary(BaseModel):
    quiz_session_id: str
    session_id: str  # Add user session_id
    total_questions: int           # Planned total questions
    actual_answered: int = 0        # Actually answered questions
    correct_count: int
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class QuizRecordItem(BaseModel):
    id: int
    instruction_name: str
    question_index: int
    user_tuse_rs: Optional[int]
    user_tuse_rt: Optional[int]
    user_tnew: Optional[int]
    correct_tuse_rs: str
    correct_tuse_rt: str
    correct_tnew: str
    is_correct: bool
    created_at: Optional[datetime] = None


class QuizHistoryResponse(BaseModel):
    sessions: List[QuizSessionSummary]
    records: List[QuizRecordItem]


class QuizStatsResponse(BaseModel):
    total_sessions: int
    total_questions: int
    correct_count: int
    accuracy_rate: float
    most_wrong_instructions: List[str]


# === Exercise API Schemas ===

class ExerciseStartRequest(BaseModel):
    total_questions: int
    part: int = 1  # Part 1: AT method, Part 2: Strategy matrix


class ExerciseStartResponse(BaseModel):
    exercise_session_id: str
    part: int
    started_at: datetime


class ExerciseAnswerRequest(BaseModel):
    exercise_session_id: str
    instruction_name: str = ""  # For Part 1
    question_index: int
    part: int = 1
    # Part 1 fields
    user_tuse_rs: Optional[int] = None
    user_tuse_rt: Optional[int] = None
    user_tnew: Optional[int] = None
    correct_tuse_rs: str = ""
    correct_tuse_rt: str = ""
    correct_tnew: str = ""
    # Part 2 fields (matrix)
    matrix_row: Optional[int] = None
    matrix_col: Optional[int] = None
    user_answer: str = ""
    correct_answer: str = ""
    is_correct: bool


class ExerciseAnswerResponse(BaseModel):
    record_id: int
    success: bool


class ExerciseSessionSummary(BaseModel):
    exercise_session_id: str
    session_id: str
    total_questions: int
    actual_answered: int = 0
    correct_count: int
    part: int
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class ExerciseRecordItem(BaseModel):
    id: int
    instruction_name: str
    question_index: int
    part: int
    user_tuse_rs: Optional[int]
    user_tuse_rt: Optional[int]
    user_tnew: Optional[int]
    correct_tuse_rs: str
    correct_tuse_rt: str
    correct_tnew: str
    matrix_row: Optional[int]
    matrix_col: Optional[int]
    user_answer: str
    correct_answer: str
    is_correct: bool
    created_at: Optional[datetime] = None


class ExerciseHistoryResponse(BaseModel):
    sessions: List[ExerciseSessionSummary]
    records: List[ExerciseRecordItem]


class ExerciseStatsResponse(BaseModel):
    total_sessions: int
    total_questions: int
    correct_count: int
    accuracy_rate: float
    most_wrong_instructions: List[str]


# === Simulator Schemas ===

class ChangeSchema(BaseModel):
    origin: str
    new: str
    reason: str

class PipelineStageSchema(BaseModel):
    pc: str
    instr: str
    render_str: str = ""  # Rendered instruction with annotations
    is_bubble: bool
    is_stall: bool = False
    is_stall_src: bool = False  # 是否是阻塞源
    # Register information
    rs: int = 0
    rt: int = 0
    rd: int = 0
    wreg: Optional[int] = None  # Write register
    rregs: List[int] = []  # Read registers list
    # Timing information
    tuse_rs: int = -1  # Remaining cycles until rs is needed
    tuse_rt: int = -1  # Remaining cycles until rt is needed
    tnew: int = -1  # Remaining cycles until result is ready

class RegisterSchema(BaseModel):
    name: str
    value: str

class ForwardingSchema(BaseModel):
    from_stage: str
    to_stage: str
    reg: int

class EventsSchema(BaseModel):
    registers_written: List[int]
    memory_written: List[str]
    forwarding: List[ForwardingSchema]
    register_changes: Optional[Dict[str, ChangeSchema]] = None
    memory_changes: Optional[Dict[str, ChangeSchema]] = None

class TimerSchema(BaseModel):
    ctrl: str
    preset: str
    count: str

class SnapshotSchema(BaseModel):
    outofbound: bool = False # if the cursor out of cycle bounds
    cycle: int
    pc: str
    pipeline: Dict[str, Optional[PipelineStageSchema]]
    registers: Dict[str, RegisterSchema]
    memory: Dict[str, str]
    timers: Optional[Dict[str, TimerSchema]] = None
    events: EventsSchema

class LoadResponse(BaseModel):
    success: bool
    message: str

class ResetResponse(BaseModel):
    success: bool
    message: str

class CycleInfo(BaseModel):
    cycle: int

class MemoryPageResponse(BaseModel):
    start_addr: str
    values: List[str] # List of hex values
