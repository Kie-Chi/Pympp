import React, { useState, useEffect } from 'react';
import { getMemoryPage } from '../api/client';
import { MemoryPageResponse } from '../types/schema';

interface Props {
  cycle: number; // Trigger refresh on cycle change
  memory?: Record<string, string>; // Optional direct memory from snapshot if needed, though we use paged fetch
  writtenAddresses?: string[];
}

const MemoryView: React.FC<Props> = ({ cycle, writtenAddresses = [] }) => {
  const [startAddr, setStartAddr] = useState<string>('0x00000000');
  const [data, setData] = useState<MemoryPageResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Ensure hex format
      let addr = startAddr;
      if (!addr.startsWith('0x')) {
          addr = '0x' + addr;
      }
      const res = await getMemoryPage(addr, 16, cycle);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [cycle, startAddr]); // Refresh when cycle changes or address changes

  const handleAddrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setStartAddr(e.target.value);
  }

  const navigate = (offset: number) => {
      if(!data) return;
      const current = parseInt(data.start_addr, 16);
      const next = Math.max(0, current + offset * 4); // Prevent negative address
      setStartAddr('0x' + next.toString(16).padStart(8, '0'));
  }

  // Helper to normalize hex addresses for comparison
  const normalizeAddr = (addr: string | number) => {
      const s = typeof addr === 'number' ? addr.toString(16) : addr.replace('0x', '');
      return s.padStart(8, '0').toLowerCase();
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="bg-slate-50 px-3 py-1.5 border-b border-gray-200 font-semibold text-slate-700 flex justify-between items-center text-sm">
        <span>Memory</span>
        <div className="flex gap-2 items-center">
            <button onClick={() => navigate(-16)} className="px-2 py-0.5 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50 text-slate-600 transition-colors">Prev</button>
            <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">@</span>
                <input 
                    value={startAddr} 
                    onChange={handleAddrChange}
                    className="w-28 pl-5 pr-2 py-0.5 text-xs border border-gray-300 rounded font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="0x00000000"
                />
            </div>
            <button onClick={() => navigate(16)} className="px-2 py-0.5 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50 text-slate-600 transition-colors">Next</button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-0 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 border-b border-gray-200">
            <tr>
              <th className="px-3 py-1 border-r border-gray-200 w-28 bg-slate-50">Address</th>
              <th className="px-3 py-1 border-r border-gray-200 font-mono bg-slate-50">Value (+0)</th>
              <th className="px-3 py-1 border-r border-gray-200 font-mono bg-slate-50">Value (+4)</th>
              <th className="px-3 py-1 border-r border-gray-200 font-mono bg-slate-50">Value (+8)</th>
              <th className="px-3 py-1 font-mono bg-slate-50">Value (+c)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-mono text-xs">
            {data && Array.from({ length: 4 }).map((_, rowIdx) => {
                const rowStartAddr = parseInt(data.start_addr, 16) + (rowIdx * 16);
                const rowValues = data.values.slice(rowIdx * 4, (rowIdx + 1) * 4);
                
                return (
                    <tr key={rowIdx} className="hover:bg-blue-50 transition-colors">
                        <td className="px-3 py-1 text-slate-500 font-medium border-r border-gray-100 bg-slate-50/30">
                            0x{rowStartAddr.toString(16).padStart(8, '0')}
                        </td>
                        {rowValues.map((val, colIdx) => {
                            const addr = rowStartAddr + (colIdx * 4);
                            const isWritten = writtenAddresses.some(wa => normalizeAddr(wa) === normalizeAddr(addr));
                            
                            return (
                                <td key={colIdx} className={`px-3 py-1 text-slate-700 border-r border-gray-100 last:border-r-0 
                                    ${isWritten ? 'bg-red-100 font-bold text-red-700' : val !== '00000000' ? 'font-bold text-blue-700 bg-blue-50/20' : ''}
                                `}>
                                    {val}
                                </td>
                            );
                        })}
                    </tr>
                );
            })}
            {loading && !data && (
                <tr><td colSpan={5} className="text-center py-4 text-slate-400">Loading...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MemoryView;
