from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, Any, Optional
from .base import Stage

@dataclass
class Behavior:
    pc: int
    stage: Stage
    message: str
    is_right: bool = True

    def serialize(self, prefix: Optional[str] = None) -> str:
        prefix_char = prefix if prefix is not None else ('@' if self.is_right else '!')
        return f"{prefix_char}{self.pc:08x}: {self.message}"

@dataclass
class RegisterWriteBehavior(Behavior):
    reg: int
    value: int

    def __post_init__(self):
        self.message = f"${self.reg:2d} <= {self.value:08x}"

@dataclass
class MemoryWriteBehavior(Behavior):
    address: int
    value: int

    def __post_init__(self):
        self.message = f"*{self.address:08x} <= {self.value:08x}"

@dataclass
class ModifyPCBehavior(Behavior):
    target_pc: int

    def __post_init__(self):
        self.message = f"PC <= {self.target_pc:08x}"

@dataclass
class ForwardBehavior(Behavior):
    reg: int
    value: int
    source_stage: Stage
    target_stage: Stage

    def __post_init__(self):
        self.message = f"{self.target_stage} <--(${self.reg:2d}: {self.value:08x})-- {self.source_stage}"

@dataclass
class StallBehavior(Behavior):
    source_stage: Stage
    reason_reg: Optional[int] = None

    def __post_init__(self):
        if self.reason_reg is not None:
            self.message = f"{self.source_stage} ---x--> {self.source_stage.value + 1} (reg ${self.reason_reg})"
        else:
            self.message = f"{self.source_stage} ---x--> {self.source_stage.value + 1}"