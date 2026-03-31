// src/components/TeacherDashboard.jsx
import React, { useState, useEffect } from "react";
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // 👈 Import autotable
import spectropyLogoUrl from '../assets/logo.png';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

function normalizeClassSection(classValue, sectionValue) {
  return `${String(classValue || 'N/A').trim()}-${String(sectionValue || 'N/A').trim()}`;
}

function normalizeSubjectName(subject) {
  const normalized = String(subject || '').trim().toLowerCase();
  if (normalized === 'physics') return 'Physics';
  if (normalized === 'chemistry') return 'Chemistry';
  if (normalized === 'biology') return 'Biology';
  if (normalized === 'maths' || normalized === 'math' || normalized === 'mathematics') return 'Maths';
  return String(subject || '').trim();
}

function isSameSubject(subjectA, subjectB) {
  return normalizeSubjectName(subjectA) === normalizeSubjectName(subjectB);
}

function formatTeacherMetric(value, { suffix = '' } = {}) {
  if (value == null || value === '' || value === 'N/A') return '-';
  return `${value}${suffix}`;
}

function buildTeacherPdfHeader(subject, classSection, metric) {
  return `${subject}\n${classSection}\n${metric}`;
}

function getCompactTeacherSubjectLabel(subject) {
  const normalized = normalizeSubjectName(subject);
  if (normalized === 'Physics') return 'Phy';
  if (normalized === 'Chemistry') return 'Chem';
  if (normalized === 'Biology') return 'Bio';
  if (normalized === 'Maths') return 'Math';
  return normalized.slice(0, 4) || 'Sub';
}

function buildAdaptiveTeacherPdfHeader(subject, classSection, metric, compact = false) {
  if (!compact) return buildTeacherPdfHeader(subject, classSection, metric);

  const compactMetricMap = {
    Avg: 'Avg',
    'School Rank': 'SR',
    AIR: 'AIR'
  };

  return `${getCompactTeacherSubjectLabel(subject)}\n${classSection}\n${compactMetricMap[metric] || metric}`;
}

function normalizeExamDate(examDate) {
  if (!examDate) return 'NO_DATE';
  return String(examDate).trim();
}

function buildTeacherExamIdentity({ program, exam_pattern, exam_date }) {
  return [
    String(program || 'N/A').trim(),
    String(exam_pattern || 'N/A').trim(),
    normalizeExamDate(exam_date)
  ].join('|');
}

function buildTeacherExamLabel({ program, exam_pattern, exam_date }) {
  const parts = [String(exam_pattern || 'N/A').trim()];
  if (program) parts.push(String(program).trim());
  if (exam_date) parts.push(String(exam_date).trim());
  return parts.join(' | ');
}

function getTeacherExamTypePriority(examPattern) {
  const normalized = String(examPattern || '').trim().toUpperCase();
  if (normalized.startsWith('WEEK_TEST')) return 0;
  if (normalized.startsWith('UNIT_TEST')) return 1;
  if (normalized.startsWith('GRAND_TEST')) return 2;
  return 3;
}

function compareTeacherExamRows(a, b) {
  const typeCompare = getTeacherExamTypePriority(a.exam_pattern) - getTeacherExamTypePriority(b.exam_pattern);
  if (typeCompare !== 0) return typeCompare;

  const dateA = normalizeExamDate(a.exam_date);
  const dateB = normalizeExamDate(b.exam_date);
  const dateCompare = dateA.localeCompare(dateB);
  if (dateCompare !== 0) return dateCompare;

  const patternCompare = String(a.exam_pattern || '').localeCompare(String(b.exam_pattern || ''));
  if (patternCompare !== 0) return patternCompare;

  return String(a.display_label || '').localeCompare(String(b.display_label || ''));
}

async function loadImageAsDataUrl(src) {
  if (!src || typeof src !== "string") return null;

  console.log("loadImageAsDataUrl input:", src);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        console.log("School logo image loaded:", {
          src,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Could not create image canvas."));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        console.log("School logo converted to data URL:", {
          src,
          dataUrlLength: dataUrl?.length || 0
        });
        resolve(dataUrl);
      } catch (error) {
        console.error("School logo canvas conversion failed:", { src, error });
        reject(error);
      }
    };

    img.onerror = (error) => {
      console.error("School logo image failed to load:", { src, error });
      reject(new Error(`Failed to load image: ${src}`));
    };
    img.src = src;
  });
}

// Helper: Compute exam patterns AND teacher-specific best week tests
function computeExamAnalytics(exams, teacherAssignments) {
  const assignments = Array.isArray(teacherAssignments) ? teacherAssignments : [];
  // Step 1: Group by full exam identity + class-section and compute subject averages
  const patternClassSectionMap = {};

  exams.forEach(exam => {
    const examIdentity = buildTeacherExamIdentity(exam);
    const classSection = normalizeClassSection(exam.class, exam.section);

    if (!patternClassSectionMap[examIdentity]) {
      patternClassSectionMap[examIdentity] = {
        program: exam.program || 'N/A',
        exam_pattern: exam.exam_pattern || 'N/A',
        exam_date: exam.exam_date || null,
        display_label: buildTeacherExamLabel(exam),
        classSectionData: {}
      };
    }
    if (!patternClassSectionMap[examIdentity].classSectionData[classSection]) {
      patternClassSectionMap[examIdentity].classSectionData[classSection] = {
        physics: [], chemistry: [], maths: [], biology: []
      };
    }

    const g = patternClassSectionMap[examIdentity].classSectionData[classSection];
    if (exam.physics_percentage != null && exam.physics_percentage !== '') {
      g.physics.push(parseFloat(exam.physics_percentage));
    }
    if (exam.chemistry_percentage != null && exam.chemistry_percentage !== '') {
      g.chemistry.push(parseFloat(exam.chemistry_percentage));
    }
    if (exam.maths_percentage != null && exam.maths_percentage !== '') {
      g.maths.push(parseFloat(exam.maths_percentage));
    }
    if (exam.biology_percentage != null && exam.biology_percentage !== '') {
      g.biology.push(parseFloat(exam.biology_percentage));
    }
  });

  // Step 2: Build examPatterns
  const examPatterns = Object.entries(patternClassSectionMap).map(([exam_key, meta]) => {
    const averagesByClassSection = {};
    for (const [cs, subjects] of Object.entries(meta.classSectionData)) {
      averagesByClassSection[cs] = {
        Physics: subjects.physics.length > 0
          ? (subjects.physics.reduce((a, b) => a + b, 0) / subjects.physics.length).toFixed(1)
          : null,
        Chemistry: subjects.chemistry.length > 0
          ? (subjects.chemistry.reduce((a, b) => a + b, 0) / subjects.chemistry.length).toFixed(1)
          : null,
        Biology: subjects.biology.length > 0
          ? (subjects.biology.reduce((a, b) => a + b, 0) / subjects.biology.length).toFixed(1)
          : null,
        Maths: subjects.maths.length > 0
          ? (subjects.maths.reduce((a, b) => a + b, 0) / subjects.maths.length).toFixed(1)
          : null,
      };
    }
    return {
      exam_key,
      exam_pattern: meta.exam_pattern,
      program: meta.program,
      exam_date: meta.exam_date,
      display_label: meta.display_label,
      averagesByClassSection
    };
  });

  examPatterns.sort(compareTeacherExamRows);

  // Step 3: Compute best week test per grade — ONLY for teacher's assigned subjects
  const gradeBest = {};

  // Build a set of what the teacher teaches: "GRADE-9-A|Physics"
  const teacherTeaches = new Set();
  teacherAssignments.forEach(a => {
    const key = `${normalizeClassSection(a.class, a.section)}|${normalizeSubjectName(a.subject)}`;
    teacherTeaches.add(key);
  });

  examPatterns.forEach(({ display_label, averagesByClassSection }) => {
    Object.entries(averagesByClassSection).forEach(([classSection, subjects]) => {
      // Extract numeric grade from classSection
      let grade = 'N/A';
      if (classSection.startsWith('GRADE-')) {
        const parts = classSection.split('-');
        if (parts.length >= 2) grade = parts[1]; // "GRADE-9-A" → "9"
      } else {
        const parts = classSection.split('-');
        if (parts.length >= 1) grade = parts[0]; // "9-A" → "9"
      }

      if (!/^\d+$/.test(grade)) return; // Skip invalid grades

      // Check each subject the teacher might teach in this class-section
      ['Physics', 'Chemistry', 'Biology', 'Maths'].forEach(subject => {
        const teachKey = `${classSection}|${subject}`;
        if (!teacherTeaches.has(teachKey)) return; // Skip if not taught

        const avgStr = subjects[subject];
        if (avgStr == null) return;

        const avg = parseFloat(avgStr);
        if (isNaN(avg)) return;

        // Update best for this grade
        if (!gradeBest[grade] || avg > gradeBest[grade].bestAvg) {
          gradeBest[grade] = {
            bestTest: display_label,
            bestAvg: avg
          };
        }
      });
    });
  });

  const bestWeekTestsByGrade = Object.entries(gradeBest).map(([grade, data]) => ({
    grade,
    bestExamPattern: data.bestTest,
    bestAverage: data.bestAvg.toFixed(1)
  }));

  return { examPatterns, bestWeekTestsByGrade };
}

function getTeacherColumns(teacherAssignments) {
  const assignments = Array.isArray(teacherAssignments) ? teacherAssignments : [];
  const teacherClassSections = [...new Set(
    assignments.map(a => normalizeClassSection(a.class, a.section))
  )];

  const columns = [];
  const subjects = ["Physics", "Chemistry", "Biology", "Maths"];

  for (const subject of subjects) {
    for (const cs of teacherClassSections) {
      if (assignments.some(a => isSameSubject(a.subject, subject) && normalizeClassSection(a.class, a.section) === cs)) {
        columns.push({ subject, classSection: cs });
      }
    }
  }

  return columns;
}

export default function TeacherDashboard({ onBack, teacherId: externalTeacherId }) {
  const [teacher, setTeacher] = useState(null);
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(true);
  const [examResults, setExamResults] = useState([]);
  const [examPatterns, setExamPatterns] = useState([]);
  const [bestWeekTestsByGrade, setBestWeekTestsByGrade] = useState([]);
  const [teacherRankRows, setTeacherRankRows] = useState([]);
  const [schoolLogoUrl, setSchoolLogoUrl] = useState(null);

  const isViewingAsSchoolOwner = !!externalTeacherId && externalTeacherId.trim() !== '';
  console.log("✅ isViewingAsSchoolOwner =", isViewingAsSchoolOwner);

useEffect(() => {
  let isActive = true;

  const loadTeacherAndExams = async () => {
    try {
      let teacherData = null;
      let schoolName = "Unknown School";
      let schoolId = null;
      let resolvedSchoolLogoUrl = null;

      // 🔹 Get schoolId from session (works for both teacher and school owner)
      const userSession = sessionStorage.getItem("sp_user");
      if (!userSession) {
        throw new Error("User session not found.");
      }
      console.log("TeacherDashboard sp_user raw session:", userSession);
      const user = JSON.parse(userSession);
      schoolId = user.school_id;

      if (isViewingAsSchoolOwner) {
        // 🔹 SCHOOL OWNER MODE
        if (!externalTeacherId) {
          throw new Error("Teacher ID is required.");
        }

        // Fetch school (which includes list of teachers)
        const schoolRes = await fetch(`${API_BASE}/api/schools/${schoolId}`);
        if (!schoolRes.ok) throw new Error("Failed to load school data.");
        const schoolData = await schoolRes.json();
        schoolName = schoolData.school?.school_name || "Unknown School";
        resolvedSchoolLogoUrl = schoolData.school?.logo_url || null;
        console.log("TeacherDashboard school-owner logo source:", resolvedSchoolLogoUrl);
        
        console.log("Searching for:", externalTeacherId.trim());
        console.log("Available IDs:", schoolData.teachers?.map(t => t.teacher_id));
        // Find teacher in school.teachers by teacher_id
        const targetId = externalTeacherId.trim().toUpperCase();
        const teacher = schoolData.teachers?.find(
        t => t.teacher_id?.trim().toUpperCase() === targetId
        );

        if (!teacher) {
          throw new Error("Teacher not found in your school.");
        }

        // Ensure teacher_assignments exists
        teacherData = {
          ...teacher,
          teacher_assignments: Array.isArray(teacher.teacher_assignments)
            ? teacher.teacher_assignments
            : [],
        };
      } else {
        // 🔹 TEACHER SELF-VIEW MODE (existing logic)
        const user = sessionStorage.getItem("sp_user");
        if (!user) {
          throw new Error("No user data found. Please log in again.");
        }
        const parsed = JSON.parse(user);
        if (parsed.role !== "TEACHER") {
          throw new Error("Access denied. Teachers only.");
        }
        teacherData = {
          ...parsed,
          teacher_assignments: Array.isArray(parsed.teacher_assignments)
            ? parsed.teacher_assignments
            : [],
        };
        schoolName = parsed.school_name || "Unknown School";
        schoolId = parsed.school_id;
        resolvedSchoolLogoUrl = parsed.school_logo_url || null;
        console.log("Teacher self-view mode logo source:", resolvedSchoolLogoUrl);

        try {
          const schoolRes = await fetch(`${API_BASE}/api/schools/${schoolId}`);
          if (schoolRes.ok) {
            const schoolData = await schoolRes.json();
            const refreshedTeacher = schoolData.teachers?.find(
              (t) => t.teacher_id?.trim().toUpperCase() === parsed.teacher_id?.trim().toUpperCase()
            );

            if (refreshedTeacher) {
              teacherData = {
                ...teacherData,
                ...refreshedTeacher,
                teacher_assignments: Array.isArray(refreshedTeacher.teacher_assignments)
                  ? refreshedTeacher.teacher_assignments
                  : teacherData.teacher_assignments,
              };
              schoolName = schoolData.school?.school_name || schoolName;
              resolvedSchoolLogoUrl = schoolData.school?.logo_url || resolvedSchoolLogoUrl;
              console.log("Teacher self-view assignments refreshed from school API:", teacherData.teacher_assignments);
            }
          }
        } catch (refreshErr) {
          console.warn("Teacher self-view refresh failed, using session assignments:", refreshErr);
        }
      }

      if (!isActive) return;
      setTeacher(teacherData);
      setSchoolName(schoolName);
      setSchoolLogoUrl(resolvedSchoolLogoUrl);
      console.log("TeacherDashboard resolved school logo URL:", resolvedSchoolLogoUrl);

      // 🔹 Fetch all exams for the school
      const examsRes = await fetch(`${API_BASE}/api/exams?school_id=${schoolId}`);
      if (!examsRes.ok) throw new Error("Failed to fetch exam data.");
      const exams = await examsRes.json();
      if (!isActive) return;
      setExamResults(exams);

      // 🔹 Compute analytics
      const { examPatterns, bestWeekTestsByGrade } = computeExamAnalytics(
        exams,
        teacherData.teacher_assignments
      );
      const teacherColumns = getTeacherColumns(teacherData.teacher_assignments);
      const filteredExamPatterns = examPatterns.filter((pattern) =>
        teacherColumns.some((col) =>
          pattern.averagesByClassSection[col.classSection]?.[col.subject] != null
        )
      );

      if (!isActive) return;
      setExamPatterns(filteredExamPatterns);
      setBestWeekTestsByGrade(bestWeekTestsByGrade);

      try {
        const ranksRes = await fetch(`${API_BASE}/api/teachers/ranks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacher_id: teacherData.teacher_id,
            school_id: schoolId,
            assignments: teacherData.teacher_assignments || []
          })
        });
        if (!ranksRes.ok) {
          console.warn("Teacher rank endpoint returned non-OK status:", ranksRes.status);
          if (!isActive) return;
          setTeacherRankRows([]);
          return;
        }

        const ranksData = await ranksRes.json();
        const rankRows = Array.isArray(ranksData.rows) ? ranksData.rows : [];
        if (!isActive) return;
        setTeacherRankRows(rankRows);

        const rankKeys = new Set(
          rankRows.map((row) => `${row.program || 'N/A'}|${row.exam_pattern}|${normalizeExamDate(row.exam_date)}|${row.class_section}|${row.subject}`)
        );
        const missingRankKeys = [];

        filteredExamPatterns.forEach((pattern) => {
          teacherColumns.forEach((col) => {
            const avg = pattern.averagesByClassSection[col.classSection]?.[col.subject];
            if (avg == null) return;

            const key = `${pattern.program || 'N/A'}|${pattern.exam_pattern}|${normalizeExamDate(pattern.exam_date)}|${col.classSection}|${col.subject}`;
            if (!rankKeys.has(key)) {
              missingRankKeys.push(key);
            }
          });
        });

        if (missingRankKeys.length > 0) {
          console.warn("Average keys with missing rank rows:", missingRankKeys);
          console.log("Teacher rank rows returned:", rankRows);
        }
      } catch (rankErr) {
        console.warn("Teacher rank data unavailable:", rankErr);
        if (!isActive) return;
        setTeacherRankRows([]);
      }
    } catch (err) {
      console.error("Error loading teacher dashboard:", err);
      if (!isActive) return;
      alert(err.message || "Failed to load dashboard.");
      onBack?.();
    } finally {
      if (!isActive) return;
      setLoading(false);
    }
  };

  loadTeacherAndExams();

  return () => {
    isActive = false;
  };
}, [onBack, externalTeacherId, isViewingAsSchoolOwner]);

const downloadPDF = async () => {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  let y = 20;
  const teacherRankMap = new Map(
    teacherRankRows.map((row) => [
      `${row.program || 'N/A'}|${row.exam_pattern}|${normalizeExamDate(row.exam_date)}|${row.class_section}|${row.subject}`,
      row
    ])
  );
  const displayExamPatterns = Array.from(
    new Map(
      teacherRankRows.map((row) => {
        const examKey = buildTeacherExamIdentity(row);
        return [
          examKey,
          {
            exam_key: examKey,
            exam_pattern: row.exam_pattern,
            program: row.program || 'N/A',
            exam_date: normalizeExamDate(row.exam_date),
            display_label: buildTeacherExamLabel(row)
          }
        ];
      })
    ).values()
  ).sort(compareTeacherExamRows);
  let pdfSchoolLogoUrl = schoolLogoUrl;

  if (teacher?.school_id) {
    try {
      const schoolRes = await fetch(`${API_BASE}/api/schools/${teacher.school_id}`);
      if (schoolRes.ok) {
        const schoolData = await schoolRes.json();
        pdfSchoolLogoUrl = schoolData.school?.logo_url || schoolLogoUrl;
      } else {
        console.warn("Teacher PDF school fetch failed:", schoolRes.status);
      }
    } catch (error) {
      console.warn("Teacher PDF school fetch error:", error);
    }
  }

  console.log("Teacher PDF schoolLogoUrl before render:", pdfSchoolLogoUrl);
  // === BLUE HEADER BANNER (as per Fig 2) ===
    doc.setFillColor(30, 85, 160); // Deep Blue #1e55a0
    doc.rect(0, 0, pageWidth, 20, 'F'); // Full-width rectangle
    
    // School Name (Left)
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255); // White text
    if (pdfSchoolLogoUrl) {
      try {
        const schoolLogoDataUrl = await loadImageAsDataUrl(pdfSchoolLogoUrl);
        if (schoolLogoDataUrl) {
          doc.addImage(schoolLogoDataUrl, 'PNG', 8, 1, 18, 18);
          console.log("Teacher PDF school logo added successfully.");
        }
      } catch (e) {
        console.error('Failed to load school logo for teacher PDF:', {
          schoolLogoUrl: pdfSchoolLogoUrl,
          error: e
        });
      }
    }
    doc.text(`${schoolName}` || 'Unknown School', 35, 12);
  
    // Powered BY SPECTROPY (Right)
    try {     
      doc.addImage(spectropyLogoUrl, pageWidth - 25, 2,12,12);
    } catch (e) {
      console.warn('Failed to load Spectropy logo, falling back to text:', e);
    }
    doc.setFontSize(8);
    doc.text('Powered BY SPECTROPY', pageWidth - 10, 18, { align: 'right' });
  y += 10;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(0,0,0);
  doc.setFont('bold');
  doc.text("IIT Foundation Teacher Report", pageWidth / 2, y, { align: 'center' });
  y += 10;
  doc.setFontSize(12);
  doc.setFont(undefined,'bold');
  doc.text(`Teacher: ${teacher.name}`, margin, y); y += 6;
  doc.text(`ID: ${teacher.teacher_id}`, margin, y); y += 6;
  doc.line(margin, y, pageWidth - margin, y); 
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, y - 29, { align: 'right' });
  y += 10;

  // Allotments
  doc.setFontSize(14);
  doc.setFont(undefined,'bold');
  doc.text("Your ALLOTMENTS", margin, y);
  doc.setFont(undefined, 'italic');
  y += 8;
  if (teacher.teacher_assignments.length > 0) {
    teacher.teacher_assignments.forEach(a => {
      if (y > pageHeight - 20) { doc.addPage(); y = 20; }
      doc.text(`${a.class}-${a.section} | ${a.subject}`, margin, y);
      y += 6;
    });
  } else {
    doc.text("No assigned classes.", margin, y);
    y += 6;
  }
  y += 8;

  // Performance Analysis
  if (bestWeekTestsByGrade.length > 0) {
    doc.setFont(undefined, 'bold');
    doc.text("Performance Analysis: Best Week Test by Grade", margin, y);
    doc.setFont(undefined, 'normal');
    y += 10;

    const perfColumns = ["Grade", "Best Exam Pattern", "Best Average (%)"];
    const perfRows = bestWeekTestsByGrade.map(item => [
      `Grade ${item.grade}`,
      item.bestExamPattern,
      `${item.bestAverage}%`
    ]);

    doc.autoTable({
      startY: y,
      head: [perfColumns],
      body: perfRows,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3, halign:'center' },
      headStyles: { fillColor: [66, 153, 225] },
      margin: { left: margin, right: margin }
    });

    y = doc.lastAutoTable.finalY + 10;
  }

  // Exam Table
  if (displayExamPatterns.length > 0) {
    doc.setFont(undefined, 'bold');
    doc.text("Exam Performance Averages", margin, y);
    doc.setFont(undefined, 'normal');
    y += 10;

    const teacherClassSections = [...new Set(
      teacher.teacher_assignments.map(a => normalizeClassSection(a.class, a.section))
    )];
    const subjects = ["Physics", "Chemistry", "Biology", "Maths"];
    const dynamicCols = [];
    const compactTableMode = teacher.teacher_assignments.length >= 4;
    const tableColumns = [compactTableMode ? "Exam" : "Exam Pattern"];

    for (const subject of subjects) {
      for (const cs of teacherClassSections) {
        if (teacher.teacher_assignments.some(a => isSameSubject(a.subject, subject) && normalizeClassSection(a.class, a.section) === cs)) {
          dynamicCols.push({ subject, classSection: cs });
          tableColumns.push(buildAdaptiveTeacherPdfHeader(subject, cs, 'Avg', compactTableMode));
          tableColumns.push(buildAdaptiveTeacherPdfHeader(subject, cs, 'School Rank', compactTableMode));
          tableColumns.push(buildAdaptiveTeacherPdfHeader(subject, cs, 'AIR', compactTableMode));
        }
      }
    }

    const tableRows = displayExamPatterns.map(pattern => {
      const row = [pattern.display_label];
      dynamicCols.forEach(col => {
        const rankKey = `${pattern.program || 'N/A'}|${pattern.exam_pattern}|${normalizeExamDate(pattern.exam_date)}|${col.classSection}|${col.subject}`;
        const rankRow = teacherRankMap.get(rankKey);
        row.push(formatTeacherMetric(rankRow?.average, { suffix: '%' }));
        row.push(formatTeacherMetric(rankRow?.school_rank));
        row.push(formatTeacherMetric(rankRow?.all_india_rank));
      });
      return row;
    });

    doc.autoTable({
      startY: y,
      head: [tableColumns],
      body: tableRows,
      theme: 'striped',
      styles: {
        fontSize: compactTableMode ? 7 : 9,
        cellPadding: compactTableMode ? 1.5 : 2.5,
        halign: 'center',
        valign: 'middle',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [66, 153, 225],
        fontSize: compactTableMode ? 6.5 : 8,
        cellPadding: compactTableMode ? 1.2 : 2,
        fontStyle: 'bold',
        minCellHeight: compactTableMode ? 13 : 16
      },
      margin: { left: margin, right: margin },
      columnStyles: compactTableMode ? { 0: { cellWidth: 28 } } : { 0: { cellWidth: 42 } },
      willDrawCell: (data) => {
        if (data.cell && data.cell.text === '-') {
          data.cell.styles.textColor = [0, 0, 0];
        }
      }
    });
  }

  doc.save(`Teacher_Report_${teacher.teacher_id}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

  if (loading) {
    return <div style={styles.centered}>Loading teacher dashboard...</div>;
  }

  if (!teacher) {
    return <div style={styles.centered}>No teacher data available.</div>;
  }

  // Build column headers: one per (subject, class-section) combo the teacher teaches
  const columns = getTeacherColumns(teacher.teacher_assignments);

  const teacherRankMap = new Map(
    teacherRankRows.map((row) => [
      `${row.program || 'N/A'}|${row.exam_pattern}|${normalizeExamDate(row.exam_date)}|${row.class_section}|${row.subject}`,
      row
    ])
  );
  const displayExamPatterns = Array.from(
    new Map(
      teacherRankRows.map((row) => {
        const examKey = buildTeacherExamIdentity(row);
        return [
          examKey,
          {
            exam_key: examKey,
            exam_pattern: row.exam_pattern,
            program: row.program || 'N/A',
            exam_date: normalizeExamDate(row.exam_date),
            display_label: buildTeacherExamLabel(row)
          }
        ];
      })
    ).values()
  ).sort(compareTeacherExamRows);

   return (
    <div style={styles.container}>
      {/* Header with Download PDF button */}
      <div style={styles.header}>
  <div>
    <h1 style={styles.title}>👩‍🏫 Teacher Dashboard</h1>
    <p style={styles.subtitle}>
      Welcome, <strong>{teacher.name}</strong> • {teacher.teacher_id}
    </p>
    <p style={styles.school}>
      School: <strong>{schoolName}</strong>
    </p>
  </div>
  <div style={{ display: 'flex', gap: '10px' }}>
    <button onClick={downloadPDF} style={styles.downloadBtn}>
      📄 Download PDF Report
    </button>
    {/* ✅ Only show Logout if NOT viewing as school owner */}
    {!isViewingAsSchoolOwner && (
      <button
        onClick={() => {
          sessionStorage.removeItem("sp_user");
          onBack();
        }}
        style={styles.logoutBtn}
      >
        ← Logout
      </button>
    )}
    {/* ✅ Always show "Back" for school owners */}
    {isViewingAsSchoolOwner && (
      <button onClick={onBack} style={styles.backBtn}>
        ← Back to Overview
      </button>
    )}
  </div>
</div>

      {/* Assignments Section */}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>📚 Your ALLOTMENTS</h2>
        {teacher.teacher_assignments.length > 0 ? (
          <div style={styles.assignmentsGrid}>
            {teacher.teacher_assignments.map((assignment, idx) => (
              <div key={idx} style={styles.assignmentCard}>
                <div style={styles.assignmentHeader}>
                  <span style={styles.classTag}>
                    {assignment.class} • {assignment.section}
                  </span>
                </div>
                <div style={styles.subject}>
                  <strong>Subject:</strong> {assignment.subject}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.noData}>You have no assigned classes yet.</p>
        )}
      </div>

      {/* Performance Analysis: Best Week Test by Grade (Card Blocks) */}
      {bestWeekTestsByGrade.length > 0 && (
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>📊 Performance Analysis: Best Week Test by Grade</h2>

          {/* Highlight best overall grade */}
          {(() => {
            const bestOverall = bestWeekTestsByGrade.reduce((a, b) =>
              parseFloat(a.bestAverage) > parseFloat(b.bestAverage) ? a : b
            );

            return (
              <div style={{
                marginBottom: '16px',
                padding: '8px 12px',
                backgroundColor: '#f0f8ff',
                borderRadius: '8px',
                textAlign: 'center',
                fontWeight: '500',
                color: '#2d3748',
                fontSize: '14px'
              }}>
                🏆 Best Overall Grade: <strong>{bestOverall.grade}</strong> ({bestOverall.bestExamPattern}) — {bestOverall.bestAverage}%
              </div>
            );
          })()}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '16px',
            marginTop: '16px'
          }}>
            {bestWeekTestsByGrade.map((item, i) => (
              <div
                key={i}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'default',
                }}
              >
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#2d3748',
                  marginBottom: '8px'
                }}>
                  Grade {item.grade}
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#2d3748',
                  marginBottom: '4px'
                }}>
                  {item.bestExamPattern}
                </div>
                <div style={{
                  fontSize: '18px',
                  fontWeight: '800',
                  color: '#4299e1',
                }}>
                  {item.bestAverage}%
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#718096',
                  marginTop: '4px'
                }}>
                  Avg Score
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exam Performance Averages Table */}
      {displayExamPatterns.length > 0 && (
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>📊 Exam Performance Averages</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Exam</th>
                {columns.map((col, idx) => (
                  <React.Fragment key={idx}>
                    <th style={styles.th}>{col.subject} ({col.classSection}) Avg</th>
                    <th style={styles.th}>{col.subject} ({col.classSection}) School Rank</th>
                    <th style={styles.th}>{col.subject} ({col.classSection}) All India Rank</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayExamPatterns.map((patternData, idx) => (
                <tr key={idx}>
                  <td style={styles.td}>{patternData.display_label}</td>
                  {columns.map((col, colIdx) => {
                    const rankKey = `${patternData.program || 'N/A'}|${patternData.exam_pattern}|${normalizeExamDate(patternData.exam_date)}|${col.classSection}|${col.subject}`;
                    const rankRow = teacherRankMap.get(rankKey);
                    return (
                      <React.Fragment key={colIdx}>
                        <td style={styles.td}>
                          {formatTeacherMetric(rankRow?.average, { suffix: '%' })}
                        </td>
                        <td style={styles.td}>
                          {formatTeacherMetric(rankRow?.school_rank)}
                        </td>
                        <td style={styles.td}>
                          {formatTeacherMetric(rankRow?.all_india_rank)}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {displayExamPatterns.length === 0 && teacher.teacher_assignments.length > 0 && (
        <div style={styles.card}>
          <p style={styles.noData}>No exam results found for your assigned classes.</p>
        </div>
      )}
    </div>
  );
}

// ✅ Styles
const styles = {
  container: {
    maxWidth: 1200,
    margin: '24px auto',
    padding: '0 16px',
  },
  centered: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '80vh',
    fontSize: '18px',
    color: '#4a5568',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '24px 0',
    borderBottom: '2px solid #e2e8f0',
    marginBottom: '24px',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '28px',
    color: '#2d3748',
  },
  subtitle: {
    margin: '0 0 4px 0',
    fontSize: '16px',
    color: '#4a5568',
  },
  school: {
    margin: 0,
    fontSize: '14px',
    color: '#718096',
  },
  logoutBtn: {
    padding: "8px",
    borderRadius: '4px',
    border: "none",
    background: "#ef4444",
    color: "#fff",
    cursor: "pointer",
    fontSize: "clamp(13px, 1.5vw, 14px)",
  },
  downloadBtn: {
  padding: '8px',
  background: '#3182ce',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: '500',
},
  card: {
    overflow: 'auto',
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '20px',
    color: '#2d3748',
    fontWeight: '600',
  },
  assignmentsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
  },
  assignmentCard: {
    background: '#f8fafc',
    border: '1px solid #cbd5e0',
    borderRadius: '8px',
    padding: '16px',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  assignmentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  classTag: {
    background: '#4299e1',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
  },
  subject: {
    fontSize: '15px',
    color: '#2d3748',
    marginTop: '4px',
  },
  noData: {
    color: '#718096',
    fontSize: '16px',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '20px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '12px',
  },
  th: {
    backgroundColor: '#edf2f7',
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#2d3748',
    borderBottom: '2px solid #cbd5e0',
  },
  td: {
    padding: '12px 16px',
    borderBottom: '1px solid #e2e8f0',
    color: '#2d3748',
  },
};
