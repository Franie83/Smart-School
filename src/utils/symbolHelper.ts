// Register Symbol presentation helper
import { AttendanceStatus, RegisterSymbolSettings } from '../types/attendance';

export const DEFAULT_REGISTER_SYMBOLS: RegisterSymbolSettings = {
  morningPresentOnly: '\\',
  afternoonPresentOnly: '/',
  bothPresent: 'V',
  bothAbsent: 'OO',
  morningPresentAfternoonAbsent: '\\O',
  morningAbsentAfternoonPresent: 'O/',
  morningExcusedAfternoonPresent: 'E/',
  morningPresentAfternoonExcused: '\\E',
  bothExcused: 'EE',
  notMarked: '—',
};

/**
 * Computes the traditional paper register mark for a student's daily attendance.
 * Note: Underneath, the database stores exact statuses (PRESENT, ABSENT, EXCUSED, NOT_MARKED).
 * This function handles only the visual presentation layer according to school settings.
 */
export function getDailyRegisterMark(
  morning: AttendanceStatus,
  afternoon: AttendanceStatus,
  settings: RegisterSymbolSettings = DEFAULT_REGISTER_SYMBOLS
): { symbol: string; title: string; colorClass: string } {
  // Both Not Marked
  if (morning === 'NOT_MARKED' && afternoon === 'NOT_MARKED') {
    return {
      symbol: settings.notMarked || '—',
      title: 'Not Marked',
      colorClass: 'text-slate-400 bg-slate-50',
    };
  }

  // Both Present: V
  if (morning === 'PRESENT' && afternoon === 'PRESENT') {
    return {
      symbol: settings.bothPresent || 'V',
      title: 'Present All Day (Morning + Afternoon)',
      colorClass: 'text-emerald-700 bg-emerald-50 font-bold',
    };
  }

  // Both Absent: OO
  if (morning === 'ABSENT' && afternoon === 'ABSENT') {
    return {
      symbol: settings.bothAbsent || 'OO',
      title: 'Absent All Day',
      colorClass: 'text-rose-700 bg-rose-50 font-bold',
    };
  }

  // Both Excused: EE
  if (morning === 'EXCUSED' && afternoon === 'EXCUSED') {
    return {
      symbol: settings.bothExcused || 'EE',
      title: 'Excused All Day',
      colorClass: 'text-amber-700 bg-amber-50 font-semibold',
    };
  }

  // Morning Present, Afternoon Absent: \O
  if (morning === 'PRESENT' && afternoon === 'ABSENT') {
    return {
      symbol: settings.morningPresentAfternoonAbsent || '\\O',
      title: 'Present Morning, Absent Afternoon',
      colorClass: 'text-indigo-700 bg-indigo-50 font-semibold',
    };
  }

  // Morning Absent, Afternoon Present: O/
  if (morning === 'ABSENT' && afternoon === 'PRESENT') {
    return {
      symbol: settings.morningAbsentAfternoonPresent || 'O/',
      title: 'Absent Morning, Present Afternoon',
      colorClass: 'text-teal-700 bg-teal-50 font-semibold',
    };
  }

  // Morning Present, Afternoon Excused
  if (morning === 'PRESENT' && afternoon === 'EXCUSED') {
    return {
      symbol: settings.morningPresentAfternoonExcused || '\\E',
      title: 'Present Morning, Excused Afternoon',
      colorClass: 'text-cyan-700 bg-cyan-50 font-semibold',
    };
  }

  // Morning Excused, Afternoon Present
  if (morning === 'EXCUSED' && afternoon === 'PRESENT') {
    return {
      symbol: settings.morningExcusedAfternoonPresent || 'E/',
      title: 'Excused Morning, Present Afternoon',
      colorClass: 'text-cyan-700 bg-cyan-50 font-semibold',
    };
  }

  // Morning Present, Afternoon Not Marked yet (e.g. during school morning hours)
  if (morning === 'PRESENT' && afternoon === 'NOT_MARKED') {
    return {
      symbol: settings.morningPresentOnly || '\\',
      title: 'Morning Present (Afternoon pending)',
      colorClass: 'text-emerald-600 bg-emerald-50/70 font-semibold',
    };
  }

  // Morning Absent, Afternoon Not Marked yet
  if (morning === 'ABSENT' && afternoon === 'NOT_MARKED') {
    return {
      symbol: 'O-',
      title: 'Morning Absent (Afternoon pending)',
      colorClass: 'text-rose-600 bg-rose-50/70 font-semibold',
    };
  }

  // Morning Not Marked, Afternoon Present
  if (morning === 'NOT_MARKED' && afternoon === 'PRESENT') {
    return {
      symbol: settings.afternoonPresentOnly || '/',
      title: 'Afternoon Present (Morning pending)',
      colorClass: 'text-teal-600 bg-teal-50/70 font-semibold',
    };
  }

  // Fallback
  return {
    symbol: `${morning[0] || '?'}/${afternoon[0] || '?'}`,
    title: `M: ${morning}, A: ${afternoon}`,
    colorClass: 'text-slate-600 bg-slate-100',
  };
}
