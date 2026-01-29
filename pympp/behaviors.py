from dataclasses import dataclass, asdict, field
from enum import Enum
from typing import Optional, Dict, Any, List
from .base import Stage

@dataclass
class Behavior:
    """base behavior"""
    cycle: int
    pc: int

    def to_dict(self):
        d = asdict(self)
        d["type"] = self.__class__.__name__
        return d


@dataclass
class StageStatus(Behavior):
    """pipeline status"""
    stage: str
    instr_name: str
    disasm: str
    t_new: int
    is_bubble: bool = False


@dataclass
class RegReadBehavior(Behavior):
    """register read"""
    reg: int
    val: int
    stage: str

@dataclass
class RegWriteBehavior(Behavior):
    """register write back"""
    reg: int
    val: int

@dataclass
class ForwardBehavior(Behavior):
    """forward behavior"""
    reg: int
    val: int
    from_stage: str
    to_stage: str

@dataclass
class MemReadBehavior(Behavior):
    """memory read"""
    addr: int
    val: int

@dataclass
class MemWriteBehavior(Behavior):
    """memory write back"""
    addr: int
    val: int

@dataclass
class StallBehavior(Behavior):
    """stall behavior"""
    stage: str
    reason: str

@dataclass
class BranchBehavior(Behavior):
    """branch behavior"""
    target_pc: int
    taken: bool

