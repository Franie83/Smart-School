// Sidebar Component
import React from 'react';
import {
  Award,
  CheckSquare,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  QrCode,
  School,
  Users,
} from 'lucide-react';
import { NavTab, useApp } from '../../context/AppContext';

export const Sidebar: React.FC<{ isOpen?: boolean; onClose?: () => void }> = ({
  isOpen = false,
  onClose,
}) => {
  const {
    activeTab,
    setActiveTab,
    canManageSchool,
    openBulkOnboarding,
    openVerifier,
  } = useApp();

  const navItems: {
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    description: string;
  }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'Overview, KPI cards & alerts',
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: CheckSquare,
      badge: 'Hub',
      description: 'Take attendance, paper register & reports',
    },
    {
      id: 'results',
      label: 'Results',
      icon: Award,
      badge: 'Scores',
      description: 'Score entry, rankings & report card portal',
    },
    {
      id: 'students',
      label: 'Student Register',
      icon: Users,
      description: 'Enrollment, movements & profiles',
    },
    {
      id: 'academic-setup',
      label: 'Academic Setup',
      icon: School,
      badge: 'Hub',
      description: 'Classes, calendar, sessions & settings',
    },
    {
      id: 'audit-log',
      label: 'Audit Trail',
      icon: History,
      description: 'Attendance change corrections log',
    },
  ];

  const handleSelect = (tab: NavTab) => {
    setActiveTab(tab);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="flex-1 overflow-y-auto p-3 pt-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left group ${
                  isActive
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                      isActive
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Actions in Sidebar Footer */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {/* QR Verification Action */}
          <button
            onClick={() => {
              openVerifier();
              if (onClose) onClose();
            }}
            className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center justify-between transition-colors shadow-2xs group"
          >
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>Verify Card (Scan QR)</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-600/60 font-mono">
              Live
            </span>
          </button>

          {/* Quick Bulk Onboarding Action */}
          {canManageSchool() && (
            <button
              onClick={() => {
                openBulkOnboarding('STUDENTS');
                if (onClose) onClose();
              }}
              className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-between transition-colors shadow-2xs group"
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Bulk Onboarding</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-mono">
                Hub
              </span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};