// Attendance Hub — tabbed container for Take Attendance, Paper Register, and Reports
import React, { useEffect } from 'react';
import { CheckSquare, BookOpen, FileText } from 'lucide-react';
import { useApp, AttendanceSubTab } from '../../context/AppContext';
import { TakeAttendance } from './TakeAttendance';
import { PaperRegisterView } from './PaperRegisterView';
import { ReportsHub } from '../Reports/ReportsHub';

export const AttendanceHub: React.FC = () => {
  const {
    activeTab,
    attendanceSubTab,
    setAttendanceSubTab,
    setActiveTab,
  } = useApp();

  // One-time redirect: if the user reached us via an old tab value
  // (take-attendance / paper-register / reports), set the sub-tab
  // accordingly and normalize activeTab to 'attendance'.
  useEffect(() => {
    if (activeTab === 'take-attendance') {
      setAttendanceSubTab('take');
      setActiveTab('attendance');
    } else if (activeTab === 'paper-register') {
      setAttendanceSubTab('paper');
      setActiveTab('attendance');
    } else if (activeTab === 'reports') {
      setAttendanceSubTab('reports');
      setActiveTab('attendance');
    }
  }, [activeTab, setAttendanceSubTab, setActiveTab]);

  const tabs: Array<{
    id: AttendanceSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }> = [
    {
      id: 'take',
      label: 'Take Attendance',
      icon: CheckSquare,
      description: 'Mark morning & afternoon register',
    },
    {
      id: 'paper',
      label: 'Paper Register',
      icon: BookOpen,
      description: 'Traditional V / OO ledger view',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileText,
      description: 'Weekly, monthly & terminal exports',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tab Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-1.5 flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = attendanceSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAttendanceSubTab(tab.id)}
              className={`flex-1 min-w-[160px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-emerald-400' : 'text-slate-400'
                }`}
              />
              <div className="text-left min-w-0 flex-1">
                <div className="truncate">{tab.label}</div>
                <div
                  className={`text-[10px] font-normal truncate ${
                    isActive ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  {tab.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sub-tab Content */}
      <div>
        {attendanceSubTab === 'take' && <TakeAttendance />}
        {attendanceSubTab === 'paper' && <PaperRegisterView />}
        {attendanceSubTab === 'reports' && <ReportsHub />}
      </div>
    </div>
  );
};