# P6_JALX

<table style="border-collapse:collapse; width: 500pt;">
    <tr>
        <td id="td-head" rowspan="3">
            编码
        </td>
        <td id="td-opcode-top">
            <span style="float: left;">31</span>
            <span style="float: right;">26</span>
        </td>
        <td id="td-rs-top">
            <span style="float: left;">25</span>
            <span style="float: right;">21</span>
        </td>
        <td id="td-rt-top">
            <span style="float: left;">20</span>
            <span style="float: right;">16</span>
        </td>
        <td id="td-imm-top">
            <span style="float: left;">15</span>
            <span style="float: right;">0</span>
        </td>
    </tr>
    <tr>
        <td id="td-opcode">
            jalx<br />
            011000
        </td>
        <td id="td-rs">rs</td>
        <td id="td-rt">rt</td>
        <td id="td-imm">
            offset
        </td>
    </tr>
    <tr>
        <td id="td-opcode-bottom">
            6
        </td>
        <td id="td-rs-bottom">
            5
        </td>
        <td id="td-rt-bottom">
            5
        </td>
        <td id="td-imm-bottom">
            16
        </td>
    </tr>
    <tr>
        <td id="td-head">
            格式
        </td>
        <td colspan="6">
            <p id="p-code">
                jalx rs, rt, offset
            </p>
        </td>
    </tr>
    <tr>
        <td id="td-head">
            描述
        </td>
        <td colspan="6">
            <p id="p-code">将 GPR[rs] 与 GPR[rt] 进行异或运算后取低 5 位，令 x 为小于等于这个数的最大完全平方数，无条件跳转到 PC + 4 + sign_extend(offset||0<sup>2</sup>)，并且将 PC + 8 存进 GPR[x] 中。</p>
        </td>
    </tr>
    <tr>
        <td id="td-head">
            操作
        </td>
        <td colspan="6">
            <p id="p-code">Is_Perfect_Square(x): 判断 x 是否为完全平方数</p>
            <p id="p-code">
                temp ← GPR[rs] ^ GPR[rt]
            </p>
            <p id="p-code">
                x ← temp<sub>4..0</sub>
            </p>
            <p id="p-code">while not Is_Perfect_Square(x) do</p>
            <p id="p-code" style="text-indent: 2em">x ← x - 1</p>
            <p id="p-code">end</p>
            <p id="p-code">GPR[x] ← PC + 8 </p>
            <p id="p-code" >PC ← PC + 4 + sign_extend(offset || 0<sup>2</sup>)</p>
        </td>
    </tr>
    <tr>
        <td id="td-head">
            示例
        </td>
        <td colspan="6">
            <p id="p-code">
                jalx $t1, $t2, label
            </p>
        </td>
    </tr>
    <tr>
        <td id="td-head">
            其他
        </td>
        <td colspan="6">
            <p id="p-text">
                采用无符号比较。
            </p>
            <p id="p-text">
                完全平方数：若存在整数 n，使得某个数 S = n * n = n <sup>2</sup>，则 S 为完全平方数。
            </p>
        </td>
    </tr>
</table>

