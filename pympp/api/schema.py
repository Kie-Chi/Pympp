from typing import List, Dict, Optional, Any
from pydantic import BaseModel

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

class SnapshotSchema(BaseModel):
    outofbound: bool = False # if the cursor out of cycle bounds
    cycle: int
    pc: str
    pipeline: Dict[str, Optional[PipelineStageSchema]]
    registers: Dict[str, RegisterSchema]
    memory: Dict[str, str]
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
