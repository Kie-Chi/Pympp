from struct import pack
from typing import Optional
from .isa import instr, Instruction, Packet, Change
from ..base import Stage
from ..util.type import to_word, hex32

# [
#   add
#   lw
#   beq
#   nop
#   sw
#   sub
#   jal
#   jr
#   lui
#   ori
# ]

@instr(
    opcode=0, 
    funct=0b100000, 
    tuse_rs=Stage.EX, 
    tuse_rt=Stage.EX, 
    tnew=Stage.MEM,
    asm_type='R', 
    asm_template='$rd, $rs, $rt',
    asm_encoding='000000 sssss ttttt ddddd 00000 100000'
)
class Add(Instruction):
    def get_wreg(self) -> Optional[int]:
        return self.rd
    
    def disassemble(self, pc: int = None) -> str:
        return f"add ${self.rd}, ${self.rs}, ${self.rt}"

    def render_str(self, pc: int = None):
        return f"add ${self.rd}|w, ${self.rs}|r, ${self.rt}|r"

    def execute(self, packet: Packet):
        if packet.stage != Stage.EX:
            return
        rs_val = packet.pool.read_reg(self.rs, packet.stage)
        rt_val = packet.pool.read_reg(self.rt, packet.stage)
        packet.pool.write_reg(packet, self.rd, rs_val + rt_val, "add")

@instr(
    opcode=0, 
    funct=0b100010, 
    tuse_rs=Stage.EX, 
    tuse_rt=Stage.EX, 
    tnew=Stage.MEM,
    asm_type='R', 
    asm_template='$rd, $rs, $rt',
    asm_encoding='000000 sssss ttttt ddddd 00000 100010'
)
class Sub(Instruction):
    def get_wreg(self) -> Optional[int]:
        return self.rd
    
    def disassemble(self, pc: int = None) -> str:
        return f"sub ${self.rd}, ${self.rs}, ${self.rt}"
    
    def render_str(self, pc: int = None):
        return f"sub ${self.rd}|w, ${self.rs}|r, ${self.rt}|r"

    def execute(self, packet: Packet):
        if packet.stage != Stage.EX:
            return
        rs_val = packet.pool.read_reg(self.rs, packet.stage)
        rt_val = packet.pool.read_reg(self.rt, packet.stage)
        packet.pool.write_reg(packet, self.rd, rs_val - rt_val, "sub")

@instr(
    opcode=0b001111, 
    tnew=Stage.MEM,
    asm_type='I', 
    asm_template='$rt, imm',
    asm_encoding='001111 00000 ttttt iiiiiiiiiiiiiiii')
class Lui(Instruction):
    def get_wreg(self) -> Optional[int]:
        return self.rt

    def disassemble(self, pc: int = None) -> str:
        return f"lui ${self.rt}, {hex(self.imm16)}"

    def render_str(self, pc: int = None):
        return f"lui ${self.rt}|w, {hex(self.imm16)}"

    def execute(self, packet: Packet):
        if packet.stage != Stage.EX:
            return
        result = self.imm16 << 16
        packet.pool.write_reg(packet, self.rt, result, "lui")

@instr(
    opcode=0b001101,
    tuse_rs=Stage.EX, 
    tnew=Stage.MEM,
    asm_type='I', 
    asm_template='$rt, $rs, imm',
    asm_encoding='001101 sssss ttttt iiiiiiiiiiiiiiii'
)
class Ori(Instruction):
    def get_wreg(self) -> Optional[int]:
        return self.rt
    
    def disassemble(self, pc: int = None) -> str:
        return f"ori ${self.rt}, ${self.rs}, {hex(self.imm16)}"
    
    def render_str(self, pc: int = None):
        return f"ori ${self.rt}|w, ${self.rs}|r, {hex(self.imm16)}"

    def execute(self, packet: Packet):
        if packet.stage != Stage.EX:
            return
        rs_val = packet.pool.read_reg(self.rs, packet.stage)
        result = rs_val | self.imm16
        packet.pool.write_reg(packet, self.rt, result, "ori")


@instr(
    opcode=0b100011, 
    tuse_rs=Stage.EX, 
    tnew=Stage.WB,
    asm_type='I', 
    asm_template='$rt, imm($rs)',
    asm_encoding='100011 sssss ttttt iiiiiiiiiiiiiiii'
)
class Lw(Instruction):
    def get_wreg(self) -> Optional[int]:
        return self.rt

    def disassemble(self, pc: int = None) -> str:
        return f"lw ${self.rt}, {self.imm16_signed}(${self.rs})"

    def render_str(self, pc: int = None):
        return f"lw ${self.rt}|w, {self.imm16_signed}(${self.rs}|r)"

    def execute(self, packet: Packet):
        if packet.stage == Stage.EX:
            rs_val = packet.pool.read_reg(self.rs, packet.stage)
            addr = rs_val + self.imm16_signed
            packet.optional["mem_addr"] = addr 
        
        elif packet.stage == Stage.MEM:
            mem_val = packet.pool.read_mem(packet.optional["mem_addr"].value)
            packet.pool.write_reg(packet, self.rt, mem_val, "lw")

@instr(
    opcode=0b101011, 
    tuse_rs=Stage.EX, 
    tuse_rt=Stage.MEM,
    asm_type='I', 
    asm_template='$rt, imm($rs)',
    asm_encoding='101011 sssss ttttt iiiiiiiiiiiiiiii'
)
class Sw(Instruction):
    def get_wreg(self) -> Optional[int]:
        return None

    def disassemble(self, pc: int = None) -> str:
        return f"sw ${self.rt}, {self.imm16_signed}(${self.rs})"

    def render_str(self, pc: int = None):
        return f"sw ${self.rt}|r, {self.imm16_signed}(${self.rs}|r)"

    def execute(self, packet: Packet):
        if packet.stage == Stage.EX:
            rs_val = packet.pool.read_reg(self.rs, packet.stage)
            addr = rs_val + self.imm16_signed
            packet.optional["mem_addr"] = addr
        
        elif packet.stage == Stage.MEM:
            addr = packet.optional["mem_addr"].value
            rt_val = packet.pool.read_reg(self.rt, packet.stage)
            packet.pool.write_mem(packet, addr, rt_val)


@instr(
    opcode=0b000100, 
    tuse_rs=Stage.ID, 
    tuse_rt=Stage.ID,
    asm_type='B', 
    asm_template='$rs, $rt, label',
    asm_encoding='000100 sssss ttttt iiiiiiiiiiiiiiii'
)
class Beq(Instruction):
    def get_wreg(self) -> Optional[int]:
        return None

    
    def disassemble(self, pc: int = None) -> str:
        return f"beq ${self.rs}, ${self.rt}, {self.imm16_signed}"

    def render_str(self, pc: int = None):
        return f"beq ${self.rs}|r, ${self.rt}|r, {self.imm16_signed}"

    def execute(self, packet: Packet):
        if packet.stage != Stage.ID:
            return
        rs_val = packet.pool.read_reg(self.rs, packet.stage)
        rt_val = packet.pool.read_reg(self.rt, packet.stage)
        if rs_val == rt_val:
            packet.npc = packet.pc + 4 + (self.imm16_signed << 2)

@instr(
    opcode=0, 
    funct=0b001000, 
    tuse_rs=Stage.ID,
    asm_type='R', 
    asm_template='$rs',
    asm_encoding='000000 sssss 00000 00000 00000 001000'
)
class Jr(Instruction):
    def get_wreg(self) -> Optional[int]:
        return None

    def disassemble(self, pc: int = None) -> str:
        return f"jr ${self.rs}"
    
    def render_str(self, pc: int = None):
        return f"jr ${self.rs}|r"

    def execute(self, packet: Packet):
        if packet.stage != Stage.ID:
            return
        
        rs_val = packet.pool.read_reg(self.rs, packet.stage)
        packet.npc = rs_val.value

@instr(
    opcode=0b000011, 
    tnew=Stage.EX,
    asm_type='J', 
    asm_template='label',
    asm_encoding='000011 iiiiiiiiiiiiiiiiiiiiiiiiii'
)
class Jal(Instruction):
    def get_wreg(self) -> Optional[int]:
        return 31 # $ra register

    def disassemble(self, pc: int = None) -> str:
        if pc is not None:
            target_addr = (self.imm26 << 2) | ((pc + 4) & 0xF0000000)
            return f"jal {hex32(target_addr)}"
        return f"jal {hex32(self.imm26)}"
    
    def render_str(self, pc: int = None) -> str:
        # $ra ($31) is implicitly written
        if pc is not None:
            target_addr = (self.imm26 << 2) | ((pc + 4) & 0xF0000000)
            return f"jal {hex32(target_addr)} (=$31|w)"
        return f"jal {hex32(self.imm26)} (=$31|w)"

    def execute(self, packet: Packet):
        if packet.stage == Stage.ID:
            target_addr = (self.imm26 << 2) | ((packet.pc + 4) & 0xF0000000)
            packet.npc = target_addr
            return_addr = packet.pc + 8
            packet.pool.write_reg(packet, 31, to_word(return_addr), "jal")

@instr(
    opcode=0b000010,
    asm_type='J',
    asm_template='label',
    asm_encoding='000010 iiiiiiiiiiiiiiiiiiiiiiiiii'
)
class J(Instruction):
    def get_wreg(self) -> Optional[int]:
        return None  # j doesn't write to any register
    
    def disassemble(self, pc: int = None) -> str:
        if pc is not None:
            target_addr = (self.imm26 << 2) | ((pc + 4) & 0xF0000000)
            return f"j {hex32(target_addr)}"
        return f"j {hex32(self.imm26)}"
    
    def render_str(self, pc: int = None) -> str:
        if pc is not None:
            target_addr = (self.imm26 << 2) | ((pc + 4) & 0xF0000000)
            return f"j {hex32(target_addr)}"
        return f"j {hex32(self.imm26)}"
    
    def execute(self, packet: Packet):
        if packet.stage == Stage.ID:
            target_addr = (self.imm26 << 2) | ((packet.pc + 4) & 0xF0000000)
            packet.npc = target_addr

@instr(
    opcode=0b001000,
    tuse_rs=Stage.EX,
    tnew=Stage.MEM,
    asm_type='I',
    asm_template='$rt, $rs, imm',
    asm_encoding='001000 sssss ttttt iiiiiiiiiiiiiiii'
)
class Addi(Instruction):
    def get_wreg(self) -> Optional[int]:
        return self.rt
    
    def disassemble(self, pc: int = None) -> str:
        return f"addi ${self.rt}, ${self.rs}, {self.imm16_signed}"
    
    def render_str(self, pc: int = None):
        return f"addi ${self.rt}|w, ${self.rs}|r, {self.imm16_signed}"
    
    def execute(self, packet: Packet):
        if packet.stage != Stage.EX:
            return
        rs_val = packet.pool.read_reg(self.rs, packet.stage)
        result = rs_val + self.imm16_signed
        packet.pool.write_reg(packet, self.rt, result, "addi")

@instr(
    opcode=0,
    funct=0b000000,
    tuse_rt=Stage.EX,
    tnew=Stage.MEM,
    asm_type='R',
    asm_template='$rd, $rt, shamt',
    asm_encoding='000000 00000 ttttt ddddd hhhhh 000000',
    asm_mnemonic='sll'
)
class Sll(Instruction):
    def get_wreg(self) -> Optional[int]:
        return self.rd if self.rd != 0 else None
    
    def disassemble(self, pc: int = None) -> str:
        # nop is sll $0, $0, 0
        if self.rd == 0 and self.rt == 0 and self.shamt == 0:
            return "nop"
        return f"sll ${self.rd}, ${self.rt}, {self.shamt}"
    
    def render_str(self, pc: int = None):
        if self.rd == 0 and self.rt == 0 and self.shamt == 0:
            return "nop"
        return f"sll ${self.rd}|w, ${self.rt}|r, {self.shamt}"
    
    def execute(self, packet: Packet):
        if packet.stage != Stage.EX:
            return
        if self.rd == 0:  # nop case
            return
        rt_val = packet.pool.read_reg(self.rt, packet.stage)
        result = (rt_val.value << self.shamt) & 0xFFFFFFFF
        packet.pool.write_reg(packet, self.rd, to_word(result), "sll")

@instr(
    opcode=0b000110,
    tuse_rs=Stage.ID,
    asm_type='B',
    asm_template='$rs, label',
    asm_encoding='000110 sssss 00000 iiiiiiiiiiiiiiii',
    asm_mnemonic='blez'
)
class Blez(Instruction):
    def get_wreg(self) -> Optional[int]:
        return None
    
    def disassemble(self, pc: int = None) -> str:
        return f"blez ${self.rs}, {self.imm16_signed}"
    
    def render_str(self, pc: int = None):
        return f"blez ${self.rs}|r, {self.imm16_signed}"
    
    def execute(self, packet: Packet):
        if packet.stage != Stage.ID:
            return
        rs_val = packet.pool.read_reg(self.rs, packet.stage)
        # Check if rs <= 0 (treating as signed)
        if rs_val.value == 0 or (rs_val.value & 0x80000000):  # <= 0
            packet.npc = packet.pc + 4 + (self.imm16_signed << 2)

@instr(
    opcode=0,
    funct=0b101010,
    tuse_rs=Stage.EX,
    tuse_rt=Stage.EX,
    tnew=Stage.MEM,
    asm_type='R',
    asm_template='$rd, $rs, $rt',
    asm_encoding='000000 sssss ttttt ddddd 00000 101010'
)
class Slt(Instruction):
    def get_wreg(self) -> Optional[int]:
        return self.rd

    def disassemble(self, pc: int = None) -> str:
        return f"slt ${self.rd}, ${self.rs}, ${self.rt}"

    def render_str(self, pc: int = None):
        return f"slt ${self.rd}|w, ${self.rs}|r, ${self.rt}|r"

    def execute(self, packet: Packet):
        if packet.stage != Stage.EX:
            return
        rs_val = packet.pool.read_reg(self.rs, packet.stage)
        rt_val = packet.pool.read_reg(self.rt, packet.stage)
        result = 1 if rs_val.signed < rt_val.signed else 0
        packet.pool.write_reg(packet, self.rd, to_word(result), "slt")

@instr(
    opcode=0b000111,
    tuse_rs=Stage.ID,
    asm_type='B',
    asm_template='$rs, label',
    asm_encoding='000111 sssss 00000 iiiiiiiiiiiiiiii',
    asm_mnemonic='bgtz'
)
class Bgtz(Instruction):
    def get_wreg(self) -> Optional[int]:
        return None

    def disassemble(self, pc: int = None) -> str:
        return f"bgtz ${self.rs}, {self.imm16_signed}"

    def render_str(self, pc: int = None):
        return f"bgtz ${self.rs}|r, {self.imm16_signed}"

    def execute(self, packet: Packet):
        if packet.stage != Stage.ID:
            return
        rs_val = packet.pool.read_reg(self.rs, packet.stage)
        if rs_val.signed > 0:
            packet.npc = packet.pc + 4 + (self.imm16_signed << 2)

@instr(
    opcode=0b000101,
    tuse_rs=Stage.ID,
    tuse_rt=Stage.ID,
    asm_type='B',
    asm_template='$rs, $rt, label',
    asm_encoding='000101 sssss ttttt iiiiiiiiiiiiiiii',
    asm_mnemonic='bne'
)
class Bne(Instruction):
    def get_wreg(self) -> Optional[int]:
        return None

    def disassemble(self, pc: int = None) -> str:
        return f"bne ${self.rs}, ${self.rt}, {self.imm16_signed}"

    def render_str(self, pc: int = None):
        return f"bne ${self.rs}|r, ${self.rt}|r, {self.imm16_signed}"

    def execute(self, packet: Packet):
        if packet.stage != Stage.ID:
            return
        rs_val = packet.pool.read_reg(self.rs, packet.stage)
        rt_val = packet.pool.read_reg(self.rt, packet.stage)
        if rs_val != rt_val:
            packet.npc = packet.pc + 4 + (self.imm16_signed << 2)

# Nop is an alias for sll $0, $0, 0
class Nop(Sll):
    """Nop is just an alias for sll $0, $0, 0"""
    def __init__(self, machine_code: int = 0):
        super().__init__(machine_code)
    
    def disassemble(self, pc: int = None) -> str:
        return "nop"
    
    def execute(self, packet: Packet):
        pass  # Does nothing

# Manually set assembler metadata for nop
Nop._asm_type = 'R'
Nop._asm_template = ''
Nop._asm_encoding = '00000000000000000000000000000000'
Nop._asm_mnemonic = 'nop'

class Bubble(Sll):
    def disassemble(self, pc: int = None) -> str:
        return "nop"