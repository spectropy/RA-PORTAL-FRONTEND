// src/components/TeacherDashboard.jsx
import React, { useState, useEffect } from "react";
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // 👈 Import autotable

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Helper: Compute exam patterns AND teacher-specific best week tests
function computeExamAnalytics(exams, teacherAssignments) {
  const assignments = Array.isArray(teacherAssignments) ? teacherAssignments : [];
  // Step 1: Group by (exam_pattern, class-section) and compute subject averages
  const patternClassSectionMap = {};

  exams.forEach(exam => {
    const pattern = exam.exam_pattern || 'N/A';
    const classSection = `${exam.class || 'N/A'}-${exam.section || 'N/A'}`;

    if (!patternClassSectionMap[pattern]) {
      patternClassSectionMap[pattern] = {};
    }
    if (!patternClassSectionMap[pattern][classSection]) {
      patternClassSectionMap[pattern][classSection] = {
        physics: [], chemistry: [], maths: [], biology: []
      };
    }

    const g = patternClassSectionMap[pattern][classSection];
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
  const examPatterns = Object.entries(patternClassSectionMap).map(([pattern, classSectionData]) => {
    const averagesByClassSection = {};
    for (const [cs, subjects] of Object.entries(classSectionData)) {
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
    return { exam_pattern: pattern, averagesByClassSection };
  });

  examPatterns.sort((a, b) => a.exam_pattern.localeCompare(b.exam_pattern));

  // Step 3: Compute best week test per grade — ONLY for teacher's assigned subjects
  const gradeBest = {};

  // Build a set of what the teacher teaches: "GRADE-9-A|Physics"
  const teacherTeaches = new Set();
  teacherAssignments.forEach(a => {
    const key = `${a.class}-${a.section}|${a.subject}`;
    teacherTeaches.add(key);
  });

  examPatterns.forEach(({ exam_pattern, averagesByClassSection }) => {
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
            bestTest: exam_pattern,
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

export default function TeacherDashboard({ onBack, teacherId: externalTeacherId }) {
  const [teacher, setTeacher] = useState(null);
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(true);
  const [examResults, setExamResults] = useState([]);
  const [examPatterns, setExamPatterns] = useState([]);
  const [bestWeekTestsByGrade, setBestWeekTestsByGrade] = useState([]);

  const isViewingAsSchoolOwner = !!externalTeacherId && externalTeacherId.trim() !== '';
  console.log("✅ isViewingAsSchoolOwner =", isViewingAsSchoolOwner);

  useEffect(() => {
  const loadTeacherAndExams = async () => {
    try {
      let teacherData = null;
      let schoolName = "Unknown School";
      let schoolId = null;

      // 🔹 Get schoolId from session (works for both teacher and school owner)
      const userSession = sessionStorage.getItem("sp_user");
      if (!userSession) {
        throw new Error("User session not found.");
      }
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
      }

      setTeacher(teacherData);
      setSchoolName(schoolName);

      // 🔹 Fetch all exams for the school
      const examsRes = await fetch(`${API_BASE}/api/exams?school_id=${schoolId}`);
      if (!examsRes.ok) throw new Error("Failed to fetch exam data.");
      const exams = await examsRes.json();
      setExamResults(exams);

      // 🔹 Compute analytics
      const { examPatterns, bestWeekTestsByGrade } = computeExamAnalytics(
        exams,
        teacherData.teacher_assignments
      );
      setExamPatterns(examPatterns);
      setBestWeekTestsByGrade(bestWeekTestsByGrade);
    } catch (err) {
      console.error("Error loading teacher dashboard:", err);
      alert(err.message || "Failed to load dashboard.");
      onBack?.();
    } finally {
      setLoading(false);
    }
  };

  loadTeacherAndExams();
}, [onBack, externalTeacherId, isViewingAsSchoolOwner]);

const downloadPDF = () => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 14;
  let y = 20;
  // === BLUE HEADER BANNER (as per Fig 2) ===
    doc.setFillColor(30, 85, 160); // Deep Blue #1e55a0
    doc.rect(0, 0, pageWidth, 20, 'F'); // Full-width rectangle

    // School Name (Left)
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255); // White text
    doc.text(`${schoolName}` || 'Unknown School', 14, 12);

    // Powered BY SPECTROPY (Right)
    doc.setFontSize(10);
    doc.text('Powered BY SPECTROPY', pageWidth - 20, 15, { align: 'right' });
  y += 10;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(0,0,0);
  doc.setFont('bold');
  doc.text("IIT Foundation Teacher Report", pageWidth / 2, y, { align: 'center' });
  y += 10;
  doc.setFontSize(12);
  doc.text(`Teacher: ${teacher.name}`, margin, y); y += 6;
  doc.text(`ID: ${teacher.teacher_id}`, margin, y); y += 6;
  doc.line(margin, y, pageWidth - margin, y); 
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin + 150, y - 29);
  y += 10;

  // Allotments
  doc.setFontSize(14);
  doc.setFont(undefined,'bold');
  doc.text("Your ALLOTMENTS", margin, y);
  doc.setFont(undefined, 'italic');
  y += 8;
  if (teacher.teacher_assignments.length > 0) {
    teacher.teacher_assignments.forEach(a => {
      if (y > 280) { doc.addPage(); y = 20; }
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
  if (examPatterns.length > 0) {
    doc.setFont(undefined, 'bold');
    doc.text("Exam Performance Averages", margin, y);
    doc.setFont(undefined, 'normal');
    y += 10;

    const teacherClassSections = [...new Set(
      teacher.teacher_assignments.map(a => `${a.class}-${a.section}`)
    )];
    const subjects = ["Physics", "Chemistry", "Biology", "Maths"];
    const dynamicCols = [];
    const tableColumns = ["Exam Pattern"];

    for (const subject of subjects) {
      for (const cs of teacherClassSections) {
        if (teacher.teacher_assignments.some(a => a.subject === subject && `${a.class}-${a.section}` === cs)) {
          dynamicCols.push({ subject, classSection: cs });
          tableColumns.push(`${subject} (${cs})`);
        }
      }
    }

    const tableRows = examPatterns.map(pattern => {
      const row = [pattern.exam_pattern];
      dynamicCols.forEach(col => {
        const avg = pattern.averagesByClassSection[col.classSection]?.[col.subject] || "N/A";
        row.push(avg !== "N/A" ? `${avg}%` : "N/A");
      });
      return row;
    });

    doc.autoTable({
      startY: y,
      head: [tableColumns],
      body: tableRows,
      theme: 'striped',
      styles: { fontSize: 10, cellPadding: 2.5, halign: 'center' },
      headStyles: { fillColor: [66, 153, 225] },
      margin: { left: margin, right: margin },
      willDrawCell: (data) => {
        if (data.cell && data.cell.text === 'N/A') {
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

  // Get unique (class-section) the teacher teaches
  const teacherClassSections = [...new Set(
    teacher.teacher_assignments.map(a => `${a.class}-${a.section}`)
  )];

  // Build column headers: one per (subject, class-section) combo the teacher teaches
  const columns = [];
  const subjects = ["Physics", "Chemistry", "Biology", "Maths"];
  for (const subject of subjects) {
    for (const cs of teacherClassSections) {
      if (teacher.teacher_assignments.some(a => a.subject === subject && `${a.class}-${a.section}` === cs)) {
        columns.push({ subject, classSection: cs });
      }
    }
  }

  // Helper: Get avg for a specific (subject, class-section) in a given exam pattern
  const getAvgForPattern = (subject, classSection, patternData) => {
    return patternData.averagesByClassSection[classSection]?.[subject] || null;
  };

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
      {examPatterns.length > 0 && (
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>📊 Exam Performance Averages</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Exam Pattern</th>
                {columns.map((col, idx) => (
                  <th key={idx} style={styles.th}>
                    {col.subject} ({col.classSection}) Avg
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {examPatterns.map((patternData, idx) => (
                <tr key={idx}>
                  <td style={styles.td}>{patternData.exam_pattern}</td>
                  {columns.map((col, colIdx) => {
                    const avg = getAvgForPattern(col.subject, col.classSection, patternData);
                    return (
                      <td key={colIdx} style={styles.td}>
                        {avg != null ? `${avg}%` : "N/A"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {examPatterns.length === 0 && teacher.teacher_assignments.length > 0 && (
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
    padding: '8px 16px',
    background: '#e53e3e',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  downloadBtn: {
  padding: '8px 16px',
  background: '#3182ce',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500',
},
  card: {
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
