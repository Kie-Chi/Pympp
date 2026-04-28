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

class Timer:
    def __init__(self, cpu, base_addr):
        self.cpu = cpu
        self.base_addr = base_addr
        self.ctrl = 0
        self.preset = 0
        self.count = 0
        self.state = 0  # 0: IDLE, 1: LOAD, 2: CNT, 3: INT
        self._irq = False

    def copy(self):
        t = Timer(self.cpu, self.base_addr)
        t.ctrl = self.ctrl
        t.preset = self.preset
        t.count = self.count
        t.state = self.state
        t._irq = self._irq
        return t

    def read(self, addr: int) -> int:
        offset = addr - self.base_addr
        if offset == 0x0:
            return self.ctrl
        elif offset == 0x4:
            return self.preset
        elif offset == 0x8:
            return self.count
        return 0

    def write(self, addr: int, val: int):
        offset = addr - self.base_addr
        if offset == 0x0:
            self.ctrl = val
        elif offset == 0x4:
            self.preset = val
        elif offset == 0x8:
            self.count = val

    def step(self):
        if self.state == 0:  # IDLE
            if self.ctrl & 1:
                self.state = 1
                self._irq = False
        elif self.state == 1:  # LOAD
            self.count = self.preset
            self.state = 2
        elif self.state == 2:  # CNT
            if self.ctrl & 1:
                if self.count > 1:
                    self.count -= 1
                else:
                    self.count = 0
                    self.state = 3
                    self._irq = True
            else:
                self.state = 0
        else:  # INT
            if ((self.ctrl >> 1) & 3) == 0:
                self.ctrl &= ~1
            else:
                self._irq = False
            self.state = 0

    @property
    def irq(self):
        return bool((self.ctrl & 8) and self._irq)

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

    def write(self, reg_id: int, change, pc: int):
        data = change.new
        # ugly
        # because read_reg will not actually stall pipeline now, so when we use read_reg fetch origin value of a register, it may be old(that in RegisterFile, not new value in pipline), thus the change.origin.value is useless
        # so we dont use the change.origin.value, but actually read from RegisterFile
        if reg_id != 0:
            origin_val = self.regs[reg_id].value
            self.regs[reg_id] = data
            self.cpu.log_behavior(RegWriteBehavior(
                self.cpu.cycle, 
                pc, 
                reg_id, 
                data.value, 
                # origin=change.origin.value, error !!!
                origin=origin_val,
                reason=change.reason
            ))

class Memory:
    def __init__(self, cpu):
        self.cpu = cpu
        self.data: Dict[int, Word] = {}
        self.timers = {
            "Timer 0": Timer(cpu, 0x7F00),
            "Timer 1": Timer(cpu, 0x7F10)
        }

    def _get_timer_for_addr(self, addr: int) -> Optional[Timer]:
        if 0x7F00 <= addr <= 0x7F0B:
            return self.timers["Timer 0"]
        elif 0x7F10 <= addr <= 0x7F1B:
            return self.timers["Timer 1"]
        return None

    def read(self, addr: int) -> Word:
        timer = self._get_timer_for_addr(addr)
        if timer:
            return Word(timer.read(addr))

        val = self.data.get(int(addr), 0)

        # Check if address is in text segment (code)
        if self.is_text_segment(addr):
            # Return instruction from imem
            idx = (addr - 0x3000) // 4
            if 0 <= idx < len(self.cpu.imem):
                return Word(self.cpu.imem[idx])

        return to_word(val)

    def get(self, addr, default=0):
        return self.data.get(addr, default)

    def copy(self):
        return self.data.copy()

    def is_text_segment(self, addr: int) -> bool:
        """检查地址是否在代码段范围内"""
        TEXT_START = 0x3000
        TEXT_END = TEXT_START + len(self.cpu.imem) * 4
        return TEXT_START <= addr < TEXT_END

    def write(self, addr: int, change, pc: int):
        data = change.new
        iaddr = int(addr)

        timer = self._get_timer_for_addr(iaddr)
        if timer:
            timer.write(iaddr, data.value)
            self.cpu.log_behavior(MemWriteBehavior(
                self.cpu.cycle, pc, iaddr, data.value,
                origin=change.origin.value, reason=change.reason
            ))
            return

        if self.is_text_segment(iaddr):
            self.cpu.log_behavior(MemWriteBehavior(
                self.cpu.cycle, pc, iaddr, data.value,
                origin=change.origin.value, reason="text_segment_write_blocked"
            ))
            return
        self.data[iaddr] = data
        self.cpu.log_behavior(MemWriteBehavior(
            self.cpu.cycle, pc, iaddr, data.value,
            origin=change.origin.value, reason=change.reason
        ))

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

    def _is_pipeline_empty(self) -> bool:
        for s in self.slots.values():
            if s is not None:
                return False
        return True

    def _is_pc_out_of_bounds(self) -> bool:
        idx = (self.pc - 0x3000) // 4
        return not (0 <= idx < len(self.imem))

    def _is_last_snapshot_empty(self) -> bool:
        """Check if the last snapshot shows an empty pipeline"""
        if not self.history:
            return False
        last_snap = self.history[-1]
        for stage_info in last_snap["pipeline"].values():
            if stage_info is not None:
                return False
        return True

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
        
        for timer in self.dmem.timers.values():
            timer.step()
            
        self.capture_snapshot(curpc)

    def _stage_wb(self):
        p = self.slots[Stage.WB]
        if not p: return
        for reg_id, change in p.alu.items():
            self.regs.write(reg_id, change, p.pc)
        self.slots[Stage.WB] = None

    def _stage_mem(self):
        p = self.slots[Stage.MEM]
        if p:
            p.advance()
            p.instr.execute(p)
            for addr, change in p.mem.items():
                self.dmem.write(addr, change, p.pc)
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
                self.log_behavior(StallBehavior(
                    self.cycle, p_id.pc,
                    producer_stage=e.producer_stage,
                    consumer_stage="ID",
                    reg=e.reg
                ))
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

        stall_srcs = set()
        for b in self.current_behaviors:
            if isinstance(b, StallBehavior):
                stall_srcs.add(b.producer_stage)

        s = Stage.IF
        while s != Stage.END:
            p = self.shadows[s]
            if p:
                is_bubble = isinstance(p.instr, Bubble)
                is_stall = False
                if s == Stage.ID:
                    for b in self.current_behaviors:
                        if isinstance(b, StallBehavior) and b.consumer_stage == "ID":
                            is_stall = True
                            break
                is_stall_src = s.name in stall_srcs
                tuse_rs = p.instr.tuse_rs_remaining(s)
                tuse_rt = p.instr.tuse_rt_remaining(s)
                tnew = p.instr.tnew_remaining(s)
                wreg = p.instr.get_wreg()
                rregs = p.instr.get_rregs()
                pipeline_snap[s.name] = StageStatus(
                    cycle=self.cycle,
                    pc=p.pc,
                    name=s.name,
                    instr=p.instr.disassemble(p.pc),
                    render_str=p.instr.render_str(p.pc),
                    rs=p.instr.rs,
                    rt=p.instr.rt,
                    rd=p.instr.rd,
                    wreg=wreg,
                    rregs=rregs,
                    imm=p.instr.imm16,
                    tuse_rs=tuse_rs,
                    tuse_rt=tuse_rt,
                    tnew=tnew,
                    is_bubble=is_bubble,
                    is_stall=is_stall,
                    is_stall_src=is_stall_src
                ).to_dict()
            else:
                pipeline_snap[s.name] = None
            s = PIPELINE[s]

        timers_snap = {}
        for name, timer in self.dmem.timers.items():
            timers_snap[name] = {
                "ctrl": hex32(timer.ctrl),
                "preset": hex32(timer.preset),
                "count": hex32(timer.count)
            }

        self.history.append({
            "cycle": self.cycle,
            "pc": hex32(cur_pc),
            "gpr": [hex32(r.value) for r in self.regs],
            "memory": {hex32(addr): hex32(val.value) for addr, val in self.dmem.copy().items()},
            "timers": timers_snap,
            "pipeline": pipeline_snap,
            "behaviors": self.current_behaviors.copy(),
        })