from venv import logger
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from ..cpu import CPU
from .assembler import assemble
from ..util.type import hex32
from ..base import Stage
from ..log import get_logger
from .schema import (
    LoadResponse, ResetResponse, CycleInfo, MemoryPageResponse,
    SnapshotSchema, PipelineStageSchema, RegisterSchema, 
    EventsSchema, ForwardingSchema, ChangeSchema
)
from datetime import datetime, timedelta
import time

app = FastAPI(title="MIPS Pipeline Simulator API v2.0")
logger = get_logger(__name__)

# Configure CORS for external access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://mobile.fl0wer.cn",
        "https://mobile.fl0wer.cn",
        "*"  # 允许所有来源，生产环境中可以限制具体域名
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register name mapping
REG_NAMES = [
    "$zero", "$at", "$v0", "$v1", "$a0", "$a1", "$a2", "$a3",
    "$t0", "$t1", "$t2", "$t3", "$t4", "$t5", "$t6", "$t7",
    "$s0", "$s1", "$s2", "$s3", "$s4", "$s5", "$s6", "$s7",
    "$t8", "$t9", "$k0", "$k1", "$gp", "$sp", "$fp", "$ra"
]

class Simulator:
    def __init__(self):
        self.cpu: Optional[CPU] = None
        self.source_map: Dict[str, int] = {}
        self.asm_source: str = ""
        self.display_cycle: int = 0
        self.last_access: float = time.time()

    def load(self, asm_source: str):
        self.asm_source = asm_source
        machine_codes, source_map = assemble(asm_source)
        self.cpu = CPU(machine_codes)
        self.source_map = source_map
        self.display_cycle = 0
        self.last_access = time.time()
        return True

    def is_finished(self) -> bool:
        if not self.cpu:
            return True

        idx = (self.cpu.pc - 0x3000) // 4
        pc_out_of_bounds = not (0 <= idx < len(self.cpu.imem))
        
        # Check pipeline empty
        pipeline_empty = True
        for s in self.cpu.slots.values():
            if s is not None:
                pipeline_empty = False
                break
        
        return pc_out_of_bounds and pipeline_empty

    def ensure_cpu(self):
        if not self.cpu:
            raise HTTPException(status_code=400, detail="Program not loaded")
    
    def touch(self):
        """Update last access time"""
        self.last_access = time.time()


# Session Manager
class SessionManager:
    def __init__(self, session_timeout_minutes: int = 60):
        self.sessions: Dict[str, Simulator] = {}
        self.session_timeout = session_timeout_minutes * 60  # Convert to seconds
        
    def get_session(self, session_id: str) -> Simulator:
        """Get or create a simulator for the given session ID"""
        if session_id not in self.sessions:
            logger.info(f"Creating new simulator session: {session_id}")
            self.sessions[session_id] = Simulator()
        else:
            self.sessions[session_id].touch()
        
        return self.sessions[session_id]
    
    def cleanup_expired_sessions(self):
        """Remove sessions that have been inactive for too long"""
        current_time = time.time()
        expired_sessions = [
            sid for sid, sim in self.sessions.items()
            if current_time - sim.last_access > self.session_timeout
        ]
        
        for sid in expired_sessions:
            logger.info(f"Cleaning up expired session: {sid}")
            del self.sessions[sid]
        
        return len(expired_sessions)
    
    def get_active_sessions_count(self) -> int:
        """Get the number of active sessions"""
        return len(self.sessions)


# Global session manager
session_manager = SessionManager(session_timeout_minutes=60)


# Dependency to get simulator instance for current session
def get_simulator(x_session_id: Optional[str] = Header(None, alias="X-Session-ID")) -> Simulator:
    if not x_session_id:
        raise HTTPException(status_code=400, detail="Session ID is required")
    
    # Periodically cleanup expired sessions (every 100 requests or so)
    import random
    if random.randint(1, 100) == 1:
        cleaned = session_manager.cleanup_expired_sessions()
        if cleaned > 0:
            logger.info(f"Cleaned up {cleaned} expired sessions")
    
    return session_manager.get_session(x_session_id)


class LoadRequest(BaseModel):
    asm_source: str

def _to_snapshot_schema(snap: Dict[str, Any], outofbound: bool = False) -> SnapshotSchema:
    pipeline_data = {}
    for stage_name, stage_info in snap["pipeline"].items():
        if stage_info:
            pipeline_data[stage_name] = PipelineStageSchema(
                pc=stage_info["pc"],
                instr=stage_info["instr"],
                render_str=stage_info.get("render_str", stage_info["instr"]),
                is_bubble=stage_info["is_bubble"],
                is_stall=stage_info["is_stall"],
                rs=stage_info.get("rs", 0),
                rt=stage_info.get("rt", 0),
                rd=stage_info.get("rd", 0),
                wreg=stage_info.get("wreg"),
                rregs=stage_info.get("rregs", []),
                tuse_rs=stage_info.get("tuse_rs", -1),
                tuse_rt=stage_info.get("tuse_rt", -1),
                tnew=stage_info.get("tnew", -1)
            )
        else:
            pipeline_data[stage_name] = None

    registers_data = {}
    for i, val in enumerate(snap["gpr"]):
        registers_data[str(i)] = RegisterSchema(
            name=REG_NAMES[i],
            value=val
        )

    memory_data = snap["memory"]
    behaviors = snap["behaviors"]
    regs_written = []
    mem_written = []
    forwarding = []
    
    register_changes = {}
    memory_changes = {}

    for b in behaviors:
        b_type = b.__class__.__name__ if not isinstance(b, dict) else b.get("type")
        
        if b_type == "RegWriteBehavior":
            reg = getattr(b, "reg", None)
            if reg is None and isinstance(b, dict): reg = b.get("reg")
            regs_written.append(reg)
            
            val = getattr(b, "val", None)
            if val is None and isinstance(b, dict): val = b.get("val")
            
            origin = getattr(b, "origin", 0)
            if origin is None and isinstance(b, dict): origin = b.get("origin", 0)
            
            reason = getattr(b, "reason", "")
            if reason is None and isinstance(b, dict): reason = b.get("reason", "")
            
            register_changes[str(reg)] = ChangeSchema(
                origin=hex32(origin),
                new=hex32(val),
                reason=reason
            )

        elif b_type == "MemWriteBehavior":
            addr = getattr(b, "addr", None)
            if addr is None and isinstance(b, dict): addr = b.get("addr")
            mem_written.append(hex32(addr))
            
            # Extract change info
            val = getattr(b, "val", None)
            if val is None and isinstance(b, dict): val = b.get("val")
            
            origin = getattr(b, "origin", 0)
            if origin is None and isinstance(b, dict): origin = b.get("origin", 0)
            
            reason = getattr(b, "reason", "")
            if reason is None and isinstance(b, dict): reason = b.get("reason", "")
            
            memory_changes[hex32(addr)] = ChangeSchema(
                origin=hex32(origin),
                new=hex32(val),
                reason=reason
            )

        elif b_type == "ForwardBehavior":
            from_stage = getattr(b, "from_stage", None)
            if from_stage is None and isinstance(b, dict): from_stage = b.get("from_stage")
            
            to_stage = getattr(b, "to_stage", None)
            if to_stage is None and isinstance(b, dict): to_stage = b.get("to_stage")
            
            reg = getattr(b, "reg", None)
            if reg is None and isinstance(b, dict): reg = b.get("reg")

            forwarding.append(ForwardingSchema(
                from_stage=from_stage,
                to_stage=to_stage,
                reg=reg
            ))

    events_data = EventsSchema(
        registers_written=regs_written,
        memory_written=mem_written,
        forwarding=forwarding,
        register_changes=register_changes,
        memory_changes=memory_changes
    )

    return SnapshotSchema(
        outofbound=outofbound,
        cycle=snap["cycle"],
        pc=snap["pc"],
        pipeline=pipeline_data,
        registers=registers_data,
        memory=memory_data,
        events=events_data
    )

# Health check and session info endpoints
@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "active_sessions": session_manager.get_active_sessions_count()
    }

@app.get("/sessions/info")
def session_info():
    """Get information about active sessions"""
    return {
        "active_sessions": session_manager.get_active_sessions_count(),
        "session_timeout_minutes": session_manager.session_timeout / 60
    }

@app.post("/load_program", response_model=LoadResponse)
def load_program(req: LoadRequest, manager: Simulator = Depends(get_simulator)):
    try:
        manager.load(req.asm_source)
        return LoadResponse(success=True, message="Program loaded and simulator reset.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/get_source_map")
def get_source_map(manager: Simulator = Depends(get_simulator)):
    manager.ensure_cpu()
    return manager.source_map

@app.post("/step_cycle", response_model=SnapshotSchema)
def step_cycle(manager: Simulator = Depends(get_simulator)):
    manager.ensure_cpu()
    
    if manager.display_cycle < manager.cpu.cycle:
        if manager.display_cycle + 1 < len(manager.cpu.history):
            manager.display_cycle += 1
            return _to_snapshot_schema(manager.cpu.history[manager.display_cycle])    
    # Else need to run simulation
    if manager.is_finished():
         if manager.cpu.history:
             manager.display_cycle = manager.cpu.cycle
             return _to_snapshot_schema(manager.cpu.history[-1])
    
    manager.cpu.step()
    manager.display_cycle = manager.cpu.cycle
    
    # Check bounds again just to be safe
    if manager.display_cycle >= len(manager.cpu.history):
        manager.display_cycle = len(manager.cpu.history) - 1
        
    return _to_snapshot_schema(manager.cpu.history[manager.display_cycle])

@app.post("/step_back", response_model=SnapshotSchema)
def step_back(manager: Simulator = Depends(get_simulator)):
    manager.ensure_cpu()
    if manager.display_cycle > 0:
        manager.display_cycle -= 1
    
    return _to_snapshot_schema(manager.cpu.history[manager.display_cycle])

@app.post("/continue", response_model=SnapshotSchema)
def continue_exec(manager: Simulator = Depends(get_simulator)):
    manager.ensure_cpu()
    # Jump to head
    manager.display_cycle = manager.cpu.cycle
    if manager.display_cycle >= len(manager.cpu.history):
        manager.display_cycle = len(manager.cpu.history) - 1
    return _to_snapshot_schema(manager.cpu.history[manager.display_cycle])

@app.post("/run_until_end", response_model=List[SnapshotSchema])
def run_until_end(max_cycles: int = 1000, manager: Simulator = Depends(get_simulator)):
    manager.ensure_cpu()
    
    # Run loop
    for _ in range(max_cycles):
        idx = (manager.cpu.pc - 0x3000) // 4
        pc_out_of_bounds = not (0 <= idx < len(manager.cpu.imem))
        
        pipeline_empty = True
        for s in manager.cpu.slots.values():
            if s is not None:
                pipeline_empty = False
                break
        
        if pc_out_of_bounds and pipeline_empty:
            break
            
        manager.cpu.step()
        
    manager.display_cycle = manager.cpu.cycle
    return [_to_snapshot_schema(snap) for snap in manager.cpu.history]

@app.post("/reset", response_model=ResetResponse)
def reset(manager: Simulator = Depends(get_simulator)):
    if manager.asm_source:
        manager.load(manager.asm_source)
    else:
        raise HTTPException(status_code=400, detail="No program to reset")
    return ResetResponse(success=True, message="Simulator reset with the current program.")

@app.get("/get_snapshot/{cycle}", response_model=SnapshotSchema)
def get_snapshot(cycle: int, manager: Simulator = Depends(get_simulator)):
    manager.ensure_cpu()
    steps_taken = 0
    MAX_STEPS_PER_REQUEST = 2000
    
    while cycle >= len(manager.cpu.history):
        if manager.is_finished():
            logger.info(f"Simulation finished after {manager.cpu.cycle} cycles")
            break
        
        if steps_taken > MAX_STEPS_PER_REQUEST:
             logger.warning(f"Stopped after {steps_taken} steps to prevent infinite loop")
             break
             
        manager.cpu.step()
        steps_taken += 1
        
    # Check if we have the requested cycle
    if 0 <= cycle < len(manager.cpu.history):
        manager.display_cycle = cycle
        return _to_snapshot_schema(manager.cpu.history[cycle])
    
    # If simulation finished or stopped before reaching cycle
    if manager.cpu.history:
        if manager.is_finished():
            manager.display_cycle = manager.cpu.history[-1]["cycle"]
            return _to_snapshot_schema(manager.cpu.history[-1], outofbound=True)
        else:
            manager.display_cycle = manager.cpu.history[-1]["cycle"]
            return _to_snapshot_schema(manager.cpu.history[-1])

    raise HTTPException(status_code=404, detail="Simulation finished")

@app.get("/get_current_cycle", response_model=CycleInfo)
def get_current_cycle(manager: Simulator = Depends(get_simulator)):
    manager.ensure_cpu()
    return CycleInfo(cycle=manager.cpu.cycle)

@app.get("/find_cycle_by_pc/{pc}", response_model=Dict[str, Optional[int]])
def find_cycle_by_pc(pc: str, manager: Simulator = Depends(get_simulator)):
    """
    Finds the first cycle where the instruction at the given PC entered the IF stage.
    """
    manager.ensure_cpu()
    target_pc_val = int(pc, 16)
    for i, snap in enumerate(manager.cpu.history):
        if_stage = snap["pipeline"].get("IF")
        if if_stage and if_stage["pc"] == target_pc_val:
            return {"cycle": snap["cycle"]}
    return {"cycle": None}

@app.get("/get_memory_page", response_model=MemoryPageResponse)
def get_memory_page(start_addr: str, lines: int = 16, cycle: Optional[int] = None, manager: Simulator = Depends(get_simulator)):
    """
    Returns a list of memory values starting from start_addr.
    If cycle is provided, returns memory state at that cycle.
    Otherwise returns current CPU memory state.
    """
    manager.ensure_cpu()
    try:
        start_val = int(start_addr, 16)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid address format")

    if start_val < 0:
        raise HTTPException(status_code=400, detail="Start address must be non-negative")
    
    mem_source = None
    if cycle is not None:
        if 0 <= cycle < len(manager.cpu.history):
            mem_source = manager.cpu.history[cycle]["memory"]
        else:
            pass
    
    values = []
    
    for i in range(lines):
        addr = start_val + (i * 4)
        
        if mem_source is not None:
            addr_hex = hex32(addr)
            val_hex = mem_source.get(addr_hex, "00000000")
            values.append(val_hex)
        else:
            val_word = manager.cpu.dmem.read(addr)
            values.append(hex32(val_word.value))
        
    return MemoryPageResponse(
        start_addr=hex32(start_val),
        values=values
    )
