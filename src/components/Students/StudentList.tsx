// Student Management and Movement
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  Award,
  Check,
  CheckSquare,
  Clock,
  Edit,
  Eye,
  FileSpreadsheet,
  FolderInput,
  LogOut,
  MoreVertical,
  Search,
  Square,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { db } from '../../services/storage';
import { Gender, Student } from '../../types/attendance';
import {
  calculateStudentAttendanceSummary,
  getSchoolDaysInRange,
} from '../../utils/calculationEngine';
import { formatLocalDate } from '../../utils/dateUtils';

export const StudentList: React.FC = () => {
  const {
    school,
    classes,
    permittedClasses,
    students,
    permittedStudents,
    currentTerm,
    calendarDays,
    attendanceRecords,
    currentUser,
    canManageSchool,
    openBulkOnboarding,
    addToast,
    refreshData,
  } = useApp();

  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ACTIVE');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [movementStudent, setMovementStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);

  // Withdraw modal state
  const [withdrawStudentTarget, setWithdrawStudentTarget] = useState<Student | null>(null);
  const [withdrawDate, setWithdrawDate] = useState('2026-09-29');
  const [withdrawReason, setWithdrawReason] = useState('');

  // Hard-delete modal state
  const [hardDeleteStudent, setHardDeleteStudent] = useState<Student | null>(null);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState('');

  // Row action menu (kebab)
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

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk action modal state
  const [bulkAction, setBulkAction] = useState<null | 'withdraw' | 'change-class' | 'delete'>(null);
  const [bulkWithdrawDate, setBulkWithdrawDate] = useState('');
  const [bulkWithdrawReason, setBulkWithdrawReason] = useState('');
  const [bulkClassTarget, setBulkClassTarget] = useState<string>('');
  const [bulkClassReason, setBulkClassReason] = useState('');
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState('');

  // Clear selection whenever filters change (avoids operating on hidden rows)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterClass, filterStatus, search]);

  // New Student Form State
  const [formAdmissionNumber, setFormAdmissionNumber] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formMiddleName, setFormMiddleName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formGender, setFormGender] = useState<Gender>('MALE');
  const [formClassId, setFormClassId] = useState(
    permittedClasses[0]?.id || classes[0]?.id || ''
  );
  const [formDateOfAdmission, setFormDateOfAdmission] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [formDateOfBirth, setFormDateOfBirth] = useState('2014-01-01');
  const [formParentName, setFormParentName] = useState('');
  const [formParentPhone, setFormParentPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Movement Form State
  const [movementType, setMovementType] = useState<
    'CLASS_TRANSFER' | 'ARM_TRANSFER' | 'PROMOTION' | 'WITHDRAWAL' | 'GRADUATION'
  >('CLASS_TRANSFER');
  const [movementToClassId, setMovementToClassId] = useState<string>(
    permittedClasses[0]?.id || classes[0]?.id || ''
  );
  const [movementDate, setMovementDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [movementReason, setMovementReason] = useState('');

  // Filtered Students (strictly within permittedStudents)
  const filteredStudents = useMemo(() => {
    return permittedStudents.filter((s) => {
      if (filterClass !== 'ALL' && s.classId !== filterClass) return false;
      if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const fullName = `${s.firstName} ${s.middleName || ''} ${s.lastName}`.toLowerCase();
        const adm = s.admissionNumber.toLowerCase();
        return fullName.includes(q) || adm.includes(q);
      }
      return true;
    });
  }, [permittedStudents, filterClass, filterStatus, search]);

  // Open add modal
  const handleOpenAdd = () => {
    setFormAdmissionNumber(`DIS/2026/${(students.length + 1).toString().padStart(3, '0')}`);
    setFormFirstName('');
    setFormMiddleName('');
    setFormLastName('');
    setFormGender('MALE');
    setFormClassId(classes[0]?.id || '');
    setFormDateOfAdmission((() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })());
    setFormDateOfBirth('2014-01-01');
    setFormParentName('');
    setFormParentPhone('');
    setFormAddress('');
    setFormNotes('');
    setShowAddModal(true);
  };

  // Save new student
  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAdmissionNumber.trim() || !formFirstName.trim() || !formLastName.trim()) {
      addToast({
        type: 'error',
        title: 'Validation Error',
        message: 'Admission number, first name, and last name are required.',
      });
      return;
    }

    const targetClass = classes.find((c) => c.id === formClassId);

    try {
      if (editingStudent) {
        db.updateStudent(editingStudent.id, {
          admissionNumber: formAdmissionNumber.trim(),
          firstName: formFirstName.trim(),
          middleName: formMiddleName.trim() || undefined,
          lastName: formLastName.trim(),
          gender: formGender,
          classId: formClassId,
          arm: targetClass?.arm || 'A',
          dateOfAdmission: formDateOfAdmission,
          dateOfBirth: formDateOfBirth || undefined,
          parentName: formParentName.trim() || undefined,
          parentPhone: formParentPhone.trim() || undefined,
          address: formAddress.trim() || undefined,
          notes: formNotes.trim() || undefined,
        });
        addToast({
          type: 'success',
          title: 'Student Updated',
          message: `${formFirstName} ${formLastName}'s record was updated.`,
        });
      } else {
        db.addStudent({
          schoolId: 'school_demo_1',
          admissionNumber: formAdmissionNumber.trim(),
          firstName: formFirstName.trim(),
          middleName: formMiddleName.trim() || undefined,
          lastName: formLastName.trim(),
          gender: formGender,
          classId: formClassId,
          arm: targetClass?.arm || 'A',
          dateOfAdmission: formDateOfAdmission,
          dateOfBirth: formDateOfBirth || undefined,
          status: 'ACTIVE',
          parentName: formParentName.trim() || undefined,
          parentPhone: formParentPhone.trim() || undefined,
          address: formAddress.trim() || undefined,
          notes: formNotes.trim() || undefined,
        });
        addToast({
          type: 'success',
          title: 'Student Enrolled',
          message: `Enrolled ${formFirstName} ${formLastName} into ${targetClass?.name} ${targetClass?.arm}.`,
        });
      }

      setShowAddModal(false);
      setEditingStudent(null);
      refreshData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Error',
        message: err.message || 'Could not save student.',
      });
    }
  };

  // Submit student movement
  const handleProcessMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementStudent) return;

    const toClass = classes.find((c) => c.id === movementToClassId);

    db.moveStudent({
      studentId: movementStudent.id,
      type: movementType,
      effectiveDate: movementDate,
      toClassId: movementToClassId,
      toArm: toClass?.arm,
      reason: movementReason.trim() || `${movementType.replace('_', ' ')} processed`,
      recordedBy: currentUser.name,
    });

    addToast({
      type: 'success',
      title: 'Movement Recorded',
      message: `${movementType.replace('_', ' ')} processed for ${movementStudent.firstName} ${movementStudent.lastName}.`,
    });

    setMovementStudent(null);
    refreshData();
  };

  // Open edit modal for a student
  const handleOpenEdit = (s: Student) => {
    setEditingStudent(s);
    setFormAdmissionNumber(s.admissionNumber);
    setFormFirstName(s.firstName);
    setFormMiddleName(s.middleName || '');
    setFormLastName(s.lastName);
    setFormGender(s.gender);
    setFormClassId(s.classId);
    setFormDateOfAdmission(s.dateOfAdmission);
    setFormDateOfBirth(s.dateOfBirth || '');
    setFormParentName(s.parentName || '');
    setFormParentPhone(s.parentPhone || '');
    setFormAddress(s.address || '');
    setFormNotes(s.notes || '');
    setShowAddModal(true);
    setOpenMenuId(null);
  };

  // Open withdraw modal
  const handleOpenWithdraw = (s: Student) => {
    setWithdrawStudentTarget(s);
    setWithdrawDate(formatLocalDate(new Date()));
    setWithdrawReason('');
    setOpenMenuId(null);
  };

  // Submit withdrawal (soft delete)
  const handleConfirmWithdraw = () => {
    if (!withdrawStudentTarget) return;

    const ok = db.withdrawStudent(
      withdrawStudentTarget.id,
      withdrawDate,
      withdrawReason.trim() || `Withdrawal effective ${withdrawDate}`,
      currentUser.name
    );

    if (ok) {
      addToast({
        type: 'warning',
        title: 'Student Withdrawn',
        message: `${withdrawStudentTarget.firstName} ${withdrawStudentTarget.lastName} marked as WITHDRAWN effective ${withdrawDate}. All history preserved.`,
      });
      setWithdrawStudentTarget(null);
      setWithdrawReason('');
      refreshData();
    } else {
      addToast({
        type: 'error',
        title: 'Withdrawal Failed',
        message: 'Student record not found.',
      });
    }
  };

  // Open hard-delete modal
  const handleOpenHardDelete = (s: Student) => {
    setHardDeleteStudent(s);
    setHardDeleteConfirm('');
    setOpenMenuId(null);
  };

  // Submit hard delete
  const handleConfirmHardDelete = () => {
    if (!hardDeleteStudent) return;
    if (hardDeleteConfirm !== hardDeleteStudent.admissionNumber) return;

    const result = db.removeStudent(hardDeleteStudent.id);
    const r = result.removed;

    if (r.student) {
      addToast({
        type: 'error',
        title: 'Student Permanently Deleted',
        message: `${hardDeleteStudent.firstName} ${hardDeleteStudent.lastName} removed. Cascade: ${r.attendance} attendance, ${r.scores} scores, ${r.reportCards} report cards, ${r.movements} movements deleted.`,
      });
      setHardDeleteStudent(null);
      setHardDeleteConfirm('');
      refreshData();
    } else {
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Student record not found.',
      });
    }
  };

  // Live cascade preview for the hard-delete modal
  const hardDeletePreview = useMemo(() => {
    if (!hardDeleteStudent) return { attendance: 0, scores: 0, cards: 0, movements: 0 };
    const id = hardDeleteStudent.id;
    return {
      attendance: attendanceRecords.filter((r) => r.studentId === id).length,
      scores: db.getAssessmentScores().filter((sc) => sc.studentId === id).length,
      cards: db.getReportCards().filter((rc) => rc.studentId === id).length,
      movements: db.getStudentMovements(id).length,
    };
  }, [hardDeleteStudent, attendanceRecords]);

  // --- Bulk selection helpers ---

  const allVisibleSelected = useMemo(() => {
    if (filteredStudents.length === 0) return false;
    return filteredStudents.every((s) => selectedIds.has(s.id));
  }, [filteredStudents, selectedIds]);

  const someVisibleSelected = useMemo(() => {
    return filteredStudents.some((s) => selectedIds.has(s.id));
  }, [filteredStudents, selectedIds]);

  const toggleSelectAllVisible = () => {
    const next = new Set(selectedIds);
    if (allVisibleSelected) {
      filteredStudents.forEach((s) => next.delete(s.id));
    } else {
      filteredStudents.forEach((s) => next.add(s.id));
    }
    setSelectedIds(next);
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const clearSelection = () => setSelectedIds(new Set());

  // --- Bulk action handlers ---

  const openBulkModal = (action: 'withdraw' | 'change-class' | 'delete') => {
    setBulkAction(action);
    if (action === 'withdraw') {
      setBulkWithdrawDate(formatLocalDate(new Date()));
      setBulkWithdrawReason('');
    } else if (action === 'change-class') {
      setBulkClassTarget('');
      setBulkClassReason('');
    } else {
      setBulkDeleteConfirm('');
    }
    setOpenMenuId(null);
  };

  const closeBulkModal = () => {
    setBulkAction(null);
    setBulkDeleteConfirm('');
    setBulkWithdrawReason('');
    setBulkClassReason('');
  };

  const handleConfirmBulkWithdraw = () => {
    if (!bulkWithdrawDate) return;
    const result = db.bulkWithdrawStudents(
      Array.from(selectedIds),
      bulkWithdrawDate,
      bulkWithdrawReason.trim() || `Bulk withdrawal effective ${bulkWithdrawDate}`,
      currentUser.name
    );
    addToast({
      type: 'warning',
      title: 'Bulk Withdrawal Complete',
      message: `${result.withdrawn} student${result.withdrawn === 1 ? '' : 's'} marked WITHDRAWN effective ${bulkWithdrawDate}.${
        result.skipped.length > 0 ? ` (${result.skipped.length} already withdrawn)` : ''
      }`,
    });
    clearSelection();
    closeBulkModal();
    refreshData();
  };

  const handleConfirmBulkChangeClass = () => {
    if (!bulkClassTarget) return;
    const targetClass = classes.find((c) => c.id === bulkClassTarget);
    if (!targetClass) return;
    const result = db.bulkChangeClass(
      Array.from(selectedIds),
      bulkClassTarget,
      targetClass.arm,
      bulkClassReason.trim() || `Bulk transfer to ${targetClass.name} ${targetClass.arm}`,
      currentUser.name
    );
    addToast({
      type: 'success',
      title: 'Bulk Class Transfer Complete',
      message: `${result.changed} student${result.changed === 1 ? '' : 's'} moved to ${targetClass.name} ${targetClass.arm}.${
        result.skipped.length > 0 ? ` (${result.skipped.length} already in target class)` : ''
      }`,
    });
    clearSelection();
    closeBulkModal();
    refreshData();
  };

  const handleConfirmBulkDelete = () => {
    const expected = `DELETE ${selectedIds.size}`;
    if (bulkDeleteConfirm !== expected) return;
    const result = db.bulkRemoveStudents(Array.from(selectedIds));
    const r = result.removed;
    addToast({
      type: 'error',
      title: 'Bulk Delete Complete',
      message: `${r.students} student${r.students === 1 ? '' : 's'} removed. Cascade: ${r.attendance} attendance, ${r.scores} scores, ${r.reportCards} report cards, ${r.movements} movements deleted.`,
    });
    clearSelection();
    closeBulkModal();
    refreshData();
  };

  const bulkDeletePreview = useMemo(() => {
    if (selectedIds.size === 0) {
      return { attendance: 0, scores: 0, cards: 0, movements: 0 };
    }
    const scores = db.getAssessmentScores();
    const cards = db.getReportCards();
    let attendanceCount = 0;
    let scoresCount = 0;
    let cardsCount = 0;
    let movementsCount = 0;
    selectedIds.forEach((id) => {
      attendanceCount += attendanceRecords.filter((r) => r.studentId === id).length;
      scoresCount += scores.filter((sc) => sc.studentId === id).length;
      cardsCount += cards.filter((rc) => rc.studentId === id).length;
      movementsCount += db.getStudentMovements(id).length;
    });
    return { attendance: attendanceCount, scores: scoresCount, cards: cardsCount, movements: movementsCount };
  }, [selectedIds, attendanceRecords]);

  return (
    <div className="space-y-4">
      {/* Teacher Assigned Roster Banner */}
      {currentUser.role === 'TEACHER' && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Teacher Scope Active:</strong> Viewing {permittedStudents.length} student
              {permittedStudents.length === 1 ? '' : 's'} assigned to your class arm (
              {permittedClasses.map((c) => `${c.name} ${c.arm}`).join(', ') || 'None'}).
            </span>
          </div>
        </div>
      )}

      {/* Top Filter and Add Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or admission number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {/* Class Filter */}
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none"
          >
            {currentUser.role !== 'TEACHER' && <option value="ALL">All Classes</option>}
            {permittedClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.arm}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="WITHDRAWN">Withdrawn</option>
            <option value="GRADUATED">Graduated</option>
          </select>
        </div>

        {canManageSchool() && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() =>
                openBulkOnboarding('STUDENTS', filterClass !== 'ALL' ? filterClass : undefined)
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs transition-colors"
              title="Bulk upload via Excel, CSV, or quick paste"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Bulk Onboarding</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition-colors shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Enroll Student</span>
            </button>
          </div>
        )}
      </div>

      {/* Result Count */}
      <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
        <span>
          Showing <strong className="text-slate-800">{filteredStudents.length}</strong> of{' '}
          <strong className="text-slate-800">{permittedStudents.length}</strong> student
          {permittedStudents.length === 1 ? '' : 's'}
          {search.trim() && <> matching &ldquo;{search}&rdquo;</>}
        </span>
        {filteredStudents.length > 0 && (
          <span className="font-mono">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1 align-middle" />
            &ge;95% &nbsp;
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1 align-middle" />
            80-94% &nbsp;
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1 align-middle" />
            &lt;80%
          </span>
        )}
      </div>

      {/* Student Register Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold">
                <th className="py-2.5 px-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAllVisible}
                    className="p-0.5 rounded text-slate-300 hover:text-white transition-colors inline-flex items-center justify-center"
                    title={allVisibleSelected ? 'Deselect all visible' : 'Select all visible'}
                    aria-label="Toggle select all"
                  >
                    {allVisibleSelected ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : someVisibleSelected ? (
                      <div className="w-4 h-4 rounded border-2 border-emerald-400 flex items-center justify-center">
                        <div className="w-2 h-0.5 bg-emerald-400" />
                      </div>
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-2.5 px-3 w-10 text-center">No.</th>
                <th className="py-2.5 px-3 min-w-[220px]">Student</th>
                <th className="py-2.5 px-3 min-w-[130px]">Class</th>
                <th className="py-2.5 px-3 min-w-[170px]">Parent Contact</th>
                <th className="py-2.5 px-3 w-28 text-center">Punctuality</th>
                <th className="py-2.5 px-3 w-24 text-center">Status</th>
                <th className="py-2.5 px-3 w-14 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Search className="w-8 h-8 opacity-40" />
                      <div className="text-xs font-medium">
                        No students match your filters.
                      </div>
                      {(search || filterClass !== 'ALL' || filterStatus !== 'ACTIVE') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setFilterClass('ALL');
                            setFilterStatus('ALL');
                          }}
                          className="text-[11px] font-bold text-slate-700 hover:text-slate-900 underline"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => {
                  const cls = classes.find((c) => c.id === s.classId);
                  const score =
                    s.punctualityScore !== undefined ? s.punctualityScore : 100;
                  const dotColor =
                    score >= 95
                      ? 'bg-emerald-500'
                      : score >= 80
                      ? 'bg-amber-500'
                      : 'bg-rose-500';
                  const isMenuOpen = openMenuId === s.id;

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="py-2 px-3 text-center align-top">
                        <button
                          type="button"
                          onClick={() => toggleSelectOne(s.id)}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-900 transition-colors inline-flex items-center justify-center"
                          aria-label={`Select ${s.firstName} ${s.lastName}`}
                        >
                          {selectedIds.has(s.id) ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-400 align-top">
                        {idx + 1}
                      </td>

                      {/* Student: name + admission number */}
                      <td className="py-2 px-3 align-top">
                        <div className="font-semibold text-slate-900 leading-tight">
                          {s.lastName.toUpperCase()},{' '}
                          <span className="font-normal">
                            {s.firstName} {s.middleName || ''}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {s.admissionNumber}
                          {s.notes && (
                            <span className="ml-2 italic text-slate-400">
                              · {s.notes.length > 40 ? s.notes.slice(0, 40) + '…' : s.notes}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-2 px-3 align-top">
                        <span className="inline-block font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {cls ? `${cls.name} ${cls.arm}` : s.classId}
                        </span>
                      </td>

                      {/* Parent contact: phone + admission date */}
                      <td className="py-2 px-3 align-top">
                        <div className="font-mono text-slate-700">
                          {s.parentPhone || (
                            <span className="text-slate-400 italic">No phone</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Admitted: {s.dateOfAdmission}
                        </div>
                      </td>

                      {/* Punctuality: dot + % */}
                      <td className="py-2 px-3 text-center align-top">
                        <span
                          className="inline-flex items-center gap-1.5 font-mono font-bold text-slate-700"
                          title={`${score.toFixed(1)}% punctuality — ${s.lateCount || 0} late mark${(s.lateCount || 0) === 1 ? '' : 's'}`}
                        >
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${dotColor}`}
                          />
                          <span className="text-[11px]">
                            {score.toFixed(0)}%
                          </span>
                        </span>
                      </td>

                      {/* Status: only shown when not ACTIVE */}
                      <td className="py-2 px-3 text-center align-top">
                        {s.status === 'ACTIVE' ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                              s.status === 'WITHDRAWN'
                                ? 'text-rose-700 bg-rose-50 border border-rose-200'
                                : s.status === 'TRANSFERRED'
                                ? 'text-purple-700 bg-purple-50 border border-purple-200'
                                : 'text-slate-600 bg-slate-100'
                            }`}
                          >
                            {s.status}
                          </span>
                        )}
                      </td>

                      {/* Kebab menu */}
                      <td className="py-2 px-3 text-right align-top">
                        <div className="relative inline-block" ref={isMenuOpen ? menuRef : null}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(isMenuOpen ? null : s.id);
                            }}
                            className="p-1.5 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Actions"
                            aria-label="Open actions menu"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-30 py-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingStudent(s);
                                  setOpenMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                <span>View Profile</span>
                              </button>

                              {canManageSchool() && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(s)}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Edit Details</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMovementStudent(s);
                                      setMovementToClassId(s.classId);
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5 text-purple-500" />
                                    <span>Process Movement</span>
                                  </button>

                                  <div className="h-px bg-slate-100 my-1" />

                                  <button
                                    type="button"
                                    onClick={() => handleOpenWithdraw(s)}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-amber-800 hover:bg-amber-50 transition-colors"
                                  >
                                    <LogOut className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Withdraw Student</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenHardDelete(s)}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-rose-700 hover:bg-rose-50 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Delete Permanently</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk action bar — appears when rows are selected */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 px-4 py-2.5 flex flex-wrap items-center gap-2 max-w-[95vw]">
          <span className="text-xs font-bold whitespace-nowrap">
            {selectedIds.size} student{selectedIds.size === 1 ? '' : 's'} selected
          </span>
          <div className="w-px h-5 bg-slate-700" />
          <button
            type="button"
            onClick={() => openBulkModal('withdraw')}
            className="px-3 py-1.5 text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Withdraw</span>
          </button>
          <button
            type="button"
            onClick={() => openBulkModal('change-class')}
            className="px-3 py-1.5 text-xs font-bold text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <FolderInput className="w-3.5 h-3.5" />
            <span>Change Class</span>
          </button>
          <button
            type="button"
            onClick={() => openBulkModal('delete')}
            className="px-3 py-1.5 text-xs font-bold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Permanently</span>
          </button>
          <div className="w-px h-5 bg-slate-700" />
          <button
            type="button"
            onClick={clearSelection}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Clear selection"
            aria-label="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Add / Edit Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white max-w-xl w-full rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingStudent ? 'Edit Student Details' : 'Enroll New Student'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingStudent(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Admission Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formAdmissionNumber}
                    onChange={(e) => setFormAdmissionNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Class & Arm *
                  </label>
                  <select
                    value={formClassId}
                    onChange={(e) => setFormClassId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.arm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    value={formMiddleName}
                    onChange={(e) => setFormMiddleName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Gender *
                  </label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as Gender)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date of Admission *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDateOfAdmission}
                    onChange={(e) => setFormDateOfAdmission(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={formDateOfBirth}
                    onChange={(e) => setFormDateOfBirth(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Parent / Guardian Name
                  </label>
                  <input
                    type="text"
                    value={formParentName}
                    onChange={(e) => setFormParentName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Parent Phone
                  </label>
                  <input
                    type="tel"
                    value={formParentPhone}
                    onChange={(e) => setFormParentPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Residential Address
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Medical notes, transfer reasons, etc."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingStudent(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-2xs"
                >
                  {editingStudent ? 'Save Changes' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Movement Modal */}
      {movementStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Record Student Movement
                </h3>
                <p className="text-xs text-slate-500">
                  {movementStudent.firstName} {movementStudent.lastName} (
                  {movementStudent.admissionNumber})
                </p>
              </div>
              <button
                onClick={() => setMovementStudent(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessMovement} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Movement Action
                </label>
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold focus:outline-none"
                >
                  <option value="CLASS_TRANSFER">Class Transfer</option>
                  <option value="ARM_TRANSFER">Arm Transfer</option>
                  <option value="PROMOTION">Academic Promotion</option>
                  <option value="WITHDRAWAL">Student Withdrawal</option>
                  <option value="GRADUATION">Graduation</option>
                </select>
              </div>

              {(movementType === 'CLASS_TRANSFER' ||
                movementType === 'ARM_TRANSFER' ||
                movementType === 'PROMOTION') && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Destination Class & Arm
                  </label>
                  <select
                    value={movementToClassId}
                    onChange={(e) => setMovementToClassId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.arm}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Effective Date
                </label>
                <input
                  type="date"
                  required
                  value={movementDate}
                  onChange={(e) => setMovementDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason / Notes
                </label>
                <textarea
                  rows={2}
                  required
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder="e.g. Relocation, parent request, session promotion..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-lg text-amber-900 text-[11px] leading-relaxed border border-amber-200">
                <strong>Calculation Note:</strong> Past attendance remains intact in the
                original class. Withdrawn students stop contributing to future school
                day denominators after the effective date.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMovementStudent(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold"
                >
                  Record Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Dossier / Profile Modal */}
      {viewingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {viewingStudent.firstName} {viewingStudent.middleName || ''}{' '}
                    {viewingStudent.lastName}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                      viewingStudent.gender === 'MALE'
                        ? 'text-blue-700 bg-blue-50'
                        : 'text-pink-700 bg-pink-50'
                    }`}
                  >
                    {viewingStudent.gender}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-500">
                  Admission: {viewingStudent.admissionNumber} · Enrolled:{' '}
                  {viewingStudent.dateOfAdmission}
                </div>
              </div>
              <button
                onClick={() => setViewingStudent(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Attendance Snapshot for this student */}
            {(() => {
              const days = getSchoolDaysInRange(
                currentTerm?.startDate || '2026-09-07',
                '2026-09-29',
                calendarDays,
                [1, 2, 3, 4, 5]
              );
              const summary = calculateStudentAttendanceSummary(
                viewingStudent,
                days,
                attendanceRecords
              );

              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-slate-400 text-[10px] font-sans">
                        Attendance Rate
                      </div>
                      <div className="text-lg font-bold text-emerald-700 mt-0.5">
                        {summary.attendancePercentage.toFixed(1)}%
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {summary.totalSessionsAttended} / {summary.possibleSessions} sess.
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-slate-400 text-[10px] font-sans">
                        Punctuality Score
                      </div>
                      <div className="text-lg font-bold text-amber-700 mt-0.5">
                        {summary.punctualityScore.toFixed(1)}%
                      </div>
                      <div className="text-[10px] font-bold mt-0.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] ${
                            summary.punctualityTier === 'EXCELLENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : summary.punctualityTier === 'GOOD'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {summary.punctualityTier.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-slate-400 text-[10px] font-sans">
                        Absence Sessions
                      </div>
                      <div className="text-lg font-bold text-rose-700 mt-0.5">
                        {summary.morningAbsent + summary.afternoonAbsent}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {summary.morningExcused + summary.afternoonExcused} excused
                      </div>
                    </div>
                  </div>

                  {/* Automated Punctuality Score Banner */}
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-950">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="font-bold">School Start Benchmark:</span>{' '}
                        <span>
                          {school.morningStartTime || '08:00'} (Morning) ·{' '}
                          {school.afternoonStartTime || '13:00'} (Afternoon)
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded">
                      {summary.totalLate} Late Arrivals
                    </span>
                  </div>

                  {/* Late Arrival Incident Log Table */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Late Arrival History ({summary.lateArrivalHistory.length})</span>
                      </h4>
                      <span className="text-[10px] text-slate-500">
                        Flagged by School Start Time
                      </span>
                    </div>

                    {summary.lateArrivalHistory.length === 0 ? (
                      <div className="p-3 text-center text-xs text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center justify-center gap-1.5">
                        <Award className="w-4 h-4 text-emerald-600" />
                        <span>
                          No late arrivals recorded this term. Excellent punctuality
                          record!
                        </span>
                      </div>
                    ) : (
                      <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                              <th className="py-1.5 px-2">Date</th>
                              <th className="py-1.5 px-2">Session</th>
                              <th className="py-1.5 px-2">Arrival Time</th>
                              <th className="py-1.5 px-2">Remarks / Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {summary.lateArrivalHistory.map((inc, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="py-1.5 px-2 font-mono text-slate-700">
                                  {inc.date}
                                </td>
                                <td className="py-1.5 px-2">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                    {inc.session}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2 font-mono font-bold text-rose-700">
                                  {inc.arrivalTime || 'Late'}
                                </td>
                                <td className="py-1.5 px-2 text-slate-500 italic">
                                  {inc.notes || 'Arrived after school start time'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Student Details */}
                  <div className="text-xs space-y-2 border-t border-slate-100 pt-3 text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Guardian Name:</span>
                      <span className="font-semibold text-slate-900">
                        {viewingStudent.parentName || 'Not specified'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Guardian Phone:</span>
                      <span className="font-mono text-slate-900">
                        {viewingStudent.parentPhone || 'Not specified'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Address:</span>
                      <span className="text-slate-900">
                        {viewingStudent.address || 'Not specified'}
                      </span>
                    </div>
                    {viewingStudent.notes && (
                      <div className="p-2.5 bg-slate-50 rounded-lg text-slate-700 border border-slate-200 mt-2">
                        <strong>Notes:</strong> {viewingStudent.notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setViewingStudent(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Student Modal (soft delete) */}
      {withdrawStudentTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5 text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  Withdraw Student?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {withdrawStudentTarget.firstName} {withdrawStudentTarget.middleName || ''}{' '}
                  {withdrawStudentTarget.lastName} ({withdrawStudentTarget.admissionNumber})
                </p>
              </div>
              <button
                onClick={() => setWithdrawStudentTarget(null)}
                className="text-slate-400 hover:text-slate-600 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-900 leading-snug">
              <strong>History preserved.</strong> The student is marked as
              WITHDRAWN but all past attendance, scores, and report cards remain
              in the system for records.
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Effective Date *
                </label>
                <input
                  type="date"
                  required
                  value={withdrawDate}
                  onChange={(e) => setWithdrawDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason / Notes
                </label>
                <textarea
                  rows={2}
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  placeholder="e.g. Family relocated, transferred to another school..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setWithdrawStudentTarget(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWithdraw}
                disabled={!withdrawDate}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Withdraw Student</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hard Delete Student Modal */}
      {hardDeleteStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  Delete Permanently?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {hardDeleteStudent.firstName} {hardDeleteStudent.middleName || ''}{' '}
                  {hardDeleteStudent.lastName}
                </p>
              </div>
              <button
                onClick={() => {
                  setHardDeleteStudent(null);
                  setHardDeleteConfirm('');
                }}
                className="text-slate-400 hover:text-slate-600 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-1.5 text-[11px] text-rose-900">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
                <span>This permanently removes:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>The student record itself</li>
                <li>
                  <strong>{hardDeletePreview.attendance}</strong> attendance record
                  {hardDeletePreview.attendance === 1 ? '' : 's'}
                </li>
                <li>
                  <strong>{hardDeletePreview.scores}</strong> assessment score
                  {hardDeletePreview.scores === 1 ? '' : 's'}
                </li>
                <li>
                  <strong>{hardDeletePreview.cards}</strong> report card
                  {hardDeletePreview.cards === 1 ? '' : 's'}
                </li>
                <li>
                  <strong>{hardDeletePreview.movements}</strong> movement record
                  {hardDeletePreview.movements === 1 ? '' : 's'}
                </li>
              </ul>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 leading-snug">
              <strong>Heads up:</strong> This cannot be undone. If the student
              simply left the school, consider <em>Withdraw Student</em> instead
              — it preserves all history.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Type{' '}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-rose-700">
                  {hardDeleteStudent.admissionNumber}
                </code>{' '}
                to confirm:
              </label>
              <input
                type="text"
                autoFocus
                value={hardDeleteConfirm}
                onChange={(e) => setHardDeleteConfirm(e.target.value)}
                placeholder={hardDeleteStudent.admissionNumber}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setHardDeleteStudent(null);
                  setHardDeleteConfirm('');
                }}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={hardDeleteConfirm !== hardDeleteStudent.admissionNumber}
                onClick={handleConfirmHardDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Withdraw Modal */}
      {bulkAction === 'withdraw' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5 text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  Withdraw {selectedIds.size} Student{selectedIds.size === 1 ? '' : 's'}?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Effective date applies to all selected students.
                </p>
              </div>
              <button onClick={closeBulkModal} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-900 leading-snug">
              <strong>History preserved.</strong> All past attendance, scores, and report cards remain in the system.
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Effective Date *</label>
                <input
                  type="date"
                  required
                  value={bulkWithdrawDate}
                  onChange={(e) => setBulkWithdrawDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason / Notes</label>
                <textarea
                  rows={2}
                  value={bulkWithdrawReason}
                  onChange={(e) => setBulkWithdrawReason(e.target.value)}
                  placeholder="e.g. End of term withdrawals, families relocating..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={closeBulkModal} className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkWithdraw}
                disabled={!bulkWithdrawDate}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Withdraw {selectedIds.size}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Change Class Modal */}
      {bulkAction === 'change-class' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <FolderInput className="w-5 h-5 text-blue-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  Move {selectedIds.size} Student{selectedIds.size === 1 ? '' : 's'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">All selected students will be reassigned to one class.</p>
              </div>
              <button onClick={closeBulkModal} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Class &amp; Arm *</label>
                <select
                  value={bulkClassTarget}
                  onChange={(e) => setBulkClassTarget(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">-- Choose destination class --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.arm} ({students.filter((s) => s.classId === c.id).length} students)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason / Notes</label>
                <textarea
                  rows={2}
                  value={bulkClassReason}
                  onChange={(e) => setBulkClassReason(e.target.value)}
                  placeholder="e.g. Rebalancing class sizes, promoted to new arm..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={closeBulkModal} className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkChangeClass}
                disabled={!bulkClassTarget}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <FolderInput className="w-3.5 h-3.5" />
                <span>Move {selectedIds.size}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {bulkAction === 'delete' && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">
                  Delete {selectedIds.size} Student{selectedIds.size === 1 ? '' : 's'} Permanently?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">This cannot be undone.</p>
              </div>
              <button onClick={closeBulkModal} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg max-h-32 overflow-y-auto">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Selected Students
              </div>
              <div className="space-y-0.5 text-xs font-mono text-slate-700">
                {Array.from(selectedIds).slice(0, 8).map((id) => {
                  const s = students.find((x) => x.id === id);
                  if (!s) return null;
                  return (
                    <div key={id}>
                      {s.admissionNumber} — {s.lastName}, {s.firstName}
                    </div>
                  );
                })}
                {selectedIds.size > 8 && (
                  <div className="text-slate-500 italic">…and {selectedIds.size - 8} more</div>
                )}
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-1.5 text-[11px] text-rose-900">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
                <span>Cascade deletion totals:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li><strong>{selectedIds.size}</strong> student record{selectedIds.size === 1 ? '' : 's'}</li>
                <li><strong>{bulkDeletePreview.attendance}</strong> attendance record{bulkDeletePreview.attendance === 1 ? '' : 's'}</li>
                <li><strong>{bulkDeletePreview.scores}</strong> assessment score{bulkDeletePreview.scores === 1 ? '' : 's'}</li>
                <li><strong>{bulkDeletePreview.cards}</strong> report card{bulkDeletePreview.cards === 1 ? '' : 's'}</li>
                <li><strong>{bulkDeletePreview.movements}</strong> movement record{bulkDeletePreview.movements === 1 ? '' : 's'}</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Type{' '}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-rose-700">
                  DELETE {selectedIds.size}
                </code>{' '}
                to confirm:
              </label>
              <input
                type="text"
                autoFocus
                value={bulkDeleteConfirm}
                onChange={(e) => setBulkDeleteConfirm(e.target.value)}
                placeholder={`DELETE ${selectedIds.size}`}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={closeBulkModal} className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkDeleteConfirm !== `DELETE ${selectedIds.size}`}
                onClick={handleConfirmBulkDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete {selectedIds.size} Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};