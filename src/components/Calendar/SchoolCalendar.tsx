// School Calendar Component
import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Info,
  Plus,
  RefreshCw,
  Save,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { db } from '../../services/storage';
import { CalendarDay, DayType } from '../../types/attendance';
import { isSchoolDay } from '../../utils/calculationEngine';

const DAY_TYPE_CONFIG: Record<
  DayType,
  { label: string; bg: string; text: string; border: string; isOpening: boolean }
> = {
  SCHOOL_DAY: {
    label: 'Official School Day',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    isOpening: true,
  },
  EXAMINATION: {
    label: 'Examination Day',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-300',
    isOpening: true,
  },
  SPECIAL_EVENT: {
    label: 'Special School Event',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-300',
    isOpening: true,
  },
  PUBLIC_HOLIDAY: {
    label: 'Public Holiday (Closed)',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-300',
    isOpening: false,
  },
  SCHOOL_HOLIDAY: {
    label: 'School Holiday / Mid-Term',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
    isOpening: false,
  },
  WEEKEND: {
    label: 'Weekend',
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-200',
    isOpening: false,
  },
  CLOSED: {
    label: 'School Closed / Strike',
    bg: 'bg-slate-200',
    text: 'text-slate-800',
    border: 'border-slate-400',
    isOpening: false,
  },
};

export const SchoolCalendar: React.FC = () => {
  const { school, calendarDays, canManageSchool, addToast, refreshData } =
    useApp();

  const [selectedMonth, setSelectedMonth] = useState((() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })); // October 2026
  const [editingDay, setEditingDay] = useState<{
    dateStr: string;
    dayType: DayType;
    description: string;
  } | null>(null);

  // Month days computation
  const monthData = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-12

    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 is Sunday

    const days: {
      dateStr: string;
      dayNumber: number;
      dayType: DayType;
      description?: string;
      isOverride: boolean;
      isOpeningDay: boolean;
    }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedMonth}-${d.toString().padStart(2, '0')}`;
      const dObj = new Date(`${dateStr}T00:00:00`);
      const dow = dObj.getDay();

      const override = calendarDays.find((c) => c.date === dateStr);
      let dayType: DayType = 'SCHOOL_DAY';
      let description: string | undefined = undefined;
      let isOverride = false;

      if (override) {
        dayType = override.dayType;
        description = override.description;
        isOverride = true;
      } else {
        if (dow === 0 || dow === 6) {
          dayType = 'WEEKEND';
        } else if (!school.schoolDaysOfWeek.includes(dow)) {
          dayType = 'CLOSED';
        } else {
          dayType = 'SCHOOL_DAY';
        }
      }

      const isOpeningDay = DAY_TYPE_CONFIG[dayType].isOpening;

      days.push({
        dateStr,
        dayNumber: d,
        dayType,
        description,
        isOverride,
        isOpeningDay,
      });
    }

    return {
      year,
      month,
      startingDayOfWeek,
      days,
    };
  }, [selectedMonth, calendarDays, school.schoolDaysOfWeek]);

  // Total opening days in this month
  const totalOpeningDaysInMonth = useMemo(() => {
    return monthData.days.filter((d) => d.isOpeningDay).length;
  }, [monthData]);

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

  const handleDayClick = (day: (typeof monthData.days)[0]) => {
    if (!canManageSchool()) return;
    setEditingDay({
      dateStr: day.dateStr,
      dayType: day.dayType,
      description: day.description || '',
    });
  };

  const handleSaveDay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDay) return;

    db.setCalendarDay({
      id: `cal_${editingDay.dateStr}`,
      schoolId: school.id,
      date: editingDay.dateStr,
      dayType: editingDay.dayType,
      description: editingDay.description.trim() || undefined,
      isOverride: true,
    });

    addToast({
      type: 'success',
      title: 'Calendar Updated',
      message: `${editingDay.dateStr} set to ${DAY_TYPE_CONFIG[editingDay.dayType].label}.`,
    });

    setEditingDay(null);
    refreshData();
  };

  const handleResetOverride = () => {
    if (!editingDay) return;
    db.removeCalendarOverride(editingDay.dateStr);
    addToast({
      type: 'info',
      title: 'Override Removed',
      message: `Reset ${editingDay.dateStr} to default calendar schedule.`,
    });
    setEditingDay(null);
    refreshData();
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            School Academic Calendar & Day Overrides
          </h2>
          <p className="text-xs text-slate-500">
            Configure official school opening days, public holidays, and
            examination periods that determine attendance denominators.
          </p>
        </div>

        {/* Month Stepper */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs font-medium">
            <button
              onClick={() => shiftMonth(-1)}
              className="p-1.5 hover:bg-white rounded transition-colors text-slate-700"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-semibold text-slate-900">
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
              className="p-1.5 hover:bg-white rounded transition-colors text-slate-700"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs font-mono bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200 font-semibold">
            {totalOpeningDaysInMonth} School Days This Month
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap gap-2 text-xs">
        {Object.entries(DAY_TYPE_CONFIG).map(([type, cfg]) => (
          <div
            key={type}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${cfg.bg} ${cfg.text} ${cfg.border}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                cfg.isOpening ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span className="font-medium text-[11px]">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold text-slate-500 font-mono">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* Days Matrix */}
        <div className="grid grid-cols-7 gap-2">
          {/* Pre-padding empty boxes */}
          {Array.from({ length: monthData.startingDayOfWeek }).map((_, i) => (
            <div
              key={`empty_${i}`}
              className="h-24 rounded-xl bg-slate-50/50 border border-transparent"
            />
          ))}

          {/* Days */}
          {monthData.days.map((day) => {
            const cfg = DAY_TYPE_CONFIG[day.dayType];
            return (
              <div
                key={day.dateStr}
                onClick={() => handleDayClick(day)}
                className={`min-h-[92px] p-2 rounded-xl border transition-all flex flex-col justify-between ${
                  cfg.bg
                } ${cfg.border} ${
                  canManageSchool()
                    ? 'cursor-pointer hover:shadow-xs hover:scale-[1.01]'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {day.dayNumber}
                  </span>
                  {day.isOverride && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500" title="Manual override applied" />
                  )}
                </div>

                <div className="mt-1">
                  <div
                    className={`text-[10px] font-semibold truncate ${cfg.text}`}
                  >
                    {cfg.label}
                  </div>
                  {day.description && (
                    <div className="text-[10px] text-slate-600 truncate mt-0.5" title={day.description}>
                      {day.description}
                    </div>
                  )}
                </div>

                <div className="text-[9px] font-mono text-slate-400 pt-1">
                  {cfg.isOpening ? 'Counts in roll' : 'Excluded'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Day Modal */}
      {editingDay && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Configure School Day
                </h3>
                <p className="text-xs font-mono text-slate-500">
                  {editingDay.dateStr}
                </p>
              </div>
              <button
                onClick={() => setEditingDay(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDay} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Calendar Day Type
                </label>
                <select
                  value={editingDay.dayType}
                  onChange={(e) =>
                    setEditingDay({
                      ...editingDay,
                      dayType: e.target.value as DayType,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold focus:outline-none"
                >
                  {Object.entries(DAY_TYPE_CONFIG).map(([type, cfg]) => (
                    <option key={type} value={type}>
                      {cfg.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Event / Holiday Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mid-Term Break, Public Holiday..."
                  value={editingDay.description}
                  onChange={(e) =>
                    setEditingDay({
                      ...editingDay,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetOverride}
                  className="text-rose-600 hover:text-rose-700 text-xs font-semibold"
                >
                  Reset Default
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingDay(null)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-bold"
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
