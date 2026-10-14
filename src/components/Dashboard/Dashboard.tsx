// Dashboard Component
import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  GraduationCap,
  QrCode,
  ShieldCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  calculateDailyClassAttendance,
  calculatePunctualityPercentage,
  isSchoolDay,
  isStudentEnrolledOnDate,
} from '../../utils/calculationEngine';
import { AttendanceTrendsChart } from './AttendanceTrendsChart';

export const Dashboard: React.FC = () => {
  const {
    school,
    currentSession,
    currentTerm,
    classes,
    permittedClasses,
    students,
    permittedStudents,
    calendarDays,
    attendanceRecords,
    currentUser,
    selectedDate,
    setSelectedDate,
    setSelectedClassId,
    setActiveTab,
    canManageSchool,
    openBulkOnboarding,
    openVerifier,
    openStudentPortal,
  } = useApp();

  const [showPendingDetails, setShowPendingDetails] = useState(false);
  const [showEmptyClasses, setShowEmptyClasses] = useState(false);

  const isTodaySchoolDay = isSchoolDay(
    selectedDate,
    calendarDays,
    school.schoolDaysOfWeek
  );

  // Use permitted scope for teachers so they only see their assigned class
  const activeClasses = currentUser.role === 'TEACHER' ? permittedClasses : classes;
  const activeStudents = currentUser.role === 'TEACHER' ? permittedStudents : students;

  // Class summaries for today
  const classSummaries = useMemo(() => {
    return activeClasses.map((cls) => {
      const summary = calculateDailyClassAttendance(
        cls.id,
        `${cls.name} ${cls.arm}`,
        selectedDate,
        activeStudents,
        attendanceRecords
      );

      const recs = attendanceRecords.filter(
        (r) => r.classId === cls.id && r.date === selectedDate
      );
      const isMorningMarked =
        recs.length > 0 && recs.some((r) => r.morningStatus !== 'NOT_MARKED');
      const isAfternoonMarked =
        recs.length > 0 && recs.some((r) => r.afternoonStatus !== 'NOT_MARKED');

      return {
        cls,
        summary,
        isMorningMarked,
        isAfternoonMarked,
      };
    });
  }, [activeClasses, selectedDate, activeStudents, attendanceRecords]);

  // Aggregate School / Teacher Totals for Today
  const schoolTodayStats = useMemo(() => {
    const enrolledStudents = activeStudents.filter(
      (s) => s.status === 'ACTIVE' && isStudentEnrolledOnDate(s, selectedDate)
    );
    const totalBoys = enrolledStudents.filter((s) => s.gender === 'MALE').length;
    const totalGirls = enrolledStudents.filter((s) => s.gender === 'FEMALE').length;

    let totalMorningPresent = 0;
    let totalAfternoonPresent = 0;
    let totalLate = 0;
    let totalAbsences = 0;
    let totalExcused = 0;

    classSummaries.forEach(({ summary }) => {
      totalMorningPresent += summary.morningPresent;
      totalAfternoonPresent += summary.afternoonPresent;
      totalLate += summary.morningLate + summary.afternoonLate;
      totalAbsences += summary.morningAbsent + summary.afternoonAbsent;
      totalExcused += summary.morningExcused + summary.afternoonExcused;
    });

    const totalAttended = totalMorningPresent + totalAfternoonPresent;
    const totalPossible = enrolledStudents.length * 2;
    const overallAttPct =
      totalPossible > 0
        ? Math.round((totalAttended * 1000) / totalPossible) / 10
        : 0;

    const punctualityPct = calculatePunctualityPercentage(totalAttended, totalLate);

    return {
      enrolledCount: enrolledStudents.length,
      totalBoys,
      totalGirls,
      totalMorningPresent,
      totalAfternoonPresent,
      totalAttended,
      totalPossible,
      overallAttPct,
      totalLate,
      punctualityPct,
      totalAbsences,
      totalExcused,
    };
  }, [activeStudents, selectedDate, classSummaries]);

  // Unmarked classes alert
  const unmarkedClasses = useMemo(() => {
    return classSummaries.filter(
      (c) => !c.isMorningMarked || !c.isAfternoonMarked
    );
  }, [classSummaries]);

  // Classes with zero enrolled students (for optional display)
  const emptyClasses = useMemo(
    () => classSummaries.filter((c) => c.summary.studentsOnRoll === 0),
    [classSummaries]
  );

  // Classes with students to display in ledger
  const nonEmptyClasses = useMemo(
    () => classSummaries.filter((c) => c.summary.studentsOnRoll > 0),
    [classSummaries]
  );

  const handleQuickMark = (classId: string) => {
    setSelectedClassId(classId);
    setActiveTab('take-attendance');
  };

  return (
    <div className="space-y-5">
      {/* Top Welcome & Date Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {currentUser.role === 'TEACHER'
                ? `Teacher Dashboard — ${activeClasses
                    .map((c) => `${c.name} ${c.arm}`)
                    .join(', ') || 'My Assigned Class'}`
                : 'Attendance Dashboard'}
            </h2>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isTodaySchoolDay
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {isTodaySchoolDay ? 'School Day' : 'Non-School Day'}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span>{school.name}</span>
            <span aria-hidden="true">·</span>
            <span>{currentSession?.name || '2026/2027'}</span>
            <span aria-hidden="true">·</span>
            <span>{currentTerm?.name || 'First Term'}</span>
          </div>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Students on Roll */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {currentUser.role === 'TEACHER' ? 'My Students' : 'Students on Roll'}
            </span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-slate-900">
              {schoolTodayStats.enrolledCount}
            </div>
            <div className="text-[11px] text-slate-500">
              <span className="text-blue-600 font-semibold">
                {schoolTodayStats.totalBoys}
              </span>
              {' B · '}
              <span className="text-pink-600 font-semibold">
                {schoolTodayStats.totalGirls}
              </span>
              {' G'}
            </div>
          </div>
        </div>

        {/* Card 2: Today's Attendance % */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Attendance
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-emerald-800">
              {schoolTodayStats.overallAttPct.toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              {schoolTodayStats.totalAttended} / {schoolTodayStats.totalPossible}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            M {schoolTodayStats.totalMorningPresent} · A{' '}
            {schoolTodayStats.totalAfternoonPresent}
          </div>
        </div>

        {/* Card 3: Punctuality Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Punctuality
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-amber-700">
              {schoolTodayStats.punctualityPct.toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-500">
              {schoolTodayStats.totalLate} late
            </div>
          </div>
        </div>

        {/* Card 4: Absences */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Absences
            </span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-rose-700">
              {schoolTodayStats.totalAbsences}
            </div>
            <div className="text-[11px] text-slate-500">
              {schoolTodayStats.totalExcused} excused
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Attention Notice — collapsible */}
      {unmarkedClasses.length > 0 && isTodaySchoolDay && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPendingDetails((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs text-amber-900 hover:bg-amber-100/50 transition-colors"
          >
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {unmarkedClasses.length} class
                {unmarkedClasses.length === 1 ? '' : 'es'} haven&apos;t been
                fully marked for {selectedDate}
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-amber-700 transition-transform ${
                showPendingDetails ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showPendingDetails && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5 border-t border-amber-200/70 pt-3">
              {unmarkedClasses.map(({ cls, isMorningMarked, isAfternoonMarked }) => (
                <button
                  key={cls.id}
                  onClick={() => handleQuickMark(cls.id)}
                  className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg text-[11px] font-medium text-amber-900 transition-colors flex items-center gap-1.5"
                >
                  <span className="font-semibold">
                    {cls.name} {cls.arm}
                  </span>
                  <span className="text-[10px] text-amber-700 font-mono">
                    {!isMorningMarked ? 'AM pending' : 'PM pending'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compact Student Portal / QR bar */}
      <div className="bg-slate-900 text-white rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 border border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong className="text-white">Report Card Portal.</strong> Students
            can retrieve verified report cards by ID. QR codes are tamper-proof.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openStudentPortal()}
            className="px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Open Portal</span>
          </button>
          <button
            type="button"
            onClick={() => openVerifier()}
            className="px-3 py-1.5 text-[11px] font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Scan QR</span>
          </button>
        </div>
      </div>

      {/* Attendance Trends Chart */}
      <AttendanceTrendsChart />

      {/* Class Attendance Ledger Summary */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Attendance by Class
            </h3>
            <p className="text-xs text-slate-500">
              Morning + afternoon breakdown for {selectedDate}
            </p>
          </div>
          <button
            onClick={() => setActiveTab('take-attendance')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-2xs"
          >
            <span>Take Attendance</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-4">Class</th>
                <th className="py-2.5 px-3 text-center">On Roll</th>
                <th className="py-2.5 px-3 text-center">AM</th>
                <th className="py-2.5 px-3 text-center">PM</th>
                <th className="py-2.5 px-3 text-center">Total</th>
                <th className="py-2.5 px-3 text-center font-bold">Att. %</th>
                <th className="py-2.5 px-3 text-center">Late</th>
                <th className="py-2.5 px-3 text-center">Punct.</th>
                <th className="py-2.5 px-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nonEmptyClasses.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <div className="text-xs">
                      No classes with enrolled students yet.
                    </div>
                  </td>
                </tr>
              )}
              {nonEmptyClasses.map(({ cls, summary }) => (
                <tr key={cls.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-bold text-slate-900">
                    {cls.name}
                    <span className="ml-1.5 font-normal text-slate-500">
                      · {cls.arm}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-medium text-slate-700">
                    {summary.studentsOnRoll}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-emerald-700 font-semibold">
                    {summary.morningPresent}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-teal-700 font-semibold">
                    {summary.afternoonPresent}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                    {summary.totalSessionsAttended} / {summary.totalPossibleSessions}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-800">
                    {summary.attendancePercentage.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-amber-700">
                    {summary.morningLate + summary.afternoonLate}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                    {summary.punctualityPercentage.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => handleQuickMark(cls.id)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                    >
                      Mark
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty classes toggle */}
        {emptyClasses.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50/50">
            <button
              type="button"
              onClick={() => setShowEmptyClasses((v) => !v)}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  showEmptyClasses ? 'rotate-180' : ''
                }`}
              />
              {showEmptyClasses ? 'Hide' : 'Show'} {emptyClasses.length} empty class
              {emptyClasses.length === 1 ? '' : 'es'}
            </button>
            {showEmptyClasses && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {emptyClasses.map(({ cls }) => (
                  <span
                    key={cls.id}
                    className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded"
                  >
                    {cls.name} {cls.arm}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Access Utility Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab('paper-register')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs cursor-pointer transition-all group space-y-2"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors flex items-center justify-between">
            <span>Paper Register</span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </h4>
          <p className="text-xs text-slate-500">
            Traditional horizontal ledger with V, OO, and slash symbols.
          </p>
        </div>

        <div
          onClick={() => setActiveTab('reports')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs cursor-pointer transition-all group space-y-2"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors flex items-center justify-between">
            <span>Terminal Reports</span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </h4>
          <p className="text-xs text-slate-500">
            Printable summaries with gender breakdowns and PDF/Excel export.
          </p>
        </div>

        <div
          onClick={() => setActiveTab('students')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs cursor-pointer transition-all group space-y-2"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
            <UserPlus className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 group-hover:text-purple-700 transition-colors flex items-center justify-between">
            <span>Student Register</span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </h4>
          <p className="text-xs text-slate-500">
            Enroll admissions, handle transfers, inspect punctuality tiers.
          </p>
        </div>

        <div
          onClick={() => openBulkOnboarding('STUDENTS')}
          className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-xl border border-slate-800 hover:border-emerald-500/50 shadow-xs cursor-pointer transition-all group space-y-2"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors flex items-center justify-between">
            <span>Bulk Onboarding</span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </h4>
          <p className="text-xs text-slate-300">
            Onboard student streams or staff via Excel/CSV spreadsheets.
          </p>
        </div>
      </div>
    </div>
  );
};