import React, { useRef, useEffect } from 'react';
import { Register } from '../types/schema';

interface Props {
  registers: Record<string, Register> | undefined;
  writtenRegisters?: number[];
}

const REG_NAMES = [
    "$zero", "$at", "$v0", "$v1", "$a0", "$a1", "$a2", "$a3",
    "$t0", "$t1", "$t2", "$t3", "$t4", "$t5", "$t6", "$t7",
    "$s0", "$s1", "$s2", "$s3", "$s4", "$s5", "$s6", "$s7",
    "$t8", "$t9", "$k0", "$k1", "$gp", "$sp", "$fp", "$ra"
];

const RegisterFile: React.FC<Props> = ({ registers, writtenRegisters = [] }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll logic... (keep existing)
  useEffect(() => {
    if (writtenRegisters.length > 0 && scrollContainerRef.current) {
        const firstWritten = Math.min(...writtenRegisters);
        const element = document.getElementById(`reg-${firstWritten}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
  }, [writtenRegisters]);

  // Generate display list
  const displayRegisters = React.useMemo(() => {
    if (registers) {
        return Object.entries(registers).map(([key, reg]) => ({
            id: parseInt(key),
            ...reg
        })).sort((a, b) => a.id - b.id);
    } else {
        // Default empty state
        return REG_NAMES.map((name, i) => ({
            id: i,
            name,
            value: "00000000"
        }));
    }
  }, [registers]);

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="bg-slate-50 px-3 py-2 border-b border-gray-200 font-semibold text-slate-700 flex justify-between items-center text-xs">
        <span>Registers</span>
        <span className="text-[10px] text-slate-400 font-normal">GPR $0-$31</span>
      </div>
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent"
      >
        <table className="w-full text-[10px] text-left border-collapse table-fixed">
            <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-10 shadow-sm">
                <tr>
                <th className="px-2 py-1 border-b border-gray-200 w-[15%]">Name</th>
                <th className="px-2 py-1 border-b border-gray-200 w-[10%]">#</th>
                <th className="px-2 py-1 border-b border-gray-200 text-right w-auto">Value</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {displayRegisters.map((reg, idx) => {
                    const isWritten = writtenRegisters.includes(reg.id);
                    return (
                        <tr 
                            key={reg.id} 
                            id={`reg-${reg.id}`}
                            className={`transition-colors duration-200 ${
                                isWritten 
                                    ? 'bg-red-100' 
                                    : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                            } hover:bg-blue-50`}
                        >
                            <td className="px-2 py-0.5 font-mono text-blue-600 font-bold flex items-center gap-1">
                                {reg.name}
                                {isWritten && <span className="w-1 h-1 rounded-full bg-red-500"/>}
                            </td>
                            <td className="px-2 py-0.5 text-slate-400 font-mono">${reg.id}</td>
                            <td className={`px-2 py-0.5 font-mono text-right ${isWritten ? 'font-bold text-red-700' : 'text-slate-700'}`}>
                                {reg.value}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default RegisterFile;
