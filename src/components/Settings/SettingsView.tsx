// Settings View Component
import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Edit,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Info,
  MoreVertical,
  RefreshCw,
  Save,
  School,
  Settings,
  Shield,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { db } from '../../services/storage';
import { RegisterSymbolSettings, User, UserRole } from '../../types/attendance';
import { formatLocalDate } from '../../utils/dateUtils';

export const SettingsView: React.FC = () => {
  const {
    school,
    symbolSettings,
    allUsers,
    classes,
    students,
    currentUser,
    canManageSchool,
    openBulkOnboarding,
    addToast,
    refreshData,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<
    'SCHOOL' | 'SYMBOLS' | 'USERS' | 'ONBOARDING' | 'BACKUP'
  >('SCHOOL');

  // School form
  const [schoolName, setSchoolName] = useState(school.name);
  const [schoolAddress, setSchoolAddress] = useState(school.address);
  const [schoolPhone, setSchoolPhone] = useState(school.phone);
  const [schoolEmail, setSchoolEmail] = useState(school.email);
  const [principalName, setPrincipalName] = useState(school.principalName);
  const [morningStartTime, setMorningStartTime] = useState(school.morningStartTime || '08:00');
  const [morningLateCutoffTime, setMorningLateCutoffTime] = useState(school.morningLateCutoffTime || '08:15');
  const [afternoonStartTime, setAfternoonStartTime] = useState(school.afternoonStartTime || '13:00');
  const [afternoonLateCutoffTime, setAfternoonLateCutoffTime] = useState(school.afternoonLateCutoffTime || '13:15');

  // Symbols form
  const [symbols, setSymbols] = useState<RegisterSymbolSettings>(symbolSettings);

  // --- Add user modal ---
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('TEACHER');
  const [userAssignedClassIds, setUserAssignedClassIds] = useState<string[]>([]);
  const [showUserPassword, setShowUserPassword] = useState(false);

  // --- Edit user modal ---
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('TEACHER');
  const [editClassIds, setEditClassIds] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [editBusy, setEditBusy] = useState(false);

  // --- Reset password modal ---
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [resetPassword1, setResetPassword1] = useState('');
  const [resetPassword2, setResetPassword2] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  // --- Delete user modal ---
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  // --- Kebab menu ---
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    if (openMenuId) {
      document.addEventListener('mousedown', onClickOutside);
    }
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [openMenuId]);

  // Empty Database modal
  const [showEmptyDbModal, setShowEmptyDbModal] = useState(false);
  const [emptyDbConfirmText, setEmptyDbConfirmText] = useState('');
  const [emptyDbBusy, setEmptyDbBusy] = useState(false);

  // --- Save school details ---
  const handleSaveSchool = (e: React.FormEvent) => {
    e.preventDefault();
    db.updateSchool({
      name: schoolName.trim(),
      address: schoolAddress.trim(),
      phone: schoolPhone.trim(),
      email: schoolEmail.trim(),
      principalName: principalName.trim(),
      morningStartTime,
      morningLateCutoffTime,
      afternoonStartTime,
      afternoonLateCutoffTime,
    });
    addToast({
      type: 'success',
      title: 'School Updated',
      message: 'School profile details and session timings saved successfully.',
    });
    refreshData();
  };

  // Save Symbol Settings
  const handleSaveSymbols = (e: React.FormEvent) => {
    e.preventDefault();
    db.updateRegisterSymbols(symbols);
    addToast({
      type: 'success',
      title: 'Register Symbols Saved',
      message: 'Paper register presentation symbols updated.',
    });
    refreshData();
  };

  // --- Add User ---
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) return;
    if (userPassword.length < 10) {
      addToast({
        type: 'error',
        title: 'Password Too Short',
        message: 'Password must be at least 10 characters.',
      });
      return;
    }
    if (userRole === 'TEACHER' && userAssignedClassIds.length === 0) {
      addToast({
        type: 'error',
        title: 'Class Required',
        message: 'Teachers must be assigned to at least one class.',
      });
      return;
    }

    // Add to local cache
    db.addUser({
      name: userName.trim(),
      email: userEmail.trim(),
      role: userRole,
      schoolId: school.id,
      assignedClassIds: userAssignedClassIds,
    });

    // Also create server-side account so login works
    (async () => {
      try {
        const res = await fetch('/api/admin/accounts', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: userEmail.trim(),
            password: userPassword,
            name: userName.trim(),
            role: userRole,
            schoolId: userRole === 'SUPER_ADMIN' ? null : school.id,
            assignedClassIds: userAssignedClassIds,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Server rejected account creation');
        }
        addToast({
          type: 'success',
          title: 'User Created',
          message: `${userName} added as ${userRole.replace('_', ' ')}.`,
        });
        setShowAddUserModal(false);
        resetAddUserForm();
        refreshData();
      } catch (err: any) {
        addToast({
          type: 'error',
          title: 'Server Creation Failed',
          message: err.message || 'Local record created but login will not work until the server accepts it.',
        });
      }
    })();
  };

  const resetAddUserForm = () => {
    setUserName('');
    setUserEmail('');
    setUserPassword('');
    setUserRole('TEACHER');
    setUserAssignedClassIds([]);
    setShowUserPassword(false);
  };

  // --- Edit user ---
  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditClassIds(u.assignedClassIds || []);
    setEditActive(true);
    setOpenMenuId(null);
  };

  const handleSaveUserEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (editRole === 'TEACHER' && editClassIds.length === 0) {
      addToast({
        type: 'error',
        title: 'Class Required',
        message: 'Teachers must be assigned to at least one class.',
      });
      return;
    }

    setEditBusy(true);
    try {
      await db.updateUserOnServer(editingUser.id, {
        name: editName.trim(),
        role: editRole,
        assignedClassIds: editClassIds,
        active: editActive,
      });
      addToast({
        type: 'success',
        title: 'User Updated',
        message: `${editName} updated successfully.`,
      });
      setEditingUser(null);
      refreshData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Could not update user.',
      });
    } finally {
      setEditBusy(false);
    }
  };

  // --- Reset password ---
  const handleOpenResetPassword = (u: User) => {
    setResettingUser(u);
    setResetPassword1('');
    setResetPassword2('');
    setShowResetPassword(false);
    setOpenMenuId(null);
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    if (resetPassword1.length < 10) {
      addToast({
        type: 'error',
        title: 'Too Short',
        message: 'Password must be at least 10 characters.',
      });
      return;
    }
    if (resetPassword1 !== resetPassword2) {
      addToast({
        type: 'error',
        title: 'Mismatch',
        message: 'Passwords do not match.',
      });
      return;
    }

    setResetBusy(true);
    try {
      await db.resetUserPasswordOnServer(resettingUser.id, resetPassword1);
      addToast({
        type: 'success',
        title: 'Password Reset',
        message: `${resettingUser.name} must sign in with the new password.`,
      });
      setResettingUser(null);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Reset Failed',
        message: err.message || 'Could not reset password.',
      });
    } finally {
      setResetBusy(false);
    }
  };

  // --- Delete user ---
  const handleOpenDeleteUser = (u: User) => {
    if (u.id === currentUser.id) {
      addToast({
        type: 'error',
        title: 'Cannot Delete',
        message: 'You cannot delete your own account.',
      });
      return;
    }
    setDeletingUser(u);
    setDeleteConfirmText('');
    setOpenMenuId(null);
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    if (deleteConfirmText !== deletingUser.email) return;

    setDeleteBusy(true);
    try {
      await db.deleteUserOnServer(deletingUser.id);
      addToast({
        type: 'success',
        title: 'User Deleted',
        message: `${deletingUser.name} removed.`,
      });
      setDeletingUser(null);
      setDeleteConfirmText('');
      refreshData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Could not delete user.',
      });
    } finally {
      setDeleteBusy(false);
    }
  };

  // Export JSON backup
  const handleExportBackup = () => {
    const json = db.exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SmartRegister_Backup_${formatLocalDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({
      type: 'success',
      title: 'Backup Downloaded',
      message: 'Full register database backup saved as JSON.',
    });
  };

  // Import JSON backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const ok = db.importBackup(content);
      if (ok) {
        addToast({
          type: 'success',
          title: 'Database Restored',
          message: 'Database backup imported successfully.',
        });
        refreshData();
      } else {
        addToast({
          type: 'error',
          title: 'Import Failed',
          message: 'Invalid JSON backup format.',
        });
      }
    };
    reader.readAsText(file);
  };

  // Reset to seed data
  const handleResetData = () => {
    const ok = window.confirm(
      'Are you sure you want to reset all data back to the demo defaults? This will overwrite your current sessions, students, and attendance records.'
    );
    if (!ok) return;

    db.resetToSeedData();
    addToast({
      type: 'info',
      title: 'Database Reset',
      message: 'Restored original demo international school data.',
    });
    refreshData();
  };

  // Empty database
    const handleEmptyDatabase = async () => {
    setEmptyDbBusy(true);
    try {
      const res = await fetch('/api/admin/reset-empty', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }

      const body = await res.json().catch(() => ({}));

      // Clear the browser-side cache so the frontend does not re-upload
      // the old data on next page load (initializeServerStorage sees an
      // empty server and a non-empty localStorage, and imports the cache).
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i += 1) {
          const k = localStorage.key(i);
          if (k && k.startsWith('smart_register_')) keysToRemove.push(k);
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        localStorage.removeItem('__smart_register_flask_outbox_v1__');
      } catch (storageErr) {
        console.warn('Could not clear browser cache after reset:', storageErr);
      }

      addToast({
        type: 'success',
        title: 'Database Emptied',
        message: `All school data cleared. ${body.keysRemoved ?? 0} records removed. Reloading…`,
      });

      setTimeout(() => window.location.reload(), 900);
    } catch (err: any) {
      setEmptyDbBusy(false);
      addToast({
        type: 'error',
        title: 'Empty Failed',
        message: err.message || 'Could not empty the database.',
      });
    }
  };
  const toggleClassId = (
    classId: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  return (
    <div className="space-y-4">
      {/* Sub Tabs */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs flex flex-wrap gap-1">
        <button
          onClick={() => setActiveSubTab('SCHOOL')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeSubTab === 'SCHOOL'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <School className="w-3.5 h-3.5" />
          <span>School Profile</span>
        </button>

        <button
          onClick={() => setActiveSubTab('SYMBOLS')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeSubTab === 'SYMBOLS'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Register Symbols</span>
        </button>

        <button
          onClick={() => setActiveSubTab('USERS')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeSubTab === 'USERS'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Users & Roles</span>
        </button>

        <button
          onClick={() => setActiveSubTab('ONBOARDING')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeSubTab === 'ONBOARDING'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Bulk Onboarding</span>
        </button>

        <button
          onClick={() => setActiveSubTab('BACKUP')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeSubTab === 'BACKUP'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Database & Backup</span>
        </button>
      </div>

      {/* 1. SCHOOL PROFILE TAB */}
      {activeSubTab === 'SCHOOL' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 max-w-2xl">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              School Institution Profile
            </h3>
            <p className="text-xs text-slate-500">
              These details appear on official reports, terminal registers, and
              PDF export headers.
            </p>
          </div>

          <form onSubmit={handleSaveSchool} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                School Official Name
              </label>
              <input
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Principal / Head Teacher Name
              </label>
              <input
                type="text"
                required
                value={principalName}
                onChange={(e) => setPrincipalName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Official Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={schoolPhone}
                  onChange={(e) => setSchoolPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Official Email Address
                </label>
                <input
                  type="email"
                  required
                  value={schoolEmail}
                  onChange={(e) => setSchoolEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Physical Campus Address
              </label>
              <textarea
                rows={2}
                required
                value={schoolAddress}
                onChange={(e) => setSchoolAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none"
              />
            </div>

            <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-3">
              <div>
                <h4 className="font-bold text-amber-950 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Configurable School Start Time & Automated Late Flagging</span>
                </h4>
                <p className="text-[11px] text-amber-800/80 mt-0.5">
                  Students arriving after the specified start times are automatically flagged as LATE during attendance taking, updating their punctuality profile score.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-amber-900 mb-1 text-[11px]">
                    Morning Session Start Time
                  </label>
                  <input
                    type="time"
                    value={morningStartTime}
                    onChange={(e) => setMorningStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white font-mono text-xs text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-slate-400">Default: 08:00 AM</span>
                </div>

                <div>
                  <label className="block font-semibold text-amber-900 mb-1 text-[11px]">
                    Morning Late Cutoff Time
                  </label>
                  <input
                    type="time"
                    value={morningLateCutoffTime}
                    onChange={(e) => setMorningLateCutoffTime(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white font-mono text-xs text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-slate-400">Default: 08:15 AM</span>
                </div>

                <div>
                  <label className="block font-semibold text-amber-900 mb-1 text-[11px]">
                    Afternoon Session Start Time
                  </label>
                  <input
                    type="time"
                    value={afternoonStartTime}
                    onChange={(e) => setAfternoonStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white font-mono text-xs text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-slate-400">Default: 13:00 (1:00 PM)</span>
                </div>

                <div>
                  <label className="block font-semibold text-amber-900 mb-1 text-[11px]">
                    Afternoon Late Cutoff Time
                  </label>
                  <input
                    type="time"
                    value={afternoonLateCutoffTime}
                    onChange={(e) => setAfternoonLateCutoffTime(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white font-mono text-xs text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-slate-400">Default: 13:15 (1:15 PM)</span>
                </div>
              </div>
            </div>

            {canManageSchool() && (
              <div className="pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-2xs"
                >
                  Save School Profile
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* 2. REGISTER SYMBOLS SETTINGS TAB */}
      {activeSubTab === 'SYMBOLS' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 max-w-2xl">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Configurable Paper Register Symbols
            </h3>
            <p className="text-xs text-slate-500">
              Customize how attendance combinations appear on visual sheets and
              paper register views.
            </p>
          </div>

          <div className="p-3 bg-blue-50 rounded-xl text-blue-900 text-xs border border-blue-200 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <strong>Data Independence Guarantee:</strong> The database
              permanently stores the raw attendance state (PRESENT, ABSENT,
              EXCUSED, NOT_MARKED) and lateness. Changing these symbols adjusts
              only the presentation mark and will never alter or corrupt your
              attendance calculations.
            </div>
          </div>

          <form onSubmit={handleSaveSymbols} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Both Sessions Present (Default: V)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={symbols.bothPresent}
                  onChange={(e) =>
                    setSymbols({ ...symbols, bothPresent: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold text-center text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Both Sessions Absent (Default: OO)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={symbols.bothAbsent}
                  onChange={(e) =>
                    setSymbols({ ...symbols, bothAbsent: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold text-center text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Morning Present Only (Default: \)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={symbols.morningPresentOnly}
                  onChange={(e) =>
                    setSymbols({
                      ...symbols,
                      morningPresentOnly: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold text-center text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Afternoon Present Only (Default: /)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={symbols.afternoonPresentOnly}
                  onChange={(e) =>
                    setSymbols({
                      ...symbols,
                      afternoonPresentOnly: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold text-center text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Morning Present, Afternoon Absent (Default: \O)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={symbols.morningPresentAfternoonAbsent}
                  onChange={(e) =>
                    setSymbols({
                      ...symbols,
                      morningPresentAfternoonAbsent: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold text-center text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Morning Absent, Afternoon Present (Default: O/)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={symbols.morningAbsentAfternoonPresent}
                  onChange={(e) =>
                    setSymbols({
                      ...symbols,
                      morningAbsentAfternoonPresent: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold text-center text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Both Sessions Excused (Default: EE)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={symbols.bothExcused}
                  onChange={(e) =>
                    setSymbols({ ...symbols, bothExcused: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold text-center text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Not Marked Symbol (Default: —)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={symbols.notMarked}
                  onChange={(e) =>
                    setSymbols({ ...symbols, notMarked: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold text-center text-sm"
                />
              </div>
            </div>

            {canManageSchool() && (
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-2xs"
                >
                  Save Symbol Settings
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* 3. USERS & ROLES TAB */}
      {activeSubTab === 'USERS' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Staff & User Authorization
              </h3>
              <p className="text-xs text-slate-500">
                Manage roles (Super Admin, School Admin, Teacher, Viewer) and
                class assignments.
              </p>
            </div>
            {canManageSchool() && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openBulkOnboarding('TEACHERS')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-2xs transition-colors"
                  title="Bulk register teachers and staff via Excel/CSV spreadsheet"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Bulk Onboard Staff</span>
                </button>

                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add User</span>
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Assigned Class Arm</th>
                  <th className="py-2.5 px-3 w-12 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allUsers.map((u) => {
                  const assignedClasses = classes.filter((c) =>
                    u.assignedClassIds?.includes(c.id)
                  );
                  const isSelf = u.id === currentUser.id;
                  const isMenuOpen = openMenuId === u.id;

                  // Show class list only for teachers/viewers; admins get "Full School Access"
                  const showsClassScope = u.role === 'TEACHER' || u.role === 'VIEWER';
                  const classLabel = showsClassScope
                    ? assignedClasses.length > 0
                      ? assignedClasses.map((c) => `${c.name} ${c.arm}`).join(', ')
                      : '⚠ No class assigned'
                    : 'Full School Access / All';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          {u.name}
                          {isSelf && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">
                              YOU
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {u.email}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono">
                          {u.role}
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 ${showsClassScope && assignedClasses.length === 0 ? 'text-amber-700 font-semibold' : 'text-slate-700'}`}>
                        {classLabel}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {canManageSchool() && (
                          <div className="relative inline-block" ref={isMenuOpen ? menuRef : null}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(isMenuOpen ? null : u.id);
                              }}
                              className="p-1.5 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                              aria-label="Open actions menu"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {isMenuOpen && (
                              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-30 py-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditUser(u)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  <Edit className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Edit User</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenResetPassword(u)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Reset Password</span>
                                </button>

                                <div className="h-px bg-slate-100 my-1" />

                                <button
                                  type="button"
                                  disabled={isSelf}
                                  onClick={() => handleOpenDeleteUser(u)}
                                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                                    isSelf
                                      ? 'text-slate-300 cursor-not-allowed'
                                      : 'text-rose-700 hover:bg-rose-50'
                                  }`}
                                  title={isSelf ? 'You cannot delete your own account' : 'Delete this user'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete User</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. ONBOARDING & REGISTRATION HUB TAB */}
      {activeSubTab === 'ONBOARDING' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Bulk School Onboarding & Roster Registration
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Streamlined ingestion of large student cohorts and teacher authorization records via Excel, CSV, or spreadsheet pasting.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Batch Processor v2.0 Ready
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {students.length} on roll
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Bulk Student Onboarding
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Enroll entire streams or incoming classes at once. Supports automated admission numbering, gender allocation, parent contact capture, and target arm assignment.
                  </p>
                </div>

                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5 text-xs text-emerald-950">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Included Validations:</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-emerald-800 space-y-0.5 ml-1">
                    <li>Admission number uniqueness against database</li>
                    <li>Automatic class & arm resolution (e.g. JSS 1 A)</li>
                    <li>Duplicate detection within uploaded spreadsheet</li>
                  </ul>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => openBulkOnboarding('STUDENTS')}
                  className="flex-1 py-2 px-3 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Launch Student Onboarding</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {allUsers.length} staff
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Bulk Teacher & Staff Onboarding
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Register form masters, subject teachers, and administrators. Auto-links newly onboarded teachers directly as Form Masters for their assigned class arms.
                  </p>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5 text-xs text-blue-950">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Included Validations:</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-blue-800 space-y-0.5 ml-1">
                    <li>Valid institutional email syntax & uniqueness</li>
                    <li>Role assignment (Teacher, School Admin, Viewer)</li>
                    <li>Multiple assigned class arms linking</li>
                  </ul>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => openBulkOnboarding('TEACHERS')}
                  className="flex-1 py-2 px-3 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5 text-blue-400" />
                  <span>Launch Staff Onboarding</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. DATABASE & BACKUP TAB */}
      {activeSubTab === 'BACKUP' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 max-w-2xl">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Database Backup & Disaster Recovery
            </h3>
            <p className="text-xs text-slate-500">
              Export complete school database snapshots, restore backups, or
              reset sample data.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Export JSON Database Snapshot
                </div>
                <div className="text-[11px] text-slate-500">
                  Exports students, classes, attendance records, calendar days,
                  and audit trails.
                </div>
              </div>
              <button
                onClick={handleExportBackup}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Backup</span>
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Restore From JSON Backup
                </div>
                <div className="text-[11px] text-slate-500">
                  Upload a previously exported backup file to restore records.
                </div>
              </div>
              <label className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs shrink-0 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Import JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>

            <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-rose-900">
                  Reset to Demo International School
                </div>
                <div className="text-[11px] text-rose-700">
                  Resets the database back to clean verified sample data with 20+
                  students and attendance records.
                </div>
              </div>
              <button
                onClick={handleResetData}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Demo Data</span>
              </button>
            </div>

            <div className="p-4 bg-rose-100/50 rounded-xl border-2 border-rose-300 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                  <span>Empty Database (Keep Logins Only)</span>
                </div>
                <div className="text-[11px] text-rose-700 mt-0.5">
                  Deletes classes, students, attendance, calendar, sessions,
                  terms, and report cards. Login accounts are preserved. You'll
                  be sent through the Setup Wizard on next load.
                </div>
              </div>
              <button
                onClick={() => {
                  setEmptyDbConfirmText('');
                  setShowEmptyDbModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-2xs shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Empty Database</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white max-w-md w-full rounded-2xl p-5 shadow-xl border border-slate-200 space-y-3 text-xs my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Add Staff User</h3>
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  resetAddUserForm();
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mrs. Mary Johnson"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email (login username) *
                </label>
                <input
                  type="email"
                  required
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Initial Password * (min 10 chars)
                </label>
                <div className="relative">
                  <input
                    type={showUserPassword ? 'text' : 'password'}
                    required
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUserPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Role *
                </label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="TEACHER">Teacher</option>
                  <option value="SCHOOL_ADMIN">School Admin</option>
                  <option value="VIEWER">Viewer (Read-Only)</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>

              {(userRole === 'TEACHER' || userRole === 'VIEWER') && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Assigned Classes {userRole === 'TEACHER' ? '*' : '(optional)'}
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50/40">
                    {classes.length === 0 ? (
                      <div className="text-slate-400 italic text-[11px] p-1">
                        No classes defined yet.
                      </div>
                    ) : (
                      classes.map((c) => {
                        const checked = userAssignedClassIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleClassId(c.id, setUserAssignedClassIds)}
                              className="w-3.5 h-3.5 accent-emerald-600"
                            />
                            <span className="text-xs text-slate-800">
                              {c.name} {c.arm}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  {userRole === 'TEACHER' && userAssignedClassIds.length === 0 && (
                    <div className="text-[10px] text-rose-600 mt-1 font-semibold">
                      Teachers must be assigned to at least one class.
                    </div>
                  )}
                </div>
              )}

              {(userRole === 'SUPER_ADMIN' || userRole === 'SCHOOL_ADMIN') && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-900">
                  {userRole === 'SUPER_ADMIN' ? 'Super Admin' : 'School Admin'} roles have full school access. No class scoping required.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUserModal(false);
                    resetAddUserForm();
                  }}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 text-white font-bold rounded-lg"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white max-w-md w-full rounded-2xl p-5 shadow-xl border border-slate-200 space-y-3 text-xs my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit User</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {editingUser.email}
                </p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUserEdits} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email (login username)
                </label>
                <input
                  type="email"
                  value={editEmail}
                  disabled
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono bg-slate-50 text-slate-500 cursor-not-allowed"
                />
                <div className="text-[10px] text-slate-400 mt-1">
                  Email cannot be changed after account creation (it is the login username).
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Role *
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="TEACHER">Teacher</option>
                  <option value="SCHOOL_ADMIN">School Admin</option>
                  <option value="VIEWER">Viewer (Read-Only)</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>

              {(editRole === 'TEACHER' || editRole === 'VIEWER') && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Assigned Classes {editRole === 'TEACHER' ? '*' : '(optional)'}
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50/40">
                    {classes.length === 0 ? (
                      <div className="text-slate-400 italic text-[11px] p-1">
                        No classes defined yet.
                      </div>
                    ) : (
                      classes.map((c) => {
                        const checked = editClassIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleClassId(c.id, setEditClassIds)}
                              className="w-3.5 h-3.5 accent-emerald-600"
                            />
                            <span className="text-xs text-slate-800">
                              {c.name} {c.arm}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  {editRole === 'TEACHER' && editClassIds.length === 0 && (
                    <div className="text-[10px] text-rose-600 mt-1 font-semibold">
                      Teachers must be assigned to at least one class.
                    </div>
                  )}
                </div>
              )}

              {(editRole === 'SUPER_ADMIN' || editRole === 'SCHOOL_ADMIN') && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-900">
                  Full school access granted by this role. No class scoping required.
                </div>
              )}

              <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span className="text-xs font-semibold text-slate-800">
                  Account is active (unchecking prevents login)
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  disabled={editBusy}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editBusy}
                  className="px-4 py-1.5 bg-slate-900 text-white font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                >
                  {editBusy && (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-5 shadow-xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Reset Password</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  for {resettingUser.name}
                </p>
              </div>
              <button
                onClick={() => setResettingUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmResetPassword} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  New Password (min 10 chars) *
                </label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    value={resetPassword1}
                    onChange={(e) => setResetPassword1(e.target.value)}
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  required
                  value={resetPassword2}
                  onChange={(e) => setResetPassword2(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                {resetPassword1 && resetPassword2 && resetPassword1 !== resetPassword2 && (
                  <div className="text-[10px] text-rose-600 mt-1 font-semibold">
                    Passwords do not match.
                  </div>
                )}
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                <strong>Heads up:</strong> The user's old password stops working
                immediately. Notify them of the new password out-of-band.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  disabled={resetBusy}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    resetBusy ||
                    resetPassword1.length < 10 ||
                    resetPassword1 !== resetPassword2
                  }
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {resetBusy && (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Reset Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">Delete User?</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {deletingUser.name}
                </p>
                <p className="text-[11px] font-mono text-slate-600 mt-0.5">
                  {deletingUser.email}
                </p>
              </div>
              <button
                onClick={() => {
                  setDeletingUser(null);
                  setDeleteConfirmText('');
                }}
                disabled={deleteBusy}
                className="text-slate-400 hover:text-slate-600 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-900 leading-snug">
              <strong>Permanent removal.</strong> Their account, login
              credentials, and any assignments will be deleted. Their attendance
              records created as staff will not be affected.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Type the email{' '}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-rose-700">
                  {deletingUser.email}
                </code>{' '}
                to confirm:
              </label>
              <input
                type="text"
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                disabled={deleteBusy}
                placeholder={deletingUser.email}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:opacity-50"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setDeletingUser(null);
                  setDeleteConfirmText('');
                }}
                disabled={deleteBusy}
                className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy || deleteConfirmText !== deletingUser.email}
                onClick={handleConfirmDeleteUser}
                className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {deleteBusy && (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete User</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty Database Confirmation Modal */}
      {showEmptyDbModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  Empty Entire Database?
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  All classes, students, attendance records, calendar events,
                  sessions, terms, assessment scores, and report cards will be
                  permanently deleted from the server.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEmptyDbModal(false);
                  setEmptyDbConfirmText('');
                }}
                className="text-slate-400 hover:text-slate-600 shrink-0"
                disabled={emptyDbBusy}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-900 leading-snug">
              <strong>Preserved:</strong> Login accounts (Super Admin + demo
              users) and the current session. You will remain logged in.
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 leading-snug">
              <strong>Heads up:</strong> This cannot be undone. Consider
              exporting a JSON backup first using the button above.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Type{' '}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-rose-700">
                  EMPTY
                </code>{' '}
                to confirm:
              </label>
              <input
                type="text"
                autoFocus
                value={emptyDbConfirmText}
                onChange={(e) => setEmptyDbConfirmText(e.target.value)}
                placeholder="EMPTY"
                disabled={emptyDbBusy}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowEmptyDbModal(false);
                  setEmptyDbConfirmText('');
                }}
                disabled={emptyDbBusy}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={emptyDbBusy || emptyDbConfirmText !== 'EMPTY'}
                onClick={handleEmptyDatabase}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {emptyDbBusy ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Emptying…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Empty Database</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};