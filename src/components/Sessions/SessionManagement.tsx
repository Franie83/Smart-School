// Academic Sessions and Term Finalization Component
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  History,
  Lock,
  Plus,
  ShieldAlert,
  Trash2,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { db } from '../../services/storage';
import { AcademicSession, Term } from '../../types/attendance';
import {
  calculateTermSchoolDays,
  getSchoolDaysInRange,
} from '../../utils/calculationEngine';

export const SessionManagement: React.FC = () => {
  const {
    school,
    sessions,
    terms,
    calendarDays,
    currentUser,
    canManageSchool,
    termUnlockLogs,
    addToast,
    refreshData,
  } = useApp();

  // Today's date as a YYYY-MM-DD string (local timezone)
  const today = new Date();
  const _todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [showAddTermModal, setShowAddTermModal] = useState(false);
  const [unlockTermTarget, setUnlockTermTarget] = useState<Term | null>(null);
  const [unlockReason, setUnlockReason] = useState('');

  // --- Edit modal state ---
  const [editingSession, setEditingSession] = useState<AcademicSession | null>(null);
  const [editSessionName, setEditSessionName] = useState('');
  const [editSessionStart, setEditSessionStart] = useState('');
  const [editSessionEnd, setEditSessionEnd] = useState('');
  const [editSessionIsCurrent, setEditSessionIsCurrent] = useState(false);

  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [editTermName, setEditTermName] = useState('');
  const [editTermStart, setEditTermStart] = useState('');
  const [editTermEnd, setEditTermEnd] = useState('');
  const [editTermStatus, setEditTermStatus] = useState<'UPCOMING' | 'ACTIVE' | 'COMPLETED'>('UPCOMING');
  const [editTermOpeningOverride, setEditTermOpeningOverride] = useState('');

  // --- Delete modal state ---
  const [deletingSession, setDeletingSession] = useState<AcademicSession | null>(null);
  const [deletingTerm, setDeletingTerm] = useState<Term | null>(null);

  // Form states (add)
  const [sessionName, setSessionName] = useState('2027/2028');
  const [sessionStartDate, setSessionStartDate] = useState(_todayString);
  const [sessionEndDate, setSessionEndDate] = useState(_todayString);

  const [termName, setTermName] = useState('First Term');
  const [termSessionId, setTermSessionId] = useState(sessions[0]?.id || '');
  const [termStartDate, setTermStartDate] = useState(_todayString);
  const [termEndDate, setTermEndDate] = useState(_todayString);
  const [termOpeningOverride, setTermOpeningOverride] = useState('');

  // Save new session
  const handleSaveSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName.trim()) return;

    db.addSession({
      schoolId: school.id,
      name: sessionName.trim(),
      startDate: sessionStartDate,
      endDate: sessionEndDate,
      isCurrent: false,
    });

    addToast({
      type: 'success',
      title: 'Session Created',
      message: `Academic session ${sessionName} created successfully.`,
    });

    setShowAddSessionModal(false);
    refreshData();
  };

  // Save new term
  const handleSaveTerm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termName.trim()) return;

    db.addTerm({
      schoolId: school.id,
      sessionId: termSessionId,
      name: termName.trim(),
      startDate: termStartDate,
      endDate: termEndDate,
      status: 'UPCOMING',
      manualSchoolOpeningDays: termOpeningOverride
        ? parseInt(termOpeningOverride, 10)
        : undefined,
    });

    addToast({
      type: 'success',
      title: 'Term Added',
      message: `${termName} added to academic schedule.`,
    });

    setShowAddTermModal(false);
    refreshData();
  };

  // --- Edit Session ---
  const handleOpenEditSession = (sess: AcademicSession) => {
    setEditingSession(sess);
    setEditSessionName(sess.name);
    setEditSessionStart(sess.startDate);
    setEditSessionEnd(sess.endDate);
    setEditSessionIsCurrent(sess.isCurrent);
  };

  const handleSaveSessionEdits = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;

    db.updateSession(editingSession.id, {
      name: editSessionName.trim(),
      startDate: editSessionStart,
      endDate: editSessionEnd,
      isCurrent: editSessionIsCurrent,
    });

    addToast({
      type: 'success',
      title: 'Session Updated',
      message: `${editSessionName} has been updated.${editSessionIsCurrent && !editingSession.isCurrent ? ' Now the current session.' : ''}`,
    });

    setEditingSession(null);
    refreshData();
  };

  // --- Edit Term ---
  const handleOpenEditTerm = (term: Term) => {
    setEditingTerm(term);
    setEditTermName(term.name);
    setEditTermStart(term.startDate);
    setEditTermEnd(term.endDate);
    setEditTermStatus(term.status);
    setEditTermOpeningOverride(
      term.manualSchoolOpeningDays != null ? String(term.manualSchoolOpeningDays) : ''
    );
  };

  const handleSaveTermEdits = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTerm) return;

    db.updateTerm(editingTerm.id, {
      name: editTermName.trim(),
      startDate: editTermStart,
      endDate: editTermEnd,
      status: editTermStatus,
      manualSchoolOpeningDays: editTermOpeningOverride
        ? parseInt(editTermOpeningOverride, 10)
        : undefined,
    });

    addToast({
      type: 'success',
      title: 'Term Updated',
      message: `${editTermName} has been updated.`,
    });

    setEditingTerm(null);
    refreshData();
  };

  // --- Delete Session ---
  const handleOpenDeleteSession = (sess: AcademicSession) => {
    // Guard: can't delete the only session
    if (sessions.length <= 1) {
      addToast({
        type: 'error',
        title: 'Cannot Delete',
        message: 'You must keep at least one academic session.',
      });
      return;
    }
    // Guard: can't delete the current session
    if (sess.isCurrent || sess.id === school.academicSessionId) {
      addToast({
        type: 'error',
        title: 'Cannot Delete',
        message: 'This is the current session. Set another session as current first.',
      });
      return;
    }
    setDeletingSession(sess);
  };

  const handleConfirmDeleteSession = () => {
    if (!deletingSession) return;
    const result = db.removeSession(deletingSession.id);
    if (result.removed) {
      addToast({
        type: 'success',
        title: 'Session Deleted',
        message: `${deletingSession.name} removed.${result.termsRemoved > 0 ? ` (${result.termsRemoved} term${result.termsRemoved === 1 ? '' : 's'} also deleted)` : ''}`,
      });
    }
    setDeletingSession(null);
    refreshData();
  };

  // --- Delete Term ---
  const handleOpenDeleteTerm = (term: Term) => {
    // Guard: can't delete the current term
    if (term.id === school.currentTermId) {
      addToast({
        type: 'error',
        title: 'Cannot Delete',
        message: 'This is the current term. Set another term as current first.',
      });
      return;
    }
    // Guard: can't delete the only term in a session
    const siblingTerms = terms.filter((t) => t.sessionId === term.sessionId);
    if (siblingTerms.length <= 1) {
      addToast({
        type: 'error',
        title: 'Cannot Delete',
        message: 'This is the only term in its session. Add another term first.',
      });
      return;
    }
    setDeletingTerm(term);
  };

  const handleConfirmDeleteTerm = () => {
    if (!deletingTerm) return;
    const ok = db.removeTerm(deletingTerm.id);
    if (ok) {
      addToast({
        type: 'success',
        title: 'Term Deleted',
        message: `${deletingTerm.name} removed from its session.`,
      });
    }
    setDeletingTerm(null);
    refreshData();
  };

  // Finalize term
  const handleFinalizeTerm = (term: Term) => {
    if (!canManageSchool()) return;
    const ok = window.confirm(
      `Are you sure you want to FINALIZE "${term.name}"? Attendance records will be locked against modifications by normal teachers.`
    );
    if (!ok) return;

    db.finalizeTerm(term.id, currentUser.id);
    addToast({
      type: 'warning',
      title: 'Term Finalized',
      message: `${term.name} is now finalized and locked.`,
    });
    refreshData();
  };

  // Unlock term with audit trail
  const handleConfirmUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockTermTarget || !unlockReason.trim()) {
      addToast({
        type: 'error',
        title: 'Reason Required',
        message: 'You must provide a valid audit reason for unlocking a finalized term.',
      });
      return;
    }

    db.unlockTerm(unlockTermTarget.id, currentUser, unlockReason.trim());
    addToast({
      type: 'success',
      title: 'Term Unlocked',
      message: `${unlockTermTarget.name} unlocked. Attendance corrections permitted.`,
    });

    setUnlockTermTarget(null);
    setUnlockReason('');
    refreshData();
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Academic Sessions &amp; Term Governance
          </h2>
          <p className="text-xs text-slate-500">
            Manage annual academic sessions, terms, opening day calculations, and
            official term finalization locks.
          </p>
        </div>

        {canManageSchool() && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddSessionModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Session</span>
            </button>
            <button
              onClick={() => setShowAddTermModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Term</span>
            </button>
          </div>
        )}
      </div>

      {/* Sessions and Terms Grid */}
      <div className="space-y-4">
        {sessions.map((sess) => {
          const sessionTerms = terms.filter((t) => t.sessionId === sess.id);
          const isCurrentSession = sess.isCurrent || sess.id === school.academicSessionId;

          return (
            <div
              key={sess.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900">
                    Academic Session {sess.name}
                  </h3>
                  {isCurrentSession && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">
                      Current Session
                    </span>
                  )}
                  <span className="text-xs font-mono text-slate-500 ml-1">
                    {sess.startDate} to {sess.endDate}
                  </span>
                </div>

                {canManageSchool() && (
                  <div className="flex items-center gap-1">
                    {!isCurrentSession && (
                      <button
                        type="button"
                        onClick={() => {
                          db.setCurrentSession(sess.id);
                          addToast({
                            type: 'success',
                            title: 'Current Session Changed',
                            message: `${sess.name} is now the active session across the app.`,
                          });
                          refreshData();
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                        title="Set as current session"
                      >
                        Set as Current
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenEditSession(sess)}
                      className="p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                      title="Edit session"
                      aria-label="Edit session"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteSession(sess)}
                      className="p-1.5 rounded text-slate-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                      title="Delete session"
                      aria-label="Delete session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Terms inside session */}
              {sessionTerms.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50 border border-dashed border-slate-200 rounded-lg">
                  No terms defined for this session yet. Click <strong>Add Term</strong> above to create one.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {sessionTerms.map((term) => {
                    const { daysList, totalDays } = calculateTermSchoolDays(
                      term,
                      calendarDays,
                      school.schoolDaysOfWeek
                    );
                    const isCurrentTerm = term.id === school.currentTermId;

                    return (
                      <div
                        key={term.id}
                        className={`p-4 rounded-xl border transition-all space-y-3 ${
                          term.isFinalized
                            ? 'bg-amber-50/50 border-amber-200'
                            : term.status === 'ACTIVE'
                            ? 'bg-emerald-50/30 border-emerald-200'
                            : 'bg-slate-50/50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-bold text-slate-900">
                                {term.name}
                              </span>
                              {isCurrentTerm && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">
                                  CURRENT
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              {term.startDate} to {term.endDate}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {term.isFinalized ? (
                              <span
                                className="p-1.5 rounded-lg bg-amber-100 text-amber-800"
                                title="Term finalized &amp; locked"
                              >
                                <Lock className="w-4 h-4" />
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                                {term.status}
                              </span>
                            )}
                            {canManageSchool() && !term.isFinalized && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditTerm(term)}
                                  className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                  title="Edit term"
                                  aria-label="Edit term"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDeleteTerm(term)}
                                  className="p-1 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                                  title="Delete term"
                                  aria-label="Delete term"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Days Calculation */}
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 text-xs font-mono flex items-center justify-between">
                          <span className="text-slate-500 font-sans">
                            School Opening Days:
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {totalDays} days
                          </span>
                        </div>

                        {term.manualSchoolOpeningDays != null && (
                          <div className="text-[10px] text-indigo-700 font-medium">
                            * Admin manual override applied
                          </div>
                        )}

                        {/* Lock / Unlock Actions */}
                        {canManageSchool() && (
                          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                            {term.isFinalized ? (
                              <button
                                onClick={() => {
                                  setUnlockTermTarget(term);
                                  setUnlockReason('');
                                }}
                                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors border border-amber-300"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                <span>Unlock Term (Audit Logged)</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleFinalizeTerm(term)}
                                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                              >
                                <Lock className="w-3.5 h-3.5 text-slate-500" />
                                <span>Finalize Term</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unlock Term Audit History */}
      {termUnlockLogs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
            <History className="w-4 h-4 text-amber-600" />
            <span>Term Unlock Governance Log</span>
          </div>
          <div className="space-y-2">
            {termUnlockLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-1"
              >
                <div className="flex items-center justify-between text-amber-900 font-semibold">
                  <span>
                    {log.termName} unlocked by {log.unlockedByUserName}
                  </span>
                  <span className="font-mono text-[10px] text-amber-700">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="text-slate-600">
                  <strong>Reason:</strong> {log.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unlock Term Modal with Mandatory Reason */}
      {unlockTermTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-700">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Unlock Finalized Term: {unlockTermTarget.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Unlocking allows attendance modifications. This action is
                  strictly recorded in the audit trail.
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmUnlock} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Unlocking Term *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Authorized by Principal to correct medical absence on 2026-09-18 per clinic report..."
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUnlockTermTarget(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg"
                >
                  Confirm &amp; Unlock Term
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {editingSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl p-5 shadow-xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                Edit Academic Session
              </h3>
              <button
                onClick={() => setEditingSession(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSessionEdits} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Session Name
                </label>
                <input
                  type="text"
                  required
                  value={editSessionName}
                  onChange={(e) => setEditSessionName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={editSessionStart}
                  onChange={(e) => setEditSessionStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  required
                  value={editSessionEnd}
                  onChange={(e) => setEditSessionEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <label className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer hover:bg-emerald-100/50">
                <input
                  type="checkbox"
                  checked={editSessionIsCurrent}
                  onChange={(e) => setEditSessionIsCurrent(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span className="text-xs font-semibold text-emerald-900">
                  Set as current session across the app
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 text-white font-bold rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Term Modal */}
      {editingTerm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl p-5 shadow-xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Edit Term</h3>
              <button
                onClick={() => setEditingTerm(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTermEdits} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Term Name
                </label>
                <input
                  type="text"
                  required
                  value={editTermName}
                  onChange={(e) => setEditTermName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editTermStart}
                    onChange={(e) => setEditTermStart(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editTermEnd}
                    onChange={(e) => setEditTermEnd(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={editTermStatus}
                  onChange={(e) => setEditTermStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="UPCOMING">Upcoming</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Manual Opening Days Override (Optional)
                </label>
                <input
                  type="number"
                  placeholder="Leave empty for auto-calculated days"
                  value={editTermOpeningOverride}
                  onChange={(e) => setEditTermOpeningOverride(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTerm(null)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 text-white font-bold rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Session Modal */}
      {deletingSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  Delete Session {deletingSession.name}?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  This will also delete all terms that belong to this session.
                </p>
              </div>
              <button
                onClick={() => setDeletingSession(null)}
                className="text-slate-400 hover:text-slate-600 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const orphanedTerms = terms.filter((t) => t.sessionId === deletingSession.id);
              return orphanedTerms.length > 0 ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-900">
                  <strong>{orphanedTerms.length}</strong> term{orphanedTerms.length === 1 ? '' : 's'} will also be deleted:
                  <ul className="list-disc list-inside mt-1 ml-1 space-y-0.5">
                    {orphanedTerms.map((t) => (
                      <li key={t.id}>{t.name} ({t.startDate} → {t.endDate})</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
                  This session has no terms. It can be deleted safely.
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingSession(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSession}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Session</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Term Modal */}
      {deletingTerm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  Delete Term {deletingTerm.name}?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  This cannot be undone. Attendance records for this term remain in the system, but the term will no longer appear in dropdowns.
                </p>
              </div>
              <button
                onClick={() => setDeletingTerm(null)}
                className="text-slate-400 hover:text-slate-600 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingTerm(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTerm}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Term</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Session Modal */}
      {showAddSessionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl p-5 shadow-xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                Create Academic Session
              </h3>
              <button
                onClick={() => setShowAddSessionModal(false)}
                className="text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Session Name (e.g. 2027/2028)
                </label>
                <input
                  type="text"
                  required
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Session Start Date
                </label>
                <input
                  type="date"
                  required
                  value={sessionStartDate}
                  onChange={(e) => setSessionStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Session End Date
                </label>
                <input
                  type="date"
                  required
                  value={sessionEndDate}
                  onChange={(e) => setSessionEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddSessionModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 text-white font-bold rounded-lg"
                >
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Term Modal */}
      {showAddTermModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl p-5 shadow-xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                Add Term to Session
              </h3>
              <button
                onClick={() => setShowAddTermModal(false)}
                className="text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTerm} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Academic Session
                </label>
                <select
                  value={termSessionId}
                  onChange={(e) => setTermSessionId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Term Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. First Term, Second Term"
                  value={termName}
                  onChange={(e) => setTermName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={termStartDate}
                    onChange={(e) => setTermStartDate(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={termEndDate}
                    onChange={(e) => setTermEndDate(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Manual School Opening Days Override (Optional)
                </label>
                <input
                  type="number"
                  placeholder="Leave empty for auto-calculated days"
                  value={termOpeningOverride}
                  onChange={(e) => setTermOpeningOverride(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddTermModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 text-white font-bold rounded-lg"
                >
                  Save Term
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};