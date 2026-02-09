import subprocess
import tempfile
import os
from pathlib import Path
from typing import List, Dict, Tuple

try:
    MARS_JAR_PATH = (Path(__file__).resolve().parent.parent / "resource" / "mars.jar").as_posix()
except NameError:
    MARS_JAR_PATH = (Path(".").resolve() / "pympp" / "resource" / "mars.jar").as_posix()


def assemble_with_mars(asm_source: str) -> List[int]:
    """
    Assembles MIPS source code using an external mars.jar process.
    """
    if not Path(MARS_JAR_PATH).exists():
        raise FileNotFoundError(f"mars.jar not found at expected path: {MARS_JAR_PATH}")

    tmp_in_path = ""
    tmp_out_path = ""
    try:
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix=".asm", encoding='utf-8') as tmp_in:
            tmp_in.write(asm_source)
            tmp_in_path = tmp_in.name

        with tempfile.NamedTemporaryFile(mode='r', delete=False, suffix=".txt") as tmp_out:
            tmp_out_path = tmp_out.name

        command = [
            "java",
            "-jar",
            MARS_JAR_PATH,
            "a",            # Assemble only
            "dump",         # Dump memory contents
            ".text",        # The text segment
            "HexText",      # In hexadecimal text format
            tmp_out_path,   # Output file
            tmp_in_path     # Input file
        ]
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        with open(tmp_out_path, 'r') as f:
            machine_codes = [int(line.strip(), 16) for line in f if line.strip()]

        return machine_codes

    except FileNotFoundError:
        raise RuntimeError("Java is not installed or not in the system's PATH.")
    except subprocess.CalledProcessError as e:
        raise ValueError(f"MARS Assembly Error:\n{e.stderr}")
    finally:
        if tmp_in_path and os.path.exists(tmp_in_path):
            os.unlink(tmp_in_path)
        if tmp_out_path and os.path.exists(tmp_out_path):
            os.unlink(tmp_out_path)

def get_source_map(asm_source: str) -> Dict[str, int]:
    """
    A simple parser to create a PC-to-line-number map.
    This does NOT need to understand all instructions, just labels and lines.
    """
    source_map = {}
    labels = {}
    lines = asm_source.splitlines()
    
    current_pc = 0x3000
    for line in lines:
        line = line.split("#")[0].strip()
        if not line:
            continue
        if ":" in line:
            parts = line.split(":")
            label = parts[0].strip()
            labels[label] = current_pc
            if len(parts) > 1 and parts[1].strip():
                 current_pc += 4
        else:
            current_pc += 4
    current_pc = 0x3000
    for line_num, line_content in enumerate(lines, 1):
        line = line_content.split("#")[0].strip()
        if not line:
            continue
        has_instruction = False
        if ":" in line:
            parts = line.split(":", 1)
            if parts[1].strip():
                has_instruction = True
        else:
            has_instruction = True
            
        if has_instruction:
            source_map[f"{current_pc:08x}"] = line_num
            source_map[hex(current_pc)] = line_num
            current_pc += 4
            
    return source_map

def assemble(asm_source: str) -> Tuple[List[int], Dict[str, int]]:
    """
    The main assembly function using the hybrid approach.
    """
    machine_codes = assemble_with_mars(asm_source)
    source_map = get_source_map(asm_source)
    return machine_codes, source_map
