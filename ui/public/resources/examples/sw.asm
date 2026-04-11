# SW Example - Demonstrating Tuse/Tnew
# Tuse_rs = 1 (E stage for address), Tuse_rt = 2 (M stage for data), Tnew = - (no result)

# Setup - prepare data to store
ori $t0, $0, 42      # $t0 = 42 (data to store)
ori $t1, $0, 16      # $t1 = 16 (base address)

# SW instruction - needs address in E, data in M, no result
sw $t0, 0($t1)       # MEM[$t1 + 0] = MEM[16] = $t0 = 42
                      # rs($t1) used in E for address: Tuse_rs = 1
                      # rt($t0) used in M for data: Tuse_rt = 2
                      # No result written: Tnew = -

# Verification
lw $t2, 16($0)       # Load back to verify
sw $t2, 20($0)       # Store verification result