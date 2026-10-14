// Academic Setup Hub — Classes, Calendar, Sessions, Settings, Setup Wizard
import React, { useEffect } from 'react';
import { School, Calendar, FileSpreadsheet, Settings as SettingsIcon, Wrench } from 'lucide-react';
import { useApp, AcademicSetupSubTab } from '../../context/AppContext';
import { ClassList } from '../Classes/ClassList';
import { SchoolCalendar } from '../Calendar/SchoolCalendar';
import { SessionManagement } from '../Sessions/SessionManagement';
import { SettingsView } from '../Settings/SettingsView';

export const AcademicSetupHub: React.FC = () => {
  const {
    activeTab,
    academicSetupSubTab,
    setAcademicSetupSubTab,
    setActiveTab,
    setIsSetupWizardOpen,
  } = useApp();

  // Redirect old tab values into the hub on mount
  useEffect(() => {
    if (activeTab === 'classes') {
      setAcademicSetupSubTab('classes');
      setActiveTab('academic-setup');
    } else if (activeTab === 'calendar') {
      setAcademicSetupSubTab('calendar');
      setActiveTab('academic-setup');
    } else if (activeTab === 'sessions') {
      setAcademicSetupSubTab('sessions');
      setActiveTab('academic-setup');
    } else if (activeTab === 'settings') {
      setAcademicSetupSubTab('settings');
      setActiveTab('academic-setup');
    }
  }, [activeTab, setAcademicSetupSubTab, setActiveTab]);

  const tabs: Array<{
    id: AcademicSetupSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }> = [
    {
      id: 'classes',
      label: 'Classes',
      icon: School,
      description: 'Classes, arms, capacities & form teachers',
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: Calendar,
      description: 'Opening days, holidays & term events',
    },
    {
      id: 'sessions',
      label: 'Sessions & Terms',
      icon: FileSpreadsheet,
      description: 'Academic years & term finalization',
    },
    {
      id: 'settings',
      label: 'School Settings',
      icon: SettingsIcon,
      description: 'Profile, symbols, users, backups',
    },
    {
      id: 'wizard',
      label: 'Setup Wizard',
      icon: Wrench,
      description: 'First-run school onboarding guide',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tab Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-1.5 flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = academicSetupSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAcademicSetupSubTab(tab.id)}
              className={`flex-1 min-w-[150px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
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
        {academicSetupSubTab === 'classes' && <ClassList />}
        {academicSetupSubTab === 'calendar' && <SchoolCalendar />}
        {academicSetupSubTab === 'sessions' && <SessionManagement />}
        {academicSetupSubTab === 'settings' && <SettingsView />}
        {academicSetupSubTab === 'wizard' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-2xl mx-auto text-center space-y-4 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
              <Wrench className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                School Setup Wizard
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Configure school identity, academic session, current term, and
                initial classes in one guided flow. Ideal for first-run setup
                of a new school.
              </p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 text-left max-w-md mx-auto">
              <strong>Heads up:</strong> Running the wizard again on an
              already-configured school will create additional sessions and
              classes rather than replacing existing ones.
            </div>
            <button
              type="button"
              onClick={() => setIsSetupWizardOpen(true)}
              className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-2xs transition-colors inline-flex items-center gap-2"
            >
              <Wrench className="w-4 h-4 text-emerald-400" />
              <span>Open Setup Wizard</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
