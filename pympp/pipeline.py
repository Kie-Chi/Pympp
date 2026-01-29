from pympp.util.type import Word, to_word
from .base import Stage, PIPELINE, StallException
from .behaviors import ForwardBehavior, StallBehavior

class Pool:
    def __init__(self, cpu):
        self.cpu = cpu

    def check_stall(self, packet):
        if packet.instr.tuse_rs != Stage.BEGIN:
            self._detect_hazard(packet.instr.rs, packet.instr.tuse_rs)
        if packet.instr.tuse_rt != Stage.BEGIN:
            self._detect_hazard(packet.instr.rt, packet.instr.tuse_rt)

    def _detect_hazard(self, reg: int, t_use: Stage):
        if reg == 0: return
        
        for s in [Stage.EX, Stage.MEM, Stage.WB]:
            prod_packet = self.cpu.slots[s]
            if not prod_packet: continue
            
            if prod_packet.instr.get_wreg() == reg:
                t_new = prod_packet.instr.remaining(s)
                t_use_val = max(0, t_use.value - Stage.ID.value)
                
                if t_use_val < t_new:
                    raise StallException(f"Hazard on ${reg}: Tuse({t_use_val}) < Tnew({t_new})")
                return # Found the latest producer

    def read_reg(self, reg: int, cur_stage: Stage, log: bool = True) -> Word:
        if reg == 0: 
            return Word(0)
        
        curpkt = self.cpu.slots[cur_stage]
        s = PIPELINE[cur_stage]
        while s is not None and s != Stage.END:
            prod_packet = self.cpu.slots[s]
            if not prod_packet: 
                s = PIPELINE[s]
                continue
            
            if prod_packet.instr.get_wreg() == reg:
                t_new = prod_packet.instr.remaining(s)
                
                # Double check stall for safety
                if cur_stage == Stage.ID:
                     t_use = curpkt.instr.tuse_rs if reg == curpkt.instr.rs else curpkt.instr.tuse_rt
                     t_use_val = max(0, t_use.value - Stage.ID.value)
                     if t_use_val < t_new:
                        raise StallException(f"Hazard on ${reg}: Tuse({t_use_val}) < Tnew({t_new})")

                if t_new == 0:
                    # Value must be available if t_new == 0
                    if reg in prod_packet.alu:
                        forward_val = prod_packet.alu[reg].new
                        if log:
                            self.cpu.log_behavior(ForwardBehavior(
                                self.cpu.cycle, curpkt.pc, reg, forward_val.value, s.name, cur_stage.name
                            ))
                        return forward_val
                return self.cpu.regs.read(reg)
            s = PIPELINE[s]
        return self.cpu.regs.read(reg)

    def read_mem(self, addr: int) -> Word:
        return self.cpu.dmem.read(addr)

    def write_reg(self, packet, reg: int, val, reason: str):
        if reg == 0: return
        from .mips.isa import Change
        val_word = Word(val)
        packet.alu[reg] = Change(origin=self.read_reg(reg, packet.stage, log=False), new=val_word, reason=reason)

    def write_mem(self, packet, addr: int, val):
        from .mips.isa import Change
        val_word = Word(val)
        packet.mem[addr] = Change(origin=self.read_mem(addr), new=val_word, reason="mem_write")
