from dataclasses import dataclass, field
from typing import Dict
from .isa import Change, Packet
from .base import Stage, PIPELINE

@dataclass
class ForwardRecord:
    val: int          # data
    pc: int           # PC
    stage: Stage      # (EX/MEM/WB)
    timestamp: int    # time

@dataclass
class PendingInfo:
    pc: int
    stage: Stage
    remaining: int = 0 # remain how many cycles

class Pool:
    def __init__(self, cpu):
        self.cpu = cpu
        self.pending: Dict[int, PendingInfo] = {} 
        self.reported: Dict[int, ForwardRecord] = {}

    def mark_pending(self, reg: int, tnew_stage: Stage, pc: int):
        if reg == 0: return
        self.pending[reg] = PendingInfo(pc, tnew_stage)

    def report(self, reg: int, val: int, pc: int, stage: Stage):
        if reg == 0: return
        self.reported[reg] = ForwardRecord(val, pc, stage, self.cpu.cycle)
    
    def clear_pending(self, pc: int):
        regs_to_clear = [r for r, p in self.pending.items() if p.pc == pc]
        for r in regs_to_clear:
            del self.pending[r]
    
    def flush_reported(self):
        self.reported.clear()

    def request(self, reg: int, tuse_stage: Stage, packet: Packet) -> int:
        if reg == 0:
            return 0
        if reg in self.pending:
            pending_info = self.pending[reg]
            if pending_info.stage == Stage.MEM and tuse_stage == Stage.EX:
                packet.stall = True
                packet.s_reason = f"Stall for R{reg} (LW-USE hazard from PC={hex(pending_info.pc)})"
                return -1
        if reg in self.reported:
            fwd_record = self.reported[reg]
            packet.f_reasons[reg] = f"Forward R{reg} from {fwd_record.stage.name} (PC={hex(fwd_record.pc)})"
            return fwd_record.val
        return self.cpu.regs[reg]