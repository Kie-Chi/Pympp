from .base import Stage, PIPELINE
from .behaviors import ForwardBehavior, StallBehavior

class StallException(Exception):
    def __init__(self, reason: str):
        self.reason = reason

class Pool:
    def __init__(self, cpu):
        self.cpu = cpu

    def request(self, reg: int, current_stage: Stage) -> int:
        if reg == 0: return 0
        
        current_packet = self.cpu.slots[current_stage]
        t_use = current_packet.instr.tuse_rs if reg == current_packet.instr.rs else current_packet.instr.tuse_rt

        for s in [Stage.EX, Stage.MEM, Stage.WB]:
            prod_packet = self.cpu.slots[s]
            if not prod_packet: continue
            if reg in prod_packet.alu:
                t_new = prod_packet.instr.remaining(s)
                if current_stage == Stage.ID:
                    t_use_val = max(0, t_use.value - Stage.ID.value)
                    if t_use_val < t_new:
                        raise StallException(f"Hazard on ${reg}: Tuse({t_use_val}) < Tnew({t_new})")
                
                if t_new == 0:
                    forward_val = prod_packet.alu[reg].new
                    self.cpu.log_behavior(ForwardBehavior(
                        self.cpu.cycle, current_packet.pc, reg, forward_val, s.name, current_stage.name
                    ))
                    return forward_val
        return self.cpu.regs[reg]