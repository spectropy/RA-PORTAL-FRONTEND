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


export default function StudentDashboard({ onBack, studentId: externalStudentId }) {
  console.log("🔍 StudentDashboard PROPS:", { externalStudentId });
  console.log("🔍 typeof externalStudentId:", typeof externalStudentId);
  console.log("🔍 is truthy?", !!externalStudentId);
  console.log("🔍 trimmed:", externalStudentId?.trim());

  const [student, setStudent] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [examResults, setExamResults] = useState([]);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hasFetched = useRef(false);

  // ✅ Define mode OUTSIDE useEffect
  const isViewingAsSchoolOwner = !!externalStudentId && externalStudentId.trim() !== '';
  console.log("✅ isViewingAsSchoolOwner =", isViewingAsSchoolOwner);

  useEffect(() => {
    // ✅ Now safe to use isViewingAsSchoolOwner inside
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchData = async () => {
  try {
    let studentData = null;
    let schoolId = null;
    let classValue = null;
    let sectionValue = null;
    let examResultsRaw = [];

    if (isViewingAsSchoolOwner) {
      const id = externalStudentId.trim();
      if (!id) throw new Error("Student ID is required.");

      // Fetch exam results
      const res = await fetch(`${API_BASE}/api/exams/results?student_id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("No exam data found for this student.");
      examResultsRaw = await res.json();
      if (!examResultsRaw.length) throw new Error("No exam records found.");

      const first = examResultsRaw[0];
      studentData = {
        student_id: id,
        name: first.first_name + first.last_name,
        roll_no: id,
        class: first.class || "—",
        section: first.section || "—",
        school_id: first.school_id || "—",
        school_name: "—"
      };

      // Optional: enrich school name
      if (first.school_id) {
        const schRes = await fetch(`${API_BASE}/api/schools/${first.school_id}`);
        if (schRes.ok) {
          const sch = await schRes.json();
          studentData.school_name = sch.school?.school_name || "—";
        }
      }

      schoolId = first.school_id;
      classValue = first.class;
      sectionValue = first.section;
      setStudent(studentData);
    } else {
      // Student self-view
      const user = sessionStorage.getItem("sp_user");
      const parsedUser = user ? JSON.parse(user) : null;
      if (!parsedUser?.student_id || !parsedUser?.school_id || !parsedUser?.class || !parsedUser?.section) {
        throw new Error("No student or school context found. Please log in again.");
      }

      studentData = parsedUser;
      schoolId = parsedUser.school_id;
      classValue = parsedUser.class;
      sectionValue = parsedUser.section;
      setStudent(parsedUser);

      // Fetch exam results
      const res = await fetch(`${API_BASE}/api/exams/results?student_id=${encodeURIComponent(parsedUser.student_id)}`);
      if (!res.ok) throw new Error("Failed to fetch your exam results.");
      examResultsRaw = await res.json();
    }

    // 🔹 Sort exam results (same logic for both)
    const getExamTypePriority = (examName) => {
      if (examName.startsWith('WEEK_TEST')) return 0;
      if (examName.startsWith('UNIT_TEST')) return 1;
      if (examName.startsWith('GRAND_TEST')) return 2;
      return 3;
    };
    const parseExamNumber = (examName) => {
      const match = examName.match(/.*_(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    };
    const sortedResults = [...examResultsRaw].sort((a, b) => {
      const prioA = getExamTypePriority(a.exam);
      const prioB = getExamTypePriority(b.exam);
      if (prioA !== prioB) return prioA - prioB;
      const numA = parseExamNumber(a.exam);
      const numB = parseExamNumber(b.exam);
      if (numA !== numB) return numA - numB;
      return a.exam.localeCompare(b.exam);
    });
    setExamResults(sortedResults);

    // 🔹 Fetch school (for logo, teachers, etc.)
    const schoolRes = await fetch(`${API_BASE}/api/schools/${schoolId}`);
    if (!schoolRes.ok) throw new Error("Failed to fetch school details");
    const schoolData = await schoolRes.json();
    setSchool(schoolData.school);

    // 🔹 Teachers
    const assignedTeachers = [];
    if (Array.isArray(schoolData.teachers)) {
      for (const teacher of schoolData.teachers) {
        if (Array.isArray(teacher.teacher_assignments)) {
          const assignments = teacher.teacher_assignments.filter(
            (a) => a.class === classValue && a.section === sectionValue
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
    console.error("Fetch error:", err);
    setError(err.message || "Failed to load data.");
  } finally {
    setLoading(false);
  }
};
    fetchData();
  }, [externalStudentId, isViewingAsSchoolOwner]); // ✅ Now valid — both are in scope

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
  if (!studentData || !schoolData || !examResults?.length) {
    throw new Error('Missing required data for PDF generation');
  }

  // 📄 CREATE LANDSCAPE PDF
  const doc = new jsPDF({
    orientation: 'landscape', // ← KEY CHANGE
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width; // ~297mm
  const pageHeight = doc.internal.pageSize.height; // ~210mm

  // 🔹 Helper: Get subject percentage
  const getSubjectPct = (marks, max) => {
    if (!max || max <= 0) return 0;
    return ((marks || 0) / max) * 100;
  };

  // ======================
  // 🎨 THEME COLORS
  // ======================
  const BLUE = [30, 80, 150];   // Deep blue
  const LIGHT_BLUE = [230, 240, 255]; // Light blue background
  const WHITE = [255, 255, 255];

  // ======================
  // 🏫 HEADER (Blue Theme)
  // ======================
  let y = 15;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(...BLUE);
  doc.setTextColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 25, 'F'); // Full header bar
  doc.text(schoolData.school_name || "School Name", 15, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(`Area: ${schoolData.area || 'N/A'}`, 15, 22);
  doc.text(`Powered BY SPECTROPY`, 240, 15);
  y = 30;

  // ======================
  // 🧑‍🎓 STUDENT INFO BOXES (with Strength & Weak Subject)
  // ======================
  const boxX = 12;
  const boxY = y;
  const boxW = 50;
  const boxH = 22;
  const gap = 1;

  // Calculate strength & weak subjects
  const subjKeys = [
    { key: 'physics', label: 'Physics' },
    { key: 'chemistry', label: 'Chemistry' },
    { key: 'maths', label: 'Mathematics' },
    { key: 'biology', label: 'Biology' }
  ];

  const avgMap = {};
  for (const subj of subjKeys) {
    const marksKey = `${subj.key}_marks`;
    const maxKey = `max_marks_${subj.key}`;
    const totalPct = examResults.reduce((sum, r) => {
      return sum + getSubjectPct(r[marksKey], r[maxKey]);
    }, 0);
    avgMap[subj.key] = examResults.length ? totalPct / examResults.length : 0;
  }

  const sortedSubj = Object.entries(avgMap)
    .sort(([, a], [, b]) => b - a)
    .map(([key, pct]) => ({ key, pct }));

  const strength = sortedSubj[0]?.key || '—';
  const weak = sortedSubj[sortedSubj.length - 1]?.key || '—';

  // Box 1: Name
  doc.setFillColor(...WHITE);
  doc.setTextColor(0, 0, 0);
  doc.rect(boxX, boxY, boxW, boxH, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text("Student Name", boxX + 3, boxY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(studentData.name || "—", boxX + 3, boxY + 14);
  
  // Box 2: Roll No
  doc.setFillColor(...WHITE);
  doc.setTextColor(0, 0, 0);
  doc.rect(boxX + boxW + gap, boxY, boxW, boxH, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text("Roll No", boxX + boxW + gap + 1, boxY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(String(studentData.roll_no || "—"), boxX + boxW + gap + 1, boxY + 14);

  // Box 3: Class
  doc.setFillColor(...WHITE);
  doc.setTextColor(0, 0, 0);
  doc.rect(boxX + 2 * (boxW + gap), boxY, boxW, boxH, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text("Class Section", boxX + 2 * (boxW + gap) + 1, boxY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`${studentData.class}-${studentData.section}`, boxX + 2 * (boxW + gap) + 1, boxY + 14);

  // Box 4: Best Performance
  doc.setFillColor(...WHITE);
  doc.setTextColor(0, 0, 0);
  const bestExam = examResults.reduce((best, curr) =>
    (curr.percentage || 0) > (best.percentage || 0) ? curr : best, {});
  doc.rect(boxX + 3 * (boxW + gap), boxY, boxW, boxH, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text("Best Performed Exam %", boxX + 3 * (boxW + gap) + 1, boxY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`${(bestExam.percentage || 0).toFixed(1)}%`, boxX + 3 * (boxW + gap) + 1, boxY + 14);

  // Box 5: Strength Subject
  doc.setFillColor(...WHITE);
  doc.setTextColor(0, 0, 0);
  doc.rect(boxX + 4 * (boxW + gap), boxY, boxW, boxH, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text("Strength Subject", boxX + 4 * (boxW + gap) + 1, boxY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(strength.charAt(0).toUpperCase() + strength.slice(1), boxX + 4 * (boxW + gap) + 1, boxY + 14);

  // Box 6: Weak Subject
  doc.setFillColor(...WHITE);
  doc.setTextColor(0, 0, 0);
  doc.rect(boxX + 5 * (boxW + gap), boxY, boxW, boxH, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text("Weak Subject", boxX + 5 * (boxW + gap) + 1, boxY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(weak.charAt(0).toUpperCase() + weak.slice(1), boxX + 5 * (boxW + gap) + 1, boxY + 14);

  y = boxY + boxH + 10;

  // ======================
  // 📊 CUMULATIVE SUBJECT AVERAGES (P, C, M, B) — as boxes
  // ======================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text("Cumulative Performance", 15, y);
  y += 8;

  const graphX = 15;
  const graphY = y;
  const graphW = 35;
  const graphH = 25;
  const graphGap = 8;

  subjKeys.forEach((subj, i) => {
    const x = graphX + i * (graphW + graphGap);
    doc.setFillColor(...LIGHT_BLUE);
    doc.rect(x, graphY, graphW, graphH, 'F');
    doc.setFillColor(...WHITE);
    doc.rect(x + 1, graphY + 1, graphW - 2, graphH - 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(subj.label, x + 5, graphY + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text(`${avgMap[subj.key].toFixed(1)}%`, x + 5, graphY + 18);
  });

  y = graphY + graphH + 15;

  // ======================
// 📋 EXAM RESULTS TABLE (Landscape — with 3 Ranks)
// ======================
doc.setFont('helvetica', 'bold');
doc.setFontSize(18);
doc.text("Exam Results", 15, y);
y += 10;

const tableData = examResults.map(r => {
  const pPct = getSubjectPct(r.physics_marks, r.max_marks_physics);
  const cPct = getSubjectPct(r.chemistry_marks, r.max_marks_chemistry);
  const mPct = getSubjectPct(r.maths_marks, r.max_marks_maths);
  const bPct = getSubjectPct(r.biology_marks, r.max_marks_biology);

  return [
    r.date || "—",
    r.exam.replace(/_/g, ' ') || "—",
    `${(r.physics_marks || 0).toFixed(0)} (${pPct.toFixed(0)}%)`,
    `${(r.chemistry_marks || 0).toFixed(0)} (${cPct.toFixed(0)}%)`,
    `${(r.maths_marks || 0).toFixed(0)} (${mPct.toFixed(0)}%)`,
    `${(r.biology_marks || 0).toFixed(0)} (${bPct.toFixed(0)}%)`,
    (r.total || 0).toFixed(0),
    `${(r.percentage || 0).toFixed(1)}%`,
    r.class_rank ?? "—",          // Class Rank
    r.school_rank ?? "—",         // School Rank
    r.all_schools_rank ?? "—"     // All Schools Rank
  ];
});

doc.autoTable({
  head: [
    [
      "Date",
      "Exam",
      "Physics",
      "Chemistry",
      "Maths",
      "Biology",
      "Total",
      "%",
      "Class\nRank",
      "School\nRank",
      "All India\nRank"
    ]
  ],
  body: tableData,
  startY: y,
  theme: 'grid',
  styles: {
    fontSize: 10,
    cellPadding: 2,
    fontStyle: 'bold',
    fillColor: WHITE,
    textColor: 0,
  },
  headStyles: {
    fillColor: BLUE,
    textColor: 255,
    fontStyle: 'bold',
    fontSize: 11,
    halign: 'center'
  },
  columnStyles: {
    0: { cellWidth: 22 }, // Date
    1: { cellWidth: 32 }, // Exam
    2: { cellWidth: 26 }, // Physics
    3: { cellWidth: 26 }, // Chemistry
    4: { cellWidth: 26 }, // Maths
    5: { cellWidth: 26 }, // Biology
    6: { cellWidth: 20 }, // Total
    7: { cellWidth: 18 }, // %
    8: { cellWidth: 18 }, // Class Rank
    9: { cellWidth: 18 }, // School Rank
    10: { cellWidth: 20 } // All Schools Rank
  },
  margin: { left: 15, right: 15 },
  tableWidth: 'wrap'
});

  y = doc.lastAutoTable.finalY + 10;

  // ======================
  // ✍️ SIGNATURES (at bottom)
  // ======================
  const sigY = pageHeight - 30;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'italic');

  // Signature lines with light blue background
  doc.setFillColor(...LIGHT_BLUE);

  doc.setTextColor(0, 0, 0);
  doc.text("Parent/Guardian", 20, sigY);
  doc.text("School Principal", 130, sigY);
  doc.text("Organization Head", 240, sigY);

  doc.text("Date: ___________", 20, sigY + 8);
  doc.text("Date: ___________", 130, sigY + 8);
  doc.text("Date: ___________", 240, sigY + 8);

  // ======================
  // 💾 SAVE
  // ======================
  const fileName = `ReportCard_${studentData.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
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
                <p style={styles.metricLine}><strong>All India Rank:</strong> {bestExam.all_schools_rank ?? '—'}</p>
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
          <th>All India Rank</th>
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
