# JR Example - Demonstrating Tuse/Tnew
# Tuse_rs = 0 (D stage), Tuse_rt = - (not used), Tnew = - (no result)

# Setup - prepare return address simulation
lui $ra, 0x3000      # $ra = 0x30000000 (simulate return address)
ori $ra, $ra, 0x20   # $ra = 0x30000020

# JR instruction - needs rs in D stage for jump target
jr $ra               # Jump to address in $ra
                      # rs($ra) needed in D for jump: Tuse_rs = 0
                      # No rt register: Tuse_rt = -
                      # No result written: Tnew = -

# This code won't execute after jr
ori $t0, $0, 99
sw $t0, 0($0)