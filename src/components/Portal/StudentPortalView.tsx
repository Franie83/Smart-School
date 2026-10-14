// Student & Parent Report Card Access Portal
import React, { useMemo, useState, useEffect } from 'react';
import {
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Percent,
  Printer,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { db } from '../../services/storage';
import { Student, StudentReportCard } from '../../types/attendance';
import {
  formatOrdinal,
  generateClassRankingsAndReportCards,
} from '../../utils/academicEngine';
import { ReportCardQRCode } from '../Assessments/ReportCardQRCode';
import { StudentReportCardModal } from '../Assessments/StudentReportCardModal';

interface StudentPortalViewProps {
  initialStudentId?: string;
}

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  initialStudentId = '',
}) => {
  const {
    school,
    terms,
    currentTerm,
    classes,
    students,
    reportCards,
    openVerifier,
    addToast,
    refreshData,
    currentSession,
  } = useApp();

  // Search input state
  const [searchQuery, setSearchQuery] = useState(initialStudentId || 'ADM-2026-001');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [selectedTermId, setSelectedTermId] = useState<string>(
    currentTerm?.id || terms[0]?.id || ''
  );
  const activeTerm = terms.find((t) => t.id === selectedTermId) || currentTerm || terms[0];

  // Live autocomplete suggestions as user types
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const clean = q.replace(/[^a-z0-9]/g, '');

    return students
      .filter((s) => {
        const admClean = (s.admissionNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const idClean = (s.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const firstName = (s.firstName || '').toLowerCase();
        const lastName = (s.lastName || '').toLowerCase();
        const full1 = `${lastName} ${firstName}`;
        const full2 = `${firstName} ${lastName}`;

        return (
          admClean.includes(clean) ||
          idClean.includes(clean) ||
          full1.includes(q) ||
          full2.includes(q) ||
          firstName.includes(q) ||
          lastName.includes(q)
        );
      })
      .slice(0, 6);
  }, [searchQuery, students]);

  // Retrieved state
  const [hasSearched, setHasSearched] = useState(false);
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [activeReportCard, setActiveReportCard] = useState<StudentReportCard | null>(null);

  // Modal viewer state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Quick search handler
  const handleRetrieveReportCard = (queryToUse?: string) => {
    const q = (queryToUse !== undefined ? queryToUse : searchQuery).trim();
    if (!q) {
      addToast({
        type: 'warning',
        title: 'Enter Student ID',
        message: 'Please enter a Student ID or Admission Number (e.g. ADM-2026-001).',
      });
      return;
    }

    setHasSearched(true);
    setIsInputFocused(false);
    const clean = q.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Find matching student in enrolled registry
    const foundStudent = students.find((s) => {
      const admClean = (s.admissionNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const idClean = (s.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const fullName = `${s.firstName} ${s.lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
      const fullNameRev = `${s.lastName} ${s.firstName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
      return (
        admClean === clean ||
        idClean === clean ||
        admClean.includes(clean) ||
        fullName.includes(clean) ||
        fullNameRev.includes(clean)
      );
    });

    setMatchedStudent(foundStudent || null);

    // 2. Query report cards
    const matchingCards = db.findReportCardsByStudentQuery(q);
    const cardForTerm =
      matchingCards.find((c) => c.termId === activeTerm?.id) || matchingCards[0] || null;

    setActiveReportCard(cardForTerm);

    if (cardForTerm) {
      addToast({
        type: 'success',
        title: 'Report Card Retrieved! 🎓',
        message: `Found official terminal results for ${cardForTerm.student.firstName} ${cardForTerm.student.lastName}.`,
      });
    } else if (foundStudent) {
      addToast({
        type: 'info',
        title: 'Student Found',
        message: `Enrolled student found, but terminal rankings for ${activeTerm?.name} have not yet been finalized.`,
      });
    } else {
      addToast({
        type: 'error',
        title: 'Student Not Found',
        message: `No record found matching "${q}". Check the admission number and try again.`,
      });
    }
  };

  // Compile on-demand if student exists but report card pending
  const handleGenerateForMatchedStudent = () => {
    if (!matchedStudent) return;
    const studentClass = classes.find((c) => c.id === matchedStudent.classId) || classes[0];
    if (!studentClass || !activeTerm) return;

    try {
      const scores = db.getAssessmentScores();
      const att = db.getAttendanceRecords();
      const cal = db.getCalendarDays();

      const generated = generateClassRankingsAndReportCards({
        school,
        activeClass: studentClass,
        activeTerm,
        sessionName: currentSession?.name || '2026/2027',
        enrolledStudents: students,
        allAssessmentScores: scores,
        attendanceRecords: att,
        calendarDays: cal,
      });

      db.saveReportCards(generated);
      refreshData();

      const myCard = generated.find((c) => c.studentId === matchedStudent.id);
      if (myCard) {
        setActiveReportCard(myCard);
        addToast({
          type: 'success',
          title: 'Report Card Compiled! 🎓',
          message: `Generated terminal ranking and attendance report for ${matchedStudent.firstName} ${matchedStudent.lastName}.`,
        });
      }
    } catch (err) {
      console.error('Error generating card:', err);
      addToast({
        type: 'error',
        title: 'Generation Failed',
        message: 'Could not compile report cards at this time.',
      });
    }
  };

  // Run on mount if initial query provided
  useEffect(() => {
    if (initialStudentId) {
      setSearchQuery(initialStudentId);
      handleRetrieveReportCard(initialStudentId);
    } else {
      // Pre-retrieve first student for instant view
      handleRetrieveReportCard('ADM-2026-001');
    }
  }, [initialStudentId]);

  // When changing term, re-evaluate active report card
  useEffect(() => {
    if (hasSearched && matchedStudent) {
      const matchingCards = db.findReportCardsByStudentQuery(matchedStudent.admissionNumber);
      const cardForTerm =
        matchingCards.find((c) => c.termId === activeTerm?.id) || matchingCards[0] || null;
      setActiveReportCard(cardForTerm);
    }
  }, [selectedTermId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Hero Header & Search Section */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <GraduationCap className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                Student & Parent Academic Portal
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Access & Verify Student Terminal Report Cards
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Enter your official Student Admission Number (ID) below to view your terminal grades, class ranking, and attendance evaluation. Every report card includes a verifiable anti-tamper QR code.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => openVerifier()}
              className="px-4 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-lg transition-all flex items-center gap-2 transform active:scale-95"
            >
              <QrCode className="w-4 h-4 text-slate-950" />
              <span>Verify Card (Scan QR)</span>
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="bg-white/10 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-white/15 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Student ID Input with Autocomplete */}
            <div className="sm:col-span-8 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Enter Student ID / Admission No. (e.g. ADM-2026-001 or student name)"
                value={searchQuery}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setTimeout(() => setIsInputFocused(false), 250)}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRetrieveReportCard();
                }}
                className="w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm font-mono font-bold text-slate-900 bg-white rounded-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-inner"
              />

              {/* Autocomplete Dropdown */}
              {isInputFocused && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 divide-y divide-slate-100 z-50 overflow-hidden">
                  <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-sans">
                    Matching Enrolled Students:
                  </div>
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchQuery(s.admissionNumber);
                        handleRetrieveReportCard(s.admissionNumber);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-emerald-50/80 transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {s.firstName[0]}
                        </div>
                        <div className="truncate">
                          <span className="text-xs font-bold text-slate-900 block truncate">
                            {s.lastName}, {s.firstName}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-700 block">
                            {s.admissionNumber}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                        Select
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Term Dropdown */}
            <div className="sm:col-span-4 flex gap-2">
              <select
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(e.target.value)}
                className="flex-1 py-2.5 px-3 text-xs font-bold text-slate-900 bg-white rounded-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => handleRetrieveReportCard()}
                className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition-colors flex items-center gap-1.5 shrink-0"
              >
                <span>Search</span>
              </button>
            </div>
          </div>

          {/* Quick Demo Sample Student Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-[11px] text-slate-300 font-semibold">Try sample IDs:</span>
            {[
              { id: 'ADM-2026-001', name: 'Amadi (1st)' },
              { id: 'ADM-2026-002', name: 'Fatima (2nd)' },
              { id: 'ADM-2026-003', name: 'Chukwu (3rd)' },
              { id: 'ADM-2026-004', name: 'Danjuma' },
              { id: 'ADM-2026-026', name: 'David (JSS 1B)' },
              { id: 'ADM-2026-027', name: 'Aisha (JSS 1B)' },
            ].map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => {
                  setSearchQuery(sample.id);
                  handleRetrieveReportCard(sample.id);
                }}
                className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-mono transition-colors flex items-center gap-1.5 border border-white/10"
              >
                <span>{sample.id}</span>
                <span className="text-emerald-300 text-[10px]">({sample.name})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RESULTS DISPLAY SECTION */}
      {hasSearched && (
        <div className="space-y-6">
          {activeReportCard ? (
            /* CASE 1: REPORT CARD FOUND & COMPILED */
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-6 p-4 sm:p-8">
              {/* Report Card Header & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase font-mono">
                      Official Terminal Record
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-mono font-bold text-slate-600">
                      {activeReportCard.sessionName}
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase">
                    {activeReportCard.student.lastName}, {activeReportCard.student.firstName}{' '}
                    {activeReportCard.student.middleName || ''}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                    <span>
                      Admission No:{' '}
                      <strong className="font-mono text-slate-800">
                        {activeReportCard.student.admissionNumber}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      Class:{' '}
                      <strong className="text-slate-800">
                        {activeReportCard.className}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      Term:{' '}
                      <strong className="text-slate-800">
                        {activeReportCard.termName}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>View Official Dossier</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                </div>
              </div>

              {/* High-Level Ranking & Attendance KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {/* Position */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/40 border border-amber-200 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-800 uppercase">
                    <span>Class Position</span>
                    <Trophy className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-950">
                    {formatOrdinal(activeReportCard.positionInClass)}
                  </div>
                  <div className="text-[11px] text-amber-800/80">
                    out of {activeReportCard.totalStudentsInClass} enrolled students
                  </div>
                </div>

                {/* Overall Average */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/40 border border-emerald-200 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800 uppercase">
                    <span>Average Score</span>
                    <Percent className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-800">
                    {activeReportCard.averagePercentage.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-emerald-700 font-bold">
                    Grade {activeReportCard.overallGrade} ({activeReportCard.overallRemark})
                  </div>
                </div>

                {/* Total Marks */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-xs font-bold text-slate-500 uppercase">
                    Total Marks Obtained
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-900">
                    {activeReportCard.totalScoreObtained}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    out of {activeReportCard.totalPossibleScore} maximum
                  </div>
                </div>

                {/* Attendance Rate */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100/40 border border-teal-200 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-teal-800 uppercase">
                    <span>Attendance Rate</span>
                    <Clock className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-teal-800">
                    {activeReportCard.attendance.attendancePercentage.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-teal-700">
                    {activeReportCard.attendance.sessionsAttended} /{' '}
                    {activeReportCard.attendance.totalSessionsOpened} Sessions ({activeReportCard.attendance.punctualityTier})
                  </div>
                </div>
              </div>

              {/* Cognitive Assessment Subject Marks Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-slate-600" />
                    <span>Cognitive Subject Performance</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {activeReportCard.scores.length} Subjects Evaluated
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-white font-semibold">
                          <th className="py-2.5 px-3 w-10 text-center">No.</th>
                          <th className="py-2.5 px-3 min-w-[150px]">Subject Name</th>
                          <th className="py-2.5 px-3 text-center w-20">C.A. (40)</th>
                          <th className="py-2.5 px-3 text-center w-20">Exam (60)</th>
                          <th className="py-2.5 px-3 text-center w-24 bg-slate-800 font-bold text-emerald-400">
                            Total (100)
                          </th>
                          <th className="py-2.5 px-3 text-center w-16">Grade</th>
                          <th className="py-2.5 px-3 text-center w-20">Position</th>
                          <th className="py-2.5 px-3 min-w-[140px]">Remark</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeReportCard.scores.map((sc, i) => (
                          <tr key={sc.id} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                              {i + 1}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {sc.subjectName}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                              {sc.caScore}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                              {sc.examScore}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-black text-sm text-emerald-800 bg-slate-50">
                              {sc.totalScore}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] ${
                                  sc.grade === 'A'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : sc.grade === 'B'
                                    ? 'bg-blue-100 text-blue-800'
                                    : sc.grade === 'C'
                                    ? 'bg-teal-100 text-teal-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {sc.grade}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-700 font-semibold">
                              {sc.subjectPosition ? formatOrdinal(sc.subjectPosition) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                              {sc.remark}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Correlated Form Master & Principal Remarks + QR Code Card */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
                {/* Remarks Block */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Form Master's Correlated Attendance & Academic Remark
                    </span>
                    <p className="text-xs text-slate-800 italic leading-relaxed">
                      "{activeReportCard.formMasterRemark}"
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Principal's Assessment & Endorsement
                    </span>
                    <p className="text-xs text-slate-800 italic leading-relaxed">
                      "{activeReportCard.principalRemark}"
                    </p>
                  </div>
                </div>

                {/* Authentic Verification QR Code Card */}
                <div className="lg:col-span-5">
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                      Anti-Forgery Verification Seal
                    </span>
                    <ReportCardQRCode
                      reportCard={activeReportCard}
                      size={120}
                      onVerifyClick={(code) => openVerifier(code)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : matchedStudent ? (
            /* CASE 2: STUDENT ENROLLED BUT REPORT CARD PENDING FINALIZATION */
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
              <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                <Clock className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Terminal Results in Finalization
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Student record for <strong>{matchedStudent.firstName} {matchedStudent.lastName}</strong> ({matchedStudent.admissionNumber}) is active, but official class rankings for {activeTerm.name} have not yet been generated.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl max-w-md mx-auto border border-slate-200 text-xs text-slate-600">
                Subject teachers enter continuous assessment (CA) and examination marks; the school management then computes positions and finalizes official report cards.
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={handleGenerateForMatchedStudent}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition-all flex items-center gap-2 transform active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Compile & Finalize Report Card Now</span>
                </button>
              </div>
            </div>
          ) : (
            /* CASE 3: NO MATCH */
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3 shadow-sm">
              <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                No Student Record Found
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Could not find any student matching admission number or ID "<strong>{searchQuery}</strong>". Please verify the ID or check with the administrative office.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Full Modal Viewer */}
      {activeReportCard && (
        <StudentReportCardModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          reportCard={activeReportCard}
          schoolName={school.name}
          schoolAddress={school.address}
          schoolPhone={school.phone}
          principalName={school.principalName}
        />
      )}
    </div>
  );
};
