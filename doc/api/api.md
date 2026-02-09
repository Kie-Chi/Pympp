# MIPS Pipeline Simulator API 文档 (v1.0)

基于Python FAST API进行构建为前端UI提供相应的接口

## 1. 核心概念

*   **Snapshot (快照)**: 系统在每个时钟周期结束时保存的完整状态。包含寄存器、内存、流水线各级详情及本周期发生的事件（转发、阻塞等）。
*   **Time Travel (时间旅行)**: 系统记录了完整的历史记录，UI 可以通过索引直接跳转到任何历史周期。
*   **Packet (数据包)**: 指令在流水线中流动的载体，携带指令对象及其计算出的中间值。

---

## 2. API 接口详解

### 2.1 初始化与配置

#### `load_program(asm_source: str) -> bool`
*   **功能**: 接收汇编源码，将其编译为机器码，并重置 CPU。
*   **输出**: 若编译成功返回 `True`，并在内部生成 `SourceMap`（PC 与源码行号的映射）。

#### `get_source_map() -> Dict[str, int]`
*   **功能**: 获取 PC 地址到源码行号的映射，用于编辑器高亮。
*   **返回示例**: `{"0x3000": 1, "0x3004": 2, ...}`

---

### 2.2 模拟执行控制

#### `step_cycle() -> Snapshot`
*   **功能**: 执行一个时钟周期的模拟。
*   **返回**: 当前周期的 `Snapshot` 数据。

#### `run_until_end(max_cycles: int = 1000) -> List[Snapshot]`
*   **功能**: 自动运行程序直到结束（遇到空指令或达到上限）。
*   **返回**: 整个执行过程的所有快照列表。

#### `reset()`
*   **功能**: 清空历史记录，将 PC 重置回 `0x3000`，寄存器和内存清零。

---

### 2.3 状态与历史查询

#### `get_snapshot(cycle: int) -> Snapshot`
*   **功能**: 获取特定周期的状态。用于 UI 时间轴拖动。

#### `get_current_cycle() -> int`
*   **功能**: 获取当前模拟运行到的周期数。

---

## 3. 数据结构详解 (Snapshot Schema)

这是返回给前端的最关键对象，详细定义了如何映射到 PDF 的 UI。

```json
{
  "cycle": 12,
  "pc": "00003024", // 当前程序计数器
  
  // 1. 寄存器文件：对应 UI 左下角的“寄存器模拟区域”
  "registers": {
    "0": "00000000",
    "1": "00000230", // 如果本周期有写入，UI 可将其变为橙色
    ...
    "31": "00000000"
  },

  // 2. 数据内存：对应 UI 右下角的“内存模拟区域”
  "memory": {
    "00000000": "00004300",
    "00000004": "000007ac"
  },

  // 3. 流水线阶段详情：对应 UI 上方的“流水寄存器模拟区域”
  "pipeline": {
    "IF": {
      "pc": "00003028",
      "instr": "lw $1, 0($2)",
      "is_bubble": false,
      "is_stall": false
    },
    "ID": {
      "pc": "00003024",
      "instr": "sub $4, $1, $5",
      "rs": 1, "rt": 5, "rd": 4,
      "tuse_rs": 1, // 对应 PDF: tuse_rs($1): 1
      "tuse_rt": 1,
      "tnew": 2,    // 对应 PDF: tnew($4): 2
      "is_bubble": false,
      "is_stall": true // 若为真，UI 在该阶段绘制“红色锁”图标
    },
    "EX": {
      "pc": "00003020",
      "instr": "nop(bubble)", 
      "is_bubble": true, // 若为真，UI 渲染为橙色/灰色背景
      "tnew": 0
    },
    "MEM": { ... },
    "WB": { ... }
  },

  // 4. 事件列表：对应 UI 中的“彩色转发线”
  "behaviors": [
    {
      "type": "ForwardBehavior",
      "reg": 1,
      "val": "00000230",
      "from_stage": "WB",
      "to_stage": "ID",
      "color": "blue" // UI 根据 to_stage 自动选择颜色：ID(蓝), EX(黄), MEM(绿)
    },
    {
      "type": "StallBehavior",
      "stage": "ID",
      "reason": "Hazard on $1"
    }
  ]
}
```

---

## 4. UI 映射指南 (如何复刻 PDF 效果)

### 4.1 转发线绘制 (Forwarding)
*   **逻辑**: 遍历 Snapshot 中的 `behaviors`。
*   **映射**: 
    *   如果 `to_stage` 是 "ID"，从 `from_stage` 的底部拉一条**蓝色线**到 ID 级的顶部。
    *   如果 `to_stage` 是 "EX"，拉一条**黄色线**。
    *   如果 `to_stage` 是 "MEM"，拉一条**绿色线**。

### 4.2 阻塞与气泡 (Stall & Bubble)
*   **Stall**: 如果 `pipeline["ID"]["is_stall"]` 为 `true`，在 ID 方框中心绘制 PDF 中的 **红色挂锁图标**。
*   **Bubble**: 如果某个阶段的 `is_bubble` 为 `true`，将该方框背景设为虚线或橙色，文本显示 `nop(bubble)`。

### 4.3 时间轴跳转
*   **逻辑**: UI 下方提供一个 Slider（0 到 `total_cycles`）。
*   **映射**: 滑动时调用 `get_snapshot(val)`，获取数据后重新渲染整个界面。由于数据是完整的，无需重新计算即可实现“秒开”历史状态。

### 4.4 源码同步高亮
*   **逻辑**: 每一个阶段（IF, ID, EX...）都有一个 `pc`。
*   **映射**: 
    *   查询 `SourceMap` 得到行号。
    *   在编辑器左侧用对应的颜色块标记这些行。例如，IF 级所在的行背景设为浅蓝色，ID 级设为浅紫色等。

---

## 5. 建议的 Python API 声明

```python
class Simulator:
    def __init__(self):
        self.cpu = None
        self.history: List[Dict] = []
        self.source_map: Dict[int, int] = {} # PC -> Line Number

    def assemble_and_load(self, asm_text: str) -> None:
        """调用汇编器并初始化 CPU"""
        pass

    def step(self) -> Dict:
        """步进并返回当前快照字典"""
        pass

    def get_history_at(self, cycle: int) -> Dict:
        """获取历史快照"""
        return self.history[cycle]

    def run_all(self) -> List[Dict]:
        """运行程序直到结束"""
        pass
``` 

这份文档定义了前后端协作的标准。后端负责计算所有复杂的冲突检测和状态更新，前端只需根据这个 JSON 对象进行“填色游戏”式的渲染即可。