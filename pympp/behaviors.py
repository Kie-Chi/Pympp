from dataclasses import dataclass, asdict, field
from enum import Enum
from typing import Optional, Dict, Any, List

from pydantic.type_adapter import P

from .util.type import hex32
from .base import Stage, PIPELINE

@dataclass
class Behavior:
    """base behavior"""
    cycle: int
    pc: int

    def to_dict(self):
        d = asdict(self)
        d["type"] = self.__class__.__name__
        d["pc"] = hex32(self.pc)
        return d

    def __str__(self):
        return f"Cycle={self.cycle}, PC=0x{hex32(self.pc)}"

    def serialize(self, prefix: str = '@') -> str:
        return f"{prefix}{hex32(self.pc)}: {self}"


@dataclass
class StageStatus(Behavior):
    """pipeline status"""
    stage: str
    instr_name: str
    disasm: str
    t_new: int
    is_bubble: bool = False

    def __str__(self):
        if self.is_bubble:
            return f"BUBBLE in {self.stage}"
        return f"{self.stage}: [{self.disasm}] (t_new={self.t_new})"


# @dataclass
# class RegReadBehavior(Behavior):
#     """register read"""
#     reg: int
#     val: int
#     stage: str

@dataclass
class RegWriteBehavior(Behavior):
    """register write back"""
    reg: int
    val: int

    def __str__(self):
        # $ 2 <= 000000ff
        return f"${self.reg:2d} <= {hex32(self.val)}"

@dataclass
class ForwardBehavior(Behavior):
    """forward behavior"""
    reg: int
    val: int
    from_stage: str
    to_stage: str

    def __str__(self):
        # ID <--($ 5: 0000000a)-- WB
        return f"{self.to_stage} <--(${self.reg:2d}: {hex32(self.val)})-- {self.from_stage}"

# @dataclass
# class MemReadBehavior(Behavior):
#     """memory read"""
#     addr: int
#     val: int

@dataclass
class MemWriteBehavior(Behavior):
    """memory write back"""
    addr: int
    val: int

    def __str__(self):
        # *00001000 <= 000000ff
        return f"*{self.addr:08x} <= {hex32(self.val)}"

@dataclass
class StallBehavior(Behavior):
    """stall behavior"""
    stage: str
    reason: str

    def __str__(self):
        stalled_stage = Stage[self.stage]
        next_stage_name = PIPELINE[stalled_stage].name if stalled_stage in PIPELINE and PIPELINE[stalled_stage] != Stage.END else "???"
        return f"{self.stage} ---x--> {next_stage_name}"

@dataclass
class BranchBehavior(Behavior):
    """branch behavior"""
    target_pc: int
    taken: bool

    def __str__(self):
        if self.taken:
            # PC <= 00003010
            return f"PC <= {hex32(self.target_pc)}"
        else:
            return f"Branch to {hex32(self.target_pc)} not taken"

