import { appConfig } from './config';
import { useState, useEffect, useCallback } from 'react';
import { loadProgram, stepCycle, stepBack, continueExec, runUntilEnd, resetSimulator, getSnapshot, getSourceMap, findCycleByPc, getCurrentCycle } from './api/client';
import { Snapshot } from './types/schema';
import InstructionInput from './components/InstructionInput';
import Controls from './components/Controls';
import PipelineVisualizer from './components/PipelineVisualizer';
import RegisterFile from './components/RegisterFile';
import MemoryView from './components/MemoryView';
import ConfigPanel from './components/ConfigPanel';
import { HelpCircle } from 'lucide-react';

const DEFAULT_ASM = `# Bubble Sort Implementation
# Initialize array in memory
ori $t0, $0, 5          # Array length
sw $t0, 0($0)           # Store length at 0x0

ori $t1, $0, 10
sw $t1, 4($0)           # arr[0] = 10
ori $t1, $0, 2
sw $t1, 8($0)           # arr[1] = 2
ori $t1, $0, 8
sw $t1, 12($0)          # arr[2] = 8
ori $t1, $0, 1
sw $t1, 16($0)          # arr[3] = 1
ori $t1, $0, 5
sw $t1, 20($0)          # arr[4] = 5

# Bubble Sort
# $s0 = array base address (4)
# $s1 = n (length)
# $t0 = i
# $t1 = j
# $t2 = inner loop limit (n-i-1)

ori $s0, $0, 4          # Base address starts at 4
lw $s1, 0($0)           # Load length
ori $t0, $0, 0          # i = 0

outer_loop:
    sub $t2, $s1, $t0   # n - i
    addi $t2, $t2, -1   # n - i - 1
    blez $t2, end_sort  # if limit <= 0, end
    
    ori $t1, $0, 0      # j = 0
    
inner_loop:
    sub $t3, $t2, $t1   # limit - j
    blez $t3, next_outer # if limit - j <= 0, next outer
    
    # Load arr[j] and arr[j+1]
    sll $t4, $t1, 2     # j * 4
    add $t4, $t4, $s0   # addr of arr[j]
    lw $t5, 0($t4)      # arr[j]
    lw $t6, 4($t4)      # arr[j+1]
    
    # Compare and swap if needed
    sub $t7, $t5, $t6   # arr[j] - arr[j+1]
    blez $t7, no_swap   # if arr[j] <= arr[j+1], no swap
    
    sw $t6, 0($t4)      # swap
    sw $t5, 4($t4)
    
no_swap:
    addi $t1, $t1, 1    # j++
    j inner_loop
    
next_outer:
    addi $t0, $t0, 1    # i++
    j outer_loop

end_sort:
    # Done
    ori $v0, $0, 10
    syscall
`;

function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [asmSource, setAsmSource] = useState(DEFAULT_ASM);
  const [sourceMap, setSourceMap] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [isAssembled, setIsAssembled] = useState(false);

  const refreshState = useCallback(async (snap?: Snapshot) => {
    try {
      if (snap) {
        setSnapshot(snap);
      } else {
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleLoad = async () => {
    setLoading(true);
    setError(null);
    try {
      await loadProgram(asmSource);
      const map = await getSourceMap();
      setSourceMap(map);
      const res = await resetSimulator();
      if (res.success) {
        setIsAssembled(true);
        const snap = await getSnapshot(0).catch(() => null);
        if (snap) setSnapshot(snap);
        else {
            setSnapshot(null);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStep = async () => {
    setLoading(true);
    try {
      const snap = await stepCycle();
      setSnapshot(snap);
    } catch (err: any) {
      setError(err.message || 'Failed to step');
    } finally {
      setLoading(false);
    }
  };

  const handleStepBack = async () => {
    setLoading(true);
    try {
        const snap = await stepBack();
        setSnapshot(snap);
    } catch (err: any) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleContinue = async () => {
    setLoading(true);
    try {
        const snap = await continueExec();
        setSnapshot(snap);
    } catch (err: any) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleRun = async () => {
    setLoading(true);
    try {
      const snaps = await runUntilEnd(1000);
      if (snaps.length > 0) {
        setSnapshot(snaps[snaps.length - 1]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to run');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await resetSimulator();
      const snap = await getSnapshot(0);
      setSnapshot(snap);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJumpCycle = async (targetCycle: number) => {
    setLoading(true);
    try {
        const snap = await getSnapshot(targetCycle);
        setSnapshot(snap);
        if (snap.outofbound) {
            console.log("Reached end of simulation");
        }
    } catch (err: any) {
        console.warn("Cycle jump failed:", err);
        if (err.message.includes("404")) {
        }
    } finally {
        setLoading(false);
    }
  };

  const handleJumpPc = async (pc: string) => {
    setLoading(true);
    try {
        // Ensure hex format for API
        if (!pc.startsWith('0x')) pc = '0x' + pc;
        // This finds the first cycle where PC enters IF
        const result = await findCycleByPc(pc);
        if (result.cycle !== null) {
            const snap = await getSnapshot(result.cycle);
            setSnapshot(snap);
        } else {
            setError(`PC ${pc} not found in execution history`);
        }
    } catch (err: any) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleStop = () => {
      setIsAssembled(false);
      setSnapshot(null);
      setError(null);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.defaultPrevented) return;

        // F5: Run / Continue
        if (e.key === 'F5') {
            e.preventDefault();
            if (isAssembled) {
                if (appConfig.controls.enableContinue) handleContinue();
            } else {
                handleLoad();
            }
        }
        // F6: Assemble / Load
        else if (e.key === 'F6') {
            e.preventDefault();
            handleLoad();
        }
        // F10: Step Forward
        else if (e.key === 'F10') {
            e.preventDefault();
            if (isAssembled && appConfig.controls.enableStep) handleStep();
        }
        // F11: Step Back
        else if (e.key === 'F11') {
            e.preventDefault();
            if (isAssembled && appConfig.controls.enableStepBack) handleStepBack();
        }
        // Esc: Stop
        else if (e.key === 'Escape') {
            e.preventDefault();
            if (appConfig.controls.enablePause) handleStop();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAssembled, handleLoad, handleStep, handleStepBack, handleContinue, handleStop]);

  // Determine current line from PC
  const currentLine = snapshot && sourceMap 
    ? sourceMap[snapshot.pc] || sourceMap[snapshot.pc.replace('0x', '').padStart(8, '0')]
    : undefined;

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden font-sans text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm z-20">
        <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
                MIPS Pipeline Simulator
            </h1>
            <div className="relative group ml-2">
                <div className="cursor-help p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                    <HelpCircle size={18} />
                </div>
                {/* Shortcuts Tooltip */}
                <div className="absolute left-full top-0 ml-3 w-48 bg-slate-800 text-white text-xs rounded-lg py-2 px-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none transform translate-y-[-10%]">
                    <div className="font-semibold mb-1 border-b border-slate-600 pb-1">Shortcuts</div>
                    <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1">
                        <span>Assemble / Load</span> <span className="font-mono text-slate-300">F6</span>
                        <span>Run / Continue</span> <span className="font-mono text-slate-300">F5</span>
                        <span>Step Forward</span> <span className="font-mono text-slate-300">F10</span>
                        <span>Step Back</span> <span className="font-mono text-slate-300">F11</span>
                        <span>Stop</span> <span className="font-mono text-slate-300">Esc</span>
                    </div>
                    {/* Arrow */}
                    <div className="absolute right-full top-4 -mr-1 border-4 border-transparent border-r-slate-800"></div>
                </div>
            </div>
        </div>
        {error && (
            <div className="text-red-600 text-sm font-medium bg-red-50 px-4 py-1.5 rounded-full border border-red-200 animate-pulse shadow-sm flex items-center gap-2">
                <span>⚠️</span> {error}
            </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 grid grid-cols-[320px_1fr_240px] gap-4 min-h-0 overflow-hidden">
          
          {/* Left Column: Input & Controls */}
          <div className="flex flex-col gap-4 min-h-0 h-full">
            <div className="flex-1 min-h-0 flex flex-col">
                <InstructionInput 
                    asmSource={asmSource} 
                    setAsmSource={setAsmSource} 
                    currentLine={currentLine}
                    disabled={isAssembled}
                />
            </div>
            <div className="flex-shrink-0">
                <Controls 
                    onAssemble={handleLoad}
                    onStep={handleStep}
                    onStepBack={handleStepBack}
                    onRun={handleRun}
                    onContinue={handleContinue}
                    onStop={handleStop}
                    onJumpCycle={handleJumpCycle}
                    onJumpPc={handleJumpPc}
                    loading={loading}
                    cycle={snapshot?.cycle || 0}
                    isAssembled={isAssembled}
                    outofbound={snapshot?.outofbound || false}
                    trigger={snapshot}
                />
            </div>
          </div>

          {/* Middle Column: Pipeline Visualization & Memory */}
          <div className="flex flex-col gap-4 min-h-0 h-full">
            <div className="h-[60%] min-h-[300px] flex-shrink-0">
                <PipelineVisualizer snapshot={snapshot} />
            </div>
            <div className="flex-1 min-h-0">
                <MemoryView 
                    memory={snapshot?.memory} 
                    cycle={snapshot?.cycle || 0} 
                    writtenAddresses={snapshot?.events?.memory_written}
                    memoryChanges={snapshot?.events?.memory_changes}
                />
            </div>
          </div>

          {/* Right Column: Registers */}
          <div className="min-h-0 h-full">
            <RegisterFile 
                registers={snapshot?.registers} 
                writtenRegisters={snapshot?.events?.registers_written}
                registerChanges={snapshot?.events?.register_changes}
            />
          </div>

      </main>
      
      {/* Configuration Panel */}
      <ConfigPanel />
    </div>
  );
}

export default App;
