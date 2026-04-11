# JAL Example - Demonstrating Tuse/Tnew
# Tuse_rs = - (not used), Tuse_rt = - (not used), Tnew = 1 (E stage)

# JAL instruction - jumps and saves return address
jal func             # $ra = PC + 8, jump to 'func'
                      # No rs register: Tuse_rs = -
                      # No rt register: Tuse_rt = -
                      # $ra written in E: Tnew = 1

# After function return
sw $v0, 0($0)        # Store return value
j end

func:
ori $v0, $0, 42      # Set return value = 42
jr $ra               # Return

end:
nop