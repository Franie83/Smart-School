// Academic Assessment, Grading, Ranking & Report Card Engine
import {
  AssessmentScore,
  AttendanceRecord,
  CalendarDay,
  School,
  SchoolClass,
  Student,
  StudentReportCard,
  Term,
} from '../types/attendance';
import {
  calculateStudentAttendanceSummary,
  getSchoolDaysInRange,
} from './calculationEngine';

/**
 * Standard Grading Scale for Nigerian & International Secondary Schools
 * 75-100: A (Excellent)
 * 65-74:  B (Very Good)
 * 50-64:  C (Credit)
 * 45-49:  D (Pass)
 * 40-44:  E (Fair)
 * 0-39:   F (Fail)
 */
export function calculateGradeAndRemark(totalScore: number): {
  grade: string;
  remark: string;
} {
  const rounded = Math.round(totalScore * 10) / 10;
  if (rounded >= 75) {
    return { grade: 'A', remark: 'Excellent' };
  } else if (rounded >= 65) {
    return { grade: 'B', remark: 'Very Good' };
  } else if (rounded >= 50) {
    return { grade: 'C', remark: 'Credit' };
  } else if (rounded >= 45) {
    return { grade: 'D', remark: 'Pass' };
  } else if (rounded >= 40) {
    return { grade: 'E', remark: 'Fair' };
  } else {
    return { grade: 'F', remark: 'Fail' };
  }
}

/**
 * Formats rank position as ordinal string (1st, 2nd, 3rd, 4th, etc.)
 */
export function formatOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Generates an automated yet personal Form Master remark linking academic performance
 * directly to the student's attendance & punctuality discipline.
 */
export function generateCorrelatedFormMasterRemark(
  avgPct: number,
  rank: number,
  totalStudents: number,
  attPct: number,
  lateCount: number,
  punctualityTier: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT'
): string {
  const isTopTierAcademic = avgPct >= 75 || rank <= 3;
  const isGoodAcademic = avgPct >= 60;
  const isFairAcademic = avgPct >= 50;

  const isExcellentAttendance = attPct >= 92 && lateCount <= 1;
  const hasAttendanceIssues = attPct < 80 || lateCount >= 4;

  if (isTopTierAcademic && isExcellentAttendance) {
    return 'An exceptionally brilliant student with an exemplary attendance and punctuality record. Displays high diligence, self-discipline, and strong leadership.';
  }

  if (isTopTierAcademic && hasAttendanceIssues) {
    return 'Demonstrates remarkable cognitive mastery and intellect. However, punctuality and regular attendance must be improved to sustain top scholastic standing.';
  }

  if (isGoodAcademic && isExcellentAttendance) {
    return 'A very dedicated, focused, and punctual student. Participates actively in lessons and shows commendable academic progress.';
  }

  if (isGoodAcademic && hasAttendanceIssues) {
    return 'Good academic effort shown. Lateness and absences have occasionally disrupted continuity; strive for better consistency next term.';
  }

  if (isFairAcademic && isExcellentAttendance) {
    return 'Consistently punctual and well-behaved. With sustained revision and extra focus on core subjects, higher grades are well within reach.';
  }

  if (avgPct < 50 && hasAttendanceIssues) {
    return 'Academic performance was severely impacted by frequent absences and late arrivals. Strict parental monitoring and daily attendance are urgently required.';
  }

  if (avgPct < 50) {
    return 'Struggled across several subjects this term. Needs intensive remedial practice and focused study habits to achieve the desired pass standard.';
  }

  return 'A well-behaved student who shows positive potential. Encouraged to aim higher and maintain punctual attendance next term.';
}

/**
 * Generates Principal's Terminal Remark
 */
export function generatePrincipalRemark(
  rank: number,
  totalStudents: number,
  avgPct: number
): string {
  if (rank === 1) {
    return 'Outstanding accomplishment! 1st Position in class. A role model of scholastic excellence. Keep it up!';
  } else if (rank <= 3) {
    return 'Commendable result! Finished in the top three of the class. Continue striving for the pinnacle.';
  } else if (avgPct >= 70) {
    return 'A very impressive performance. Promoted with pride and high commendations.';
  } else if (avgPct >= 50) {
    return 'Satisfactory progress made this term. With added dedication, much higher honors can be attained.';
  } else {
    return 'More diligence and regular attendance required next term for improved results.';
  }
}

/**
 * Core Ranking & Report Card Compilation Engine
 * 1. Computes benchmark stats per subject (Class Max, Min, Avg)
 * 2. Assigns subject positions
 * 3. Aggregates student total scores & averages
 * 4. Assigns overall Class Rank (1st, 2nd, 3rd with tie resolution)
 * 5. Pulls attendance metrics for each student from attendance register
 * 6. Prepares comprehensive StudentReportCard objects
 */
export function generateClassRankingsAndReportCards(params: {
  school: School;
  activeClass: SchoolClass;
  activeTerm: Term;
  sessionName: string;
  enrolledStudents: Student[];
  allAssessmentScores: AssessmentScore[];
  attendanceRecords: AttendanceRecord[];
  calendarDays: CalendarDay[];
  resumptionDate?: string;
}): StudentReportCard[] {
  const {
    school,
    activeClass,
    activeTerm,
    sessionName,
    enrolledStudents,
    allAssessmentScores,
    attendanceRecords,
    calendarDays,
    resumptionDate,
  } = params;

  // Active students on roll
  const studentsOnRoll = enrolledStudents.filter(
    (s) => s.classId === activeClass.id && s.status === 'ACTIVE'
  );

  // Filter assessment scores for this class & term
  const classScores = allAssessmentScores.filter(
    (sc) => sc.classId === activeClass.id && sc.termId === activeTerm.id
  );

  // Group scores by subject to calculate subject benchmarks & positions
  const subjectGroups: Record<string, AssessmentScore[]> = {};
  classScores.forEach((sc) => {
    if (!subjectGroups[sc.subjectId]) {
      subjectGroups[sc.subjectId] = [];
    }
    subjectGroups[sc.subjectId].push(sc);
  });

  // Calculate subject benchmarks and positions
  const enrichedScoresMap: Record<string, AssessmentScore> = {};

  Object.entries(subjectGroups).forEach(([subjectId, scores]) => {
    if (scores.length === 0) return;
    const totals = scores.map((s) => s.totalScore);
    const maxScore = Math.max(...totals);
    const minScore = Math.min(...totals);
    const avgScore =
      Math.round((totals.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;

    // Sort descending by totalScore to determine subject positions
    const sorted = [...scores].sort((a, b) => b.totalScore - a.totalScore);

    let currentRank = 1;
    sorted.forEach((sc, idx) => {
      if (idx > 0 && sc.totalScore < sorted[idx - 1].totalScore) {
        currentRank = idx + 1;
      }
      enrichedScoresMap[`${sc.studentId}_${sc.subjectId}`] = {
        ...sc,
        classHighest: maxScore,
        classLowest: minScore,
        classAverage: avgScore,
        subjectPosition: currentRank,
      };
    });
  });

  // School opening days in this term
  const schoolDaysInTerm = getSchoolDaysInRange(
    activeTerm.startDate,
    activeTerm.endDate,
    calendarDays,
    school.schoolDaysOfWeek
  );

  // Compile individual student totals and attendance
  const studentEvaluations = studentsOnRoll.map((student) => {
    // Find all student scores for this term
    const studentScores = Object.values(enrichedScoresMap).filter(
      (sc) => sc.studentId === student.id
    );

    const totalScoreObtained = studentScores.reduce(
      (sum, sc) => sum + sc.totalScore,
      0
    );
    const totalPossibleScore = studentScores.length * 100;
    const averagePercentage =
      studentScores.length > 0
        ? Math.round((totalScoreObtained / studentScores.length) * 10) / 10
        : 0;

    const { grade: overallGrade, remark: overallRemark } =
      calculateGradeAndRemark(averagePercentage);

    // Calculate student attendance summary
    const attSummary = calculateStudentAttendanceSummary(
      student,
      schoolDaysInTerm,
      attendanceRecords
    );

    const totalSessionsOpened = attSummary.possibleSessions;
    const sessionsAttended = attSummary.totalSessionsAttended;
    const sessionsAbsent =
      attSummary.morningAbsent + attSummary.afternoonAbsent;
    const sessionsLate = attSummary.totalLate;
    const attendancePercentage = attSummary.attendancePercentage;
    const punctualityScore =
      student.punctualityScore !== undefined
        ? student.punctualityScore
        : attSummary.punctualityScore;
    const punctualityTier =
      student.punctualityTier || attSummary.punctualityTier;

    let summaryRemark = 'Good attendance record';
    if (attendancePercentage >= 95 && sessionsLate === 0) {
      summaryRemark = 'Flawless 100% attendance & perfect punctuality';
    } else if (attendancePercentage >= 90) {
      summaryRemark = 'Commendable attendance consistency';
    } else if (sessionsLate >= 5) {
      summaryRemark = 'Frequent morning lateness noted';
    } else if (attendancePercentage < 75) {
      summaryRemark = 'Poor attendance record; urgent improvement needed';
    }

    return {
      student,
      scores: studentScores,
      totalScoreObtained,
      totalPossibleScore,
      averagePercentage,
      overallGrade,
      overallRemark,
      attendance: {
        totalSessionsOpened,
        sessionsAttended,
        sessionsAbsent,
        sessionsLate,
        attendancePercentage,
        punctualityScore,
        punctualityTier,
        summaryRemark,
      },
    };
  });

  // Sort students descending by average percentage (then total score) for class ranking
  studentEvaluations.sort((a, b) => {
    if (b.averagePercentage !== a.averagePercentage) {
      return b.averagePercentage - a.averagePercentage;
    }
    return b.totalScoreObtained - a.totalScoreObtained;
  });

  const totalStudentsInClass = studentEvaluations.length;

  // Build final report cards with ranks and remarks
  let currentClassRank = 1;
  const reportCards: StudentReportCard[] = studentEvaluations.map(
    (item, idx) => {
      if (
        idx > 0 &&
        item.averagePercentage <
          studentEvaluations[idx - 1].averagePercentage
      ) {
        currentClassRank = idx + 1;
      }

      const formMasterRemark = generateCorrelatedFormMasterRemark(
        item.averagePercentage,
        currentClassRank,
        totalStudentsInClass,
        item.attendance.attendancePercentage,
        item.attendance.sessionsLate,
        item.attendance.punctualityTier
      );

      const principalRemark = generatePrincipalRemark(
        currentClassRank,
        totalStudentsInClass,
        item.averagePercentage
      );

      const cleanAdm = (item.student.admissionNumber || item.student.id).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const verificationCode = `VER-${cleanAdm}`;
      const reportCardId = `rc_${activeTerm.id}_${item.student.id}`;

      return {
        id: reportCardId,
        verificationCode,
        studentId: item.student.id,
        student: item.student,
        classId: activeClass.id,
        className: `${activeClass.name} ${activeClass.arm}`,
        termId: activeTerm.id,
        termName: activeTerm.name,
        sessionId: activeTerm.sessionId,
        sessionName: sessionName,
        scores: item.scores,
        totalScoreObtained: item.totalScoreObtained,
        totalPossibleScore: item.totalPossibleScore,
        averagePercentage: item.averagePercentage,
        positionInClass: currentClassRank,
        totalStudentsInClass,
        overallGrade: item.overallGrade,
        overallRemark: item.overallRemark,
        attendance: item.attendance,
        formMasterRemark,
        principalRemark,
        resumptionDate: resumptionDate || '2027-01-11',
        generatedAt: new Date().toISOString(),
      };
    }
  );

  return reportCards;
}
