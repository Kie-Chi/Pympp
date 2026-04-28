import React, { useState, useEffect } from 'react';
import { X, Users, BarChart3, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import {
  getQuizAdminSessions, getQuizAdminStats, getQuizAdminRecords,
  getExerciseAdminSessions, getExerciseAdminStats, getExerciseAdminRecords
} from '../api/client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const AdminPanel: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'quiz' | 'exercise'>('quiz');
  const [sessions, setSessions] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showRecords, setShowRecords] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'quiz') {
        const sessionsData = await getQuizAdminSessions();
        const statsData = await getQuizAdminStats();
        const recordsData = await getQuizAdminRecords(50);
        setSessions(sessionsData);
        setStats(statsData);
        setRecords(recordsData);
      } else {
        const sessionsData = await getExerciseAdminSessions();
        const statsData = await getExerciseAdminStats();
        const recordsData = await getExerciseAdminRecords(50);
        setSessions(sessionsData);
        setStats(statsData);
        setRecords(recordsData);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dt: string | null) => {
    if (!dt) return '-';
    return new Date(dt).toLocaleString();
  };

  const formatStageValue = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '- (Not Used)';
    if (value === -1) return '- (Not Selected)';
    if (value === -99) return 'UNKNOWN';
    const labels = ['0 (Stage D)', '1 (Stage E)', '2 (Stage M)', '3 (Stage W)'];
    return labels[value] || String(value);
  };

  // Check if user answer matches correct answer
  const isFieldCorrect = (userValue: number | null | undefined, correctStr: string): boolean => {
    if (userValue === undefined || userValue === -1) return true; // Not selected, skip correctness check
    const userDisplay = formatStageValue(userValue);
    // Handle multiple correct answers (e.g., "0 / 1")
    const correctOptions = correctStr.split(' / ').map(s => {
      if (s === '-' || s === '') return '- (Not Used)';
      const num = parseInt(s);
      if (isNaN(num)) return s;
      return formatStageValue(num);
    });
    return correctOptions.includes(userDisplay);
  };

  const isTuseRsCorrect = (r: any) => isFieldCorrect(r.user_tuse_rs, r.correct_tuse_rs);
  const isTuseRtCorrect = (r: any) => isFieldCorrect(r.user_tuse_rt, r.correct_tuse_rt);
  const isTnewCorrect = (r: any) => isFieldCorrect(r.user_tnew, r.correct_tnew);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col transition-all
          ${isFullScreen ? 'w-full h-full max-w-none max-h-none rounded-none' : 'w-full max-w-4xl max-h-[90vh]'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-slate-600" />
            <h2 className="text-xl font-bold text-slate-800">Admin Dashboard</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData()}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
            >
              {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 flex-shrink-0">
          <button
            onClick={() => setActiveTab('quiz')}
            className={`px-4 py-2 font-medium transition-colors ${activeTab === 'quiz' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Quiz Records
          </button>
          <button
            onClick={() => setActiveTab('exercise')}
            className={`px-4 py-2 font-medium transition-colors ${activeTab === 'exercise' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Exercise Records
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-10 text-slate-500">Loading...</div>
          ) : (
            <div className="space-y-6">
              {/* Stats Summary */}
              {stats && (
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-100 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-slate-800">{stats.total_sessions}</div>
                    <div className="text-sm text-slate-500">Total Sessions</div>
                  </div>
                  <div className="bg-slate-100 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-slate-800">{stats.total_questions}</div>
                    <div className="text-sm text-slate-500">Total Records</div>
                  </div>
                  <div className="bg-slate-100 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.correct_count}</div>
                    <div className="text-sm text-slate-500">Correct</div>
                  </div>
                  <div className="bg-slate-100 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-slate-800">{(stats.accuracy_rate * 100).toFixed(1)}%</div>
                    <div className="text-sm text-slate-500">Accuracy</div>
                  </div>
                </div>
              )}

              {/* Most Wrong Instructions */}
              {stats?.most_wrong_instructions?.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="text-sm font-semibold text-red-700 mb-2">Most Wrong Instructions</div>
                  <div className="flex gap-2">
                    {stats.most_wrong_instructions.map((instr: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-red-100 text-red-600 rounded text-sm font-mono">{instr}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sessions Table */}
              <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <BarChart3 size={18} />
                  Sessions ({sessions.length})
                </h3>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-4 py-3 text-left">Session ID</th>
                        <th className="px-4 py-3 text-left">User</th>
                        <th className="px-4 py-3 text-center">Questions</th>
                        <th className="px-4 py-3 text-center">Correct</th>
                        <th className="px-4 py-3 text-left">Started</th>
                        <th className="px-4 py-3 text-left">Ended</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.slice(0, 20).map((s, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-4 py-3 font-mono text-xs">{activeTab === 'quiz' ? s.quiz_session_id : s.exercise_session_id?.slice(0, 8)}...</td>
                          <td className="px-4 py-3 font-mono text-xs">{s.session_id?.slice(0, 8)}...</td>
                          <td className="px-4 py-3 text-center">{s.actual_answered || s.total_questions}</td>
                          <td className="px-4 py-3 text-center font-semibold text-green-600">{s.correct_count}</td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">{formatDateTime(s.started_at)}</td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">{formatDateTime(s.ended_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Toggle Records View */}
              <button
                onClick={() => setShowRecords(!showRecords)}
                className="w-full py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm font-medium"
              >
                {showRecords ? 'Hide Individual Records' : `Show Individual Records (${records.length})`}
              </button>

              {/* Records Table */}
              {showRecords && (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-4 py-3 text-left">Time</th>
                        <th className="px-4 py-3 text-left">User</th>
                        <th className="px-4 py-3 text-left">Instruction</th>
                        <th className="px-4 py-3 text-center min-w-[120px]">Tuse(rs)</th>
                        <th className="px-4 py-3 text-center min-w-[120px]">Tuse(rt)</th>
                        <th className="px-4 py-3 text-center min-w-[120px]">Tnew</th>
                        <th className="px-4 py-3 text-center">Correct</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.slice(0, 50).map((r, i) => (
                        <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} ${r.is_correct ? '' : 'bg-red-50'}`}>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                          <td className="px-4 py-3 font-mono text-xs">{r.session_id?.slice(0, 8)}...</td>
                          <td className="px-4 py-3 font-mono font-semibold text-blue-700">{r.instruction_name}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded ${isTuseRsCorrect(r) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {formatStageValue(r.user_tuse_rs)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded ${isTuseRtCorrect(r) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {formatStageValue(r.user_tuse_rt)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded ${isTnewCorrect(r) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {formatStageValue(r.user_tnew)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {r.is_correct ? <span className="text-green-600 font-semibold">Yes</span> : <span className="text-red-600 font-semibold">No</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;