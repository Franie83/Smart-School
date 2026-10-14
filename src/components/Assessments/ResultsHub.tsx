// Results Hub — tabbed container for Score Entry, Rankings, and Report Card Portal
import React, { useEffect } from 'react';
import { BookOpen, Trophy, GraduationCap } from 'lucide-react';
import { useApp, ResultsSubTab } from '../../context/AppContext';
import { AssessmentsHub } from './AssessmentsHub';
import { StudentPortalView } from '../Portal/StudentPortalView';

export const ResultsHub: React.FC = () => {
  const {
    activeTab,
    resultsSubTab,
    setResultsSubTab,
    setActiveTab,
    studentPortalInitialId,
  } = useApp();

  // One-time redirect: if the user reached us via an old tab value,
  // set the sub-tab accordingly and normalize activeTab to 'results'.
  useEffect(() => {
    if (activeTab === 'assessments') {
      setResultsSubTab('scores');
      setActiveTab('results');
    } else if (activeTab === 'student-portal') {
      setResultsSubTab('portal');
      setActiveTab('results');
    }
  }, [activeTab, setResultsSubTab, setActiveTab]);

  const tabs: Array<{
    id: ResultsSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }> = [
    {
      id: 'scores',
      label: 'Score Entry',
      icon: BookOpen,
      description: 'Enter CA & Exam scores per subject',
    },
    {
      id: 'rankings',
      label: 'Rankings',
      icon: Trophy,
      description: 'Class positions & terminal report cards',
    },
    {
      id: 'portal',
      label: 'Report Card Portal',
      icon: GraduationCap,
      description: 'Public lookup by student ID',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tab Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-1.5 flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = resultsSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setResultsSubTab(tab.id)}
              className={`flex-1 min-w-[160px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-amber-400' : 'text-slate-400'
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
        {/*
          Note: AssessmentsHub internally has its own SCORING / RANKINGS toggle.
          We pass a hidden prop through context; but since the simplest path is
          to let AssessmentsHub show both, we drive the initial sub-tab by
          remounting with a key when the user switches.
        */}
        {resultsSubTab === 'scores' && <AssessmentsHub key="results-scores" />}
        {resultsSubTab === 'rankings' && <AssessmentsHub key="results-rankings" />}
        {resultsSubTab === 'portal' && (
          <StudentPortalView initialStudentId={studentPortalInitialId} />
        )}
      </div>
    </div>
  );
};