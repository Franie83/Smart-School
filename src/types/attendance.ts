// Types for Smart School Attendance Register

export type UserRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolId: string;
  assignedClassIds?: string[]; // Classes this teacher is assigned to
  phone?: string;
  avatar?: string;
  subject?: string;
  qualification?: string;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'NOT_MARKED';
export type LatenessStatus = 'ON_TIME' | 'LATE';
export type AttendanceSession = 'MORNING' | 'AFTERNOON';

export type StudentStatus = 'ACTIVE' | 'WITHDRAWN' | 'TRANSFERRED' | 'GRADUATED';
export type Gender = 'MALE' | 'FEMALE';

export type DayType =
  | 'SCHOOL_DAY'
  | 'PUBLIC_HOLIDAY'
  | 'SCHOOL_HOLIDAY'
  | 'WEEKEND'
  | 'EXAMINATION'
  | 'SPECIAL_EVENT'
  | 'CLOSED';

export type TermStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED';

export interface School {
  id: string;
  name: string;
  logoUrl?: string;
  address: string;
  phone: string;
  email: string;
  principalName: string;
  schoolDaysOfWeek: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
  academicSessionId: string;
  currentTermId: string;
  morningStartTime?: string; // e.g. "08:00"
  morningLateCutoffTime?: string; // e.g. "08:15"
  afternoonStartTime?: string; // e.g. "13:00"
  afternoonLateCutoffTime?: string; // e.g. "13:15"
}

export interface AcademicSession {
  id: string;
  schoolId: string;
  name: string; // e.g. "2026/2027"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isCurrent: boolean;
}

export interface Term {
  id: string;
  schoolId: string;
  sessionId: string;
  name: string; // e.g. "First Term", "Second Term", "Third Term"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: TermStatus;
  isFinalized: boolean;
  finalizedAt?: string;
  finalizedBy?: string;
  manualSchoolOpeningDays?: number; // Override if specified
}

export interface SchoolClass {
  id: string;
  schoolId: string;
  name: string; // e.g. "JSS 1", "SS 2", "Primary 3"
  arm: string; // e.g. "A", "B", "Gold"
  sessionId: string;
  teacherId?: string;
  capacity?: number;
  status: 'ACTIVE' | 'ARCHIVED';
}

export interface Student {
  id: string;
  schoolId: string;
  admissionNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  gender: Gender;
  dateOfBirth?: string;
  classId: string; // current class
  arm: string;
  dateOfAdmission: string; // YYYY-MM-DD
  dateOfWithdrawal?: string; // YYYY-MM-DD (if withdrawn/transferred)
  status: StudentStatus;
  parentName?: string;
  parentPhone?: string;
  address?: string;
  photoUrl?: string;
  notes?: string;
  createdAt: string;
  punctualityScore?: number;
  lateCount?: number;
  punctualityTier?: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT';
}

export interface StudentMovementRecord {
  id: string;
  studentId: string;
  date: string;
  type: 'NEW_ADMISSION' | 'CLASS_TRANSFER' | 'ARM_TRANSFER' | 'PROMOTION' | 'WITHDRAWAL' | 'GRADUATION';
  fromClassId?: string;
  toClassId?: string;
  fromArm?: string;
  toArm?: string;
  reason?: string;
  recordedBy: string;
  recordedAt: string;
}

export interface CalendarDay {
  id: string;
  schoolId: string;
  date: string; // YYYY-MM-DD
  dayType: DayType;
  description?: string;
  isOverride: boolean;
}

export interface AttendanceRecord {
  id: string;
  schoolId: string;
  studentId: string;
  classId: string;
  sessionId: string;
  termId: string;
  date: string; // YYYY-MM-DD
  morningStatus: AttendanceStatus;
  afternoonStatus: AttendanceStatus;
  morningLateness: LatenessStatus;
  afternoonLateness: LatenessStatus;
  morningArrivalTime?: string; // e.g. "08:24"
  afternoonArrivalTime?: string; // e.g. "13:08"
  notes?: string;
  markedByUserId: string;
  updatedAt: string;
}

export interface AttendanceAuditLog {
  id: string;
  schoolId: string;
  attendanceRecordId?: string;
  studentId: string;
  studentName: string;
  classId: string;
  date: string;
  session: AttendanceSession | 'BOTH';
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  changedByUserId: string;
  changedByUserName: string;
  timestamp: string;
  reason?: string;
}

export interface TermUnlockAuditLog {
  id: string;
  schoolId: string;
  termId: string;
  termName: string;
  unlockedByUserId: string;
  unlockedByUserName: string;
  timestamp: string;
  reason: string;
}

export interface RegisterSymbolSettings {
  morningPresentOnly: string; // default "\"
  afternoonPresentOnly: string; // default "/"
  bothPresent: string; // default "V"
  bothAbsent: string; // default "OO"
  morningPresentAfternoonAbsent: string; // default "\O" or "\"
  morningAbsentAfternoonPresent: string; // default "O/" or "/"
  morningExcusedAfternoonPresent: string; // default "E/"
  morningPresentAfternoonExcused: string; // default "\E"
  bothExcused: string; // default "EE"
  notMarked: string; // default "-"
}

export interface DailyClassAttendanceSummary {
  date: string;
  classId: string;
  className: string;
  studentsOnRoll: number;
  morningPresent: number;
  morningAbsent: number;
  morningExcused: number;
  morningLate: number;
  afternoonPresent: number;
  afternoonAbsent: number;
  afternoonExcused: number;
  afternoonLate: number;
  totalSessionsAttended: number;
  totalPossibleSessions: number;
  attendancePercentage: number;
  punctualityPercentage: number;
  boysOnRoll: number;
  boysPresentSessions: number;
  boysPossibleSessions: number;
  boysAttendancePercentage: number;
  girlsOnRoll: number;
  girlsPresentSessions: number;
  girlsPossibleSessions: number;
  girlsAttendancePercentage: number;
}

export interface LateIncident {
  date: string;
  session: 'MORNING' | 'AFTERNOON';
  arrivalTime?: string;
  minutesLate?: number;
  notes?: string;
}

export interface StudentAttendanceSummary {
  student: Student;
  daysSchoolOpened: number;
  daysEnrolled: number;
  possibleSessions: number;
  morningPresent: number;
  morningAbsent: number;
  morningExcused: number;
  afternoonPresent: number;
  afternoonAbsent: number;
  afternoonExcused: number;
  totalSessionsAttended: number;
  attendancePercentage: number;
  morningLate: number;
  afternoonLate: number;
  totalLate: number;
  punctualityPercentage: number;
  punctualityScore: number;
  punctualityTier: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT';
  lateArrivalHistory: LateIncident[];
}

export interface TerminalClassSummary {
  classId: string;
  className: string;
  totalStudentsOnRoll: number;
  totalBoysOnRoll: number;
  totalGirlsOnRoll: number;
  schoolOpeningDays: number;
  totalMorningPresent: number;
  totalAfternoonPresent: number;
  totalSessionsAttended: number;
  totalPossibleSessions: number;
  averageAttendancePerDay: number;
  overallAttendancePercentage: number;
  totalLateCount: number;
  overallPunctualityPercentage: number;
  boysMorningPresent: number;
  boysAfternoonPresent: number;
  boysTotalAttended: number;
  boysPossibleSessions: number;
  boysAttendancePercentage: number;
  girlsMorningPresent: number;
  girlsAfternoonPresent: number;
  girlsTotalAttended: number;
  girlsPossibleSessions: number;
  girlsAttendancePercentage: number;
  studentSummaries: StudentAttendanceSummary[];
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  category?: 'CORE' | 'VOCATIONAL' | 'ELECTIVE';
  maxCA?: number; // default 40
  maxExam?: number; // default 60
}

export interface AssessmentScore {
  id: string;
  studentId: string;
  classId: string;
  termId: string;
  sessionId: string;
  subjectId: string;
  subjectName: string;
  caScore: number;
  examScore: number;
  totalScore: number;
  grade: string;
  remark: string;
  subjectPosition?: number;
  classHighest?: number;
  classLowest?: number;
  classAverage?: number;
  teacherId?: string;
  teacherName?: string;
  updatedAt: string;
}

export interface StudentReportCard {
  id?: string;
  verificationCode?: string;
  studentId: string;
  student: Student;
  classId: string;
  className: string;
  termId: string;
  termName: string;
  sessionId: string;
  sessionName: string;
  scores: AssessmentScore[];
  totalScoreObtained: number;
  totalPossibleScore: number;
  averagePercentage: number;
  positionInClass: number;
  totalStudentsInClass: number;
  overallGrade: string;
  overallRemark: string;

  // Correlated Attendance & Punctuality Record
  attendance: {
    totalSessionsOpened: number;
    sessionsAttended: number;
    sessionsAbsent: number;
    sessionsLate: number;
    attendancePercentage: number;
    punctualityScore: number;
    punctualityTier: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT';
    summaryRemark: string;
  };

  formMasterRemark: string;
  principalRemark: string;
  resumptionDate?: string;
  generatedAt: string;
}
