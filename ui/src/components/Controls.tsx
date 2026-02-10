import React, { useState, useEffect } from 'react';
import { Wrench, Play, SkipForward, RotateCcw, Square, ArrowRight, StepBack, ToggleLeft, ToggleRight } from 'lucide-react';

interface Props {
  onAssemble: () => void;
  onStep: () => void;
  onStepBack: () => void;
  onRun: () => void;
  onContinue: () => void;
  onStop: () => void;
  onJumpCycle: (cycle: number) => void;
  onJumpPc: (pc: string) => void;
  loading: boolean;
  cycle: number;
  isAssembled: boolean;
  outofbound?: boolean;
  trigger?: any;
}

const Controls: React.FC<Props> = ({ 
  onAssemble, onStep, onStepBack, onRun, onContinue, onStop, onJumpCycle, onJumpPc, loading, cycle, isAssembled, outofbound, trigger 
}) => {
  const [targetCycle, setTargetCycle] = useState<string>('');
  const [targetPc, setTargetPc] = useState<string>('');
  const [sliderValue, setSliderValue] = useState<number>(cycle);
  const [detailMode, setDetailMode] = useState(false);

  // Sync slider with cycle prop
  useEffect(() => {
      if (cycle !== sliderValue) {
          setSliderValue(cycle);
      }
  }, [cycle]);

  // Handle outofbound reset
  useEffect(() => {
    if (outofbound && sliderValue > cycle) {
        setSliderValue(cycle);
    }
  }, [trigger, outofbound, cycle, sliderValue]);


  // Debounce helper
  useEffect(() => {
    const timer = setTimeout(() => {
        if (sliderValue !== cycle) {
            onJumpCycle(sliderValue);
        }
    }, 100); // 100ms debounce
    return () => clearTimeout(timer);
  }, [sliderValue]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = parseInt(e.target.value);
      // Optional: Visual clamp if we know max?
      setSliderValue(val);
  };

  const handleSliderCommit = () => {
      if (sliderValue !== cycle) {
          onJumpCycle(sliderValue);
      }
  };

  return (
    <div className="bg-white p-2 border border-gray-200 rounded-lg shadow-sm flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center gap-1 justify-center bg-slate-50 p-1 rounded-md border border-gray-100 flex-wrap">
        {!isAssembled ? (
             <button 
                onClick={onAssemble}
                disabled={loading}
                title="Assemble"
                className="p-2 text-blue-600 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50"
             >
                <Wrench size={20} />
             </button>
        ) : (
            <>
                <div className="flex items-center gap-0.5">
                    <button 
                        onClick={onStepBack}
                        disabled={loading || cycle <= 0}
                        title="Step Back"
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
                    >
                        <StepBack size={20} />
                    </button>
                    <button 
                        onClick={onStep} 
                        disabled={loading}
                        title="Step Forward"
                        className="p-2 text-green-600 hover:bg-green-100 rounded-md transition-colors disabled:opacity-50"
                    >
                        <div className="relative">
                            <Play size={20} />
                            <span className="absolute -right-1 -bottom-1 text-[8px] font-bold bg-white rounded-full px-0.5 border border-green-600 leading-none">1</span>
                        </div>
                    </button>
                </div>
                
                <div className="w-px h-6 bg-gray-200 mx-1"></div>

                <button 
                    onClick={onContinue} 
                    disabled={loading}
                    title="Continue"
                    className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors disabled:opacity-50"
                >
                    <SkipForward size={20} />
                </button>

                <button 
                    onClick={onRun} 
                    disabled={loading}
                    title="Run Until End"
                    className="p-2 text-purple-600 hover:bg-purple-100 rounded-md transition-colors disabled:opacity-50"
                >
                    <Play size={20} />
                </button>
                <div className="w-px h-6 bg-gray-200 mx-1"></div>
                <button 
                    onClick={onStop} 
                    disabled={loading}
                    title="Stop"
                    className="p-2 text-red-600 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50"
                >
                    <Square size={20} fill="currentColor" className="scale-75" />
                </button>
            </>
        )}
        
        <div className="w-px h-6 bg-gray-200 mx-1"></div>
        <button
            onClick={() => setDetailMode(!detailMode)}
            title="Detail Mode"
            className={`p-2 rounded-md transition-colors ${detailMode ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'}`}
        >
             {detailMode ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
        </button>
      </div>

      {/* Cycle Info */}
      {isAssembled && (
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono border border-slate-200">
              Cycle: {cycle}
          </span>
        </div>
      )}

      {/* Navigation (Only show when assembled) */}
      {isAssembled && (
        <div className="border-t border-gray-100 pt-2 space-y-2">
            {/* Cycle Slider */}
            <div className="px-1 pt-1 pb-2">
                <input 
                    type="range" 
                    min="0" 
                    max={Math.max(cycle * 2, 100)} 
                    value={sliderValue} 
                    onChange={handleSliderChange}
                    disabled={loading}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>0</span>
                    <span className="font-bold text-blue-600">{sliderValue}</span>
                    <span>{Math.max(cycle * 2, 100)}</span>
                </div>
            </div>

            <div className="flex gap-2 items-center">
            <input 
                type="text" 
                placeholder="PC (hex)" 
                value={targetPc}
                onChange={(e) => setTargetPc(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <button 
                onClick={() => onJumpPc(targetPc)}
                className="p-1 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-100"
                title="Go to PC"
            >
                <ArrowRight size={14} />
            </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default Controls;
