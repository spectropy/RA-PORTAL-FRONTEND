import React, { useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import spectropyLogoUrl from "../assets/logo.png";
import physicsicon from "../assets/icons/physics.png";
import chemistryicon from "../assets/icons/chemistry.png";
import mathsicon from "../assets/icons/Maths.png";
import biologyicon from "../assets/icons/biology.png";
import { generatePDF as generateReportPDF } from "./downloadpdf";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = {
  blue: "#2563eb",
  blueDark: "#1d4ed8",
  cyan: "#06b6d4",
  violet: "#7c3aed",
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  slate: "#64748b",
};

const SUBJECTS = [
  { key: "physics", label: "Physics", color: COLORS.blue },
  { key: "chemistry", label: "Chemistry", color: COLORS.cyan },
  { key: "maths", label: "Mathematics", color: COLORS.violet },
  { key: "biology", label: "Biology", color: COLORS.green },
];

const toNum = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const round = (value, digits = 1) => Number(toNum(value).toFixed(digits));

const getSubjectPct = (marks, maxMarks) => {
  const max = toNum(maxMarks);
  if (max <= 0) return null;
  return clamp((toNum(marks) / max) * 100, 0, 100);
};

const formatExamName = (name, fallback = "Exam") =>
  String(name || fallback).replace(/_/g, " ");

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getInitials = (name) =>
  String(name || "Student")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const getScoreBand = (percentage) => {
  const score = toNum(percentage);
  if (score >= 90) return { label: "Outstanding", tone: "success" };
  if (score >= 75) return { label: "Strong", tone: "primary" };
  if (score >= 60) return { label: "Developing", tone: "warning" };
  return { label: "Needs support", tone: "danger" };
};

const getTrendText = (change) => {
  if (change > 0.4) return `+${round(change)}% from previous exam`;
  if (change < -0.4) return `${round(change)}% from previous exam`;
  return "Stable from previous exam";
};

const getTrendIcon = (change) => {
  if (change > 0.4) return "↗";
  if (change < -0.4) return "↘";
  return "→";
};

const standardDeviation = (values) => {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

function MetricCard({ icon, label, value, helper, tone = "primary" }) {
  return (
    <article className={`sp-metric-card sp-tone-${tone}`}>
      <div className="sp-metric-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="sp-metric-copy">
        <span className="sp-eyebrow">{label}</span>
        <strong className="sp-metric-value">{value}</strong>
        <span className="sp-metric-helper">{helper}</span>
      </div>
    </article>
  );
}

function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="sp-section-header">
      <div>
        {eyebrow && <span className="sp-section-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="sp-section-action">{action}</div>}
    </div>
  );
}

function ChartCard({ title, subtitle, badge, children, className = "" }) {
  return (
    <section className={`sp-panel sp-chart-card ${className}`}>
      <div className="sp-panel-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {badge && <span className="sp-panel-badge">{badge}</span>}
      </div>
      <div className="sp-chart-area">{children}</div>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="sp-empty-state">
      <div className="sp-empty-icon">📊</div>
      <h2>No performance data yet</h2>
      <p>
        Exam analytics, strengths, trends, and recommendations will appear after
        the first result is published.
      </p>
    </section>
  );
}

const generatePDF = (studentData, schoolData, examResults) => {
  if (!studentData || !schoolData || !examResults?.length) {
    throw new Error("Missing required data for PDF generation");
  }

  // 📄 CREATE LANDSCAPE PDF
  const doc = new jsPDF({
    orientation: "landscape", // ← KEY CHANGE
    unit: "mm",
    format: "a4",
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
  const BLUE = [30, 80, 150]; // Deep blue
  const LIGHT_BLUE = [230, 240, 255]; // Light blue background
  const WHITE = [255, 255, 255];

  // ======================
  // 🏫 HEADER (Blue Theme)
  // ======================
  let y = 15;

  doc.setFontSize(16);
  doc.setFont("Times New Roman", "bold");
  doc.setFillColor(...BLUE);
  doc.setTextColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 25, "F"); // Full header bar
  //doc.addImage(schoolData.logo_url, 8, 2.5, 20, 20);
  // ✅ Safely add school logo only if valid
  if (schoolData.logo_url && typeof schoolData.logo_url === "string") {
    try {
      doc.addImage(schoolData.logo_url, "PNG", 8, 2.5, 20, 20);
    } catch (e) {
      console.warn("Failed to load school logo:", e);
      // Optionally draw a placeholder or skip
    }
  }
  doc.text(schoolData.school_name || "School Name", 30, 12);

  doc.setFontSize(12);
  doc.setFont("Times New Roman", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(
    `Area: ${schoolData.area || "N/A"} | AY: ${schoolData.academic_year}`,
    30,
    20,
  );

  doc.setFontSize(26);
  doc.setFont("Times New Roman", "bold");
  doc.text("IIT Foundation Report Card", 108, 15);
  try {
    doc.addImage(
      spectropyLogoUrl,
      "PNG",
      doc.internal.pageSize.width - 30,
      2,
      15,
      15,
    );
  } catch (e) {
    console.warn("Failed to load Spectropy logo, falling back to text:", e);
  }
  doc.setFontSize(12);
  doc.setFont("Times New Roman", "normal");
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
    case "MAE":
      programName = "Maestro";
      break;
    case "CAT":
      programName = "Catalyst";
      break;
    case "PIO":
      programName = "Pioneer";
      break;
    case "FF":
      programName = "Future Foundation";
      break;
    default:
      programName = programCode;
  }

  // --- Determine stream (IIT, MED, IIT-MED) based on subjects ---
  let hasPhysics = false,
    hasChemistry = false,
    hasMaths = false,
    hasBiology = false;

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
    hasPhysics = keys.some((k) => k.includes("physics"));
    hasChemistry = keys.some((k) => k.includes("chemistry"));
    hasMaths = keys.some((k) => k.includes("maths"));
    hasBiology = keys.some((k) => k.includes("biology"));
    if (hasPhysics && hasChemistry && hasMaths && hasBiology)
      stream = "IIT-MED";
    else if (hasPhysics && hasChemistry && hasMaths) stream = "IIT";
    else if (hasPhysics && hasChemistry && hasBiology) stream = "MED";
    else stream = "—";
  }

  const fullProgram = stream === "—" ? programName : `${programName}-${stream}`;

  // --- Calculate strength & weak subjects ---
  const subjKeys = [
    { key: "physics", label: "Physics" },
    { key: "chemistry", label: "Chemistry" },
    { key: "maths", label: "Mathematics" },
    { key: "biology", label: "Biology" },
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

  const strength = sortedSubj[0]?.key || "—";
  const weak = sortedSubj[sortedSubj.length - 1]?.key || "—";

  // --- Best Exam ---
  const bestExam = examResults.reduce(
    (best, curr) =>
      (curr.percentage || 0) > (best.percentage || 0) ? curr : best,
    {},
  );

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
    doc.setFont("Times New Roman", "normal");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const labelLines = doc.splitTextToSize(label, width - 6); // 3px padding each side
    const labelY = y + 4;
    doc.text(labelLines, x + width / 2, labelY, { align: "center" });

    // --- Prepare VALUE text ---
    let valueStr = String(value);
    if (valueStr === "—") {
      valueStr = "—";
    }

    // Try to fit value by reducing font size until it fits in 1–2 lines
    let fontSize = maxFontSize;
    let lines = [];
    let finalFontSize = 8; // min size
    let finalLines = [valueStr];

    // Try from maxFontSize down to 8
    for (let size = maxFontSize; size >= 8; size--) {
      doc.setFont("Times New Roman", "bold");
      doc.setFontSize(size);
      const attemptLines = doc.splitTextToSize(valueStr, width - 6);

      // Allow up to 2 lines of text
      if (attemptLines.length <= 2) {
        // Check vertical fit: 2 lines need ~10px, 1 line ~7px
        const lineHeight = size * 0.6;
        const totalHeight = attemptLines.length * lineHeight;
        if (totalHeight <= height - 8) {
          // leave 4px top/bottom margin
          finalFontSize = size;
          finalLines = attemptLines;
          break;
        }
      }
    }

    // Draw value
    doc.setFont("Times New Roman", "bold");
    doc.setFontSize(finalFontSize);
    const textHeight = finalLines.length * (finalFontSize * 0.6);
    const valueY = y + (height - textHeight) / 2 + finalFontSize * 0.8; // adjust for baseline

    doc.text(finalLines, x + width / 2, valueY - 3, { align: "center" });
  }

  // --- Draw all 6 rounded boxes ---
  //drawRoundedBox(0, "STUDENT NAME", studentData.name || "—", 14);
  // Box position & size
  const boxWidth = 180;
  const boxHeight = 20; // slightly taller so text fits nicely

  // Draw box
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.1);
  doc.roundedRect(10, 28, boxWidth, boxHeight, 4, 4, "S");

  // Text style
  doc.setFont("Times New Roman", "bold");
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
  doc.setFont("Times New Roman", "normal");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text("ROLL NO", 143, 33);
  doc.setFont("Times New Roman", "bold");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(30);
  doc.text(`${studentData.roll_no || "—"}`, 135, 43);

  doc.setFillColor(255, 236, 158);
  doc.roundedRect(195, 35, 80, 10, 3, 3, "FD");

  // White text on badge
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text(`PROGRAM : ${fullProgram}`, 200, 41);
  //drawRoundedBox(4, "STRENGTH SUBJECT", strength.charAt(0).toUpperCase() + strength.slice(1), 14);
  //drawRoundedBox(5, "WEAK SUBJECT", weak.charAt(0).toUpperCase() + weak.slice(1), 14);

  y = boxY + boxH + 10;

  // ======================
  // 📊 SUBJECT WISE PERFORMANCE SUMMARY — GRAPHICAL PROGRESS BARS
  // ======================

  doc.setFont("Times New Roman", "bold");
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
    biology: [200, 255, 255],
  };

  // Layout constants (relative to current y)
  const labelX = 25;
  const barX = 55;
  const barWidth = 105;
  const barHeight = 12;
  const barGap = 16;
  const pctX = barX + barWidth + 5;

  doc.addImage(physicsicon, "PNG", 15, 70, 10, 10);
  doc.addImage(chemistryicon, "PNG", 15, 87, 10, 10);
  doc.addImage(mathsicon, "PNG", 15, 103, 10, 10);
  doc.addImage(biologyicon, "PNG", 15, 119, 10, 10);

  // Draw each subject row
  subjKeys.forEach((subj, i) => {
    const avgPct = avgMap[subj.key] || 0;
    const barFillWidth = (avgPct / 100) * barWidth;
    const barY = y + i * barGap;

    // Subject label + icon
    //const icon = subjectIcons[subj.key] || '';
    doc.setFont("Times New Roman", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`${subj.label}`, labelX, barY + 8); // ✅ Icon + Subject Name

    // Background bar
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(barX, barY, barWidth, barHeight, 6, 6, "FD");

    // Filled portion
    const [r, g, b] = subjectColors[subj.key] || [230, 230, 230];
    doc.setFillColor(r, g, b);
    doc.roundedRect(barX, barY, barFillWidth, barHeight, 6, 6, "FD");

    // Dark cap (optional visual polish)
    if (barFillWidth > 0) {
      doc.setFillColor(r * 0.7, g * 0.7, b * 0.7);
      doc.rect(barX + barFillWidth - 4, barY, 4, barHeight, "FD");
    }

    // Percentage
    doc.setFont("Times New Roman", "bold");
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
  doc.circle(donutCenterX, donutCenterY - 5, 35, "FD");

  // Inner white circle (creates "donut hole")
  doc.setFillColor(255, 255, 255);
  doc.circle(donutCenterX, donutCenterY - 5, 22, "FD");

  // Main color fill: simulate progress with a solid color circle scaled visually
  // Since we can't draw arcs, we’ll just use a solid colored ring for full effect
  // and rely on the percentage text for accuracy (common in reports)
  doc.setFillColor(30, 80, 150);
  // Trick: draw full circle if >=95%, otherwise use a workaround (not perfect)
  // But for clarity in PDF, just use full ring + accurate text

  doc.circle(donutCenterX, donutCenterY - 5, 35, "FD");
  // Re-draw inner hole to restore donut shape
  doc.setFillColor(255, 255, 255);
  doc.circle(donutCenterX, donutCenterY - 5, 22, "FD");

  // Add percentage in center
  doc.setFont("Times New Roman", "bold");
  doc.setFontSize(40);
  const pctText = `${(bestExam.percentage || 0).toFixed(1)}%`;
  const textWidth = doc.getTextDimensions(pctText).w;
  doc.text(pctText, donutCenterX - textWidth / 2, donutCenterY);

  // Label
  doc.setFontSize(18);
  doc.setFont("Times New Roman", "bold");
  const label = "Overall Score";
  const labelWidth = doc.getTextDimensions(label).w;
  doc.text(label, donutCenterX - labelWidth / 2, donutCenterY - 45);
  doc.setFillColor(102, 204, 102); // same as text color
  doc.circle(205, 140 - 2, 3, "FD");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text(`${strength.charAt(0).toUpperCase() + strength.slice(1)}`, 210, 140);
  doc.setFillColor(255, 99, 132); // same as weak text color
  doc.circle(238, 140 - 2, 3, "FD");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text(`${weak.charAt(0).toUpperCase() + weak.slice(1)}`, 243, 140);

  //y = doc.lastAutoTable.finalY + 10;
  // ======================
  // ✍️ SIGNATURES (at bottom)
  // ======================
  const sigY = pageHeight - 30;
  doc.setFontSize(11);
  doc.setFont("helvetica", "italic");

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
  doc.setFont("Times New Roman", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text(remarkPrefix, 20, sigY - 28);
  doc.setFont("Times New Roman", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 140, 0);
  doc.text(fullRemarkLine, 50, sigY - 28);

  doc.setTextColor(0, 0, 0);
  doc.text("Spectropy CEO", 20, sigY);
  doc.text("Parent/Guardian", 90, sigY);
  doc.text("IIT Coordinator", 160, sigY);
  doc.text("School Principal", 240, sigY);

  doc.setFont("courier", "italic");
  doc.text("Krishna", 20, sigY + 8);
  doc.setFont("Times New Roman", "bold");
  doc.text("Date: ___________", 90, sigY + 8);
  doc.text("Date: ___________", 160, sigY + 8);
  doc.text("Date: ___________", 240, sigY + 8);

  //y = graphY + graphH + 15;
  doc.addPage();
  // ======================
  // 📋 EXAM RESULTS TABLE (Landscape — with 3 Ranks)
  // ======================
  doc.setFont("Times New Roman", "bold");
  doc.setFontSize(18);
  doc.text("Exam Results", 10, y - 125);
  y += 10;

  // Sort examResults by date in ascending order (oldest → newest)
  const sortedExamResults = examResults
    .slice() // Avoid mutating the original array
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const tableData = sortedExamResults.map((r) => {
    const pPct = getSubjectPct(r.physics_marks, r.max_marks_physics);
    const cPct = getSubjectPct(r.chemistry_marks, r.max_marks_chemistry);
    const mPct = getSubjectPct(r.maths_marks, r.max_marks_maths);
    const bPct = getSubjectPct(r.biology_marks, r.max_marks_biology);

    return [
      r.date || "—",
      r.exam.replace(/_/g, " ") || "—",
      String(Math.round(r.correct_answers || 0)),
      String(Math.round(r.wrong_answers || 0)),
      String(Math.round(r.unattempted || 0)),
      `${(r.physics_marks || 0).toFixed(0)} (${pPct.toFixed(0)}%)`,
      `${(r.chemistry_marks || 0).toFixed(0)} (${cPct.toFixed(0)}%)`,
      `${(r.maths_marks || 0).toFixed(0)} (${mPct.toFixed(0)}%)`,
      `${(r.biology_marks || 0).toFixed(0)} (${bPct.toFixed(0)}%)`,
      (r.total || 0).toFixed(0),
      `${(r.percentage || 0).toFixed(1)}%`,
      r.class_rank ?? "—", // Class Rank
      r.school_rank ?? "—", // School Rank
      r.all_schools_rank ?? "—", // All Schools Rank
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
        "All India\nRank",
      ],
    ],
    body: tableData,
    startY: y - 125,
    theme: "grid",
    styles: {
      fontSize: 10,
      cellPadding: 2,
      fontStyle: "normal",
      fillColor: WHITE,
      textColor: 0,
      halign: "center",
    },
    headStyles: {
      fillColor: [30, 80, 150],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 22 }, // Date
      1: { cellWidth: 32, fontStyle: "bold" }, // Exam
      2: { cellWidth: 15 }, //correct
      3: { cellWidth: 15 }, //wrong
      4: { cellWidth: 15 }, //unattempted
      5: { cellWidth: 26 }, // Physics
      6: { cellWidth: 26 }, // Chemistry
      7: { cellWidth: 26 }, // Maths
      8: { cellWidth: 26 }, // Biology
      9: { cellWidth: 15 }, // Total
      10: { cellWidth: 15, fontStyle: "bold" }, // %
      11: { cellWidth: 15, fontStyle: "bold" }, // Class Rank
      12: { cellWidth: 15 }, // School Rank
      13: { cellWidth: 15, fontStyle: "bold" }, // All Schools Rank
    },
    margin: { left: 9, right: 9 },
    tableWidth: "wrap",
  });

  // ======================
  // 💾 SAVE
  // ======================
  const fileName = `ReportCard_${studentData.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
};

export default function StudentPerformanceView({
  student,
  school,
  examResults = [],
  teachers = [],
  title = "Student Performance",
  onBack,
}) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const analytics = useMemo(() => {
    const chronologicalResults = [...examResults].sort((a, b) => {
      const first = a.date ? new Date(a.date).getTime() : 0;
      const second = b.date ? new Date(b.date).getTime() : 0;
      return first - second;
    });

    if (!chronologicalResults.length) {
      return {
        bestExam: null,
        latestExam: null,
        previousExam: null,
        overallAverage: 0,
        improvement: 0,
        accuracy: 0,
        attemptRate: 0,
        consistency: 0,
        scoreBand: getScoreBand(0),
        subjectAverages: [],
        strengthSubject: null,
        weakSubject: null,
        performanceTrend: [],
        attemptData: [],
        recommendations: [],
        nextTarget: 0,
        orderedResults: [],
      };
    }

    const latestExam = chronologicalResults[chronologicalResults.length - 1];
    const previousExam =
      chronologicalResults[chronologicalResults.length - 2] || latestExam;
    const bestExam = [...chronologicalResults].sort(
      (a, b) => toNum(b.percentage) - toNum(a.percentage),
    )[0];

    const percentages = chronologicalResults.map((result) =>
      clamp(toNum(result.percentage), 0, 100),
    );
    const overallAverage =
      percentages.reduce((sum, value) => sum + value, 0) / percentages.length;
    const improvement =
      toNum(latestExam?.percentage) - toNum(previousExam?.percentage);

    const totals = chronologicalResults.reduce(
      (accumulator, result) => ({
        correct: accumulator.correct + toNum(result.correct_answers),
        wrong: accumulator.wrong + toNum(result.wrong_answers),
        unattempted: accumulator.unattempted + toNum(result.unattempted),
      }),
      { correct: 0, wrong: 0, unattempted: 0 },
    );

    const attempted = totals.correct + totals.wrong;
    const totalQuestions = attempted + totals.unattempted;
    const accuracy = attempted ? (totals.correct / attempted) * 100 : 0;
    const attemptRate = totalQuestions ? (attempted / totalQuestions) * 100 : 0;
    const consistency = clamp(100 - standardDeviation(percentages) * 2, 0, 100);

    const subjectAverages = SUBJECTS.map((subject) => {
      const validScores = chronologicalResults
        .map((result) => ({
          value: getSubjectPct(
            result[`${subject.key}_marks`],
            result[`max_marks_${subject.key}`],
          ),
          result,
        }))
        .filter((entry) => entry.value !== null);

      const average = validScores.length
        ? validScores.reduce((sum, entry) => sum + entry.value, 0) /
          validScores.length
        : 0;
      const latest = validScores[validScores.length - 1]?.value ?? 0;
      const previous = validScores[validScores.length - 2]?.value ?? latest;

      return {
        ...subject,
        average: round(average),
        latest: round(latest),
        change: round(latest - previous),
        examsCount: validScores.length,
      };
    });

    const rankedSubjects = [...subjectAverages]
      .filter((subject) => subject.examsCount > 0)
      .sort((a, b) => b.average - a.average);
    const strengthSubject = rankedSubjects[0] || null;
    const weakSubject = rankedSubjects[rankedSubjects.length - 1] || null;

    const performanceTrend = chronologicalResults.map((result, index) => {
      const entry = {
        exam: formatExamName(result.exam, `Exam ${index + 1}`),
        shortExam: `E${index + 1}`,
        date: formatDate(result.date),
        overall: round(result.percentage),
        classRank: result.class_rank ?? null,
      };

      SUBJECTS.forEach((subject) => {
        const value = getSubjectPct(
          result[`${subject.key}_marks`],
          result[`max_marks_${subject.key}`],
        );
        entry[subject.key] = value === null ? null : round(value);
      });

      return entry;
    });

    const recommendations = [];
    if (weakSubject) {
      recommendations.push(
        `Prioritise ${weakSubject.label}: current cumulative average is ${weakSubject.average}%.`,
      );
    }
    if (accuracy < 70) {
      recommendations.push(
        "Focus on error analysis before increasing question volume; accuracy is the main score limiter.",
      );
    } else if (attemptRate < 80) {
      recommendations.push(
        "Use timed mixed practice to improve question selection and completion rate.",
      );
    } else {
      recommendations.push(
        "Maintain the present attempt strategy and increase difficulty gradually.",
      );
    }
    if (consistency < 75) {
      recommendations.push(
        "Performance varies between exams; add a fixed weekly revision and test routine.",
      );
    } else if (improvement > 0.4) {
      recommendations.push(
        "The latest result is improving; continue the same preparation cycle for one more assessment.",
      );
    }

    return {
      bestExam,
      latestExam,
      previousExam,
      overallAverage: round(overallAverage),
      improvement: round(improvement),
      accuracy: round(accuracy),
      attemptRate: round(attemptRate),
      consistency: round(consistency),
      scoreBand: getScoreBand(overallAverage),
      subjectAverages,
      strengthSubject,
      weakSubject,
      performanceTrend,
      attemptData: [
        {
          name: "Correct",
          value: Math.round(totals.correct),
          color: COLORS.green,
        },
        { name: "Wrong", value: Math.round(totals.wrong), color: COLORS.red },
        {
          name: "Unattempted",
          value: Math.round(totals.unattempted),
          color: COLORS.amber,
        },
      ].filter((item) => item.value > 0),
      recommendations,
      nextTarget: Math.min(100, Math.ceil(toNum(latestExam?.percentage) + 5)),
      orderedResults: [...chronologicalResults].reverse(),
    };
  }, [examResults]);

  const {
    bestExam,
    latestExam,
    overallAverage,
    improvement,
    accuracy,
    attemptRate,
    consistency,
    scoreBand,
    subjectAverages,
    strengthSubject,
    weakSubject,
    performanceTrend,
    attemptData,
    recommendations,
    nextTarget,
    orderedResults,
  } = analytics;

  const studentName = student?.name || "Student";
  const classLabel = `${student?.class || "—"}${student?.section ? `-${student.section}` : ""}`;
  const isParentProfile = title === "Your Child's Profile";

  return (
    <>
      <style>{DASHBOARD_CSS}</style>
      {(onBack || examResults.length > 0) && (
        <div className="sp-page-action">
          {isParentProfile && (
            <div className="sp-page-action__title">Your Child's Profile</div>
          )}
          {examResults.length > 0 && (
            <button
              type="button"
              className="sp-button sp-button-page sp-button-page-primary"
              onClick={async () => {
                if (isGeneratingPdf) {
                  return;
                }

                setIsGeneratingPdf(true);

                try {
                  await generateReportPDF(student, school || {}, examResults);
                } catch (error) {
                  console.error(error);
                  window.alert(
                    "Unable to generate the report card. Please try again.",
                  );
                } finally {
                  setIsGeneratingPdf(false);
                }
              }}
              disabled={isGeneratingPdf}
            >
              <FileDown size={15} strokeWidth={2.3} aria-hidden="true" />
              <span>
                {isGeneratingPdf ? "Generating..." : "Download Report Card"}
              </span>
            </button>
          )}
          {onBack && (
            <button
              type="button"
              className="sp-button sp-button-page"
              onClick={onBack}
            >
              Back to Overview
            </button>
          )}
        </div>
      )}

      <div className="sp-dashboard">
        <header className="sp-hero">
          <div className="sp-hero-content">
            <div className="sp-avatar" aria-hidden="true">
              <img
                className="sp-avatar-logo"
                src={school?.logo_url || spectropyLogoUrl}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                  event.currentTarget.nextElementSibling.style.display = "grid";
                }}
              />
              <span className="sp-avatar-fallback">
                {getInitials(studentName)}
              </span>
            </div>
            <div className="sp-identity">
              {!isParentProfile && (
                <span className="sp-hero-kicker">{title}</span>
              )}
              <h1>{studentName}</h1>
              <div className="sp-identity-meta">
                <span>{school?.school_name || "School name unavailable"}</span>
                <span>Class {classLabel}</span>
                <span>
                  Roll No. {student?.roll_no || student?.student_id || "—"}
                </span>
              </div>
            </div>
            {examResults.length > 0 && (
              <div className={`sp-status-badge sp-status-${scoreBand.tone}`}>
                <span className="sp-status-dot" />
                {scoreBand.label}
              </div>
            )}
          </div>
        </header>

        {examResults.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <section
              className="sp-metrics-grid"
              aria-label="Performance summary"
            >
              <MetricCard
                icon="◎"
                label="Average score"
                value={`${overallAverage}%`}
                helper={`${examResults.length} assessment${examResults.length === 1 ? "" : "s"}`}
                tone={scoreBand.tone}
              />
              <MetricCard
                icon={getTrendIcon(improvement)}
                label="Current score"
                value={`${round(latestExam?.percentage)}%`}
                helper={getTrendText(improvement)}
                tone={
                  improvement < -0.4
                    ? "danger"
                    : improvement > 0.4
                      ? "success"
                      : "primary"
                }
              />
              <MetricCard
                icon="✓"
                label="Accuracy"
                value={`${accuracy}%`}
                helper={`${attemptRate}% questions attempted`}
                tone={
                  accuracy >= 75
                    ? "success"
                    : accuracy >= 60
                      ? "warning"
                      : "danger"
                }
              />
              <MetricCard
                icon="#"
                label="Class rank"
                value={
                  latestExam?.class_rank ? `#${latestExam.class_rank}` : "—"
                }
                helper="Current exam"
                tone="primary"
              />
              <MetricCard
                icon="#"
                label="School rank"
                value={
                  latestExam?.school_rank ? `#${latestExam.school_rank}` : "—"
                }
                helper="Current exam"
                tone="primary"
              />
              <MetricCard
                icon="#"
                label="All India rank"
                value={
                  latestExam?.all_schools_rank
                    ? `#${latestExam.all_schools_rank}`
                    : "—"
                }
                helper="Current exam"
                tone="primary"
              />
            </section>

            <section className="sp-insight-strip">
              <div className="sp-insight-main">
                <span className="sp-insight-icon" aria-hidden="true">
                  🎯
                </span>
                <div>
                  <span className="sp-eyebrow">Next performance target</span>
                  <strong>{nextTarget}%</strong>
                  <p>
                    Focus first on{" "}
                    {weakSubject?.label || "the lowest scoring subject"} while
                    protecting strength in{" "}
                    {strengthSubject?.label || "the strongest subject"}.
                  </p>
                </div>
              </div>
              <div className="sp-insight-stats">
                <div>
                  <span>Consistency</span>
                  <strong>{consistency}%</strong>
                </div>
                <div>
                  <span>Best exam</span>
                  <strong>{formatExamName(bestExam?.exam, "—")}</strong>
                </div>
              </div>
            </section>

            <section className="sp-dashboard-section">
              <SectionHeader
                eyebrow="Analytics"
                title="Score overview"
                description="Score movement, subject balance, and assessment behaviour at a glance."
              />

              <div className="sp-chart-grid sp-chart-grid-main">
                <ChartCard
                  className="sp-chart-wide"
                  title="Overall score trend"
                  subtitle="Percentage scored across assessments"
                  badge={`${round(latestExam?.percentage)}% latest`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={performanceTrend}
                      margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="spScoreGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={COLORS.blue}
                            stopOpacity={0.28}
                          />
                          <stop
                            offset="95%"
                            stopColor={COLORS.blue}
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        stroke="#e2e8f0"
                        strokeDasharray="4 4"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="shortExam"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#64748b", fontSize: 12 }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload;
                          return row
                            ? `${row.exam} • ${row.date}`
                            : "Assessment";
                        }}
                        formatter={(value) => [`${value}%`, "Score"]}
                      />
                      <ReferenceLine
                        y={75}
                        stroke="#94a3b8"
                        strokeDasharray="5 5"
                      />
                      <Area
                        type="monotone"
                        dataKey="overall"
                        stroke={COLORS.blue}
                        strokeWidth={3}
                        fill="url(#spScoreGradient)"
                        dot={{
                          r: 4,
                          fill: COLORS.blue,
                          strokeWidth: 2,
                          stroke: "#ffffff",
                        }}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Question outcome"
                  subtitle="Combined attempt pattern"
                  badge={`${accuracy}% accuracy`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={attemptData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="46%"
                        innerRadius="50%"
                        outerRadius="72%"
                        paddingAngle={4}
                        stroke="none"
                      >
                        {attemptData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        wrapperStyle={{ fontSize: 12, color: "#475569" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="sp-chart-grid">
                <ChartCard
                  title="Subject performance"
                  subtitle="Average percentage by subject"
                  badge={`${strengthSubject?.label || "—"} leads`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={subjectAverages}
                      layout="vertical"
                      margin={{ top: 4, right: 24, left: 12, bottom: 0 }}
                    >
                      <CartesianGrid
                        stroke="#e2e8f0"
                        strokeDasharray="4 4"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={88}
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "#334155",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value) => [`${value}%`, "Average"]}
                      />
                      <Bar dataKey="average" radius={[0, 8, 8, 0]} barSize={20}>
                        {subjectAverages.map((subject) => (
                          <Cell key={subject.key} fill={subject.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  className="sp-chart-wide"
                  title="Subject trend"
                  subtitle="How each subject is moving over time"
                  badge={`${examResults.length} exams`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={performanceTrend}
                      margin={{ top: 8, right: 10, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid
                        stroke="#e2e8f0"
                        strokeDasharray="4 4"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="shortExam"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#64748b", fontSize: 12 }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.exam || "Assessment"
                        }
                        formatter={(value, name) => [`${value}%`, name]}
                      />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{ fontSize: 12 }}
                      />
                      {SUBJECTS.map((subject) => (
                        <Line
                          key={subject.key}
                          type="monotone"
                          dataKey={subject.key}
                          name={subject.label}
                          stroke={subject.color}
                          strokeWidth={2.2}
                          connectNulls
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </section>

            <section className="sp-dashboard-section">
              <div className="sp-teacher-insight-grid">
                <section className="sp-panel sp-recommendation-panel">
                  <div className="sp-panel-header">
                    <div>
                      <h3>Recommended teacher actions</h3>
                      <p>
                        Suggested from the student’s current performance
                        pattern.
                      </p>
                    </div>
                    <span className="sp-panel-badge">Auto insight</span>
                  </div>
                  <ol className="sp-action-list">
                    {recommendations.map((recommendation, index) => (
                      <li key={recommendation}>
                        <span>{index + 1}</span>
                        <p>{recommendation}</p>
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="sp-panel sp-snapshot-panel">
                  <div className="sp-panel-header">
                    <div>
                      <h3>Learning snapshot</h3>
                      <p>Fast summary for student or parent discussion.</p>
                    </div>
                  </div>
                  <dl className="sp-snapshot-list">
                    <div>
                      <dt>Strongest subject</dt>
                      <dd>
                        {strengthSubject?.label || "—"}{" "}
                        <span>{strengthSubject?.average ?? 0}%</span>
                      </dd>
                    </div>
                    <div>
                      <dt>Priority subject</dt>
                      <dd>
                        {weakSubject?.label || "—"}{" "}
                        <span>{weakSubject?.average ?? 0}%</span>
                      </dd>
                    </div>
                    <div>
                      <dt>Exam consistency</dt>
                      <dd>
                        {consistency >= 80
                          ? "High"
                          : consistency >= 65
                            ? "Moderate"
                            : "Needs attention"}{" "}
                        <span>{consistency}%</span>
                      </dd>
                    </div>
                    <div>
                      <dt>Attempt behaviour</dt>
                      <dd>
                        {attemptRate >= 85
                          ? "Confident"
                          : attemptRate >= 70
                            ? "Selective"
                            : "Low completion"}{" "}
                        <span>{attemptRate}%</span>
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>
            </section>

            <section className="sp-dashboard-section">
              <SectionHeader
                eyebrow="History"
                title="Exam-wise results"
                description="Detailed marks, attempt data, and class rank for every recorded exam."
                action={
                  <span className="sp-count-chip">
                    {examResults.length} result
                    {examResults.length === 1 ? "" : "s"}
                  </span>
                }
              />

              <div className="sp-panel sp-table-panel sp-desktop-results">
                <div className="sp-table-scroll">
                  <table className="sp-table">
                    <thead>
                      <tr>
                        {[
                          "Date",
                          "Exam",
                          "Program",
                          "Correct",
                          "Wrong",
                          "Not attempted",
                          "Physics",
                          "Chemistry",
                          "Maths",
                          "Biology",
                          "Total",
                          "%",
                          "Class rank",
                          "School rank",
                          "All India rank",
                        ].map((heading) => (
                          <th key={heading}>{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orderedResults.map((result, index) => (
                        <tr
                          key={`${result.exam || "exam"}-${result.date || index}-${index}`}
                        >
                          <td>{formatDate(result.date)}</td>
                          <td className="sp-cell-strong">
                            {formatExamName(result.exam, "—")}
                          </td>
                          <td>{result.program || "—"}</td>
                          <td>
                            <span className="sp-table-number sp-number-good">
                              {Math.round(toNum(result.correct_answers))}
                            </span>
                          </td>
                          <td>
                            <span className="sp-table-number sp-number-bad">
                              {Math.round(toNum(result.wrong_answers))}
                            </span>
                          </td>
                          <td>{Math.round(toNum(result.unattempted))}</td>
                          {SUBJECTS.map((subject) => {
                            const pct = getSubjectPct(
                              result[`${subject.key}_marks`],
                              result[`max_marks_${subject.key}`],
                            );
                            return (
                              <td key={subject.key}>
                                {pct === null
                                  ? "—"
                                  : `${toNum(result[`${subject.key}_marks`])} (${round(pct, 0)}%)`}
                              </td>
                            );
                          })}
                          <td>{round(result.total, 0)}</td>
                          <td className="sp-cell-score">
                            {round(result.percentage)}%
                          </td>
                          <td>{result.class_rank ?? "—"}</td>
                          <td>{result.school_rank ?? "—"}</td>
                          <td>{result.all_schools_rank ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="sp-mobile-results">
                {orderedResults.map((result, index) => (
                  <article
                    className="sp-mobile-result-card"
                    key={`${result.exam || "exam"}-${result.date || index}-mobile`}
                  >
                    <div className="sp-mobile-result-head">
                      <div>
                        <span>{formatDate(result.date)}</span>
                        <h3>{formatExamName(result.exam, "—")}</h3>
                        <p>{result.program || "Program not specified"}</p>
                      </div>
                      <strong>{round(result.percentage)}%</strong>
                    </div>

                    <div className="sp-mobile-result-kpis">
                      <div>
                        <span>Correct</span>
                        <strong>
                          {Math.round(toNum(result.correct_answers))}
                        </strong>
                      </div>
                      <div>
                        <span>Wrong</span>
                        <strong>
                          {Math.round(toNum(result.wrong_answers))}
                        </strong>
                      </div>
                      <div>
                        <span>Class rank</span>
                        <strong>
                          {result.class_rank ? `#${result.class_rank}` : "—"}
                        </strong>
                      </div>
                      <div>
                        <span>School rank</span>
                        <strong>
                          {result.school_rank ? `#${result.school_rank}` : "—"}
                        </strong>
                      </div>
                      <div>
                        <span>All India rank</span>
                        <strong>
                          {result.all_schools_rank
                            ? `#${result.all_schools_rank}`
                            : "—"}
                        </strong>
                      </div>
                    </div>

                    <div className="sp-mobile-subject-list">
                      {SUBJECTS.map((subject) => {
                        const pct = getSubjectPct(
                          result[`${subject.key}_marks`],
                          result[`max_marks_${subject.key}`],
                        );
                        return (
                          <div key={subject.key}>
                            <span>{subject.label}</span>
                            <strong>
                              {pct === null ? "—" : `${round(pct, 0)}%`}
                            </strong>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        <section className="sp-dashboard-section sp-teachers-section">
          <SectionHeader
            eyebrow="Academic support"
            title="Assigned teachers"
            description="Subject contacts available to the student and parent."
          />

          {teachers.length > 0 ? (
            <div className="sp-teacher-grid">
              {teachers.map((teacher, index) => (
                <article
                  className="sp-teacher-card"
                  key={`${teacher.email || teacher.name}-${index}`}
                >
                  <div className="sp-teacher-avatar">
                    {getInitials(teacher.name)}
                  </div>
                  <div className="sp-teacher-copy">
                    <h3>{teacher.name || "Teacher"}</h3>
                    <span>{teacher.subject || "Subject teacher"}</span>
                    <div className="sp-teacher-links">
                      {teacher.email && (
                        <a href={`mailto:${teacher.email}`}>Email</a>
                      )}
                      {teacher.phone && (
                        <a href={`tel:${teacher.phone}`}>Call</a>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="sp-inline-empty">
              No teachers are assigned to this class yet.
            </div>
          )}
        </section>
      </div>
    </>
  );
}

const TOOLTIP_STYLE = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
  fontSize: 12,
};

const DASHBOARD_CSS = `
  .sp-page-action {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    width: 100%;
    max-width: none;
    margin: 0;
    padding: clamp(16px, 3vw, 32px) clamp(16px, 3vw, 32px) 0;
    box-sizing: border-box;
  }

  .sp-page-action__title {
    margin-right: auto;
    color: #1e478f;
    font-size: 20px;
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .sp-dashboard {
    --sp-navy: #0f172a;
    --sp-slate-700: #334155;
    --sp-slate-600: #475569;
    --sp-slate-500: #64748b;
    --sp-slate-300: #cbd5e1;
    --sp-slate-200: #e2e8f0;
    --sp-slate-100: #f1f5f9;
    --sp-slate-50: #f8fafc;
    --sp-blue: #2563eb;
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 18px 20px 24px;
    box-sizing: border-box;
    color: var(--sp-navy);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #f8fafc;
  }

  .sp-dashboard *, .sp-dashboard *::before, .sp-dashboard *::after {
    box-sizing: border-box;
  }

  .sp-hero {
    position: relative;
    overflow: hidden;
    padding: 16px 18px;
    border-radius: 12px;
    color: #fff;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 48%, #1d4ed8 100%);
    box-shadow: 0 8px 24px rgba(15,23,42,.16);
  }

  .sp-hero-actions {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    min-height: 34px;
    margin-bottom: 12px;
  }

  .sp-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 34px;
    padding: 7px 12px;
    border: 0;
    border-radius: 8px;
    font: inherit;
    font-size: 12px;
    font-weight: 750;
    cursor: pointer;
    transition: transform .18s ease, background .18s ease, box-shadow .18s ease;
  }

  .sp-button:hover { transform: translateY(-1px); }
  .sp-button:focus-visible { outline: 3px solid rgba(125, 211, 252, .7); outline-offset: 2px; }
  .sp-button:disabled {
    cursor: wait;
    opacity: .72;
    transform: none;
  }
  .sp-button:disabled:hover { transform: none; }
  .sp-button-ghost { color: #fff; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.2); }
  .sp-button-light { color: #1e3a8a; background: #fff; box-shadow: 0 10px 25px rgba(15,23,42,.18); }
  .sp-button-page {
    min-height: 34px;
    padding: 7px 13px;
    border: 1px solid var(--color-border, #e2e8f0);
    color: var(--color-text-main, #0f172a);
    background: #fff;
    box-shadow: 0 1px 2px rgba(15,23,42,.05);
  }
  .sp-button-page-primary {
    border-color: #2563eb;
    color: #fff;
    background: #2563eb;
  }

  .sp-hero-content {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
  }

  .sp-avatar {
    display: grid;
    place-items: center;
    width: 52px;
    aspect-ratio: 1;
    border-radius: 12px;
    color: #fff;
    background: rgba(255,255,255,.16);
    border: 1px solid rgba(255,255,255,.28);
    backdrop-filter: blur(10px);
    font-size: 18px;
    font-weight: 850;
    letter-spacing: .04em;
  }

  .sp-identity { min-width: 0; }
  .sp-hero-kicker {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 3px;
    color: #bfdbfe;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .sp-identity h1 {
    margin: 0;
    font-size: clamp(21px, 3vw, 28px);
    line-height: 1.15;
    letter-spacing: 0;
  }
  .sp-identity-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    margin-top: 8px;
    color: #dbeafe;
    font-size: 12px;
  }
  .sp-identity-meta span { position: relative; }
  .sp-identity-meta span:not(:last-child)::after {
    content: "";
    position: absolute;
    right: -9px;
    top: 50%;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: #93c5fd;
  }

  .sp-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    align-self: start;
    padding: 7px 10px;
    border: 1px solid rgba(255,255,255,.18);
    border-radius: 999px;
    color: #fff;
    background: rgba(255,255,255,.12);
    backdrop-filter: blur(10px);
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
  }
  .sp-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #60a5fa; }
  .sp-status-success .sp-status-dot { background: #34d399; }
  .sp-status-warning .sp-status-dot { background: #fbbf24; }
  .sp-status-danger .sp-status-dot { background: #fb7185; }

  .sp-metrics-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 10px;
    margin: 14px 0 12px;
  }

  .sp-metric-card {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 9px;
    min-width: 0;
    min-height: 92px;
    padding: 12px;
    overflow: hidden;
    border: 1px solid var(--sp-slate-200);
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 1px 3px rgba(15,23,42,.06);
  }
  .sp-metric-card::after { display: none; }
  .sp-metric-icon {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    flex: 0 0 32px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: var(--metric-color, #2563eb);
    background: var(--metric-soft, #eff6ff);
    font-size: 16px;
    font-weight: 900;
  }
  .sp-metric-copy { position: relative; z-index: 1; min-width: 0; }
  .sp-eyebrow {
    display: block;
    color: var(--sp-slate-500);
    font-size: 10px;
    font-weight: 850;
    letter-spacing: .09em;
    text-transform: uppercase;
  }
  .sp-metric-value {
    display: block;
    margin-top: 5px;
    color: var(--sp-navy);
    font-size: clamp(20px, 2.4vw, 25px);
    line-height: 1;
    letter-spacing: -.04em;
  }
  .sp-metric-helper {
    display: block;
    max-width: 180px;
    margin-top: 6px;
    color: var(--sp-slate-500);
    font-size: 10.5px;
    line-height: 1.35;
  }
  .sp-tone-primary { --metric-color: #2563eb; --metric-soft: #eff6ff; }
  .sp-tone-success { --metric-color: #059669; --metric-soft: #ecfdf5; }
  .sp-tone-warning { --metric-color: #d97706; --metric-soft: #fffbeb; }
  .sp-tone-danger { --metric-color: #dc2626; --metric-soft: #fef2f2; }

  .sp-insight-strip {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(240px, .6fr);
    gap: 12px;
    align-items: center;
    padding: 14px;
    border-radius: 10px;
    color: #fff;
    background: linear-gradient(120deg, #1e40af, #2563eb 55%, #0891b2);
    box-shadow: 0 6px 18px rgba(37,99,235,.14);
  }
  .sp-insight-main { display: flex; align-items: center; gap: 14px; }
  .sp-insight-main .sp-eyebrow { color: #bfdbfe; }
  .sp-insight-icon {
    display: grid;
    place-items: center;
    flex: 0 0 38px;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba(255,255,255,.14);
    font-size: 18px;
  }
  .sp-insight-main strong { display: block; margin-top: 2px; font-size: 22px; }
  .sp-insight-main p { margin: 5px 0 0; color: #dbeafe; font-size: 12px; line-height: 1.5; }
  .sp-insight-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border: 1px solid rgba(255,255,255,.16);
    border-radius: 14px;
    background: rgba(255,255,255,.09);
    backdrop-filter: blur(8px);
  }
  .sp-insight-stats div { min-width: 0; padding: 13px 15px; }
  .sp-insight-stats div + div { border-left: 1px solid rgba(255,255,255,.14); }
  .sp-insight-stats span { display: block; color: #bfdbfe; font-size: 10px; text-transform: uppercase; letter-spacing: .07em; }
  .sp-insight-stats strong { display: block; margin-top: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }

  .sp-dashboard-section { margin-top: 22px; }
  .sp-section-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 12px;
  }
  .sp-section-eyebrow {
    display: block;
    margin-bottom: 5px;
    color: var(--sp-blue);
    font-size: 10px;
    font-weight: 850;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .sp-section-header h2 { margin: 0; font-size: clamp(18px, 2.2vw, 22px); letter-spacing: 0; }
  .sp-section-header p { margin: 6px 0 0; color: var(--sp-slate-500); font-size: 13px; line-height: 1.45; }
  .sp-count-chip, .sp-panel-badge {
    display: inline-flex;
    align-items: center;
    min-height: 26px;
    padding: 5px 9px;
    border-radius: 999px;
    color: #1d4ed8;
    background: #eff6ff;
    font-size: 10px;
    font-weight: 800;
    white-space: nowrap;
  }

  .sp-panel {
    min-width: 0;
    border: 1px solid var(--sp-slate-200);
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 1px 3px rgba(15,23,42,.05);
  }
  .sp-panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 14px 0;
  }
  .sp-panel-header h3 { margin: 0; color: var(--sp-navy); font-size: 14px; }
  .sp-panel-header p { margin: 5px 0 0; color: var(--sp-slate-500); font-size: 11px; line-height: 1.45; }

  .sp-chart-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 12px;
  }
  .sp-chart-grid-main { grid-template-columns: minmax(0, 1.35fr) minmax(280px, .65fr); }
  .sp-chart-wide { grid-column: span 1; }
  .sp-chart-card { min-height: 280px; }
  .sp-chart-area { height: 220px; padding: 8px 8px 10px; }

  .sp-subject-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  .sp-subject-card {
    min-width: 0;
    padding: 12px;
    border: 1px solid var(--sp-slate-200);
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 1px 3px rgba(15,23,42,.045);
  }
  .sp-subject-card-top { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 10px; }
  .sp-subject-icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; font-weight: 850; }
  .sp-subject-card h3 { margin: 0; font-size: 13px; }
  .sp-subject-card-top div span { color: var(--sp-slate-500); font-size: 10px; }
  .sp-mini-tag { padding: 5px 8px; border-radius: 999px; font-size: 9px; font-weight: 850; }
  .sp-mini-success { color: #047857; background: #ecfdf5; }
  .sp-mini-warning { color: #b45309; background: #fffbeb; }
  .sp-subject-score-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-top: 12px; }
  .sp-subject-score-row strong { font-size: 22px; letter-spacing: 0; }
  .sp-subject-score-row span { font-size: 10px; text-align: right; }
  .sp-change-up { color: #059669; }
  .sp-change-down { color: #dc2626; }
  .sp-progress-track { height: 7px; margin-top: 10px; overflow: hidden; border-radius: 999px; background: var(--sp-slate-100); }
  .sp-progress-track span { display: block; height: 100%; border-radius: inherit; }
  .sp-subject-card > p { margin: 13px 0 0; color: var(--sp-slate-500); font-size: 11px; line-height: 1.55; }

  .sp-teacher-insight-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(260px, .75fr); gap: 12px; margin-top: 12px; }
  .sp-recommendation-panel, .sp-snapshot-panel { padding-bottom: 18px; }
  .sp-action-list { display: grid; gap: 9px; margin: 14px 14px 0; padding: 0; list-style: none; }
  .sp-action-list li { display: grid; grid-template-columns: auto minmax(0,1fr); gap: 11px; align-items: start; padding: 11px; border-radius: 13px; background: var(--sp-slate-50); }
  .sp-action-list li > span { display: grid; place-items: center; width: 25px; height: 25px; border-radius: 8px; color: #fff; background: var(--sp-blue); font-size: 11px; font-weight: 850; }
  .sp-action-list p { margin: 2px 0 0; color: var(--sp-slate-600); font-size: 12px; line-height: 1.5; }
  .sp-snapshot-list { margin: 12px 14px 0; }
  .sp-snapshot-list > div { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--sp-slate-100); }
  .sp-snapshot-list > div:last-child { border-bottom: 0; }
  .sp-snapshot-list dt { color: var(--sp-slate-500); font-size: 11px; }
  .sp-snapshot-list dd { margin: 0; color: var(--sp-slate-700); font-size: 12px; font-weight: 750; text-align: right; }
  .sp-snapshot-list dd span { display: inline-block; margin-left: 5px; color: var(--sp-blue); }

  .sp-table-panel { overflow: hidden; }
  .sp-table-scroll { width: 100%; overflow: hidden; }
  .sp-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 11px; white-space: normal; }
  .sp-table th {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 10px 10px;
    border-bottom: 1px solid var(--sp-slate-200);
    color: var(--sp-slate-600);
    background: var(--sp-slate-50);
    font-size: 10px;
    font-weight: 850;
    letter-spacing: .025em;
    text-align: left;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .sp-table td { padding: 10px 6px; border-bottom: 1px solid #eef2f7; color: var(--sp-slate-600); overflow-wrap: anywhere; word-break: break-word; }
  .sp-table tbody tr:last-child td { border-bottom: 0; }
  .sp-table tbody tr:hover { background: #f8fbff; }
  .sp-cell-strong { color: var(--sp-navy) !important; font-weight: 750; }
  .sp-cell-score { color: #1d4ed8 !important; font-weight: 850; }
  .sp-table-number { display: inline-grid; place-items: center; min-width: 26px; height: 24px; padding: 0 6px; border-radius: 7px; font-weight: 800; }
  .sp-number-good { color: #047857; background: #ecfdf5; }
  .sp-number-bad { color: #b91c1c; background: #fef2f2; }
  .sp-mobile-results { display: none; }

  .sp-teacher-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .sp-teacher-card {
    display: flex;
    align-items: center;
    gap: 13px;
    min-width: 0;
    padding: 12px;
    border: 1px solid var(--sp-slate-200);
    border-radius: 8px;
    background: #fff;
  }
  .sp-teacher-avatar { display: grid; place-items: center; flex: 0 0 38px; width: 38px; height: 38px; border-radius: 9px; color: #1d4ed8; background: #eff6ff; font-weight: 850; }
  .sp-teacher-copy { min-width: 0; }
  .sp-teacher-copy h3 { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
  .sp-teacher-copy > span { display: block; margin-top: 3px; color: var(--sp-slate-500); font-size: 11px; }
  .sp-teacher-links { display: flex; gap: 8px; margin-top: 9px; }
  .sp-teacher-links a { padding: 5px 8px; border-radius: 7px; color: #1d4ed8; background: #eff6ff; font-size: 10px; font-weight: 800; text-decoration: none; }
  .sp-inline-empty, .sp-empty-state { border: 1px dashed var(--sp-slate-300); border-radius: 18px; background: #fff; color: var(--sp-slate-500); }
  .sp-inline-empty { padding: 22px; text-align: center; font-size: 13px; }
  .sp-empty-state { display: grid; justify-items: center; margin-top: 16px; padding: 34px 18px; text-align: center; }
  .sp-empty-icon { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 20px; background: #eff6ff; font-size: 28px; }
  .sp-empty-state h2 { margin: 16px 0 0; font-size: 21px; }
  .sp-empty-state p { max-width: 540px; margin: 8px 0 0; color: var(--sp-slate-500); font-size: 13px; line-height: 1.6; }

  /* Reference-led professional results and analysis theme */
  .sp-page-action {
    width: 100%;
    max-width: none;
    margin-left: 0;
    margin-right: 0;
    padding: 18px 24px 0;
  }

  .sp-dashboard {
    --sp-navy: #102a63;
    --sp-slate-700: #26354a;
    --sp-slate-600: #44546a;
    --sp-slate-500: #66758a;
    --sp-slate-300: #cbd5e1;
    --sp-slate-200: #dce3ec;
    --sp-slate-100: #edf1f6;
    --sp-slate-50: #f7f9fc;
    --sp-blue: #1e478f;
    width: 100%;
    max-width: none;
    margin-left: 0;
    margin-right: 0;
    padding: 18px 24px 32px;
    color: #111827;
    background: #f7f9fc;
  }

  .sp-button-page {
    min-height: 38px;
    border-color: #d7dee8;
    border-radius: 7px;
    color: #102a63;
    box-shadow: none;
  }
  .sp-button-page:hover { border-color: #102a63; background: #f4f7fb; }
  .sp-button-page-primary,
  .sp-button-page-primary:hover {
    border-color: #163b82;
    color: #fff;
    background: #163b82;
    box-shadow: 0 3px 8px rgba(16,42,99,.16);
  }

  .sp-hero {
    padding: 20px 22px;
    border: 1px solid #dce3ec;
    border-left: 4px solid #163b82;
    border-radius: 12px;
    color: #111827;
    background: #fff;
    box-shadow: 0 2px 5px rgba(15,23,42,.07);
  }

  .sp-avatar {
    width: 58px;
    padding: 6px;
    overflow: hidden;
    border: 1px solid #dce3ec;
    border-radius: 10px;
    color: #102a63;
    background: #fff;
    backdrop-filter: none;
  }
  .sp-avatar-logo { display: block; width: 100%; height: 100%; object-fit: contain; }
  .sp-avatar-fallback { display: none; width: 100%; height: 100%; place-items: center; }
  .sp-hero-kicker { color: #1e478f; }
  .sp-identity h1 { color: #111827; font-size: clamp(22px, 3vw, 27px); }
  .sp-identity-meta { color: #66758a; }
  .sp-identity-meta span:not(:last-child)::after { background: #a8b3c3; }

  .sp-status-badge {
    border-color: #cfdaea;
    border-radius: 7px;
    color: #163b82;
    background: #edf4ff;
    backdrop-filter: none;
  }
  .sp-status-dot,
  .sp-status-success .sp-status-dot,
  .sp-status-warning .sp-status-dot,
  .sp-status-danger .sp-status-dot { background: #1e478f; }

  .sp-metrics-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 14px 0; }
  .sp-metric-card {
    min-height: 104px;
    padding: 16px;
    border-color: #dce3ec;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(15,23,42,.06);
  }
  .sp-metric-icon,
  .sp-tone-primary .sp-metric-icon,
  .sp-tone-success .sp-metric-icon,
  .sp-tone-warning .sp-metric-icon,
  .sp-tone-danger .sp-metric-icon {
    color: #163b82;
    background: #edf4ff;
  }
  .sp-metric-value { color: #111827; letter-spacing: -.02em; }

  .sp-insight-strip {
    grid-template-columns: minmax(0, 1.4fr) minmax(240px, .6fr);
    padding: 18px;
    border: 1px solid #dce3ec;
    border-left: 4px solid #163b82;
    border-radius: 10px;
    color: #111827;
    background: #fff;
    box-shadow: 0 1px 3px rgba(15,23,42,.06);
  }
  .sp-insight-main .sp-eyebrow { color: #1e478f; }
  .sp-insight-icon {
    position: relative;
    color: transparent;
    background: #edf4ff;
    font-size: 0;
  }
  .sp-insight-icon::after { content: "↑"; color: #163b82; font-size: 20px; font-weight: 800; }
  .sp-insight-main p { color: #5f6f85; }
  .sp-insight-stats {
    border-color: #dce3ec;
    border-radius: 8px;
    background: #f7f9fc;
    backdrop-filter: none;
  }
  .sp-insight-stats div + div { border-left-color: #dce3ec; }
  .sp-insight-stats span { color: #66758a; }
  .sp-insight-stats strong { color: #102a63; }

  .sp-dashboard-section { margin-top: 26px; }
  .sp-section-eyebrow { color: #1e478f; }
  .sp-section-header h2,
  .sp-panel-header h3,
  .sp-subject-card h3,
  .sp-teacher-copy h3 { color: #111827; }
  .sp-count-chip,
  .sp-panel-badge { border-radius: 6px; color: #163b82; background: #edf4ff; }
  .sp-panel,
  .sp-subject-card,
  .sp-teacher-card,
  .sp-mobile-result-card {
    border-color: #dce3ec;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(15,23,42,.055);
  }
  .sp-action-list li { border-radius: 8px; }
  .sp-action-list li > span { border-radius: 6px; background: #163b82; }
  .sp-table th { color: #43526a; background: #f3f6fa; }
  .sp-table tbody tr:hover { background: #f6f9fd; }
  .sp-cell-score { color: #163b82 !important; }
  .sp-teacher-avatar,
  .sp-teacher-links a { color: #163b82; background: #edf4ff; }

  @media (max-width: 1120px) {
    .sp-metrics-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .sp-subject-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sp-chart-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sp-chart-wide { grid-column: span 1; }
    .sp-teacher-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  @media (max-width: 860px) {
    .sp-hero-content { grid-template-columns: auto minmax(0,1fr); }
    .sp-status-badge { grid-column: 2; justify-self: start; }
    .sp-insight-strip, .sp-teacher-insight-grid { grid-template-columns: 1fr; }
    .sp-chart-grid-main, .sp-chart-grid { grid-template-columns: 1fr; }
    .sp-chart-card { min-height: 270px; }
    .sp-chart-area { height: 210px; }
  }

  @media (max-width: 760px) {
    .sp-dashboard { padding: 12px 12px 20px; background: #f8fafc; }
    .sp-hero { border-radius: 10px; padding: 13px; }
    .sp-hero-actions { margin-bottom: 12px; }
    .sp-button { min-height: 34px; padding: 7px 10px; font-size: 11px; border-radius: 7px; }
    .sp-hero-content { gap: 10px; }
    .sp-avatar { width: 44px; border-radius: 10px; font-size: 15px; }
    .sp-identity h1 { font-size: 21px; }
    .sp-identity-meta { display: grid; gap: 4px; font-size: 11px; }
    .sp-identity-meta span::after { display: none; }
    .sp-status-badge { grid-column: 1 / -1; margin-top: 4px; }
    .sp-metrics-grid, .sp-insight-strip, .sp-dashboard-section, .sp-empty-state { margin-left: 0; margin-right: 0; }
    .sp-metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
    .sp-metric-card { min-height: 92px; padding: 10px; gap: 8px; border-radius: 8px; }
    .sp-metric-icon { flex-basis: 28px; width: 28px; height: 28px; border-radius: 7px; font-size: 14px; }
    .sp-metric-value { font-size: 20px; }
    .sp-metric-helper { font-size: 10px; }
    .sp-insight-strip { padding: 12px; border-radius: 8px; }
    .sp-insight-stats { grid-template-columns: 1fr 1fr; }
    .sp-section-header { align-items: flex-start; }
    .sp-section-header p { font-size: 12px; }
    .sp-panel { border-radius: 8px; }
    .sp-panel-header { padding: 12px 12px 0; }
    .sp-chart-card { min-height: 250px; }
    .sp-chart-area { height: 195px; padding: 6px 2px 10px; }
    .sp-subject-grid { grid-template-columns: 1fr; }
    .sp-subject-card { border-radius: 15px; }
    .sp-desktop-results { display: none; }
    .sp-mobile-results { display: grid; gap: 12px; }
    .sp-mobile-result-card { padding: 12px; border: 1px solid var(--sp-slate-200); border-radius: 8px; background: #fff; box-shadow: 0 1px 3px rgba(15,23,42,.045); }
    .sp-mobile-result-head { display: flex; justify-content: space-between; gap: 12px; }
    .sp-mobile-result-head span { color: var(--sp-slate-500); font-size: 10px; }
    .sp-mobile-result-head h3 { margin: 4px 0 0; font-size: 15px; }
    .sp-mobile-result-head p { margin: 4px 0 0; color: var(--sp-slate-500); font-size: 10px; }
    .sp-mobile-result-head > strong { flex: 0 0 auto; color: #1d4ed8; font-size: 20px; letter-spacing: 0; }
    .sp-mobile-result-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
    .sp-mobile-result-kpis div { padding: 7px; border-radius: 8px; background: var(--sp-slate-50); }
    .sp-mobile-result-kpis span, .sp-mobile-subject-list span { display: block; color: var(--sp-slate-500); font-size: 9px; }
    .sp-mobile-result-kpis strong { display: block; margin-top: 3px; font-size: 14px; }
    .sp-mobile-subject-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px 12px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--sp-slate-100); }
    .sp-mobile-subject-list div { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .sp-mobile-subject-list strong { font-size: 11px; }
    .sp-teacher-grid { grid-template-columns: 1fr; }
  }

  @media (max-width: 460px) {
    .sp-hero-actions .sp-button span { display: none; }
    .sp-metrics-grid { grid-template-columns: 1fr 1fr; }
    .sp-metric-card { display: block; }
    .sp-metric-icon { margin-bottom: 10px; }
    .sp-metric-helper { white-space: normal; }
    .sp-insight-main { align-items: flex-start; }
    .sp-insight-icon { flex-basis: 34px; width: 34px; height: 34px; }
    .sp-insight-stats { grid-template-columns: 1fr; }
    .sp-insight-stats div + div { border-left: 0; border-top: 1px solid rgba(255,255,255,.14); }
    .sp-section-header { display: block; }
    .sp-section-action { margin-top: 10px; }
    .sp-subject-card-top { grid-template-columns: auto minmax(0, 1fr); }
    .sp-mini-tag { grid-column: 2; justify-self: start; }
    .sp-mobile-result-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  @media (prefers-reduced-motion: reduce) {
    .sp-button { transition: none; }
  }
`;
