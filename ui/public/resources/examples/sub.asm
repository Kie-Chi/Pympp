# SUB Example - Demonstrating Tuse/Tnew
# Tuse_rs = 1 (E stage), Tuse_rt = 1 (E stage), Tnew = 2 (M stage)

# Setup
ori $t0, $0, 30      # $t0 = 30
ori $t1, $0, 10      # $t1 = 10

# SUB instruction - needs rs and rt in E stage
sub $t2, $t0, $t1    # $t2 = $t0 - $t1 = 20
                      # rs($t0) used in E: Tuse_rs = 1
                      # rt($t1) used in E: Tuse_rt = 1
                      # result ready in M: Tnew = 2

# Verification
sw $t2, 0($0)        # Store result