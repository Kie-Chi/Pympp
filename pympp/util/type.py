from typing import Union
from functools import total_ordering

MASK = 0xFFFFFFFF
INT32_MAX = 0x7FFFFFFF

@total_ordering
class Word:
    __slots__ = ('_val',)

    def __init__(self, val):
        if isinstance(val, Word):
            self._val = val._val
        else:
            self._val = int(val) & MASK

    @property
    def value(self) -> int:
        return self._val

    @property
    def signed(self) -> int:
        val = self._val
        return val - 0x100000000 if val > INT32_MAX else val

    def __add__(self, other):
        return Word(self._val + int(other))

    def __sub__(self, other):
        return Word(self._val - int(other))

    def __mul__(self, other):
        return Word(self._val * int(other))
    
    def __floordiv__(self, other):
        return Word(self._val // int(other))

    def __and__(self, other):
        return Word(self._val & int(other))

    def __or__(self, other):
        return Word(self._val | int(other))

    def __xor__(self, other):
        return Word(self._val ^ int(other))

    def __invert__(self):
        return Word(~self._val)

    def __lshift__(self, other):
        shift = int(other) & 0x1F # MIPS shift amount is 5 bits
        return Word(self._val << shift)

    def __rshift__(self, other):
        shift = int(other) & 0x1F
        return Word(self._val >> shift)

    def sra(self, other):
        shift = int(other) & 0x1F
        return Word(self.signed >> shift)

    def __eq__(self, other):
        return self._val == (int(other) & MASK)

    def __lt__(self, other):
        return self._val < (int(other) & MASK)

    def __int__(self):
        return self._val

    def __index__(self):
        return self._val

    def __hash__(self):
        return hash(self._val)

    def __repr__(self):
        return f"0x{self._val:08x}"
    
    def __str__(self):
        return f"{self._val:08x}"
    
    def __format__(self, format_spec):
        return format(self._val, format_spec)

def to_word(val: int) -> Word:
    return Word(val)

def hex32(val: int) -> str:
    return f"{int(val) & MASK:08x}"

Half = int
Byte = int

def to_half(val: int) -> Half:
    return val & 0xFFFF

def to_byte(val: int) -> Byte:
    return val & 0xFF