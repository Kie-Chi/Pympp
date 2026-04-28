import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, RefreshCw, Trophy, FileText, Maximize2, Minimize2 } from 'lucide-react';
import { startQuizSession, recordQuizAnswer, endQuizSession } from '../api/client';
import { QuizAnswerRequest } from '../types/schema';

interface Instruction {
  name: string;
  syntax: string;
  description: string;
  tuse_rs: (number | null)[];
  tuse_rt: (number | null)[];
  tnew: (number | null)[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const STAGE_OPTIONS = [
  { value: '0', label: '0 (Stage D)' },
  { value: '1', label: '1 (Stage E)' },
  { value: '2', label: '2 (Stage M)' },
  { value: '3', label: '3 (Stage W)' },
  { value: '-', label: '- (Not Used)' },
  { value: 'UNKNOWN', label: 'UNKNOWN' },
];

const REVERSE_STAGE_MAP: Record<string, number | null> = {
  '0': 0,
  '1': 1,
  '2': 2,
  '3': 3,
  '-': null,
  'UNKNOWN': -99
};

const STORAGE_KEY = 'quiz_state';

interface SavedState {
  instructions: Instruction[];
  currentIdx: number;
  answers: { tuse_rs: string; tuse_rt: string; tnew: string };
  score: number;
  quizSessionId: string | null;
  answeredCount: number;  // Number of questions already answered
  savedAt: number;  // Timestamp when state was saved
}

const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// 将数字转换为带Stage标签的格式用于显示
const getStageLabel = (value: string): string => {
  const labels: Record<string, string> = {
    '0': '0 (Stage D)',
    '1': '1 (Stage E)',
    '2': '2 (Stage M)',
    '3': '3 (Stage W)',
    '-': '- (Not Used)',
  };
  return labels[value] || value;
};

const QuizMode: React.FC<Props> = ({ isOpen, onClose }) => {
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [descriptionContent, setDescriptionContent] = useState<string | null>(null);
  const [isDescriptionFullScreen, setIsDescriptionFullScreen] = useState(false);

  // Quiz session for backend recording
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);

  const [answers, setAnswers] = useState<{
    tuse_rs: string;
    tuse_rt: string;
    tnew: string;
  }>({ tuse_rs: '', tuse_rt: '', tnew: '' });

  const [feedback, setFeedback] = useState<{
    tuse_rs?: boolean;
    tuse_rt?: boolean;
    tnew?: boolean;
  } | null>(null);

  const [correctAnswers, setCorrectAnswers] = useState<{
    tuse_rs: string;
    tuse_rt: string;
    tnew: string;
  } | null>(null);

  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Continue prompt state
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [savedState, setSavedState] = useState<SavedState | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Check for saved state
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const state: SavedState = JSON.parse(saved);
          // Check if session has expired
          if (state.savedAt && Date.now() - state.savedAt > SESSION_EXPIRY_MS) {
            // Session expired - end it on backend and clear localStorage
            if (state.quizSessionId) {
              endQuizSession(state.quizSessionId, state.score).catch(err => {
                console.error('Failed to end expired quiz session:', err);
              });
            }
            localStorage.removeItem(STORAGE_KEY);
            loadInstructions(false);
          } else {
            setSavedState(state);
            setShowContinuePrompt(true);
          }
        } catch {
          loadInstructions(false);
        }
      } else {
        loadInstructions(false);
      }
    }
  }, [isOpen]);

  // Load description content when current instruction changes
  useEffect(() => {
    if (instructions.length > 0 && currentIdx < instructions.length) {
      const current = instructions[currentIdx];
      // Check if description is a file path
      const isPath = current.description.includes('/') || current.description.includes('\\') || current.description.endsWith('.md');
      
      console.log('Current instruction:', current.name, 'Description:', current.description, 'IsPath:', isPath);

      if (isPath && !current.description.startsWith('http')) {
        setDescriptionContent('Loading description...');
        
        // Assume relative to resources folder
        const path = current.description.startsWith('/') 
          ? `/resources${current.description}` 
          : `/resources/${current.description}`;
        
        console.log('Fetching description from:', path);

        fetch(path)
          .then(res => {
            if (!res.ok) throw new Error(`Failed to load description: ${res.status} ${res.statusText}`);
            return res.text();
          })
          .then(text => {
            console.log('Description loaded, length:', text.length);
            setDescriptionContent(text);
          })
          .catch(err => {
            console.error('Error fetching description:', err);
            setDescriptionContent(`Failed to load description from ${path}. Error: ${err.message}`);
          });
      } else {
        setDescriptionContent(current.description);
      }
    }
  }, [currentIdx, instructions]);

  const loadInstructions = async (restoreState: boolean = false) => {
    setLoading(true);
    setShowContinuePrompt(false);

    if (restoreState && savedState) {
      // Restore saved state - continue previous session
      setInstructions(savedState.instructions);
      setCurrentIdx(savedState.currentIdx);
      setAnswers(savedState.answers);
      setScore(savedState.score);
      setQuizSessionId(savedState.quizSessionId);
      setShowResult(false);
      setFeedback(null);
      setCorrectAnswers(null);
      setHasSubmitted(false);
      setLoading(false);
      return;
    }

    // If starting new session, end the previous one first (if exists)
    if (savedState?.quizSessionId) {
      endQuizSession(savedState.quizSessionId, savedState.score).catch(err => {
        console.error('Failed to end previous quiz session:', err);
      });
      // Clear saved state since we're starting fresh
      localStorage.removeItem(STORAGE_KEY);
    }

    try {
      const res = await fetch('/resources/instructions.json');
      const data = await res.json();
      // Shuffle instructions every time
      const shuffled = data.sort(() => Math.random() - 0.5);
      setInstructions(shuffled);
      resetQuiz();

      // Start quiz session on backend
      try {
        const quizRes = await startQuizSession(shuffled.length);
        setQuizSessionId(quizRes.quiz_session_id);
      } catch (err) {
        console.error('Failed to start quiz session:', err);
        // Continue without backend recording
        setQuizSessionId(null);
      }
    } catch (err) {
      console.error('Failed to load instructions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Save state whenever it changes (but not after quiz is complete)
  useEffect(() => {
    if (!loading && instructions.length > 0 && !showResult && !showContinuePrompt) {
      const state: SavedState = {
        instructions,
        currentIdx,
        answers,
        score,
        quizSessionId,
        answeredCount: currentIdx,
        savedAt: Date.now(),  // Add timestamp for expiry check
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [instructions, currentIdx, answers, score, quizSessionId, loading, showResult, showContinuePrompt]);

  const resetQuiz = () => {
    setCurrentIdx(0);
    setScore(0);
    setShowResult(false);
    setAnswers({ tuse_rs: '', tuse_rt: '', tnew: '' });
    setFeedback(null);
    setCorrectAnswers(null);
    setHasSubmitted(false);
    setQuizSessionId(null);
  };

  const handleAnswerChange = (field: keyof typeof answers, value: string) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
    setFeedback(null);
  };

  const checkAnswer = () => {
    const current = instructions[currentIdx];
    const checkField = (userAnswer: string, correctValues: (number | null)[]) => {
      const mappedUser = REVERSE_STAGE_MAP[userAnswer];
      if (mappedUser === undefined) return false;

      return correctValues.some(val => val === mappedUser);
    };

    const getStageString = (values: (number | null)[]): string => {
      if (values.length === 0 || values.every(v => v === null)) return '-';
      const stages = values
        .map(v => {
          if (v === null) return null;
          return String(v);  // 直接返回数字字符串
        })
        .filter(s => s !== null);

      // If no valid stages, return '-'
      if (stages.length === 0) return '-';

      // Return all valid stages joined with ' / '
      return stages.join(' / ');
    };

    const isRsCorrect = checkField(answers.tuse_rs, current.tuse_rs);
    const isRtCorrect = checkField(answers.tuse_rt, current.tuse_rt);
    const isTnewCorrect = checkField(answers.tnew, current.tnew);
    const allCorrect = isRsCorrect && isRtCorrect && isTnewCorrect;

    setFeedback({
      tuse_rs: isRsCorrect,
      tuse_rt: isRtCorrect,
      tnew: isTnewCorrect
    });

    // Set correct answers
    setCorrectAnswers({
      tuse_rs: getStageString(current.tuse_rs),
      tuse_rt: getStageString(current.tuse_rt),
      tnew: getStageString(current.tnew)
    });

    setHasSubmitted(true);

    if (allCorrect) {
      setScore(s => s + 1);
    }

    // Record answer to backend
    if (quizSessionId) {
      const record: QuizAnswerRequest = {
        quiz_session_id: quizSessionId,
        instruction_name: current.name,
        question_index: currentIdx,
        user_tuse_rs: REVERSE_STAGE_MAP[answers.tuse_rs] ?? null,
        user_tuse_rt: REVERSE_STAGE_MAP[answers.tuse_rt] ?? null,
        user_tnew: REVERSE_STAGE_MAP[answers.tnew] ?? null,
        correct_tuse_rs: getStageString(current.tuse_rs),
        correct_tuse_rt: getStageString(current.tuse_rt),
        correct_tnew: getStageString(current.tnew),
        is_correct: allCorrect
      };

      recordQuizAnswer(record).catch(err => {
        console.error('Failed to record quiz answer:', err);
      });
    }
  };

  const nextQuestion = () => {
    if (currentIdx + 1 >= instructions.length) {
      setShowResult(true);
      // Clear saved state when quiz is complete
      localStorage.removeItem(STORAGE_KEY);
      // End quiz session on backend
      if (quizSessionId) {
        endQuizSession(quizSessionId, score).catch(err => {
          console.error('Failed to end quiz session:', err);
        });
      }
    } else {
      setCurrentIdx(c => c + 1);
      setAnswers({ tuse_rs: '', tuse_rt: '', tnew: '' });
      setFeedback(null);
      setCorrectAnswers(null);
      setHasSubmitted(false);
    }
  };

  // Handle closing quiz modal - keep session in_progress for potential continuation
  const handleClose = () => {
    // Don't end session here - user might want to continue later
    // Session will be ended when:
    // 1. User completes the quiz (showResult)
    // 2. User explicitly chooses "Start New Session"
    onClose();
  };

  const renderSelect = (field: keyof typeof answers, label: string) => {
    const isCorrect = feedback?.[field];
    const isWrong = feedback && !isCorrect;
    const correctAnswer = correctAnswers?.[field];
    
    // Get other correct answers if user is correct and there are multiple answers
    const otherAnswers = isCorrect && correctAnswer?.includes('/') 
      ? correctAnswer.split(' / ').filter(ans => ans !== answers[field]).join(' / ')
      : null;
    
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700">{label}</label>
        <div className="relative">
          <select
            className={`w-full text-center py-3 border-2 rounded-lg font-mono font-bold appearance-none outline-none focus:ring-2 focus:ring-purple-200 transition-colors
              ${isCorrect ? 'border-green-500 bg-green-50 text-green-700' : 
                isWrong ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 bg-white hover:border-purple-300 focus:border-purple-500 cursor-pointer'}
              ${hasSubmitted ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            value={answers[field]}
            onChange={(e) => handleAnswerChange(field, e.target.value)}
            disabled={hasSubmitted}
          >
            <option value="" disabled>Select</option>
            {STAGE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {isCorrect ? <CheckCircle size={18} className="text-green-500" /> :
             isWrong ? <XCircle size={18} className="text-red-500" /> :
             <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-slate-400"></div>}
          </div>
        </div>
        {isWrong && correctAnswer && (
          <div className="text-xs text-green-600 font-semibold mt-1 flex items-center gap-1">
            <span className="text-slate-500">✓</span>
            <span>正确答案: <span className="font-mono">{
              correctAnswer.includes(' / ')
                ? correctAnswer.split(' / ').map(getStageLabel).join(' / ')
                : getStageLabel(correctAnswer)
            }</span></span>
          </div>
        )}
        {otherAnswers && (
          <div className="text-xs text-slate-500 mt-1">
            其他可接受的答案: <span className="font-mono">{
              otherAnswers.split(' / ').map(getStageLabel).join(' / ')
            }</span>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  const currentInstr = instructions[currentIdx];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={handleClose}>
      <div 
        className={`bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col transition-all
          ${isFullScreen ? 'w-full h-full max-w-none max-h-none rounded-none' : 'w-full max-w-2xl max-h-[90vh]'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">Tuse / Tnew Challenge</h2>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Pipeline Quiz</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsFullScreen(!isFullScreen)} 
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
            >
              {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button onClick={handleClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-8 overflow-y-auto flex-1">
          {/* Continue Prompt */}
          {showContinuePrompt && savedState && (
            <div className="text-center py-8 space-y-4">
              <div className="text-lg text-slate-700">
                You have an unfinished quiz session.
              </div>
              <div className="text-sm text-slate-500">
                Previous progress: Question {savedState.currentIdx + 1} of {savedState.instructions?.length || 0}, Score: {savedState.score}
              </div>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => loadInstructions(true)}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Continue Previous Session
                </button>
                <button
                  onClick={() => loadInstructions(false)}
                  className="px-6 py-2 bg-gray-200 text-slate-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Start New Session
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-10 text-slate-500">Loading questions...</div>
          ) : showContinuePrompt ? null : showResult ? (
            <div className="text-center py-8 space-y-6">
              <Trophy size={64} className="mx-auto text-yellow-500 animate-bounce" />
              <div>
                <h3 className="text-2xl font-bold text-slate-800">Quiz Complete!</h3>
                <p className="text-slate-600 mt-2">You scored <span className="font-bold text-purple-600 text-xl">{score}</span> / {instructions.length}</p>
              </div>
              <button 
                onClick={() => loadInstructions(false)}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 mx-auto"
              >
                <RefreshCw size={18} /> Play Again
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Progress */}
              <div className="flex justify-between text-sm text-slate-500 mb-2">
                <span>Question {currentIdx + 1} of {instructions.length}</span>
                <span>Score: {score}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-6">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentIdx + 1) / instructions.length) * 100}%` }}
                ></div>
              </div>

              {/* Question Card */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center">
                <div className="text-4xl font-mono font-bold text-purple-700 mb-2">{currentInstr.name}</div>
                <div className="text-slate-500 font-mono text-sm mb-4">{currentInstr.syntax}</div>
                
                {descriptionContent && (
                  <div className="mt-4 text-left">
                    {/* Fullscreen toggle button - only show for imported markdown files */}
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <FileText size={14} />
                        <span>Description</span>
                      </div>
                      {(currentInstr.description.includes('/') || currentInstr.description.includes('\\') || currentInstr.description.endsWith('.md')) && (
                        <button 
                          onClick={() => setIsDescriptionFullScreen(!isDescriptionFullScreen)}
                          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                          title={isDescriptionFullScreen ? "Exit Full Screen" : "Full Screen"}
                        >
                          {isDescriptionFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                      )}
                    </div>
                    
                    {isDescriptionFullScreen && (
                      <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsDescriptionFullScreen(false)}></div>
                    )}
                    
                    <div className={`bg-white rounded border border-slate-200 overflow-y-auto transition-all ${isDescriptionFullScreen ? 'fixed inset-4 z-50 max-h-none p-8 shadow-2xl' : 'p-4 ' + (isFullScreen ? 'max-h-[60vh]' : 'max-h-60')}`}>
                      {isDescriptionFullScreen && (
                        <button 
                          onClick={() => setIsDescriptionFullScreen(false)}
                          className="sticky top-2 float-right p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors shadow-md mb-4"
                        >
                          <X size={20} />
                        </button>
                      )}
                      
                      {/* Render HTML content if it looks like HTML, otherwise plain text */}
                      {descriptionContent.trim().startsWith('<') || descriptionContent.includes('<table') ? (
                        <div 
                          dangerouslySetInnerHTML={{ __html: descriptionContent }} 
                          className="quiz-description-content"
                        />
                      ) : (
                        <pre className="whitespace-pre-wrap font-sans text-slate-600 text-sm">{descriptionContent}</pre>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-3 gap-6">
                {renderSelect('tuse_rs', 'Tuse (rs)')}
                {renderSelect('tuse_rt', 'Tuse (rt)')}
                {renderSelect('tnew', 'Tnew')}
              </div>

              <div className="text-center text-xs text-slate-400">
                Select <strong>-</strong> if not applicable. Select <strong>UNKNOWN</strong> if unsure.
              </div>

              {!hasSubmitted ? (
                <button 
                  onClick={checkAnswer}
                  disabled={!answers.tuse_rs || !answers.tuse_rt || !answers.tnew}
                  className="w-full py-3 bg-purple-600 text-white rounded-lg font-bold shadow-md hover:bg-purple-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Answer
                </button>
              ) : (
                <button 
                  onClick={nextQuestion}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all"
                >
                  Next Question →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizMode;