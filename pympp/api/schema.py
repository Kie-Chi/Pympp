from typing import List, Dict, Optional, Any
from pydantic import BaseModel

class PipelineStageSchema(BaseModel):
    pc: str
    instr: str
    is_bubble: bool
    is_stall: bool = False

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
