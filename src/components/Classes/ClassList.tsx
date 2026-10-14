// Classes and Arms Management
import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Edit,
  FileSpreadsheet,
  Plus,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { db } from '../../services/storage';
import { SchoolClass } from '../../types/attendance';

export const ClassList: React.FC = () => {
  const {
    classes,
    permittedClasses,
    students,
    allUsers,
    currentUser,
    currentSession,
    setSelectedClassId,
    setActiveTab,
    canManageSchool,
    openBulkOnboarding,
    addToast,
    refreshData,
  } = useApp();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);

  // Delete modal state
  const [deletingClass, setDeletingClass] = useState<SchoolClass | null>(null);
  const [reassignTo, setReassignTo] = useState<string>('');

  const displayClasses = currentUser.role === 'TEACHER' ? permittedClasses : classes;

  const [formName, setFormName] = useState('JSS 1');
  const [formArm, setFormArm] = useState('C');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [formCapacity, setFormCapacity] = useState('45');

  const teachers = allUsers.filter(
    (u) => u.role === 'TEACHER' || u.role === 'SCHOOL_ADMIN'
  );

  // -- Handlers ------------------------------------------------------------

  const handleOpenAdd = () => {
    setFormName('JSS 1');
    setFormArm('C');
    setFormTeacherId(teachers[0]?.id || '');
    setFormCapacity('45');
    setEditingClass(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (cls: SchoolClass) => {
    setEditingClass(cls);
    setFormName(cls.name);
    setFormArm(cls.arm);
    setFormTeacherId(cls.teacherId || '');
    setFormCapacity(cls.capacity?.toString() || '45');
    setShowAddModal(true);
  };

  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formArm.trim()) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Class name and Arm are required.',
      });
      return;
    }

    if (editingClass) {
      db.updateClass(editingClass.id, {
        name: formName.trim(),
        arm: formArm.trim(),
        teacherId: formTeacherId || undefined,
        capacity: parseInt(formCapacity, 10) || 45,
      });
      addToast({
        type: 'success',
        title: 'Class Updated',
        message: `${formName} ${formArm} updated successfully.`,
      });
    } else {
      db.addClass({
        schoolId: 'school_demo_1',
        name: formName.trim(),
        arm: formArm.trim(),
        sessionId: currentSession?.id || 'session_2026_2027',
        teacherId: formTeacherId || undefined,
        capacity: parseInt(formCapacity, 10) || 45,
        status: 'ACTIVE',
      });
      addToast({
        type: 'success',
        title: 'Class Created',
        message: `${formName} ${formArm} arm added to register.`,
      });
    }

    setShowAddModal(false);
    setEditingClass(null);
    refreshData();
  };

  const handleOpenDelete = (cls: SchoolClass) => {
    setDeletingClass(cls);
    setReassignTo('');
  };

  const handleConfirmDelete = () => {
    if (!deletingClass) return;

    const classStudents = students.filter(
      (s) => s.classId === deletingClass.id && s.status === 'ACTIVE'
    );

    // Safety: cannot delete the last class
    if (displayClasses.length <= 1) {
      addToast({
        type: 'error',
        title: 'Cannot Delete',
        message: 'You must keep at least one class in the register.',
      });
      return;
    }

    // If there are students and no reassignment target chosen, block
    if (classStudents.length > 0 && !reassignTo) {
      addToast({
        type: 'error',
        title: 'Reassignment Required',
        message: `Move the ${classStudents.length} student(s) to another class first.`,
      });
      return;
    }

    try {
      // 1. Reassign students if any
      if (classStudents.length > 0 && reassignTo) {
        const targetClass = classes.find((c) => c.id === reassignTo);
        classStudents.forEach((s) => {
          db.updateStudent(s.id, {
            classId: reassignTo,
            arm: targetClass?.arm || s.arm,
          });
        });
      }

      // 2. Delete the class
      const ok = db.removeClass(deletingClass.id);
      if (!ok) {
        throw new Error('Class not found in storage.');
      }

      addToast({
        type: 'success',
        title: 'Class Deleted',
        message: classStudents.length > 0
          ? `${deletingClass.name} ${deletingClass.arm} deleted. ${classStudents.length} student(s) moved to ${classes.find((c) => c.id === reassignTo)?.name} ${classes.find((c) => c.id === reassignTo)?.arm}.`
          : `${deletingClass.name} ${deletingClass.arm} removed from register.`,
      });

      setDeletingClass(null);
      setReassignTo('');
      refreshData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Could not delete the class.',
      });
    }
  };

  // -- Render --------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Class Stream &amp; Arm Roster
          </h2>
          <p className="text-xs text-slate-500">
            Configure classes, arm streams, assigned form teachers, and capacities.
          </p>
        </div>

        {canManageSchool() && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => openBulkOnboarding('STUDENTS')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs transition-colors"
              title="Bulk onboard student rosters to classes via Excel or CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Bulk Onboard Students</span>
              <span className="sm:hidden">Bulk</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Class Arm</span>
            </button>
          </div>
        )}
      </div>

      {/* Class Cards Grid */}
      {displayClasses.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
          No classes assigned to your user account.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayClasses.map((cls) => {
            const classStudents = students.filter(
              (s) => s.classId === cls.id && s.status === 'ACTIVE'
            );
            const boys = classStudents.filter((s) => s.gender === 'MALE').length;
            const girls = classStudents.filter((s) => s.gender === 'FEMALE').length;
            const teacher = allUsers.find((u) => u.id === cls.teacherId);
            const isMyAssignedClass =
              currentUser.role === 'TEACHER' &&
              (currentUser.assignedClassIds?.includes(cls.id) ||
                cls.teacherId === currentUser.id);

            return (
              <div
                key={cls.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 hover:border-slate-300 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 truncate">
                        {cls.name} {cls.arm}
                      </h3>
                      {isMyAssignedClass ? (
                        <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                          My Class
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Academic Year: {currentSession?.name || '2026/2027'}
                    </div>
                  </div>

                  {canManageSchool() && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(cls)}
                        className="p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        title="Edit class"
                        aria-label="Edit class"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenDelete(cls)}
                        className="p-1.5 rounded text-slate-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                        title="Delete class"
                        aria-label="Delete class"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <div className="text-slate-400 text-[10px] font-sans">
                      Enrolled on Roll
                    </div>
                    <div className="text-base font-bold text-slate-900 mt-0.5">
                      {classStudents.length} / {cls.capacity || 45}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px] font-sans">
                      Gender Distribution
                    </div>
                    <div className="text-xs font-semibold text-slate-700 mt-1">
                      <span className="text-blue-600 font-bold">{boys} Boys</span>
                      {' · '}
                      <span className="text-pink-600 font-bold">{girls} Girls</span>
                    </div>
                  </div>
                </div>

                {/* Form Teacher */}
                <div className="text-xs text-slate-600 flex items-center justify-between pt-1">
                  <span className="text-slate-400">Form Master:</span>
                  <span className="font-semibold text-slate-900 truncate ml-2">
                    {teacher?.name || 'Unassigned'}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setSelectedClassId(cls.id);
                      setActiveTab('take-attendance');
                    }}
                    className="flex-1 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg text-center transition-colors shadow-2xs"
                  >
                    Daily Attendance
                  </button>
                  {canManageSchool() && (
                    <button
                      onClick={() => openBulkOnboarding('STUDENTS', cls.id)}
                      className="px-2.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1"
                      title={`Bulk enroll students into ${cls.name} ${cls.arm}`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Bulk</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedClassId(cls.id);
                      setActiveTab('paper-register');
                    }}
                    className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    title="View Paper Register"
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Add / Edit Class Modal ───────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900">
                {editingClass ? 'Edit Class Arm' : 'Add New Class Arm'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingClass(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClass} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Class Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. JSS 1, Primary 4, SS 2"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Arm / Stream Letter *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. A, B, Gold, Diamond"
                  value={formArm}
                  onChange={(e) => setFormArm(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assigned Form Teacher
                </label>
                <select
                  value={formTeacherId}
                  onChange={(e) => setFormTeacherId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="">-- No Teacher Assigned --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Class Capacity (Students)
                </label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={formCapacity}
                  onChange={(e) => setFormCapacity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingClass(null);
                  }}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold transition-colors"
                >
                  {editingClass ? 'Save Changes' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ────────────────────────────────── */}
      {deletingClass && (() => {
        const classStudents = students.filter(
          (s) => s.classId === deletingClass.id && s.status === 'ACTIVE'
        );
        const hasStudents = classStudents.length > 0;
        const otherClasses = classes.filter(
          (c) => c.id !== deletingClass.id && c.status === 'ACTIVE'
        );
        const canDelete = !hasStudents || Boolean(reassignTo);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white max-w-md w-full rounded-2xl p-5 shadow-xl border border-slate-200 space-y-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">
                    Delete {deletingClass.name} {deletingClass.arm}?
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    This action cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setDeletingClass(null);
                    setReassignTo('');
                  }}
                  className="text-slate-400 hover:text-slate-600 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              {hasStudents ? (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
                    <strong>This class has {classStudents.length} enrolled student{classStudents.length === 1 ? '' : 's'}.</strong>{' '}
                    They must be moved to another class before you can delete this one.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Move students to:
                    </label>
                    <select
                      value={reassignTo}
                      onChange={(e) => setReassignTo(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white"
                    >
                      <option value="">-- Select destination class --</option>
                      {otherClasses.map((c) => {
                        const count = students.filter(
                          (s) => s.classId === c.id && s.status === 'ACTIVE'
                        ).length;
                        return (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.arm} ({count} students)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="text-[11px] text-slate-500 leading-snug">
                    Reassignment preserves each student's history. Their past
                    attendance and assessment records will not be affected.
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed">
                  This class has no enrolled students. It can be deleted safely.
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setDeletingClass(null);
                    setReassignTo('');
                  }}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canDelete}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Class</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};