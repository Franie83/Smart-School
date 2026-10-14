// Unified Bulk Onboarding Hub for Students & Teachers
import React, { useMemo, useState, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardPaste,
  Download,
  FileSpreadsheet,
  HelpCircle,
  Plus,
  RefreshCw,
  School,
  Sparkles,
  Table as TableIcon,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { db } from '../../services/storage';
import { Gender, Student, User, UserRole } from '../../types/attendance';

// Student Staging Row
interface ParsedStudentRow {
  rowId: string;
  admissionNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  gender: Gender;
  classId: string;
  arm: string;
  dateOfAdmission: string;
  dateOfBirth?: string;
  parentName?: string;
  parentPhone?: string;
  address?: string;
  notes?: string;
  isValid: boolean;
  errors: string[];
}

// Teacher Staging Row
interface ParsedTeacherRow {
  rowId: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  assignedClassIds: string[];
  assignedClassLabels: string;
  subject?: string;
  qualification?: string;
  isValid: boolean;
  errors: string[];
}

interface BulkOnboardingModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialEntity?: 'STUDENTS' | 'TEACHERS';
  defaultClassId?: string;
}

export const BulkOnboardingModal: React.FC<BulkOnboardingModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  initialEntity: propInitialEntity,
  defaultClassId: propDefaultClassId,
}) => {
  const {
    isBulkOnboardingOpen,
    closeBulkOnboarding,
    bulkOnboardingEntity,
    bulkOnboardingClassId,
    classes,
    students,
    allUsers,
    school,
    addToast,
    refreshData,
    setActiveTab,
    setSelectedClassId,
  } = useApp();

  const isOpen = propIsOpen !== undefined ? propIsOpen : isBulkOnboardingOpen;
  const onClose = propOnClose || closeBulkOnboarding;

  // Active Entity: 'STUDENTS' or 'TEACHERS'
  const [activeEntity, setActiveEntity] = useState<'STUDENTS' | 'TEACHERS'>(
    propInitialEntity || bulkOnboardingEntity || 'STUDENTS'
  );

  useEffect(() => {
    if (propInitialEntity) {
      setActiveEntity(propInitialEntity);
    } else if (bulkOnboardingEntity) {
      setActiveEntity(bulkOnboardingEntity);
    }
  }, [propInitialEntity, bulkOnboardingEntity, isOpen]);

  // Mode: 'FILE' | 'PASTE' | 'FAST_GRID'
  const [activeTab, setActiveTabMode] = useState<'FILE' | 'PASTE' | 'FAST_GRID'>('FILE');

  // Selected default class fallback for students
  const effectiveDefaultClassId =
    propDefaultClassId || bulkOnboardingClassId || classes[0]?.id || '';
  const [selectedClassId, setSelectedClassIdState] = useState<string>(
    effectiveDefaultClassId
  );

  useEffect(() => {
    if (effectiveDefaultClassId) {
      setSelectedClassIdState(effectiveDefaultClassId);
    }
  }, [effectiveDefaultClassId]);

  // Paste text
  const [pasteText, setPasteText] = useState<string>('');

  // -------------------------------------------------------------
  // STUDENTS STATE & HANDLERS
  // -------------------------------------------------------------
  const [studentManualRows, setStudentManualRows] = useState<
    Array<{
      admissionNumber: string;
      firstName: string;
      lastName: string;
      gender: Gender;
      parentPhone: string;
    }>
  >([
    { admissionNumber: '', firstName: '', lastName: '', gender: 'MALE', parentPhone: '' },
    { admissionNumber: '', firstName: '', lastName: '', gender: 'FEMALE', parentPhone: '' },
    { admissionNumber: '', firstName: '', lastName: '', gender: 'MALE', parentPhone: '' },
    { admissionNumber: '', firstName: '', lastName: '', gender: 'FEMALE', parentPhone: '' },
  ]);

  const [stagedStudents, setStagedStudents] = useState<ParsedStudentRow[]>([]);
  const [studentFileName, setStudentFileName] = useState<string>('');

  // -------------------------------------------------------------
  // TEACHERS STATE & HANDLERS
  // -------------------------------------------------------------
  const [teacherManualRows, setTeacherManualRows] = useState<
    Array<{
      name: string;
      email: string;
      role: UserRole;
      phone: string;
      assignedClassId: string;
      subject: string;
    }>
  >([
    { name: '', email: '', role: 'TEACHER', phone: '', assignedClassId: classes[0]?.id || '', subject: 'English Language' },
    { name: '', email: '', role: 'TEACHER', phone: '', assignedClassId: classes[1]?.id || '', subject: 'Mathematics' },
    { name: '', email: '', role: 'TEACHER', phone: '', assignedClassId: '', subject: 'Basic Science' },
  ]);

  const [stagedTeachers, setStagedTeachers] = useState<ParsedTeacherRow[]>([]);
  const [teacherFileName, setTeacherFileName] = useState<string>('');

  // Processing state & Post-Commit Summary Screen
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [commitSummary, setCommitSummary] = useState<{
    entity: 'STUDENTS' | 'TEACHERS';
    insertedCount: number;
    failedCount: number;
    insertedItems: Array<{ primary: string; secondary: string; tag?: string }>;
    failedItems: Array<{ identifier: string; reason: string }>;
  } | null>(null);

  // Filter staged view: 'ALL' | 'VALID' | 'ERRORS'
  const [stagedFilter, setStagedFilter] = useState<'ALL' | 'VALID' | 'ERRORS'>('ALL');

  // Existing admission numbers & emails sets
  const existingAdmissionSet = useMemo(() => {
    return new Set(students.map((s) => s.admissionNumber.trim().toLowerCase()));
  }, [students]);

  const existingEmailSet = useMemo(() => {
    return new Set(allUsers.map((u) => u.email.trim().toLowerCase()));
  }, [allUsers]);

  const activeClassObj =
    classes.find((c) => c.id === selectedClassId) || classes[0] || {
      id: 'class_jss1_a',
      name: 'JSS 1',
      arm: 'A',
      schoolId: school.id || 'school_demo_1',
    };

  // Helper to resolve Class ID from Class Name and Arm strings
  const resolveClass = (className?: string, arm?: string): { classId: string; arm: string } => {
    if (className) {
      const match = classes.find((c) => {
        const full = `${c.name} ${c.arm}`.toLowerCase();
        const inputFull = `${className} ${arm || ''}`.trim().toLowerCase();
        if (full === inputFull) return true;
        if (c.name.toLowerCase() === className.trim().toLowerCase()) {
          if (arm && c.arm.toLowerCase() === arm.trim().toLowerCase()) return true;
        }
        return false;
      });
      if (match) return { classId: match.id, arm: match.arm };
    }
    return { classId: activeClassObj.id, arm: activeClassObj.arm };
  };

  // Helper to resolve teacher assigned classes from string list (e.g. "JSS 1 A, JSS 2 B")
  const resolveTeacherClasses = (classesStr?: string): { classIds: string[]; labels: string } => {
    if (!classesStr) return { classIds: [], labels: 'Unassigned (General)' };
    const tokens = classesStr.split(/[,;/|]+/).map((t) => t.trim().toLowerCase());
    const matchedIds: string[] = [];
    const matchedLabels: string[] = [];

    classes.forEach((c) => {
      const fullName = `${c.name} ${c.arm}`.toLowerCase();
      const shortName = c.name.toLowerCase();
      if (tokens.some((tok) => tok === fullName || tok === shortName || tok === c.id.toLowerCase())) {
        matchedIds.push(c.id);
        matchedLabels.push(`${c.name} ${c.arm}`);
      }
    });

    if (matchedIds.length > 0) {
      return { classIds: matchedIds, labels: matchedLabels.join(', ') };
    }
    return { classIds: [], labels: classesStr.trim() };
  };

  // Validate a Student Row
  const validateStudentRow = (
    row: Omit<ParsedStudentRow, 'isValid' | 'errors'>,
    batchAdmissions: Set<string>
  ): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const adm = row.admissionNumber?.trim()?.toLowerCase();

    if (!adm) {
      errors.push('Admission number is missing');
    } else {
      if (existingAdmissionSet.has(adm)) {
        errors.push(`Admission No "${row.admissionNumber}" already exists in system`);
      }
      if (batchAdmissions.has(adm)) {
        errors.push(`Duplicate admission No in this upload batch`);
      }
    }

    if (!row.firstName?.trim()) {
      errors.push('First name is required');
    }
    if (!row.lastName?.trim()) {
      errors.push('Last name is required');
    }
    if (!row.gender || (row.gender !== 'MALE' && row.gender !== 'FEMALE')) {
      errors.push('Gender must be MALE or FEMALE');
    }
    if (!row.classId) {
      errors.push('Target Class could not be resolved');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  // Validate a Teacher Row
  const validateTeacherRow = (
    row: Omit<ParsedTeacherRow, 'isValid' | 'errors'>,
    batchEmails: Set<string>
  ): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const email = row.email?.trim()?.toLowerCase();

    if (!email) {
      errors.push('Email address is missing');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push(`Invalid email syntax: "${row.email}"`);
      }
      if (existingEmailSet.has(email)) {
        errors.push(`Email "${row.email}" already exists in the system`);
      }
      if (batchEmails.has(email)) {
        errors.push(`Duplicate email in this upload batch`);
      }
    }

    if (!row.name?.trim()) {
      errors.push('Staff full name is required');
    }

    const validRoles: UserRole[] = ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'VIEWER'];
    if (!validRoles.includes(row.role)) {
      errors.push(`Role must be one of: TEACHER, SCHOOL_ADMIN, SUPER_ADMIN, VIEWER`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  // -------------------------------------------------------------
  // TEMPLATES DOWNLOAD
  // -------------------------------------------------------------
  const handleDownloadStudentTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
    const sampleData = [
      {
        'Admission Number': 'DIS/2026/101',
        'First Name': 'Oluwaseun',
        'Middle Name': 'Samuel',
        'Last Name': 'Adeleke',
        'Gender (MALE/FEMALE)': 'MALE',
        'Class Name': activeClassObj ? activeClassObj.name : 'JSS 1',
        'Arm': activeClassObj ? activeClassObj.arm : 'A',
        'Admission Date (YYYY-MM-DD)': '2026-09-07',
        'Date of Birth (YYYY-MM-DD)': '2014-04-15',
        'Parent / Guardian Name': 'Mr. Bayo Adeleke',
        'Parent Phone': '08031234567',
        'Residential Address': '10 Victoria Island, Lagos',
        'Notes': 'Transferred from Lagos Model School',
      },
      {
        'Admission Number': 'DIS/2026/102',
        'First Name': 'Fatima',
        'Middle Name': 'Aisha',
        'Last Name': 'Mohammed',
        'Gender (MALE/FEMALE)': 'FEMALE',
        'Class Name': activeClassObj ? activeClassObj.name : 'JSS 1',
        'Arm': activeClassObj ? activeClassObj.arm : 'A',
        'Admission Date (YYYY-MM-DD)': '2026-09-07',
        'Date of Birth (YYYY-MM-DD)': '2014-08-20',
        'Parent / Guardian Name': 'Hajiya Amina Mohammed',
        'Parent Phone': '08098765432',
        'Residential Address': '22 Bourdillon Road, Ikoyi',
        'Notes': 'Prefers front row seating',
      },
      {
        'Admission Number': 'DIS/2026/103',
        'First Name': 'Chukwudi',
        'Middle Name': 'Paul',
        'Last Name': 'Okeke',
        'Gender (MALE/FEMALE)': 'MALE',
        'Class Name': activeClassObj ? activeClassObj.name : 'JSS 1',
        'Arm': activeClassObj ? activeClassObj.arm : 'A',
        'Admission Date (YYYY-MM-DD)': '2026-09-07',
        'Date of Birth (YYYY-MM-DD)': '2014-02-11',
        'Parent / Guardian Name': 'Dr. & Mrs. Okeke',
        'Parent Phone': '08023456789',
        'Residential Address': '5 Admiralty Way, Lekki',
        'Notes': 'Football team member',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 22 },
      { wch: 14 },
      { wch: 8 },
      { wch: 26 },
      { wch: 26 },
      { wch: 24 },
      { wch: 16 },
      { wch: 28 },
      { wch: 30 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students_Onboarding');

    if (format === 'xlsx') {
      XLSX.writeFile(workbook, `SmartSchool_Students_Onboarding_Template.xlsx`);
    } else {
      XLSX.writeFile(workbook, `SmartSchool_Students_Onboarding_Template.csv`, {
        bookType: 'csv',
      });
    }

    addToast({
      type: 'info',
      title: 'Student Template Downloaded',
      message: `Downloaded student onboarding template in .${format} format.`,
    });
  };

  const handleDownloadTeacherTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
    const sampleData = [
      {
        'Full Name': 'Mr. Babatunde Fashola',
        'Email Address': 'babatunde.fashola@school.edu.ng',
        'Role (TEACHER/SCHOOL_ADMIN/VIEWER)': 'TEACHER',
        'Phone Number': '08031234567',
        'Assigned Class(es)': 'JSS 1 A, JSS 1 B',
        'Subject Specialization': 'Mathematics & Further Maths',
        'Academic Qualification': 'B.Sc Ed Mathematics (Unilag)',
      },
      {
        'Full Name': 'Mrs. Ngozi Okonjo',
        'Email Address': 'ngozi.okonjo@school.edu.ng',
        'Role (TEACHER/SCHOOL_ADMIN/VIEWER)': 'TEACHER',
        'Phone Number': '08029876543',
        'Assigned Class(es)': 'JSS 2 A',
        'Subject Specialization': 'English Language & Literature',
        'Academic Qualification': 'B.A English (UI)',
      },
      {
        'Full Name': 'Dr. Aliyu Danbaba',
        'Email Address': 'aliyu.danbaba@school.edu.ng',
        'Role (TEACHER/SCHOOL_ADMIN/VIEWER)': 'SCHOOL_ADMIN',
        'Phone Number': '08055551234',
        'Assigned Class(es)': 'All Classes',
        'Subject Specialization': 'Physics & Integrated Science',
        'Academic Qualification': 'Ph.D Science Education',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    worksheet['!cols'] = [
      { wch: 26 },
      { wch: 32 },
      { wch: 34 },
      { wch: 18 },
      { wch: 24 },
      { wch: 30 },
      { wch: 30 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Teachers_Onboarding');

    if (format === 'xlsx') {
      XLSX.writeFile(workbook, `SmartSchool_Teachers_Onboarding_Template.xlsx`);
    } else {
      XLSX.writeFile(workbook, `SmartSchool_Teachers_Onboarding_Template.csv`, {
        bookType: 'csv',
      });
    }

    addToast({
      type: 'info',
      title: 'Teacher Template Downloaded',
      message: `Downloaded teacher & staff onboarding template in .${format} format.`,
    });
  };

  // -------------------------------------------------------------
  // PARSING LOGIC: STUDENTS
  // -------------------------------------------------------------
  const processImportedStudentRecords = (rawRecords: any[]) => {
    const staged: ParsedStudentRow[] = [];
    const batchAdmissions = new Set<string>();

    rawRecords.forEach((item, index) => {
      const getVal = (possibleKeys: string[]): string => {
        for (const k of possibleKeys) {
          if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
            return String(item[k]).trim();
          }
          const lowerK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const rawKey of Object.keys(item)) {
            const rawNormalized = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (rawNormalized === lowerK && item[rawKey] !== undefined && item[rawKey] !== null) {
              const val = String(item[rawKey]).trim();
              if (val !== '') return val;
            }
          }
        }
        return '';
      };

      const admissionNumber = getVal([
        'Admission Number',
        'admissionNumber',
        'Adm No',
        'Admission No',
        'adm_no',
        'reg_number',
      ]);
      const firstName = getVal(['First Name', 'firstName', 'first_name']);
      const middleName = getVal(['Middle Name', 'middleName', 'middle_name']);
      const lastName = getVal(['Last Name', 'lastName', 'last_name', 'Surname', 'surname']);
      const genderRaw = getVal(['Gender', 'gender', 'Sex', 'sex']).toUpperCase();
      const gender: Gender =
        genderRaw.startsWith('F') || genderRaw === 'FEMALE' ? 'FEMALE' : 'MALE';

      const className = getVal(['Class Name', 'Class', 'class_name', 'Grade', 'grade']);
      const arm = getVal(['Arm', 'arm', 'Stream', 'stream']);
      const resolved = resolveClass(className, arm);

      const dateOfAdmission =
        getVal(['Admission Date', 'dateOfAdmission', 'admission_date']) || '2026-09-07';
      const dateOfBirth = getVal(['Date of Birth', 'dateOfBirth', 'dob', 'birth_date']);
      const parentName = getVal(['Parent / Guardian Name', 'parentName', 'parent_name', 'Guardian']);
      const parentPhone = getVal(['Parent Phone', 'parentPhone', 'phone', 'contact_number']);
      const address = getVal(['Residential Address', 'address', 'home_address']);
      const notes = getVal(['Notes', 'notes', 'remarks']);

      const candidate: Omit<ParsedStudentRow, 'isValid' | 'errors'> = {
        rowId: `stg_stu_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 4)}`,
        admissionNumber: admissionNumber || `DIS/2026/${(students.length + index + 1).toString().padStart(3, '0')}`,
        firstName,
        middleName: middleName || undefined,
        lastName,
        gender,
        classId: resolved.classId,
        arm: resolved.arm,
        dateOfAdmission,
        dateOfBirth: dateOfBirth || undefined,
        parentName: parentName || undefined,
        parentPhone: parentPhone || undefined,
        address: address || undefined,
        notes: notes || undefined,
      };

      const validation = validateStudentRow(candidate, batchAdmissions);
      if (candidate.admissionNumber) {
        batchAdmissions.add(candidate.admissionNumber.toLowerCase());
      }

      staged.push({
        ...candidate,
        isValid: validation.isValid,
        errors: validation.errors,
      });
    });

    setStagedStudents(staged);
    const validCount = staged.filter((s) => s.isValid).length;
    addToast({
      type: validCount > 0 ? 'success' : 'warning',
      title: 'Students Staged',
      message: `Parsed ${staged.length} students: ${validCount} valid for enrollment, ${
        staged.length - validCount
      } with issues.`,
    });
  };

  // -------------------------------------------------------------
  // PARSING LOGIC: TEACHERS
  // -------------------------------------------------------------
  const processImportedTeacherRecords = (rawRecords: any[]) => {
    const staged: ParsedTeacherRow[] = [];
    const batchEmails = new Set<string>();

    rawRecords.forEach((item, index) => {
      const getVal = (possibleKeys: string[]): string => {
        for (const k of possibleKeys) {
          if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
            return String(item[k]).trim();
          }
          const lowerK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const rawKey of Object.keys(item)) {
            const rawNormalized = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (rawNormalized === lowerK && item[rawKey] !== undefined && item[rawKey] !== null) {
              const val = String(item[rawKey]).trim();
              if (val !== '') return val;
            }
          }
        }
        return '';
      };

      const name = getVal(['Full Name', 'name', 'Teacher Name', 'teacher_name', 'staff_name']);
      const email = getVal(['Email Address', 'email', 'email_address', 'mail']);
      const roleRaw = getVal(['Role', 'role', 'user_role']).toUpperCase();
      let role: UserRole = 'TEACHER';
      if (roleRaw.includes('SUPER') || roleRaw.includes('DIRECTOR')) {
        role = 'SUPER_ADMIN';
      } else if (roleRaw.includes('ADMIN') || roleRaw.includes('PRINCIPAL') || roleRaw.includes('VP')) {
        role = 'SCHOOL_ADMIN';
      } else if (roleRaw.includes('VIEW') || roleRaw.includes('AUDITOR')) {
        role = 'VIEWER';
      }

      const phone = getVal(['Phone Number', 'phone', 'phone_number', 'mobile']);
      const assignedClassStr = getVal(['Assigned Class(es)', 'assigned_classes', 'class', 'classes']);
      const { classIds, labels } = resolveTeacherClasses(assignedClassStr);

      const subject = getVal(['Subject Specialization', 'subject', 'specialization', 'teaching_subject']);
      const qualification = getVal(['Academic Qualification', 'qualification', 'degree', 'cert']);

      const candidate: Omit<ParsedTeacherRow, 'isValid' | 'errors'> = {
        rowId: `stg_tch_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 4)}`,
        name,
        email,
        role,
        phone: phone || undefined,
        assignedClassIds: classIds,
        assignedClassLabels: labels,
        subject: subject || undefined,
        qualification: qualification || undefined,
      };

      const validation = validateTeacherRow(candidate, batchEmails);
      if (candidate.email) {
        batchEmails.add(candidate.email.toLowerCase());
      }

      staged.push({
        ...candidate,
        isValid: validation.isValid,
        errors: validation.errors,
      });
    });

    setStagedTeachers(staged);
    const validCount = staged.filter((t) => t.isValid).length;
    addToast({
      type: validCount > 0 ? 'success' : 'warning',
      title: 'Teachers Staged',
      message: `Parsed ${staged.length} staff records: ${validCount} valid for onboarding, ${
        staged.length - validCount
      } with issues.`,
    });
  };

  // -------------------------------------------------------------
  // FILE UPLOAD HANDLER
  // -------------------------------------------------------------
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (activeEntity === 'STUDENTS') {
      setStudentFileName(file.name);
    } else {
      setTeacherFileName(file.name);
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          addToast({
            type: 'error',
            title: 'Empty File',
            message: 'No records found in the uploaded spreadsheet.',
          });
          return;
        }

        if (activeEntity === 'STUDENTS') {
          processImportedStudentRecords(data);
        } else {
          processImportedTeacherRecords(data);
        }
      } catch (err: any) {
        addToast({
          type: 'error',
          title: 'File Parse Error',
          message: err.message || 'Could not parse spreadsheet file.',
        });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // -------------------------------------------------------------
  // SPREADSHEET QUICK PASTE HANDLER
  // -------------------------------------------------------------
  const handleParsePastedText = () => {
    if (!pasteText.trim()) {
      addToast({
        type: 'warning',
        title: 'Empty Text',
        message: 'Please paste spreadsheet rows into the text area.',
      });
      return;
    }

    const lines = pasteText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    // Detect delimiter
    const sampleLine = lines[0];
    const delimiter = sampleLine.includes('\t')
      ? '\t'
      : sampleLine.includes(',')
      ? ','
      : ';';

    const headerParts = sampleLine.split(delimiter).map((h) => h.trim());
    const isFirstLineHeader =
      headerParts.some((h) => {
        const str = h.toLowerCase();
        return (
          str.includes('name') ||
          str.includes('admission') ||
          str.includes('email') ||
          str.includes('gender') ||
          str.includes('role')
        );
      });

    const dataLines = isFirstLineHeader ? lines.slice(1) : lines;
    const records: any[] = [];

    if (activeEntity === 'STUDENTS') {
      dataLines.forEach((line) => {
        const cols = line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length === 0 || !cols.some((c) => c)) return;

        if (isFirstLineHeader) {
          const rec: Record<string, string> = {};
          headerParts.forEach((h, i) => {
            rec[h] = cols[i] || '';
          });
          records.push(rec);
        } else {
          // Fallback positional: AdmNo, FirstName, LastName, Gender, Phone
          records.push({
            'Admission Number': cols[0] || '',
            'First Name': cols[1] || '',
            'Last Name': cols[2] || '',
            'Gender': cols[3] || 'MALE',
            'Parent Phone': cols[4] || '',
          });
        }
      });
      processImportedStudentRecords(records);
    } else {
      // TEACHERS
      dataLines.forEach((line) => {
        const cols = line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length === 0 || !cols.some((c) => c)) return;

        if (isFirstLineHeader) {
          const rec: Record<string, string> = {};
          headerParts.forEach((h, i) => {
            rec[h] = cols[i] || '';
          });
          records.push(rec);
        } else {
          // Fallback positional: Name, Email, Role, Phone, Assigned Classes, Subject
          records.push({
            'Full Name': cols[0] || '',
            'Email Address': cols[1] || '',
            'Role': cols[2] || 'TEACHER',
            'Phone Number': cols[3] || '',
            'Assigned Class(es)': cols[4] || '',
            'Subject Specialization': cols[5] || '',
          });
        }
      });
      processImportedTeacherRecords(records);
    }
  };

  // -------------------------------------------------------------
  // FAST GRID STAGING
  // -------------------------------------------------------------
  const handleStageStudentFastGrid = () => {
    const validRows = studentManualRows.filter(
      (r) => r.admissionNumber.trim() || r.firstName.trim() || r.lastName.trim()
    );
    if (validRows.length === 0) {
      addToast({
        type: 'warning',
        title: 'Empty Grid',
        message: 'Please fill in at least one student in the interactive grid.',
      });
      return;
    }

    const rowsAsJson = validRows.map((r) => ({
      'admission number': r.admissionNumber,
      'first name': r.firstName,
      'last name': r.lastName,
      'gender': r.gender,
      'parent phone': r.parentPhone,
    }));

    processImportedStudentRecords(rowsAsJson);
  };

  const handleStageTeacherFastGrid = () => {
    const validRows = teacherManualRows.filter(
      (r) => r.name.trim() || r.email.trim()
    );
    if (validRows.length === 0) {
      addToast({
        type: 'warning',
        title: 'Empty Grid',
        message: 'Please fill in at least one staff member in the interactive grid.',
      });
      return;
    }

    const rowsAsJson = validRows.map((r) => {
      const cls = classes.find((c) => c.id === r.assignedClassId);
      return {
        'Full Name': r.name,
        'Email Address': r.email,
        'Role': r.role,
        'Phone Number': r.phone,
        'Assigned Class(es)': cls ? `${cls.name} ${cls.arm}` : '',
        'Subject Specialization': r.subject,
      };
    });

    processImportedTeacherRecords(rowsAsJson);
  };

  // -------------------------------------------------------------
  // COMMIT TRANSACTION
  // -------------------------------------------------------------
  const handleCommitStudents = () => {
    const validRows = stagedStudents.filter((r) => r.isValid);
    if (validRows.length === 0) {
      addToast({
        type: 'error',
        title: 'No Valid Students',
        message: 'There are no valid students ready to enroll.',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const recordsToInsert = validRows.map((r) => ({
        schoolId: activeClassObj.schoolId || 'school_demo_1',
        admissionNumber: r.admissionNumber,
        firstName: r.firstName,
        middleName: r.middleName,
        lastName: r.lastName,
        gender: r.gender,
        classId: r.classId,
        arm: r.arm,
        dateOfAdmission: r.dateOfAdmission || '2026-09-07',
        dateOfBirth: r.dateOfBirth,
        parentName: r.parentName,
        parentPhone: r.parentPhone,
        address: r.address,
        notes: r.notes,
        status: 'ACTIVE' as const,
      }));

      const result = db.bulkAddStudents(recordsToInsert);
      refreshData();
      setIsProcessing(false);

      try {
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // ignore
      }

      setCommitSummary({
        entity: 'STUDENTS',
        insertedCount: result.inserted.length,
        failedCount: result.failed.length,
        insertedItems: result.inserted.map((s) => {
          const c = classes.find((cl) => cl.id === s.classId);
          return {
            primary: `${s.lastName.toUpperCase()}, ${s.firstName}`,
            secondary: `Adm No: ${s.admissionNumber}`,
            tag: c ? `${c.name} ${c.arm}` : s.arm,
          };
        }),
        failedItems: result.failed.map((f) => ({
          identifier: f.admissionNumber,
          reason: f.reason,
        })),
      });

      addToast({
        type: 'success',
        title: 'Students Enrolled Successfully! 🎉',
        message: `Registered ${result.inserted.length} students into the school register!`,
      });

      setStagedStudents([]);
      setStudentFileName('');
      setPasteText('');
    } catch (err: any) {
      setIsProcessing(false);
      addToast({
        type: 'error',
        title: 'Enrollment Error',
        message: err.message || 'An error occurred during bulk enrollment.',
      });
    }
  };

  const handleCommitTeachers = () => {
    const validRows = stagedTeachers.filter((r) => r.isValid);
    if (validRows.length === 0) {
      addToast({
        type: 'error',
        title: 'No Valid Staff',
        message: 'There are no valid staff members ready to register.',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const recordsToInsert = validRows.map((r) => ({
        schoolId: school.id || 'school_demo_1',
        name: r.name,
        email: r.email,
        role: r.role,
        phone: r.phone,
        assignedClassIds: r.assignedClassIds,
        subject: r.subject,
        qualification: r.qualification,
      }));

      const result = db.bulkAddTeachers(recordsToInsert);
      refreshData();
      setIsProcessing(false);

      try {
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // ignore
      }

      setCommitSummary({
        entity: 'TEACHERS',
        insertedCount: result.inserted.length,
        failedCount: result.failed.length,
        insertedItems: result.inserted.map((u) => {
          const assigned = classes.filter((c) => u.assignedClassIds?.includes(c.id));
          return {
            primary: u.name,
            secondary: u.email,
            tag: assigned.length > 0 ? assigned.map((c) => `${c.name} ${c.arm}`).join(', ') : u.role,
          };
        }),
        failedItems: result.failed.map((f) => ({
          identifier: f.email,
          reason: f.reason,
        })),
      });

      addToast({
        type: 'success',
        title: 'Teachers Onboarded Successfully! 🎉',
        message: `Registered ${result.inserted.length} staff members to the school portal!`,
      });

      setStagedTeachers([]);
      setTeacherFileName('');
      setPasteText('');
    } catch (err: any) {
      setIsProcessing(false);
      addToast({
        type: 'error',
        title: 'Registration Error',
        message: err.message || 'An error occurred during teacher onboarding.',
      });
    }
  };

  if (!isOpen) return null;

  // Counts for current entity
  const currentStagedCount =
    activeEntity === 'STUDENTS' ? stagedStudents.length : stagedTeachers.length;
  const currentValidCount =
    activeEntity === 'STUDENTS'
      ? stagedStudents.filter((s) => s.isValid).length
      : stagedTeachers.filter((t) => t.isValid).length;
  const currentInvalidCount = currentStagedCount - currentValidCount;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white max-w-4xl w-full rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              {activeEntity === 'STUDENTS' ? (
                <Users className="w-5 h-5" />
              ) : (
                <Briefcase className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Bulk Registration & Onboarding Hub
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                  Batch Processor
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Fast-track onboarding for students and teachers via Excel/CSV, quick-paste, or interactive entry
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setCommitSummary(null);
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Entity Selector Bar (Students vs Teachers) */}
        {!commitSummary && (
          <div className="bg-slate-800/90 border-b border-slate-700/80 p-2 sm:px-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setActiveEntity('STUDENTS');
                  setStagedFilter('ALL');
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeEntity === 'STUDENTS'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Students Roster</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/60 text-slate-200">
                  {students.length} on roll
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveEntity('TEACHERS');
                  setStagedFilter('ALL');
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeEntity === 'TEACHERS'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Teachers & Staff</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/60 text-slate-200">
                  {allUsers.length} staff
                </span>
              </button>
            </div>

            {/* Template Download Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  activeEntity === 'STUDENTS'
                    ? handleDownloadStudentTemplate('xlsx')
                    : handleDownloadTeacherTemplate('xlsx')
                }
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-100 border border-slate-600 transition-colors"
                title="Download pre-formatted Excel template"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download {activeEntity === 'STUDENTS' ? 'Student' : 'Staff'} Template</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* POST-COMMIT SUMMARY VIEW */}
          {commitSummary ? (
            <div className="space-y-6 py-4">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2 shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Batch Transaction Completed! 🎉
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Successfully committed {commitSummary.insertedCount}{' '}
                  {commitSummary.entity === 'STUDENTS' ? 'students' : 'staff members'} into the
                  official school register.
                </p>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <div className="text-2xl font-black text-emerald-800 font-mono">
                    {commitSummary.insertedCount}
                  </div>
                  <div className="text-xs font-bold text-emerald-900 mt-0.5">
                    Successfully Onboarded
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-2xl font-black text-slate-700 font-mono">
                    {commitSummary.failedCount}
                  </div>
                  <div className="text-xs font-bold text-slate-600 mt-0.5">
                    Skipped / Errors
                  </div>
                </div>
              </div>

              {/* Roster of Inserted Items */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2 max-h-56 overflow-y-auto">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Committed Records ({commitSummary.insertedItems.length})
                </div>
                <div className="divide-y divide-slate-200">
                  {commitSummary.insertedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="py-2 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{item.primary}</span>
                        <span className="text-slate-500 text-[11px] ml-2 font-mono">
                          {item.secondary}
                        </span>
                      </div>
                      {item.tag && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white border border-slate-200 text-slate-700">
                          {item.tag}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Navigation Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCommitSummary(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-xs"
                >
                  Onboard More Records
                </button>

                {commitSummary.entity === 'STUDENTS' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        setActiveTab('take-attendance');
                      }}
                      className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Take Attendance Now</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        setActiveTab('students');
                      }}
                      className="px-4 py-2 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-xl shadow-xs"
                    >
                      View Student Register
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        setActiveTab('settings');
                      }}
                      className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs flex items-center gap-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                      <span>View Staff in Settings</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        setActiveTab('classes');
                      }}
                      className="px-4 py-2 text-xs font-bold text-blue-800 bg-blue-100 hover:bg-blue-200 rounded-xl shadow-xs"
                    >
                      Manage Class Teachers
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* ENTITY CONTEXT BANNER */}
              {activeEntity === 'STUDENTS' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Default Target Class */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Default Target Class & Arm
                    </label>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassIdState(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.arm} (
                          {students.filter((s) => s.classId === c.id).length} on roll)
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500">
                      Applied to rows without an explicit Class Name column in your file.
                    </p>
                  </div>

                  {/* Requirements / Guidelines */}
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider block">
                        Student Import Guidelines
                      </span>
                      <p className="text-[11px] text-emerald-800 mt-1">
                        Mandatory: <strong>Admission Number</strong>, <strong>First Name</strong>, <strong>Last Name</strong>, and <strong>Gender</strong>.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDownloadStudentTemplate('xlsx')}
                        className="px-2.5 py-1 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-2xs flex items-center gap-1.5"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Download .xlsx</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadStudentTemplate('csv')}
                        className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .csv</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Teacher Guidelines */}
                  <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
                    <span className="text-[11px] font-bold text-blue-950 uppercase tracking-wider block">
                      Teacher & Staff Authorization Guidelines
                    </span>
                    <p className="text-[11px] text-blue-900 leading-snug">
                      Mandatory: <strong>Full Name</strong> and <strong>Email Address</strong>. Optional: <strong>Role</strong>, <strong>Assigned Class(es)</strong>, <strong>Phone</strong>, and <strong>Subject</strong>.
                    </p>
                    <p className="text-[11px] text-blue-700">
                      If assigned classes match existing unassigned class arms, this teacher will be made Form Master!
                    </p>
                  </div>

                  {/* Teacher Template Actions */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                        Staff Template & Sample Data
                      </span>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Pre-populated with Nigerian teaching roles, classes, and subjects.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDownloadTeacherTemplate('xlsx')}
                        className="px-2.5 py-1 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded-lg shadow-2xs flex items-center gap-1.5"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Download .xlsx</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadTeacherTemplate('csv')}
                        className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .csv</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tabs: Upload File / Quick Paste / Fast Grid */}
              <div>
                <div className="flex border-b border-slate-200 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTabMode('FILE')}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                      activeTab === 'FILE'
                        ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Excel / CSV File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTabMode('PASTE')}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                      activeTab === 'PASTE'
                        ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    <span>Spreadsheet Quick Paste</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTabMode('FAST_GRID')}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                      activeTab === 'FAST_GRID'
                        ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TableIcon className="w-4 h-4" />
                    <span>Manual Fast Entry Grid</span>
                  </button>
                </div>

                {/* TAB 1: FILE UPLOAD */}
                {activeTab === 'FILE' && (
                  <div className="pt-4 space-y-3">
                    <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/30 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all text-center group">
                      <div className="w-12 h-12 rounded-full bg-white shadow-xs border border-slate-200 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">
                        {activeEntity === 'STUDENTS'
                          ? studentFileName
                            ? `Selected: ${studentFileName}`
                            : 'Click to select or drag & drop student spreadsheet'
                          : teacherFileName
                          ? `Selected: ${teacherFileName}`
                          : 'Click to select or drag & drop staff spreadsheet'}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5">
                        Supports .xlsx, .xls, and .csv files
                      </span>
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {/* TAB 2: SPREADSHEET QUICK PASTE */}
                {activeTab === 'PASTE' && (
                  <div className="pt-4 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Paste rows copied from Excel, Google Sheets, or CSV table:
                      </label>
                      <textarea
                        rows={6}
                        placeholder={
                          activeEntity === 'STUDENTS'
                            ? 'DIS/2026/101\tOluwaseun\tAdeleke\tMALE\t08031234567\nDIS/2026/102\tFatima\tMohammed\tFEMALE\t08098765432'
                            : 'Mr. Babatunde Fashola\tbabatunde.fashola@school.edu.ng\tTEACHER\t08031234567\tJSS 1 A\nMrs. Ngozi Okonjo\tngozi.okonjo@school.edu.ng\tTEACHER\t08029876543\tJSS 2 A'
                        }
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        className="w-full p-3 font-mono text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        {pasteText.trim()
                          ? `${pasteText.trim().split('\n').length} rows detected`
                          : 'Tab or comma separated format supported'}
                      </span>
                      <button
                        type="button"
                        onClick={handleParsePastedText}
                        disabled={!pasteText.trim()}
                        className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Parse & Stage Rows</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 3: MANUAL FAST ENTRY GRID */}
                {activeTab === 'FAST_GRID' && (
                  <div className="pt-4 space-y-3">
                    {activeEntity === 'STUDENTS' ? (
                      <>
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                          <div className="overflow-x-auto max-h-60">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0">
                                <tr>
                                  <th className="p-2 w-10 text-center">#</th>
                                  <th className="p-2 min-w-[130px]">Adm. No.</th>
                                  <th className="p-2 min-w-[130px]">First Name</th>
                                  <th className="p-2 min-w-[130px]">Last Name</th>
                                  <th className="p-2 w-28">Gender</th>
                                  <th className="p-2 min-w-[130px]">Parent Phone</th>
                                  <th className="p-2 w-12 text-center"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {studentManualRows.map((r, i) => (
                                  <tr key={i} className="hover:bg-slate-50">
                                    <td className="p-2 text-center text-slate-400 font-mono">
                                      {i + 1}
                                    </td>
                                    <td className="p-1">
                                      <input
                                        type="text"
                                        placeholder={`DIS/2026/${(students.length + i + 1)
                                          .toString()
                                          .padStart(3, '0')}`}
                                        value={r.admissionNumber}
                                        onChange={(e) => {
                                          const next = [...studentManualRows];
                                          next[i].admissionNumber = e.target.value;
                                          setStudentManualRows(next);
                                        }}
                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-mono"
                                      />
                                    </td>
                                    <td className="p-1">
                                      <input
                                        type="text"
                                        placeholder="e.g. Oluwaseun"
                                        value={r.firstName}
                                        onChange={(e) => {
                                          const next = [...studentManualRows];
                                          next[i].firstName = e.target.value;
                                          setStudentManualRows(next);
                                        }}
                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                                      />
                                    </td>
                                    <td className="p-1">
                                      <input
                                        type="text"
                                        placeholder="e.g. Adeleke"
                                        value={r.lastName}
                                        onChange={(e) => {
                                          const next = [...studentManualRows];
                                          next[i].lastName = e.target.value;
                                          setStudentManualRows(next);
                                        }}
                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                                      />
                                    </td>
                                    <td className="p-1">
                                      <select
                                        value={r.gender}
                                        onChange={(e) => {
                                          const next = [...studentManualRows];
                                          next[i].gender = e.target.value as Gender;
                                          setStudentManualRows(next);
                                        }}
                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                                      >
                                        <option value="MALE">Male</option>
                                        <option value="FEMALE">Female</option>
                                      </select>
                                    </td>
                                    <td className="p-1">
                                      <input
                                        type="text"
                                        placeholder="08031234567"
                                        value={r.parentPhone}
                                        onChange={(e) => {
                                          const next = [...studentManualRows];
                                          next[i].parentPhone = e.target.value;
                                          setStudentManualRows(next);
                                        }}
                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                                      />
                                    </td>
                                    <td className="p-1 text-center">
                                      {studentManualRows.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setStudentManualRows(
                                              studentManualRows.filter((_, idx) => idx !== i)
                                            )
                                          }
                                          className="text-slate-400 hover:text-rose-600 p-1"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() =>
                              setStudentManualRows([
                                ...studentManualRows,
                                {
                                  admissionNumber: '',
                                  firstName: '',
                                  lastName: '',
                                  gender: 'MALE',
                                  parentPhone: '',
                                },
                              ])
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Row</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleStageStudentFastGrid}
                            className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Stage Grid Students</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                          <div className="overflow-x-auto max-h-60">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0">
                                <tr>
                                  <th className="p-2 w-10 text-center">#</th>
                                  <th className="p-2 min-w-[140px]">Staff Full Name</th>
                                  <th className="p-2 min-w-[150px]">Email Address</th>
                                  <th className="p-2 w-28">Role</th>
                                  <th className="p-2 min-w-[120px]">Assigned Class</th>
                                  <th className="p-2 min-w-[110px]">Subject</th>
                                  <th className="p-2 w-12 text-center"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {teacherManualRows.map((r, i) => (
                                  <tr key={i} className="hover:bg-slate-50">
                                    <td className="p-2 text-center text-slate-400 font-mono">
                                      {i + 1}
                                    </td>
                                    <td className="p-1">
                                      <input
                                        type="text"
                                        placeholder="e.g. Mr. Babatunde"
                                        value={r.name}
                                        onChange={(e) => {
                                          const next = [...teacherManualRows];
                                          next[i].name = e.target.value;
                                          setTeacherManualRows(next);
                                        }}
                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                                      />
                                    </td>
                                    <td className="p-1">
                                      <input
                                        type="email"
                                        placeholder="staff@school.edu.ng"
                                        value={r.email}
                                        onChange={(e) => {
                                          const next = [...teacherManualRows];
                                          next[i].email = e.target.value;
                                          setTeacherManualRows(next);
                                        }}
                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-mono"
                                      />
                                    </td>
                                    <td className="p-1">
                                      <select
                                        value={r.role}
                                        onChange={(e) => {
                                          const next = [...teacherManualRows];
                                          next[i].role = e.target.value as UserRole;
                                          setTeacherManualRows(next);
                                        }}
                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                                      >
                                        <option value="TEACHER">Teacher</option>
                                        <option value="SCHOOL_ADMIN">Admin</option>
                                        <option value="VIEWER">Viewer</option>
                                        <option value="SUPER_ADMIN">Super Admin</option>
                                      </select>
                                    </td>
                                    <td className="p-1">
                                      <select
                                        value={r.assignedClassId}
                                        onChange={(e) => {
                                          const next = [...teacherManualRows];
                                          next[i].assignedClassId = e.target.value;
                                          setTeacherManualRows(next);
                                        }}
                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                                      >
                                        <option value="">General / None</option>
                                        {classes.map((c) => (
                                          <option key={c.id} value={c.id}>
                                            {c.name} {c.arm}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="p-1">
                                      <input
                                        type="text"
                                        placeholder="e.g. Mathematics"
                                        value={r.subject}
                                        onChange={(e) => {
                                          const next = [...teacherManualRows];
                                          next[i].subject = e.target.value;
                                          setTeacherManualRows(next);
                                        }}
                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                                      />
                                    </td>
                                    <td className="p-1 text-center">
                                      {teacherManualRows.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setTeacherManualRows(
                                              teacherManualRows.filter((_, idx) => idx !== i)
                                            )
                                          }
                                          className="text-slate-400 hover:text-rose-600 p-1"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() =>
                              setTeacherManualRows([
                                ...teacherManualRows,
                                {
                                  name: '',
                                  email: '',
                                  role: 'TEACHER',
                                  phone: '',
                                  assignedClassId: '',
                                  subject: '',
                                },
                              ])
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Staff Row</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleStageTeacherFastGrid}
                            className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Stage Grid Staff</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* STAGED PREVIEW & TRANSACTION REVIEW SECTION */}
              {currentStagedCount > 0 && (
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Staged {activeEntity === 'STUDENTS' ? 'Student' : 'Staff'} Roster ({currentStagedCount})
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        {currentValidCount} Valid
                      </span>
                      {currentInvalidCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                          {currentInvalidCount} Need Attention
                        </span>
                      )}
                    </div>

                    {/* Filter buttons */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setStagedFilter('ALL')}
                        className={`px-2 py-0.5 rounded ${
                          stagedFilter === 'ALL'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        All ({currentStagedCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStagedFilter('VALID')}
                        className={`px-2 py-0.5 rounded ${
                          stagedFilter === 'VALID'
                            ? 'bg-white text-emerald-800 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Valid ({currentValidCount})
                      </button>
                      {currentInvalidCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setStagedFilter('ERRORS')}
                          className={`px-2 py-0.5 rounded ${
                            stagedFilter === 'ERRORS'
                              ? 'bg-white text-rose-800 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Errors ({currentInvalidCount})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* STAGED TABLE: STUDENTS */}
                  {activeEntity === 'STUDENTS' && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto max-h-64">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0">
                            <tr>
                              <th className="p-2.5 w-10 text-center">#</th>
                              <th className="p-2.5 w-24">Status</th>
                              <th className="p-2.5 w-32">Adm. No.</th>
                              <th className="p-2.5 min-w-[140px]">Student Name</th>
                              <th className="p-2.5 w-20 text-center">Sex</th>
                              <th className="p-2.5 w-28">Class Arm</th>
                              <th className="p-2.5 min-w-[120px]">Parent Phone</th>
                              <th className="p-2.5 text-right w-12"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {stagedStudents
                              .filter((r) => {
                                if (stagedFilter === 'VALID') return r.isValid;
                                if (stagedFilter === 'ERRORS') return !r.isValid;
                                return true;
                              })
                              .map((r, i) => {
                                const cls = classes.find((c) => c.id === r.classId);
                                return (
                                  <tr
                                    key={r.rowId}
                                    className={
                                      r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'
                                    }
                                  >
                                    <td className="p-2.5 text-center text-slate-400 font-mono">
                                      {i + 1}
                                    </td>
                                    <td className="p-2.5">
                                      {r.isValid ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                          <Check className="w-3 h-3" /> Ready
                                        </span>
                                      ) : (
                                        <span
                                          className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800"
                                          title={r.errors.join(', ')}
                                        >
                                          <AlertCircle className="w-3 h-3" /> Error
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2.5 font-mono font-bold text-slate-800">
                                      {r.admissionNumber}
                                    </td>
                                    <td className="p-2.5 font-semibold text-slate-900">
                                      <div>
                                        {r.lastName.toUpperCase()}, {r.firstName}{' '}
                                        {r.middleName || ''}
                                      </div>
                                      {!r.isValid && (
                                        <div className="text-[10px] text-rose-600 mt-0.5 font-normal">
                                          {r.errors.join(' · ')}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-center font-semibold">
                                      <span
                                        className={
                                          r.gender === 'MALE'
                                            ? 'text-blue-600'
                                            : 'text-pink-600'
                                        }
                                      >
                                        {r.gender === 'MALE' ? 'M' : 'F'}
                                      </span>
                                    </td>
                                    <td className="p-2.5 font-medium text-slate-700">
                                      {cls ? `${cls.name} ${cls.arm}` : r.arm}
                                    </td>
                                    <td className="p-2.5 font-mono text-slate-600">
                                      {r.parentPhone || '—'}
                                    </td>
                                    <td className="p-2.5 text-right">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setStagedStudents((prev) =>
                                            prev.filter((item) => item.rowId !== r.rowId)
                                          )
                                        }
                                        className="text-slate-400 hover:text-rose-600 p-1 rounded"
                                        title="Remove student row"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* STAGED TABLE: TEACHERS */}
                  {activeEntity === 'TEACHERS' && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto max-h-64">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0">
                            <tr>
                              <th className="p-2.5 w-10 text-center">#</th>
                              <th className="p-2.5 w-24">Status</th>
                              <th className="p-2.5 min-w-[140px]">Staff Name</th>
                              <th className="p-2.5 min-w-[150px]">Email</th>
                              <th className="p-2.5 w-28">Role</th>
                              <th className="p-2.5 min-w-[130px]">Assigned Class(es)</th>
                              <th className="p-2.5 min-w-[110px]">Subject</th>
                              <th className="p-2.5 text-right w-12"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {stagedTeachers
                              .filter((r) => {
                                if (stagedFilter === 'VALID') return r.isValid;
                                if (stagedFilter === 'ERRORS') return !r.isValid;
                                return true;
                              })
                              .map((r, i) => (
                                <tr
                                  key={r.rowId}
                                  className={
                                    r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'
                                  }
                                >
                                  <td className="p-2.5 text-center text-slate-400 font-mono">
                                    {i + 1}
                                  </td>
                                  <td className="p-2.5">
                                    {r.isValid ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                        <Check className="w-3 h-3" /> Ready
                                      </span>
                                    ) : (
                                      <span
                                        className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800"
                                        title={r.errors.join(', ')}
                                      >
                                        <AlertCircle className="w-3 h-3" /> Error
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2.5 font-semibold text-slate-900">
                                    <div>{r.name}</div>
                                    {!r.isValid && (
                                      <div className="text-[10px] text-rose-600 mt-0.5 font-normal">
                                        {r.errors.join(' · ')}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-2.5 font-mono text-slate-700">
                                    {r.email}
                                  </td>
                                  <td className="p-2.5 font-semibold text-slate-800 font-mono">
                                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                                      {r.role}
                                    </span>
                                  </td>
                                  <td className="p-2.5 font-medium text-slate-700">
                                    {r.assignedClassLabels || 'None'}
                                  </td>
                                  <td className="p-2.5 text-slate-600">
                                    {r.subject || '—'}
                                  </td>
                                  <td className="p-2.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setStagedTeachers((prev) =>
                                          prev.filter((item) => item.rowId !== r.rowId)
                                        )
                                      }
                                      className="text-slate-400 hover:text-rose-600 p-1 rounded"
                                      title="Remove staff row"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Transaction Commit Bar */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (activeEntity === 'STUDENTS') {
                          setStagedStudents([]);
                        } else {
                          setStagedTeachers([]);
                        }
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors"
                    >
                      Clear Staged Roster
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-xs"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={
                          activeEntity === 'STUDENTS'
                            ? handleCommitStudents
                            : handleCommitTeachers
                        }
                        disabled={isProcessing || currentValidCount === 0}
                        className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl shadow-md transition-all flex items-center gap-2"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Processing Batch Transaction...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>
                              Commit & Enroll {currentValidCount}{' '}
                              {activeEntity === 'STUDENTS' ? 'Students' : 'Teachers'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
