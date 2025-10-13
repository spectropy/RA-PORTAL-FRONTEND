// src/components/TeacherDashboard.jsx
import React, { useState, useEffect } from "react";

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
        Mathematics: subjects.maths.length > 0
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
      ['Physics', 'Chemistry', 'Biology', 'Mathematics'].forEach(subject => {
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

export default function TeacherDashboard({ onBack }) {
  const [teacher, setTeacher] = useState(null);
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(true);
  const [examResults, setExamResults] = useState([]);
  const [examPatterns, setExamPatterns] = useState([]);
  const [bestWeekTestsByGrade, setBestWeekTestsByGrade] = useState([]);

  useEffect(() => {
    const loadTeacherAndExams = async () => {
      const user = sessionStorage.getItem("sp_user");
      if (!user) {
        alert("No user data found. Please log in again.");
        onBack();
        return;
      }

      try {
        const parsed = JSON.parse(user);
        if (parsed.role !== "TEACHER") {
          alert("Access denied. Teachers only.");
          onBack();
          return;
        }

        const teacherData = {
          ...parsed,
          teacher_assignments: Array.isArray(parsed.teacher_assignments)
            ? parsed.teacher_assignments
            : [],
        };
        setTeacher(teacherData);
        setSchoolName(parsed.school_name || "Unknown School");

        const res = await fetch(`/api/exams?school_id=${parsed.school_id}`);
        if (res.ok) {
          const exams = await res.json();
          setExamResults(exams);

          // ✅ Pass teacher assignments to compute teacher-specific analysis
          const { examPatterns, bestWeekTestsByGrade } = computeExamAnalytics(
            exams,
            teacherData.teacher_assignments
          );

          setExamPatterns(examPatterns);
          setBestWeekTestsByGrade(bestWeekTestsByGrade);
        }
      } catch (err) {
        console.error("Error:", err);
        alert("Session corrupted. Please log in again.");
        onBack();
      } finally {
        setLoading(false);
      }
    };

    loadTeacherAndExams();
  }, [onBack]);

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
  const subjects = ["Physics", "Chemistry", "Biology", "Mathematics"];
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
      {/* Header */}
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
        <button
          onClick={() => {
            sessionStorage.removeItem("sp_user");
            onBack();
          }}
          style={styles.logoutBtn}
        >
          ← Logout
        </button>
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
