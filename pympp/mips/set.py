from struct import pack
from typing import Optional
from .isa import instr, Instruction, Packet, Change
from ..base import Stage

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

@instr(opcode=0, funct=0b100000, tuse_rs=Stage.EX, tuse_rt=Stage.EX, tnew=Stage.MEM)
class Add(Instruction):
    def get_wreg(self) -> Optional[int]:
        return self.rd
    
    def disassemble(self) -> str:
        return f"add ${self.rd}, ${self.rs}, ${self.rt}"

    def execute(self, packet: Packet):
        if packet.stage != Stage.EX:
            return
        rs_val = packet.pool.read_reg(self.rs, packet.stage)
        rt_val = packet.pool.read_reg(self.rt, packet.stage)
        result = rs_val + rt_val
        packet.pool.write_reg(packet, self.rd, result, "add")

@instr(opcode=0, funct=0b100010, tuse_rs=Stage.EX, tuse_rt=Stage.EX, tnew=Stage.MEM)
class Sub(Instruction):
    def get_wreg(self) -> Optional[int]:
        return self.rd
    
    def disassemble(self) -> str:
        return f"sub ${self.rd}, ${self.rs}, ${self.rt}"

    def execute(self, packet: Packet):
        if packet.stage != Stage.EX:
            return
        rs_val = packet.pool.read_reg(self.rs, packet.stage)
        rt_val = packet.pool.read_reg(self.rt, packet.stage)
        result = rs_val - rt_val
        packet.pool.write_reg(packet, self.rd, result, "sub")

@instr(opcode=0b001111, tnew=Stage.MEM)
class Lui(Instruction):
    def get_wreg(self) -> Optional[int]:
        return self.rt

    def disassemble(self) -> str:
        return f"lui ${self.rt}, {hex(self.imm16)}"

    def execute(self, packet: Packet):
        if packet.stage != Stage.EX:
            return
        result = self.imm16 << 16
        packet.pool.write_reg(packet, self.rt, result, "lui")

@instr(opcode=0b001101, tuse_rs=Stage.EX, tnew=Stage.EX)
class Ori(Instruction):
    def get_wreg(self) -> Optional[int]:
        return self.rt
    
    def disassemble(self) -> str:
        return f"ori ${self.rt}, ${self.rs}, {hex(self.imm16)}"

    def execute(self, packet: Packet):
        if packet.stage != Stage.EX:
            return
        rs_val = packet.pool.read_reg(self.rs, packet.stage)
        result = rs_val | self.imm16
        packet.pool.write_reg(packet, self.rt, result, "ori")


@instr(opcode=0b100011, tuse_rs=Stage.EX, tnew=Stage.WB)
class Lw(Instruction):
    def get_wreg(self) -> Optional[int]:
        return self.rt

    def disassemble(self) -> str:
        return f"lw ${self.rt}, {self.imm16_signed}(${self.rs})"

    def execute(self, packet: Packet):
        if packet.stage == Stage.EX:
            rs_val = packet.pool.read_reg(self.rs, packet.stage)
            addr = rs_val + self.imm16_signed
            packet.optional["mem_addr"] = addr 
        
        elif packet.stage == Stage.MEM:
            mem_val = packet.pool.read_mem(packet.optional["mem_addr"])
            packet.pool.write_reg(packet, self.rt, mem_val, "lw")

@instr(opcode=0b101011, tuse_rs=Stage.EX, tuse_rt=Stage.MEM)
class Sw(Instruction):
    def get_wreg(self) -> Optional[int]:
        return None

    def disassemble(self) -> str:
        return f"sw ${self.rt}, {self.imm16_signed}(${self.rs})"

    def execute(self, packet: Packet):
        if packet.stage == Stage.EX:
            rs_val = packet.pool.read_reg(self.rs, packet.stage)
            addr = rs_val + self.imm16_signed
            packet.optional["mem_addr"] = addr
        
        elif packet.stage == Stage.MEM:
            addr = packet.optional["mem_addr"]
            rt_val = packet.pool.read_reg(self.rt, packet.stage)
            packet.pool.write_mem(addr, rt_val)


@instr(opcode=0b000100, tuse_rs=Stage.ID, tuse_rt=Stage.ID)
class Beq(Instruction):
    def get_wreg(self) -> Optional[int]:
        return None

    def disassemble(self) -> str:
        return f"beq ${self.rs}, ${self.rt}, {self.imm16_signed}"

    def execute(self, packet: Packet):
        if packet.stage != Stage.ID:
            return
        rs_val = packet.pool.read_reg(self.rs, packet.stage)
        rt_val = packet.pool.read_reg(self.rt, packet.stage)
        if rs_val == rt_val:
            packet.npc = packet.pc + 4 + (self.imm16_signed << 2)

@instr(opcode=0, funct=0b001000, tuse_rs=Stage.ID)
class Jr(Instruction):
    def get_wreg(self) -> Optional[int]:
        return None

    def disassemble(self) -> str:
        return f"jr ${self.rs}"

    def execute(self, packet: Packet):
        if packet.stage != Stage.ID:
            return
        
        rs_val = packet.pool.read_reg(self.rs, packet.stage)
        packet.npc = rs_val

@instr(opcode=0b000011, tnew=Stage.EX)
class Jal(Instruction):
    def get_wreg(self) -> Optional[int]:
        return 31 # $ra register

    def disassemble(self) -> str:
        target_addr = (self.imm26 << 2) | ((self.pc + 4) & 0xF0000000)
        return f"jal {hex(target_addr)}"

    def execute(self, packet: Packet):
        if packet.stage == Stage.ID:
            target_addr = (self.imm26 << 2) | ((packet.pc + 4) & 0xF0000000)
            packet.npc = target_addr
            return_addr = packet.pc + 8
            packet.pool.write_reg(packet, 31, return_addr, "jal")

@instr(opcode=0, funct=0) # Nop is usually all zeros
class Nop(Instruction):
    def get_wreg(self) -> Optional[int]:
        return None
    
    def disassemble(self) -> str:
        return "nop"

    def execute(self, packet: Packet):
        # Does absolutely nothing
        pass