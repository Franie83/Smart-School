// Navbar Component
import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  GraduationCap,
  HelpCircle,
  Lock,
  LogOut,
  Menu,
  QrCode,
  Search,
  Wifi,
  WifiOff,
  Wrench,
  BookOpen,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Navbar: React.FC<{ onMenuToggle?: () => void }> = ({
  onMenuToggle,
}) => {
  const {
    school,
    currentSession,
    currentTerm,
    currentUser,
    isOnline,
    setIsSearchOpen,
    setIsHelpOpen,
    setIsSetupWizardOpen,
    openVerifier,
    openStudentPortal,
  } = useApp();

  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  // Close help dropdown when clicking outside of it
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
    }
    if (helpOpen) {
      document.addEventListener('mousedown', onClickOutside);
    }
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [helpOpen]);

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      window.location.reload();
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
      <div className="px-4 lg:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & School Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs font-serif font-black text-lg tracking-wider border border-slate-700">
              {school.name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-slate-900 text-sm sm:text-base truncate tracking-tight">
                  {school.name}
                </h1>
                {currentTerm?.isFinalized && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <Lock className="w-3 h-3" /> Term Finalized
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span>{currentSession?.name || '2026/2027'}</span>
                <span aria-hidden="true">·</span>
                <span>{currentTerm?.name || 'First Term'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right actions: Search, Online, Quick actions, Help, Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Verify QR button */}
          <button
            onClick={() => openVerifier()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors shadow-2xs"
            title="Scan or Verify Report Card QR Code"
          >
            <QrCode className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden sm:inline">Verify QR</span>
          </button>

          {/* Student Portal button */}
          <button
            onClick={() => openStudentPortal()}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
            title="Access Report Card with Student ID"
          >
            <GraduationCap className="w-3.5 h-3.5 text-emerald-700" />
            <span>Student Portal</span>
          </button>

          {/* Global Search trigger */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
            title="Search students, admission numbers, classes (Cmd+K)"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Quick Search...</span>
            <kbd className="hidden md:inline text-[10px] bg-white text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
              ⌘K
            </kbd>
          </button>

          {/* Network status */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md font-medium border ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline Drafts</span>
              </>
            )}
          </div>

          {/* Help dropdown (Guide + Setup Wizard merged) */}
          <div className="relative" ref={helpRef}>
            <button
              onClick={() => setHelpOpen((v) => !v)}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                helpOpen
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'text-slate-700 bg-white hover:bg-slate-50 border-slate-200'
              }`}
              title="Help & Setup"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Help</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${
                  helpOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {helpOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    setIsHelpOpen(true);
                    setHelpOpen(false);
                  }}
                  className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <BookOpen className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      User Guide
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      13-step walkthrough for admins & teachers
                    </div>
                  </div>
                </button>

                <div className="h-px bg-slate-100" />

                <button
                  onClick={() => {
                    setIsSetupWizardOpen(true);
                    setHelpOpen(false);
                  }}
                  className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <Wrench className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Setup Wizard
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Configure school, session, term & classes
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Authenticated server identity */}
          <div className="flex items-center gap-2 pl-2 pr-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200">
            <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {currentUser.name.slice(0, 1)}
            </div>
            <div className="text-left hidden md:block">
              <div className="text-xs font-semibold text-slate-900 leading-tight">
                {currentUser.name.split(' ')[0]}
              </div>
              <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                {currentUser.role.replace('_', ' ')}
              </div>
            </div>
          </div>

          <button
            onClick={signOut}
            className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-600 bg-white hover:bg-rose-50 hover:text-rose-700 rounded-lg border border-slate-200"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
};