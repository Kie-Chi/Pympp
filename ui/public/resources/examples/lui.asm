# LUI Example - Demonstrating Tuse/Tnew
# Tuse_rs = - (not used), Tuse_rt = - (not used), Tnew = 2 (M stage)

# LUI instruction - no register operands for computation
lui $t0, 0x1234      # $t0 = 0x12340000 (load upper immediate)
                      # No rs register: Tuse_rs = -
                      # No rt register (as source): Tuse_rt = -
                      # result ready in M: Tnew = 2

# Verification - combine with ORI to show usefulness
ori $t0, $t0, 0x5678 # $t0 = 0x12345678
sw $t0, 0($0)        # Store result