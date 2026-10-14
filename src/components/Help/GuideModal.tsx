// GuideModal Component - Complete 13-Step Manual
import React from 'react';
import { BookOpen, CheckCircle, HelpCircle, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const GuideModal: React.FC = () => {
  const { isHelpOpen, setIsHelpOpen } = useApp();

  if (!isHelpOpen) return null;

  const steps = [
    {
      step: 1,
      title: 'Setting up a school',
      desc: 'Use the Setup Wizard or Settings > School Profile. Enter the school name, principal name, official phone, email, address, and configure regular school days of the week (e.g. Monday–Friday).',
    },
    {
      step: 2,
      title: 'Creating an academic session',
      desc: 'Go to Sessions & Terms > New Session. Provide the session identifier (e.g. 2026/2027) with the academic year start and end dates. Set it as current session.',
    },
    {
      step: 3,
      title: 'Creating a term',
      desc: 'Under the active session, click "Add Term" (e.g. First Term, Second Term). Provide start and end dates. The system automatically computes opening days from the calendar, or you can enter a manual override.',
    },
    {
      step: 4,
      title: 'Adding classes',
      desc: 'Go to Classes & Streams > Create New Class Arm. Specify the class name (e.g. JSS 1), arm (A), capacity, and assign a form master.',
    },
    {
      step: 5,
      title: 'Adding students & handling movement',
      desc: 'Navigate to Student Register > Enroll New Student. Fill in admission number (unique), full names, gender, date of admission, parent details. For transfers or withdrawals, use the Movement button to set effective dates so the attendance denominator is preserved.',
    },
    {
      step: 6,
      title: 'Setting the school calendar',
      desc: 'Go to School Calendar. Click any date to flag Public Holidays, Mid-Term Breaks, Examinations, or Special Events. Non-school days are automatically excluded from the attendance denominator.',
    },
    {
      step: 7,
      title: 'Taking morning attendance',
      desc: 'Navigate to Take Attendance. Select Class, Arm, and Date. Choose Morning tab. Tap [Present], [Absent], or [Excused] for each student. If present, tap "Late?" to mark morning lateness. Tap "Mark All Present" for fast batch entry.',
    },
    {
      step: 8,
      title: 'Taking afternoon attendance',
      desc: 'On the same attendance screen, switch to the Afternoon tab. Morning attendance is preserved independently. Mark afternoon present/absent/late, then tap "Save Changes". The register automatically calculates register marks (\, /, V, OO).',
    },
    {
      step: 9,
      title: 'Correcting attendance & audit logging',
      desc: 'Open Take Attendance for any past date. Change the status. You can provide an optional reason. Saving updates all calculations and records an entry in the Audit Trail with timestamp and previous values.',
    },
    {
      step: 10,
      title: 'Viewing weekly reports',
      desc: 'Go to Attendance Reports > Weekly Class Sheet. Select Class, Arm, and Week starting Monday. See Monday–Friday morning and afternoon splits, weekly totals, and percentage attendance.',
    },
    {
      step: 11,
      title: 'Viewing term reports',
      desc: 'Go to Attendance Reports > Terminal Summary Report. Review the terminal matrix with individual days enrolled, morning present, afternoon present, total sessions attended, boys/girls totals, and punctuality.',
    },
    {
      step: 12,
      title: 'Exporting reports',
      desc: 'On the Reports page, click "Download Official PDF" for an A4 landscape formatted school register with signature lines, or click "Export Excel" for spreadsheet data.',
    },
    {
      step: 13,
      title: 'Finalizing a term',
      desc: 'When a term ends, go to Sessions & Terms and click "Finalize Term". This locks attendance records against modifications by normal teachers. Only administrators can unlock with an audit reason.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-900 text-emerald-100 flex items-center justify-center font-bold">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Smart School Attendance Register — User Guide
              </h3>
              <p className="text-xs text-slate-500">
                13-step operational walkthrough for administrators & teachers
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsHelpOpen(false)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps List */}
        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1 text-xs">
          {steps.map((s) => (
            <div
              key={s.step}
              className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1"
            >
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-mono shrink-0">
                  {s.step}
                </span>
                <span>{s.title}</span>
              </div>
              <p className="text-slate-600 pl-7 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
          <div className="text-slate-400 font-mono text-[11px]">
            Smart Register System v2.0
          </div>
          <button
            onClick={() => setIsHelpOpen(false)}
            className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg shadow-2xs"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
};
