import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, Eye, Trophy, Maximize2, Minimize2, LayoutGrid, FileText, Grid3x3 } from 'lucide-react';
import { startExerciseSession, recordExerciseAnswer, endExerciseSession } from '../api/client';
import { ExerciseAnswerRequest } from '../types/schema';

interface Instruction {
  name: string;
  syntax: string;
  description: string;
  tuse_rs: (number | null)[];
  tuse_rt: (number | null)[];
  tnew: (number | null)[];
  example: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoadAsm?: (asmSource: string) => void;  // Callback to load ASM into editor
  showPart1?: boolean;  // Show AT Method option (from config)
  showPart2?: boolean;  // Show Strategy Matrix option (from config)
}

const STAGE_OPTIONS = [
  { value: '', label: '- Select -' },
  { value: '0', label: '0 (Stage D)' },
  { value: '1', label: '1 (Stage E)' },
  { value: '2', label: '2 (Stage M)' },
  { value: '3', label: '3 (Stage W)' },
  { value: '-', label: '- (Not Used)' },
  { value: 'UNKNOWN', label: 'UNKNOWN' },
];

const REVERSE_STAGE_MAP: Record<string, number | null | undefined> = {
  '': undefined,  // undefined = not filled, skip check
  '0': 0,
  '1': 1,
  '2': 2,
  '3': 3,
  '-': null,      // null = Not Used
  'UNKNOWN': -99,
};

const STORAGE_KEY_AT = 'exercise_state_at';
const STORAGE_KEY_MATRIX = 'exercise_state_matrix';

interface SavedState {
  answers: Record<string, { tuse_rs: string; tuse_rt: string; tnew: string }>;
  currentInstructionIndex: number;
  score: number;
  exerciseSessionId: string | null;
  instructions: Instruction[];
  savedAt: number;
}

interface MatrixSavedState {
  answersRS: Record<string, string>;
  answersRT: Record<string, string>;
  scoreRS: number;
  scoreRT: number;
  sessionId: string | null;
  savedAt: number;
}

// Strategy matrix columns: E_ALU, E_DM, E_PC, M_ALU, M_DM, M_PC, W_ALU, W_DM, W_PC
const MATRIX_COLUMNS = [
  { key: 'E_ALU', label: 'E级\nALU', tnew: 1 },
  { key: 'E_DM', label: 'E级\nDM', tnew: 2 },
  { key: 'E_PC', label: 'E级\nPC', tnew: 0 },
  { key: 'M_ALU', label: 'M级\nALU', tnew: 0 },
  { key: 'M_DM', label: 'M级\nDM', tnew: 1 },
  { key: 'M_PC', label: 'M级\nPC', tnew: 0 },
  { key: 'W_ALU', label: 'W级\nALU', tnew: 0 },
  { key: 'W_DM', label: 'W级\nDM', tnew: 0 },
  { key: 'W_PC', label: 'W级\nPC', tnew: 0 },
];

// RS: Tuse = 0, 1; RT: Tuse = 0, 1, 2
const MATRIX_ROWS_RS = [
  { tuse: 0, label: 'Tuse = 0' },
  { tuse: 1, label: 'Tuse = 1' },
];

const MATRIX_ROWS_RT = [
  { tuse: 0, label: 'Tuse = 0' },
  { tuse: 1, label: 'Tuse = 1' },
  { tuse: 2, label: 'Tuse = 2' },
];

const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

type ExercisePart = 'AT' | 'Matrix';

const ExerciseMode: React.FC<Props> = ({ isOpen, onClose, onLoadAsm, showPart1 = true, showPart2 = true }) => {
  // Part selection state
  const [selectedPart, setSelectedPart] = useState<ExercisePart | null>(null);
  const [showPartSelection, setShowPartSelection] = useState(true);

  // AT Method state
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [exerciseSessionId, setExerciseSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, { tuse_rs: string; tuse_rt: string; tnew: string }>>({});
  const [feedback, setFeedback] = useState<Record<string, { tuse_rs?: boolean; tuse_rt?: boolean; tnew?: boolean }>>({});
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [savedState, setSavedState] = useState<SavedState | null>(null);

  // Matrix state (combined RS + RT)
  const [matrixAnswersRS, setMatrixAnswersRS] = useState<Record<string, string>>({});  // key: "E_ALU_0" -> "S" or "F"
  const [matrixAnswersRT, setMatrixAnswersRT] = useState<Record<string, string>>({});
  const [matrixFeedbackRS, setMatrixFeedbackRS] = useState<Record<string, boolean | undefined>>({});
  const [matrixFeedbackRT, setMatrixFeedbackRT] = useState<Record<string, boolean | undefined>>({});
  const [matrixScoreRS, setMatrixScoreRS] = useState(0);
  const [matrixScoreRT, setMatrixScoreRT] = useState(0);
  const [matrixSessionId, setMatrixSessionId] = useState<string | null>(null);
  const [matrixSubmitted, setMatrixSubmitted] = useState(false);
  const [matrixShowResult, setMatrixShowResult] = useState(false);
  const [matrixShowContinuePrompt, setMatrixShowContinuePrompt] = useState(false);
  const [matrixSavedState, setMatrixSavedState] = useState<MatrixSavedState | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset to show part selection first
      setShowPartSelection(true);
      setSelectedPart(null);
      setLoading(false);
    }
  }, [isOpen]);

  // Handle part selection
  const handleSelectPart = (part: ExercisePart) => {
    setSelectedPart(part);
    setShowPartSelection(false);
    setShowContinuePrompt(false);

    if (part === 'AT') {
      const saved = localStorage.getItem(STORAGE_KEY_AT);
      if (saved) {
        try {
          const state: SavedState = JSON.parse(saved);
          if (state.savedAt && Date.now() - state.savedAt > SESSION_EXPIRY_MS) {
            if (state.exerciseSessionId) {
              endExerciseSession(state.exerciseSessionId).catch(err => console.error(err));
            }
            localStorage.removeItem(STORAGE_KEY_AT);
            loadInstructions(false, part);
          } else {
            setSavedState(state);
            setShowContinuePrompt(true);
          }
        } catch {
          loadInstructions(false, part);
        }
      } else {
        loadInstructions(false, part);
      }
    } else {
      // Matrix mode (combined RS + RT)
      const saved = localStorage.getItem(STORAGE_KEY_MATRIX);
      if (saved) {
        try {
          const state: MatrixSavedState = JSON.parse(saved);
          if (state.savedAt && Date.now() - state.savedAt > SESSION_EXPIRY_MS) {
            // Session expired
            if (state.sessionId) {
              endExerciseSession(state.sessionId).catch(err => console.error(err));
            }
            localStorage.removeItem(STORAGE_KEY_MATRIX);
            loadMatrixPart(false);
          } else {
            setMatrixSavedState(state);
            setMatrixShowContinuePrompt(true);
          }
        } catch {
          loadMatrixPart(false);
        }
      } else {
        loadMatrixPart(false);
      }
    }
  };

  const loadInstructions = async (restoreState: boolean = false, part: ExercisePart = 'AT') => {
    setLoading(true);
    setShowContinuePrompt(false);

    if (restoreState && savedState) {
      // Restore saved state - continue previous session
      setInstructions(savedState.instructions);
      setAnswers(savedState.answers);
      setScore(savedState.score);
      setExerciseSessionId(savedState.exerciseSessionId);
      setShowResult(false);
      setHasSubmitted(false);
      setFeedback({});
      setLoading(false);
      return;
    }

    // If starting new session, end the previous one first (if exists)
    if (savedState?.exerciseSessionId) {
      endExerciseSession(savedState.exerciseSessionId).catch(err => {
        console.error('Failed to end previous exercise session:', err);
      });
      // Clear saved state since we're starting fresh
      localStorage.removeItem(STORAGE_KEY);
    }

    try {
      const res = await fetch('/resources/exercise_instructions.json');
      const data = await res.json();
      const shuffled = data.sort(() => Math.random() - 0.5);
      setInstructions(shuffled);

      // Initialize answers
      const initialAnswers: Record<string, { tuse_rs: string; tuse_rt: string; tnew: string }> = {};
      shuffled.forEach((instr: Instruction) => {
        initialAnswers[instr.name] = { tuse_rs: '', tuse_rt: '', tnew: '' };
      });
      setAnswers(initialAnswers);
      setScore(0);
      setFeedback({});
      setShowResult(false);
      setHasSubmitted(false);

      // Start exercise session
      try {
        const exerciseRes = await startExerciseSession(shuffled.length, 1);
        setExerciseSessionId(exerciseRes.exercise_session_id);
      } catch (err) {
        console.error('Failed to start exercise session:', err);
        setExerciseSessionId(null);
      }
    } catch (err) {
      console.error('Failed to load instructions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Save state whenever it changes
  useEffect(() => {
    if (!loading && selectedPart === 'AT' && instructions.length > 0 && !showResult && !showContinuePrompt && !showPartSelection) {
      const state: SavedState = {
        answers,
        currentInstructionIndex: 0,
        score,
        exerciseSessionId,
        instructions,
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY_AT, JSON.stringify(state));
    }
  }, [answers, score, exerciseSessionId, instructions, loading, showResult, showContinuePrompt, showPartSelection, selectedPart]);

  // Save Matrix state whenever it changes
  useEffect(() => {
    if (!loading && selectedPart === 'Matrix' && !matrixShowResult && !matrixShowContinuePrompt && !showPartSelection) {
      const state: MatrixSavedState = {
        answersRS: matrixAnswersRS,
        answersRT: matrixAnswersRT,
        scoreRS: matrixScoreRS,
        scoreRT: matrixScoreRT,
        sessionId: matrixSessionId,
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY_MATRIX, JSON.stringify(state));
    }
  }, [matrixAnswersRS, matrixAnswersRT, matrixScoreRS, matrixScoreRT, matrixSessionId, loading, matrixShowResult, matrixShowContinuePrompt, showPartSelection, selectedPart]);

  // Load Matrix part (combined RS + RT)
  const loadMatrixPart = async (restoreState: boolean = false) => {
    setLoading(true);
    setMatrixShowContinuePrompt(false);

    if (restoreState && matrixSavedState) {
      // Restore saved state - continue previous session
      setMatrixAnswersRS(matrixSavedState.answersRS);
      setMatrixAnswersRT(matrixSavedState.answersRT);
      setMatrixScoreRS(matrixSavedState.scoreRS);
      setMatrixScoreRT(matrixSavedState.scoreRT);
      setMatrixSessionId(matrixSavedState.sessionId);
      setMatrixFeedbackRS({});
      setMatrixFeedbackRT({});
      setMatrixSubmitted(false);
      setMatrixShowResult(false);
      setLoading(false);
      return;
    }

    // If starting new session, end the previous one first (if exists)
    if (matrixSavedState?.sessionId) {
      endExerciseSession(matrixSavedState.sessionId).catch(err => console.error(err));
      localStorage.removeItem(STORAGE_KEY_MATRIX);
    }

    // Initialize fresh state
    setMatrixAnswersRS({});
    setMatrixAnswersRT({});
    setMatrixFeedbackRS({});
    setMatrixFeedbackRT({});
    setMatrixScoreRS(0);
    setMatrixScoreRT(0);
    setMatrixSubmitted(false);
    setMatrixShowResult(false);

    // Total cells: RS (2 rows * 9 cols) + RT (3 rows * 9 cols) = 18 + 27 = 45
    const totalCells = MATRIX_ROWS_RS.length * MATRIX_COLUMNS.length + MATRIX_ROWS_RT.length * MATRIX_COLUMNS.length;

    try {
      const res = await startExerciseSession(totalCells, 2);
      setMatrixSessionId(res.exercise_session_id);
    } catch (err) {
      console.error('Failed to start matrix session:', err);
      setMatrixSessionId(null);
    }

    setLoading(false);
  };

  // Matrix answer change
  const handleMatrixAnswerChange = (type: 'RS' | 'RT', colKey: string, tuse: number, value: string) => {
    const key = `${colKey}_${tuse}`;
    if (type === 'RS') {
      setMatrixAnswersRS(prev => ({ ...prev, [key]: value }));
      setMatrixFeedbackRS(prev => ({ ...prev, [key]: undefined }));
    } else {
      setMatrixAnswersRT(prev => ({ ...prev, [key]: value }));
      setMatrixFeedbackRT(prev => ({ ...prev, [key]: undefined }));
    }
    setMatrixSubmitted(false);
  };

  // Check matrix answers
  const checkMatrixAnswers = () => {
    const newFeedbackRS: Record<string, boolean | undefined> = {};
    const newFeedbackRT: Record<string, boolean | undefined> = {};
    let newScoreRS = 0;
    let newScoreRT = 0;

    // Check RS - skip empty (Not Selected)
    MATRIX_ROWS_RS.forEach(row => {
      MATRIX_COLUMNS.forEach(col => {
        const key = `${col.key}_${row.tuse}`;
        const userAnswer = matrixAnswersRS[key];
        // Skip if not selected (empty)
        if (userAnswer === '' || userAnswer === undefined) {
          newFeedbackRS[key] = undefined;  // undefined = not checked
          return;
        }
        const correctAnswer = col.tnew <= row.tuse ? 'F' : 'S';
        const isCorrect = userAnswer === correctAnswer;
        newFeedbackRS[key] = isCorrect;
        if (isCorrect) newScoreRS++;
      });
    });

    // Check RT - skip empty (Not Selected)
    MATRIX_ROWS_RT.forEach(row => {
      MATRIX_COLUMNS.forEach(col => {
        const key = `${col.key}_${row.tuse}`;
        const userAnswer = matrixAnswersRT[key];
        // Skip if not selected (empty)
        if (userAnswer === '' || userAnswer === undefined) {
          newFeedbackRT[key] = undefined;  // undefined = not checked
          return;
        }
        const correctAnswer = col.tnew <= row.tuse ? 'F' : 'S';
        const isCorrect = userAnswer === correctAnswer;
        newFeedbackRT[key] = isCorrect;
        if (isCorrect) newScoreRT++;
      });
    });

    setMatrixFeedbackRS(newFeedbackRS);
    setMatrixFeedbackRT(newFeedbackRT);
    setMatrixScoreRS(newScoreRS);
    setMatrixScoreRT(newScoreRT);
    setMatrixSubmitted(true);

    const totalRS = MATRIX_ROWS_RS.length * MATRIX_COLUMNS.length;
    const totalRT = MATRIX_ROWS_RT.length * MATRIX_COLUMNS.length;

    // Check if all filled AND all correct
    const allFilledRS = Object.values(matrixAnswersRS).every(v => v !== '' && v !== undefined);
    const allFilledRT = Object.values(matrixAnswersRT).every(v => v !== '' && v !== undefined);
    const allCorrect = newScoreRS === totalRS && newScoreRT === totalRT;

    if (allFilledRS && allFilledRT && allCorrect) {
      setMatrixShowResult(true);
      localStorage.removeItem(STORAGE_KEY_MATRIX);
    }

    // Record to backend - only record filled answers
    if (matrixSessionId) {
      // Record RS
      MATRIX_ROWS_RS.forEach(row => {
        MATRIX_COLUMNS.forEach(col => {
          const key = `${col.key}_${row.tuse}`;
          const userAnswer = matrixAnswersRS[key] || '';
          if (userAnswer === '') return;  // Skip not selected

          const correctAnswer = col.tnew <= row.tuse ? 'F' : 'S';
          const record: ExerciseAnswerRequest = {
            exercise_session_id: matrixSessionId,
            instruction_name: `RS_${col.key}_${row.tuse}`,
            question_index: 0,
            part: 2,
            user_tuse_rs: null,
            user_tuse_rt: null,
            user_tnew: null,
            correct_tuse_rs: '',
            correct_tuse_rt: '',
            correct_tnew: '',
            matrix_row: row.tuse,
            matrix_col: col.tnew,
            user_answer: userAnswer,
            correct_answer: correctAnswer,
            is_correct: userAnswer === correctAnswer,
          };
          recordExerciseAnswer(record).catch(err => console.error(err));
        });
      });

      // Record RT
      MATRIX_ROWS_RT.forEach(row => {
        MATRIX_COLUMNS.forEach(col => {
          const key = `${col.key}_${row.tuse}`;
          const userAnswer = matrixAnswersRT[key] || '';
          if (userAnswer === '') return;  // Skip not selected

          const correctAnswer = col.tnew <= row.tuse ? 'F' : 'S';
          const record: ExerciseAnswerRequest = {
            exercise_session_id: matrixSessionId,
            instruction_name: `RT_${col.key}_${row.tuse}`,
            question_index: 0,
            part: 2,
            user_tuse_rs: null,
            user_tuse_rt: null,
            user_tnew: null,
            correct_tuse_rs: '',
            correct_tuse_rt: '',
            correct_tnew: '',
            matrix_row: row.tuse,
            matrix_col: col.tnew,
            user_answer: userAnswer,
            correct_answer: correctAnswer,
            is_correct: userAnswer === correctAnswer,
          };
          recordExerciseAnswer(record).catch(err => console.error(err));
        });
      });

      // Only end session when all correct
      if (allFilledRS && allFilledRT && allCorrect) {
        endExerciseSession(matrixSessionId).catch(err => console.error(err));
      }
    }
  };

  // Render matrix cell
  const renderMatrixCell = (type: 'RS' | 'RT', colKey: string, tuse: number) => {
    const key = `${colKey}_${tuse}`;
    const userAnswer = type === 'RS' ? matrixAnswersRS[key] || '' : matrixAnswersRT[key] || '';
    const cellFeedback = type === 'RS' ? matrixFeedbackRS[key] : matrixFeedbackRT[key];
    const isCorrect = cellFeedback === true;
    const isWrong = cellFeedback === false;

    return (
      <select
        className={`w-14 text-center py-1 border rounded font-mono text-sm appearance-none outline-none transition-colors
          ${isCorrect ? 'border-green-500 bg-green-50 text-green-700' :
            isWrong ? 'border-red-500 bg-red-50 text-red-700' :
            userAnswer ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}
          ${matrixShowResult ? 'cursor-not-allowed' : 'cursor-pointer hover:border-blue-400'}`}
        value={userAnswer}
        onChange={(e) => handleMatrixAnswerChange(type, colKey, tuse, e.target.value)}
        disabled={matrixShowResult}
      >
        <option value="">-</option>
        <option value="S">S</option>
        <option value="F">F</option>
      </select>
    );
  };

  const handleAnswerChange = (instrName: string, field: 'tuse_rs' | 'tuse_rt' | 'tnew', value: string) => {
    setAnswers(prev => ({
      ...prev,
      [instrName]: {
        ...prev[instrName],
        [field]: value,
      },
    }));
    // Only clear feedback for this instruction (keep others' feedback visible)
    setFeedback(prev => ({
      ...prev,
      [instrName]: {},
    }));
  };

  const handleViewExample = async (instr: Instruction) => {
    // Load example ASM file
    try {
      const res = await fetch(`/resources/${instr.example}`);
      const asmSource = await res.text();

      // Call parent callback to load into editor and assemble
      if (onLoadAsm) {
        onLoadAsm(asmSource);
      }

      // Close the modal so user can see the simulator
      onClose();
    } catch (err) {
      console.error('Failed to load example:', err);
    }
  };

  const checkAllAnswers = () => {
    const newFeedback: Record<string, { tuse_rs?: boolean; tuse_rt?: boolean; tnew?: boolean }> = {};
    let newScore = 0;
    let checkedCount = 0;  // Count of instructions that were fully checked (all fields filled)

    instructions.forEach(instr => {
      const userAnswer = answers[instr.name];

      // Check each field - skip if not filled (empty string)
      const checkField = (userValue: string, correctValues: (number | null)[]): boolean | undefined => {
        const mappedUser = REVERSE_STAGE_MAP[userValue];
        // undefined means not filled - skip check
        if (mappedUser === undefined) return undefined;
        // Check if answer matches any correct value
        return correctValues.some(val => val === mappedUser);
      };

      const isRsCorrect = checkField(userAnswer.tuse_rs, instr.tuse_rs);
      const isRtCorrect = checkField(userAnswer.tuse_rt, instr.tuse_rt);
      const isTnewCorrect = checkField(userAnswer.tnew, instr.tnew);

      // Only set feedback for fields that were checked (not undefined)
      newFeedback[instr.name] = {};
      if (isRsCorrect !== undefined) newFeedback[instr.name].tuse_rs = isRsCorrect;
      if (isRtCorrect !== undefined) newFeedback[instr.name].tuse_rt = isRtCorrect;
      if (isTnewCorrect !== undefined) newFeedback[instr.name].tnew = isTnewCorrect;

      // Count as correct only if all three fields are filled AND correct
      const allFilled = userAnswer.tuse_rs !== '' && userAnswer.tuse_rt !== '' && userAnswer.tnew !== '';
      const allCorrect = isRsCorrect === true && isRtCorrect === true && isTnewCorrect === true;

      if (allFilled) {
        checkedCount++;
        if (allCorrect) {
          newScore++;
        }
      }
    });

    setFeedback(newFeedback);
    setScore(newScore);
    setHasSubmitted(true);

    // Check if all filled and all correct
    const allFilledAndCorrect = newScore === instructions.length && checkedCount === instructions.length;
    if (allFilledAndCorrect) {
      setShowResult(true);
      // Clear saved state when all correct
      localStorage.removeItem(STORAGE_KEY);
    }

    // Record all answers to backend (each submit is a record)
    if (exerciseSessionId) {
      instructions.forEach((instr, index) => {
        const userAnswer = answers[instr.name];
        const instrFeedback = newFeedback[instr.name];
        const allInstrCorrect = instrFeedback?.tuse_rs === true && instrFeedback?.tuse_rt === true && instrFeedback?.tnew === true;

        // Skip recording if no fields were filled (all empty)
        if (userAnswer.tuse_rs === '' && userAnswer.tuse_rt === '' && userAnswer.tnew === '') {
          return;
        }

        const getStageString = (values: (number | null)[]): string => {
          if (values.length === 0 || values.every(v => v === null)) return '-';
          const stages = values.map(v => v === null ? null : String(v)).filter(s => s !== null);
          return stages.length === 0 ? '-' : stages.join(' / ');
        };

        // Convert user answer to backend value
        // null = Not Used, -1 = Not Selected (empty), 0-3 = stage, -99 = UNKNOWN
        const convertUserValue = (value: string): number | null => {
          if (value === '' || value === undefined) return -1;  // Not selected - use -1 to distinguish from Not Used (null)
          return REVERSE_STAGE_MAP[value] ?? null;
        };

        const record: ExerciseAnswerRequest = {
          exercise_session_id: exerciseSessionId,
          instruction_name: instr.name,
          question_index: index,
          part: 1,
          user_tuse_rs: convertUserValue(userAnswer.tuse_rs),
          user_tuse_rt: convertUserValue(userAnswer.tuse_rt),
          user_tnew: convertUserValue(userAnswer.tnew),
          correct_tuse_rs: getStageString(instr.tuse_rs),
          correct_tuse_rt: getStageString(instr.tuse_rt),
          correct_tnew: getStageString(instr.tnew),
          matrix_row: null,
          matrix_col: null,
          user_answer: '',
          correct_answer: '',
          is_correct: allInstrCorrect || false,
        };

        recordExerciseAnswer(record).catch(err => {
          console.error('Failed to record exercise answer:', err);
        });
      });

      // Only end session when all correct
      if (allFilledAndCorrect) {
        endExerciseSession(exerciseSessionId).catch(err => {
          console.error('Failed to end exercise session:', err);
        });
      }
    }
  };

  const handleClose = () => {
    // Don't end session here - user might want to continue later
    // Session will be ended when:
    // 1. User completes the exercise (showResult after submit)
    // 2. User explicitly chooses "Start New Session"
    onClose();
  };

  const getStageLabel = (values: (number | null)[]): string => {
    // Display correct answers in same format as Quiz
    const labels: Record<string, string> = {
      '0': '0 (Stage D)',
      '1': '1 (Stage E)',
      '2': '2 (Stage M)',
      '3': '3 (Stage W)',
      '-': '- (Not Used)',
    };
    if (values.length === 0 || values.every(v => v === null)) return '- (Not Used)';
    const stages = values.map(v => v === null ? null : labels[String(v)] || String(v)).filter(s => s !== null);
    return stages.length === 0 ? '- (Not Used)' : stages.join(' / ');
  };

  const renderSelect = (instrName: string, field: 'tuse_rs' | 'tuse_rt' | 'tnew') => {
    const userValue = answers[instrName]?.[field] || '';
    const fieldFeedback = feedback[instrName]?.[field];
    const isCorrect = fieldFeedback === true;
    const isWrong = fieldFeedback === false;

    return (
      <select
        className={`w-32 text-center py-1.5 border rounded font-mono text-sm appearance-none outline-none transition-colors
          ${isCorrect ? 'border-green-500 bg-green-50 text-green-700' :
            isWrong ? 'border-red-500 bg-red-50 text-red-700' :
            userValue ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}
          ${showResult ? 'cursor-not-allowed' : 'cursor-pointer hover:border-blue-400'}`}
        value={userValue}
        onChange={(e) => handleAnswerChange(instrName, field, e.target.value)}
        disabled={showResult}
      >
        {STAGE_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  };

  if (!isOpen) return null;

  const getPartLabel = () => {
    if (selectedPart === 'AT') return 'AT Method';
    if (selectedPart === 'Matrix') return 'Strategy Matrix';
    return '';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={handleClose}>
      <div
        className={`bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col transition-all
          ${isFullScreen ? 'w-full h-full max-w-none max-h-none rounded-none' : 'w-full max-w-5xl max-h-[90vh]'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">Pipeline Exercise</h2>
            {!showPartSelection && selectedPart && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{getPartLabel()}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!showPartSelection && selectedPart && (
              <button
                onClick={() => {
                  setShowPartSelection(true);
                  setSelectedPart(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                title="Change Part"
              >
                <LayoutGrid size={20} />
              </button>
            )}
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

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Part Selection */}
          {showPartSelection && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <h3 className="text-lg font-semibold text-slate-700">Select Exercise Part</h3>
                <p className="text-sm text-slate-500 mt-2">Choose which part of the pipeline exercise you want to practice</p>
              </div>
              <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
                {showPart1 && (
                  <button
                    onClick={() => handleSelectPart('AT')}
                    className="p-8 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-400 transition-all text-center"
                  >
                    <FileText size={40} className="mx-auto text-blue-600 mb-3" />
                    <div className="text-xl font-bold text-blue-700 mb-1">Part 1</div>
                    <div className="text-base text-blue-600">AT Method</div>
                  </button>
                )}
                {showPart2 && (
                  <button
                    onClick={() => handleSelectPart('Matrix')}
                    className="p-8 bg-purple-50 border-2 border-purple-200 rounded-lg hover:bg-purple-100 hover:border-purple-400 transition-all text-center"
                  >
                    <Grid3x3 size={40} className="mx-auto text-purple-600 mb-3" />
                    <div className="text-xl font-bold text-purple-700 mb-1">Part 2</div>
                    <div className="text-base text-purple-600">Strategy Matrix</div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Continue Prompt for AT Method */}
          {!showPartSelection && selectedPart === 'AT' && showContinuePrompt && savedState && (
            <div className="text-center py-8 space-y-4">
              <div className="text-lg text-slate-700">
                You have an unfinished exercise session.
              </div>
              <div className="text-sm text-slate-500">
                Previous progress: {savedState.score} correct out of {savedState.instructions?.length || 0}
              </div>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => loadInstructions(true, 'AT')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Continue Previous Session
                </button>
                <button
                  onClick={() => loadInstructions(false, 'AT')}
                  className="px-6 py-2 bg-gray-200 text-slate-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Start New Session
                </button>
              </div>
            </div>
          )}

          {/* AT Method Content */}
          {!showPartSelection && selectedPart === 'AT' && (
            loading ? (
              <div className="text-center py-10 text-slate-500">Loading...</div>
            ) : showContinuePrompt ? null : showResult ? (
              <div className="text-center py-8 space-y-6">
                <Trophy size={64} className="mx-auto text-yellow-500" />
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">Exercise Complete!</h3>
                  <p className="text-slate-600 mt-2">
                    You scored <span className="font-bold text-blue-600 text-xl">{score}</span> / {instructions.length}
                  </p>
                </div>
                <button
                  onClick={() => loadInstructions(false, 'AT')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  Practice Again
                </button>
              </div>
            ) : (
              <div className="space-y-4">
              {/* Instructions */}
              <div className="text-sm text-slate-500 mb-4">
                Fill in Tuse/Tnew for each instruction using AT Method. Click "View" to see an example program.
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700 border">Instruction</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700 border">Syntax</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700 border min-w-[160px]">Tuse (rs)</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700 border min-w-[160px]">Tuse (rt)</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700 border min-w-[160px]">Tnew</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700 border">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instructions.map((instr, idx) => {
                      const instrFeedback = feedback[instr.name] || {};
                      const hasFeedback = instrFeedback.tuse_rs !== undefined || instrFeedback.tuse_rt !== undefined || instrFeedback.tnew !== undefined;
                      const isAllCorrect = instrFeedback.tuse_rs === true && instrFeedback.tuse_rt === true && instrFeedback.tnew === true;

                      return (
                        <tr key={instr.name} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} ${hasFeedback && isAllCorrect ? 'bg-green-50' : ''}`}>
                          <td className="px-6 py-3 border font-mono font-bold text-blue-700">{instr.name}</td>
                          <td className="px-6 py-3 border font-mono text-sm text-slate-600">{instr.syntax}</td>
                          <td className="px-6 py-3 border text-center">
                            <div className="flex items-center justify-center gap-1">
                              {renderSelect(instr.name, 'tuse_rs')}
                              {instrFeedback.tuse_rs !== undefined && (
                                instrFeedback.tuse_rs ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-500" />
                              )}
                            </div>
                            {instrFeedback.tuse_rs === false && (
                              <div className="text-xs text-green-600 mt-1">
                                Correct: {getStageLabel(instr.tuse_rs)}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-3 border text-center">
                            <div className="flex items-center justify-center gap-1">
                              {renderSelect(instr.name, 'tuse_rt')}
                              {instrFeedback.tuse_rt !== undefined && (
                                instrFeedback.tuse_rt ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-500" />
                              )}
                            </div>
                            {instrFeedback.tuse_rt === false && (
                              <div className="text-xs text-green-600 mt-1">
                                Correct: {getStageLabel(instr.tuse_rt)}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-3 border text-center">
                            <div className="flex items-center justify-center gap-1">
                              {renderSelect(instr.name, 'tnew')}
                              {instrFeedback.tnew !== undefined && (
                                instrFeedback.tnew ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-500" />
                              )}
                            </div>
                            {instrFeedback.tnew === false && (
                              <div className="text-xs text-green-600 mt-1">
                                Correct: {getStageLabel(instr.tnew)}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-3 border text-center">
                            <button
                              onClick={() => handleViewExample(instr)}
                              className="px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 mx-auto bg-blue-50 text-blue-600 hover:bg-blue-100"
                              title="Load example program into simulator"
                            >
                              <Eye size={12} />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Submit Button */}
              {!showResult && (
                <button
                  onClick={checkAllAnswers}
                  className="w-full py-3 mt-6 bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all"
                >
                  Check Answers
                </button>
              )}

              {/* Feedback after check */}
              {hasSubmitted && !showResult && (
                <div className="text-center mt-4 space-y-2">
                  <div className="text-lg font-semibold text-slate-700">
                    {score} / {instructions.length} correct
                  </div>
                  {score < instructions.length && (
                    <div className="text-sm text-slate-500">
                      Fix the incorrect answers and check again
                    </div>
                  )}
                </div>
              )}

              {/* Progress */}
              <div className="flex justify-between text-sm text-slate-500 mt-4">
                <span>Answered: {Object.values(answers).filter(a => a.tuse_rs && a.tuse_rt && a.tnew).length} / {instructions.length}</span>
              </div>
            </div>
            )
          )}

          {/* Strategy Matrix Content */}
          {!showPartSelection && selectedPart === 'Matrix' && (
            loading ? (
              <div className="text-center py-10 text-slate-500">Loading...</div>
            ) : matrixShowContinuePrompt && matrixSavedState ? (
              <div className="text-center py-8 space-y-4">
                <div className="text-lg text-slate-700">
                  You have an unfinished Strategy Matrix session.
                </div>
                <div className="text-sm text-slate-500">
                  Previous progress: RS {matrixSavedState.scoreRS}/{MATRIX_ROWS_RS.length * MATRIX_COLUMNS.length},
                  RT {matrixSavedState.scoreRT}/{MATRIX_ROWS_RT.length * MATRIX_COLUMNS.length}
                </div>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => loadMatrixPart(true)}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Continue Previous Session
                  </button>
                  <button
                    onClick={() => loadMatrixPart(false)}
                    className="px-6 py-2 bg-gray-200 text-slate-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Start New Session
                  </button>
                </div>
              </div>
            ) : matrixShowContinuePrompt ? null : matrixShowResult ? (
              <div className="text-center py-8 space-y-6">
                <Trophy size={64} className="mx-auto text-yellow-500" />
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">Matrix Complete!</h3>
                  <p className="text-slate-600 mt-2">
                    RS: {matrixScoreRS}/{MATRIX_ROWS_RS.length * MATRIX_COLUMNS.length}, RT: {matrixScoreRT}/{MATRIX_ROWS_RT.length * MATRIX_COLUMNS.length}
                  </p>
                </div>
                <button
                  onClick={() => loadMatrixPart(false)}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  Practice Again
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Instructions */}
                <div className="text-sm text-slate-500">
                  <p>Fill in S (Stall) or F (Forward) for each cell based on Tuse and Tnew comparison.</p>
                </div>

                {/* RS Matrix */}
                <div>
                  <h4 className="text-lg font-semibold text-purple-700 mb-2">RS Strategy Matrix</h4>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full border-collapse">
                      <thead>
                        {/* Row 1: Stage */}
                        <tr className="bg-purple-100">
                          <th className="px-2 py-2 border text-sm font-semibold text-slate-700" rowSpan={3}>Tuse</th>
                          <th className="px-4 py-2 border text-center text-sm font-semibold text-purple-800" colSpan={3}>Stage E</th>
                          <th className="px-4 py-2 border text-center text-sm font-semibold text-purple-800" colSpan={3}>Stage M</th>
                          <th className="px-4 py-2 border text-center text-sm font-semibold text-purple-800" colSpan={3}>Stage W</th>
                        </tr>
                        {/* Row 2: Component */}
                        <tr className="bg-purple-50">
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>ALU</th>
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>DM</th>
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>PC</th>
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>ALU</th>
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>DM</th>
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>PC</th>
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>ALU</th>
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>DM</th>
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>PC</th>
                        </tr>
                        {/* Row 3: Tnew */}
                        <tr className="bg-slate-100">
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=1</th>
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=2</th>
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=0</th>
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=0</th>
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=1</th>
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=0</th>
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=0</th>
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=0</th>
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=0</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MATRIX_ROWS_RS.map(row => (
                          <tr key={row.tuse} className="bg-white">
                            <td className="px-2 py-2 border font-semibold text-slate-700 text-sm">{row.tuse}</td>
                            {MATRIX_COLUMNS.map(col => (
                              <td key={col.key} className="px-1 py-1 border text-center">
                                <div className="flex items-center justify-center">
                                  {renderMatrixCell('RS', col.key, row.tuse)}
                                  {matrixSubmitted && matrixFeedbackRS[`${col.key}_${row.tuse}`] !== undefined && (
                                    matrixFeedbackRS[`${col.key}_${row.tuse}`] ? <CheckCircle size={12} className="text-green-500 ml-1" /> : <XCircle size={12} className="text-red-500 ml-1" />
                                  )}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* RT Matrix */}
                <div>
                  <h4 className="text-lg font-semibold text-green-700 mb-2">RT Strategy Matrix</h4>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full border-collapse">
                      <thead>
                        {/* Row 1: Stage */}
                        <tr className="bg-green-100">
                          <th className="px-2 py-2 border text-sm font-semibold text-slate-700" rowSpan={3}>Tuse</th>
                          <th className="px-4 py-2 border text-center text-sm font-semibold text-green-800" colSpan={3}>Stage E</th>
                          <th className="px-4 py-2 border text-center text-sm font-semibold text-green-800" colSpan={3}>Stage M</th>
                          <th className="px-4 py-2 border text-center text-sm font-semibold text-green-800" colSpan={3}>Stage W</th>
                        </tr>
                        {/* Row 2: Component */}
                        <tr className="bg-green-50">
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>ALU</th>
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>DM</th>
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>PC</th>
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>ALU</th>
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>DM</th>
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>PC</th>
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>ALU</th>
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>DM</th>
                          <th className="px-4 py-1 border text-center text-xs font-medium text-slate-600" colSpan={1}>PC</th>
                        </tr>
                        {/* Row 3: Tnew */}
                        <tr className="bg-slate-100">
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=1</th>
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=2</th>
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=0</th>
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=0</th>
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=1</th>
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=0</th>
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=0</th>
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=0</th>
                          <th className="px-2 py-1 border text-center text-xs font-normal text-slate-500">Tnew=0</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MATRIX_ROWS_RT.map(row => (
                          <tr key={row.tuse} className="bg-white">
                            <td className="px-2 py-2 border font-semibold text-slate-700 text-sm">{row.tuse}</td>
                            {MATRIX_COLUMNS.map(col => (
                              <td key={col.key} className="px-1 py-1 border text-center">
                                <div className="flex items-center justify-center">
                                  {renderMatrixCell('RT', col.key, row.tuse)}
                                  {matrixSubmitted && matrixFeedbackRT[`${col.key}_${row.tuse}`] !== undefined && (
                                    matrixFeedbackRT[`${col.key}_${row.tuse}`] ? <CheckCircle size={12} className="text-green-500 ml-1" /> : <XCircle size={12} className="text-red-500 ml-1" />
                                  )}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  onClick={checkMatrixAnswers}
                  className="w-full py-3 mt-4 bg-purple-600 text-white rounded-lg font-bold shadow-md hover:bg-purple-700 active:scale-[0.98] transition-all"
                >
                  Check Answers
                </button>

                {/* Feedback after check */}
                {matrixSubmitted && !matrixShowResult && (
                  <div className="text-center mt-4 space-y-2">
                    <div className="text-lg font-semibold text-slate-700">
                      RS: {matrixScoreRS}/{MATRIX_ROWS_RS.length * MATRIX_COLUMNS.length} correct,
                      RT: {matrixScoreRT}/{MATRIX_ROWS_RT.length * MATRIX_COLUMNS.length} correct
                    </div>
                    {(matrixScoreRS < MATRIX_ROWS_RS.length * MATRIX_COLUMNS.length || matrixScoreRT < MATRIX_ROWS_RT.length * MATRIX_COLUMNS.length) && (
                      <div className="text-sm text-slate-500">
                        Fix the incorrect cells and check again
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default ExerciseMode;