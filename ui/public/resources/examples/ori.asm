# ORI Example - Demonstrating Tuse/Tnew
# Tuse_rs = 1 (E stage), Tuse_rt = - (not used), Tnew = 2 (M stage)

# Setup
ori $t0, $0, 0xFF    # $t0 = 255

# ORI instruction - only needs rs in E stage
ori $t1, $t0, 0x0F   # $t1 = $t0 | 0x0F = 255 | 15 = 255
                      # rs($t0) used in E: Tuse_rs = 1
                      # rt is immediate, not register: Tuse_rt = -
                      # result ready in M: Tnew = 2

# Verification
sw $t1, 0($0)        # Store result