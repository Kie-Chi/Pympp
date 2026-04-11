# BEQ Example - Demonstrating Tuse/Tnew
# Tuse_rs = 0 (D stage), Tuse_rt = 0 (D stage), Tnew = - (no result)

# Setup - prepare values to compare
ori $t0, $0, 5       # $t0 = 5
ori $t1, $0, 5       # $t1 = 5 (same as $t0)

# BEQ instruction - needs both registers in D stage for branch decision
beq $t0, $t1, equal  # if $t0 == $t1, branch to 'equal'
                      # rs($t0) needed in D for comparison: Tuse_rs = 0
                      # rt($t1) needed in D for comparison: Tuse_rt = 0
                      # No result written: Tnew = -

# Not equal path (won't execute in this case)
ori $t2, $0, 0       # $t2 = 0 (not equal)
j end

equal:
ori $t2, $0, 1       # $t2 = 1 (equal!)

end:
sw $t2, 0($0)        # Store result (should be 1)