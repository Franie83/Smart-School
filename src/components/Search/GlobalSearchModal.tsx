// Global Search Modal Component
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  GraduationCap,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const GlobalSearchModal: React.FC = () => {
  const {
    students,
    permittedStudents,
    classes,
    permittedClasses,
    currentUser,
    isSearchOpen,
    setIsSearchOpen,
    setSelectedClassId,
    setActiveTab,
  } = useApp();

  const [query, setQuery] = useState('');

  // Handle Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, setIsSearchOpen]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    return permittedStudents.filter((s) => {
      const fullName = `${s.firstName} ${s.middleName || ''} ${s.lastName}`.toLowerCase();
      const adm = s.admissionNumber.toLowerCase();
      const cls = permittedClasses.find((c) => c.id === s.classId);
      const className = cls ? `${cls.name} ${cls.arm}`.toLowerCase() : '';
      return fullName.includes(q) || adm.includes(q) || className.includes(q);
    });
  }, [query, permittedStudents, permittedClasses]);

  if (!isSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 pt-20">
      <div className="bg-white max-w-xl w-full rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-0 animate-in fade-in zoom-in-95 duration-100">
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-slate-200 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search student by name, admission no. (e.g. DIS/2026/001), or class..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          <button
            onClick={() => setIsSearchOpen(false)}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto p-2">
          {query.trim() === '' ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-1">
              <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <div className="font-semibold text-slate-600">
                Quick Student & Class Lookup
              </div>
              <div>Type an admission number, student first/last name, or class arm.</div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No registered students found matching &quot;{query}&quot;
            </div>
          ) : (
            <div className="space-y-1">
              {searchResults.map((s) => {
                const cls = classes.find((c) => c.id === s.classId);
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedClassId(s.classId);
                      setActiveTab('take-attendance');
                      setIsSearchOpen(false);
                    }}
                    className="p-3 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200 transition-colors flex items-center justify-between group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {s.lastName.toUpperCase()}, {s.firstName}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                            s.gender === 'MALE'
                              ? 'text-blue-700 bg-blue-50'
                              : 'text-pink-700 bg-pink-50'
                          }`}
                        >
                          {s.gender === 'MALE' ? 'M' : 'F'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {cls ? `${cls.name} ${cls.arm}` : s.classId}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {s.admissionNumber} · Enrolled: {s.dateOfAdmission}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-400 group-hover:text-slate-800 transition-colors">
                      <span className="hidden sm:inline text-[11px] font-medium">
                        Open Register
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between font-mono">
          <span>Search database across {students.length} students</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
