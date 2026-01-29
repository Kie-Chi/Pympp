from audioop import add
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from .base import Stage, StallException, Word, Byte, Half
from .util.type import to_word, to_byte, to_half, hex32
from .behaviors import Behavior, StageStatus, RegWriteBehavior,MemWriteBehavior, BranchBehavior, StallBehavior
from .pipeline import Pool
from .mips.isa import Instruction, Packet, decode

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

class RegisterFile:
    def __init__(self, cpu):
        self.cpu = cpu
        self.regs = [Word(0) for _ in range(32)]

    def __getitem__(self, key: int) -> Word:
        return self.regs[key]

    def __setitem__(self, key: int, value: Word):
        self.regs[key] = value

    def __iter__(self):
        return iter(self.regs)

    def copy(self):
        return self.regs.copy()

    def read(self, reg_id: int) -> Word:
        val = self.regs[reg_id]
        return val

    def write(self, reg_id: int, value, pc: int):
        data = Word(value)
        if reg_id != 0:
            self.regs[reg_id] = data
            self.cpu.log_behavior(RegWriteBehavior(self.cpu.cycle, pc, reg_id, data.value))

class Memory:
    def __init__(self, cpu):
        self.cpu = cpu
        self.data: Dict[int, Word] = {}

    def read(self, addr: int) -> Word:
        val = self.data.get(int(addr), 0)
        return to_word(val)
    
    def get(self, addr, default=0):
        return self.data.get(addr, default)

    def copy(self):
        return self.data.copy()

    def write(self, addr: int, value, pc: int):
        data = Word(value)
        iaddr = int(addr)
        self.data[iaddr] = data
        self.cpu.log_behavior(MemWriteBehavior(self.cpu.cycle, pc, iaddr, data.value))

class CPU:
    def __init__(self, machine_codes: List[int]):
        self.pc = 0x3000
        self.regs: RegisterFile = RegisterFile(self)
        self.imem = machine_codes
        self.dmem: Memory = Memory(self)
        self.cycle = 0
        self.slots: Dict[Stage, Optional[Packet]] = {s: None for s in Stage}
        self.shadows = None
        self.pool: Pool = Pool(self)
        
        self.current_behaviors: List[Behavior] = []
        self.history: List[Snapshot] = []

    def log_behavior(self, b):
        self.current_behaviors.append(b)

    def step(self):
        self.cycle += 1
        self.current_behaviors = []
        self.shadows = self.slots.copy()
        self._stage_wb()
        self._stage_mem()
        self._stage_ex()
        is_stalled = self._stage_id()
        self._stage_if(is_stalled)
        self.capture_snapshot()

    def _stage_wb(self):
        p = self.slots[Stage.WB]
        if not p: return
        p.advance()
        for reg_id, change in p.alu.items():
            self.regs.write(reg_id, change.new, p.pc)

    def _stage_mem(self):
        p = self.slots[Stage.MEM]
        if p:
            p.advance()
            p.instr.execute(p)
            for addr, change in p.mem.items():
                self.dmem.write(addr, change.new, p.pc)
        self.slots[Stage.WB] = p

    def _stage_ex(self):
        p = self.slots[Stage.EX]
        if p:
            p.advance()
            p.instr.execute(p)
        self.slots[Stage.MEM] = p

    def _stage_id(self) -> bool:
        p = self.slots[Stage.ID]
        if not p:
            self.slots[Stage.EX] = None
            return False

        try:
            if p.stage != Stage.ID:
                p.advance()
            self.pool.check_stall(p)
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
        
        fetch_pc = self.pc
        # origin ID instr now in EX stage
        p_id = self.slots[Stage.ID]
        if p_id and p_id.npc != p_id.pc + 4:
            self.pc = p_id.npc
        else:
            self.pc += 4

        idx = (fetch_pc - 0x3000) // 4
        if 0 <= idx < len(self.imem):
            instr_code = self.imem[idx]
            instr = decode(instr_code, fetch_pc)
            self.slots[Stage.ID] = Packet(pool=self.pool, pc=fetch_pc, instr=instr)
            if p_id and p_id.npc != p_id.pc + 4:
                self.log_behavior(BranchBehavior(self.cycle, p_id.pc, p_id.npc, taken=True))
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
                    disasm=p.instr.disassemble(p.pc),
                    t_new=p.instr.remaining(s)
                ).to_dict()
            else:
                pipeline_snap[s.name] = None
        self.history.append({
            "cycle": self.cycle,
            "pc": hex32(self.pc),
            "gpr": [hex32(r.value) for r in self.regs],
            "memory": {hex32(addr): hex32(val.value) for addr, val in self.dmem.copy().items()},
            "pipeline": pipeline_snap,
            "behaviors": self.current_behaviors.copy(),
        })