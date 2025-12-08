// src/StudentDashboard.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import spectropyLogoUrl from '../assets/logo.png';
import physicsicon from '../assets/icons/physics.png';
import chemistryicon from '../assets/icons/chemistry.png';
import mathsicon from '../assets/icons/Maths.png';
import biologyicon from '../assets/icons/biology.png';
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
  doc.setFont('Times New Roman', 'bold');
  doc.setFillColor(...BLUE);
  doc.setTextColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 25, 'F'); // Full header bar
  //doc.addImage(schoolData.logo_url, 8, 2.5, 20, 20);
  // ✅ Safely add school logo only if valid
if (schoolData.logo_url && typeof schoolData.logo_url === 'string') {
  try {
    doc.addImage(schoolData.logo_url, 8, 2.5, 20, 20);
  } catch (e) {
    console.warn('Failed to load school logo:', e);
    // Optionally draw a placeholder or skip
  }
}
  doc.text(schoolData.school_name || "School Name", 30, 12);
  
  doc.setFontSize(12);
  doc.setFont('Times New Roman', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(`Area: ${schoolData.area || 'N/A'} | AY: ${schoolData.academic_year}`, 30, 20);
  
  doc.setFontSize(26);
  doc.setFont('Times New Roman', 'bold');
  doc.text("IIT Foundation Report Card",108,15);
  try {     
  doc.addImage(spectropyLogoUrl, doc.internal.pageSize.width - 30, 2, 15, 15);
} catch (e) {
  console.warn('Failed to load Spectropy logo, falling back to text:', e);
}
  doc.setFontSize(12);
  doc.setFont('Times New Roman', 'normal');
  doc.text(`Powered BY SPECTROPY`, 250, 21);
  y = 30;

  // ======================
// 🧑‍🎓 STUDENT INFO BOXES — SIX INDIVIDUAL ROUNDED BOXES
// ======================

const boxX = 12;
const boxY = y;
const boxW = 44;
const boxH = 18;
const gap = 8;

// --- Map program code to name ---
const programCode = examResults[0]?.program || "—";
let programName = "—";
switch (programCode) {
  case "MAE": programName = "Maestro"; break;
  case "CAT": programName = "Catalyst"; break;
  case "PIO": programName = "Pioneer"; break;
  case "FF": programName = "Future Foundation"; break;
  default: programName = programCode;
}

// --- Determine stream (IIT, MED, IIT-MED) based on subjects ---
let hasPhysics = false, hasChemistry = false, hasMaths = false, hasBiology = false;

// Check subjects from first exam (assume consistent across exams)
const firstExam = examResults[0] || {};
if (firstExam.physics_marks !== undefined) hasPhysics = true;
if (firstExam.chemistry_marks !== undefined) hasChemistry = true;
if (firstExam.maths_marks !== undefined) hasMaths = true;
if (firstExam.biology_marks !== undefined) hasBiology = true;

let stream = "";
if (hasPhysics && hasChemistry && hasMaths && hasBiology) {
  stream = "IIT-MED";
} else if (hasPhysics && hasChemistry && hasMaths) {
  stream = "IIT";
} else if (hasPhysics && hasChemistry && hasBiology) {
  stream = "MED";
} else {
  // Optional: derive from subject keys if marks not reliable
  const keys = Object.keys(firstExam);
  hasPhysics = keys.some(k => k.includes('physics'));
  hasChemistry = keys.some(k => k.includes('chemistry'));
  hasMaths = keys.some(k => k.includes('maths'));
  hasBiology = keys.some(k => k.includes('biology'));
  if (hasPhysics && hasChemistry && hasMaths && hasBiology) stream = "IIT-MED";
  else if (hasPhysics && hasChemistry && hasMaths) stream = "IIT";
  else if (hasPhysics && hasChemistry && hasBiology) stream = "MED";
  else stream = "—";
}

const fullProgram = stream === "—" ? programName : `${programName}-${stream}`;

// --- Calculate strength & weak subjects ---
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

// --- Best Exam ---
const bestExam = examResults.reduce((best, curr) =>
  (curr.percentage || 0) > (best.percentage || 0) ? curr : best, {});

// --- Helper: Draw one labeled rounded box with auto-fit/wrap ---
function drawRoundedBox(offsetIndex, label, value, maxFontSize = 14) {
  const x = boxX + offsetIndex * (boxW + gap);
  const y = boxY;
  const width = boxW;
  const height = boxH;

  // Draw box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.1);
  //doc.roundedRect(x, y, width, height, 3, 3, 'FD');

  // --- Draw LABEL (small, top) ---
  doc.setFont('Times New Roman', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  const labelLines = doc.splitTextToSize(label, width - 6); // 3px padding each side
  const labelY = y + 4;
  doc.text(labelLines, x + width / 2, labelY, { align: 'center' });

  // --- Prepare VALUE text ---
  let valueStr = String(value);
  if (valueStr === '—') {
    valueStr = '—';
  }

  // Try to fit value by reducing font size until it fits in 1–2 lines
  let fontSize = maxFontSize;
  let lines = [];
  let finalFontSize = 8; // min size
  let finalLines = [valueStr];

  // Try from maxFontSize down to 8
  for (let size = maxFontSize; size >= 8; size--) {
    doc.setFont('Times New Roman', 'bold');
    doc.setFontSize(size);
    const attemptLines = doc.splitTextToSize(valueStr, width - 6);
    
    // Allow up to 2 lines of text
    if (attemptLines.length <= 2) {
      // Check vertical fit: 2 lines need ~10px, 1 line ~7px
      const lineHeight = size * 0.6;
      const totalHeight = attemptLines.length * lineHeight;
      if (totalHeight <= height - 8) { // leave 4px top/bottom margin
        finalFontSize = size;
        finalLines = attemptLines;
        break;
      }
    }
  }

  // Draw value
  doc.setFont('Times New Roman', 'bold');
  doc.setFontSize(finalFontSize);
  const textHeight = finalLines.length * (finalFontSize * 0.6);
  const valueY = y + (height - textHeight) / 2 + (finalFontSize * 0.8); // adjust for baseline

  doc.text(finalLines, x + width / 2 , valueY - 3, { align: 'center' });
}

// --- Draw all 6 rounded boxes ---
//drawRoundedBox(0, "STUDENT NAME", studentData.name || "—", 14);
// Box position & size
const boxWidth = 180;
const boxHeight = 20; // slightly taller so text fits nicely

// Draw box
doc.setDrawColor(0, 0, 0);
doc.setLineWidth(0.1);
doc.roundedRect(10, 28, boxWidth, boxHeight, 4, 4, 'S');

// Text style
doc.setFont('Times New Roman', 'bold');
doc.setFontSize(16);
doc.setTextColor(0, 0, 0);
// First line — NAME
doc.text(`${studentData.name || "—"}`, boxX + 6, boxY + 7);

// Second line — ROLL NO
doc.text(`${studentData.class}-${studentData.section}`, boxX + 6, boxY + 14);

/*doc.setFont('Times New Roman', 'bold');
doc.setTextColor( 0, 0, 0);
doc.setFontSize(16);
doc.text(`NAME :    ${studentData.name || "—"}`, 15,35);
//drawRoundedBox(1, "CLASS SECTION", `${studentData.class}-${studentData.section}`, 14);
doc.setFont('Times New Roman', 'bold');
doc.setTextColor( 0, 0, 0);
doc.setFontSize(14);
doc.text(`CLASS SECTION : ${studentData.class}-${studentData.section}`, 15,45);*/

//drawRoundedBox(2, "ROLL NO", studentData.roll_no || "—", 18);
doc.setFont('Times New Roman', 'normal');
doc.setTextColor( 0, 0, 0);
doc.setFontSize(10);
doc.text("ROLL NO", 143,33);
doc.setFont('Times New Roman', 'bold');
doc.setTextColor( 0, 0, 0);
doc.setFontSize(30);
doc.text(`${studentData.roll_no || "—"}`, 135,43);


doc.setFillColor(255, 236, 158);
doc.roundedRect(195, 35, 80, 10, 3, 3, 'FD');

// White text on badge
doc.setTextColor( 0, 0, 0);
doc.setFontSize(14);
doc.text(`PROGRAM : ${fullProgram}`, 200,41);
//drawRoundedBox(4, "STRENGTH SUBJECT", strength.charAt(0).toUpperCase() + strength.slice(1), 14);
//drawRoundedBox(5, "WEAK SUBJECT", weak.charAt(0).toUpperCase() + weak.slice(1), 14);

  y = boxY + boxH + 10;

  // ======================
// 📊 SUBJECT WISE PERFORMANCE SUMMARY — GRAPHICAL PROGRESS BARS
// ======================

doc.setFont('Times New Roman', 'bold');
doc.setFontSize(18);
doc.text("Subject Wise Performance Summary", 15, y + 3);
// Optional underline
//doc.setLineWidth(0.5);
//doc.line(15, y + 2, 15 + doc.getTextDimensions("Subject Wise Performance Summary").w, y + 2);
y += 12; // move y down after title


// Subject colors
const subjectColors = {
  physics: [180, 255, 210],
  chemistry: [200, 230, 255],
  maths: [230, 200, 255],
  biology: [200, 255, 255]
};

// Layout constants (relative to current y)
const labelX = 25;
const barX = 55;
const barWidth = 105;
const barHeight = 12;
const barGap = 16;
const pctX = barX + barWidth + 5;

doc.addImage(physicsicon, 'PNG', 15, 70, 10, 10);
doc.addImage(chemistryicon, 'PNG', 15, 87, 10, 10);
doc.addImage(mathsicon, 'PNG', 15, 103, 10, 10);
doc.addImage(biologyicon, 'PNG', 15, 119, 10,10);

// Draw each subject row
subjKeys.forEach((subj, i) => {
  const avgPct = avgMap[subj.key] || 0;
  const barFillWidth = (avgPct / 100) * barWidth;
  const barY = y + i * barGap;

  // Subject label + icon
  //const icon = subjectIcons[subj.key] || '';
  doc.setFont('Times New Roman', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`${subj.label}`, labelX , barY + 8); // ✅ Icon + Subject Name

  // Background bar
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(barX, barY, barWidth, barHeight, 6, 6, 'FD');

  // Filled portion
  const [r, g, b] = subjectColors[subj.key] || [230, 230, 230];
  doc.setFillColor(r, g, b);
  doc.roundedRect(barX, barY, barFillWidth, barHeight, 6, 6, 'FD');

  // Dark cap (optional visual polish)
  if (barFillWidth > 0) {
    doc.setFillColor(r * 0.7, g * 0.7, b * 0.7);
    doc.rect(barX + barFillWidth - 4, barY, 4, barHeight, 'FD');
  }

  // Percentage
  doc.setFont('Times New Roman', 'bold');
  doc.setFontSize(16);
  doc.text(`${avgPct.toFixed(1)}%`, pctX, barY + 8);
});

// ✅ Update y to below the last bar
y += subjKeys.length * barGap + 10;
// ======================
// 🎯 BEST EXAM DONUT — jsPDF COMPATIBLE (no arc())
// ======================
// Position: to the right of bars
const donutCenterX = 230;
const barChartTop = y - subjKeys.length * barGap - 10;
const barChartHeight = subjKeys.length * barGap;
const donutCenterY = barChartTop + barChartHeight / 2;

// Outer ring (light gray background)
doc.setFillColor(30, 80, 150);
doc.circle(donutCenterX, donutCenterY - 5, 35, 'FD');

// Inner white circle (creates "donut hole")
doc.setFillColor(255, 255, 255);
doc.circle(donutCenterX, donutCenterY - 5, 22, 'FD');

// Main color fill: simulate progress with a solid color circle scaled visually
// Since we can't draw arcs, we’ll just use a solid colored ring for full effect
// and rely on the percentage text for accuracy (common in reports)
doc.setFillColor(30, 80, 150);
// Trick: draw full circle if >=95%, otherwise use a workaround (not perfect)
// But for clarity in PDF, just use full ring + accurate text

doc.circle(donutCenterX, donutCenterY - 5, 35, 'FD');
// Re-draw inner hole to restore donut shape
doc.setFillColor(255, 255, 255);
doc.circle(donutCenterX, donutCenterY - 5, 22, 'FD');

// Add percentage in center
doc.setFont('Times New Roman', 'bold');
doc.setFontSize(40);
const pctText = `${(bestExam.percentage || 0).toFixed(1)}%`;
const textWidth = doc.getTextDimensions(pctText).w;
doc.text(pctText, donutCenterX - textWidth / 2, donutCenterY );

// Label
doc.setFontSize(18);
doc.setFont('Times New Roman', 'bold');
const label = "Overall Score";
const labelWidth = doc.getTextDimensions(label).w;
doc.text(label, donutCenterX - labelWidth / 2, donutCenterY - 45);
doc.setFillColor(102, 204, 102);  // same as text color
doc.circle(205, 140 - 2, 3, 'FD');
doc.setFontSize(13);
doc.setTextColor(0, 0, 0);
doc.text(`${strength.charAt(0).toUpperCase() + strength.slice(1)}`, 210, 140);
doc.setFillColor(255, 99, 132);  // same as weak text color
doc.circle(238, 140 - 2, 3, 'FD');
doc.setFontSize(13);
doc.setTextColor(0, 0, 0);
doc.text(`${ weak.charAt(0).toUpperCase() + weak.slice(1)}`, 243, 140);
  
  //y = doc.lastAutoTable.finalY + 10;
  // ======================
  // ✍️ SIGNATURES (at bottom)
  // ======================
  const sigY = pageHeight - 30;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'italic');

  // Signature lines with light blue background
  doc.setFillColor(...LIGHT_BLUE);

 // --- Auto-generated Remarks based on best exam percentage ---
const overallPct = bestExam.percentage || 0;

let remark = "";
if (overallPct >= 91) {
  remark = "Outstanding performance! Keep excelling.";
} else if (overallPct >= 81) {
  remark = "Excellent work. Aim for the top!";
} else if (overallPct >= 71) {
  remark = "Good performance. Maintain consistency.";
} else if (overallPct >= 61) {
  remark = "Satisfactory. Focus on weak areas.";
} else if (overallPct >= 51) {
  remark = "Needs improvement. Regular practice advised.";
} else if (overallPct >= 41) {
  remark = "Below average. Extra effort required.";
} else {
  remark = "Significant improvement needed. Seek help.";
}

// Optional: Keep underline for empty space after remark
const remarkPrefix = "Remarks: ";
const fullRemarkLine = remark;
doc.setFont('Times New Roman', 'bold');
doc.setFontSize(16);
doc.setTextColor(0, 0, 0);
doc.text(remarkPrefix, 20, sigY - 28);
doc.setFont('Times New Roman', 'bold');
doc.setFontSize(18);
doc.setTextColor(255, 140, 0);
doc.text(fullRemarkLine , 50, sigY - 28);

  doc.setTextColor(0, 0, 0);
  doc.text("Spectropy CEO", 20, sigY);
  doc.text("Parent/Guardian", 90, sigY);
  doc.text("IIT Coordinator", 160, sigY);
  doc.text("School Principal", 240, sigY);
  
  doc.setFont("courier","italic");
  doc.text("Krishna", 20, sigY + 8);
  doc.setFont('Times New Roman', 'bold');
  doc.text("Date: ___________", 90, sigY + 8);
  doc.text("Date: ___________", 160, sigY + 8);
  doc.text("Date: ___________", 240, sigY + 8);
  
  //y = graphY + graphH + 15;
  doc.addPage();
  // ======================
// 📋 EXAM RESULTS TABLE (Landscape — with 3 Ranks)
// ======================
doc.setFont('Times New Roman', 'bold');
doc.setFontSize(18);
doc.text("Exam Results", 10, y - 125);
y += 10;

const tableData = examResults.map(r => {
  const pPct = getSubjectPct(r.physics_marks, r.max_marks_physics);
  const cPct = getSubjectPct(r.chemistry_marks, r.max_marks_chemistry);
  const mPct = getSubjectPct(r.maths_marks, r.max_marks_maths);
  const bPct = getSubjectPct(r.biology_marks, r.max_marks_biology);

  return [
    r.date || "—",
    r.exam.replace(/_/g, ' ') || "—",
    String(Math.round(r.correct_answers || 0)),
    String(Math.round(r.wrong_answers || 0)),
    String(Math.round(r.unattempted || 0)),
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
      "correct",
      "wrong",
      "unattempted",
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
  startY: y - 125,
  theme: 'grid',
  styles: {
    fontSize: 10,
    cellPadding: 2,
    fontStyle: 'normal',
    fillColor: WHITE,
    textColor: 0,
    halign: 'center'
  },
  headStyles: {
    fillColor: [30, 80, 150],
    textColor: 255,
    fontStyle: 'bold',
    fontSize: 9,
    halign: 'center'
  },
  columnStyles: {
    0: { cellWidth: 22 }, // Date
    1: { cellWidth: 32 ,fontStyle: 'bold'}, // Exam
    2: { cellWidth: 15}, //correct
    3: { cellWidth: 15},//wrong
    4: { cellWidth: 15},//unattempted 
    5: { cellWidth: 26 }, // Physics
    6: { cellWidth: 26 }, // Chemistry
    7: { cellWidth: 26 }, // Maths
    8: { cellWidth: 26 }, // Biology
    9: { cellWidth: 15 }, // Total
    10: { cellWidth: 15 ,fontStyle: 'bold' }, // %
    11: { cellWidth: 15 ,fontStyle: 'bold' }, // Class Rank
    12: { cellWidth: 15 }, // School Rank
    13: { cellWidth: 15 ,fontStyle: 'bold' } // All Schools Rank
  },
  margin: { left: 9, right: 9 },
  tableWidth: 'wrap'
});

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
    <BarChart
      data={averagesData}
      barSize={60}
      margin={{ top: 10, right: 10, left: -20, bottom: 50 }}
    >
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="subject"
        tick={{ fontSize: 12, fontWeight: 'bold' }}
        interval={0}
        angle={0}
        dy={10}
      />
      <YAxis
        domain={[0, 100]}
        tickFormatter={(value) => `${value}%`}
      />
      <Tooltip formatter={(v) => [`${v}%`, 'Average']} />
      <Legend />
      <Bar dataKey="average" name="Average %" fill="#1f77b4" radius={[4, 4, 0, 0]} />
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
          <th>correct</th>
          <th>wrong</th>
          <th>unattempted</th>
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
              <td>{r.correct_answers != null ? Math.round(r.correct_answers) : '—'}</td>
              <td>{r.wrong_answers != null ? Math.round(r.wrong_answers) : '—'}</td>
              <td>{r.unattempted != null ? Math.round(r.unattempted) : '—'}</td>
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
        <div style={{ overflowX: 'auto' }}>
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
        </div>
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
  profile: { background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20 , boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
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
