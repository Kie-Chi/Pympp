from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from struct import pack
from typing import Optional, Dict, Any, Type, List
from pydantic import BaseModel

from ..util.type import Word, to_word
from ..behaviors import Behavior
from ..pipeline import PIPELINE, Pool, Stage

INSTRUCTION_REGISTRY: Dict[tuple, Type['Instruction']] = {}

# Help registry
def instr(
    opcode: int, 
    funct: Optional[int] = None,
    tuse_rs: Stage = Stage.BEGIN, # default not use register rs
    tuse_rt: Stage = Stage.BEGIN, # default not use register rt
    tnew: Stage = Stage.END, # default not write register
    asm_type: str = None,  # Instruction type: R/I/B/J
    asm_template: str = None,  # Assembly template e.g., "add $rd, $rs, $rt"
    asm_encoding: str = None,  # Binary encoding pattern
    asm_mnemonic: str = None  # Instruction mnemonic for assembler
):
    def wrapper(cls):
        key = (opcode, funct) if opcode == 0 else (opcode, None)
        INSTRUCTION_REGISTRY[key] = cls
        cls._meta_tuse_rs = tuse_rs
        cls._meta_tuse_rt = tuse_rt
        cls._meta_tnew = tnew
        
        # Add assembler metadata
        cls._asm_type = asm_type
        cls._asm_template = asm_template
        cls._asm_encoding = asm_encoding
        cls._asm_mnemonic = asm_mnemonic or cls.__name__.lower()
        
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
    origin: Word
    new: Word
    reason: str

PENDING = Change(origin=to_word(-1), new=to_word(-1), reason="pending")

@dataclass
class Packet:
    """
    Packet describe the behavior the instruction do for pipeline
    """
    pool: Pool

    pc: int
    instr: Type['Instruction']
    npc: int = None
    stage: Stage = Stage.IF
    
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

    def tuse_rs_remaining(self, stage: Stage) -> int:
        _r = self._tuse_rs - stage
        return max(0, _r)
    
    def tuse_rt_remaining(self, stage: Stage) -> int:
        _r = self._tuse_rt - stage
        return max(0, _r)

    def tnew_remaining(self, stage: Stage) -> int:
        _r = self._tnew - stage
        return max(0, _r)
    
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
    
    def get_rregs(self) -> List[int]:
        """Return list of read registers (excluding $0)"""
        regs = []
        if self._tuse_rs != Stage.BEGIN and self.rs != 0:
            regs.append(self.rs)
        if self._tuse_rt != Stage.BEGIN and self.rt != 0:
            regs.append(self.rt)
        return regs

    @abstractmethod
    def disassemble(self, pc: int = None) -> str: pass
    
    def render_str(self, pc: int = None) -> str:
        """
        Return disassembled string with register annotations.
        Format: instruction with markers like $t0:w (write) or $t1:r (read)
        """
        return self.disassemble(pc)

    # Must be implemented  
    @abstractmethod
    def execute(self, packet: Packet):
        pass