// Main Application Root
import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navigation/Navbar';
import { Sidebar } from './components/Navigation/Sidebar';
import { Dashboard } from './components/Dashboard/Dashboard';
import { AttendanceHub } from './components/Attendance/AttendanceHub';
import { TakeAttendance } from './components/Attendance/TakeAttendance';
import { PaperRegisterView } from './components/Attendance/PaperRegisterView';
import { StudentList } from './components/Students/StudentList';
import { AcademicSetupHub } from './components/Setup/AcademicSetupHub';
import { ReportsHub } from './components/Reports/ReportsHub';
import { ResultsHub } from './components/Assessments/ResultsHub';
import { AuditLogView } from './components/Audit/AuditLogView';
import { GlobalSearchModal } from './components/Search/GlobalSearchModal';
import { SetupWizardModal } from './components/Setup/SetupWizardModal';
import { GuideModal } from './components/Help/GuideModal';
import { BulkOnboardingModal } from './components/Onboarding/BulkOnboardingModal';
import { StudentPortalView } from './components/Portal/StudentPortalView';
import { ReportCardVerifierModal } from './components/Assessments/ReportCardVerifierModal';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';

const MainContent: React.FC = () => {
  const {
    activeTab,
    toasts,
    removeToast,
    isVerifierModalOpen,
    setIsVerifierModalOpen,
    verifierInitialCode,
    studentPortalInitialId,
  } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Navbar */}
      <Navbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 lg:pl-64 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'student-portal' && <ResultsHub />}

            {/* Attendance hub handles all three old tab values too */}
            {activeTab === 'attendance' && <AttendanceHub />}

            {/* Backward-compatible direct renders (also renderable as standalone) */}
            {activeTab === 'take-attendance' && <AttendanceHub />}
            {activeTab === 'paper-register' && <AttendanceHub />}
            {activeTab === 'reports' && <AttendanceHub />}

            {activeTab === 'results' && <ResultsHub />}
            {activeTab === 'assessments' && <ResultsHub />}
            {activeTab === 'students' && <StudentList />}
            {activeTab === 'academic-setup' && <AcademicSetupHub />}
            {activeTab === 'classes' && <AcademicSetupHub />}
            {activeTab === 'calendar' && <AcademicSetupHub />}
            {activeTab === 'sessions' && <AcademicSetupHub />}
            {activeTab === 'settings' && <AcademicSetupHub />}
            {activeTab === 'audit-log' && <AuditLogView />}
          </div>
        </main>
      </div>

      {/* Global Modals */}
      <GlobalSearchModal />
      <SetupWizardModal />
      <GuideModal />
      <BulkOnboardingModal />
      <ReportCardVerifierModal
        isOpen={isVerifierModalOpen}
        onClose={() => setIsVerifierModalOpen(false)}
        initialCode={verifierInitialCode}
      />

      {/* Toast Notification Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-xl shadow-lg border text-xs flex items-start gap-2.5 transition-all ${
              toast.type === 'success'
                ? 'bg-slate-900 text-white border-slate-800'
                : toast.type === 'error'
                ? 'bg-rose-900 text-white border-rose-800'
                : toast.type === 'warning'
                ? 'bg-amber-900 text-white border-amber-800'
                : 'bg-slate-800 text-white border-slate-700'
            }`}
          >
            {toast.type === 'success' && (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            {toast.type === 'error' && (
              <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            {toast.type === 'warning' && (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            {toast.type === 'info' && (
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            )}

            <div className="flex-1 min-w-0">
              <div className="font-bold">{toast.title}</div>
              {toast.message && (
                <div className="text-slate-300 mt-0.5 leading-snug">
                  {toast.message}
                </div>
              )}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white shrink-0 p-0.5"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}

export default App;