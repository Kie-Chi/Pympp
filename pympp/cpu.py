from subprocess import PIPE
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from .base import PIPELINE, Stage, StallException, Word, Byte, Half
from .util.type import to_word, to_byte, to_half, hex32
from .behaviors import Behavior, StageStatus, RegWriteBehavior, MemWriteBehavior, BranchBehavior, StallBehavior
from .pipeline import Pool
from .mips.isa import Instruction, Packet, decode
from .mips.set import Bubble 

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
        self.pc = 0x3000 - 4
        self.regs: RegisterFile = RegisterFile(self)
        self.imem = machine_codes
        self.dmem: Memory = Memory(self)
        self.cycle = 0
        self.slots: Dict[Stage, Optional[Packet]] = {s: None for s in Stage}
        self.shadows: Dict[Stage, Optional[Packet]] = {s: None for s in Stage}
        self.pool: Pool = Pool(self)
        
        self.current_behaviors: List[Behavior] = []
        self.history: List[Snapshot] = []
        self.__pre_load()

    def __pre_load(self):
        self._stage_if()

    def log_behavior(self, b):
        self.current_behaviors.append(b)

    def step(self):
        self.cycle += 1
        curpc = self.pc
        self.current_behaviors = []
        self.shadows = self.slots.copy()
        self._stage_wb()
        self._stage_mem()
        self._stage_ex()
        self._stage_id()
        self._stage_if()
        self.capture_snapshot(curpc)

    def _stage_wb(self):
        p = self.slots[Stage.WB]
        if not p: return
        for reg_id, change in p.alu.items():
            self.regs.write(reg_id, change.new, p.pc)
        self.slots[Stage.WB] = None

    def _stage_mem(self):
        p = self.slots[Stage.MEM]
        if p:
            p.advance()
            p.instr.execute(p)
            for addr, change in p.mem.items():
                self.dmem.write(addr, change.new, p.pc)
            self.slots[Stage.WB] = p
            self.slots[Stage.MEM] = None

    def _stage_ex(self):
        p = self.slots[Stage.EX]
        if p:
            p.advance()
            p.instr.execute(p)
            self.slots[Stage.MEM] = p
            self.slots[Stage.EX] = None

    def _stage_id(self):
        p_id = self.slots[Stage.ID]
        if p_id:
            try:
                self.pool.check_stall(p_id)
                if p_id.stage == Stage.IF:
                    p_id.advance()
                p_id.instr.execute(p_id)
                if p_id.npc != p_id.pc + 4:
                    self.pc = p_id.npc - 4 # IF will add 4
                    self.log_behavior(BranchBehavior(self.cycle, p_id.pc, p_id.npc, taken=True))
                self.slots[Stage.EX] = p_id
                self.slots[Stage.ID] = None
                
            except StallException as e:
                self.log_behavior(StallBehavior(self.cycle, p_id.pc, "ID", str(e)))
                bubble_pkt = Packet(pool=self.pool, pc=0, instr=Bubble(0))
                bubble_pkt.stage = Stage.EX
                self.slots[Stage.EX] = bubble_pkt
                return # Do not pull from IF
        if self.slots[Stage.ID] is None:
            p_if = self.slots[Stage.IF]
            if p_if:
                self.slots[Stage.ID] = p_if
                if p_if.stage == Stage.IF:
                    p_if.advance()
                self.slots[Stage.IF] = None

    def _stage_if(self):
        if self.slots[Stage.IF] is None:
            self.pc += 4
            fetch_pc = self.pc
            
            # Fetch
            idx = (fetch_pc - 0x3000) // 4
            if 0 <= idx < len(self.imem):
                instr_code = self.imem[idx]
                instr = decode(instr_code, fetch_pc)
                pkt = Packet(pool=self.pool, pc=fetch_pc, instr=instr)
                pkt.stage = Stage.IF 
                self.slots[Stage.IF] = pkt
            else:
                self.slots[Stage.IF] = None

    def capture_snapshot(self, cur_pc: int):
        pipeline_snap = {}
        s = Stage.IF
        while s != Stage.END:
            p = self.shadows[s]
            if p:
                is_bubble = isinstance(p.instr, Bubble)
                is_stall = False
                if s == Stage.ID:
                    for b in self.current_behaviors:
                        if isinstance(b, StallBehavior) and b.stage == "ID":
                            is_stall = True
                            break
                tuse_rs = p.instr.tuse_rs_remaining(s)
                tuse_rt = p.instr.tuse_rt_remaining(s)
                tnew = p.instr.tnew_remaining(s)
                pipeline_snap[s.name] = StageStatus(
                    cycle=self.cycle,
                    pc=p.pc,
                    name=s.name,
                    instr=p.instr.disassemble(p.pc),
                    rs=p.instr.rs,
                    rt=p.instr.rt,
                    rd=p.instr.rd,
                    imm=p.instr.imm16,
                    tuse_rs=tuse_rs,
                    tuse_rt=tuse_rt,
                    tnew=tnew,
                    is_bubble=is_bubble,
                    is_stall=is_stall
                ).to_dict()
            else:
                pipeline_snap[s.name] = None
            s = PIPELINE[s]

        self.history.append({
            "cycle": self.cycle,
            "pc": hex32(cur_pc),
            "gpr": [hex32(r.value) for r in self.regs],
            "memory": {hex32(addr): hex32(val.value) for addr, val in self.dmem.copy().items()},
            "pipeline": pipeline_snap,
            "behaviors": self.current_behaviors.copy(),
        })