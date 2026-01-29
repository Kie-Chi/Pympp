from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from .base import Stage, StallException
from .behaviors import StageStatus, RegWriteBehavior, MemOpBehavior, BranchBehavior, StallBehavior
from .pipeline import Pool
from .isa import Instruction, Packet, decode

@dataclass
class Snapshot:
    """
    snapshot for pipeline cpu at each cycle
    """
    cycle: int
    pc: int
    pipeline: Dict[str, Optional[Dict[str, Any]]] 
    behaviors: List[Dict[str, Any]]
    registers: List[int]

    def to_dict(self):
        return asdict(self)

class CPU:
    def __init__(self, machine_codes: List[int]):
        self.pc = 0x3000
        self.regs = [0] * 32
        self.imem = machine_codes
        self.dmem = {}
        self.cycle = 0
        self.slots: Dict[Stage, Optional[Packet]] = {s: None for s in Stage}
        self.pool = Pool(self)
        
        self.current_behaviors = []
        self.history = []

    def log_behavior(self, b):
        self.current_behaviors.append(b)

    def step(self):
        self.cycle += 1
        self.current_behaviors = []
        self._stage_wb()
        self._stage_mem()
        self._stage_ex()
        is_stalled = self._stage_id()
        self._stage_if(is_stalled)
        self.capture_snapshot()

    def _stage_wb(self):
        p = self.slots[Stage.WB]
        if not p: return
        for reg_id, change in p.alu.items():
            if reg_id != 0:
                self.regs[reg_id] = change.new
                self.log_behavior(RegWriteBehavior(self.cycle, p.pc, reg_id, change.new))

    def _stage_mem(self):
        p = self.slots[Stage.MEM]
        if p:
            p.stage = Stage.MEM
            p.instr.execute(p)
        self.slots[Stage.WB] = p

    def _stage_ex(self):
        p = self.slots[Stage.EX]
        if p:
            p.stage = Stage.EX
            p.instr.execute(p)
        self.slots[Stage.MEM] = p

    def _stage_id(self) -> bool:
        p = self.slots[Stage.ID]
        if not p:
            self.slots[Stage.EX] = None
            return False

        try:
            p.stage = Stage.ID
            p.instr.execute(p) 
            self.slots[Stage.EX] = p
            return False

        except StallException as e:
            self.slots[Stage.EX] = None
            self.log_behavior(StallBehavior(self.cycle, p.pc, "ID", str(e)))
            return True

    def _stage_if(self, is_stalled: bool):
        if is_stalled:
            return
        p_id = self.slots[Stage.ID]
        fetch_pc = p_id.npc if (p_id and p_id.npc != p_id.pc + 4) else self.pc
        self.pc = fetch_pc 

        idx = (fetch_pc - 0x3000) // 4
        if 0 <= idx < len(self.imem):
            instr_code = self.imem[idx]
            instr = decode(instr_code, fetch_pc)
            self.slots[Stage.ID] = Packet(pool=self.pool, pc=fetch_pc, instr=instr, cpu=self)
            self.pc += 4
        else:
            self.slots[Stage.ID] = None

    def capture_snapshot(self):
        pipeline_snap = {}
        for s in [Stage.IF, Stage.ID, Stage.EX, Stage.MEM, Stage.WB]:
            p = self.slots[s]
            if p:
                pipeline_snap[s.name] = StageStatus(
                    cycle=self.cycle, pc=p.pc, stage=s.name,
                    instr_name=p.instr.__class__.__name__.lower(),
                    disasm=p.instr.disassemble(),
                    t_new=p.instr.remaining(s)
                ).to_dict()
            else:
                pipeline_snap[s.name] = None
        self.history.append({
            "cycle": self.cycle,
            "pc": self.pc,
            "gpr": self.regs.copy(),
            "memory": self.dmem.copy(),
            "pipeline": pipeline_snap,
            "behaviors": self.current_behaviors.copy(),
        })