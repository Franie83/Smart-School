// AppContext for Smart School Attendance Register
import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../services/storage';
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
  StudentReportCard,
  Subject,
  Term,
  TermUnlockAuditLog,
  User,
} from '../types/attendance';

export type NavTab =
  | 'dashboard'
  | 'attendance'
  | 'take-attendance'
  | 'paper-register'
  | 'results'
  | 'academic-setup'
  | 'assessments'
  | 'students'
  | 'classes'
  | 'calendar'
  | 'reports'
  | 'sessions'
  | 'audit-log'
  | 'settings'
  | 'student-portal';

export type AttendanceSubTab = 'take' | 'paper' | 'reports';
export type ResultsSubTab = 'scores' | 'rankings' | 'portal';
export type AcademicSetupSubTab = 'classes' | 'calendar' | 'sessions' | 'settings' | 'wizard';

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

interface AppContextType {
  school: School;
  sessions: AcademicSession[];
  currentSession: AcademicSession | undefined;
  terms: Term[];
  currentTerm: Term | undefined;
  classes: SchoolClass[];
  permittedClasses: SchoolClass[];
  students: Student[];
  permittedStudents: Student[];
  subjects: Subject[];
  assessmentScores: AssessmentScore[];
  reportCards: StudentReportCard[];
  calendarDays: CalendarDay[];
  attendanceRecords: AttendanceRecord[];
  auditLogs: AttendanceAuditLog[];
  termUnlockLogs: TermUnlockAuditLog[];
  symbolSettings: RegisterSymbolSettings;
  currentUser: User;
  allUsers: User[];
  isOnline: boolean;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  attendanceSubTab: AttendanceSubTab;
  setAttendanceSubTab: (tab: AttendanceSubTab) => void;
  openAttendance: (subTab?: AttendanceSubTab) => void;
  resultsSubTab: ResultsSubTab;
  setResultsSubTab: (tab: ResultsSubTab) => void;
  openResults: (subTab?: ResultsSubTab) => void;
  academicSetupSubTab: AcademicSetupSubTab;
  setAcademicSetupSubTab: (tab: AcademicSetupSubTab) => void;
  openAcademicSetup: (subTab?: AcademicSetupSubTab) => void;
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  isHelpOpen: boolean;
  setIsHelpOpen: (open: boolean) => void;
  isSetupWizardOpen: boolean;
  setIsSetupWizardOpen: (open: boolean) => void;
  isBulkOnboardingOpen: boolean;
  setIsBulkOnboardingOpen: (open: boolean) => void;
  bulkOnboardingEntity: 'STUDENTS' | 'TEACHERS';
  setBulkOnboardingEntity: (entity: 'STUDENTS' | 'TEACHERS') => void;
  bulkOnboardingClassId?: string;
  setBulkOnboardingClassId: (classId?: string) => void;
  openBulkOnboarding: (entity?: 'STUDENTS' | 'TEACHERS', classId?: string) => void;
  closeBulkOnboarding: () => void;
  isVerifierModalOpen: boolean;
  setIsVerifierModalOpen: (open: boolean) => void;
  verifierInitialCode: string;
  setVerifierInitialCode: (code: string) => void;
  openVerifier: (code?: string) => void;
  studentPortalInitialId: string;
  setStudentPortalInitialId: (id: string) => void;
  openStudentPortal: (studentId?: string) => void;
  toasts: ToastNotification[];
  addToast: (toast: Omit<ToastNotification, 'id'>) => void;
  removeToast: (id: string) => void;
  switchUser: (userId: string) => void;
  canEditAttendance: (classId?: string) => boolean;
  canManageSchool: () => boolean;
  refreshData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [dataVersion, setDataVersion] = useState(0);

  const [school, setSchool] = useState<School>(db.getSchool());
  const [sessions, setSessions] = useState<AcademicSession[]>(db.getSessions());
  const [terms, setTerms] = useState<Term[]>(db.getTerms());
  const [classes, setClasses] = useState<SchoolClass[]>(db.getClasses());
  const [students, setStudents] = useState<Student[]>(db.getStudents());
  const [subjects, setSubjects] = useState<Subject[]>(db.getSubjects());
  const [assessmentScores, setAssessmentScores] = useState<AssessmentScore[]>(
    db.getAssessmentScores()
  );
  const [reportCards, setReportCards] = useState<StudentReportCard[]>(
    db.getReportCards()
  );
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>(
    db.getCalendarDays()
  );
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(
    db.getAttendanceRecords()
  );
  const [auditLogs, setAuditLogs] = useState<AttendanceAuditLog[]>(
    db.getAuditLogs()
  );
  const [termUnlockLogs, setTermUnlockLogs] = useState<TermUnlockAuditLog[]>(
    db.getTermUnlockLogs()
  );
  const [symbolSettings, setSymbolSettings] = useState<RegisterSymbolSettings>(
    db.getRegisterSymbols()
  );
  const [currentUser, setCurrentUser] = useState<User>(db.getCurrentUser());
  const [allUsers, setAllUsers] = useState<User[]>(db.getUsers());

  // UI state
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [attendanceSubTab, setAttendanceSubTab] = useState<AttendanceSubTab>('take');
  const [resultsSubTab, setResultsSubTab] = useState<ResultsSubTab>('scores');
  const [academicSetupSubTab, setAcademicSetupSubTab] = useState<AcademicSetupSubTab>('classes');
  const [selectedClassId, setSelectedClassId] = useState<string>('class_jss1_a');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Default to today's date in the browser's local timezone (YYYY-MM-DD)
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);
  const [isBulkOnboardingOpen, setIsBulkOnboardingOpen] = useState(false);
  const [bulkOnboardingEntity, setBulkOnboardingEntity] = useState<'STUDENTS' | 'TEACHERS'>('STUDENTS');
  const [bulkOnboardingClassId, setBulkOnboardingClassId] = useState<string | undefined>(undefined);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Helper: navigate to the Attendance hub with a chosen sub-tab
  const openAttendance = (subTab: AttendanceSubTab = 'take') => {
    setAttendanceSubTab(subTab);
    setActiveTab('attendance');
  };

  const openResults = (subTab: ResultsSubTab = 'scores') => {
    setResultsSubTab(subTab);
    setActiveTab('results');
  };

  const openAcademicSetup = (subTab: AcademicSetupSubTab = 'classes') => {
    setAcademicSetupSubTab(subTab);
    setActiveTab('academic-setup');
  };

  const openBulkOnboarding = (entity: 'STUDENTS' | 'TEACHERS' = 'STUDENTS', classId?: string) => {
    setBulkOnboardingEntity(entity);
    if (classId) {
      setBulkOnboardingClassId(classId);
    }
    setIsBulkOnboardingOpen(true);
  };

  const closeBulkOnboarding = () => {
    setIsBulkOnboardingOpen(false);
  };

  const [isVerifierModalOpen, setIsVerifierModalOpen] = useState(false);
  const [verifierInitialCode, setVerifierInitialCode] = useState('');
  const [studentPortalInitialId, setStudentPortalInitialId] = useState('');

  const openVerifier = (code?: string) => {
    setVerifierInitialCode(code || '');
    setIsVerifierModalOpen(true);
  };

  const openStudentPortal = (studentId?: string) => {
    if (studentId) {
      setStudentPortalInitialId(studentId);
    }
    setActiveTab('student-portal');
  };

  // Detect URL parameters for direct verification or student report card access
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const verifyParam = searchParams.get('verify');
      const studentIdParam =
        searchParams.get('studentId') || searchParams.get('student') || searchParams.get('adm');

      if (verifyParam) {
        setVerifierInitialCode(verifyParam);
        setIsVerifierModalOpen(true);
      } else if (studentIdParam) {
        setStudentPortalInitialId(studentIdParam);
        setActiveTab('student-portal');
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = (toast: Omit<ToastNotification, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sync with DB subscriptions
  const refreshData = () => {
    setSchool(db.getSchool());
    setSessions(db.getSessions());
    setTerms(db.getTerms());
    setClasses(db.getClasses());
    setStudents(db.getStudents());
    setSubjects(db.getSubjects());
    setAssessmentScores(db.getAssessmentScores());
    setReportCards(db.getReportCards());
    setCalendarDays(db.getCalendarDays());
    setAttendanceRecords(db.getAttendanceRecords());
    setAuditLogs(db.getAuditLogs());
    setTermUnlockLogs(db.getTermUnlockLogs());
    setSymbolSettings(db.getRegisterSymbols());
    setCurrentUser(db.getCurrentUser());
    setAllUsers(db.getUsers());
    setDataVersion((v) => v + 1);
  };

  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      refreshData();
    });

    const handleOnline = () => {
      setIsOnline(true);
      addToast({
        type: 'success',
        title: 'Online',
        message: 'Internet connection restored. Synchronized with server.',
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
      addToast({
        type: 'warning',
        title: 'Offline Mode Active',
        message: 'Changes are preserved locally and will sync once connection returns.',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const switchUser = (userId: string) => {
    const u = db.switchCurrentUser(userId);
    if (u) {
      setCurrentUser(u);
      addToast({
        type: 'info',
        title: 'Role Switched',
        message: `Now acting as ${u.name} (${u.role.replace('_', ' ')})`,
      });
    }
  };

  // Calculate permitted classes based on current user role
  const permittedClasses = React.useMemo(() => {
    if (currentUser.role === 'TEACHER') {
      return classes.filter(
        (c) =>
          currentUser.assignedClassIds?.includes(c.id) ||
          c.teacherId === currentUser.id
      );
    }
    return classes;
  }, [classes, currentUser]);

  // Calculate permitted students based on current user role
  const permittedStudents = React.useMemo(() => {
    if (currentUser.role === 'TEACHER') {
      const allowedClassIds = new Set(permittedClasses.map((c) => c.id));
      return students.filter((s) => allowedClassIds.has(s.classId));
    }
    return students;
  }, [students, permittedClasses, currentUser]);

  // Auto-switch selectedClassId if current teacher is restricted
  useEffect(() => {
    if (currentUser.role === 'TEACHER') {
      if (permittedClasses.length > 0 && !permittedClasses.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(permittedClasses[0].id);
      }
    }
  }, [currentUser, permittedClasses, selectedClassId]);

  const currentSession =
    sessions.find((s) => s.id === school.academicSessionId) ||
    sessions.find((s) => s.isCurrent) ||
    sessions[0];

  const currentTerm =
    terms.find((t) => t.id === school.currentTermId) ||
    terms.find((t) => t.sessionId === currentSession?.id && t.status === 'ACTIVE') ||
    terms[0];

  // RBAC permissions helper: Teacher can ONLY edit attendance for assigned class(es)
  const canEditAttendance = (targetClassId?: string): boolean => {
    if (currentUser.role === 'VIEWER') return false;
    if (currentTerm?.isFinalized && currentUser.role !== 'SUPER_ADMIN') {
      return false;
    }
    if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'SCHOOL_ADMIN') {
      return true;
    }
    if (currentUser.role === 'TEACHER') {
      if (!targetClassId) {
        return permittedClasses.length > 0;
      }
      return permittedClasses.some((c) => c.id === targetClassId);
    }
    return false;
  };

  const canManageSchool = (): boolean => {
    return (
      currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'SCHOOL_ADMIN'
    );
  };

  return (
    <AppContext.Provider
      value={{
        school,
        sessions,
        currentSession,
        terms,
        currentTerm,
        classes,
        permittedClasses,
        students,
        permittedStudents,
        subjects,
        assessmentScores,
        reportCards,
        calendarDays,
        attendanceRecords,
        auditLogs,
        termUnlockLogs,
        symbolSettings,
        currentUser,
        allUsers,
        isOnline,
        activeTab,
        setActiveTab,
        attendanceSubTab,
        setAttendanceSubTab,
        openAttendance,
        resultsSubTab,
        setResultsSubTab,
        openResults,
        academicSetupSubTab,
        setAcademicSetupSubTab,
        openAcademicSetup,
        selectedClassId,
        setSelectedClassId,
        selectedDate,
        setSelectedDate,
        searchQuery,
        setSearchQuery,
        isSearchOpen,
        setIsSearchOpen,
        isHelpOpen,
        setIsHelpOpen,
        isSetupWizardOpen,
        setIsSetupWizardOpen,
        isBulkOnboardingOpen,
        setIsBulkOnboardingOpen,
        bulkOnboardingEntity,
        setBulkOnboardingEntity,
        bulkOnboardingClassId,
        setBulkOnboardingClassId,
        openBulkOnboarding,
        closeBulkOnboarding,
        isVerifierModalOpen,
        setIsVerifierModalOpen,
        verifierInitialCode,
        setVerifierInitialCode,
        openVerifier,
        studentPortalInitialId,
        setStudentPortalInitialId,
        openStudentPortal,
        toasts,
        addToast,
        removeToast,
        switchUser,
        canEditAttendance,
        canManageSchool,
        refreshData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};