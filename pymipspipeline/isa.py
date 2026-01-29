from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from struct import pack
from tkinter import Pack
from typing import Optional, Dict, Any, Type
from pydantic import BaseModel
from .pipeline import PIPELINE, Pool, Stage

INSTRUCTION_REGISTRY: Dict[tuple, Type['Instruction']] = {}

# Help registry
def instr(
    opcode: int, 
    funct: Optional[int] = None,
    tuse_rs: Stage = Stage.BEGIN, # default not use register rs
    tuse_rt: Stage = Stage.BEGIN, # default not use register rt
    tnew: Stage = Stage.END # default not write register
):
    def wrapper(cls):
        key = (opcode, funct) if opcode == 0 else (opcode, None)
        INSTRUCTION_REGISTRY[key] = cls
        cls._meta_tuse_rs = tuse_rs
        cls._meta_tuse_rt = tuse_rt
        cls._meta_tnew = tnew
        return cls
    return wrapper

def decode(machine_code: int, pc: int) -> 'Instruction':
    opcode = (machine_code >> 26) & 0x3F
    funct = machine_code & 0x3F
    key = (opcode, funct) if opcode == 0 else (opcode, None)
    instr_cls = INSTRUCTION_REGISTRY.get(key)
    
    if not instr_cls:
        instr_cls = INSTRUCTION_REGISTRY.get((0, 0)) 
        if not instr_cls:
            raise ValueError(f"Unknown instruction: {hex(machine_code)}")
            
    return instr_cls(machine_code)

@dataclass
class Change:
    origin: int
    new: int
    reason: str

PENDING = Change(origin=-1, new=-1, reason="pending")

@dataclass
class Packet:
    """
    Packet describe the behavior the instruction do for pipeline
    """
    pool: Pool

    pc: int
    npc: int = None
    stage: Stage = Stage.IF
    
    instr: Type['Instruction']
    
    alu: Dict[int, Change] = field(default_factory=dict)
    mem: Dict[int, Change] = field(default_factory=dict)

    optional: Dict[str, Any] = field(default_factory=dict) # extra data for Packet

    def __post_init__(self):
        if self.npc is None:
            self.npc = self.pc + 4

    def advance(self):
        self.stage = PIPELINE[self.stage]

class Instruction(ABC):
    def __init__(
        self, 
        machine_code: int,
        ):
        self.raw = machine_code
        self._tuse_rs = getattr(self, '_meta_tuse_rs', Stage.BEGIN)
        self._tuse_rt = getattr(self, '_meta_tuse_rt', Stage.BEGIN)
        self._tnew = getattr(self, '_meta_tnew', 0)

    @property
    def tuse_rs(self) -> Stage: return self._tuse_rs

    @property
    def tuse_rt(self) -> Stage: return self._tuse_rt

    @property
    def tnew(self) -> Stage: return self._tnew

    def remaining(self, stage: Stage) -> int:
        _r = self._tnew - stage
        return _r if _r > 0 else 0
    
    @property
    def opcode(self) -> int: return (self.raw >> 26) & 0x3F

    @property
    def rs(self) -> int: return (self.raw >> 21) & 0x1F

    @property
    def rt(self) -> int: return (self.raw >> 16) & 0x1F

    @property
    def rd(self) -> int: return (self.raw >> 11) & 0x1F

    @property
    def funct(self) -> int: return self.raw & 0x3F
    
    @property
    def shamt(self) -> int: return (self.raw >> 6) & 0x1F

    @property
    def imm16(self) -> int: return self.raw & 0xFFFF
    
    @property
    def imm16_signed(self) -> int:
        val = self.raw & 0xFFFF
        return val - 65536 if val & 0x8000 else val

    @property
    def imm26(self) -> int: return self.raw & 0x3FFFFFF

    @abstractmethod
    def get_wreg(self) -> Optional[int]: pass

    @abstractmethod
    def disassemble(self) -> str: pass

    # Must be implemented  
    @abstractmethod
    def execute(self, packet: Packet):
        pass


@instr(opcode=0, funct=0b100000, tuse_rs=Stage.EX, tuse_rt=Stage.EX, tnew=Stage.MEM)
class Add(Instruction):
    def get_wreg(self) -> Optional[int]:
        return self.rd
    
    def disassemble(self) -> str:
        return f"add ${self.rd}, ${self.rs}, ${self.rt}"

    def execute(self, packet: Packet):
        if packet.stage != Stage.EX:
            return
        rs_val = packet.pool.request(self.rs, packet.stage)
        rt_val = packet.pool.request(self.rt, packet.stage)
        result = rs_val + rt_val
        packet.alu[self.rd] = Change(origin=packet.pool.request(self.rd, packet.stage), new=result, reason="add")

# 示例：Lw 指令
@instr(opcode=0b100011, tuse_rs=Stage.EX, tnew=Stage.WB)
class Lw(Instruction):
    def get_wreg(self) -> Optional[int]:
        return self.rt

    def disassemble(self) -> str:
        return f"lw ${self.rt}, {self.imm16_signed}(${self.rs})"

    def execute(self, packet: Packet):
        if packet.stage == Stage.EX:
            rs_val = packet.pool.request(self.rs, packet.stage)
            addr = rs_val + self.imm16_signed
            packet.optional["mem_addr"] = addr 
        
        elif packet.stage == Stage.MEM:
            mem_val = packet.cpu.mem.read(packet.optional["mem_addr"])
            packet.alu[self.rt] = Change(origin=packet.pool.request(self.rt, packet.stage), new=mem_val, reason="lw")

@instr(opcode=0b000100, tuse_rs=Stage.ID, tuse_rt=Stage.ID)
class Beq(Instruction):
    def get_wreg(self) -> Optional[int]:
        return None

    def disassemble(self) -> str:
        return f"beq ${self.rs}, ${self.rt}, {self.imm16_signed}"

    def execute(self, packet: Packet):
        if packet.stage != Stage.ID:
            return
        rs_val = packet.pool.request(self.rs, packet.stage)
        rt_val = packet.pool.request(self.rt, packet.stage)
        if rs_val == rt_val:
            packet.npc = packet.pc + 4 + (self.imm16_signed << 2)

