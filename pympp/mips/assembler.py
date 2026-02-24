import re
from typing import Dict, List, Tuple, Optional, Type
from .isa import Instruction, INSTRUCTION_REGISTRY

ASSEMBLER_REGISTRY: Dict[str, Type[Instruction]] = {}


def _register_all_instructions():
    """Register all instructions from INSTRUCTION_REGISTRY that have assembler metadata"""
    for instr_cls in INSTRUCTION_REGISTRY.values():
        if hasattr(instr_cls, '_asm_mnemonic') and hasattr(instr_cls, '_asm_template') and hasattr(instr_cls, '_asm_encoding'):
            mnemonic = instr_cls._asm_mnemonic
            if mnemonic:
                ASSEMBLER_REGISTRY[mnemonic.lower()] = instr_cls


def register_assembler(mnemonic: str):
    """Decorator to register instruction assembler metadata"""
    def wrapper(cls):
        ASSEMBLER_REGISTRY[mnemonic.lower()] = cls
        return cls
    return wrapper

class AssemblerError(Exception):
    """Exception raised for assembly errors"""
    pass


class Assembler:
    """MIPS Assembler that converts assembly code to machine code"""
    
    def __init__(self):
        self.labels: Dict[str, int] = {}
        self.instructions: List[Tuple[int, str]] = []  # (address, instruction)
        
    def _parse_register(self, reg_str: str) -> int:
        """Parse register string to register number"""
        reg_str = reg_str.strip()        
        if reg_str.startswith('$'):
            reg_str = reg_str[1:]
        reg_map = {
            'zero': 0, 'at': 1,
            'v0': 2, 'v1': 3,
            'a0': 4, 'a1': 5, 'a2': 6, 'a3': 7,
            't0': 8, 't1': 9, 't2': 10, 't3': 11, 't4': 12, 't5': 13, 't6': 14, 't7': 15,
            's0': 16, 's1': 17, 's2': 18, 's3': 19, 's4': 20, 's5': 21, 's6': 22, 's7': 23,
            't8': 24, 't9': 25,
            'k0': 26, 'k1': 27,
            'gp': 28, 'sp': 29, 'fp': 30, 'ra': 31
        }
        
        if reg_str.lower() in reg_map:
            return reg_map[reg_str.lower()]        
        try:
            reg_num = int(reg_str)
            if 0 <= reg_num <= 31:
                return reg_num
        except ValueError:
            pass
        
        raise AssemblerError(f"Invalid register: ${reg_str}")
    
    def _parse_immediate(self, imm_str: str, pc: int = 0, is_branch: bool = False) -> int:
        """Parse immediate value or label"""
        imm_str = imm_str.strip()
        
        if is_branch and imm_str in self.labels:
            target_addr = self.labels[imm_str]
            offset = (target_addr - (pc + 4)) >> 2  # Branch offset is in words
            return offset & 0xFFFF
        elif imm_str in self.labels:
            return self.labels[imm_str]
        
        if imm_str.startswith('0x'):
            return int(imm_str, 16)
        elif imm_str.startswith('0b'):
            return int(imm_str, 2)
        else:
            return int(imm_str)
    
    def _encode_instruction(self, instr_cls: Type[Instruction], parts: List[str], pc: int) -> int:
        """Encode instruction based on its template and encoding pattern"""
        if not hasattr(instr_cls, '_asm_template') or not hasattr(instr_cls, '_asm_encoding'):
            raise AssemblerError(f"Instruction {instr_cls.__name__} lacks assembler metadata")
        
        template = instr_cls._asm_template
        encoding = instr_cls._asm_encoding
        instr_type = instr_cls._asm_type        
        operands = self._parse_operands(parts[1:], template, pc, instr_type)        
        machine_code = self._build_machine_code(encoding, operands)
        
        return machine_code
    
    def _parse_operands(self, parts: List[str], template: str, pc: int, instr_type: str) -> Dict[str, int]:
        """Parse operands from instruction parts based on template"""
        operands = {}        
        if not template or template.strip() == '':
            return operands
        
        template_parts = [p.strip() for p in re.split(r'[,()]', template) if p.strip()]
        
        if instr_type == 'J':
            if parts:
                label_or_addr = parts[0].strip()
                if label_or_addr in self.labels:
                    # It's a label - convert to 26-bit address
                    target_addr = self.labels[label_or_addr]
                    operands['i'] = (target_addr >> 2) & 0x3FFFFFF
                else:
                    # It's a numeric address
                    addr = self._parse_immediate(label_or_addr, pc)
                    operands['i'] = (addr >> 2) & 0x3FFFFFF
            return operands
        
        # Handle special cases for lw/sw format: offset($base)
        if '(' in template:
            # Format like: "lw $rt, offset($rs)"
            if len(parts) >= 2:
                # First part is the rt register
                operands['t'] = self._parse_register(parts[0])
                
                # Second part is offset($rs)
                match = re.match(r'(-?(?:0x)?[0-9a-fA-F]+|\w+)\(\$?(\w+)\)', parts[1])
                if match:
                    offset_str, base_reg = match.groups()
                    operands['s'] = self._parse_register(base_reg)
                    operands['i'] = self._parse_immediate(offset_str, pc) & 0xFFFF
                else:
                    raise AssemblerError(f"Invalid memory operand format: {parts[1]}")
        else:
            # Normal comma-separated format
            for i, (part, template_param) in enumerate(zip(parts, template_parts)):
                part = part.strip()
                
                if template_param.startswith('$'):
                    # It's a register
                    reg_type = template_param[1:3] if len(template_param) > 2 else template_param[1]
                    
                    if reg_type.startswith('rd'):
                        operands['d'] = self._parse_register(part)
                    elif reg_type.startswith('rs'):
                        operands['s'] = self._parse_register(part)
                    elif reg_type.startswith('rt'):
                        operands['t'] = self._parse_register(part)
                elif template_param == 'label':
                    # It's a label for branch
                    is_branch = instr_type == 'B'
                    operands['i'] = self._parse_immediate(part, pc, is_branch) & 0xFFFF
                elif template_param == 'shamt':
                    # It's a shift amount (5 bits)
                    operands['h'] = self._parse_immediate(part, pc) & 0x1F
                elif template_param == 'imm':
                    # It's an immediate value
                    operands['i'] = self._parse_immediate(part, pc) & 0xFFFF
                else:
                    # Default: treat as immediate
                    operands['i'] = self._parse_immediate(part, pc) & 0xFFFF
        
        return operands
    
    def _build_machine_code(self, encoding: str, operands: Dict[str, int]) -> int:
        """Build machine code from encoding pattern and operands"""
        # encoding format: "000000 sssss ttttt ddddd hhhhh 100000"
        # d/s/t/i/h represent different operand fields        
        encoding = encoding.replace(' ', '')
        field_widths = {}
        for char in 'dstih':
            if char in encoding:
                field_widths[char] = encoding.count(char)
        
        machine_code = 0
        bit_pos = 31
        processed = {char: 0 for char in 'dstih'}  # Track how many bits processed for each field
        
        for char in encoding:
            if char in '01':
                # Fixed bit
                if char == '1':
                    machine_code |= (1 << bit_pos)
                bit_pos -= 1
            elif char in operands:
                operand_val = operands[char]
                field_width = field_widths[char]                
                bit_index = processed[char]
                processed[char] += 1
                bit_value = (operand_val >> (field_width - bit_index - 1)) & 1
                if bit_value:
                    machine_code |= (1 << bit_pos)
                
                bit_pos -= 1
            else:
                # Unknown character, treat as 0
                bit_pos -= 1
        
        return machine_code
    
    def assemble_line(self, line: str, pc: int = 0) -> Optional[int]:
        """Assemble a single line of assembly code"""
        # Remove comments
        line = re.sub(r'#.*$', '', line).strip()
        
        if not line:
            return None        
        if ':' in line:
            label_match = re.match(r'(\w+):\s*(.*)', line)
            if label_match:
                label, rest = label_match.groups()
                self.labels[label] = pc
                line = rest.strip()
                if not line:
                    return None
        match = re.match(r'(\w+)\s+(.*)', line)
        if not match:
            parts = [line.strip().lower()]
        else:
            mnemonic, operands_str = match.groups()
            parts = [mnemonic.lower()]            
            operand_parts = []
            current = ''
            paren_depth = 0
            
            for char in operands_str:
                if char == ',' and paren_depth == 0:
                    if current.strip():
                        operand_parts.append(current.strip())
                    current = ''
                else:
                    if char == '(':
                        paren_depth += 1
                    elif char == ')':
                        paren_depth -= 1
                    current += char
            
            if current.strip():
                operand_parts.append(current.strip())
            
            parts.extend(operand_parts)
        
        if not parts:
            return None
        
        mnemonic = parts[0]        
        instr_cls = ASSEMBLER_REGISTRY.get(mnemonic)
        if not instr_cls:
            raise AssemblerError(f"Unknown instruction '{mnemonic}': {line}")
        
        # Encode the instruction
        try:
            machine_code = self._encode_instruction(instr_cls, parts, pc)
        except Exception as e:
            raise AssemblerError(f"Error encoding '{line}': {str(e)}") from e
        
        return machine_code
    
    def assemble(self, source: str, start_address: int = 0x00003000) -> List[int]:
        """
        Assemble complete MIPS source code
        
        Args:
            source: MIPS assembly source code
            start_address: Starting address for code
            
        Returns:
            List of machine code instructions
        """
        lines = source.split('\n')
        
        # First pass: collect labels
        self.labels = {}
        self.instructions = []
        pc = start_address
        
        for line in lines:
            # Remove comments
            line = re.sub(r'#.*$', '', line).strip()
            if not line:
                continue
            
            # Check for label
            if ':' in line:
                label_match = re.match(r'(\w+):\s*(.*)', line)
                if label_match:
                    label, rest = label_match.groups()
                    self.labels[label] = pc
                    line = rest.strip()
                    if not line:
                        continue
            
            self.instructions.append((pc, line))
            pc += 4
        
        # Second pass: assemble instructions
        machine_code = []
        for pc, line in self.instructions:
            code = self.assemble_line(line, pc)
            if code is not None:
                machine_code.append(code)
        
        return machine_code


def assemble(source: str, start_address: int = 0x00003000) -> List[int]:
    """
    Convenience function to assemble MIPS source code
    
    Args:
        source: MIPS assembly source code
        start_address: Starting address for code
        
    Returns:
        List of machine code instructions (as integers)
    """
    assembler = Assembler()
    return assembler.assemble(source, start_address)
