// Academic Assessments, Continuous Assessment (CA), Examination & Report Cards Hub
import React, { useMemo, useState, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  Percent,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trophy,
  Upload,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { db } from '../../services/storage';
import {
  AssessmentScore,
  Student,
  StudentReportCard,
  Subject,
} from '../../types/attendance';
import {
  calculateGradeAndRemark,
  formatOrdinal,
  generateClassRankingsAndReportCards,
} from '../../utils/academicEngine';
import { StudentReportCardModal } from './StudentReportCardModal';

interface AssessmentsHubProps {
  initialMainTab?: 'SCORING' | 'RANKINGS';
}

export const AssessmentsHub: React.FC<AssessmentsHubProps> = ({ initialMainTab = 'SCORING' }) => {
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
    subjects,
    assessmentScores,
    reportCards,
    calendarDays,
    attendanceRecords,
    currentUser,
    selectedClassId,
    setSelectedClassId,
    allUsers,
    canManageSchool,
    addToast,
    refreshData,
  } = useApp();

  // Active Main Tab: 'SCORING' (CA & Exam entry) or 'RANKINGS' (Class Ranks & Report Cards)
  const [activeMainTab, setActiveMainTab] = useState<'SCORING' | 'RANKINGS'>(initialMainTab);

  // Selected Class & Term
  const activeClass =
    permittedClasses.find((c) => c.id === selectedClassId) || permittedClasses[0] || classes[0];
  const [termId, setTermId] = useState<string>(currentTerm?.id || terms[0]?.id || '');
  const activeTerm = terms.find((t) => t.id === termId) || currentTerm || terms[0];

  // Selected Subject for Scoring (Default: Mathematics)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('sub_math');
  const activeSubject =
    subjects.find((s) => s.id === selectedSubjectId) || subjects[0] || {
      id: 'sub_math',
      name: 'Mathematics',
      code: 'MTH',
      maxCA: 40,
      maxExam: 60,
    };

  // Enrolled students in active class
  const classStudents = useMemo(() => {
    return permittedStudents.filter(
      (s) => s.classId === activeClass?.id && s.status === 'ACTIVE'
    );
  }, [permittedStudents, activeClass]);

  // Working state for student score entry: map studentId -> { ca: number, exam: number }
  const [workingScores, setWorkingScores] = useState<
    Record<string, { ca: string; exam: string; notes?: string }>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');

  // Report Card Modal Viewer State
  const [selectedReportCardStudentId, setSelectedReportCardStudentId] = useState<string | null>(null);

  // Load existing assessment scores for this class, term, and subject into working state
  useEffect(() => {
    if (!activeClass || !activeTerm || !activeSubject) return;

    const existingScores = assessmentScores.filter(
      (sc) =>
        sc.classId === activeClass.id &&
        sc.termId === activeTerm.id &&
        sc.subjectId === activeSubject.id
    );

    const initialMap: Record<string, { ca: string; exam: string; notes?: string }> = {};

    classStudents.forEach((student) => {
      const found = existingScores.find((sc) => sc.studentId === student.id);
      if (found) {
        initialMap[student.id] = {
          ca: found.caScore.toString(),
          exam: found.examScore.toString(),
          notes: found.remark,
        };
      } else {
        initialMap[student.id] = {
          ca: '',
          exam: '',
          notes: '',
        };
      }
    });

    setWorkingScores(initialMap);
  }, [activeClass?.id, activeTerm?.id, activeSubject?.id, classStudents, assessmentScores]);

  // Update working score for a student
  const handleScoreChange = (
    studentId: string,
    field: 'ca' | 'exam',
    value: string
  ) => {
    // Only allow numbers and empty string
    if (value !== '' && isNaN(Number(value))) return;

    const num = Number(value);
    const maxVal = field === 'ca' ? activeSubject.maxCA || 40 : activeSubject.maxExam || 60;
    if (value !== '' && num > maxVal) {
      addToast({
        type: 'warning',
        title: 'Max Score Exceeded',
        message: `${field.toUpperCase()} score cannot exceed ${maxVal}.`,
      });
      return;
    }

    setWorkingScores((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  };

  // Save all entered scores for this subject
  const handleSaveSubjectScores = () => {
    if (!activeClass || !activeTerm || !activeSubject) return;

    setIsSaving(true);
    try {
      const recordsToSave: Array<
        Omit<AssessmentScore, 'id' | 'totalScore' | 'grade' | 'remark' | 'updatedAt'>
      > = [];

      classStudents.forEach((student) => {
        const item = workingScores[student.id];
        if (item && (item.ca !== '' || item.exam !== '')) {
          const ca = Math.max(0, Number(item.ca) || 0);
          const exam = Math.max(0, Number(item.exam) || 0);

          recordsToSave.push({
            studentId: student.id,
            classId: activeClass.id,
            termId: activeTerm.id,
            sessionId: activeTerm.sessionId || currentSession?.id || 'session_2026_2027',
            subjectId: activeSubject.id,
            subjectName: activeSubject.name,
            caScore: ca,
            examScore: exam,
            teacherId: currentUser.id,
            teacherName: currentUser.name,
          });
        }
      });

      if (recordsToSave.length === 0) {
        setIsSaving(false);
        addToast({
          type: 'warning',
          title: 'No Scores Entered',
          message: 'Please enter at least one CA or Exam score to save.',
        });
        return;
      }

      db.bulkSaveAssessmentScores(recordsToSave);
      refreshData();
      setIsSaving(false);

      addToast({
        type: 'success',
        title: 'Scores Saved! 📝',
        message: `Saved ${recordsToSave.length} ${activeSubject.name} scores for ${activeClass.name} ${activeClass.arm}.`,
      });
    } catch (err: any) {
      setIsSaving(false);
      addToast({
        type: 'error',
        title: 'Error Saving Scores',
        message: err.message || 'Could not save assessment scores.',
      });
    }
  };

  // Pre-fill realistic sample scores for this subject
  const handlePrefillSampleScores = () => {
    const nextScores: Record<string, { ca: string; exam: string; notes?: string }> = {};

    classStudents.forEach((student, idx) => {
      // Deterministic spread of high, medium, and credit scores
      const baseScores = [
        { ca: 36, exam: 54 },
        { ca: 38, exam: 56 },
        { ca: 28, exam: 44 },
        { ca: 31, exam: 49 },
        { ca: 25, exam: 39 },
        { ca: 33, exam: 51 },
        { ca: 22, exam: 35 },
        { ca: 35, exam: 53 },
        { ca: 27, exam: 43 },
        { ca: 29, exam: 47 },
      ];
      const sample = baseScores[idx % baseScores.length];

      nextScores[student.id] = {
        ca: sample.ca.toString(),
        exam: sample.exam.toString(),
        notes: '',
      };
    });

    setWorkingScores(nextScores);
    addToast({
      type: 'info',
      title: 'Sample Scores Populated',
      message: `Pre-filled CA and Exam scores for all ${classStudents.length} students in ${activeSubject.name}. Remember to click "Save All Scores" or "Rank Students".`,
    });
  };

  // Seed realistic scores for ALL subjects (Maths, English, Science, etc.) for a full class trial
  const handleSeedAllCoreSubjects = () => {
    if (!activeClass || !activeTerm) return;

    try {
      const recordsToSave: Array<
        Omit<AssessmentScore, 'id' | 'totalScore' | 'grade' | 'remark' | 'updatedAt'>
      > = [];

      subjects.forEach((sub, subIdx) => {
        classStudents.forEach((student, stuIdx) => {
          const seedBases = [
            { ca: 37, exam: 55 },
            { ca: 35, exam: 53 },
            { ca: 32, exam: 48 },
            { ca: 29, exam: 45 },
            { ca: 26, exam: 41 },
            { ca: 34, exam: 52 },
            { ca: 23, exam: 36 },
            { ca: 38, exam: 57 },
            { ca: 30, exam: 46 },
            { ca: 28, exam: 44 },
          ];
          const variant = (stuIdx + subIdx) % seedBases.length;
          const base = seedBases[variant];

          recordsToSave.push({
            studentId: student.id,
            classId: activeClass.id,
            termId: activeTerm.id,
            sessionId: activeTerm.sessionId || currentSession?.id || 'session_2026_2027',
            subjectId: sub.id,
            subjectName: sub.name,
            caScore: base.ca,
            examScore: base.exam,
            teacherId: currentUser.id,
            teacherName: currentUser.name,
          });
        });
      });

      db.bulkSaveAssessmentScores(recordsToSave);
      refreshData();

      // Also update workingScores for current active subject
      const currentSubjectScores: Record<string, { ca: string; exam: string; notes?: string }> = {};
      classStudents.forEach((student, idx) => {
        const subIdx = subjects.findIndex((s) => s.id === selectedSubjectId);
        const variant = (idx + (subIdx >= 0 ? subIdx : 0)) % 10;
        const base = [
          { ca: 37, exam: 55 },
          { ca: 35, exam: 53 },
          { ca: 32, exam: 48 },
          { ca: 29, exam: 45 },
          { ca: 26, exam: 41 },
          { ca: 34, exam: 52 },
          { ca: 23, exam: 36 },
          { ca: 38, exam: 57 },
          { ca: 30, exam: 46 },
          { ca: 28, exam: 44 },
        ][variant];
        currentSubjectScores[student.id] = {
          ca: base.ca.toString(),
          exam: base.exam.toString(),
          notes: '',
        };
      });
      setWorkingScores(currentSubjectScores);

      addToast({
        type: 'success',
        title: 'All Core Subjects Populated! 📚',
        message: `Populated realistic CA & Exam scores for all ${subjects.length} subjects across ${classStudents.length} students. Ready to rank!`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Error Seeding Scores',
        message: err.message || 'Could not seed scores.',
      });
    }
  };

  // Compile / Generate Class Rankings and Report Cards
  const handleGenerateRankingsAndReportCards = () => {
    if (!activeClass || !activeTerm) return;

    try {
      // 1. First auto-save any working scores for current subject so nothing is lost
      const recordsToSave: Array<
        Omit<AssessmentScore, 'id' | 'totalScore' | 'grade' | 'remark' | 'updatedAt'>
      > = [];

      classStudents.forEach((student) => {
        const item = workingScores[student.id];
        if (item && (item.ca !== '' || item.exam !== '')) {
          const ca = Math.max(0, Number(item.ca) || 0);
          const exam = Math.max(0, Number(item.exam) || 0);

          recordsToSave.push({
            studentId: student.id,
            classId: activeClass.id,
            termId: activeTerm.id,
            sessionId: activeTerm.sessionId || currentSession?.id || 'session_2026_2027',
            subjectId: activeSubject.id,
            subjectName: activeSubject.name,
            caScore: ca,
            examScore: exam,
            teacherId: currentUser.id,
            teacherName: currentUser.name,
          });
        }
      });

      if (recordsToSave.length > 0) {
        db.bulkSaveAssessmentScores(recordsToSave);
      }

      // Re-read latest saved scores from storage
      const freshScores = db.getAssessmentScores({
        classId: activeClass.id,
        termId: activeTerm.id,
      });

      const generatedCards = generateClassRankingsAndReportCards({
        school,
        activeClass,
        activeTerm,
        sessionName: currentSession?.name || '2026/2027',
        enrolledStudents: permittedStudents,
        allAssessmentScores: freshScores.length > 0 ? freshScores : assessmentScores,
        attendanceRecords,
        calendarDays,
      });

      if (generatedCards.length === 0) {
        addToast({
          type: 'warning',
          title: 'No Active Students',
          message: 'Could not find active enrolled students in this class to rank.',
        });
        return;
      }

      // Save compiled report cards to storage
      db.saveReportCards(generatedCards);
      refreshData();

      // Confetti celebration
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // ignore
      }

      addToast({
        type: 'success',
        title: 'Class Rankings Compiled! 🏆',
        message: `Ranked ${generatedCards.length} students and prepared official terminal report cards correlated with attendance performance!`,
      });

      // Switch to Rankings tab to inspect results
      setActiveMainTab('RANKINGS');
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Compilation Error',
        message: err.message || 'Could not compile class rankings.',
      });
    }
  };

  // Get current class report cards
  const currentClassReportCards = useMemo(() => {
    if (!activeClass || !activeTerm) return [];
    return reportCards.filter(
      (rc) => rc.classId === activeClass.id && rc.termId === activeTerm.id
    );
  }, [reportCards, activeClass?.id, activeTerm?.id]);

  // Selected single report card for modal
  const activeReportCard = useMemo(() => {
    if (!selectedReportCardStudentId) return null;
    return (
      currentClassReportCards.find(
        (rc) => rc.studentId === selectedReportCardStudentId
      ) || null
    );
  }, [currentClassReportCards, selectedReportCardStudentId]);

  // Download Class Broadsheet / Export Scores
  const handleExportScoresToExcel = () => {
    if (!activeClass || classStudents.length === 0) return;

    const dataToExport = classStudents.map((st, idx) => {
      const score = workingScores[st.id] || { ca: '', exam: '' };
      const ca = Number(score.ca) || 0;
      const exam = Number(score.exam) || 0;
      const total = ca + exam;
      const { grade, remark } = calculateGradeAndRemark(total);

      return {
        'No.': idx + 1,
        'Admission Number': st.admissionNumber,
        'Student Name': `${st.lastName.toUpperCase()}, ${st.firstName} ${st.middleName || ''}`.trim(),
        'Sex': st.gender,
        'Class': `${activeClass.name} ${activeClass.arm}`,
        'Subject': activeSubject.name,
        'C.A. (40)': ca,
        'Exam (60)': exam,
        'Total (100)': total,
        'Grade': grade,
        'Remark': remark,
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${activeSubject.code}_Scores`);
    XLSX.writeFile(
      wb,
      `${school.name.replace(/\s+/g, '_')}_${activeClass.name}_${activeClass.arm}_${activeSubject.code}_Scores.xlsx`
    );

    addToast({
      type: 'info',
      title: 'Spreadsheet Exported',
      message: `Exported ${activeSubject.name} score sheet to Excel.`,
    });
  };

  // Filtered students in score entry
  const filteredStudents = useMemo(() => {
    if (!searchStudent.trim()) return classStudents;
    const q = searchStudent.toLowerCase();
    return classStudents.filter((s) => {
      const fullName = `${s.firstName} ${s.lastName} ${s.admissionNumber}`.toLowerCase();
      return fullName.includes(q);
    });
  }, [classStudents, searchStudent]);

  // Calculate quick stats for the active subject
  const subjectStats = useMemo(() => {
    const scores = classStudents
      .map((s) => {
        const item = workingScores[s.id];
        if (!item || (item.ca === '' && item.exam === '')) return null;
        const ca = Number(item.ca) || 0;
        const exam = Number(item.exam) || 0;
        return ca + exam;
      })
      .filter((n): n is number => n !== null);

    if (scores.length === 0) {
      return { count: 0, max: 0, min: 0, avg: 0, passRate: 0 };
    }

    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    const passes = scores.filter((s) => s >= 50).length;
    const passRate = Math.round((passes / scores.length) * 100);

    return { count: scores.length, max, min, avg, passRate };
  }, [classStudents, workingScores]);

  // Real-time completion tracker for the active class and subject
  const completedStudentCount = useMemo(() => {
    return classStudents.filter((st) => {
      const item = workingScores[st.id];
      return item && item.ca !== '' && item.exam !== '';
    }).length;
  }, [classStudents, workingScores]);

  const isAllScored =
    classStudents.length > 0 && completedStudentCount === classStudents.length;

  // Keyboard navigation for fast score entry: Up/Down arrow moves rows, Enter moves down
  const handleScoreKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
    field: 'ca' | 'exam'
  ) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      const nextInput = document.getElementById(
        `score-input-${field}-${index + 1}`
      ) as HTMLInputElement;
      if (nextInput) nextInput.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevInput = document.getElementById(
        `score-input-${field}-${index - 1}`
      ) as HTMLInputElement;
      if (prevInput) prevInput.focus();
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Context Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Academic Assessments, Rankings & Report Cards
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider">
              Continuous Assessment (CA) & Exam Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Subject teachers enter CA & Exam scores; system ranks class performance and compiles terminal report cards correlated with attendance records.
          </p>
        </div>

        {/* Class and Term Selectors */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Class Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase px-1">
              Class:
            </span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {permittedClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.arm}
                </option>
              ))}
            </select>
          </div>

          {/* Term Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase px-1">
              Term:
            </span>
            <select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Tab Toggle Bar */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveMainTab('SCORING')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeMainTab === 'SCORING'
              ? 'border-slate-900 text-slate-900 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4 text-emerald-600" />
          <span>Subject Score Entry (CA & Exam)</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700">
            {classStudents.length} Students
          </span>
        </button>

        <button
          onClick={() => setActiveMainTab('RANKINGS')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeMainTab === 'RANKINGS'
              ? 'border-slate-900 text-slate-900 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-500" />
          <span>Class Rankings & Report Cards</span>
          {currentClassReportCards.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-mono font-bold">
              {currentClassReportCards.length} Ranked
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: SUBJECT SCORE ENTRY (CA & EXAM) */}
      {activeMainTab === 'SCORING' && (
        <div className="space-y-4">
          {/* Subject Selection & Scoring Formula Banner */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Select Subject & Teacher Assignment
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-slate-100 text-slate-700">
                    Logged in: {currentUser.name} ({currentUser.role.replace('_', ' ')})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {subjects.map((sub) => {
                    const isSelected = sub.id === selectedSubjectId;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setSelectedSubjectId(sub.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <span>{sub.name}</span>
                        <span
                          className={`text-[10px] px-1 rounded font-mono ${
                            isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {sub.code}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scoring Formula Indicator */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs flex items-center gap-4">
                <div>
                  <div className="text-[10px] font-bold text-emerald-900 uppercase">
                    Scoring Weights
                  </div>
                  <div className="font-mono font-bold text-emerald-950 mt-0.5">
                    C.A.: <span className="text-emerald-700">40 Marks</span> + Exam:{' '}
                    <span className="text-emerald-700">60 Marks</span> ={' '}
                    <span className="text-emerald-900">100% Total</span>
                  </div>
                </div>
                <div className="border-l border-emerald-300 pl-3 hidden sm:block">
                  <span className="text-[10px] text-emerald-800 block">Grading Standard:</span>
                  <span className="text-[11px] font-bold text-emerald-900">
                    A: ≥75% · B: ≥65% · C: ≥50%
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions & Search Bar */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[240px] flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter student by name or admission number..."
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrefillSampleScores}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Quickly fill sample scores for demonstration and ranking test"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pre-fill {activeSubject.name}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSeedAllCoreSubjects}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Seed realistic scores for all 8 subjects across all teachers"
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Seed All Core Subjects</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportScoresToExcel}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Download Excel Score Sheet"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Sheet</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveSubjectScores}
                  disabled={isSaving}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>Save All Scores</span>
                </button>
              </div>
            </div>
          </div>

          {/* Real-Time Score Completion & Prominent Ranking Action Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-4 rounded-xl text-white shadow-md flex flex-wrap items-center justify-between gap-4 border border-slate-700">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="font-bold text-sm">
                  {activeSubject.name} Score Completion: {completedStudentCount} of {classStudents.length} Students Scored
                </span>
                {isAllScored ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400 text-slate-950 border border-emerald-300">
                    ✓ All Scores Entered!
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 font-mono">
                    {Math.round((completedStudentCount / (classStudents.length || 1)) * 100)}% Complete
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 max-w-2xl">
                {isAllScored
                  ? 'All student CA & Exam marks entered for this class! Click the button to rank class performance and compile terminal report cards correlated with attendance.'
                  : 'Enter CA (0-40) and Exam (0-60) for each student below. When finished, click the button to compile class rankings and prepare official report cards.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleGenerateRankingsAndReportCards}
              className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 transform active:scale-95 ${
                isAllScored
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 ring-4 ring-amber-400/30 animate-pulse hover:animate-none'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Rank Students & Prepare Report Cards 🏆</span>
            </button>
          </div>

          {/* Interactive Score Entry Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-semibold">
                    <th className="py-2.5 px-3 w-10 text-center">No.</th>
                    <th className="py-2.5 px-3 w-28">Adm. No.</th>
                    <th className="py-2.5 px-3 min-w-[170px]">Student Full Name</th>
                    <th className="py-2.5 px-2 w-12 text-center">Sex</th>
                    <th className="py-2.5 px-3 w-28 text-center bg-slate-800">
                      C.A. Score (/40)
                    </th>
                    <th className="py-2.5 px-3 w-28 text-center bg-slate-800">
                      Exam Score (/60)
                    </th>
                    <th className="py-2.5 px-3 w-24 text-center bg-slate-950 font-bold text-emerald-400">
                      Total (/100)
                    </th>
                    <th className="py-2.5 px-3 w-16 text-center">Grade</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Subject Remark</th>
                    <th className="py-2.5 px-3 min-w-[130px] text-center">Attendance Record</th>
                    <th className="py-2.5 px-3 w-28 text-right">Report Card</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((st, idx) => {
                    const score = workingScores[st.id] || { ca: '', exam: '' };
                    const caNum = Number(score.ca) || 0;
                    const examNum = Number(score.exam) || 0;
                    const hasScored = score.ca !== '' || score.exam !== '';
                    const total = hasScored ? Math.min(100, caNum + examNum) : 0;
                    const { grade, remark } = calculateGradeAndRemark(total);

                    // Student attendance tier
                    const attScore = st.punctualityScore ?? 100;
                    const tier = st.punctualityTier || 'EXCELLENT';
                    const hasCompiledReportCard = currentClassReportCards.some(
                      (rc) => rc.studentId === st.id
                    );

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">
                          {st.admissionNumber}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>
                              {st.lastName.toUpperCase()}, {st.firstName}{' '}
                              {st.middleName || ''}
                            </span>
                            {score.ca !== '' && score.exam !== '' && (
                              <span title="CA & Exam entered">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center font-bold">
                          <span
                            className={
                              st.gender === 'MALE' ? 'text-blue-600' : 'text-pink-600'
                            }
                          >
                            {st.gender === 'MALE' ? 'M' : 'F'}
                          </span>
                        </td>

                        {/* CA Input with keyboard navigation */}
                        <td className="py-2 px-2 text-center bg-slate-50/50">
                          <input
                            id={`score-input-ca-${idx}`}
                            type="text"
                            inputMode="numeric"
                            placeholder="0 - 40"
                            value={score.ca}
                            onChange={(e) =>
                              handleScoreChange(st.id, 'ca', e.target.value)
                            }
                            onKeyDown={(e) => handleScoreKeyDown(e, idx, 'ca')}
                            className="w-20 px-2 py-1 text-center font-mono font-bold text-xs rounded border border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </td>

                        {/* Exam Input with keyboard navigation */}
                        <td className="py-2 px-2 text-center bg-slate-50/50">
                          <input
                            id={`score-input-exam-${idx}`}
                            type="text"
                            inputMode="numeric"
                            placeholder="0 - 60"
                            value={score.exam}
                            onChange={(e) =>
                              handleScoreChange(st.id, 'exam', e.target.value)
                            }
                            onKeyDown={(e) => handleScoreKeyDown(e, idx, 'exam')}
                            className="w-20 px-2 py-1 text-center font-mono font-bold text-xs rounded border border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </td>

                        {/* Real-time Total */}
                        <td className="py-2 px-3 text-center font-mono font-black text-sm bg-slate-100/80">
                          {hasScored ? (
                            <span
                              className={
                                total >= 75
                                  ? 'text-emerald-700'
                                  : total >= 50
                                  ? 'text-slate-900'
                                  : 'text-rose-700'
                              }
                            >
                              {total}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )}
                        </td>

                        {/* Grade Badge */}
                        <td className="py-2 px-3 text-center">
                          {hasScored ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                                grade === 'A'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : grade === 'B'
                                  ? 'bg-blue-100 text-blue-800'
                                  : grade === 'C'
                                  ? 'bg-teal-100 text-teal-800'
                                  : grade === 'D' || grade === 'E'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {grade}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono">—</span>
                          )}
                        </td>

                        {/* Remark */}
                        <td className="py-2 px-3 text-slate-600 text-[11px]">
                          {hasScored ? remark : 'Awaiting score'}
                        </td>

                        {/* Correlated Attendance Badge */}
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                              tier === 'EXCELLENT'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : tier === 'GOOD'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                            title={`Attendance punctuality score: ${attScore}%`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>{attScore}% Att.</span>
                          </span>
                        </td>

                        {/* Report Card Action */}
                        <td className="py-2 px-3 text-right">
                          {hasCompiledReportCard ? (
                            <button
                              type="button"
                              onClick={() => setSelectedReportCardStudentId(st.id)}
                              className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors flex items-center gap-1 ml-auto"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Card</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleGenerateRankingsAndReportCards}
                              className="text-[10px] text-slate-400 hover:text-slate-700 underline font-medium"
                              title="Click to compile rankings and report cards"
                            >
                              Compile
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Scoreboard Metrics Footer with Secondary Rank Trigger */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs font-medium text-slate-600">
              <div className="flex items-center gap-4">
                <span>
                  Scored: <strong>{subjectStats.count}</strong> / {classStudents.length} Students
                </span>
                <span>
                  Subject Average:{' '}
                  <strong className="text-slate-900 font-mono font-bold">
                    {subjectStats.avg}%
                  </strong>
                </span>
                <span>
                  Pass Rate:{' '}
                  <strong className="text-emerald-700 font-mono font-bold">
                    {subjectStats.passRate}%
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveSubjectScores}
                  disabled={isSaving}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Save Scores</span>
                </button>
                <button
                  type="button"
                  onClick={handleGenerateRankingsAndReportCards}
                  className="px-4 py-1.5 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-950" />
                  <span>Rank Students & Prepare Report Cards 🏆</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLASS RANKINGS & TERMINAL REPORT CARDS */}
      {activeMainTab === 'RANKINGS' && (
        <div className="space-y-5">
          {/* Compilation Banner with Prominent Ranking Button */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-5 rounded-2xl shadow-md border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-white">
                    Class Academic Performance & Attendance Ranking Engine
                  </h3>
                </div>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Click the button below to aggregate all CA and Exam scores across subjects, rank student positions (1st, 2nd, 3rd...), and correlate academic marks with actual attendance rates to generate official terminal report cards.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerateRankingsAndReportCards}
                className="px-5 py-2.5 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-lg transition-all flex items-center gap-2 transform hover:scale-105"
              >
                <Sparkles className="w-4 h-4 text-amber-900" />
                <span>Calculate Class Ranks & Generate Report Cards</span>
              </button>
            </div>

            {currentClassReportCards.length > 0 && (
              <div className="pt-3 border-t border-slate-700/80 flex flex-wrap items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    Report cards generated for <strong>{currentClassReportCards.length} students</strong> in{' '}
                    <strong>{activeClass.name} {activeClass.arm}</strong>.
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Last compiled: {new Date(currentClassReportCards[0]?.generatedAt).toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>

          {currentClassReportCards.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <Trophy className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-900">
                Class Rankings Not Yet Compiled
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Enter CA and Exam scores in the Subject Score Entry tab, then click "Calculate Class Ranks & Generate Report Cards" above to view the leaderboard and student report dossiers.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Podium Top 3 Students Highlight */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {currentClassReportCards.slice(0, 3).map((card) => {
                  const isFirst = card.positionInClass === 1;
                  const isSecond = card.positionInClass === 2;
                  const isThird = card.positionInClass === 3;

                  return (
                    <div
                      key={card.studentId}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        isFirst
                          ? 'bg-gradient-to-b from-amber-50 to-white border-amber-300 shadow-sm'
                          : isSecond
                          ? 'bg-gradient-to-b from-slate-100 to-white border-slate-300 shadow-xs'
                          : 'bg-gradient-to-b from-amber-50/30 to-white border-amber-200 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-black px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1 ${
                            isFirst
                              ? 'bg-amber-400 text-amber-950'
                              : isSecond
                              ? 'bg-slate-300 text-slate-900'
                              : 'bg-amber-200 text-amber-900'
                          }`}
                        >
                          <Trophy className="w-3.5 h-3.5" />
                          <span>{formatOrdinal(card.positionInClass)} Position</span>
                        </span>

                        <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-mono">
                          {card.averagePercentage.toFixed(1)}% Avg
                        </span>
                      </div>

                      <div>
                        <div className="font-bold text-sm text-slate-900">
                          {card.student.lastName.toUpperCase()}, {card.student.firstName}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {card.student.admissionNumber}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span>
                          Attendance:{' '}
                          <strong className="text-emerald-700 font-mono font-bold">
                            {card.attendance.attendancePercentage.toFixed(1)}%
                          </strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedReportCardStudentId(card.studentId)}
                          className="font-bold text-slate-900 hover:text-emerald-700 flex items-center gap-1"
                        >
                          <span>Report Card</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Complete Ranked Broad Sheet Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-3">
                <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Complete Class Ranked Broad Sheet ({currentClassReportCards.length} Students)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Ranked in descending order of terminal weighted average percentage.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentClassReportCards.length > 0) {
                          setSelectedReportCardStudentId(currentClassReportCards[0].studentId);
                        }
                      }}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Print Student Report Cards</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white font-semibold">
                        <th className="py-2.5 px-3 w-16 text-center">Rank</th>
                        <th className="py-2.5 px-3 w-28">Adm. No.</th>
                        <th className="py-2.5 px-3 min-w-[170px]">Student Full Name</th>
                        <th className="py-2.5 px-2 w-12 text-center">Sex</th>
                        <th className="py-2.5 px-2.5 text-center w-24">Subjects</th>
                        <th className="py-2.5 px-3 w-24 text-center">Total Marks</th>
                        <th className="py-2.5 px-3 w-24 text-center bg-slate-800 text-emerald-400 font-bold">
                          Average %
                        </th>
                        <th className="py-2.5 px-2 w-16 text-center">Grade</th>
                        <th className="py-2.5 px-3 w-28 text-center">Attendance %</th>
                        <th className="py-2.5 px-3 min-w-[160px]">Correlated Evaluation</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentClassReportCards.map((rc) => {
                        const isTop = rc.positionInClass <= 3;
                        return (
                          <tr
                            key={rc.studentId}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isTop ? 'bg-amber-50/20' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                                  rc.positionInClass === 1
                                    ? 'bg-amber-400 text-amber-950'
                                    : rc.positionInClass === 2
                                    ? 'bg-slate-200 text-slate-800'
                                    : rc.positionInClass === 3
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'text-slate-600'
                                }`}
                              >
                                {formatOrdinal(rc.positionInClass)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                              {rc.student.admissionNumber}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {rc.student.lastName.toUpperCase()}, {rc.student.firstName}{' '}
                              {rc.student.middleName || ''}
                            </td>
                            <td className="py-2.5 px-2 text-center font-bold">
                              <span
                                className={
                                  rc.student.gender === 'MALE'
                                    ? 'text-blue-600'
                                    : 'text-pink-600'
                                }
                              >
                                {rc.student.gender === 'MALE' ? 'M' : 'F'}
                              </span>
                            </td>
                            <td className="py-2.5 px-2.5 text-center font-mono text-slate-600">
                              {rc.scores.length}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                              {rc.totalScoreObtained}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-black text-sm text-emerald-800 bg-slate-50">
                              {rc.averagePercentage.toFixed(1)}%
                            </td>
                            <td className="py-2.5 px-2 text-center font-bold font-mono">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[11px] ${
                                  rc.overallGrade === 'A'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : rc.overallGrade === 'B'
                                    ? 'bg-blue-100 text-blue-800'
                                    : rc.overallGrade === 'C'
                                    ? 'bg-teal-100 text-teal-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {rc.overallGrade}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700">
                              {rc.attendance.attendancePercentage.toFixed(1)}%
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-600 line-clamp-1">
                              {rc.formMasterRemark}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedReportCardStudentId(rc.studentId)}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                              >
                                Report Card
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Individual Official Student Terminal Report Card Modal */}
      <StudentReportCardModal
        isOpen={Boolean(selectedReportCardStudentId)}
        onClose={() => setSelectedReportCardStudentId(null)}
        reportCard={activeReportCard}
        allReportCards={currentClassReportCards}
        onSelectStudent={(id) => setSelectedReportCardStudentId(id)}
        schoolName={school.name}
        schoolAddress={school.address}
        schoolPhone={school.phone}
        principalName={school.principalName}
      />
    </div>
  );
};
