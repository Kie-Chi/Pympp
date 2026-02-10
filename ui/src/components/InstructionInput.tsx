import React, { useEffect, useRef, useState } from 'react';

interface Props {
  asmSource: string;
  setAsmSource: (source: string) => void;
  currentLine?: number;
  disabled?: boolean;
}

const InstructionInput: React.FC<Props> = ({ asmSource, setAsmSource, currentLine, disabled }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lines = asmSource.split('\n');

  const [scrollTop, setScrollTop] = useState(0);

  // Auto-scroll to current line
  useEffect(() => {
    if (currentLine && textareaRef.current) {
        // Simple approximation: line height ~ 24px
        const lineHeight = 24;
        const scrollPos = (currentLine - 1) * lineHeight;
        const containerHeight = textareaRef.current.clientHeight;
        
        // Only scroll if out of view
        if (scrollPos < textareaRef.current.scrollTop || scrollPos > textareaRef.current.scrollTop + containerHeight) {
             textareaRef.current.scrollTop = scrollPos - containerHeight / 2;
        }
    }
  }, [currentLine]);

  // Handle highlighing logic properly
  // Since we use a simple textarea, we can't easily highlight full width background for one line behind the text
  // So we create a "backdrop" div that mirrors the textarea content
  
  return (
    <div className="flex flex-col h-full border border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-gray-200 font-semibold text-slate-700 flex justify-between items-center">
        <span>Editor</span>
        <span className="text-xs text-slate-400 font-normal">MIPS Assembly</span>
      </div>
      <div className="relative flex-1 flex overflow-hidden">
        {/* Line Numbers */}
        <div 
            className="bg-slate-50 border-r border-gray-200 text-right select-none py-2 min-h-full w-10 flex-shrink-0 z-10 overflow-hidden"
            style={{ marginTop: -scrollTop }}
        >
          {lines.map((_, i) => (
            <div 
              key={i} 
              className={`px-2 text-xs leading-6 font-mono transition-colors duration-200 ${
                currentLine === i + 1 
                  ? 'text-blue-600 font-bold' 
                  : 'text-slate-400'
              }`}
            >
              {i + 1}
            </div>
          ))}
        </div>
        
        {/* Editor Container */}
        <div className="relative flex-1 h-full overflow-hidden">
            {/* Backdrop for highlighting */}
            <div 
                className="absolute top-0 left-0 w-full pointer-events-none font-mono text-sm leading-6 backdrop"
                style={{ 
                    top: -scrollTop,
                    padding: '8px' // Match textarea padding
                }}
            >
                {lines.map((line, i) => (
                    <div key={i} className={`w-full h-6 ${currentLine === i + 1 ? 'bg-blue-100/50 -mx-2 px-2' : ''}`}>
                         {/* Empty content, just for background */}
                    </div>
                ))}
            </div>

            {/* Text Area */}
            <textarea
            ref={textareaRef}
            className="absolute top-0 left-0 w-full h-full p-2 font-mono text-sm leading-6 resize-none outline-none whitespace-pre text-slate-700 bg-transparent z-10 disabled:bg-gray-50/80 disabled:cursor-not-allowed"
            value={asmSource}
            onChange={(e) => setAsmSource(e.target.value)}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            disabled={disabled}
            spellCheck={false}
            placeholder="Enter MIPS assembly code here..."
            />
        </div>
      </div>
    </div>
  );
};

export default InstructionInput;
