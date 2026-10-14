import { appStorage } from './serverStorage';
// Storage and Database service for Smart School Attendance Register
import {
  AcademicSession,
  AssessmentScore,
  AttendanceAuditLog,
  AttendanceRecord,
  CalendarDay,
  RegisterSymbolSettings,
  School,
  SchoolClass,
  Student,
  StudentMovementRecord,
  StudentReportCard,
  Subject,
  Term,
  TermUnlockAuditLog,
  User,
  UserRole,
} from '../types/attendance';
import {
  INITIAL_ASSESSMENT_SCORES,
  INITIAL_AUDIT_LOGS,
  INITIAL_CALENDAR_DAYS,
  INITIAL_CLASSES,
  INITIAL_SCHOOL,
  INITIAL_SESSIONS,
  INITIAL_STUDENTS,
  INITIAL_SUBJECTS,
  INITIAL_TERMS,
  INITIAL_USERS,
  generateInitialAttendanceRecords,
} from './seedData';
import { DEFAULT_REGISTER_SYMBOLS } from '../utils/symbolHelper';
import {
  calculateGradeAndRemark,
  generateClassRankingsAndReportCards,
} from '../utils/academicEngine';
import { formatLocalDate } from '../utils/dateUtils';

const STORAGE_KEYS = {
  SCHOOL: 'smart_register_school',
  SESSIONS: 'smart_register_sessions',
  TERMS: 'smart_register_terms',
  CLASSES: 'smart_register_classes',
  STUDENTS: 'smart_register_students',
  STUDENT_MOVEMENTS: 'smart_register_movements',
  CALENDAR: 'smart_register_calendar',
  ATTENDANCE: 'smart_register_attendance',
  AUDIT_LOGS: 'smart_register_audit_logs',
  TERM_UNLOCK_LOGS: 'smart_register_term_unlock_logs',
  USERS: 'smart_register_users',
  CURRENT_USER: 'smart_register_current_user',
  SETTINGS_SYMBOLS: 'smart_register_symbols',
  OFFLINE_DRAFTS: 'smart_register_drafts',
  SUBJECTS: 'smart_register_subjects',
  ASSESSMENT_SCORES: 'smart_register_assessment_scores',
  REPORT_CARDS: 'smart_register_report_cards',
};

class StorageService {
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initIfEmpty();
  }

  private initIfEmpty() {
    try {
      if (!appStorage.getItem(STORAGE_KEYS.SCHOOL)) {
        this.resetToSeedData();
      }
    } catch (e) {
      console.error('Storage initialization error:', e);
    }
  }

  public subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Listener notification error:', err);
      }
    });
  }

  public resetToSeedData() {
    appStorage.setItem(STORAGE_KEYS.SCHOOL, JSON.stringify(INITIAL_SCHOOL));
    appStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(INITIAL_SESSIONS));
    appStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(INITIAL_TERMS));
    appStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(INITIAL_CLASSES));
    appStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
    appStorage.setItem(STORAGE_KEYS.STUDENT_MOVEMENTS, JSON.stringify([]));
    appStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify(INITIAL_CALENDAR_DAYS));
    appStorage.setItem(
      STORAGE_KEYS.ATTENDANCE,
      JSON.stringify(generateInitialAttendanceRecords())
    );
    appStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(INITIAL_AUDIT_LOGS));
    appStorage.setItem(STORAGE_KEYS.TERM_UNLOCK_LOGS, JSON.stringify([]));
    appStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    appStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(INITIAL_USERS[1]));
    appStorage.setItem(
      STORAGE_KEYS.SETTINGS_SYMBOLS,
      JSON.stringify(DEFAULT_REGISTER_SYMBOLS)
    );
    appStorage.setItem(STORAGE_KEYS.OFFLINE_DRAFTS, JSON.stringify({}));
    appStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(INITIAL_SUBJECTS));
    appStorage.setItem(STORAGE_KEYS.ASSESSMENT_SCORES, JSON.stringify(INITIAL_ASSESSMENT_SCORES));
    appStorage.setItem(STORAGE_KEYS.REPORT_CARDS, JSON.stringify([]));
    this.notify();
  }

  // --- SCHOOL ---
  public getSchool(): School {
    const raw = appStorage.getItem(STORAGE_KEYS.SCHOOL);
    return raw ? JSON.parse(raw) : INITIAL_SCHOOL;
  }

  public updateSchool(school: Partial<School>): School {
    const current = this.getSchool();
    const updated = { ...current, ...school };
    appStorage.setItem(STORAGE_KEYS.SCHOOL, JSON.stringify(updated));
    this.notify();
    return updated;
  }

  // --- SESSIONS & TERMS ---
  public getSessions(): AcademicSession[] {
    const raw = appStorage.getItem(STORAGE_KEYS.SESSIONS);
    return raw ? JSON.parse(raw) : INITIAL_SESSIONS;
  }

  public addSession(session: Omit<AcademicSession, 'id'>): AcademicSession {
    const sessions = this.getSessions();
    const newSession: AcademicSession = {
      ...session,
      id: `session_${Date.now()}`,
    };
    if (newSession.isCurrent) {
      sessions.forEach((s) => (s.isCurrent = false));
    }
    sessions.push(newSession);
    appStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    this.notify();
    return newSession;
  }

  public getTerms(): Term[] {
    const raw = appStorage.getItem(STORAGE_KEYS.TERMS);
    return raw ? JSON.parse(raw) : INITIAL_TERMS;
  }

  public addTerm(term: Omit<Term, 'id' | 'isFinalized'>): Term {
    const terms = this.getTerms();
    const newTerm: Term = {
      ...term,
      id: `term_${Date.now()}`,
      isFinalized: false,
    };
    terms.push(newTerm);
    appStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(terms));
    this.notify();
    return newTerm;
  }

  public updateTerm(termId: string, updates: Partial<Term>): Term | null {
    const terms = this.getTerms();
    const idx = terms.findIndex((t) => t.id === termId);
    if (idx === -1) return null;
    terms[idx] = { ...terms[idx], ...updates };
    appStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(terms));
    this.notify();
    return terms[idx];
  }


  public setCurrentSession(sessionId: string): boolean {
    const sessions = this.getSessions();
    const idx = sessions.findIndex((s) => s.id === sessionId);
    if (idx === -1) return false;

    sessions.forEach((s) => (s.isCurrent = s.id === sessionId));
    appStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));

    // Keep the school pointer in sync so navbar, dropdowns, and reports
    // all agree on which session is current.
    this.updateSchool({ academicSessionId: sessionId });

    this.notify();
    return true;
  }

  public updateSession(
    sessionId: string,
    updates: Partial<AcademicSession>
  ): AcademicSession | null {
    const sessions = this.getSessions();
    const idx = sessions.findIndex((s) => s.id === sessionId);
    if (idx === -1) return null;

    const next: AcademicSession = { ...sessions[idx], ...updates, id: sessionId };

    // If we're making this session current, flip the others off
    if (updates.isCurrent === true) {
      sessions.forEach((s, i) => {
        if (i !== idx) s.isCurrent = false;
      });
    }

    sessions[idx] = next;
    appStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));

    // If this is now current, sync school pointer
    if (next.isCurrent) {
      this.updateSchool({ academicSessionId: sessionId });
    }

    this.notify();
    return next;
  }

  public removeSession(sessionId: string): { removed: boolean; termsRemoved: number } {
    const sessions = this.getSessions();
    const idx = sessions.findIndex((s) => s.id === sessionId);
    if (idx === -1) return { removed: false, termsRemoved: 0 };

    // Cascade: delete all terms that belong to this session
    const terms = this.getTerms();
    const before = terms.length;
    const remainingTerms = terms.filter((t) => t.sessionId !== sessionId);
    const termsRemoved = before - remainingTerms.length;

    sessions.splice(idx, 1);
    appStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    if (termsRemoved > 0) {
      appStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(remainingTerms));
    }

    this.notify();
    return { removed: true, termsRemoved };
  }

  public removeTerm(termId: string): boolean {
    const terms = this.getTerms();
    const idx = terms.findIndex((t) => t.id === termId);
    if (idx === -1) return false;

    terms.splice(idx, 1);
    appStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(terms));

    this.notify();
    return true;
  }

  public finalizeTerm(termId: string, userId: string): boolean {
    const terms = this.getTerms();
    const idx = terms.findIndex((t) => t.id === termId);
    if (idx === -1) return false;
    terms[idx].isFinalized = true;
    terms[idx].status = 'COMPLETED';
    terms[idx].finalizedAt = new Date().toISOString();
    terms[idx].finalizedBy = userId;
    appStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(terms));
    this.notify();
    return true;
  }

  public unlockTerm(termId: string, user: User, reason: string): boolean {
    const terms = this.getTerms();
    const idx = terms.findIndex((t) => t.id === termId);
    if (idx === -1) return false;
    terms[idx].isFinalized = false;
    terms[idx].status = 'ACTIVE';
    appStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(terms));

    const unlockLogs: TermUnlockAuditLog[] = this.getTermUnlockLogs();
    unlockLogs.unshift({
      id: `unlock_${Date.now()}`,
      schoolId: terms[idx].schoolId,
      termId,
      termName: terms[idx].name,
      unlockedByUserId: user.id,
      unlockedByUserName: user.name,
      timestamp: new Date().toISOString(),
      reason,
    });
    appStorage.setItem(STORAGE_KEYS.TERM_UNLOCK_LOGS, JSON.stringify(unlockLogs));
    this.notify();
    return true;
  }

  public getTermUnlockLogs(): TermUnlockAuditLog[] {
    const raw = appStorage.getItem(STORAGE_KEYS.TERM_UNLOCK_LOGS);
    return raw ? JSON.parse(raw) : [];
  }

  // --- CLASSES ---
  public getClasses(): SchoolClass[] {
    const raw = appStorage.getItem(STORAGE_KEYS.CLASSES);
    return raw ? JSON.parse(raw) : INITIAL_CLASSES;
  }

  public addClass(c: Omit<SchoolClass, 'id'>): SchoolClass {
    const classes = this.getClasses();
    const newClass: SchoolClass = {
      ...c,
      id: `class_${Date.now()}`,
    };
    classes.push(newClass);
    appStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
    this.notify();
    return newClass;
  }

  public updateClass(classId: string, updates: Partial<SchoolClass>): SchoolClass | null {
    const classes = this.getClasses();
    const idx = classes.findIndex((c) => c.id === classId);
    if (idx === -1) return null;
    classes[idx] = { ...classes[idx], ...updates };
    appStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
    this.notify();
    return classes[idx];
  }

  public removeClass(classId: string): boolean {
    const classes = this.getClasses();
    const idx = classes.findIndex((c) => c.id === classId);
    if (idx === -1) return false;
    classes.splice(idx, 1);
    appStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
    this.notify();
    return true;
  }

  // --- STUDENTS ---
  public getStudents(): Student[] {
    const raw = appStorage.getItem(STORAGE_KEYS.STUDENTS);
    const students: Student[] = raw ? JSON.parse(raw) : INITIAL_STUDENTS;
    const records = this.getAttendanceRecords();

    return students.map((s) => {
      const studentRecs = records.filter((r) => r.studentId === s.id);
      let attended = 0;
      let late = 0;
      studentRecs.forEach((r) => {
        if (r.morningStatus === 'PRESENT') {
          attended++;
          if (r.morningLateness === 'LATE') late++;
        }
        if (r.afternoonStatus === 'PRESENT') {
          attended++;
          if (r.afternoonLateness === 'LATE') late++;
        }
      });
      const punctualityScore =
        attended > 0 ? Math.round(((attended - late) * 1000) / attended) / 10 : 100;
      const punctualityTier: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT' =
        punctualityScore >= 90
          ? 'EXCELLENT'
          : punctualityScore >= 80
          ? 'GOOD'
          : 'NEEDS_IMPROVEMENT';

      return {
        ...s,
        punctualityScore: s.punctualityScore !== undefined ? s.punctualityScore : punctualityScore,
        lateCount: late,
        punctualityTier: s.punctualityTier || punctualityTier,
      };
    });
  }

  public addStudent(studentData: Omit<Student, 'id' | 'createdAt'>): Student {
    const students = this.getStudents();

    const existing = students.find(
      (s) =>
        s.admissionNumber.trim().toLowerCase() ===
        studentData.admissionNumber.trim().toLowerCase()
    );
    if (existing) {
      throw new Error(`Admission Number "${studentData.admissionNumber}" already exists!`);
    }

    const newStudent: Student = {
      ...studentData,
      id: `stu_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    students.push(newStudent);
    appStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));

    this.recordStudentMovement({
      studentId: newStudent.id,
      date: newStudent.dateOfAdmission,
      type: 'NEW_ADMISSION',
      toClassId: newStudent.classId,
      toArm: newStudent.arm,
      reason: 'Initial enrollment',
      recordedBy: 'Admin',
    });

    this.notify();
    return newStudent;
  }

  public bulkAddStudents(studentsData: Array<Omit<Student, 'id' | 'createdAt'>>): {
    inserted: Student[];
    failed: Array<{ admissionNumber: string; reason: string }>;
  } {
    const students = this.getStudents();
    const existingAdmissionSet = new Set(
      students.map((s) => s.admissionNumber.trim().toLowerCase())
    );

    const inserted: Student[] = [];
    const failed: Array<{ admissionNumber: string; reason: string }> = [];

    const nowIso = new Date().toISOString();

    studentsData.forEach((item, index) => {
      const admKey = item.admissionNumber?.trim()?.toLowerCase();
      if (!admKey) {
        failed.push({
          admissionNumber: item.admissionNumber || `Row #${index + 1}`,
          reason: 'Admission number is required',
        });
        return;
      }
      if (!item.firstName?.trim() || !item.lastName?.trim()) {
        failed.push({
          admissionNumber: item.admissionNumber,
          reason: 'First name and Last name are required',
        });
        return;
      }
      if (existingAdmissionSet.has(admKey)) {
        failed.push({
          admissionNumber: item.admissionNumber,
          reason: `Admission number "${item.admissionNumber}" is already in use`,
        });
        return;
      }

      existingAdmissionSet.add(admKey);
      const newStudent: Student = {
        ...item,
        id: `stu_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        createdAt: nowIso,
        punctualityScore: 100,
        lateCount: 0,
        punctualityTier: 'EXCELLENT',
      };

      students.push(newStudent);
      inserted.push(newStudent);

      this.recordStudentMovement({
        studentId: newStudent.id,
        date: newStudent.dateOfAdmission || nowIso.slice(0, 10),
        type: 'NEW_ADMISSION',
        toClassId: newStudent.classId,
        toArm: newStudent.arm,
        reason: 'Bulk onboarding',
        recordedBy: 'Admin',
      });
    });

    if (inserted.length > 0) {
      appStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
      this.notify();
    }

    return { inserted, failed };
  }

  public updateStudent(studentId: string, updates: Partial<Student>): Student | null {
    const students = this.getStudents();
    const idx = students.findIndex((s) => s.id === studentId);
    if (idx === -1) return null;
    students[idx] = { ...students[idx], ...updates };
    appStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    this.notify();
    return students[idx];
  }

  /**
   * Soft-delete a student: mark as WITHDRAWN with an effective date.
   * Preserves all attendance/assessment/report-card history.
   * Records a movement for the audit trail.
   */
  public withdrawStudent(
    studentId: string,
    effectiveDate: string,
    reason: string,
    recordedBy: string
  ): boolean {
    const students = this.getStudents();
    const idx = students.findIndex((s) => s.id === studentId);
    if (idx === -1) return false;

    const fromClassId = students[idx].classId;
    const fromArm = students[idx].arm;
    const fullName = `${students[idx].firstName} ${students[idx].lastName}`;

    students[idx] = {
      ...students[idx],
      status: 'WITHDRAWN',
      dateOfWithdrawal: effectiveDate,
    };
    appStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));

    this.recordStudentMovement({
      studentId,
      date: effectiveDate,
      type: 'WITHDRAWAL',
      fromClassId,
      fromArm,
      toClassId: fromClassId,
      toArm: fromArm,
      reason: reason || `Withdrew ${fullName}`,
      recordedBy,
    });

    this.notify();
    return true;
  }

  /**
   * Hard-delete a student and cascade to all dependent records.
   * Removes the student, then prunes their attendance, scores,
   * report cards, and movements.
   * Returns counts of everything removed.
   */
  public removeStudent(studentId: string): {
    removed: {
      student: boolean;
      attendance: number;
      scores: number;
      reportCards: number;
      movements: number;
    };
  } {
    const students = this.getStudents();
    const idx = students.findIndex((s) => s.id === studentId);
    if (idx === -1) {
      return {
        removed: {
          student: false,
          attendance: 0,
          scores: 0,
          reportCards: 0,
          movements: 0,
        },
      };
    }

    students.splice(idx, 1);
    appStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));

    // Cascade: attendance
    const attendance = this.getAttendanceRecords();
    const attendanceAfter = attendance.filter((r) => r.studentId !== studentId);
    const attendanceRemoved = attendance.length - attendanceAfter.length;
    if (attendanceRemoved > 0) {
      appStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendanceAfter));
    }

    // Cascade: assessment scores
    const scores = this.getAssessmentScores();
    const scoresAfter = scores.filter((sc) => sc.studentId !== studentId);
    const scoresRemoved = scores.length - scoresAfter.length;
    if (scoresRemoved > 0) {
      appStorage.setItem(STORAGE_KEYS.ASSESSMENT_SCORES, JSON.stringify(scoresAfter));
    }

    // Cascade: report cards
    const cards = this.getReportCards();
    const cardsAfter = cards.filter((rc) => rc.studentId !== studentId);
    const cardsRemoved = cards.length - cardsAfter.length;
    if (cardsRemoved > 0) {
      appStorage.setItem(STORAGE_KEYS.REPORT_CARDS, JSON.stringify(cardsAfter));
    }

    // Cascade: movements
    const movements = this.getStudentMovements();
    const movementsAfter = movements.filter((m) => m.studentId !== studentId);
    const movementsRemoved = movements.length - movementsAfter.length;
    if (movementsRemoved > 0) {
      appStorage.setItem(
        STORAGE_KEYS.STUDENT_MOVEMENTS,
        JSON.stringify(movementsAfter)
      );
    }

    this.notify();
    return {
      removed: {
        student: true,
        attendance: attendanceRemoved,
        scores: scoresRemoved,
        reportCards: cardsRemoved,
        movements: movementsRemoved,
      },
    };
  }


  /**
   * Bulk soft-delete: withdraw many students with a single effective date.
   * Records one WITHDRAWAL movement per student.
   */
  public bulkWithdrawStudents(
    studentIds: string[],
    effectiveDate: string,
    reason: string,
    recordedBy: string
  ): { withdrawn: number; skipped: string[] } {
    const students = this.getStudents();
    const idSet = new Set(studentIds);
    let withdrawn = 0;
    const skipped: string[] = [];

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      if (!idSet.has(s.id)) continue;
      if (s.status === 'WITHDRAWN') {
        skipped.push(s.id);
        continue;
      }

      const fromClassId = s.classId;
      const fromArm = s.arm;
      const fullName = `${s.firstName} ${s.lastName}`;

      students[i] = {
        ...s,
        status: 'WITHDRAWN',
        dateOfWithdrawal: effectiveDate,
      };
      withdrawn++;

      this.recordStudentMovement({
        studentId: s.id,
        date: effectiveDate,
        type: 'WITHDRAWAL',
        fromClassId,
        fromArm,
        toClassId: fromClassId,
        toArm: fromArm,
        reason: reason || `Bulk withdrawal: ${fullName}`,
        recordedBy,
      });
    }

    appStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    this.notify();
    return { withdrawn, skipped };
  }

  /**
   * Bulk class change: move many students to a target class.
   * Records a CLASS_TRANSFER movement per student.
   */
  public bulkChangeClass(
    studentIds: string[],
    targetClassId: string,
    targetArm: string,
    reason: string,
    recordedBy: string
  ): { changed: number; skipped: string[] } {
    const students = this.getStudents();
    const idSet = new Set(studentIds);
    let changed = 0;
    const skipped: string[] = [];

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      if (!idSet.has(s.id)) continue;
      if (s.classId === targetClassId) {
        skipped.push(s.id);
        continue;
      }

      const fromClassId = s.classId;
      const fromArm = s.arm;

      students[i] = {
        ...s,
        classId: targetClassId,
        arm: targetArm,
      };
      changed++;

      this.recordStudentMovement({
        studentId: s.id,
        date: formatLocalDate(new Date()),
        type: 'CLASS_TRANSFER',
        fromClassId,
        fromArm,
        toClassId: targetClassId,
        toArm: targetArm,
        reason: reason || 'Bulk class transfer',
        recordedBy,
      });
    }

    appStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    this.notify();
    return { changed, skipped };
  }

  /**
   * Bulk hard-delete: cascade-remove many students and all their data.
   */
  public bulkRemoveStudents(studentIds: string[]): {
    removed: {
      students: number;
      attendance: number;
      scores: number;
      reportCards: number;
      movements: number;
    };
  } {
    const idSet = new Set(studentIds);

    const students = this.getStudents();
    const studentsBefore = students.length;
    const studentsAfter = students.filter((s) => !idSet.has(s.id));
    const studentsRemoved = studentsBefore - studentsAfter.length;
    appStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(studentsAfter));

    const attendance = this.getAttendanceRecords();
    const attendanceBefore = attendance.length;
    const attendanceAfter = attendance.filter((r) => !idSet.has(r.studentId));
    const attendanceRemoved = attendanceBefore - attendanceAfter.length;
    if (attendanceRemoved > 0) {
      appStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendanceAfter));
    }

    const scores = this.getAssessmentScores();
    const scoresBefore = scores.length;
    const scoresAfter = scores.filter((sc) => !idSet.has(sc.studentId));
    const scoresRemoved = scoresBefore - scoresAfter.length;
    if (scoresRemoved > 0) {
      appStorage.setItem(STORAGE_KEYS.ASSESSMENT_SCORES, JSON.stringify(scoresAfter));
    }

    const cards = this.getReportCards();
    const cardsBefore = cards.length;
    const cardsAfter = cards.filter((rc) => !idSet.has(rc.studentId));
    const cardsRemoved = cardsBefore - cardsAfter.length;
    if (cardsRemoved > 0) {
      appStorage.setItem(STORAGE_KEYS.REPORT_CARDS, JSON.stringify(cardsAfter));
    }

    const movements = this.getStudentMovements();
    const movementsBefore = movements.length;
    const movementsAfter = movements.filter((m) => !idSet.has(m.studentId));
    const movementsRemoved = movementsBefore - movementsAfter.length;
    if (movementsRemoved > 0) {
      appStorage.setItem(
        STORAGE_KEYS.STUDENT_MOVEMENTS,
        JSON.stringify(movementsAfter)
      );
    }

    this.notify();
    return {
      removed: {
        students: studentsRemoved,
        attendance: attendanceRemoved,
        scores: scoresRemoved,
        reportCards: cardsRemoved,
        movements: movementsRemoved,
      },
    };
  }

  public moveStudent(params: {
    studentId: string;
    type: 'CLASS_TRANSFER' | 'ARM_TRANSFER' | 'PROMOTION' | 'WITHDRAWAL' | 'GRADUATION';
    effectiveDate: string;
    toClassId?: string;
    toArm?: string;
    reason: string;
    recordedBy: string;
  }): boolean {
    const student = this.getStudents().find((s) => s.id === params.studentId);
    if (!student) return false;

    const fromClassId = student.classId;
    const fromArm = student.arm;

    const updates: Partial<Student> = {};
    if (params.type === 'WITHDRAWAL') {
      updates.status = 'WITHDRAWN';
      updates.dateOfWithdrawal = params.effectiveDate;
    } else if (params.type === 'GRADUATION') {
      updates.status = 'GRADUATED';
      updates.dateOfWithdrawal = params.effectiveDate;
    } else {
      if (params.toClassId) updates.classId = params.toClassId;
      if (params.toArm) updates.arm = params.toArm;
    }

    this.updateStudent(params.studentId, updates);

    this.recordStudentMovement({
      studentId: params.studentId,
      date: params.effectiveDate,
      type: params.type,
      fromClassId,
      fromArm,
      toClassId: params.toClassId || fromClassId,
      toArm: params.toArm || fromArm,
      reason: params.reason,
      recordedBy: params.recordedBy,
    });

    return true;
  }

  public recordStudentMovement(
    data: Omit<StudentMovementRecord, 'id' | 'recordedAt'>
  ) {
    const movements: StudentMovementRecord[] = this.getStudentMovements();
    const newRecord: StudentMovementRecord = {
      ...data,
      id: `mov_${Date.now()}`,
      recordedAt: new Date().toISOString(),
    };
    movements.unshift(newRecord);
    appStorage.setItem(STORAGE_KEYS.STUDENT_MOVEMENTS, JSON.stringify(movements));
  }

  public getStudentMovements(studentId?: string): StudentMovementRecord[] {
    const raw = appStorage.getItem(STORAGE_KEYS.STUDENT_MOVEMENTS);
    const list: StudentMovementRecord[] = raw ? JSON.parse(raw) : [];
    if (studentId) {
      return list.filter((m) => m.studentId === studentId);
    }
    return list;
  }

  // --- CALENDAR DAYS ---
  public getCalendarDays(): CalendarDay[] {
    const raw = appStorage.getItem(STORAGE_KEYS.CALENDAR);
    return raw ? JSON.parse(raw) : INITIAL_CALENDAR_DAYS;
  }

  public setCalendarDay(day: CalendarDay): void {
    const days = this.getCalendarDays();
    const idx = days.findIndex((d) => d.date === day.date);
    if (idx >= 0) {
      days[idx] = day;
    } else {
      days.push(day);
    }
    appStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify(days));
    this.notify();
  }

  public removeCalendarOverride(dateStr: string): void {
    const days = this.getCalendarDays().filter((d) => d.date !== dateStr);
    appStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify(days));
    this.notify();
  }

  // --- ATTENDANCE RECORDS ---
  public getAttendanceRecords(): AttendanceRecord[] {
    const raw = appStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    return raw ? JSON.parse(raw) : [];
  }

  public getAttendanceForClassDate(
    classId: string,
    dateStr: string
  ): AttendanceRecord[] {
    return this.getAttendanceRecords().filter(
      (r) => r.classId === classId && r.date === dateStr
    );
  }

  public saveClassAttendance(params: {
    recordsToSave: Partial<AttendanceRecord>[];
    currentUser: User;
    schoolId: string;
    classId: string;
    date: string;
    termId: string;
    sessionId: string;
    changeReason?: string;
  }): { savedCount: number; auditsLogged: number } {
    const allRecords = this.getAttendanceRecords();
    const auditLogs = this.getAuditLogs();
    const students = this.getStudents();
    const nowIso = new Date().toISOString();

    let savedCount = 0;
    let auditsLogged = 0;

    for (const item of params.recordsToSave) {
      if (!item.studentId) continue;

      let morningLate = item.morningLateness || 'ON_TIME';
      let afternoonLate = item.afternoonLateness || 'ON_TIME';
      if (item.morningStatus === 'ABSENT' || item.morningStatus === 'EXCUSED') {
        morningLate = 'ON_TIME';
      }
      if (item.afternoonStatus === 'ABSENT' || item.afternoonStatus === 'EXCUSED') {
        afternoonLate = 'ON_TIME';
      }

      const existingIndex = allRecords.findIndex(
        (r) => r.studentId === item.studentId && r.date === params.date
      );

      if (existingIndex >= 0) {
        const existing = allRecords[existingIndex];
        const student = students.find((s) => s.id === item.studentId);
        const studentName = student
          ? `${student.firstName} ${student.lastName}`
          : 'Student';

        let hasChanged = false;
        const changes: string[] = [];

        if (
          item.morningStatus !== undefined &&
          item.morningStatus !== existing.morningStatus
        ) {
          hasChanged = true;
          changes.push(
            `Morning: ${existing.morningStatus} -> ${item.morningStatus}`
          );
        }
        if (
          item.afternoonStatus !== undefined &&
          item.afternoonStatus !== existing.afternoonStatus
        ) {
          hasChanged = true;
          changes.push(
            `Afternoon: ${existing.afternoonStatus} -> ${item.afternoonStatus}`
          );
        }
        if (morningLate !== existing.morningLateness) {
          hasChanged = true;
          changes.push(
            `Morning Punctuality: ${existing.morningLateness} -> ${morningLate}`
          );
        }
        if (afternoonLate !== existing.afternoonLateness) {
          hasChanged = true;
          changes.push(
            `Afternoon Punctuality: ${existing.afternoonLateness} -> ${afternoonLate}`
          );
        }

        if (hasChanged) {
          auditLogs.unshift({
            id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            schoolId: params.schoolId,
            attendanceRecordId: existing.id,
            studentId: item.studentId,
            studentName,
            classId: params.classId,
            date: params.date,
            session: 'BOTH',
            fieldChanged: 'Attendance Status / Lateness',
            oldValue: `M: ${existing.morningStatus} (${existing.morningLateness}), A: ${existing.afternoonStatus} (${existing.afternoonLateness})`,
            newValue: `M: ${item.morningStatus || existing.morningStatus} (${morningLate}), A: ${item.afternoonStatus || existing.afternoonStatus} (${afternoonLate})`,
            changedByUserId: params.currentUser.id,
            changedByUserName: params.currentUser.name,
            timestamp: nowIso,
            reason: params.changeReason || 'Correction via Attendance screen',
          });
          auditsLogged++;
        }

        allRecords[existingIndex] = {
          ...existing,
          morningStatus: item.morningStatus ?? existing.morningStatus,
          afternoonStatus: item.afternoonStatus ?? existing.afternoonStatus,
          morningLateness: morningLate,
          afternoonLateness: afternoonLate,
          morningArrivalTime: item.morningArrivalTime !== undefined ? item.morningArrivalTime : existing.morningArrivalTime,
          afternoonArrivalTime: item.afternoonArrivalTime !== undefined ? item.afternoonArrivalTime : existing.afternoonArrivalTime,
          notes: item.notes !== undefined ? item.notes : existing.notes,
          markedByUserId: params.currentUser.id,
          updatedAt: nowIso,
        };
      } else {
        const newRecord: AttendanceRecord = {
          id: `att_${item.studentId}_${params.date}`,
          schoolId: params.schoolId,
          studentId: item.studentId,
          classId: params.classId,
          sessionId: params.sessionId,
          termId: params.termId,
          date: params.date,
          morningStatus: item.morningStatus || 'NOT_MARKED',
          afternoonStatus: item.afternoonStatus || 'NOT_MARKED',
          morningLateness: morningLate,
          afternoonLateness: afternoonLate,
          morningArrivalTime: item.morningArrivalTime,
          afternoonArrivalTime: item.afternoonArrivalTime,
          notes: item.notes,
          markedByUserId: params.currentUser.id,
          updatedAt: nowIso,
        };
        allRecords.push(newRecord);
      }
      savedCount++;
    }

    appStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(allRecords));
    appStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));

    const studentMap = new Map(students.map((s) => [s.id, s]));
    for (const item of params.recordsToSave) {
      if (!item.studentId) continue;
      const st = studentMap.get(item.studentId);
      if (!st) continue;

      const recs = allRecords.filter((r) => r.studentId === st.id);
      let attended = 0;
      let late = 0;
      recs.forEach((r) => {
        if (r.morningStatus === 'PRESENT') {
          attended++;
          if (r.morningLateness === 'LATE') late++;
        }
        if (r.afternoonStatus === 'PRESENT') {
          attended++;
          if (r.afternoonLateness === 'LATE') late++;
        }
      });
      const punctScore =
        attended > 0 ? Math.round(((attended - late) * 1000) / attended) / 10 : 100;
      const tier: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT' =
        punctScore >= 90 ? 'EXCELLENT' : punctScore >= 80 ? 'GOOD' : 'NEEDS_IMPROVEMENT';

      st.punctualityScore = punctScore;
      st.lateCount = late;
      st.punctualityTier = tier;
    }
    appStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(Array.from(studentMap.values())));

    this.clearDraft(params.classId, params.date);

    this.notify();
    return { savedCount, auditsLogged };
  }

  // --- OFFLINE / DRAFTS ---
  public saveDraft(classId: string, date: string, draftData: any) {
    const raw = appStorage.getItem(STORAGE_KEYS.OFFLINE_DRAFTS);
    const drafts = raw ? JSON.parse(raw) : {};
    drafts[`${classId}_${date}`] = {
      savedAt: new Date().toISOString(),
      data: draftData,
    };
    appStorage.setItem(STORAGE_KEYS.OFFLINE_DRAFTS, JSON.stringify(drafts));
  }

  public getDraft(classId: string, date: string): any | null {
    const raw = appStorage.getItem(STORAGE_KEYS.OFFLINE_DRAFTS);
    if (!raw) return null;
    const drafts = JSON.parse(raw);
    return drafts[`${classId}_${date}`] || null;
  }

  public clearDraft(classId: string, date: string) {
    const raw = appStorage.getItem(STORAGE_KEYS.OFFLINE_DRAFTS);
    if (!raw) return;
    const drafts = JSON.parse(raw);
    delete drafts[`${classId}_${date}`];
    appStorage.setItem(STORAGE_KEYS.OFFLINE_DRAFTS, JSON.stringify(drafts));
  }

  // --- AUDIT LOGS ---
  public getAuditLogs(): AttendanceAuditLog[] {
    const raw = appStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    return raw ? JSON.parse(raw) : [];
  }

  // --- REGISTER SYMBOLS SETTINGS ---
  public getRegisterSymbols(): RegisterSymbolSettings {
    const raw = appStorage.getItem(STORAGE_KEYS.SETTINGS_SYMBOLS);
    return raw ? JSON.parse(raw) : DEFAULT_REGISTER_SYMBOLS;
  }

  public updateRegisterSymbols(
    settings: Partial<RegisterSymbolSettings>
  ): RegisterSymbolSettings {
    const current = this.getRegisterSymbols();
    const updated = { ...current, ...settings };
    appStorage.setItem(STORAGE_KEYS.SETTINGS_SYMBOLS, JSON.stringify(updated));
    this.notify();
    return updated;
  }

  // --- USERS & AUTH ---
  public getUsers(): User[] {
    const raw = appStorage.getItem(STORAGE_KEYS.USERS);
    return raw ? JSON.parse(raw) : INITIAL_USERS;
  }

  public addUser(user: Omit<User, 'id'>): User {
    const users = this.getUsers();
    const newUser: User = {
      ...user,
      id: `user_${Date.now()}`,
    };
    users.push(newUser);
    appStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.notify();
    return newUser;
  }

  public bulkAddTeachers(teachersData: Array<Omit<User, 'id'>>): {
    inserted: User[];
    failed: Array<{ email: string; reason: string }>;
  } {
    const users = this.getUsers();
    const classes = this.getClasses();
    const existingEmailSet = new Set(
      users.map((u) => u.email.trim().toLowerCase())
    );

    const inserted: User[] = [];
    const failed: Array<{ email: string; reason: string }> = [];

    teachersData.forEach((item, index) => {
      const emailKey = item.email?.trim()?.toLowerCase();
      if (!emailKey) {
        failed.push({
          email: item.email || `Row #${index + 1}`,
          reason: 'Email is required',
        });
        return;
      }
      if (!item.name?.trim()) {
        failed.push({
          email: item.email,
          reason: 'Teacher name is required',
        });
        return;
      }
      if (existingEmailSet.has(emailKey)) {
        failed.push({
          email: item.email,
          reason: `Email "${item.email}" is already registered`,
        });
        return;
      }

      existingEmailSet.add(emailKey);
      const newUser: User = {
        ...item,
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      };

      users.push(newUser);
      inserted.push(newUser);

      if (newUser.assignedClassIds && newUser.assignedClassIds.length > 0) {
        newUser.assignedClassIds.forEach((classId) => {
          const cls = classes.find((c) => c.id === classId);
          if (cls && !cls.teacherId) {
            cls.teacherId = newUser.id;
          }
        });
      }
    });

    if (inserted.length > 0) {
      appStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      appStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
      this.notify();
    }

    return { inserted, failed };
  }

  public updateUser(userId: string, updates: Partial<User>): User | null {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updates };
    appStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    const cur = this.getCurrentUser();
    if (cur.id === userId) {
      appStorage.setItem(
        STORAGE_KEYS.CURRENT_USER,
        JSON.stringify(users[idx])
      );
    }

    this.notify();
    return users[idx];
  }

  public removeUser(userId: string): boolean {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return false;
    users.splice(idx, 1);
    appStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.notify();
    return true;
  }

/**
   * Server-side account updates. These hit the Flask backend so password
   * changes and role changes actually take effect at login time. The local
   * Users collection is updated as a cache, but the server is authoritative.
   */

  public async updateUserOnServer(
    userId: string,
    updates: {
      name?: string;
      role?: UserRole;
      assignedClassIds?: string[];
      active?: boolean;
      password?: string;
    }
  ): Promise<boolean> {
    const res = await fetch(`/api/admin/accounts/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Server returned ${res.status}`);
    }
    if (
      updates.name !== undefined ||
      updates.role !== undefined ||
      updates.assignedClassIds !== undefined
    ) {
      this.updateUser(userId, {
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.role !== undefined ? { role: updates.role } : {}),
        ...(updates.assignedClassIds !== undefined
          ? { assignedClassIds: updates.assignedClassIds }
          : {}),
      });
    }
    return true;
  }

  public async resetUserPasswordOnServer(
    userId: string,
    newPassword: string
  ): Promise<boolean> {
    const res = await fetch(
      `/api/admin/accounts/${encodeURIComponent(userId)}/reset-password`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Server returned ${res.status}`);
    }
    return true;
  }

  public async deleteUserOnServer(userId: string): Promise<boolean> {
    const res = await fetch(
      `/api/admin/accounts/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Server returned ${res.status}`);
    }
    this.removeUser(userId);
    return true;
  }

  public getCurrentUser(): User {
    const raw = appStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return raw ? JSON.parse(raw) : INITIAL_USERS[1];
  }

  public switchCurrentUser(userId: string): User | null {
    const user = this.getUsers().find((u) => u.id === userId);
    if (!user) return null;
    appStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    this.notify();
    return user;
  }

  // --- ACADEMIC ASSESSMENT & REPORT CARDS ---
  public getSubjects(): Subject[] {
    const raw = appStorage.getItem(STORAGE_KEYS.SUBJECTS);
    return raw ? JSON.parse(raw) : INITIAL_SUBJECTS;
  }

  public addSubject(subject: Omit<Subject, 'id'>): Subject {
    const subjects = this.getSubjects();
    const newSubject: Subject = {
      ...subject,
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    };
    subjects.push(newSubject);
    appStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
    this.notify();
    return newSubject;
  }

  public getAssessmentScores(params?: {
    classId?: string;
    termId?: string;
    subjectId?: string;
    studentId?: string;
  }): AssessmentScore[] {
    const raw = appStorage.getItem(STORAGE_KEYS.ASSESSMENT_SCORES);
    const allScores: AssessmentScore[] = raw ? JSON.parse(raw) : INITIAL_ASSESSMENT_SCORES;
    if (!params) return allScores;

    return allScores.filter((sc) => {
      if (params.classId && sc.classId !== params.classId) return false;
      if (params.termId && sc.termId !== params.termId) return false;
      if (params.subjectId && sc.subjectId !== params.subjectId) return false;
      if (params.studentId && sc.studentId !== params.studentId) return false;
      return true;
    });
  }

  public saveAssessmentScore(
    scoreData: Omit<AssessmentScore, 'id' | 'totalScore' | 'grade' | 'remark' | 'updatedAt'>
  ): AssessmentScore {
    const allScores = this.getAssessmentScores();
    const ca = Math.max(0, Number(scoreData.caScore) || 0);
    const exam = Math.max(0, Number(scoreData.examScore) || 0);
    const total = Math.min(100, Math.round((ca + exam) * 10) / 10);
    const { grade, remark } = calculateGradeAndRemark(total);

    const existingIdx = allScores.findIndex(
      (sc) =>
        sc.studentId === scoreData.studentId &&
        sc.subjectId === scoreData.subjectId &&
        sc.termId === scoreData.termId &&
        sc.classId === scoreData.classId
    );

    const nowIso = new Date().toISOString();
    let savedScore: AssessmentScore;

    if (existingIdx !== -1) {
      savedScore = {
        ...allScores[existingIdx],
        ...scoreData,
        caScore: ca,
        examScore: exam,
        totalScore: total,
        grade,
        remark,
        updatedAt: nowIso,
      };
      allScores[existingIdx] = savedScore;
    } else {
      savedScore = {
        ...scoreData,
        id: `score_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        caScore: ca,
        examScore: exam,
        totalScore: total,
        grade,
        remark,
        updatedAt: nowIso,
      };
      allScores.push(savedScore);
    }

    appStorage.setItem(STORAGE_KEYS.ASSESSMENT_SCORES, JSON.stringify(allScores));
    this.notify();
    return savedScore;
  }

  public bulkSaveAssessmentScores(
    scoresData: Array<Omit<AssessmentScore, 'id' | 'totalScore' | 'grade' | 'remark' | 'updatedAt'>>
  ): AssessmentScore[] {
    const allScores = this.getAssessmentScores();
    const nowIso = new Date().toISOString();
    const result: AssessmentScore[] = [];

    scoresData.forEach((scoreData) => {
      const ca = Math.max(0, Number(scoreData.caScore) || 0);
      const exam = Math.max(0, Number(scoreData.examScore) || 0);
      const total = Math.min(100, Math.round((ca + exam) * 10) / 10);
      const { grade, remark } = calculateGradeAndRemark(total);

      const existingIdx = allScores.findIndex(
        (sc) =>
          sc.studentId === scoreData.studentId &&
          sc.subjectId === scoreData.subjectId &&
          sc.termId === scoreData.termId &&
          sc.classId === scoreData.classId
      );

      let savedScore: AssessmentScore;
      if (existingIdx !== -1) {
        savedScore = {
          ...allScores[existingIdx],
          ...scoreData,
          caScore: ca,
          examScore: exam,
          totalScore: total,
          grade,
          remark,
          updatedAt: nowIso,
        };
        allScores[existingIdx] = savedScore;
      } else {
        savedScore = {
          ...scoreData,
          id: `score_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          caScore: ca,
          examScore: exam,
          totalScore: total,
          grade,
          remark,
          updatedAt: nowIso,
        };
        allScores.push(savedScore);
      }
      result.push(savedScore);
    });

    appStorage.setItem(STORAGE_KEYS.ASSESSMENT_SCORES, JSON.stringify(allScores));
    this.notify();
    return result;
  }

  public getReportCards(classId?: string, termId?: string): StudentReportCard[] {
    const raw = appStorage.getItem(STORAGE_KEYS.REPORT_CARDS);
    let cards: StudentReportCard[] = raw ? JSON.parse(raw) : [];

    if (cards.length === 0) {
      try {
        const classes = this.getClasses();
        const activeClass = classes.find((c) => c.id === 'class_jss1_a') || classes[0];
        const terms = this.getTerms();
        const activeTerm = terms.find((t) => t.id === 'term_1_2026') || terms[0];
        const school = this.getSchool();
        const students = this.getStudents();
        const assessmentScores = this.getAssessmentScores();
        const attendanceRecords = this.getAttendanceRecords();
        const calendarDays = this.getCalendarDays();

        if (activeClass && activeTerm) {
          const generated = generateClassRankingsAndReportCards({
            school,
            activeClass,
            activeTerm,
            sessionName: '2026/2027',
            enrolledStudents: students,
            allAssessmentScores: assessmentScores,
            attendanceRecords,
            calendarDays,
          });

          if (generated.length > 0) {
            cards = generated;
            appStorage.setItem(STORAGE_KEYS.REPORT_CARDS, JSON.stringify(cards));
          }
        }
      } catch (e) {
        // Fallback to empty if bootstrap fails
      }
    }

    if (!classId && !termId) return cards;
    return cards.filter((rc) => {
      if (classId && rc.classId !== classId) return false;
      if (termId && rc.termId !== termId) return false;
      return true;
    });
  }

  public findReportCardsByStudentQuery(query: string): StudentReportCard[] {
    const rawQuery = query.trim().toLowerCase();
    if (!rawQuery) return [];
    const clean = rawQuery.replace(/[^a-z0-9]/g, '');
    let allCards = this.getReportCards();

    let matches = allCards.filter((rc) => {
      const admClean = (rc.student.admissionNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const idClean = (rc.student.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const verClean = (rc.verificationCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const firstName = (rc.student.firstName || '').toLowerCase();
      const lastName = (rc.student.lastName || '').toLowerCase();
      const fullName1 = `${lastName} ${firstName}`;
      const fullName2 = `${firstName} ${lastName}`;

      return (
        admClean === clean ||
        admClean.includes(clean) ||
        clean.includes(admClean) ||
        idClean === clean ||
        verClean === clean ||
        verClean.includes(clean) ||
        fullName1.includes(rawQuery) ||
        fullName2.includes(rawQuery) ||
        firstName.includes(rawQuery) ||
        lastName.includes(rawQuery) ||
        (clean.length >= 3 && (admClean.includes(clean) || idClean.includes(clean)))
      );
    });

    if (matches.length === 0) {
      const allStudents = this.getStudents();
      const matchedStudent = allStudents.find((s) => {
        const admClean = (s.admissionNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const idClean = (s.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const firstName = (s.firstName || '').toLowerCase();
        const lastName = (s.lastName || '').toLowerCase();
        const fullName1 = `${lastName} ${firstName}`;
        const fullName2 = `${firstName} ${lastName}`;

        return (
          admClean === clean ||
          admClean.includes(clean) ||
          clean.includes(admClean) ||
          idClean === clean ||
          fullName1.includes(rawQuery) ||
          fullName2.includes(rawQuery) ||
          firstName.includes(rawQuery) ||
          lastName.includes(rawQuery)
        );
      });

      if (matchedStudent) {
        const classes = this.getClasses();
        const studentClass = classes.find((c) => c.id === matchedStudent.classId);
        const terms = this.getTerms();
        const activeTerm = terms.find((t) => t.id === 'term_1_2026') || terms[0];

        if (studentClass && activeTerm) {
          try {
            const school = this.getSchool();
            const scores = this.getAssessmentScores();
            const att = this.getAttendanceRecords();
            const cal = this.getCalendarDays();

            const generated = generateClassRankingsAndReportCards({
              school,
              activeClass: studentClass,
              activeTerm,
              sessionName: '2026/2027',
              enrolledStudents: allStudents,
              allAssessmentScores: scores,
              attendanceRecords: att,
              calendarDays: cal,
            });

            if (generated.length > 0) {
              this.saveReportCards(generated);
              allCards = this.getReportCards();
              matches = allCards.filter(
                (rc) => rc.studentId === matchedStudent.id || rc.student.admissionNumber === matchedStudent.admissionNumber
              );
            }
          } catch (e) {
            console.warn('Auto-generate report card fallback error:', e);
          }
        }
      }
    }

    return matches;
  }

  public verifyReportCardByCode(codeOrQuery: string): StudentReportCard | null {
    const raw = codeOrQuery.trim();
    if (!raw) return null;

    try {
      if (raw.startsWith('{') && raw.endsWith('}')) {
        const parsed = JSON.parse(raw);
        if (parsed.verificationCode) return this.verifyReportCardByCode(parsed.verificationCode);
        if (parsed.code) return this.verifyReportCardByCode(parsed.code);
        if (parsed.admNo) return this.verifyReportCardByCode(parsed.admNo);
        if (parsed.admissionNumber) return this.verifyReportCardByCode(parsed.admissionNumber);
        if (parsed.adm) return this.verifyReportCardByCode(parsed.adm);
      }
    } catch (e) {
      // not JSON
    }

    try {
      if (raw.includes('verify=')) {
        const urlParams = new URLSearchParams(raw.split('?')[1] || raw);
        const code = urlParams.get('verify');
        if (code) return this.verifyReportCardByCode(code);
      }
    } catch (e) {
      // not URL
    }

    const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    let allCards = this.getReportCards();

    let match = allCards.find((rc) => {
      const verClean = (rc.verificationCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const rcIdClean = (rc.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const admClean = (rc.student.admissionNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const stuIdClean = (rc.student.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      return (
        verClean === clean ||
        rcIdClean === clean ||
        admClean === clean ||
        stuIdClean === clean ||
        verClean.includes(clean) ||
        clean.includes(verClean) ||
        (clean.length >= 4 && admClean.includes(clean))
      );
    });

    if (!match) {
      const candidateCards = this.findReportCardsByStudentQuery(raw);
      if (candidateCards.length > 0) {
        match = candidateCards[0];
      }
    }

    return match || null;
  }

  public saveReportCards(reportCards: StudentReportCard[]): void {
    const raw = appStorage.getItem(STORAGE_KEYS.REPORT_CARDS);
    let allCards: StudentReportCard[] = raw ? JSON.parse(raw) : [];

    if (reportCards.length > 0) {
      const { classId, termId } = reportCards[0];
      allCards = allCards.filter(
        (c) => !(c.classId === classId && c.termId === termId)
      );
      allCards.push(...reportCards);
    }

    appStorage.setItem(STORAGE_KEYS.REPORT_CARDS, JSON.stringify(allCards));
    this.notify();
  }

  // Backup & Restore
  public exportBackup(): string {
    const data = {
      school: this.getSchool(),
      sessions: this.getSessions(),
      terms: this.getTerms(),
      classes: this.getClasses(),
      students: this.getStudents(),
      studentMovements: this.getStudentMovements(),
      calendar: this.getCalendarDays(),
      attendance: this.getAttendanceRecords(),
      auditLogs: this.getAuditLogs(),
      symbols: this.getRegisterSymbols(),
      users: this.getUsers(),
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };
    return JSON.stringify(data, null, 2);
  }

  public importBackup(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (!data.school || !data.students) {
        throw new Error('Invalid backup format');
      }
      if (data.school) appStorage.setItem(STORAGE_KEYS.SCHOOL, JSON.stringify(data.school));
      if (data.sessions) appStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(data.sessions));
      if (data.terms) appStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(data.terms));
      if (data.classes) appStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(data.classes));
      if (data.students) appStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(data.students));
      if (data.studentMovements) appStorage.setItem(STORAGE_KEYS.STUDENT_MOVEMENTS, JSON.stringify(data.studentMovements));
      if (data.calendar) appStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify(data.calendar));
      if (data.attendance) appStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(data.attendance));
      if (data.auditLogs) appStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(data.auditLogs));
      if (data.symbols) appStorage.setItem(STORAGE_KEYS.SETTINGS_SYMBOLS, JSON.stringify(data.symbols));
      if (data.users) appStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(data.users));
      this.notify();
      return true;
    } catch (e) {
      console.error('Import error:', e);
      return false;
    }
  }
}

export const db = new StorageService();