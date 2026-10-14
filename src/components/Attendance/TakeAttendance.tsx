// Take Attendance Flagship Component
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle,
  CheckSquare,
  Clock,
  Download,
  Filter,
  Info,
  Lock,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Sliders,
  Smartphone,
  Sparkles,
  Table as TableIcon,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { db } from '../../services/storage';
import {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  LatenessStatus,
} from '../../types/attendance';
import {
  calculateDailyClassAttendance,
  isSchoolDay,
  isStudentEnrolledOnDate,
} from '../../utils/calculationEngine';
import { getDailyRegisterMark } from '../../utils/symbolHelper';

export const TakeAttendance: React.FC = () => {
  const {
    school,
    sessions,
    currentSession,
    terms,
    currentTerm,
    classes,
    permittedClasses,
    students,
    permittedStudents,
    calendarDays,
    attendanceRecords,
    currentUser,
    symbolSettings,
    selectedClassId,
    setSelectedClassId,
    selectedDate,
    setSelectedDate,
    canEditAttendance,
    addToast,
    refreshData,
  } = useApp();

  // Selected session & term
  const [sessionId, setSessionId] = useState<string>(
    currentSession?.id || sessions[0]?.id || ''
  );
  const [termId, setTermId] = useState<string>(
    currentTerm?.id || terms[0]?.id || ''
  );

  // Active view session filter: 'BOTH' | 'MORNING' | 'AFTERNOON'
  const [sessionFilter, setSessionFilter] = useState<'BOTH' | 'MORNING' | 'AFTERNOON'>('BOTH');
  // Mobile touch mode vs standard table
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);

  // Student search filter
  const [studentSearch, setStudentSearch] = useState<string>('');

  // Confirmation modal state for "Mark All Absent" and "Bulk Reset"
  const [showMarkAllAbsentModal, setShowMarkAllAbsentModal] = useState<boolean>(false);
  const [showBulkResetModal, setShowBulkResetModal] = useState<boolean>(false);
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [notesModalStudentId, setNotesModalStudentId] = useState<string | null>(null);

  // Configurable School Start Time for automated lateness flagging
  const [schoolStartTime, setSchoolStartTime] = useState<string>(
    school.morningStartTime || '08:00'
  );

  // Local working attendance state for current class and date: Map studentId -> Partial<AttendanceRecord>
  const [workingRecords, setWorkingRecords] = useState<
    Record<
      string,
      {
        morningStatus: AttendanceStatus;
        afternoonStatus: AttendanceStatus;
        morningLateness: LatenessStatus;
        afternoonLateness: LatenessStatus;
        morningArrivalTime?: string;
        afternoonArrivalTime?: string;
        notes?: string;
      }
    >
  >({});

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Target class - strictly within permitted classes for teacher
  const activeClass = permittedClasses.find((c) => c.id === selectedClassId) || permittedClasses[0];

  // Eligible students enrolled on selectedDate (strictly within teacher's permitted students)
  const enrolledStudents = useMemo(() => {
    if (!activeClass) return [];
    return permittedStudents
      .filter((s) => s.classId === activeClass.id)
      .filter((s) => isStudentEnrolledOnDate(s, selectedDate))
      .sort((a, b) => a.admissionNumber.localeCompare(b.admissionNumber));
  }, [permittedStudents, activeClass, selectedDate]);

  // Filtered students based on search query (name or admission number)
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return enrolledStudents;
    const q = studentSearch.trim().toLowerCase();
    return enrolledStudents.filter((s) => {
      const fullName = `${s.firstName} ${s.middleName || ''} ${s.lastName}`.toLowerCase();
      const reverseName = `${s.lastName} ${s.firstName} ${s.middleName || ''}`.toLowerCase();
      const adm = (s.admissionNumber || '').toLowerCase();
      return (
        fullName.includes(q) ||
        reverseName.includes(q) ||
        adm.includes(q)
      );
    });
  }, [enrolledStudents, studentSearch]);

  const isFiltering = studentSearch.trim().length > 0;

  // Is selected date a school day?
  const isDateASchoolDay = useMemo(() => {
    return isSchoolDay(selectedDate, calendarDays, school.schoolDaysOfWeek);
  }, [selectedDate, calendarDays, school.schoolDaysOfWeek]);

  // Load existing records or draft when selected class or date changes
  useEffect(() => {
    if (!activeClass) return;

    // First check existing DB records
    const existingList = attendanceRecords.filter(
      (r) => r.classId === activeClass.id && r.date === selectedDate
    );

    // Also check if any draft exists
    const draft = db.getDraft(activeClass.id, selectedDate);

    const initialMap: Record<string, any> = {};

    enrolledStudents.forEach((student) => {
      const existing = existingList.find((r) => r.studentId === student.id);
      const draftItem = draft?.data?.[student.id];

      if (draftItem) {
        initialMap[student.id] = draftItem;
      } else if (existing) {
        initialMap[student.id] = {
          morningStatus: existing.morningStatus,
          afternoonStatus: existing.afternoonStatus,
          morningLateness: existing.morningLateness,
          afternoonLateness: existing.afternoonLateness,
          morningArrivalTime: existing.morningArrivalTime || '',
          afternoonArrivalTime: existing.afternoonArrivalTime || '',
          notes: existing.notes || '',
        };
      } else {
        // Defaults: NOT_MARKED
        initialMap[student.id] = {
          morningStatus: 'NOT_MARKED',
          afternoonStatus: 'NOT_MARKED',
          morningLateness: 'ON_TIME',
          afternoonLateness: 'ON_TIME',
          morningArrivalTime: '',
          afternoonArrivalTime: '',
          notes: '',
        };
      }
    });

    setWorkingRecords(initialMap);
    setHasUnsavedChanges(false);
    setStudentSearch('');
  }, [activeClass?.id, selectedDate, enrolledStudents.length]);

  // Update configured School Start Time in school settings
  const handleUpdateSchoolStartTime = (newTime: string) => {
    setSchoolStartTime(newTime);
    db.updateSchool({ morningStartTime: newTime });
    refreshData();
    addToast({
      type: 'success',
      title: 'School Start Time Updated',
      message: `School start time set to ${newTime}. Attendance automatically flags arrivals after ${newTime} as Late.`,
    });
  };

  // Automated Late Flagging based on student arrival time
  const handleArrivalTimeChange = (
    studentId: string,
    session: AttendanceSession,
    time: string
  ) => {
    if (!canEdit) return;

    const threshold =
      session === 'MORNING'
        ? schoolStartTime
        : school.afternoonStartTime || '13:00';
    const isLate = Boolean(time && time > threshold);

    setWorkingRecords((prev) => {
      const cur = prev[studentId] || {
        morningStatus: 'NOT_MARKED',
        afternoonStatus: 'NOT_MARKED',
        morningLateness: 'ON_TIME',
        afternoonLateness: 'ON_TIME',
      };

      const updated = { ...cur };
      if (session === 'MORNING') {
        updated.morningArrivalTime = time;
        if (time) {
          updated.morningStatus = 'PRESENT';
          updated.morningLateness = isLate ? 'LATE' : 'ON_TIME';
        }
      } else {
        updated.afternoonArrivalTime = time;
        if (time) {
          updated.afternoonStatus = 'PRESENT';
          updated.afternoonLateness = isLate ? 'LATE' : 'ON_TIME';
        }
      }

      const next = { ...prev, [studentId]: updated };
      if (activeClass) db.saveDraft(activeClass.id, selectedDate, next);
      return next;
    });

    setHasUnsavedChanges(true);
  };

  // Quick check-in helper with current local time
  const handleQuickCheckIn = (
    studentId: string,
    session: AttendanceSession
  ) => {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${hh}:${mm}`;
    handleArrivalTimeChange(studentId, session, currentTimeStr);

    const threshold =
      session === 'MORNING'
        ? schoolStartTime
        : school.afternoonStartTime || '13:00';
    const isLate = currentTimeStr > threshold;

    addToast({
      type: isLate ? 'warning' : 'success',
      title: isLate ? 'Flagged LATE' : 'Checked In On Time',
      message: `Clocked at ${currentTimeStr}. ${
        isLate
          ? `Late: Exceeded school start time (${threshold})`
          : `On-time: Arrived by ${threshold}`
      }`,
    });
  };

  // Handle individual status change
  const handleStatusChange = (
    studentId: string,
    session: AttendanceSession,
    status: AttendanceStatus
  ) => {
    if (!canEdit) return;

    setWorkingRecords((prev) => {
      const cur = prev[studentId] || {
        morningStatus: 'NOT_MARKED',
        afternoonStatus: 'NOT_MARKED',
        morningLateness: 'ON_TIME',
        afternoonLateness: 'ON_TIME',
      };

      const updated = { ...cur };
      if (session === 'MORNING') {
        updated.morningStatus = status;
        if (status === 'PRESENT') {
          if (updated.morningArrivalTime) {
            updated.morningLateness =
              updated.morningArrivalTime > schoolStartTime ? 'LATE' : 'ON_TIME';
          }
        } else {
          updated.morningLateness = 'ON_TIME';
        }
      } else {
        updated.afternoonStatus = status;
        if (status === 'PRESENT') {
          const aftThreshold = school.afternoonStartTime || '13:00';
          if (updated.afternoonArrivalTime) {
            updated.afternoonLateness =
              updated.afternoonArrivalTime > aftThreshold ? 'LATE' : 'ON_TIME';
          }
        } else {
          updated.afternoonLateness = 'ON_TIME';
        }
      }

      const next = { ...prev, [studentId]: updated };
      if (activeClass) {
        db.saveDraft(activeClass.id, selectedDate, next);
      }
      return next;
    });

    setHasUnsavedChanges(true);
  };

  // Handle manual lateness toggle
  const handleLatenessToggle = (
    studentId: string,
    session: AttendanceSession
  ) => {
    if (!canEdit) return;

    setWorkingRecords((prev) => {
      const cur = prev[studentId];
      if (!cur) return prev;

      if (session === 'MORNING' && cur.morningStatus !== 'PRESENT') return prev;
      if (session === 'AFTERNOON' && cur.afternoonStatus !== 'PRESENT') return prev;

      const updated = { ...cur };
      if (session === 'MORNING') {
        const willBeLate = cur.morningLateness !== 'LATE';
        updated.morningLateness = willBeLate ? 'LATE' : 'ON_TIME';
        if (willBeLate && !updated.morningArrivalTime) {
          const [sh, sm] = schoolStartTime.split(':').map(Number);
          const lateM = (sm + 15) % 60;
          const lateH = sh + Math.floor((sm + 15) / 60);
          updated.morningArrivalTime = `${lateH.toString().padStart(2, '0')}:${lateM.toString().padStart(2, '0')}`;
        }
      } else {
        const willBeLate = cur.afternoonLateness !== 'LATE';
        updated.afternoonLateness = willBeLate ? 'LATE' : 'ON_TIME';
      }

      const next = { ...prev, [studentId]: updated };
      if (activeClass) db.saveDraft(activeClass.id, selectedDate, next);
      return next;
    });

    setHasUnsavedChanges(true);
  };

  // Batch action: Mark All Present
  const handleMarkAllPresent = (session: 'BOTH' | 'MORNING' | 'AFTERNOON') => {
    if (!canEdit) return;

    setWorkingRecords((prev) => {
      const next = { ...prev };
      enrolledStudents.forEach((s) => {
        const cur = next[s.id] || {
          morningStatus: 'NOT_MARKED',
          afternoonStatus: 'NOT_MARKED',
          morningLateness: 'ON_TIME',
          afternoonLateness: 'ON_TIME',
        };

        if (session === 'BOTH' || session === 'MORNING') {
          cur.morningStatus = 'PRESENT';
          if (!cur.morningArrivalTime) {
            cur.morningArrivalTime = schoolStartTime;
          }
          cur.morningLateness = cur.morningArrivalTime > schoolStartTime ? 'LATE' : 'ON_TIME';
        }
        if (session === 'BOTH' || session === 'AFTERNOON') {
          cur.afternoonStatus = 'PRESENT';
          const aftThreshold = school.afternoonStartTime || '13:00';
          if (!cur.afternoonArrivalTime) {
            cur.afternoonArrivalTime = aftThreshold;
          }
          cur.afternoonLateness = cur.afternoonArrivalTime > aftThreshold ? 'LATE' : 'ON_TIME';
        }
        next[s.id] = { ...cur };
      });

      if (activeClass) db.saveDraft(activeClass.id, selectedDate, next);
      return next;
    });

    setHasUnsavedChanges(true);
    addToast({
      type: 'info',
      title: 'Batch Action: Marked All Present',
      message: `Marked all ${enrolledStudents.length} students as PRESENT for ${session.toLowerCase()} session.`,
    });
  };

  // Batch action: Bulk Reset
  const confirmBulkReset = () => {
    if (!canEdit || !activeClass) return;

    setWorkingRecords((prev) => {
      const next = { ...prev };
      enrolledStudents.forEach((s) => {
        next[s.id] = {
          morningStatus: 'NOT_MARKED',
          afternoonStatus: 'NOT_MARKED',
          morningLateness: 'ON_TIME',
          afternoonLateness: 'ON_TIME',
          morningArrivalTime: '',
          afternoonArrivalTime: '',
          notes: '',
        };
      });
      db.clearDraft(activeClass.id, selectedDate);
      return next;
    });

    setHasUnsavedChanges(true);
    setShowBulkResetModal(false);
    addToast({
      type: 'warning',
      title: 'Bulk Reset Completed',
      message: `Reset attendance and arrival records for all ${enrolledStudents.length} students in ${activeClass.name} ${activeClass.arm}.`,
    });
  };

  // Batch action: Mark All Absent (Triggered from confirmation modal)
  const confirmMarkAllAbsent = () => {
    if (!canEdit) return;

    setWorkingRecords((prev) => {
      const next = { ...prev };
      enrolledStudents.forEach((s) => {
        const cur = next[s.id] || {
          morningStatus: 'NOT_MARKED',
          afternoonStatus: 'NOT_MARKED',
          morningLateness: 'ON_TIME',
          afternoonLateness: 'ON_TIME',
        };
        cur.morningStatus = 'ABSENT';
        cur.afternoonStatus = 'ABSENT';
        cur.morningLateness = 'ON_TIME';
        cur.afternoonLateness = 'ON_TIME';
        cur.morningArrivalTime = '';
        cur.afternoonArrivalTime = '';
        next[s.id] = { ...cur };
      });
      if (activeClass) db.saveDraft(activeClass.id, selectedDate, next);
      return next;
    });

    setHasUnsavedChanges(true);
    setShowMarkAllAbsentModal(false);
    addToast({
      type: 'warning',
      title: 'Class Marked Absent',
      message: 'All enrolled students marked ABSENT for both sessions.',
    });
  };

  // Save to Database
  const handleSaveAttendance = () => {
    if (!activeClass || !canEdit) return;

    setIsSaving(true);
    try {
      const recordsToSave = enrolledStudents.map((s) => {
        const rec = workingRecords[s.id] || {
          morningStatus: 'NOT_MARKED',
          afternoonStatus: 'NOT_MARKED',
          morningLateness: 'ON_TIME',
          afternoonLateness: 'ON_TIME',
        };
        return {
          studentId: s.id,
          morningStatus: rec.morningStatus,
          afternoonStatus: rec.afternoonStatus,
          morningLateness: rec.morningLateness,
          afternoonLateness: rec.afternoonLateness,
          morningArrivalTime: rec.morningArrivalTime || undefined,
          afternoonArrivalTime: rec.afternoonArrivalTime || undefined,
          notes: rec.notes || undefined,
        };
      });

      const result = db.saveClassAttendance({
        recordsToSave,
        currentUser,
        schoolId: school.id,
        classId: activeClass.id,
        date: selectedDate,
        termId,
        sessionId,
        changeReason: correctionReason.trim() || undefined,
      });

      setHasUnsavedChanges(false);
      setCorrectionReason('');
      refreshData();

      addToast({
        type: 'success',
        title: 'Attendance Saved',
        message: `Saved ${result.savedCount} student records. Punctuality scores automatically recalculated on student profiles.${
          result.auditsLogged > 0
            ? ` (${result.auditsLogged} audit corrections logged)`
            : ''
        }`,
      });
    } catch (e: any) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: e.message || 'Could not save attendance',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Calculations for sticky progress header
  const progressStats = useMemo(() => {
    const total = enrolledStudents.length;
    let mMarked = 0;
    let aMarked = 0;
    let mPresent = 0;
    let aPresent = 0;
    let lateCount = 0;

    enrolledStudents.forEach((s) => {
      const rec = workingRecords[s.id];
      if (rec) {
        if (rec.morningStatus !== 'NOT_MARKED') mMarked++;
        if (rec.afternoonStatus !== 'NOT_MARKED') aMarked++;
        if (rec.morningStatus === 'PRESENT') {
          mPresent++;
          if (rec.morningLateness === 'LATE') lateCount++;
        }
        if (rec.afternoonStatus === 'PRESENT') {
          aPresent++;
          if (rec.afternoonLateness === 'LATE') lateCount++;
        }
      }
    });

    const totalAttended = mPresent + aPresent;
    const totalPossible = total * 2;
    const attPercentage =
      totalPossible > 0 ? (totalAttended * 100) / totalPossible : 0;
    const punctPercentage =
      totalAttended > 0 ? ((totalAttended - lateCount) * 100) / totalAttended : 100;

    return {
      total,
      mMarked,
      aMarked,
      mPresent,
      aPresent,
      lateCount,
      attPercentage: Math.round(attPercentage * 10) / 10,
      punctPercentage: Math.round(punctPercentage * 10) / 10,
    };
  }, [enrolledStudents, workingRecords]);

  const canEdit = canEditAttendance(activeClass?.id);
  const activeTerm = terms.find((t) => t.id === termId);

  return (
    <div className="space-y-4">
      {/* Top Banner if Term is Finalized */}
      {activeTerm?.isFinalized && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-amber-900 text-xs">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Term Finalized:</strong> {activeTerm.name} is marked as
              finalized. Attendance records are locked and cannot be edited by
              standard teachers.
            </span>
          </div>
          {currentUser.role === 'SUPER_ADMIN' && (
            <span className="text-[11px] font-semibold bg-amber-200/80 px-2 py-0.5 rounded text-amber-900">
              Super Admin Override Active
            </span>
          )}
        </div>
      )}

      {/* No assigned class warning for teachers */}
      {permittedClasses.length === 0 && currentUser.role === 'TEACHER' && (
        <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Assigned Class Roster</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            You are logged in as <strong>{currentUser.name}</strong> (Teacher), but you are not currently assigned to any class arm.
            Teachers can only see and record attendance for students in their assigned class.
          </p>
          <div className="text-[11px] text-slate-400 font-mono">
            Please ask the School Administrator to assign you to a class register in Settings.
          </div>
        </div>
      )}

      {/* Non-school day alert */}
      {!isDateASchoolDay && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 text-blue-900 text-xs">
          <Info className="w-4 h-4 text-blue-700 shrink-0" />
          <span>
            <strong>Note:</strong> {selectedDate} is currently marked as a
            non-school day (weekend or holiday) in the calendar. You can still
            record attendance if an extraordinary session occurred.
          </span>
        </div>
      )}

      {/* Primary Selector Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Class Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Class & Arm
              </label>
              {currentUser.role === 'TEACHER' && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  Assigned
                </span>
              )}
            </div>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {permittedClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.arm} ({permittedStudents.filter((s) => s.classId === c.id).length} on roll)
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {/* Academic Session */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Academic Session
            </label>
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isCurrent ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Term */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Term
            </label>
            <select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.status}) {t.isFinalized ? '🔒' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sub-bar: Session Tab Filter & View Mode */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setSessionFilter('BOTH')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                sessionFilter === 'BOTH'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Both Sessions
            </button>
            <button
              onClick={() => setSessionFilter('MORNING')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                sessionFilter === 'MORNING'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Morning</span>
              <span className="text-[10px] text-slate-400 font-mono">
                ({progressStats.mMarked}/{progressStats.total})
              </span>
            </button>
            <button
              onClick={() => setSessionFilter('AFTERNOON')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                sessionFilter === 'AFTERNOON'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Afternoon</span>
              <span className="text-[10px] text-slate-400 font-mono">
                ({progressStats.aMarked}/{progressStats.total})
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileMode(!isMobileMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                isMobileMode
                  ? 'bg-slate-900 text-white border-slate-900 font-medium'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Toggle mobile-optimized large card view"
            >
              {isMobileMode ? (
                <>
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Table View</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Fast Mobile Mode</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Configurable School Start Time & Automated Late Flagging Banner */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 text-xs">
          <div className="flex items-center gap-2.5 text-amber-950">
            <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold flex items-center gap-1.5">
                <span>Configured School Start Time:</span>
                <span className="font-mono bg-amber-200/80 px-2 py-0.5 rounded text-amber-950 font-bold text-xs">
                  {schoolStartTime}
                </span>
              </div>
              <p className="text-[11px] text-amber-900/80 mt-0.5">
                Students clocking in or arriving after <strong>{schoolStartTime}</strong> are automatically flagged as <span className="font-bold text-rose-700">LATE</span>. Punctuality scores update automatically upon saving.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-amber-900 whitespace-nowrap">
              Adjust Start Time:
            </label>
            <input
              type="time"
              value={schoolStartTime}
              onChange={(e) => handleUpdateSchoolStartTime(e.target.value)}
              className="px-2.5 py-1 text-xs font-mono font-bold bg-white border border-amber-300 rounded-lg text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Sticky Progress & Batch Bar */}
      <div className="sticky top-16 z-20 bg-slate-900 text-white p-3.5 rounded-xl shadow-md border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left stats */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div>
              <span className="text-slate-400">Class:</span>{' '}
              <span className="font-semibold text-white">
                {activeClass?.name} {activeClass?.arm}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Enrolled:</span>{' '}
              <span className="font-semibold text-white font-mono">
                {progressStats.total}
              </span>
            </div>
            <div className="hidden sm:block">
              <span className="text-slate-400">Marked:</span>{' '}
              <span className="font-mono text-emerald-400 font-semibold">
                M: {progressStats.mMarked}/{progressStats.total} · A:{' '}
                {progressStats.aMarked}/{progressStats.total}
              </span>
            </div>
            <div className="hidden md:block">
              <span className="text-slate-400">Attendance:</span>{' '}
              <span className="font-mono text-teal-300 font-semibold">
                {progressStats.attPercentage}%
              </span>
            </div>
            <div className="hidden lg:block">
              <span className="text-slate-400">Punctuality:</span>{' '}
              <span className="font-mono text-amber-300 font-semibold">
                {progressStats.punctPercentage}%
              </span>
            </div>
          </div>

          {/* Right Batch & Save Controls */}
          <div className="flex items-center gap-2">
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => handleMarkAllPresent(sessionFilter)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-2xs transition-colors"
                  title="Mark All Present (all enrolled students for this session)"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Mark All Present</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkResetModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg transition-colors"
                  title="Bulk Reset (clear all attendance marks for this class/date)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Bulk Reset</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowMarkAllAbsentModal(true)}
                  className="px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-lg border border-slate-700 transition-colors"
                  title="Mark all students absent (Requires confirmation)"
                >
                  Mark All Absent
                </button>
              </>
            )}

            <button
              onClick={handleSaveAttendance}
              disabled={isSaving || !canEdit}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg shadow-sm transition-all ${
                hasUnsavedChanges
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'Saved'}</span>
            </button>
          </div>
        </div>

        {/* Student Search Bar */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search student by name or admission number..."
              className="w-full pl-9 pr-9 py-1.5 text-xs bg-slate-800 text-white placeholder-slate-400 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
            {isFiltering && (
              <button
                type="button"
                onClick={() => setStudentSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {isFiltering && (
            <span className="text-[11px] font-mono text-slate-300 whitespace-nowrap">
              Showing <strong className="text-white">{filteredStudents.length}</strong> of{' '}
              <strong className="text-white">{enrolledStudents.length}</strong>
              {filteredStudents.length === 0 && (
                <span className="ml-2 text-amber-400">— no matches</span>
              )}
            </span>
          )}
        </div>

        {/* Optional change reason input if editing past records */}
        {hasUnsavedChanges && (
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Audit Note / Reason for update (optional, e.g. Parent call note)..."
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              className="w-full bg-slate-800 text-xs text-white placeholder-slate-400 px-2.5 py-1 rounded border border-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>
        )}
      </div>

      {/* Confirmation Modal for Bulk Reset */}
      {showBulkResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Bulk Reset Class Attendance?
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Are you sure you want to reset attendance for{' '}
                  <strong>
                    {activeClass?.name} {activeClass?.arm}
                  </strong>{' '}
                  on <strong>{selectedDate}</strong>?
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  This will reset all morning and afternoon marks (Present, Absent, Excused),
                  arrival timestamps, and lateness flags for all {enrolledStudents.length} students to Unmarked.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBulkResetModal(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkReset}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Yes, Reset Attendance</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Mark All Absent */}
      {showMarkAllAbsentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Confirm Mark Entire Class Absent?
                </h3>
                <p className="text-xs text-slate-500">
                  This action marks all {enrolledStudents.length} students as
                  ABSENT for both morning and afternoon sessions on {selectedDate}.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              Are you sure? This should normally only happen during unscheduled
              class strikes or special events. You can still correct individual
              students afterward.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowMarkAllAbsentModal(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmMarkAllAbsent}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors"
              >
                Yes, Mark All Absent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes modal */}
      {notesModalStudentId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl p-5 shadow-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900">
                Attendance Note for{' '}
                {
                  enrolledStudents.find((s) => s.id === notesModalStudentId)
                    ?.firstName
                }
              </h4>
              <button
                onClick={() => setNotesModalStudentId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              rows={3}
              value={workingRecords[notesModalStudentId]?.notes || ''}
              onChange={(e) => {
                const text = e.target.value;
                setWorkingRecords((prev) => ({
                  ...prev,
                  [notesModalStudentId]: {
                    ...prev[notesModalStudentId],
                    notes: text,
                  },
                }));
                setHasUnsavedChanges(true);
              }}
              placeholder="e.g. Arrived late with parent note; Fever clinic visit..."
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <div className="flex justify-end">
              <button
                onClick={() => setNotesModalStudentId(null)}
                className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Student Attendance List: Standard Table or Mobile Card View */}
      {isMobileMode ? (
        /* FAST MOBILE ATTENDANCE CARD VIEW */
        <div className="space-y-3">
          {filteredStudents.length === 0 && isFiltering && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
              No students match "<strong>{studentSearch}</strong>". Try a
              different name or admission number.
            </div>
          )}
          {filteredStudents.map((student, idx) => {
            const rec = workingRecords[student.id] || {
              morningStatus: 'NOT_MARKED',
              afternoonStatus: 'NOT_MARKED',
              morningLateness: 'ON_TIME',
              afternoonLateness: 'ON_TIME',
            };
            const mark = getDailyRegisterMark(
              rec.morningStatus,
              rec.afternoonStatus,
              symbolSettings
            );

            return (
              <div
                key={student.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 transition-colors hover:border-slate-300"
              >
                {/* Header: Student details + Register Mark badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        #{idx + 1}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">
                        {student.lastName.toUpperCase()}, {student.firstName}{' '}
                        {student.middleName || ''}
                      </h3>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.2 rounded font-mono ${
                          student.gender === 'MALE'
                            ? 'text-blue-700 bg-blue-50'
                            : 'text-pink-700 bg-pink-50'
                        }`}
                      >
                        {student.gender === 'MALE' ? 'M' : 'F'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      {student.admissionNumber}
                    </div>
                  </div>

                  {/* Register mark */}
                  <div
                    className={`px-3 py-1 text-sm font-bold rounded-lg border border-slate-200/80 font-mono text-center min-w-[42px] ${mark.colorClass}`}
                    title={mark.title}
                  >
                    {mark.symbol}
                  </div>
                </div>

                {/* Session Marking Buttons (Touch Targets >= 44px) */}
                {(sessionFilter === 'BOTH' || sessionFilter === 'MORNING') && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        Morning Session
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <input
                            type="time"
                            value={rec.morningArrivalTime || ''}
                            onChange={(e) =>
                              handleArrivalTimeChange(
                                student.id,
                                'MORNING',
                                e.target.value
                              )
                            }
                            className="w-16 text-[11px] font-mono bg-transparent text-slate-800 focus:outline-none"
                            title="Arrival Time (Flagged late after school start time)"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickCheckIn(student.id, 'MORNING')
                            }
                            className="text-[10px] font-bold text-amber-700 hover:text-amber-900 ml-1"
                            title="Set current time"
                          >
                            Now
                          </button>
                        </div>

                        {rec.morningStatus === 'PRESENT' && (
                          <button
                            onClick={() =>
                              handleLatenessToggle(student.id, 'MORNING')
                            }
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded transition-colors ${
                              rec.morningLateness === 'LATE'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {rec.morningLateness === 'LATE'
                              ? `⚠️ Late (> ${schoolStartTime})`
                              : '✓ On Time'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() =>
                          handleStatusChange(student.id, 'MORNING', 'PRESENT')
                        }
                        className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                          rec.morningStatus === 'PRESENT'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                      >
                        <Check className="w-4 h-4" /> Present
                      </button>
                      <button
                        onClick={() =>
                          handleStatusChange(student.id, 'MORNING', 'ABSENT')
                        }
                        className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                          rec.morningStatus === 'ABSENT'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700'
                        }`}
                      >
                        <X className="w-4 h-4" /> Absent
                      </button>
                      <button
                        onClick={() =>
                          handleStatusChange(student.id, 'MORNING', 'EXCUSED')
                        }
                        className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                          rec.morningStatus === 'EXCUSED'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700'
                        }`}
                      >
                        Excused
                      </button>
                    </div>
                  </div>
                )}

                {(sessionFilter === 'BOTH' || sessionFilter === 'AFTERNOON') && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        Afternoon Session
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <input
                            type="time"
                            value={rec.afternoonArrivalTime || ''}
                            onChange={(e) =>
                              handleArrivalTimeChange(
                                student.id,
                                'AFTERNOON',
                                e.target.value
                              )
                            }
                            className="w-16 text-[11px] font-mono bg-transparent text-slate-800 focus:outline-none"
                            title="Afternoon Arrival Time"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickCheckIn(student.id, 'AFTERNOON')
                            }
                            className="text-[10px] font-bold text-teal-700 hover:text-teal-900 ml-1"
                            title="Set current time"
                          >
                            Now
                          </button>
                        </div>

                        {rec.afternoonStatus === 'PRESENT' && (
                          <button
                            onClick={() =>
                              handleLatenessToggle(student.id, 'AFTERNOON')
                            }
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded transition-colors ${
                              rec.afternoonLateness === 'LATE'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                : 'bg-teal-50 text-teal-800 border border-teal-200'
                            }`}
                          >
                            {rec.afternoonLateness === 'LATE'
                              ? '⚠️ Late'
                              : '✓ On Time'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() =>
                          handleStatusChange(student.id, 'AFTERNOON', 'PRESENT')
                        }
                        className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                          rec.afternoonStatus === 'PRESENT'
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-700'
                        }`}
                      >
                        <Check className="w-4 h-4" /> Present
                      </button>
                      <button
                        onClick={() =>
                          handleStatusChange(student.id, 'AFTERNOON', 'ABSENT')
                        }
                        className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                          rec.afternoonStatus === 'ABSENT'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700'
                        }`}
                      >
                        <X className="w-4 h-4" /> Absent
                      </button>
                      <button
                        onClick={() =>
                          handleStatusChange(student.id, 'AFTERNOON', 'EXCUSED')
                        }
                        className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                          rec.afternoonStatus === 'EXCUSED'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700'
                        }`}
                      >
                        Excused
                      </button>
                    </div>
                  </div>
                )}

                {/* Note toggle */}
                <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
                  <button
                    onClick={() => setNotesModalStudentId(student.id)}
                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{rec.notes ? `Note: "${rec.notes}"` : 'Add note...'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DESKTOP RESPONSIVE TABLE VIEW */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-semibold border-b border-slate-800">
                  <th className="py-3 px-3 w-12 text-center">No.</th>
                  <th className="py-3 px-3 w-28">Adm. No.</th>
                  <th className="py-3 px-3 min-w-[180px]">Student Name</th>
                  <th className="py-3 px-2 w-12 text-center">Sex</th>

                  {/* Morning Column */}
                  {(sessionFilter === 'BOTH' || sessionFilter === 'MORNING') && (
                    <th className="py-3 px-3 min-w-[210px] text-center border-l border-slate-800 bg-slate-850">
                      Morning Session
                    </th>
                  )}

                  {/* Afternoon Column */}
                  {(sessionFilter === 'BOTH' || sessionFilter === 'AFTERNOON') && (
                    <th className="py-3 px-3 min-w-[210px] text-center border-l border-slate-800 bg-slate-850">
                      Afternoon Session
                    </th>
                  )}

                  <th className="py-3 px-3 w-24 text-center border-l border-slate-800">
                    Register Mark
                  </th>
                  <th className="py-3 px-3 w-28 text-center border-l border-slate-800">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 && isFiltering && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No students match "<strong>{studentSearch}</strong>". Try a
                      different name or admission number.
                    </td>
                  </tr>
                )}
                {filteredStudents.map((student, idx) => {
                  const rec = workingRecords[student.id] || {
                    morningStatus: 'NOT_MARKED',
                    afternoonStatus: 'NOT_MARKED',
                    morningLateness: 'ON_TIME',
                    afternoonLateness: 'ON_TIME',
                  };
                  const mark = getDailyRegisterMark(
                    rec.morningStatus,
                    rec.afternoonStatus,
                    symbolSettings
                  );

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-700">
                        {student.admissionNumber}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        <div className="font-semibold">
                          {student.lastName.toUpperCase()}, {student.firstName}{' '}
                          {student.middleName || ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`font-mono text-[11px] font-bold ${
                            student.gender === 'MALE'
                              ? 'text-blue-600'
                              : 'text-pink-600'
                          }`}
                        >
                          {student.gender === 'MALE' ? 'M' : 'F'}
                        </span>
                      </td>

                      {/* Morning Session Buttons */}
                      {(sessionFilter === 'BOTH' || sessionFilter === 'MORNING') && (
                        <td className="py-2 px-3 border-l border-slate-100 bg-slate-50/30">
                          <div className="flex flex-col sm:flex-row items-center gap-2 justify-center">
                            <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusChange(
                                    student.id,
                                    'MORNING',
                                    'PRESENT'
                                  )
                                }
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                                  rec.morningStatus === 'PRESENT'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                                }`}
                              >
                                P
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusChange(
                                    student.id,
                                    'MORNING',
                                    'ABSENT'
                                  )
                                }
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                                  rec.morningStatus === 'ABSENT'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50'
                                }`}
                              >
                                A
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusChange(
                                    student.id,
                                    'MORNING',
                                    'EXCUSED'
                                  )
                                }
                                className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${
                                  rec.morningStatus === 'EXCUSED'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                                }`}
                              >
                                E
                              </button>
                            </div>

                            {/* Morning Arrival Time & Late Status */}
                            <div className="flex items-center gap-1">
                              <input
                                type="time"
                                value={rec.morningArrivalTime || ''}
                                onChange={(e) =>
                                  handleArrivalTimeChange(
                                    student.id,
                                    'MORNING',
                                    e.target.value
                                  )
                                }
                                className="w-18 px-1.5 py-0.5 text-[10px] font-mono border border-slate-200 rounded bg-white text-slate-800 focus:outline-none"
                                title={`Arrival time (Flagged late after ${schoolStartTime})`}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickCheckIn(student.id, 'MORNING')
                                }
                                className="p-1 hover:bg-slate-200 text-slate-500 rounded text-[10px]"
                                title="Clock in now with current time"
                              >
                                <Clock className="w-3 h-3 text-slate-500" />
                              </button>
                            </div>

                            {/* Morning Late indicator / toggle */}
                            {rec.morningStatus === 'PRESENT' && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleLatenessToggle(student.id, 'MORNING')
                                }
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                  rec.morningLateness === 'LATE'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}
                                title="Toggle morning lateness"
                              >
                                {rec.morningLateness === 'LATE'
                                  ? '⚠️ LATE'
                                  : '✓ ON TIME'}
                              </button>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Afternoon Session Buttons */}
                      {(sessionFilter === 'BOTH' || sessionFilter === 'AFTERNOON') && (
                        <td className="py-2 px-3 border-l border-slate-100 bg-slate-50/30">
                          <div className="flex flex-col sm:flex-row items-center gap-2 justify-center">
                            <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusChange(
                                    student.id,
                                    'AFTERNOON',
                                    'PRESENT'
                                  )
                                }
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                                  rec.afternoonStatus === 'PRESENT'
                                    ? 'bg-teal-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50'
                                }`}
                              >
                                P
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusChange(
                                    student.id,
                                    'AFTERNOON',
                                    'ABSENT'
                                  )
                                }
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                                  rec.afternoonStatus === 'ABSENT'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50'
                                }`}
                              >
                                A
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusChange(
                                    student.id,
                                    'AFTERNOON',
                                    'EXCUSED'
                                  )
                                }
                                className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${
                                  rec.afternoonStatus === 'EXCUSED'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                                }`}
                              >
                                E
                              </button>
                            </div>

                            {/* Afternoon Arrival Time & Late Status */}
                            <div className="flex items-center gap-1">
                              <input
                                type="time"
                                value={rec.afternoonArrivalTime || ''}
                                onChange={(e) =>
                                  handleArrivalTimeChange(
                                    student.id,
                                    'AFTERNOON',
                                    e.target.value
                                  )
                                }
                                className="w-18 px-1.5 py-0.5 text-[10px] font-mono border border-slate-200 rounded bg-white text-slate-800 focus:outline-none"
                                title="Afternoon arrival time"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickCheckIn(student.id, 'AFTERNOON')
                                }
                                className="p-1 hover:bg-slate-200 text-slate-500 rounded text-[10px]"
                                title="Clock in now with current time"
                              >
                                <Clock className="w-3 h-3 text-slate-500" />
                              </button>
                            </div>

                            {/* Afternoon Late indicator / toggle */}
                            {rec.afternoonStatus === 'PRESENT' && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleLatenessToggle(student.id, 'AFTERNOON')
                                }
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                  rec.afternoonLateness === 'LATE'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-teal-50 text-teal-800 border border-teal-200'
                                }`}
                                title="Toggle afternoon lateness"
                              >
                                {rec.afternoonLateness === 'LATE'
                                  ? '⚠️ LATE'
                                  : '✓ ON TIME'}
                              </button>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Register Mark Preview */}
                      <td className="py-2 px-3 text-center border-l border-slate-100">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-xs font-mono font-bold border border-slate-200/80 ${mark.colorClass}`}
                          title={mark.title}
                        >
                          {mark.symbol}
                        </span>
                      </td>

                      {/* Notes / Modal */}
                      <td className="py-2 px-3 text-center border-l border-slate-100">
                        <button
                          type="button"
                          onClick={() => setNotesModalStudentId(student.id)}
                          className={`text-[11px] px-2 py-0.5 rounded truncate max-w-[100px] border transition-colors ${
                            rec.notes
                              ? 'bg-blue-50 text-blue-700 border-blue-200 font-medium'
                              : 'text-slate-400 hover:text-slate-700 border-transparent hover:border-slate-200'
                          }`}
                        >
                          {rec.notes ? rec.notes : '+ Note'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};