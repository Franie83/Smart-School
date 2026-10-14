// Reports Hub Component
import React, { useMemo, useState } from 'react';
import {
  Award,
  Calendar,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Printer,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  calculateDailyClassAttendance,
  calculateStudentAttendanceSummary,
  calculateTerminalClassSummary,
  getSchoolDaysInRange,
  isSchoolDay,
  isStudentEnrolledOnDate,
} from '../../utils/calculationEngine';
import {
  exportTerminalReportToExcel,
  exportTerminalReportToPDF,
  exportWeeklyReportToCSV,
} from '../../utils/exportEngine';
import { getDailyRegisterMark } from '../../utils/symbolHelper';
import { formatLocalDate } from '../../utils/dateUtils';

export const ReportsHub: React.FC = () => {
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
    symbolSettings,
    allUsers,
    currentUser,
    selectedClassId,
    setSelectedClassId,
    setActiveTab,
    addToast,
  } = useApp();

  // Active Report Tab: 'TERMINAL' | 'WEEKLY' | 'MONTHLY'
  const [reportType, setReportType] = useState<'TERMINAL' | 'WEEKLY' | 'MONTHLY'>('TERMINAL');

  // Selected Term
  const [termId, setTermId] = useState<string>(
    currentTerm?.id || terms[0]?.id || ''
  );
  const activeTerm = terms.find((t) => t.id === termId) || currentTerm || terms[0];

  // Selected Week Start Date (Monday of week)
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>('2026-09-07');
  // Selected Month
  const [selectedMonth, setSelectedMonth] = useState<string>((() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }));

  const activeClass = permittedClasses.find((c) => c.id === selectedClassId) || permittedClasses[0];
  const classTeacher = allUsers.find((u) => u.id === activeClass?.teacherId);

  // --- TERMINAL SUMMARY CALCULATION ---
  const terminalSummary = useMemo(() => {
    if (!activeClass || !activeTerm) return null;
    return calculateTerminalClassSummary(
      activeClass.id,
      `${activeClass.name} ${activeClass.arm}`,
      activeTerm,
      calendarDays,
      permittedStudents,
      attendanceRecords,
      school.schoolDaysOfWeek
    );
  }, [
    activeClass,
    activeTerm,
    calendarDays,
    permittedStudents,
    attendanceRecords,
    school.schoolDaysOfWeek,
  ]);

  // --- WEEKLY DATA CALCULATION ---
  const weeklyData = useMemo(() => {
    if (!activeClass) return { weekDays: [], studentRows: [], classTotals: null };

    // 5 school days: Monday to Friday
    const monday = new Date(selectedWeekStart + 'T00:00:00');
    const weekDays: { dateStr: string; label: string; isSchoolDay: boolean }[] = [];
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = formatLocalDate(d);
      weekDays.push({
        dateStr,
        label: `${dayLabels[i]} (${dateStr.slice(5)})`,
        isSchoolDay: isSchoolDay(dateStr, calendarDays, school.schoolDaysOfWeek),
      });
    }

    const classStudents = permittedStudents
      .filter((s) => s.classId === activeClass.id)
      .sort((a, b) => a.admissionNumber.localeCompare(b.admissionNumber));

    const studentRows = classStudents.map((s) => {
      let totalAttended = 0;
      let possibleSessions = 0;
      let lateCount = 0;
      const daysMap: Record<
        string,
        {
          morning: string;
          afternoon: string;
          symbol: string;
          late: boolean;
        }
      > = {};

      weekDays.forEach((wd) => {
        if (!wd.isSchoolDay) {
          daysMap[wd.dateStr] = {
            morning: '—',
            afternoon: '—',
            symbol: '—',
            late: false,
          };
          return;
        }

        const enrolled = isStudentEnrolledOnDate(s, wd.dateStr);
        if (!enrolled) {
          daysMap[wd.dateStr] = {
            morning: '—',
            afternoon: '—',
            symbol: '—',
            late: false,
          };
          return;
        }

        possibleSessions += 2;
        const rec = attendanceRecords.find(
          (r) => r.studentId === s.id && r.date === wd.dateStr
        );

        if (rec) {
          if (rec.morningStatus === 'PRESENT') totalAttended++;
          if (rec.afternoonStatus === 'PRESENT') totalAttended++;
          if (rec.morningLateness === 'LATE') lateCount++;
          if (rec.afternoonLateness === 'LATE') lateCount++;

          const mark = getDailyRegisterMark(
            rec.morningStatus,
            rec.afternoonStatus,
            symbolSettings
          );
          daysMap[wd.dateStr] = {
            morning: rec.morningStatus === 'PRESENT' ? '\\' : rec.morningStatus === 'ABSENT' ? 'O' : 'E',
            afternoon: rec.afternoonStatus === 'PRESENT' ? '/' : rec.afternoonStatus === 'ABSENT' ? 'O' : 'E',
            symbol: mark.symbol,
            late: rec.morningLateness === 'LATE' || rec.afternoonLateness === 'LATE',
          };
        } else {
          daysMap[wd.dateStr] = {
            morning: '-',
            afternoon: '-',
            symbol: '-',
            late: false,
          };
        }
      });

      const attPct =
        possibleSessions > 0
          ? Math.round((totalAttended * 1000) / possibleSessions) / 10
          : 0;

      return {
        student: s,
        admissionNumber: s.admissionNumber,
        name: `${s.lastName.toUpperCase()}, ${s.firstName}`,
        gender: s.gender === 'MALE' ? 'M' : 'F',
        days: daysMap,
        totalAttended,
        possibleSessions,
        attendancePercentage: attPct,
        lateCount,
      };
    });

    return { weekDays, studentRows };
  }, [
    activeClass,
    selectedWeekStart,
    calendarDays,
    students,
    attendanceRecords,
    symbolSettings,
    school.schoolDaysOfWeek,
  ]);

  // Handle PDF Export
  const handleExportPDF = () => {
    if (!terminalSummary || !activeClass) return;
    try {
      exportTerminalReportToPDF({
        school,
        sessionName: currentSession?.name || '2026/2027',
        termName: activeTerm?.name || 'First Term',
        className: `${activeClass.name} ${activeClass.arm}`,
        teacherName: classTeacher?.name || 'Form Teacher',
        summary: terminalSummary,
      });
      addToast({
        type: 'success',
        title: 'PDF Generated',
        message: 'Official terminal report downloaded in landscape format.',
      });
    } catch (e: any) {
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: e.message || 'Could not export PDF',
      });
    }
  };

  // Handle Excel Export
  const handleExportExcel = () => {
    if (!terminalSummary || !activeClass) return;
    try {
      exportTerminalReportToExcel({
        school,
        sessionName: currentSession?.name || '2026/2027',
        termName: activeTerm?.name || 'First Term',
        className: `${activeClass.name} ${activeClass.arm}`,
        summary: terminalSummary,
      });
      addToast({
        type: 'success',
        title: 'Excel Exported',
        message: 'Attendance data & statistical summaries saved to Excel.',
      });
    } catch (e: any) {
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: e.message || 'Could not export Excel',
      });
    }
  };

  // Handle Weekly CSV Export
  const handleExportWeeklyCSV = () => {
    if (!weeklyData || !activeClass) return;
    exportWeeklyReportToCSV({
      className: `${activeClass.name}_${activeClass.arm}`,
      weekDates: weeklyData.weekDays.map((d) => ({
        date: d.dateStr,
        label: d.label,
      })),
      rows: weeklyData.studentRows,
    });
    addToast({
      type: 'success',
      title: 'Weekly CSV Exported',
      message: 'Weekly attendance report saved to CSV.',
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Report Type Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setReportType('TERMINAL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                reportType === 'TERMINAL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Terminal Summary Report
            </button>
            <button
              onClick={() => setReportType('WEEKLY')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                reportType === 'WEEKLY'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weekly Class Sheet
            </button>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('assessments')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg shadow-2xs transition-colors"
              title="Enter CA and Exam scores, rank students, and prepare terminal report cards"
            >
              <Award className="w-3.5 h-3.5 text-amber-600" />
              <span>CA & Exam Report Cards</span>
            </button>

            {reportType === 'TERMINAL' ? (
              <>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Official PDF</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export Excel</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleExportWeeklyCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            )}

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Class & Stream
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:outline-none"
            >
              {permittedClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.arm}
                </option>
              ))}
            </select>
          </div>

          {reportType === 'TERMINAL' ? (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Term
              </label>
              <select
                value={termId}
                onChange={(e) => setTermId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:outline-none"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.status}) {t.isFinalized ? '🔒' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Week Starting (Monday)
              </label>
              <input
                type="date"
                value={selectedWeekStart}
                onChange={(e) => setSelectedWeekStart(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Form Teacher
            </label>
            <div className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-100 text-slate-700 font-medium">
              {classTeacher?.name || 'Assigned Form Master'}
            </div>
          </div>
        </div>
      </div>

      {/* Report Display */}
      {reportType === 'TERMINAL' && terminalSummary && (
        <div className="space-y-4">
          {/* Statistical Highlights Banner */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Terminal Attendance Statistics: {activeClass?.name}{' '}
                  {activeClass?.arm}
                </h3>
                <p className="text-xs text-slate-400">
                  {currentSession?.name} · {activeTerm?.name} · Days School
                  Opened: {terminalSummary.schoolOpeningDays} days
                </p>
              </div>
              <div className="text-right font-mono">
                <div className="text-xl font-bold text-emerald-400">
                  {terminalSummary.overallAttendancePercentage.toFixed(2)}%
                </div>
                <div className="text-[11px] text-slate-400">Overall Attendance</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3 bg-slate-800/80 rounded-xl">
                <div className="text-slate-400 text-[11px]">Enrolled Students</div>
                <div className="text-lg font-bold text-white mt-0.5">
                  {terminalSummary.totalStudentsOnRoll}
                </div>
                <div className="text-[10px] text-slate-400">
                  {terminalSummary.totalBoysOnRoll} Boys ·{' '}
                  {terminalSummary.totalGirlsOnRoll} Girls
                </div>
              </div>

              <div className="p-3 bg-slate-800/80 rounded-xl">
                <div className="text-slate-400 text-[11px]">Attended Sessions</div>
                <div className="text-lg font-bold text-teal-300 mt-0.5">
                  {terminalSummary.totalSessionsAttended}
                </div>
                <div className="text-[10px] text-slate-400">
                  M: {terminalSummary.totalMorningPresent} · A:{' '}
                  {terminalSummary.totalAfternoonPresent}
                </div>
              </div>

              <div className="p-3 bg-slate-800/80 rounded-xl">
                <div className="text-slate-400 text-[11px]">Gender Attendance %</div>
                <div className="text-sm font-bold text-white mt-1">
                  Boys: {terminalSummary.boysAttendancePercentage.toFixed(1)}%
                </div>
                <div className="text-sm font-bold text-white">
                  Girls: {terminalSummary.girlsAttendancePercentage.toFixed(1)}%
                </div>
              </div>

              <div className="p-3 bg-slate-800/80 rounded-xl">
                <div className="text-slate-400 text-[11px]">Punctuality Rate</div>
                <div className="text-lg font-bold text-amber-400 mt-0.5">
                  {terminalSummary.overallPunctualityPercentage.toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400">
                  {terminalSummary.totalLateCount} late markings
                </div>
              </div>
            </div>
          </div>

          {/* Student Breakdown Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-2.5 px-3 w-10 text-center">No.</th>
                    <th className="py-2.5 px-3 w-28">Adm. No.</th>
                    <th className="py-2.5 px-3 min-w-[160px]">Student Name</th>
                    <th className="py-2.5 px-2 w-10 text-center">Sex</th>
                    <th className="py-2.5 px-2 text-center">Enrolled</th>
                    <th className="py-2.5 px-2 text-center">Morn.</th>
                    <th className="py-2.5 px-2 text-center">Aft.</th>
                    <th className="py-2.5 px-3 text-center font-bold">Total Att.</th>
                    <th className="py-2.5 px-3 text-center">Poss.</th>
                    <th className="py-2.5 px-3 text-center font-bold">Att. %</th>
                    <th className="py-2.5 px-2 text-center">Late</th>
                    <th className="py-2.5 px-3 text-center">Punct. %</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {terminalSummary.studentSummaries.map((s, idx) => (
                    <tr
                      key={s.student.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-700">
                        {s.student.admissionNumber}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {s.student.lastName.toUpperCase()}, {s.student.firstName}{' '}
                        {s.student.middleName || ''}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold">
                        <span
                          className={
                            s.student.gender === 'MALE'
                              ? 'text-blue-600'
                              : 'text-pink-600'
                          }
                        >
                          {s.student.gender === 'MALE' ? 'M' : 'F'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-slate-600">
                        {s.daysEnrolled}d
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-emerald-700">
                        {s.morningPresent}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-teal-700">
                        {s.afternoonPresent}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                        {s.totalSessionsAttended}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                        {s.possibleSessions}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-800">
                        {s.attendancePercentage.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-amber-700">
                        {s.totalLate}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                        {s.punctualityPercentage.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded font-mono ${
                            s.student.status === 'ACTIVE'
                              ? 'text-emerald-700 bg-emerald-50'
                              : 'text-slate-600 bg-slate-100'
                          }`}
                        >
                          {s.student.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Report Display */}
      {reportType === 'WEEKLY' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900">
              Weekly Attendance Ledger: Week of {selectedWeekStart}
            </h4>
            <div className="text-xs text-slate-500">
              Each column displays Morning (\) and Afternoon (/) attendance
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-semibold">
                  <th className="py-2.5 px-3 w-10 text-center">No.</th>
                  <th className="py-2.5 px-3 w-28">Adm. No.</th>
                  <th className="py-2.5 px-3 min-w-[160px]">Student Name</th>
                  <th className="py-2.5 px-2 w-10 text-center">Sex</th>

                  {weeklyData.weekDays.map((wd) => (
                    <th
                      key={wd.dateStr}
                      className="py-2.5 px-2 text-center border-l border-slate-800 min-w-[70px]"
                    >
                      <div>{wd.label}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        M | A
                      </div>
                    </th>
                  ))}

                  <th className="py-2.5 px-3 text-center border-l border-slate-800 font-bold">
                    Week Att.
                  </th>
                  <th className="py-2.5 px-3 text-center font-bold">Week %</th>
                  <th className="py-2.5 px-2 text-center">Late</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {weeklyData.studentRows.map((r, idx) => (
                  <tr
                    key={r.student.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-2 px-3 text-center font-mono text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-slate-700">
                      {r.admissionNumber}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      {r.name}
                    </td>
                    <td className="py-2 px-2 text-center font-mono font-bold text-slate-600">
                      {r.gender}
                    </td>

                    {/* Week day cells */}
                    {weeklyData.weekDays.map((wd) => {
                      const dInfo = r.days[wd.dateStr];
                      return (
                        <td
                          key={wd.dateStr}
                          className="py-2 px-2 text-center border-l border-slate-100 font-mono text-[11px]"
                        >
                          <span className="font-bold text-emerald-800">
                            {dInfo?.symbol || '—'}
                          </span>
                        </td>
                      );
                    })}

                    <td className="py-2 px-3 text-center border-l border-slate-100 font-mono font-bold text-slate-900">
                      {r.totalAttended} / {r.possibleSessions}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-emerald-800">
                      {r.attendancePercentage.toFixed(1)}%
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-amber-700">
                      {r.lateCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
