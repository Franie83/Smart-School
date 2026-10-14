// Export Engine for Smart School Attendance Register
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { School, StudentAttendanceSummary, TerminalClassSummary } from '../types/attendance';

export function exportTerminalReportToPDF(params: {
  school: School;
  sessionName: string;
  termName: string;
  className: string;
  teacherName: string;
  summary: TerminalClassSummary;
}) {
  const { school, sessionName, termName, className, teacherName, summary } = params;

  // Landscape A4 for wide attendance ledger layout
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(school.name.toUpperCase(), pageWidth / 2, 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${school.address} · Phone: ${school.phone} · Email: ${school.email}`,
    pageWidth / 2,
    19,
    { align: 'center' }
  );

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(14, 22, pageWidth - 14, 22);

  // Title & Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('OFFICIAL TERMINAL ATTENDANCE REGISTER & SUMMARY', pageWidth / 2, 28, {
    align: 'center',
  });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Academic Session: ${sessionName}`, 14, 34);
  doc.text(`Term: ${termName}`, 80, 34);
  doc.text(`Class: ${className}`, 140, 34);
  doc.text(`Form Teacher: ${teacherName}`, 200, 34);

  // Table Data
  const tableHead = [
    [
      'No.',
      'Adm. No.',
      'Student Name',
      'Sex',
      'Days Enrolled',
      'Morn. Pres.',
      'Aft. Pres.',
      'Total Att.',
      'Poss. Sess.',
      'Att. %',
      'Late Count',
      'Punct. %',
      'Status',
    ],
  ];

  const tableBody = summary.studentSummaries.map((s: StudentAttendanceSummary, idx: number) => [
    idx + 1,
    s.student.admissionNumber,
    `${s.student.lastName.toUpperCase()}, ${s.student.firstName} ${s.student.middleName || ''}`,
    s.student.gender === 'MALE' ? 'M' : 'F',
    s.daysEnrolled,
    s.morningPresent,
    s.afternoonPresent,
    s.totalSessionsAttended,
    s.possibleSessions,
    `${s.attendancePercentage.toFixed(1)}%`,
    s.totalLate,
    `${s.punctualityPercentage.toFixed(1)}%`,
    s.student.status,
  ]);

  autoTable(doc, {
    startY: 38,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 24 },
      2: { cellWidth: 50 },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'center', cellWidth: 16 },
      7: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
      8: { halign: 'center', cellWidth: 16 },
      9: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      10: { halign: 'center', cellWidth: 16 },
      11: { halign: 'center', cellWidth: 18 },
      12: { halign: 'center', cellWidth: 20 },
    },
    margin: { left: 14, right: 14 },
  });

  // Terminal Statistical Summary Box
  const finalY = (doc as any).lastAutoTable.finalY + 6;

  if (finalY < 165) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('TERMINAL STATISTICAL SUMMARY', 14, finalY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    const statsCol1 = [
      `Number on Roll: ${summary.totalStudentsOnRoll} (Boys: ${summary.totalBoysOnRoll}, Girls: ${summary.totalGirlsOnRoll})`,
      `Days School Opened: ${summary.schoolOpeningDays}`,
      `Total Possible Sessions: ${summary.totalPossibleSessions}`,
    ];

    const statsCol2 = [
      `Morning Attendance Total: ${summary.totalMorningPresent}`,
      `Afternoon Attendance Total: ${summary.totalAfternoonPresent}`,
      `Total Sessions Attended: ${summary.totalSessionsAttended}`,
    ];

    const statsCol3 = [
      `Overall Class Attendance: ${summary.overallAttendancePercentage.toFixed(2)}%`,
      `Boys Attendance: ${summary.boysAttendancePercentage.toFixed(2)}% · Girls: ${summary.girlsAttendancePercentage.toFixed(2)}%`,
      `Overall Punctuality: ${summary.overallPunctualityPercentage.toFixed(2)}% (Late: ${summary.totalLateCount})`,
    ];

    statsCol1.forEach((text, i) => doc.text(text, 14, finalY + 5 + i * 4.5));
    statsCol2.forEach((text, i) => doc.text(text, 110, finalY + 5 + i * 4.5));
    statsCol3.forEach((text, i) => doc.text(text, 200, finalY + 5 + i * 4.5));

    // Signatures
    const sigY = finalY + 24;
    doc.setDrawColor(148, 163, 184);
    doc.line(14, sigY + 6, 80, sigY + 6);
    doc.text("Class Teacher's Signature & Date", 14, sigY + 10);

    doc.line(200, sigY + 6, 270, sigY + 6);
    doc.text("Principal / Head Teacher's Stamp & Signature", 200, sigY + 10);
  }

  doc.save(`${className}_Terminal_Attendance_Report.pdf`);
}

export function exportTerminalReportToExcel(params: {
  school: School;
  sessionName: string;
  termName: string;
  className: string;
  summary: TerminalClassSummary;
}) {
  const { school, sessionName, termName, className, summary } = params;

  const data = summary.studentSummaries.map((s: StudentAttendanceSummary, idx: number) => ({
    'No.': idx + 1,
    'Admission Number': s.student.admissionNumber,
    'Last Name': s.student.lastName,
    'First Name': s.student.firstName,
    'Middle Name': s.student.middleName || '',
    Gender: s.student.gender,
    Status: s.student.status,
    'Days Enrolled': s.daysEnrolled,
    'Days School Opened': s.daysSchoolOpened,
    'Morning Present': s.morningPresent,
    'Afternoon Present': s.afternoonPresent,
    'Total Sessions Attended': s.totalSessionsAttended,
    'Possible Sessions': s.possibleSessions,
    'Attendance %': s.attendancePercentage,
    'Morning Late': s.morningLate,
    'Afternoon Late': s.afternoonLate,
    'Total Late': s.totalLate,
    'Punctuality %': s.punctualityPercentage,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Terminal Attendance');

  // Also append class summary sheet
  const summarySheetData = [
    { Metric: 'School', Value: school.name },
    { Metric: 'Academic Session', Value: sessionName },
    { Metric: 'Term', Value: termName },
    { Metric: 'Class', Value: className },
    { Metric: 'Days School Opened', Value: summary.schoolOpeningDays },
    { Metric: 'Students on Roll', Value: summary.totalStudentsOnRoll },
    { Metric: 'Boys on Roll', Value: summary.totalBoysOnRoll },
    { Metric: 'Girls on Roll', Value: summary.totalGirlsOnRoll },
    { Metric: 'Morning Attendance Total', Value: summary.totalMorningPresent },
    { Metric: 'Afternoon Attendance Total', Value: summary.totalAfternoonPresent },
    { Metric: 'Total Sessions Attended', Value: summary.totalSessionsAttended },
    { Metric: 'Total Possible Sessions', Value: summary.totalPossibleSessions },
    { Metric: 'Overall Attendance %', Value: summary.overallAttendancePercentage },
    { Metric: 'Boys Attendance %', Value: summary.boysAttendancePercentage },
    { Metric: 'Girls Attendance %', Value: summary.girlsAttendancePercentage },
    { Metric: 'Total Late Marks', Value: summary.totalLateCount },
    { Metric: 'Overall Punctuality %', Value: summary.overallPunctualityPercentage },
  ];
  const summaryWorksheet = XLSX.utils.json_to_sheet(summarySheetData);
  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary Statistics');

  XLSX.writeFile(workbook, `${className}_Terminal_Attendance_${sessionName}.xlsx`);
}

export function exportWeeklyReportToCSV(params: {
  className: string;
  weekDates: { date: string; label: string }[];
  rows: any[];
}) {
  const headers = [
    'No.',
    'Admission Number',
    'Student Name',
    'Gender',
    ...params.weekDates.flatMap((d) => [
      `${d.label} Morning`,
      `${d.label} Afternoon`,
      `${d.label} Symbol`,
    ]),
    'Weekly Attended',
    'Weekly Possible',
    'Weekly %',
    'Late Count',
  ];

  const csvRows = [headers.join(',')];

  params.rows.forEach((r, idx) => {
    const rowValues = [
      idx + 1,
      `"${r.admissionNumber}"`,
      `"${r.name}"`,
      r.gender,
      ...params.weekDates.flatMap((d) => [
        r.days[d.date]?.morning || '—',
        r.days[d.date]?.afternoon || '—',
        `"${r.days[d.date]?.symbol || '—'}"`,
      ]),
      r.totalAttended,
      r.possibleSessions,
      `"${r.attendancePercentage}%"`,
      r.lateCount,
    ];
    csvRows.push(rowValues.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${params.className}_Weekly_Attendance.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
