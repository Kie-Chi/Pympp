
from functools import total_ordering
from enum import Enum
from .util.type import Word, Half, Byte

@total_ordering
class Stage(Enum):
    BEGIN = 0 # means register unused, for tuse 
    IF = 1
    ID = 2
    EX = 3
    MEM = 4
    WB = 5
    END = 6 # means register unwritten, for tnew

    def __le__(self, other):
        return self.value <= other.value
    
    def __eq__(self, other):
        return self.value == other.value

    def __hash__(self):
        return hash(self.value)

    def __sub__(self, other):
        return self.value - other.value

PIPELINE = {
    Stage.BEGIN: Stage.IF,
    Stage.IF: Stage.ID,
    Stage.ID: Stage.EX,
    Stage.EX: Stage.MEM,
    Stage.MEM: Stage.WB,
    Stage.WB: Stage.END,
}

class StallException(Exception):
    def __init__(self, reason: str):
        self.reason = reason