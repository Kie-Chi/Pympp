# LW Example - Demonstrating Tuse/Tnew
# Tuse_rs = 1 (E stage for address), Tuse_rt = - (destination, not source), Tnew = 3 (W stage)

# Setup - store a value first
ori $t0, $0, 100     # $t0 = 100
sw $t0, 4($0)        # MEM[4] = 100

# Setup base address
ori $t1, $0, 4       # $t1 = 4 (base address)

# LW instruction - needs base address in E stage, result in W stage
lw $t2, 0($t1)       # $t2 = MEM[$t1 + 0] = MEM[4] = 100
                      # rs($t1) used in E for address: Tuse_rs = 1
                      # rt($t2) is destination, not source: Tuse_rt = -
                      # result from memory ready in W: Tnew = 3

# Verification
sw $t2, 8($0)        # Store loaded value