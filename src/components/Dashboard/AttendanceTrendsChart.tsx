// Attendance Trends Visualization Component using Recharts
import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowUpRight,
  BarChart2,
  Calendar,
  Clock,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { calculateDailyClassAttendance } from '../../utils/calculationEngine';

export const AttendanceTrendsChart: React.FC = () => {
  const {
    classes,
    permittedClasses,
    students,
    permittedStudents,
    calendarDays,
    attendanceRecords,
    currentUser,
    selectedClassId,
    setSelectedClassId,
  } = useApp();

  // Mode: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  const [timeframe, setTimeframe] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');

  // Selected class
  const activeClass =
    permittedClasses.find((c) => c.id === selectedClassId) || permittedClasses[0];

  // Eligible students
  const classStudents = useMemo(() => {
    if (!activeClass) return [];
    return permittedStudents.filter((s) => s.classId === activeClass.id);
  }, [permittedStudents, activeClass]);

  // 1. Daily Data (All recorded dates in the semester, chronologically)
  const dailyData = useMemo(() => {
    if (!activeClass) return [];

    // Unique dates from attendanceRecords for this class
    const dates = Array.from(
      new Set(
        attendanceRecords
          .filter((r) => r.classId === activeClass.id)
          .map((r) => r.date)
      )
    ).sort();

    // Take recent dates (e.g. up to last 15 days)
    const recentDates = dates.slice(-15);

    return recentDates.map((dateStr) => {
      const summary = calculateDailyClassAttendance(
        activeClass.id,
        `${activeClass.name} ${activeClass.arm}`,
        dateStr,
        classStudents,
        attendanceRecords
      );

      const d = new Date(dateStr + 'T00:00:00');
      const label = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;

      return {
        date: dateStr,
        label,
        attendanceRate: summary.attendancePercentage,
        punctualityRate: summary.punctualityPercentage,
        morningPresent: summary.morningPresent,
        afternoonPresent: summary.afternoonPresent,
        totalLate: summary.morningLate + summary.afternoonLate,
        totalAbsences: summary.morningAbsent + summary.afternoonAbsent,
        enrolled: summary.studentsOnRoll,
      };
    });
  }, [activeClass, classStudents, attendanceRecords]);

  // 2. Weekly Aggregate Data
  const weeklyData = useMemo(() => {
    if (!dailyData.length) return [];

    // Group daily data in chunks of 5 days (representing academic weeks)
    const weeks: {
      week: string;
      avgAttendance: number;
      avgPunctuality: number;
      totalSessions: number;
      lateCount: number;
    }[] = [];

    const chunkSize = 5;
    for (let i = 0; i < dailyData.length; i += chunkSize) {
      const chunk = dailyData.slice(i, i + chunkSize);
      const weekNumber = Math.floor(i / chunkSize) + 1;
      const avgAtt =
        chunk.reduce((sum, d) => sum + d.attendanceRate, 0) / chunk.length;
      const avgPunct =
        chunk.reduce((sum, d) => sum + d.punctualityRate, 0) / chunk.length;
      const totalLate = chunk.reduce((sum, d) => sum + d.totalLate, 0);

      weeks.push({
        week: `Week ${weekNumber} (${chunk[0]?.label || ''})`,
        avgAttendance: Math.round(avgAtt * 10) / 10,
        avgPunctuality: Math.round(avgPunct * 10) / 10,
        totalSessions: chunk.reduce((sum, d) => sum + d.morningPresent + d.afternoonPresent, 0),
        lateCount: totalLate,
      });
    }

    return weeks;
  }, [dailyData]);

  // 3. Monthly Trend Data
  const monthlyData = useMemo(() => {
    if (!dailyData.length) return [];

    const monthsMap: Record<
      string,
      { attSum: number; punctSum: number; count: number; lateCount: number }
    > = {};

    dailyData.forEach((d) => {
      const mKey = d.date.slice(0, 7); // e.g. "2026-09"
      if (!monthsMap[mKey]) {
        monthsMap[mKey] = { attSum: 0, punctSum: 0, count: 0, lateCount: 0 };
      }
      monthsMap[mKey].attSum += d.attendanceRate;
      monthsMap[mKey].punctSum += d.punctualityRate;
      monthsMap[mKey].lateCount += d.totalLate;
      monthsMap[mKey].count++;
    });

    return Object.entries(monthsMap).map(([mKey, v]) => {
      const [y, m] = mKey.split('-');
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      const mName = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      return {
        month: mName,
        attendanceRate: Math.round((v.attSum / v.count) * 10) / 10,
        punctualityScore: Math.round((v.punctSum / v.count) * 10) / 10,
        lateIncidents: v.lateCount,
      };
    });
  }, [dailyData]);

  // Summary Highlights
  const overallAvgAtt = useMemo(() => {
    if (!dailyData.length) return 0;
    const sum = dailyData.reduce((acc, d) => acc + d.attendanceRate, 0);
    return Math.round((sum / dailyData.length) * 10) / 10;
  }, [dailyData]);

  const overallAvgPunct = useMemo(() => {
    if (!dailyData.length) return 100;
    const sum = dailyData.reduce((acc, d) => acc + d.punctualityRate, 0);
    return Math.round((sum / dailyData.length) * 10) / 10;
  }, [dailyData]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      {/* Chart Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Real-Time Attendance & Punctuality Trends
            </h3>
            {currentUser.role === 'TEACHER' && (
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                {activeClass?.name} {activeClass?.arm}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Interactive pattern analysis comparing daily sessions, weekly averages, and
            punctuality scores
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Class Select (if admin or multiple assigned) */}
          {permittedClasses.length > 1 && (
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none"
            >
              {permittedClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.arm}
                </option>
              ))}
            </select>
          )}

          {/* Timeframe Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              onClick={() => setTimeframe('DAILY')}
              className={`px-3 py-1 rounded-md transition-colors ${
                timeframe === 'DAILY'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daily Trend
            </button>
            <button
              onClick={() => setTimeframe('WEEKLY')}
              className={`px-3 py-1 rounded-md transition-colors ${
                timeframe === 'WEEKLY'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weekly Pattern
            </button>
            <button
              onClick={() => setTimeframe('MONTHLY')}
              className={`px-3 py-1 rounded-md transition-colors ${
                timeframe === 'MONTHLY'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Overview
            </button>
          </div>
        </div>
      </div>

      {/* Mini metric pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
          <div className="text-[10px] text-slate-400 font-sans">
            Period Avg. Attendance
          </div>
          <div className="text-base font-bold text-emerald-700 mt-0.5">
            {overallAvgAtt.toFixed(1)}%
          </div>
        </div>
        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
          <div className="text-[10px] text-slate-400 font-sans">
            Punctuality Score
          </div>
          <div className="text-base font-bold text-amber-700 mt-0.5">
            {overallAvgPunct.toFixed(1)}%
          </div>
        </div>
        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
          <div className="text-[10px] text-slate-400 font-sans">
            Enrolled In View
          </div>
          <div className="text-base font-bold text-slate-900 mt-0.5">
            {classStudents.length} Students
          </div>
        </div>
        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
          <div className="text-[10px] text-slate-400 font-sans">
            Tracked School Days
          </div>
          <div className="text-base font-bold text-slate-900 mt-0.5">
            {dailyData.length} Days
          </div>
        </div>
      </div>

      {/* Recharts Render Area */}
      <div className="h-72 w-full pt-2">
        {timeframe === 'DAILY' && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="attGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="punctGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis domain={[50, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px',
                }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
              <Area
                type="monotone"
                dataKey="attendanceRate"
                name="Attendance Rate (%)"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#attGradient)"
              />
              <Area
                type="monotone"
                dataKey="punctualityRate"
                name="Punctuality Rate (%)"
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#punctGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {timeframe === 'WEEKLY' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis domain={[50, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px',
                }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="avgAttendance" name="Weekly Attendance %" fill="#0f766e" radius={[6, 6, 0, 0]} />
              <Bar dataKey="avgPunctuality" name="Weekly Punctuality %" fill="#d97706" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {timeframe === 'MONTHLY' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px',
                }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
              <Line
                type="monotone"
                dataKey="attendanceRate"
                name="Monthly Attendance %"
                stroke="#047857"
                strokeWidth={3}
                dot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="punctualityScore"
                name="Punctuality Score"
                stroke="#b45309"
                strokeWidth={2.5}
                strokeDasharray="4 4"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
