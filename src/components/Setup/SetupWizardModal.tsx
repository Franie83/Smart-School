// Setup Wizard Modal Component for New School Onboarding
import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle,
  GraduationCap,
  School,
  Sparkles,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { db } from '../../services/storage';

export const SetupWizardModal: React.FC = () => {
  const { isSetupWizardOpen, setIsSetupWizardOpen, school, addToast, refreshData } =
    useApp();

  const [step, setStep] = useState(1);

  // Step 1: School Details
  const [name, setName] = useState(school.name);
  const [principal, setPrincipal] = useState(school.principalName);
  const [phone, setPhone] = useState(school.phone);
  const [email, setEmail] = useState(school.email);
  const [address, setAddress] = useState(school.address);

  // Step 2: Academic Session & Term
  const [sessionName, setSessionName] = useState('2026/2027');
  const [termName, setTermName] = useState('First Term');
  const [termStart, setTermStart] = useState('2026-09-07');
  const [termEnd, setTermEnd] = useState('2026-12-11');

  // Step 3: Classes
  const [classArmList, setClassArmList] = useState('JSS 1A, JSS 1B, JSS 2A, Primary 1A');

  if (!isSetupWizardOpen) return null;

  const handleFinish = () => {
    // 1. Update School
    db.updateSchool({
      name: name.trim(),
      principalName: principal.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
    });

    // 2. Add Session if not exists
    const sess = db.addSession({
      schoolId: school.id,
      name: sessionName.trim(),
      startDate: termStart,
      endDate: '2027-07-20',
      isCurrent: true,
    });

    // 3. Add Term
    db.addTerm({
      schoolId: school.id,
      sessionId: sess.id,
      name: termName.trim(),
      startDate: termStart,
      endDate: termEnd,
      status: 'ACTIVE',
    });

    // 4. Create Classes from list
    const items = classArmList.split(',').map((s) => s.trim()).filter(Boolean);
    items.forEach((item) => {
      const parts = item.split(' ');
      const arm = parts.pop() || 'A';
      const cName = parts.join(' ') || 'Class';
      db.addClass({
        schoolId: school.id,
        name: cName,
        arm,
        sessionId: sess.id,
        capacity: 45,
        status: 'ACTIVE',
      });
    });

    addToast({
      type: 'success',
      title: 'School Setup Complete',
      message: `${name} configured with session ${sessionName} and term ${termName}.`,
    });

    setIsSetupWizardOpen(false);
    refreshData();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-5 my-8">
        {/* Wizard Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                School Setup Wizard
              </h3>
              <p className="text-xs text-slate-500">Step {step} of 4</p>
            </div>
          </div>
          <button
            onClick={() => setIsSetupWizardOpen(false)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Steps */}
        {step === 1 && (
          <div className="space-y-3.5 text-xs">
            <h4 className="font-bold text-slate-800 text-sm">
              Step 1: School Identity & Address
            </h4>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                School Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Principal / Head Teacher
              </label>
              <input
                type="text"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Address
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3.5 text-xs">
            <h4 className="font-bold text-slate-800 text-sm">
              Step 2: Academic Session & Current Term
            </h4>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Academic Session Name (e.g. 2026/2027)
              </label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Term Name (e.g. First Term)
              </label>
              <input
                type="text"
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Term Start Date
                </label>
                <input
                  type="date"
                  value={termStart}
                  onChange={(e) => setTermStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Term End Date
                </label>
                <input
                  type="date"
                  value={termEnd}
                  onChange={(e) => setTermEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3.5 text-xs">
            <h4 className="font-bold text-slate-800 text-sm">
              Step 3: Initial Class Streams & Arms
            </h4>
            <p className="text-slate-500">
              Provide comma-separated classes you want to bootstrap:
            </p>
            <div>
              <textarea
                rows={3}
                value={classArmList}
                onChange={(e) => setClassArmList(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
              />
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-slate-600 border border-slate-200">
              Example format: <code>JSS 1A, JSS 1B, JSS 2A, SS 1Science</code>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3.5 text-xs">
            <h4 className="font-bold text-slate-800 text-sm">
              Step 4: Confirm Dual-Session Register Configuration
            </h4>
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Ready to Activate Register System</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-slate-700">
                <li>School: {name}</li>
                <li>Session: {sessionName} ({termName})</li>
                <li>Dual Session Morning (\) + Afternoon (/) with V / OO marks</li>
                <li>Automatic school opening days calculation from calendar</li>
              </ul>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-2xs"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Complete Setup</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
