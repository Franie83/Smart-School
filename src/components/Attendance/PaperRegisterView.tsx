// Paper Register View - Authentic Traditional Ledger Replica
import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Info,
  Printer,
  Sliders,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AttendanceRecord, Student } from '../../types/attendance';
import {
  calculateDailyClassAttendance,
  getSchoolDaysInRange,
  isSchoolDay,
  isStudentEnrolledOnDate,
} from '../../utils/calculationEngine';
import { getDailyRegisterMark } from '../../utils/symbolHelper';

export const PaperRegisterView: React.FC = () => {
  const {
    school,
    classes,
    permittedClasses,
    students,
    permittedStudents,
    terms,
    currentTerm,
    calendarDays,
    attendanceRecords,
    symbolSettings,
    currentUser,
    selectedClassId,
    setSelectedClassId,
  } = useApp();

  // Selected month filter (default to current month, e.g. September 2026)
  const [selectedMonth, setSelectedMonth] = useState<string>((() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }));

  const activeClass = permittedClasses.find((c) => c.id === selectedClassId) || permittedClasses[0];

  // Calculate days in the selected month
  const monthDays = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-12
    const numDays = new Date(year, month, 0).getDate();

    const days: {
      dateStr: string;
      dayNumber: number;
      dayOfWeek: string;
      isSchoolDay: boolean;
    }[] = [];

    for (let d = 1; d <= numDays; d++) {
      const dayStr = d.toString().padStart(2, '0');
      const dateStr = `${selectedMonth}-${dayStr}`;
      const dateObj = new Date(`${dateStr}T00:00:00`);
      const dayOfWeekShort = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'][
        dateObj.getDay()
      ];
      const isSchool = isSchoolDay(
        dateStr,
        calendarDays,
        school.schoolDaysOfWeek
      );

      days.push({
        dateStr,
        dayNumber: d,
        dayOfWeek: dayOfWeekShort,
        isSchoolDay: isSchool,
      });
    }

    return days;
  }, [selectedMonth, calendarDays, school.schoolDaysOfWeek]);

  // School days only for calculating averages
  const officialSchoolDays = useMemo(() => {
    return monthDays.filter((d) => d.isSchoolDay);
  }, [monthDays]);

  // Students belonging to this class (restricted to permitted students)
  const classStudents = useMemo(() => {
    if (!activeClass) return [];
    return permittedStudents
      .filter((s) => s.classId === activeClass.id)
      .sort((a, b) => a.admissionNumber.localeCompare(b.admissionNumber));
  }, [permittedStudents, activeClass]);

  // Build matrix: studentId -> dateStr -> { mark, colorClass, record }
  const matrix = useMemo(() => {
    const map: Record<
      string,
      Record<
        string,
        {
          symbol: string;
          colorClass: string;
          title: string;
          record?: AttendanceRecord;
          isEnrolled: boolean;
        }
      >
    > = {};

    classStudents.forEach((student) => {
      map[student.id] = {};
      monthDays.forEach((day) => {
        const enrolled = isStudentEnrolledOnDate(student, day.dateStr);

        if (!enrolled) {
          map[student.id][day.dateStr] = {
            symbol: '—',
            colorClass: 'text-slate-300 bg-slate-50',
            title: 'Not yet enrolled or withdrawn',
            isEnrolled: false,
          };
          return;
        }

        const rec = attendanceRecords.find(
          (r) => r.studentId === student.id && r.date === day.dateStr
        );

        if (rec) {
          const mark = getDailyRegisterMark(
            rec.morningStatus,
            rec.afternoonStatus,
            symbolSettings
          );
          map[student.id][day.dateStr] = {
            symbol: mark.symbol,
            colorClass: mark.colorClass,
            title: mark.title,
            record: rec,
            isEnrolled: true,
          };
        } else {
          // If it's a weekend / holiday, show dash
          if (!day.isSchoolDay) {
            map[student.id][day.dateStr] = {
              symbol: '·',
              colorClass: 'text-slate-300 bg-slate-100/50',
              title: 'Non-school day',
              isEnrolled: true,
            };
          } else {
            map[student.id][day.dateStr] = {
              symbol: symbolSettings.notMarked || '-',
              colorClass: 'text-slate-400 bg-slate-50',
              title: 'Not marked',
              isEnrolled: true,
            };
          }
        }
      });
    });

    return map;
  }, [classStudents, monthDays, attendanceRecords, symbolSettings]);

  // Column summaries (Daily Totals for bottom rows of ledger)
  const columnSummaries = useMemo(() => {
    const dailyMap: Record<
      string,
      {
        morningTotal: number;
        afternoonTotal: number;
        totalAttended: number;
        boysPresent: number;
        girlsPresent: number;
        studentsOnRoll: number;
        percentage: number;
      }
    > = {};

    monthDays.forEach((day) => {
      const summary = calculateDailyClassAttendance(
        activeClass?.id || '',
        activeClass?.name || '',
        day.dateStr,
        students,
        attendanceRecords
      );
      dailyMap[day.dateStr] = {
        morningTotal: summary.morningPresent,
        afternoonTotal: summary.afternoonPresent,
        totalAttended: summary.totalSessionsAttended,
        boysPresent: summary.boysPresentSessions,
        girlsPresent: summary.girlsPresentSessions,
        studentsOnRoll: summary.studentsOnRoll,
        percentage: summary.attendancePercentage,
      };
    });

    return dailyMap;
  }, [monthDays, activeClass, students, attendanceRecords]);

  // Handle month navigation
  const shiftMonth = (delta: number) => {
    const [yStr, mStr] = selectedMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + delta;
    if (m < 1) {
      m = 12;
      y--;
    } else if (m > 12) {
      m = 1;
      y++;
    }
    setSelectedMonth(`${y}-${m.toString().padStart(2, '0')}`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-900 text-emerald-100 flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Traditional Paper Register Sheet
            </h2>
            <p className="text-xs text-slate-500">
              Authentic visual replica with dual-session marks (\, /, V, OO)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Class Select */}
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none"
          >
            {permittedClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.arm}
              </option>
            ))}
          </select>

          {/* Month Stepper */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs font-medium">
            <button
              onClick={() => shiftMonth(-1)}
              className="p-1 hover:bg-white rounded transition-colors text-slate-600"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-semibold text-slate-800">
              {new Date(`${selectedMonth}-01T00:00:00`).toLocaleString(
                'default',
                {
                  month: 'long',
                  year: 'numeric',
                }
              )}
            </span>
            <button
              onClick={() => shiftMonth(1)}
              className="p-1 hover:bg-white rounded transition-colors text-slate-600"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Sheet</span>
          </button>
        </div>
      </div>

      {/* Traditional Symbols Legend */}
      <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">
          Symbol Key:
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded bg-emerald-100 text-emerald-800 font-bold font-mono text-center flex items-center justify-center border border-emerald-300">
            {symbolSettings.bothPresent}
          </span>
          <span>Both Present</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded bg-rose-100 text-rose-800 font-bold font-mono text-center flex items-center justify-center border border-rose-300">
            {symbolSettings.bothAbsent}
          </span>
          <span>Both Absent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded bg-indigo-100 text-indigo-800 font-bold font-mono text-center flex items-center justify-center border border-indigo-300">
            {symbolSettings.morningPresentAfternoonAbsent || '\\O'}
          </span>
          <span>Morn. Present / Aft. Absent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded bg-teal-100 text-teal-800 font-bold font-mono text-center flex items-center justify-center border border-teal-300">
            {symbolSettings.morningAbsentAfternoonPresent || 'O/'}
          </span>
          <span>Morn. Absent / Aft. Present</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded bg-amber-100 text-amber-800 font-bold font-mono text-center flex items-center justify-center border border-amber-300">
            {symbolSettings.bothExcused || 'EE'}
          </span>
          <span>Excused</span>
        </div>
      </div>

      {/* Main Wide Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs">
            {/* Table Header: Dates and Day Names */}
            <thead>
              <tr className="bg-slate-900 text-white font-semibold border-b border-slate-700">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 bg-slate-900 py-2.5 px-2 w-10 text-center border-r border-slate-700 shadow-xs"
                >
                  No.
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-10 z-20 bg-slate-900 py-2.5 px-3 w-48 border-r border-slate-700 shadow-xs"
                >
                  Student Name
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-58 z-20 bg-slate-900 py-2.5 px-2 w-10 text-center border-r border-slate-700 shadow-xs"
                >
                  Sex
                </th>

                {/* Date Columns */}
                {monthDays.map((d) => (
                  <th
                    key={d.dateStr}
                    className={`py-1.5 px-1 min-w-[28px] text-center border-r border-slate-800 font-mono text-[11px] ${
                      !d.isSchoolDay
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-slate-900 text-white'
                    }`}
                  >
                    {d.dayNumber}
                  </th>
                ))}

                <th
                  rowSpan={2}
                  className="py-2.5 px-2.5 min-w-[48px] text-center font-bold bg-slate-850 border-l border-slate-700"
                >
                  Att. Tot.
                </th>
                <th
                  rowSpan={2}
                  className="py-2.5 px-2.5 min-w-[48px] text-center font-bold bg-slate-850"
                >
                  Att. %
                </th>
              </tr>
              {/* Second sub-header row: Day of week */}
              <tr className="bg-slate-800 text-slate-300 text-[10px] font-mono border-b border-slate-700">
                {monthDays.map((d) => (
                  <th
                    key={`dow_${d.dateStr}`}
                    className={`py-1 px-1 text-center border-r border-slate-700 ${
                      !d.isSchoolDay ? 'text-slate-500' : 'text-slate-300'
                    }`}
                  >
                    {d.dayOfWeek}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body: Student Rows */}
            <tbody className="divide-y divide-slate-200">
              {classStudents.map((student, idx) => {
                let totalAttended = 0;
                let possibleSessions = 0;

                monthDays.forEach((d) => {
                  if (!d.isSchoolDay) return;
                  const item = matrix[student.id]?.[d.dateStr];
                  if (!item || !item.isEnrolled) return;

                  possibleSessions += 2;
                  if (item.record) {
                    if (item.record.morningStatus === 'PRESENT') totalAttended++;
                    if (item.record.afternoonStatus === 'PRESENT') totalAttended++;
                  }
                });

                const attPct =
                  possibleSessions > 0
                    ? Math.round((totalAttended * 1000) / possibleSessions) / 10
                    : 0;

                return (
                  <tr
                    key={student.id}
                    className="hover:bg-amber-50/40 transition-colors"
                  >
                    {/* Fixed Columns */}
                    <td className="sticky left-0 z-10 bg-white py-2 px-2 text-center font-mono text-slate-500 border-r border-slate-200 font-semibold shadow-xs">
                      {idx + 1}
                    </td>
                    <td className="sticky left-10 z-10 bg-white py-2 px-3 border-r border-slate-200 shadow-xs truncate max-w-[190px]">
                      <div className="font-bold text-slate-900 text-xs">
                        {student.lastName.toUpperCase()}, {student.firstName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {student.admissionNumber}
                      </div>
                    </td>
                    <td className="sticky left-58 z-10 bg-white py-2 px-2 text-center border-r border-slate-200 shadow-xs font-mono font-bold text-[11px]">
                      <span
                        className={
                          student.gender === 'MALE'
                            ? 'text-blue-700'
                            : 'text-pink-700'
                        }
                      >
                        {student.gender === 'MALE' ? 'M' : 'F'}
                      </span>
                    </td>

                    {/* Dynamic Date Cells */}
                    {monthDays.map((d) => {
                      const cell = matrix[student.id]?.[d.dateStr];
                      return (
                        <td
                          key={d.dateStr}
                          className={`py-1.5 px-0.5 text-center font-mono text-[11px] border-r border-slate-200 select-none ${
                            !d.isSchoolDay
                              ? 'bg-slate-100/70 text-slate-400'
                              : 'bg-white'
                          }`}
                          title={`${student.firstName}: ${d.dateStr} - ${cell?.title || ''}`}
                        >
                          <span
                            className={`inline-block px-1 py-0.5 rounded text-[11px] font-bold ${
                              cell?.colorClass || 'text-slate-400'
                            }`}
                          >
                            {cell?.symbol || '—'}
                          </span>
                        </td>
                      );
                    })}

                    {/* Student Row Totals */}
                    <td className="py-2 px-2 text-center font-mono font-bold text-slate-900 border-l border-slate-300 bg-slate-50/50">
                      {totalAttended}
                    </td>
                    <td className="py-2 px-2 text-center font-mono font-bold text-emerald-800 bg-slate-50/50">
                      {attPct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Traditional Register Bottom Summary Rows */}
            <tfoot className="border-t-2 border-slate-400 bg-slate-100 font-mono text-[11px] font-semibold text-slate-700">
              {/* Row 1: Morning Attendance */}
              <tr>
                <td
                  colSpan={3}
                  className="sticky left-0 z-10 bg-slate-100 py-1.5 px-3 border-r border-slate-300 font-sans font-bold text-slate-900"
                >
                  Morning Present (\)
                </td>
                {monthDays.map((d) => (
                  <td
                    key={`morn_${d.dateStr}`}
                    className={`py-1.5 px-0.5 text-center border-r border-slate-300 ${
                      !d.isSchoolDay ? 'text-slate-400' : 'text-slate-900'
                    }`}
                  >
                    {d.isSchoolDay
                      ? columnSummaries[d.dateStr]?.morningTotal || 0
                      : '-'}
                  </td>
                ))}
                <td
                  colSpan={2}
                  className="py-1.5 px-2 text-center text-slate-500 font-sans"
                >
                  Morn Total
                </td>
              </tr>

              {/* Row 2: Afternoon Attendance */}
              <tr>
                <td
                  colSpan={3}
                  className="sticky left-0 z-10 bg-slate-100 py-1.5 px-3 border-r border-slate-300 font-sans font-bold text-slate-900"
                >
                  Afternoon Present (/)
                </td>
                {monthDays.map((d) => (
                  <td
                    key={`aft_${d.dateStr}`}
                    className={`py-1.5 px-0.5 text-center border-r border-slate-300 ${
                      !d.isSchoolDay ? 'text-slate-400' : 'text-slate-900'
                    }`}
                  >
                    {d.isSchoolDay
                      ? columnSummaries[d.dateStr]?.afternoonTotal || 0
                      : '-'}
                  </td>
                ))}
                <td
                  colSpan={2}
                  className="py-1.5 px-2 text-center text-slate-500 font-sans"
                >
                  Aft Total
                </td>
              </tr>

              {/* Row 3: Daily Total Attendance */}
              <tr className="bg-slate-200/90 text-slate-900 font-bold">
                <td
                  colSpan={3}
                  className="sticky left-0 z-10 bg-slate-200 py-1.5 px-3 border-r border-slate-300 font-sans"
                >
                  Total Daily Sessions
                </td>
                {monthDays.map((d) => (
                  <td
                    key={`tot_${d.dateStr}`}
                    className={`py-1.5 px-0.5 text-center border-r border-slate-300 ${
                      !d.isSchoolDay ? 'text-slate-400' : 'text-slate-950 font-bold'
                    }`}
                  >
                    {d.isSchoolDay
                      ? columnSummaries[d.dateStr]?.totalAttended || 0
                      : '-'}
                  </td>
                ))}
                <td
                  colSpan={2}
                  className="py-1.5 px-2 text-center text-emerald-800 font-sans font-bold"
                >
                  Aggregate
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
