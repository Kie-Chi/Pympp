import React from 'react';
import { X, Clock, Code2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SUPPORTED_INSTRUCTIONS = [
  { category: 'Arithmetic', items: [
    { name: 'add', syntax: 'add $rd, $rs, $rt', desc: '$rd = $rs + $rt', tnew: '1', tnewNote: 'Ready in EM Reg', tuse: 'rs:1(E), rt:1(E)' },
    { name: 'sub', syntax: 'sub $rd, $rs, $rt', desc: '$rd = $rs - $rt', tnew: '1', tnewNote: 'Ready in EM Reg', tuse: 'rs:1(E), rt:1(E)' },
  ]},
  { category: 'Logical / Immediate', items: [
    { name: 'ori', syntax: 'ori $rt, $rs, imm', desc: '$rt = $rs | imm', tnew: '1', tnewNote: 'Ready in EM Reg', tuse: 'rs:1(E)' },
    { name: 'lui', syntax: 'lui $rt, imm', desc: '$rt = imm << 16', tnew: '1', tnewNote: 'Ready in EM Reg', tuse: '-' },
  ]},
  { category: 'Memory', items: [
    { name: 'lw', syntax: 'lw $rt, offset($rs)', desc: '$rt = MEM[$rs + offset]', tnew: '2', tnewNote: 'Ready in MW Reg', tuse: 'rs:1(E)' },
    { name: 'sw', syntax: 'sw $rt, offset($rs)', desc: 'MEM[$rs + offset] = $rt', tnew: '-', tnewNote: '', tuse: 'rs:1(E), rt:2(M)' },
  ]},
  { category: 'Branch & Jump', items: [
    { name: 'beq', syntax: 'beq $rs, $rt, label', desc: 'if $rs == $rt goto label', tnew: '-', tnewNote: '', tuse: 'rs:0(D), rt:0(D)' },
    { name: 'jal', syntax: 'jal label', desc: '$ra = PC+8; goto label', tnew: '0', tnewNote: 'Ready in DE Reg', tuse: '-' },
    { name: 'jr', syntax: 'jr $rs', desc: 'goto $rs', tnew: '-', tnewNote: '', tuse: 'rs:0(D)' },
  ]},
  { category: 'Other', items: [
    { name: 'nop', syntax: 'nop', desc: 'No operation', tnew: '-', tnewNote: '', tuse: '-' },
  ]},
];

const InstructionReference: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">Simulator Reference</h2>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Pipeline Guide</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50/50">
          <div className="p-6 space-y-8">
            
            {/* Tuse / Tnew Concepts */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 flex items-center gap-2">
                <Clock size={18} className="text-blue-600" />
                <h3 className="font-bold text-blue-800">Concepts</h3>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                    Tuse (Time Use)
                  </h4>
                  <p className="text-sm text-slate-600 mb-3">
                    The number of cycles after D stage when a source operand is needed.
                  </p>
                  <ul className="text-xs space-y-2 bg-slate-50 p-3 rounded border border-gray-100">
                    <li className="flex gap-2"><span className="font-mono font-bold text-slate-700 w-16">Tuse = 0</span> <span>Used in <strong>D</strong> stage</span></li>
                    <li className="flex gap-2"><span className="font-mono font-bold text-slate-700 w-16">Tuse = 1</span> <span>Used in <strong>E</strong> stage</span></li>
                    <li className="flex gap-2"><span className="font-mono font-bold text-slate-700 w-16">Tuse = 2</span> <span>Used in <strong>M</strong> stage</span></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Tnew (Time New)
                  </h4>
                  <p className="text-sm text-slate-600 mb-3">
                    The number of cycles after D stage when the result is ready for forwarding.
                  </p>
                  <ul className="text-xs space-y-2 bg-slate-50 p-3 rounded border border-gray-100">
                    <li className="flex gap-2"><span className="font-mono font-bold text-slate-700 w-16">Tnew = 0</span> <span>Ready in <strong>DE Reg</strong></span></li>
                    <li className="flex gap-2"><span className="font-mono font-bold text-slate-700 w-16">Tnew = 1</span> <span>Ready in <strong>EM Reg</strong></span></li>
                    <li className="flex gap-2"><span className="font-mono font-bold text-slate-700 w-16">Tnew = 2</span> <span>Ready in <strong>MW Reg</strong></span></li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Supported Instructions */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100 flex items-center gap-2">
                <Code2 size={18} className="text-indigo-600" />
                <h3 className="font-bold text-indigo-800">Supported Instructions</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 gap-6">
                  {SUPPORTED_INSTRUCTIONS.map((category, idx) => (
                    <div key={idx} className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-gray-100 pb-1">
                        {category.category}
                      </h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {category.items.map((instr, i) => (
                          <div key={i} className="flex flex-col bg-white p-3 rounded border border-gray-200 hover:border-indigo-300 transition-colors shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-baseline gap-2">
                                <span className="font-mono text-indigo-700 font-bold text-lg">{instr.name}</span>
                                <span className="font-mono text-slate-400 text-xs">{instr.syntax}</span>
                              </div>
                              <div className="flex gap-1">
                                {instr.tuse !== '-' && (
                                  <span className="text-[10px] font-mono bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded border border-orange-100" title="Tuse">
                                    Tuse: {instr.tuse}
                                  </span>
                                )}
                                {instr.tnew !== '-' && (
                                  <span className="text-[10px] font-mono bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100" title="Tnew">
                                    Tnew: {instr.tnew}{instr.tnewNote ? ` (${instr.tnewNote})` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-slate-600 text-xs">{instr.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default InstructionReference;
