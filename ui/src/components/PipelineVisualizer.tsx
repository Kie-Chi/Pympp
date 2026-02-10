import React, { useRef, useEffect, useState } from 'react';
import { Snapshot } from '../types/schema';

interface Props {
  snapshot: Snapshot | null;
}

const STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'];

// Map stage name to index for calculating positions
const STAGE_INDEX: Record<string, number> = {
    'IF': 0, 'ID': 1, 'EX': 2, 'MEM': 3, 'WB': 4
};

const PipelineVisualizer: React.FC<Props> = ({ snapshot }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Update dimensions on resize
  useEffect(() => {
    // If containerRef is not yet attached, we might need to retry or depend on something.
    // However, with the structural change, it should be attached on first render.
    // Just to be safe, we can add containerRef.current to deps or use a callback ref, 
    // but React refs don't trigger re-renders.
    // Let's rely on the fact that we now render the ref-div in all paths.
    
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
            if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        }
    });

    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, [snapshot]); // Re-run if snapshot changes (e.g. from null to object, though structure is stable now)

  if (!snapshot || !snapshot.pipeline) {
    return (
      <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm overflow-visible relative">
          <div className="bg-slate-50 px-4 py-3 border-b border-gray-200 font-semibold text-slate-700 text-center z-10 rounded-t-lg">
            Pipeline
          </div>
          <div className="flex-1 flex items-center justify-center text-slate-400 font-medium" ref={containerRef}>
            Pipeline Empty
          </div>
      </div>
    );
  }

  // Calculate coordinates for a stage center
  const getStageCenter = (stageName: string) => {
      const idx = STAGE_INDEX[stageName];
      if (idx === undefined) return { x: 0, y: 0 };
      
      // 5 columns take up 100% width.
      // Centers are at 10%, 30%, 50%, 70%, 90%
      
      return {
          x: dimensions.width * (0.1 + idx * 0.2),
          y: dimensions.height * 0.5 // Move down to middle of pillars
      };
  };

  const renderForwardingLines = () => {
      if (!snapshot.events?.forwarding || snapshot.events.forwarding.length === 0 || dimensions.width === 0) return null;

      return (
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-[50] overflow-visible">
              <defs>
                  <marker id="arrow-blue" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                      <path d="M0,0 L0,6 L9,3 z" fill="#3b82f6" />
                  </marker>
                  <marker id="arrow-yellow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                      <path d="M0,0 L0,6 L9,3 z" fill="#eab308" />
                  </marker>
                  <marker id="arrow-green" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                      <path d="M0,0 L0,6 L9,3 z" fill="#22c55e" />
                  </marker>
              </defs>
              {snapshot.events.forwarding.map((fwd, i) => {
                  const start = getStageCenter(fwd.from_stage);
                  const end = getStageCenter(fwd.to_stage);
                  
                  // Adjust Y to avoid overlap
                  // Use a larger arc for farther distances
                  const dist = Math.abs(start.x - end.x);
                  const direction = start.x < end.x ? 1 : -1;
                  
                  // Start/End points
                  const startY = start.y + 20; 
                  const endY = end.y + 20;
                  
                  // Control point for quadratic bezier (above the line)
                  // Go up (negative Y)
                  const controlY = Math.min(startY, endY) - (dist * 0.3) - 40 - (i * 20);
                  const controlX = (start.x + end.x) / 2;

                  let color = '#94a3b8'; // Default slate
                  let marker = '';
                  
                  // Color coding based on destination
                  if (fwd.to_stage === 'ID') {
                      color = '#3b82f6'; // Blue
                      marker = 'url(#arrow-blue)';
                  } else if (fwd.to_stage === 'EX') {
                      color = '#eab308'; // Yellow
                      marker = 'url(#arrow-yellow)';
                  } else if (fwd.to_stage === 'MEM') {
                      color = '#22c55e'; // Green
                      marker = 'url(#arrow-green)';
                  }

                  const pathData = `M ${start.x} ${startY} Q ${controlX} ${controlY} ${end.x} ${endY}`;

                  return (
                      <g key={i}>
                          <path 
                              d={pathData} 
                              fill="none" 
                              stroke={color} 
                              strokeWidth="3" 
                              markerEnd={marker}
                              className="drop-shadow-md opacity-90 transition-all duration-500 ease-in-out"
                              strokeDasharray="5,0"
                          />
                          {/* Label for register - positioned on the line near start */}
                          <g transform={`translate(${controlX}, ${controlY})`}> 
                            <rect 
                                x="-14" 
                                y="-10" 
                                width="28" 
                                height="20" 
                                rx="4" 
                                fill="white" 
                                stroke={color}
                                strokeWidth="1"
                                className="shadow-sm"
                            />
                            <text 
                                x="0" 
                                y="4" 
                                textAnchor="middle" 
                                fill={color} 
                                fontSize="11" 
                                fontWeight="bold"
                                className="font-mono"
                            >
                                ${fwd.reg}
                            </text>
                          </g>
                      </g>
                  );
              })}
          </svg>
      );
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm overflow-visible relative">
      <div className="bg-slate-50 px-4 py-3 border-b border-gray-200 font-semibold text-slate-700 text-center z-10 rounded-t-lg">
        Pipeline
      </div>
      
      {/* Container for pillars */}
      <div className="flex-1 p-6 relative" ref={containerRef}>
          {renderForwardingLines()}
          
          <div className="grid grid-cols-5 gap-6 h-full items-stretch relative z-10">
            {STAGES.map((stage) => {
            const info = snapshot.pipeline[stage as keyof typeof snapshot.pipeline];
            const isStall = info?.is_stall;
            const isBubble = info?.is_bubble;
            
            return (
                <div key={stage} className="flex flex-col h-full relative group">
                {/* Vertical Bar */}
                <div className={`flex-1 rounded-t-lg border-x border-t shadow-sm transition-all duration-300 relative flex flex-col min-w-0
                    ${isStall 
                        ? 'bg-red-50 border-red-200' 
                        : isBubble 
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-blue-50 border-blue-200'
                    }
                `}>
                    {/* Content inside bar */}
                    <div className="p-1 flex flex-col gap-2 items-center text-center mt-8 w-full">
                        {info ? (
                            <>
                                <div className="text-[10px] font-mono text-slate-500 bg-white/60 px-1 rounded border border-white/50 w-full truncate">
                                    {info.pc}
                                </div>
                                <div className={`text-xs font-bold break-words w-full px-1 py-1 rounded bg-white/40
                                    ${isStall ? 'text-red-700' : isBubble ? 'text-amber-700' : 'text-blue-700'}
                                `}>
                                    {info.instr}
                                </div>
                                
                                {/* Flags */}
                                <div className="flex flex-col gap-1 mt-auto mb-4 w-full px-2">
                                    {isStall && (
                                        <div className="flex items-center justify-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded border border-red-200 shadow-sm animate-pulse">
                                            <span className="text-xs font-bold uppercase tracking-wider">STALL</span>
                                        </div>
                                    )}
                                    {isBubble && (
                                        <span className="text-xs bg-amber-100 text-amber-700 px-1 py-0.5 rounded border border-amber-200 font-bold uppercase tracking-wider">
                                            BUBBLE
                                        </span>
                                    )}
                                </div>
                            </>
                        ) : (
                            <span className="text-slate-300 italic text-sm mt-10">Empty</span>
                        )}
                    </div>
                </div>
                
                {/* Stage Label (Bottom) */}
                <div className="bg-slate-800 text-white text-center py-2 font-bold text-lg rounded-b-lg shadow-md z-10 border-t border-slate-700">
                    {stage}
                </div>
                </div>
            );
            })}
        </div>
      </div>
    </div>
  );
};

export default PipelineVisualizer;
