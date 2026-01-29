from collections import deque
from typing import Dict, Optional 
from .isa import decode, Packet, Instruction
from .pipeline import Pool
from .base import Stage

class CPU:
    def __init__(self, machine_codes: list[int]):
        self.pc = 0x3000
        self.regs = [0] * 32
        self.mem = {i: code for i, code in enumerate(machine_codes)}
        self.cycle = 0

        self.pipeline_stages: Dict[Stage, Optional[Packet]] = {s: None for s in Stage}
        self.pool = Pool(self)
        self.halt = False        
        self.history = []

    def step(self):
        if self.halt:
            return

        self.cycle += 1
        self.pool.flush_reported()

        self._do_wb()
        self._do_mem()
        self._do_ex()
        self._do_id()
        self._do_if()

        self.log_cycle_state()
    
    def run(self, max_cycles=1000):
        """运行模拟器直到结束"""
        while self.cycle < max_cycles and not self.halt:
            self.step()

    def _do_wb(self):
        packet = self.pipeline_stages[Stage.WB]
        if not packet: return

        # 写回寄存器
        if packet.alu:
            reg, change = list(packet.alu.items())[0]
            if reg != 0:
                self.regs[reg] = change.new
                # 报告最终值，给同一周期需要此值的指令使用 (非常少见，但可能)
                self.pool.report(reg, change.new, packet.pc, Stage.WB)
        
        # 清理pending
        self.pool.clear_pending(packet.pc)
        
        if isinstance(packet.instr, Beq) and packet.instr.rs == 0 and packet.instr.rt == 0 and packet.instr.imm16_signed == -1:
            self.halt = True

        self.pipeline_stages[Stage.WB] = None # 清空WB级

    def _do_mem(self):
        packet = self.pipeline_stages[Stage.MEM]
        if not packet:
            self.pipeline_stages[Stage.WB] = None
            return

        packet.instr.execute(packet)
        if packet.alu: # 如果是 lw，数据在MEM阶段产生
            reg, change = list(packet.alu.items())[0]
            self.pool.report(reg, change.new, packet.pc, Stage.MEM)

        self.pipeline_stages[Stage.WB] = packet

    def _do_ex(self):
        packet = self.pipeline_stages[Stage.EX]
        if not packet:
            self.pipeline_stages[Stage.MEM] = None
            return

        packet.instr.execute(packet)
        if packet.alu: # 如果是R-Type，数据在EX阶段产生
            reg, change = list(packet.alu.items())[0]
            self.pool.report(reg, change.new, packet.pc, Stage.EX)

        self.pipeline_stages[Stage.MEM] = packet

    def _do_id(self):
        packet = self.pipeline_stages[Stage.ID]
        if not packet:
            self.pipeline_stages[Stage.EX] = None
            return

        # 这是最复杂的部分：解码和冒险检测
        machine_code = self.mem.get((packet.pc - 0x3000) // 4, 0)
        packet.instr = decode(machine_code, packet.pc)
        packet.disassembly = packet.instr.disassemble()

        # 执行指令的ID阶段部分（主要用于分支）
        packet.instr.execute(packet)

        # 检查是否需要stall
        if packet.stall:
            # 插入气泡，ID和EX之间是NOP
            self.pipeline_stages[Stage.EX] = None 
            # IF阶段的指令需要被重新取，所以PC不更新
            # ID阶段的指令保持不变，下一周期再试
            return

        # 如果不stall，标记目标寄存器
        wreg = packet.instr.get_wreg()
        if wreg is not None:
            self.pool.mark_pending(wreg, packet.instr.tnew, packet.pc)

        # 指令进入下一阶段
        self.pipeline_stages[Stage.EX] = packet

    def _do_if(self):
        # 如果ID阶段暂停了，IF也必须暂停，PC不自增
        if self.pipeline_stages[Stage.ID] and self.pipeline_stages[Stage.ID].stall:
             # self.pc 保持不变
             return

        # 创建新packet
        packet = Packet(pool=self.pool, pc=self.pc, cpu=self)
        self.pipeline_stages[Stage.ID] = packet

        # 更新PC以获取下一条指令
        # 默认 PC+4，但ID阶段的分支指令可能会修改它
        id_packet = self.pipeline_stages[Stage.EX] # 注意：由于是从后往前，EX级里现在是上一条的ID级packet
        if id_packet and id_packet.npc != id_packet.pc + 4:
            self.pc = id_packet.npc # 分支跳转
        else:
            self.pc += 4 # 正常执行

    def log_cycle_state(self):
        # 在这里记录你想要的所有信息
        state = {
            "cycle": self.cycle,
            "pc": self.pc,
            "regs": list(self.regs),
            "pipeline": {
                stage.name: p.disassembly if p else "---" 
                for stage, p in self.pipeline_stages.items()
            },
            "stalls": [p.s_reason for p in self.pipeline_stages.values() if p and p.stall],
            "forwards": [p.f_reasons for p in self.pipeline_stages.values() if p and p.f_reasons],
        }
        self.history.append(state)
        # 你可以打印出来，或者存到文件
        print(f"Cycle {state['cycle']}: {state['pipeline']}")
        if state['stalls']: print(f"  Stalls: {state['stalls']}")
        if state['forwards']: print(f"  Forwards: {state['forwards']}")