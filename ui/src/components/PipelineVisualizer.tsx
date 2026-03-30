import React, { useRef, useEffect, useState } from 'react';
import { Snapshot } from '../types/schema';
import { appConfig } from '../config';

interface Props {
    snapshot: Snapshot | null;
    detailMode?: boolean;
}

const STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'];

// Map stage name to index for calculating positions
const STAGE_INDEX: Record<string, number> = {
    'IF': 0, 'ID': 1, 'EX': 2, 'MEM': 3, 'WB': 4
};

// Parse instruction string with |w (write) and |r (read) markers
const parseInstructionWithMarkers = (instr: string) => {
    const regex = /(\$\d+)\|(w|r)/g;
    const parts: Array<{ text: string; color?: 'red' | 'green' }> = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(instr)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ text: instr.substring(lastIndex, match.index) });
        }
        const registerNum = match[1];
        const marker = match[2];
        parts.push({
            text: registerNum,
            color: marker === 'w' ? 'red' : 'green'
        });
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < instr.length) {
        parts.push({ text: instr.substring(lastIndex) });
    }

    return parts;
};

const PipelineVisualizer: React.FC<Props> = ({ snapshot, detailMode = false }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver(() => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                setDimensions({
                    width: rect.width,
                    height: rect.height
                });
            }
        });

        observer.observe(containerRef.current);

        return () => observer.disconnect();
    }, [snapshot]);

    if (!snapshot || !snapshot.pipeline) {
        return (
            <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden relative">
                <div className="bg-slate-50 px-4 py-3 border-b border-gray-200 font-semibold text-slate-700 text-center z-10 rounded-t-lg flex-shrink-0">
                    Pipeline
                </div>
                <div className="flex-1 flex items-center justify-center text-slate-400 font-medium" ref={containerRef}>
                    Pipeline Empty
                </div>
            </div>
        );
    }

    const getStageCenter = (stageName: string) => {
        const idx = STAGE_INDEX[stageName];
        if (idx === undefined) return { x: 0, y: 0 };

        const PADDING = 24;
        const contentWidth = dimensions.width - 2 * PADDING;

        return {
            x: PADDING + contentWidth * (0.1 + idx * 0.2),
            y: dimensions.height * 0.5
        };
    };

    const renderForwardingLines = () => {
        if (!appConfig.ui.enableForwardingVisualization) return null;
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
                    const dist = Math.abs(start.x - end.x);
                    const PADDING = 24;

                    // 精确计算黑色标签的高度：py-2 (16px) + text-lg line-height (28px) + border-t (1px) = 45px
                    const BLACK_LABEL_HEIGHT = 45;

                    const startY = dimensions.height - PADDING - BLACK_LABEL_HEIGHT;
                    const endY = dimensions.height - PADDING - BLACK_LABEL_HEIGHT;
                    const controlY = startY - (dist * 0.25) - 60 - (i * 20);
                    const controlX = (start.x + end.x) / 2;

                    let color = '#94a3b8';
                    let marker = '';

                    if (fwd.to_stage === 'ID') {
                        color = '#3b82f6';
                        marker = 'url(#arrow-blue)';
                    } else if (fwd.to_stage === 'EX') {
                        color = '#eab308';
                        marker = 'url(#arrow-yellow)';
                    } else if (fwd.to_stage === 'MEM') {
                        color = '#22c55e';
                        marker = 'url(#arrow-green)';
                    }

                    const pathData = `M ${start.x} ${startY} Q ${controlX} ${controlY} ${end.x} ${endY}`;

                    const t = 0.4 + (i % 4) * 0.08;
                    const labelX = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * controlX + t * t * end.x;
                    const labelY = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * endY;
                    const labelYOffset = -18 - (i * 8);

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
                            <g transform={`translate(${labelX}, ${labelY + labelYOffset})`}>
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
        <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden relative">
            <div className="bg-slate-50 px-4 py-3 border-b border-gray-200 font-semibold text-slate-700 text-center z-10 rounded-t-lg flex-shrink-0">
                Pipeline
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
                {/* 修复点 1: 修改 container 的高度策略为 min-h-full 并使用 flex flex-col */}
                <div className="p-6 relative min-h-full flex flex-col" ref={containerRef}>
                    {renderForwardingLines()}

                    {/* 修复点 2: 这里的 h-full 替换为了 flex-1，使得 grid 可以自然撑满容器 */}
                    <div className="grid grid-cols-5 gap-6 flex-1 items-stretch relative z-10">
                        {STAGES.map((stage) => {
                            const info = snapshot.pipeline[stage as keyof typeof snapshot.pipeline];
                            const isStall = info?.is_stall;
                            const isBubble = info?.is_bubble;
                            const isStallSrc = info?.is_stall_src;

                            return (
                                <div key={stage} className="flex flex-col h-full relative group">
                                    <div className={`flex-1 rounded-t-lg border-x border-t shadow-sm transition-all duration-300 relative flex flex-col min-w-0
                    ${isStall
                                            ? 'bg-red-50 border-red-200 animate-pulse'
                                            : isBubble
                                                ? 'bg-amber-50 border-amber-200'
                                                : 'bg-blue-50 border-blue-200'
                                        }
                    ${isStallSrc ? 'border-2 border-red-500' : ''}
                `}>
                                        <div className="p-1 flex flex-col gap-2 items-center text-center mt-8 w-full">
                                            {info ? (
                                                <>
                                                    <div className="text-[10px] font-mono text-slate-500 bg-white/60 px-1 rounded border border-white/50 w-full truncate">
                                                        {info.pc}
                                                    </div>
                                                    <div className={`text-xs font-bold break-words w-full px-1 py-1 rounded bg-white/40
                                    ${isStall ? 'text-red-700' : isBubble ? 'text-amber-700' : 'text-blue-700'}
                                `}>
                                                        {(() => {
                                                            const instrText = info.render_str || info.instr;
                                                            const parts = parseInstructionWithMarkers(instrText);
                                                            return parts.map((part, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className={
                                                                        part.color === 'red'
                                                                            ? 'text-red-600 font-bold'
                                                                            : part.color === 'green'
                                                                                ? 'text-green-600 font-bold'
                                                                                : ''
                                                                    }
                                                                >
                                                                    {part.text}
                                                                </span>
                                                            ));
                                                        })()}
                                                    </div>

                                                    {!isBubble && info.wreg !== undefined && info.wreg !== null && (
                                                        <div className="text-[9px] font-mono text-red-600 bg-red-50 px-1 py-0.5 rounded border border-red-200 w-full truncate">
                                                            W: ${info.wreg}
                                                            {detailMode ? (
                                                                info.tnew !== undefined && info.tnew >= 0 && (
                                                                    <span className="ml-1 text-red-700 font-semibold">tnew={info.tnew}</span>
                                                                )
                                                            ) : (
                                                                info.tnew !== undefined && info.tnew > 0 && (
                                                                    <span className="ml-1 text-red-700">({info.tnew} cyc)</span>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                    {!isBubble && info.rregs && info.rregs.length > 0 && (
                                                        <>
                                                            {info.rregs.map((r, i) => {
                                                                let tuse = -1;
                                                                if (info.rs === r && info.tuse_rs !== undefined) {
                                                                    tuse = info.tuse_rs;
                                                                } else if (info.rt === r && info.tuse_rt !== undefined) {
                                                                    tuse = info.tuse_rt;
                                                                }

                                                                return (
                                                                    <div key={i} className="text-[9px] font-mono text-green-600 bg-green-50 px-1 py-0.5 rounded border border-green-200 w-full truncate">
                                                                        R: ${r}
                                                                        {detailMode ? (
                                                                            tuse >= 0 && (
                                                                                <span className="ml-1 text-green-700 font-semibold">tuse={tuse}</span>
                                                                            )
                                                                        ) : (
                                                                            tuse > 0 && (
                                                                                <span className="ml-1 text-green-700">({tuse} cyc)</span>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </>
                                                    )}

                                                    <div className="flex flex-col gap-1 mt-auto mb-4 w-full px-2">
                                                        {isStall && (
                                                            <div className="flex items-center justify-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded border border-red-200 shadow-sm">
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

                                    <div className="bg-slate-800 text-white text-center py-2 font-bold text-lg rounded-b-lg shadow-md z-10 border-t border-slate-700">
                                        {stage}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PipelineVisualizer;