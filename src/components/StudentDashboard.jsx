// src/StudentDashboard.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
// 👉 Charts
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function StudentDashboard({ onBack }) {
  const [student, setStudent] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [examResults, setExamResults] = useState([]); // 👈 NEW
  const [school, setSchool] = useState(null); // 👈 ADD THIS
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hasFetched = useRef(false);

  useEffect(() => {
    const user = sessionStorage.getItem("sp_user");
    const parsedUser = user ? JSON.parse(user) : null;

    const studentId = parsedUser?.student_id || null;
    const schoolId = parsedUser?.school_id || null;
    const classValue = parsedUser?.class || null;
    const sectionValue = parsedUser?.section || null;

    if (!studentId || !schoolId || !classValue || !sectionValue) {
      setError("No student or school context found. Please log in again.");
      setLoading(false);
      return;
    }

    if (hasFetched.current) return;
    hasFetched.current = true;

   const fetchStudentData = async () => {
  try {
    setStudent(parsedUser);

    // 👉 FETCH EXAM RESULTS
    const resultsRes = await fetch(`${API_BASE}/api/exams/results?student_id=${encodeURIComponent(studentId)}`);
    if (!resultsRes.ok) throw new Error("Failed to fetch exam results");
    const resultsData = await resultsRes.json();
    setExamResults(resultsData || []);

    // 👉 FETCH FULL SCHOOL DATA (includes logo_url, area, etc.)
    const schoolRes = await fetch(`${API_BASE}/api/schools/${schoolId}`);
    if (!schoolRes.ok) throw new Error(`Failed to fetch school details: ${schoolRes.status}`);
    const schoolData = await schoolRes.json();

    // ✅ Save the full school object (from `schoolData.school`)
    setSchool(schoolData.school); // 👈 This gives you access to logo_url, area, etc.

    // 👉 Build assigned teachers list
    const assignedTeachers = [];
    if (Array.isArray(schoolData.teachers)) {
      for (const teacher of schoolData.teachers) {
        if (Array.isArray(teacher.teacher_assignments)) {
          const assignments = teacher.teacher_assignments.filter(
            a => a.class === classValue && a.section === sectionValue
          );
          if (assignments.length > 0) {
            assignedTeachers.push({
              name: teacher.name,
              subject: assignments[0].subject,
              email: teacher.email,
              phone: teacher.contact,
            });
          }
        }
      }
    }
    setTeachers(assignedTeachers);
  } catch (err) {
    console.error("Error fetching student data:", err);
    setError("Failed to load student data. Please try again.");
  } finally {
    setLoading(false);
  }
};

    fetchStudentData();
  }, []);

  // ===== Derived Metrics for Performance Dashboard (FIXED) =====
const { bestExam, averagesData, strengthSubject, weakSubject } = useMemo(() => {
  if (!Array.isArray(examResults) || examResults.length === 0) {
    return { bestExam: null, averagesData: [], strengthSubject: null, weakSubject: null };
  }

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const best = [...examResults].sort((a, b) => toNum(b.percentage) - toNum(a.percentage))[0];

  // 🔹 Calculate subject percentages per exam, then average
  let physicsPctSum = 0;
  let chemistryPctSum = 0;
  let mathsPctSum = 0;
  let biologyPctSum = 0;
  let validCount = 0;

  for (const r of examResults) {
    const physicsPct = r.max_marks_physics > 0 
      ? (toNum(r.physics_marks) / toNum(r.max_marks_physics)) * 100 
      : 0;
    const chemistryPct = r.max_marks_chemistry > 0 
      ? (toNum(r.chemistry_marks) / toNum(r.max_marks_chemistry)) * 100 
      : 0;
    const mathsPct = r.max_marks_maths > 0 
      ? (toNum(r.maths_marks) / toNum(r.max_marks_maths)) * 100 
      : 0;
    const biologyPct = r.max_marks_biology > 0 
      ? (toNum(r.biology_marks) / toNum(r.max_marks_biology)) * 100 
      : 0;

    physicsPctSum += physicsPct;
    chemistryPctSum += chemistryPct;
    mathsPctSum += mathsPct;
    biologyPctSum += biologyPct;
    validCount++;
  }

  const avgPhysics = validCount ? Number((physicsPctSum / validCount).toFixed(2)) : 0;
  const avgChemistry = validCount ? Number((chemistryPctSum / validCount).toFixed(2)) : 0;
  const avgMaths = validCount ? Number((mathsPctSum / validCount).toFixed(2)) : 0;
  const avgBiology = validCount ? Number((biologyPctSum / validCount).toFixed(2)) : 0;

  // ✅ Structure data with subject percentages
  const averagesData = [
    { subject: 'Physics', average: avgPhysics },
    { subject: 'Chemistry', average: avgChemistry },
    { subject: 'Mathematics', average: avgMaths },
    { subject: 'Biology', average: avgBiology }
  ];

  const sorted = [...averagesData].sort((a, b) => b.average - a.average);
  const strength = sorted[0] || null;
  const weak = sorted[sorted.length - 1] || null;

  return {
    bestExam: best,
    averagesData,
    strengthSubject: strength,
    weakSubject: weak,
  };
}, [examResults]);

const downloadPDF = async (studentData, schoolData, examResults) => {
  // 🔹 Early validation
  if (!studentData || !schoolData || !examResults?.length) {
    throw new Error('Missing required data for PDF generation');
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const schoolName = schoolData.school_name || "School Name";
  const studentName = studentData.name || "Student Name";
  const rollNo = studentData.roll_no || "—";
  const classSec = `${studentData.class}-${studentData.section}`;

  // 🔹 Compute overall average
  const overallAvg = examResults.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0) / examResults.length;

  // 🔹 Group exams by type
  const groupedExams = {
    weekly: [],
    unit: [],
    grand: [],
    other: []
  };

  examResults.forEach(exam => {
    const pattern = exam.exam_pattern || '';
    if (pattern.startsWith('WEEK_TEST')) {
      groupedExams.weekly.push(exam);
    } else if (pattern.startsWith('UNIT_TEST')) {
      groupedExams.unit.push(exam);
    } else if (pattern.startsWith('GRAND_TEST')) {
      groupedExams.grand.push(exam);
    } else {
      groupedExams.other.push(exam);
    }
  });

  // Sort each group by percentage (descending)
  Object.keys(groupedExams).forEach(key => {
    groupedExams[key].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
  });

  // ======================
  // 🏫 HEADER: School Name + Area (NO LOGO)
  // ======================
  let y = 30;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolName, 20, y);
  y += 15;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Area: ${schoolData.area || 'N/A'}`, 20, y);
  y += 20;

  // ======================
  // Student Info
  // ======================
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Student: ${studentName}`, 20, y);
  doc.text(`Roll No: ${rollNo}`, pageWidth - 20, y, { align: 'right' });
  y += 10;
  doc.text(`Class: ${classSec}`, 20, y);
  y += 20;

  // ======================
  // Overall Average (Big & Bold)
  // ======================
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 100, 0); // Dark green
  doc.text(`${overallAvg.toFixed(2)}%`, pageWidth / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 25;

  // ======================
  // Helper: Render Exam Group
  // ======================
  const renderExamGroup = (title, exams) => {
    if (exams.length === 0) return;

    const best = exams[0];
    const avg = exams.reduce((sum, e) => sum + (e.percentage || 0), 0) / exams.length;

    // Section Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 20, y);
    y += 10;

    // Avg & Best
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Avg: ${avg.toFixed(2)}%`, 20, y);
    doc.text(`Best: ${best.percentage.toFixed(2)}% (${best.exam.replace(/_/g, ' ')})`, 80, y);
    y += 15;

    // Table Header
    const headers = ["Exam", "Physics", "Chemistry", "Maths", "Biology", "Total Marks", "Grade", "Rank", "%"];
    const headerX = [20, 60, 80, 100, 120, 140, 160, 175, 190];
    doc.setFont('helvetica', 'bold');
    headers.forEach((h, i) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(h, headerX[i], y);
    });
    y += 8;
    doc.line(20, y, 195, y); // underline
    y += 5;

    // Only show best exam (like sample PDF)
    if (best) {
      const getGrade = (pct) => {
        if (pct >= 90) return 'A+';
        if (pct >= 80) return 'A';
        if (pct >= 70) return 'B';
        if (pct >= 60) return 'C';
        return 'D';
      };

      const row = [
        best.exam.replace(/_/g, ' '),
        (best.physics || 0).toFixed(0),
        (best.chemistry || 0).toFixed(0),
        (best.maths || 0).toFixed(0),
        (best.biology || 0).toFixed(0),
        (best.total || 0).toFixed(0),
        getGrade(best.percentage),
        best.class_rank || '-',
        `${best.percentage.toFixed(2)}%`
      ];

      row.forEach((cell, i) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(String(cell), headerX[i], y);
      });
      y += 15;
    }
  };

  // Render Groups
  renderExamGroup("Weekly Tests", groupedExams.weekly);
  renderExamGroup("Unit Tests", groupedExams.unit);
  renderExamGroup("Grand Tests", groupedExams.grand);

  // Add signature section on last page
  doc.addPage(); // Ensure fresh page for signatures
  const bottomY = doc.internal.pageSize.height - 40;
  doc.setFontSize(10);
  doc.text("Parent/Guardian Signature", 30, bottomY);
  doc.text("School Principal Signature", 90, bottomY);
  doc.text("Organization Head Signature", 150, bottomY);

  doc.text("Date: ___________", 30, bottomY + 8);
  doc.text("Date: ___________", 90, bottomY + 8);
  doc.text("Date: ___________", 150, bottomY + 8);

  // Save
  doc.save(`ReportCard_${studentName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

  if (loading) {
    return (
      <div style={styles.container}>
        <button onClick={onBack} style={styles.backButton}>← Back</button>
        <p>Loading student data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <button onClick={onBack} style={styles.backButton}>← Back</button>
        <p style={{ color: 'red', fontWeight: 'bold' }}>{error}</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div style={styles.container}>
        <button onClick={onBack} style={styles.backButton}>← Back</button>
        <p style={{ color: 'red' }}>Student data unavailable.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <button onClick={onBack} style={styles.backButton}>← Back</button>

      <h2>🎓 Student Dashboard</h2>
      <div style={styles.profile}>
  <p><strong>School:</strong> {student.school_name || '—'}</p>
  <p><strong>Student Name:</strong> {student.name}</p>
  <p><strong>Roll No:</strong> {student.roll_no}</p>
  <p><strong>Class:</strong> {student.class} - {student.section}</p>
</div>

      {/* ===== Performance Metrics Dashboard ===== */}
      {examResults.length > 0 && (
        <div style={styles.metricsGrid}>
          {/* Best Performed Exam */}
          <div style={styles.card}>
            <h3 style={{ marginTop: 0 }}>🏆 Best Performed Exam</h3>
            {bestExam ? (
              <div>
                <p style={styles.metricLine}><strong>Exam:</strong> {bestExam.exam} ({bestExam.program})</p>
                <p style={styles.metricLine}><strong>Date:</strong> {bestExam.date}</p>
                <p style={styles.metricLine}><strong>Percentage:</strong> {(Number(bestExam.percentage) || 0).toFixed(2)}%</p>
                <p style={styles.metricLine}><strong>Class Rank:</strong> {bestExam.class_rank ?? '—'}</p>
                <p style={styles.metricLine}><strong>School Rank:</strong> {bestExam.school_rank ?? '—'}</p>
                <p style={styles.metricLine}><strong>Global Rank:</strong> {bestExam.all_schools_rank ?? '—'}</p>
              </div>
            ) : (
              <p style={{ color: '#718096', fontStyle: 'italic' }}>Not enough data.</p>
            )}
          </div>

          {/* Cumulative Averages Bar Chart */}
<div style={{ width: '100%', height: 260 }}>
  <ResponsiveContainer>
    <BarChart data={averagesData} barSize={200} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="subject" tick={false} />
      <YAxis />
      <Tooltip formatter={(v) => [`${v}%`, 'Average']} />
      <Legend />
      <Bar dataKey="average" name="Average %" fill="#1f77b4" /> {/* Single bar per subject */}
    </BarChart>
  </ResponsiveContainer>
</div>

          {/* Strength & Weakness */}
          <div style={styles.card}>
            <h3 style={{ marginTop: 0 }}>🧭 Strength & Weak Area</h3>
            {strengthSubject && weakSubject ? (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={styles.pillSuccess}>
                  <span style={{ fontWeight: 700 }}>Strength:</span>&nbsp;{strengthSubject.subject}
                  &nbsp;•&nbsp;{strengthSubject.average}%
                </div>
                <div style={styles.pillWarning}>
                  <span style={{ fontWeight: 700 }}>Weak:</span>&nbsp;{weakSubject.subject}
                  &nbsp;•&nbsp;{weakSubject.average}%
                </div>
              </div>
            ) : (
              <p style={{ color: '#718096', fontStyle: 'italic' }}>Insights will appear after a few exams.</p>
            )}
          </div>
        </div>
      )}

      <hr style={styles.divider} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3>📊 Exam Results</h3>
        {examResults.length > 0 && (
          <button 
  onClick={async () => {
    // 🔹 Validation
    if (!school) {
      alert('School data not loaded yet. Please wait.');
      return;
    }
    if (examResults.length === 0) {
      alert('No exam results to download.');
      return;
    }
    try {
      await downloadPDF(student, school, examResults);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Failed to generate PDF. Please try again.');
    }
  }}
  disabled={!school || examResults.length === 0 || loading}
  style={styles.downloadButton}
>
  📄 Download Report Card (PDF)
</button>
        )}
      </div>

      {examResults.length > 0 ? (
  <div style={{ overflowX: 'auto' }}>
    <table style={styles.table}>
      <thead>
        <tr>
          <th>Date</th>
          <th>Exam</th>
          <th>Program</th>
          <th>Physics</th>
          <th>Chemistry</th>
          <th>Maths</th>
          <th>Biology</th>
          <th>Total</th>
          <th>%</th>
          <th>Class Rank</th>
          <th>School Rank</th>
          <th>Global Rank</th>
        </tr>
      </thead>
      <tbody>
        {examResults.map((r, i) => {
          // Helper to format "marks (percentage%)"
          const formatSubject = (marks, max) => {
            if (max == null || max === 0) return `${marks || 0}`;
            const pct = ((marks || 0) / max) * 100;
            return `${marks || 0} (${pct.toFixed(0)}%)`;
          };

          return (
            <tr key={i}>
              <td>{r.date}</td>
              <td>{r.exam}</td>
              <td>{r.program}</td>
              <td>{formatSubject(r.physics_marks, r.max_marks_physics)}</td>
              <td>{formatSubject(r.chemistry_marks, r.max_marks_chemistry)}</td>
              <td>{formatSubject(r.maths_marks, r.max_marks_maths)}</td>
              <td>{formatSubject(r.biology_marks, r.max_marks_biology)}</td>
              <td>{Number(r.total || 0).toFixed(2)}</td>
              <td>{Number(r.percentage || 0).toFixed(2)}%</td>
              <td>{r.class_rank}</td>
              <td>{r.school_rank}</td>
              <td>{r.all_schools_rank}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
) : (
  <p style={{ color: '#718096', fontStyle: 'italic' }}>
    No exam results available yet.
  </p>
)}

      <hr style={styles.divider} />

      <h3>👨‍🏫 Teachers</h3>
      {teachers.length > 0 ? (
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Teacher</th>
              <th>Subject</th>
              <th>Email</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t, i) => (
              <tr key={i}>
                <td>{t.name}</td>
                <td>{t.subject}</td>
                <td><a href={`mailto:${t.email}`}>{t.email}</a></td>
                <td>{t.phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: '#718096', fontStyle: 'italic' }}>
          No teachers assigned to your class yet.
        </p>
      )}
    </div>
  );
}

// === Styles ===
const styles = {
  container: { padding: 20, fontFamily: 'Arial, sans-serif', maxWidth: 1200, margin: '0 auto' },
  backButton: { padding: '8px 16px', margin: '0 0 16px', border: '1px solid #4682b4', background: 'white', color: '#4682b4', borderRadius: 6, cursor: 'pointer' },
  downloadButton: {
    padding: '10px 20px',
    background: '#4682b4',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  profile: { background: '#f0f8ff', padding: 16, borderRadius: 8, border: '1px solid #add8e6', marginBottom: 20 },
  divider: { margin: '20px 0', borderColor: '#ddd' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: 10,
    fontSize: '0.9em',
    whiteSpace: 'nowrap'
  },
  th: {
    textAlign: 'left',
    padding: '12px 8px',
    borderBottom: '2px solid #ddd',
    background: '#f0f8ff',
    position: 'sticky',
    top: 0
  },
  td: {
    padding: '10px 8px',
    borderBottom: '1px solid #eee'
  },
  // ===== New styles for metrics =====
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
    marginBottom: 10,
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 16,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
  },
  metricLine: { margin: '6px 0' },
  pillSuccess: {
    display: 'inline-block',
    padding: '6px 10px',
    background: '#e6fffa',
    color: '#036666',
    border: '1px solid #99f6e4',
    borderRadius: 9999,
  },
  pillWarning: {
    display: 'inline-block',
    padding: '6px 10px',
    background: '#fff7ed',
    color: '#9a3412',
    border: '1px solid #fed7aa',
    borderRadius: 9999,
  },
};
