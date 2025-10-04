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

        // Fetch teachers (unchanged)
        const schoolRes = await fetch(`${API_BASE}/api/schools/${schoolId}`);
        if (!schoolRes.ok) throw new Error(`Failed to fetch school details: ${schoolRes.status}`);
        const schoolData = await schoolRes.json();

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

  // ===== Derived Metrics for Performance Dashboard =====
  const { bestExam, averagesData, strengthSubject, weakSubject } = useMemo(() => {
  if (!Array.isArray(examResults) || examResults.length === 0) {
    return { bestExam: null, averagesData: [], strengthSubject: null, weakSubject: null };
  }

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const best = [...examResults].sort((a, b) => toNum(b.percentage) - toNum(a.percentage))[0];

  const totals = { physics: 0, chemistry: 0, maths: 0, biology: 0 };
  const count = examResults.length;

  for (const r of examResults) {
    totals.physics += toNum(r.physics);
    totals.chemistry += toNum(r.chemistry);
    totals.maths += toNum(r.maths);
    totals.biology += toNum(r.biology);
  }

  // ✅ Structure data with one row per subject
  const averagesData = [
  { subject: 'Physics', physics: count ? Number((totals.physics / count).toFixed(2)) : 0, average: count ? Number((totals.physics / count).toFixed(2)) : 0 },
  { subject: 'Chemistry', chemistry: count ? Number((totals.chemistry / count).toFixed(2)) : 0, average: count ? Number((totals.chemistry / count).toFixed(2)) : 0 },
  { subject: 'Mathematics', maths: count ? Number((totals.maths / count).toFixed(2)) : 0, average: count ? Number((totals.maths / count).toFixed(2)) : 0 },
  { subject: 'Biology', biology: count ? Number((totals.biology / count).toFixed(2)) : 0, average: count ? Number((totals.biology / count).toFixed(2)) : 0 }
];

  const sorted = [...averagesData].sort((a, b) => {
    const avgA = a.physics || a.chemistry || a.maths || a.biology;
    const avgB = b.physics || b.chemistry || b.maths || b.biology;
    return avgB - avgA;
  });
  const strength = sorted[0] || null;
  const weak = sorted[sorted.length - 1] || null;

  return {
    bestExam: best,
    averagesData,
    strengthSubject: strength,
    weakSubject: weak,
  };
}, [examResults]);

  // 👇 DOWNLOAD AS PDF FUNCTION
  const downloadPDF = () => {
  if (!student || examResults.length === 0) return;

  const doc = new jsPDF('l'); // Landscape orientation
  const schoolName = student.school_name || "School Name";

  // ======================
  // 📄 PAGE 1: Best Performed Exam
  // ======================
  let y = 50; // Running Y position

  // Header (repeated on each page)
  doc.setFontSize(18);
  doc.text(`${schoolName} - Student Report Card`, 14, 20);
  doc.setFontSize(12);
  doc.text(`Name: ${student.name} | Roll No: ${student.roll_no} | Class: ${student.class}-${student.section}`, 14, 30);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 40);

  // 🏆 Best Performed Exam
  doc.setFontSize(14);
  doc.text("Best Performed Exam", 14, y);
  y += 10;

  if (bestExam) {
    const labelX = 14;
    const valueX = 70;
    const lineHeight = 8;

    const addRow = (label, value) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, labelX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, valueX, y);
      y += lineHeight;
    };

    addRow("Exam:", `${bestExam.exam} (${bestExam.program})`);
    addRow("Date:", bestExam.date || '—');
    addRow("Percentage:", `${(Number(bestExam.percentage) || 0).toFixed(2)}%`);
    addRow("Class Rank:", bestExam.class_rank ?? '—');
    addRow("School Rank:", bestExam.school_rank ?? '—');
    addRow("All Schools Rank:", bestExam.all_schools_rank ?? '—');
  }

  // Add page break
  doc.addPage();

  // ======================
// 📄 PAGE 2: Cumulative Averages Bar Chart
// ======================
y = 100; // Start lower to avoid overlap with header

// Header
doc.setFontSize(18);
doc.text(`${schoolName} - Student Report Card`, 14, 20);
doc.setFontSize(12);
doc.text(`Name: ${student.name} | Roll No: ${student.roll_no} | Class: ${student.class}-${student.section}`, 14, 30);
doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 40);
doc.text("Cumulative Averages (All Exams)", 14, 50);
y += 15; // Space after title

// 📊 Define colors for chart
const colors = {
  Physics: [0, 102, 204],    // Blue
  Chemistry: [255, 165, 0],  // Orange
  Mathematics: [0, 128, 0],   // Green
  Biology: [255, 0, 0]        // Red
};

const maxAvg = Math.max(...averagesData.map(d => d.physics || d.chemistry || d.maths || d.biology));

// Chart dimensions
const chartX = 14;
const chartY = y + 10; // Start chart 10 units below title
const chartWidth = 180;
const chartHeight = 70;
const barWidth = 8;

// Draw Y-axis grid and labels
for (let val = 0; val <= 40; val += 10) {
  const yPixel = chartY - (val / maxAvg) * chartHeight;
  doc.setDrawColor(200, 200, 200);
  doc.line(chartX, yPixel, chartX + chartWidth, yPixel);
  doc.text(`${val}`, chartX - 10, yPixel + 3);
}

// Draw X-axis
doc.setDrawColor(200, 200, 200);
doc.line(chartX, chartY, chartX + chartWidth, chartY);

// Draw bars
averagesData.forEach((item, i) => {
  const avg = item.physics || item.chemistry || item.maths || item.biology;
  const height = (avg / maxAvg) * chartHeight;
  const x = chartX + i * 45;

  const color = colors[item.subject] || [255, 0, 0];
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(x, chartY - height, barWidth, height, 'F');

  // Label below bar
  doc.text(item.subject, x + barWidth + 2, chartY + 12);
  doc.text(avg.toFixed(1), x + barWidth + 2, chartY + 22);
});

// Draw legend
const legendY = chartY + 35;
doc.setFontSize(9);
doc.text("Legend:", chartX, legendY);
doc.setFillColor(255, 0, 0);
doc.rect(chartX + 40, legendY - 4, 8, 8, 'F');
doc.text("Biology", chartX + 50, legendY);
doc.setFillColor(255, 165, 0);
doc.rect(chartX + 40, legendY + 8, 8, 8, 'F');
doc.text("Chemistry", chartX + 50, legendY + 8);
doc.setFillColor(0, 128, 0);
doc.rect(chartX + 40, legendY + 16, 8, 8, 'F');
doc.text("Mathematics", chartX + 50, legendY + 16);
doc.setFillColor(0, 102, 204);
doc.rect(chartX + 40, legendY + 24, 8, 8, 'F');
doc.text("Physics", chartX + 50, legendY + 24);

  // Add page break
  doc.addPage();

  // ======================
  // 📄 PAGE 3: Strength & Weakness
  // ======================
  y = 50; // Reset Y position for new page

  // Header
  doc.setFontSize(18);
  doc.text(`${schoolName} - Student Report Card`, 14, 20);
  doc.setFontSize(12);
  doc.text(`Name: ${student.name} | Roll No: ${student.roll_no} | Class: ${student.class}-${student.section}`, 14, 30);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 40);

  // 🔭 Strength & Weakness
  doc.setFontSize(14);
  doc.text("Strength & Weak Area", 14, y);
  y += 20;

  if (strengthSubject) {
  const strengthText = `Strength: ${strengthSubject.subject} • Avg: ${strengthSubject.average}`;
  const strengthWidth = doc.getTextWidth(strengthText) + 8;
  const badgeHeight = 16;

  doc.setFillColor(135, 206, 235); // Light teal
  doc.roundedRect(14, y - badgeHeight / 2, strengthWidth, badgeHeight, 4, 4, 'FD');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(strengthText, 18, y + 4);
  y += 25;
}

if (weakSubject) {
  const weakText = `Weak: ${weakSubject.subject} • Avg: ${weakSubject.average}`;
  const weakWidth = doc.getTextWidth(weakText) + 8;
  const badgeHeight = 16;

  doc.setFillColor(255, 215, 0); // Orange
  doc.roundedRect(14, y - badgeHeight / 2, weakWidth, badgeHeight, 4, 4, 'FD');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(weakText, 18, y + 4);
  y += 25;
}

  // Add page break
  doc.addPage();

  // ======================
  // 📄 PAGE 4: Exam Results Table
  // ======================
  y = 50; // Reset Y position for new page

  // Header
  doc.setFontSize(18);
  doc.text(`${schoolName} - Student Report Card`, 14, 20);
  doc.setFontSize(12);
  doc.text(`Name: ${student.name} | Roll No: ${student.roll_no} | Class: ${student.class}-${student.section}`, 14, 30);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 40);

  // 📋 Exam Results Table
  doc.setFontSize(12);
  doc.text("Exam Results", 14, y);
  y += 10;

  const tableColumn = [
    "Date", "Exam", "Program", "Physics", "Chemistry", "Maths", "Biology", "Total", "%", "Class Rank", "School Rank", "All Schools"
  ];
  const tableRows = examResults.map(r => [
    r.date,
    r.exam,
    r.program,
    (Number(r.physics) || 0).toFixed(2),
    (Number(r.chemistry) || 0).toFixed(2),
    (Number(r.maths) || 0).toFixed(2),
    (Number(r.biology) || 0).toFixed(2),
    (Number(r.total) || 0).toFixed(2),
    (Number(r.percentage) || 0).toFixed(2),
    r.class_rank,
    r.school_rank,
    r.all_schools_rank
  ]);

  doc.autoTable({
    startY: y,
    head: [tableColumn],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [70, 130, 180] },
    margin: { left: 14, right: 14 },
  });

  // Save PDF
  doc.save(`ReportCard_${student.name}_${new Date().toISOString().split('T')[0]}.pdf`);
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
    <BarChart data={averagesData}  barSize={200} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="subject" tick={false}/>
      <YAxis />
      <Tooltip formatter={(v) => [v, 'Average']} />
      <Legend />
      <Bar dataKey="physics" name="Physics" fill="#1f77b4" />
      <Bar dataKey="chemistry" name="Chemistry" fill="#ff7f0e" />
      <Bar dataKey="maths" name="Mathematics" fill="#2ca02c" />
      <Bar dataKey="biology" name="Biology" fill="#d62728" />
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
                  &nbsp;•&nbsp;Avg {strengthSubject.average}
                </div>
                <div style={styles.pillWarning}>
                  <span style={{ fontWeight: 700 }}>Weak:</span>&nbsp;{weakSubject.subject}
                  &nbsp;•&nbsp;Avg {weakSubject.average}
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
          <button onClick={downloadPDF} style={styles.downloadButton}>
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
              {examResults.map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td>{r.exam}</td>
                  <td>{r.program}</td>
                  <td>{Number(r.physics || 0).toFixed(2)}</td>
                  <td>{Number(r.chemistry || 0).toFixed(2)}</td>
                  <td>{Number(r.maths || 0).toFixed(2)}</td>
                  <td>{Number(r.biology || 0).toFixed(2)}</td>
                  <td>{Number(r.total || 0).toFixed(2)}</td>
                  <td>{Number(r.percentage || 0).toFixed(2)}</td>
                  <td>{r.class_rank}</td>
                  <td>{r.school_rank}</td>
                  <td>{r.all_schools_rank}</td>
                </tr>
              ))}
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
