// Centralized School Attendance Calculation Engine
import {
  AttendanceRecord,
  CalendarDay,
  DailyClassAttendanceSummary,
  DayType,
  LateIncident,
  Student,
  StudentAttendanceSummary,
  Term,
  TerminalClassSummary,
} from '../types/attendance';
import { formatLocalDate } from './dateUtils';

/**
 * Compares an arrival time (HH:MM) against school cutoff time (HH:MM).
 * Returns whether the student is late and by how many minutes.
 */
export function checkArrivalTimeLateness(
  arrivalTimeStr: string,
  cutoffTimeStr: string
): { isLate: boolean; minutesLate: number } {
  if (!arrivalTimeStr || !cutoffTimeStr) {
    return { isLate: false, minutesLate: 0 };
  }

  const [arrH, arrM] = arrivalTimeStr.split(':').map(Number);
  const [cutH, cutM] = cutoffTimeStr.split(':').map(Number);

  if (isNaN(arrH) || isNaN(arrM) || isNaN(cutH) || isNaN(cutM)) {
    return { isLate: false, minutesLate: 0 };
  }

  const arrivalTotalMinutes = arrH * 60 + arrM;
  const cutoffTotalMinutes = cutH * 60 + cutM;

  if (arrivalTotalMinutes > cutoffTotalMinutes) {
    return {
      isLate: true,
      minutesLate: arrivalTotalMinutes - cutoffTotalMinutes,
    };
  }

  return { isLate: false, minutesLate: 0 };
}

export const NON_SCHOOL_DAY_TYPES: DayType[] = [
  'PUBLIC_HOLIDAY',
  'SCHOOL_HOLIDAY',
  'WEEKEND',
  'CLOSED',
];

/**
 * Checks whether a given ISO date (YYYY-MM-DD) is an official school opening day.
 * Respects calendar overrides and weekend defaults.
 */
export function isSchoolDay(
  dateStr: string,
  calendarDays: CalendarDay[],
  schoolDaysOfWeek: number[] = [1, 2, 3, 4, 5]
): boolean {
  const cal = calendarDays.find((c) => c.date === dateStr);
  if (cal) {
    return !NON_SCHOOL_DAY_TYPES.includes(cal.dayType);
  }

  // Fallback to day of week check
  const d = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday...
  return schoolDaysOfWeek.includes(dayOfWeek);
}

/**
 * Gets all official school days between startDate and endDate (inclusive).
 */
export function getSchoolDaysInRange(
  startDateStr: string,
  endDateStr: string,
  calendarDays: CalendarDay[],
  schoolDaysOfWeek: number[] = [1, 2, 3, 4, 5]
): string[] {
  const result: string[] = [];
  const current = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');

  while (current <= end) {
    const dateStr = formatLocalDate(current);
    if (isSchoolDay(dateStr, calendarDays, schoolDaysOfWeek)) {
      result.push(dateStr);
    }
    current.setDate(current.getDate() + 1);
  }

  return result;
}

/**
 * Calculates number of school days a term has officially opened.
 * Allows term override if manualSchoolOpeningDays is explicitly provided.
 */
export function calculateTermSchoolDays(
  term: Term,
  calendarDays: CalendarDay[],
  schoolDaysOfWeek: number[] = [1, 2, 3, 4, 5]
): { daysList: string[]; totalDays: number } {
  const daysList = getSchoolDaysInRange(
    term.startDate,
    term.endDate,
    calendarDays,
    schoolDaysOfWeek
  );

  const totalDays =
    term.manualSchoolOpeningDays && term.manualSchoolOpeningDays > 0
      ? term.manualSchoolOpeningDays
      : daysList.length;

  return { daysList, totalDays };
}

/**
 * Returns the effective school-day window for a class in a term.
 *
 * The idea: mid-term reports should not be penalised by a whole-term
 * denominator when only a few days of attendance have been recorded.
 *
 * Rules (in order):
 *   1. If the term is finalized, use the full term (closed historical record).
 *   2. If the term hasn't started yet, use a 0-day window (nothing to report).
 *   3. If the term has fully elapsed, use the full term.
 *   4. If the class has no attendance records yet, use a 0-day window.
 *   5. Otherwise, cap the end date at the last recorded attendance
 *      (never beyond today).
 */
export function getEffectiveClassTermWindow(
  classId: string,
  term: Term,
  attendanceRecords: AttendanceRecord[]
): { startDate: string; endDate: string; isFullTerm: boolean } {
  const todayStr = formatLocalDate(new Date());

  // 1. Finalized term — treat as a closed historical window
  if (term.isFinalized) {
    return { startDate: term.startDate, endDate: term.endDate, isFullTerm: true };
  }

  // 2. Term hasn't started yet
  if (term.startDate > todayStr) {
    // 0-day window — no school days have occurred yet
    return { startDate: term.startDate, endDate: term.startDate, isFullTerm: false };
  }

  // 3. Term already ended
  if (term.endDate <= todayStr) {
    return { startDate: term.startDate, endDate: term.endDate, isFullTerm: true };
  }

  // Mid-term — inspect class records
  const classRecords = attendanceRecords.filter(
    (r) =>
      r.classId === classId &&
      r.date >= term.startDate &&
      r.date <= term.endDate
  );

  // 4. No attendance yet
  if (classRecords.length === 0) {
    // 0-day window so the report shows "nothing to report" rather than
    // "0% over the whole term".
    return { startDate: term.startDate, endDate: term.startDate, isFullTerm: false };
  }

  // 5. Cap at the last recorded date (never past today)
  const latest = classRecords
    .map((r) => r.date)
    .sort()
    .reverse()[0];
  const endDate = latest > todayStr ? todayStr : latest;

  return { startDate: term.startDate, endDate, isFullTerm: false };
}

/**
 * Determines whether a student was actively enrolled on a specific date.
 * Crucial for new admissions and withdrawals:
 * - A student is enrolled on `date` iff date >= dateOfAdmission AND (no withdrawal OR date <= dateOfWithdrawal).
 */
export function isStudentEnrolledOnDate(student: Student, dateStr: string): boolean {
  if (student.dateOfAdmission && dateStr < student.dateOfAdmission) {
    return false;
  }
  if (student.dateOfWithdrawal && dateStr > student.dateOfWithdrawal) {
    return false;
  }
  return true;
}

/**
 * Calculates how many school days a student was actively enrolled during a date range.
 */
export function calculateStudentEnrollmentDays(
  student: Student,
  schoolDays: string[]
): number {
  return schoolDays.filter((dateStr) => isStudentEnrolledOnDate(student, dateStr)).length;
}

/**
 * Calculates percentage safely rounded to 2 decimal places.
 */
export function formatPercentage(value: number): number {
  if (isNaN(value) || !isFinite(value) || value < 0) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Punctuality formula:
 * (Total Attended Sessions - Late Sessions) * 100 / Total Attended Sessions
 * Only students marked PRESENT are included in the punctuality denominator.
 */
export function calculatePunctualityPercentage(
  presentSessions: number,
  lateSessions: number
): number {
  if (presentSessions <= 0) return 100; // No lateness recorded
  const onTimeSessions = Math.max(0, presentSessions - lateSessions);
  return formatPercentage((onTimeSessions * 100) / presentSessions);
}

/**
 * Attendance percentage formula:
 * Total Sessions Attended * 100 / Possible Attendance Sessions
 */
export function calculateAttendancePercentage(
  attendedSessions: number,
  possibleSessions: number
): number {
  if (possibleSessions <= 0) return 0;
  return formatPercentage((attendedSessions * 100) / possibleSessions);
}

/**
 * Calculates daily attendance statistics for a single class on a specific date.
 */
export function calculateDailyClassAttendance(
  classId: string,
  className: string,
  dateStr: string,
  students: Student[],
  attendanceRecords: AttendanceRecord[]
): DailyClassAttendanceSummary {
  // Only students enrolled in this class on this date
  const classStudents = students.filter(
    (s) => s.classId === classId && isStudentEnrolledOnDate(s, dateStr)
  );

  const boys = classStudents.filter((s) => s.gender === 'MALE');
  const girls = classStudents.filter((s) => s.gender === 'FEMALE');

  let morningPresent = 0;
  let morningAbsent = 0;
  let morningExcused = 0;
  let morningLate = 0;

  let afternoonPresent = 0;
  let afternoonAbsent = 0;
  let afternoonExcused = 0;
  let afternoonLate = 0;

  let boysPresent = 0;
  let girlsPresent = 0;

  for (const s of classStudents) {
    const record = attendanceRecords.find(
      (r) => r.studentId === s.id && r.date === dateStr
    );

    if (record) {
      // Morning
      if (record.morningStatus === 'PRESENT') {
        morningPresent++;
        if (s.gender === 'MALE') boysPresent++;
        else girlsPresent++;
        if (record.morningLateness === 'LATE') morningLate++;
      } else if (record.morningStatus === 'ABSENT') {
        morningAbsent++;
      } else if (record.morningStatus === 'EXCUSED') {
        morningExcused++;
      }

      // Afternoon
      if (record.afternoonStatus === 'PRESENT') {
        afternoonPresent++;
        if (s.gender === 'MALE') boysPresent++;
        else girlsPresent++;
        if (record.afternoonLateness === 'LATE') afternoonLate++;
      } else if (record.afternoonStatus === 'ABSENT') {
        afternoonAbsent++;
      } else if (record.afternoonStatus === 'EXCUSED') {
        afternoonExcused++;
      }
    }
  }

  const studentsOnRoll = classStudents.length;
  const totalSessionsAttended = morningPresent + afternoonPresent;
  // 2 sessions per day (Morning + Afternoon)
  const totalPossibleSessions = studentsOnRoll * 2;
  const totalLate = morningLate + afternoonLate;

  const boysPossibleSessions = boys.length * 2;
  const girlsPossibleSessions = girls.length * 2;

  return {
    date: dateStr,
    classId,
    className,
    studentsOnRoll,
    morningPresent,
    morningAbsent,
    morningExcused,
    morningLate,
    afternoonPresent,
    afternoonAbsent,
    afternoonExcused,
    afternoonLate,
    totalSessionsAttended,
    totalPossibleSessions,
    attendancePercentage: calculateAttendancePercentage(
      totalSessionsAttended,
      totalPossibleSessions
    ),
    punctualityPercentage: calculatePunctualityPercentage(
      totalSessionsAttended,
      totalLate
    ),
    boysOnRoll: boys.length,
    boysPresentSessions: boysPresent,
    boysPossibleSessions,
    boysAttendancePercentage: calculateAttendancePercentage(
      boysPresent,
      boysPossibleSessions
    ),
    girlsOnRoll: girls.length,
    girlsPresentSessions: girlsPresent,
    girlsPossibleSessions,
    girlsAttendancePercentage: calculateAttendancePercentage(
      girlsPresent,
      girlsPossibleSessions
    ),
  };
}

/**
 * Calculates aggregate attendance summary for an individual student across a set of school days.
 */
export function calculateStudentAttendanceSummary(
  student: Student,
  schoolDays: string[],
  attendanceRecords: AttendanceRecord[]
): StudentAttendanceSummary {
  // Days student was actively enrolled during these school days
  const enrolledDays = schoolDays.filter((d) => isStudentEnrolledOnDate(student, d));
  const daysEnrolled = enrolledDays.length;
  const possibleSessions = daysEnrolled * 2;

  let morningPresent = 0;
  let morningAbsent = 0;
  let morningExcused = 0;
  let morningLate = 0;

  let afternoonPresent = 0;
  let afternoonAbsent = 0;
  let afternoonExcused = 0;
  let afternoonLate = 0;

  const lateArrivalHistory: LateIncident[] = [];

  for (const day of enrolledDays) {
    const rec = attendanceRecords.find(
      (r) => r.studentId === student.id && r.date === day
    );
    if (rec) {
      if (rec.morningStatus === 'PRESENT') {
        morningPresent++;
        if (rec.morningLateness === 'LATE') {
          morningLate++;
          lateArrivalHistory.push({
            date: day,
            session: 'MORNING',
            arrivalTime: rec.morningArrivalTime,
            notes: rec.notes,
          });
        }
      } else if (rec.morningStatus === 'ABSENT') {
        morningAbsent++;
      } else if (rec.morningStatus === 'EXCUSED') {
        morningExcused++;
      }

      if (rec.afternoonStatus === 'PRESENT') {
        afternoonPresent++;
        if (rec.afternoonLateness === 'LATE') {
          afternoonLate++;
          lateArrivalHistory.push({
            date: day,
            session: 'AFTERNOON',
            arrivalTime: rec.afternoonArrivalTime,
            notes: rec.notes,
          });
        }
      } else if (rec.afternoonStatus === 'ABSENT') {
        afternoonAbsent++;
      } else if (rec.afternoonStatus === 'EXCUSED') {
        afternoonExcused++;
      }
    }
  }

  const totalSessionsAttended = morningPresent + afternoonPresent;
  const totalLate = morningLate + afternoonLate;
  const punctualityPercentage = calculatePunctualityPercentage(
    totalSessionsAttended,
    totalLate
  );
  const punctualityScore = punctualityPercentage;
  const punctualityTier: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT' =
    punctualityScore >= 90
      ? 'EXCELLENT'
      : punctualityScore >= 80
      ? 'GOOD'
      : 'NEEDS_IMPROVEMENT';

  return {
    student,
    daysSchoolOpened: schoolDays.length,
    daysEnrolled,
    possibleSessions,
    morningPresent,
    morningAbsent,
    morningExcused,
    afternoonPresent,
    afternoonAbsent,
    afternoonExcused,
    totalSessionsAttended,
    attendancePercentage: calculateAttendancePercentage(
      totalSessionsAttended,
      possibleSessions
    ),
    morningLate,
    afternoonLate,
    totalLate,
    punctualityPercentage,
    punctualityScore,
    punctualityTier,
    lateArrivalHistory,
  };
}

/**
 * Terminal Class Summary calculation:
 * Aggregate statistics for an entire class over an entire term.
 *
 * NOTE: For mid-term reports the window is truncated at the last date with
 * recorded attendance so early-term percentages aren't artificially low.
 * Once the term ends (or is finalized), the full term window is used.
 */
export type { TerminalClassSummary };

export function calculateTerminalClassSummary(
  classId: string,
  className: string,
  term: Term,
  calendarDays: CalendarDay[],
  students: Student[],
  attendanceRecords: AttendanceRecord[],
  schoolDaysOfWeek: number[] = [1, 2, 3, 4, 5]
): TerminalClassSummary {
  // Determine the effective window (may be shorter than the term if mid-term)
  const window = getEffectiveClassTermWindow(classId, term, attendanceRecords);

  const effectiveTerm: Term = window.isFullTerm
    ? term
    : { ...term, startDate: window.startDate, endDate: window.endDate };

  const { daysList, totalDays } = calculateTermSchoolDays(
    effectiveTerm,
    calendarDays,
    schoolDaysOfWeek
  );

  // Students belonging to this class who were enrolled at some point during the term
  const classStudents = students.filter((s) => s.classId === classId);

  const studentSummaries = classStudents.map((student) =>
    calculateStudentAttendanceSummary(student, daysList, attendanceRecords)
  );

  let totalMorningPresent = 0;
  let totalAfternoonPresent = 0;
  let totalLateCount = 0;
  let totalPossibleSessions = 0;

  let boysMorning = 0;
  let boysAfternoon = 0;
  let boysPossible = 0;

  let girlsMorning = 0;
  let girlsAfternoon = 0;
  let girlsPossible = 0;

  for (const s of studentSummaries) {
    totalMorningPresent += s.morningPresent;
    totalAfternoonPresent += s.afternoonPresent;
    totalLateCount += s.totalLate;
    totalPossibleSessions += s.possibleSessions;

    if (s.student.gender === 'MALE') {
      boysMorning += s.morningPresent;
      boysAfternoon += s.afternoonPresent;
      boysPossible += s.possibleSessions;
    } else {
      girlsMorning += s.morningPresent;
      girlsAfternoon += s.afternoonPresent;
      girlsPossible += s.possibleSessions;
    }
  }

  const totalSessionsAttended = totalMorningPresent + totalAfternoonPresent;
  const boysTotalAttended = boysMorning + boysAfternoon;
  const girlsTotalAttended = girlsMorning + girlsAfternoon;

  const totalBoys = classStudents.filter((s) => s.gender === 'MALE').length;
  const totalGirls = classStudents.filter((s) => s.gender === 'FEMALE').length;

  const averageAttendancePerDay =
    totalDays > 0 ? formatPercentage(totalSessionsAttended / (totalDays * 2)) : 0;

  return {
    classId,
    className,
    totalStudentsOnRoll: classStudents.length,
    totalBoysOnRoll: totalBoys,
    totalGirlsOnRoll: totalGirls,
    schoolOpeningDays: totalDays,
    totalMorningPresent,
    totalAfternoonPresent,
    totalSessionsAttended,
    totalPossibleSessions,
    averageAttendancePerDay,
    overallAttendancePercentage: calculateAttendancePercentage(
      totalSessionsAttended,
      totalPossibleSessions
    ),
    totalLateCount,
    overallPunctualityPercentage: calculatePunctualityPercentage(
      totalSessionsAttended,
      totalLateCount
    ),
    boysMorningPresent: boysMorning,
    boysAfternoonPresent: boysAfternoon,
    boysTotalAttended,
    boysPossibleSessions: boysPossible,
    boysAttendancePercentage: calculateAttendancePercentage(
      boysTotalAttended,
      boysPossible
    ),
    girlsMorningPresent: girlsMorning,
    girlsAfternoonPresent: girlsAfternoon,
    girlsTotalAttended,
    girlsPossibleSessions: girlsPossible,
    girlsAttendancePercentage: calculateAttendancePercentage(
      girlsTotalAttended,
      girlsPossible
    ),
    studentSummaries,
  };
}