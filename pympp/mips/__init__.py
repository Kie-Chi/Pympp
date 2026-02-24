"""
MIPS instruction set and assembler
"""

from .isa import Instruction, decode, INSTRUCTION_REGISTRY
from .set import *
from .assembler import assemble, Assembler, AssemblerError, _register_all_instructions, ASSEMBLER_REGISTRY

# Register all instructions for the assembler
_register_all_instructions()

# Manually register Nop (since it's not in INSTRUCTION_REGISTRY to avoid conflict with Sll)
from .set import Nop
if hasattr(Nop, '_asm_mnemonic') and Nop._asm_mnemonic:
    ASSEMBLER_REGISTRY[Nop._asm_mnemonic.lower()] = Nop

__all__ = [
    'Instruction',
    'decode',
    'INSTRUCTION_REGISTRY',
    'assemble',
    'Assembler',
    'AssemblerError',
]
