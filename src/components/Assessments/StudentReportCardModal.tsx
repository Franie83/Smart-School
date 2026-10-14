// Official Student Terminal Report Card Modal & Printable Sheet
import React from 'react';
import {
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  GraduationCap,
  Percent,
  Printer,
  School,
  Share2,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { StudentReportCard } from '../../types/attendance';
import { formatOrdinal } from '../../utils/academicEngine';
import { ReportCardQRCode } from './ReportCardQRCode';
import { useApp } from '../../context/AppContext';

interface StudentReportCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportCard: StudentReportCard | null;
  allReportCards?: StudentReportCard[];
  onSelectStudent?: (studentId: string) => void;
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  principalName: string;
}

export const StudentReportCardModal: React.FC<StudentReportCardModalProps> = ({
  isOpen,
  onClose,
  reportCard,
  allReportCards = [],
  onSelectStudent,
  schoolName,
  schoolAddress,
  schoolPhone,
  principalName,
}) => {
  const { openVerifier } = useApp();
  if (!isOpen || !reportCard) return null;

  const currentIndex = allReportCards.findIndex(
    (rc) => rc.studentId === reportCard.studentId
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < allReportCards.length - 1;

  const handlePrev = () => {
    if (hasPrev && onSelectStudent) {
      onSelectStudent(allReportCards[currentIndex - 1].studentId);
    }
  };

  const handleNext = () => {
    if (hasNext && onSelectStudent) {
      onSelectStudent(allReportCards[currentIndex + 1].studentId);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const rank = reportCard.positionInClass;
  const isTopThree = rank <= 3;
  const totalStudents = reportCard.totalStudentsInClass;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white max-w-4xl w-full rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[94vh]">
        {/* Top Control Bar (Hidden in Print) */}
        <div className="print:hidden p-3.5 sm:px-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1.5">
              <GraduationCap className="w-5 h-5 text-emerald-400" />
              <span className="font-bold text-xs sm:text-sm">
                Official Terminal Report Card
              </span>
            </div>

            {allReportCards.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg text-xs">
                <button
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300"
                  title="Previous student report card"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-[11px] text-slate-300 px-1">
                  {currentIndex + 1} of {allReportCards.length}
                </span>
                <button
                  onClick={handleNext}
                  disabled={!hasNext}
                  className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300"
                  title="Next student report card"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Official Card</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE REPORT CARD BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 print:p-0 print:overflow-visible">
          {/* Official Letterhead */}
          <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white font-serif font-black text-2xl flex items-center justify-center border border-slate-800 shadow-xs">
                {schoolName.slice(0, 1)}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight font-serif">
                  {schoolName}
                </h1>
                <p className="text-xs text-slate-600 font-medium">{schoolAddress}</p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Tel: {schoolPhone} · Official Academic & Attendance Dossier
                </p>
              </div>
            </div>

            <div className="pt-2">
              <span className="inline-block px-4 py-1 rounded-full bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
                Continuous Assessment & Terminal Examination Report
              </span>
            </div>
          </div>

          {/* Student Bio & Term Data */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium">
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-bold">
                Student Full Name
              </span>
              <span className="font-bold text-slate-900 text-sm">
                {reportCard.student.lastName.toUpperCase()},{' '}
                {reportCard.student.firstName} {reportCard.student.middleName || ''}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-bold">
                Admission Number
              </span>
              <span className="font-bold font-mono text-slate-800 text-sm">
                {reportCard.student.admissionNumber}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-bold">
                Class & Stream
              </span>
              <span className="font-bold text-slate-900 text-sm">
                {reportCard.className}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-bold">
                Academic Term & Year
              </span>
              <span className="font-semibold text-slate-800">
                {reportCard.termName} ({reportCard.sessionName})
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-bold">
                Sex / Gender
              </span>
              <span className="font-semibold text-slate-800">
                {reportCard.student.gender}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-bold">
                Date of Birth
              </span>
              <span className="font-mono text-slate-700">
                {reportCard.student.dateOfBirth || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-bold">
                Class Enrollment
              </span>
              <span className="font-bold text-slate-900">
                {totalStudents} Students on Roll
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block font-bold">
                Date Issued
              </span>
              <span className="font-mono text-slate-700">
                {new Date(reportCard.generatedAt).toLocaleDateString('en-GB')}
              </span>
            </div>
          </div>

          {/* High-Level Ranking Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* Position */}
            <div
              className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                isTopThree
                  ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                <span>Class Position</span>
                <Award className={`w-4 h-4 ${isTopThree ? 'text-amber-600' : 'text-slate-400'}`} />
              </div>
              <div className="mt-1">
                <div className="text-2xl font-black font-mono">
                  {formatOrdinal(rank)}
                </div>
                <div className="text-[10px] text-slate-500">
                  Out of {totalStudents} students
                </div>
              </div>
            </div>

            {/* Total Marks */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 flex flex-col justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Marks
              </div>
              <div className="mt-1">
                <div className="text-2xl font-black font-mono">
                  {reportCard.totalScoreObtained}
                </div>
                <div className="text-[10px] text-slate-500">
                  Obtained out of {reportCard.totalPossibleScore}
                </div>
              </div>
            </div>

            {/* Overall Percentage */}
            <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 flex flex-col justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Overall Average
              </div>
              <div className="mt-1">
                <div className="text-2xl font-black font-mono text-emerald-800">
                  {reportCard.averagePercentage.toFixed(1)}%
                </div>
                <div className="text-[10px] text-emerald-700">
                  Weighted Terminal Score
                </div>
              </div>
            </div>

            {/* Grade */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 flex flex-col justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Overall Grade
              </div>
              <div className="mt-1">
                <div className="text-2xl font-black font-mono text-slate-900">
                  Grade {reportCard.overallGrade}
                </div>
                <div className="text-[10px] text-slate-500">
                  {reportCard.overallRemark}
                </div>
              </div>
            </div>

            {/* Attendance Score */}
            <div className="p-3.5 rounded-xl bg-teal-50/80 border border-teal-200 text-teal-950 flex flex-col justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-teal-800">
                Attendance Rate
              </div>
              <div className="mt-1">
                <div className="text-2xl font-black font-mono text-teal-800">
                  {reportCard.attendance.attendancePercentage.toFixed(1)}%
                </div>
                <div className="text-[10px] text-teal-700">
                  {reportCard.attendance.punctualityTier} Tier
                </div>
              </div>
            </div>
          </div>

          {/* ACADEMIC SUBJECT SCORES TABLE */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-slate-600" />
              <span>Cognitive Assessment Breakdown</span>
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-semibold">
                    <th className="py-2 px-3 w-10 text-center">No.</th>
                    <th className="py-2 px-3 min-w-[150px]">Subject Name</th>
                    <th className="py-2 px-2.5 text-center w-14">C.A. (40)</th>
                    <th className="py-2 px-2.5 text-center w-14">Exam (60)</th>
                    <th className="py-2 px-2.5 text-center w-16 bg-slate-800">Total (100)</th>
                    <th className="py-2 px-2 w-12 text-center">Grade</th>
                    <th className="py-2 px-2 w-14 text-center">Position</th>
                    <th className="py-2 px-2 w-12 text-center text-slate-300">Min</th>
                    <th className="py-2 px-2 w-12 text-center text-slate-300">Max</th>
                    <th className="py-2 px-2 w-12 text-center text-slate-300">Avg</th>
                    <th className="py-2 px-3 min-w-[130px]">Subject Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportCard.scores.map((sc, i) => (
                    <tr key={sc.id} className="hover:bg-slate-50/80">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono">
                        {i + 1}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900">
                        {sc.subjectName}
                      </td>
                      <td className="py-2 px-2.5 text-center font-mono font-semibold text-slate-700">
                        {sc.caScore}
                      </td>
                      <td className="py-2 px-2.5 text-center font-mono font-semibold text-slate-700">
                        {sc.examScore}
                      </td>
                      <td className="py-2 px-2.5 text-center font-mono font-black text-slate-900 bg-slate-50">
                        {sc.totalScore}
                      </td>
                      <td className="py-2 px-2 text-center font-bold font-mono">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] ${
                            sc.grade === 'A'
                              ? 'bg-emerald-100 text-emerald-800'
                              : sc.grade === 'B'
                              ? 'bg-blue-100 text-blue-800'
                              : sc.grade === 'C'
                              ? 'bg-teal-100 text-teal-800'
                              : sc.grade === 'D' || sc.grade === 'E'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {sc.grade}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center font-mono font-bold text-slate-700">
                        {sc.subjectPosition ? formatOrdinal(sc.subjectPosition) : '—'}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-slate-400 text-[11px]">
                        {sc.classLowest ?? '—'}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-slate-600 font-semibold text-[11px]">
                        {sc.classHighest ?? '—'}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-slate-500 text-[11px]">
                        {sc.classAverage ?? '—'}
                      </td>
                      <td className="py-2 px-3 text-[11px] text-slate-600">
                        {sc.remark}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={2} className="py-2 px-3 text-slate-700 uppercase text-[11px]">
                      Terminal Aggregate
                    </td>
                    <td className="py-2 px-2.5 text-center font-mono">
                      {reportCard.scores.reduce((sum, s) => sum + s.caScore, 0)}
                    </td>
                    <td className="py-2 px-2.5 text-center font-mono">
                      {reportCard.scores.reduce((sum, s) => sum + s.examScore, 0)}
                    </td>
                    <td className="py-2 px-2.5 text-center font-mono text-slate-900 font-black bg-slate-100">
                      {reportCard.totalScoreObtained} / {reportCard.totalPossibleScore}
                    </td>
                    <td colSpan={6} className="py-2 px-3 text-right text-emerald-800 font-bold">
                      Class Average: {reportCard.averagePercentage.toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* INTEGRATED ATTENDANCE & PUNCTUALITY LEDGER SECTION */}
          <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
              <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
                <span>Attendance & Punctuality Profile (Correlated Ledger)</span>
              </h4>
              <span className="text-[11px] font-bold text-emerald-800 font-mono">
                Official Register Record
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                <span className="text-[10px] text-slate-500 uppercase block">
                  School Sessions Opened
                </span>
                <span className="text-base font-bold font-mono text-slate-800">
                  {reportCard.attendance.totalSessionsOpened} Sessions
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  ({Math.round(reportCard.attendance.totalSessionsOpened / 2)} School Days)
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                <span className="text-[10px] text-slate-500 uppercase block">
                  Sessions Attended (Present)
                </span>
                <span className="text-base font-bold font-mono text-emerald-700">
                  {reportCard.attendance.sessionsAttended} / {reportCard.attendance.totalSessionsOpened}
                </span>
                <span className="text-[10px] text-emerald-600 block mt-0.5 font-bold">
                  {reportCard.attendance.attendancePercentage.toFixed(1)}% Rate
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                <span className="text-[10px] text-slate-500 uppercase block">
                  Sessions Absent
                </span>
                <span className="text-base font-bold font-mono text-rose-700">
                  {reportCard.attendance.sessionsAbsent} Sessions
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Unexcused & Excused
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                <span className="text-[10px] text-slate-500 uppercase block">
                  Times Marked Late
                </span>
                <span className="text-base font-bold font-mono text-amber-700">
                  {reportCard.attendance.sessionsLate} Days
                </span>
                <span className="text-[10px] text-amber-800 font-medium block mt-0.5">
                  Tier: {reportCard.attendance.punctualityTier}
                </span>
              </div>
            </div>

            <div className="text-xs text-emerald-900 bg-white p-3 rounded-lg border border-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Attendance Evaluation:</strong> {reportCard.attendance.summaryRemark}.
              </div>
            </div>
          </div>

          {/* TEACHER & PRINCIPAL OFFICIAL REMARKS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Form Master's Remark */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Form Master / Class Teacher's Report
              </span>
              <p className="text-slate-800 italic leading-relaxed min-h-[48px]">
                "{reportCard.formMasterRemark}"
              </p>
              <div className="pt-4 border-t border-slate-200 flex items-end justify-between">
                <div>
                  <div className="w-32 border-b border-slate-400 mb-1"></div>
                  <span className="text-[10px] text-slate-500">Teacher's Signature</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date().toLocaleDateString('en-GB')}
                </span>
              </div>
            </div>

            {/* Principal's Remark */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Principal's Assessment & Endorsement
              </span>
              <p className="text-slate-800 italic leading-relaxed min-h-[48px]">
                "{reportCard.principalRemark}"
              </p>
              <div className="pt-4 border-t border-slate-200 flex items-end justify-between">
                <div>
                  <div className="w-36 border-b border-slate-400 mb-1"></div>
                  <span className="text-[10px] text-slate-500 font-bold">
                    {principalName}
                  </span>
                </div>
                <div className="text-right">
                  <div className="w-16 h-8 border border-slate-300 rounded flex items-center justify-center text-[9px] font-mono text-slate-400 mb-1">
                    OFFICIAL STAMP
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* OFFICIAL ANTI-FORGERY QR VERIFICATION SEAL */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[260px]">
              <ReportCardQRCode
                reportCard={reportCard}
                size={95}
                onVerifyClick={(code) => {
                  if (openVerifier) {
                    openVerifier(code);
                  }
                }}
              />
            </div>
            <div className="text-right hidden sm:block font-mono text-[10px] text-slate-400">
              <div>Secure Digital Verification</div>
              <div>Ministry Anti-Tamper Standard</div>
              <div className="text-emerald-700 font-bold">Cryptographically Scannable</div>
            </div>
          </div>

          {/* Next Term Notice & Grading Legend */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
            <div>
              <strong>Next Term Resumption Date:</strong>{' '}
              <span className="font-semibold text-slate-800 font-mono">
                {reportCard.resumptionDate || 'Monday, 11th January 2027'}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span>A: 75-100% (Distinction)</span>
              <span>·</span>
              <span>B: 65-74% (Very Good)</span>
              <span>·</span>
              <span>C: 50-64% (Credit)</span>
              <span>·</span>
              <span>D: 45-49% (Pass)</span>
              <span>·</span>
              <span>F: 0-39% (Fail)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
