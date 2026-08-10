// src/components/SchoolOwnerDashboard.jsx
import React, { useState, useEffect } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import StudentDashboard from "./StudentDashboard"; // adjust path as needed
import TeacherDashboard from "./TeacherDashboard";
import certificateTemplate from "../assets/certificate.png";
import spectropyLogoUrl from "../assets/logo.png";
import physicsicon from "../assets/icons/physics.png";
import chemistryicon from "../assets/icons/chemistry.png";
import mathsicon from "../assets/icons/Maths.png";
import biologyicon from "../assets/icons/biology.png";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const OWNER_TABS = [
  { id: "overview", path: "overview", icon: "🏫", label: "Overview" },
  { id: "batchwise", path: "batchwise", icon: "📝", label: "Batch Wise" },
  { id: "student", path: "student", icon: "🎓", label: "Student Wise" },
  { id: "teacher", path: "teacher", icon: "👩‍🏫", label: "Teacher Wise" },
];

export default function SchoolOwnerDashboard({ onBack }) {
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classAverages, setClassAverages] = useState([]);
  const [subjectSummaries, setSubjectSummaries] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [classExamData, setClassExamData] = useState({}); // key: "class|section"
  const navigate = useNavigate();
  const location = useLocation();

  const pathSegment = location.pathname.split("/")[2] || "overview";
  const currentTabObj =
    OWNER_TABS.find((t) => t.path === pathSegment) || OWNER_TABS[0];
  const activeTab = currentTabObj.id;

  const [examLoading, setExamLoading] = useState(false);
  // 🔄 Navigation State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState("overview"); // 'overview', 'exam', 'examwise-results', 'student', 'teacher'
  const [selectedClassSection, setSelectedClassSection] = useState(null); // { class, section }
  const [selectedExam, setSelectedExam] = useState(null); // { id, exam_pattern, class, section, school_id, program }

  // For OMR Results (view only — no upload)
  const [examResults, setExamResults] = useState({});
  const [currentOMRExam, setCurrentOMRExam] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false); // 👈 New loading state

  // 📝 Exam Wise View State (isolated from batch flow)
  const [examWiseClassSection, setExamWiseClassSection] = useState(null);
  const [examWiseExams, setExamWiseExams] = useState([]);
  const [examWiseLoading, setExamWiseLoading] = useState(false);
  const [allClassExams, setAllClassExams] = useState([]);
  const [studentIdInput, setStudentIdInput] = useState("");
  const [studentIdInputError, setStudentIdInputError] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [teacherIdInput, setTeacherIdInput] = useState("");
  const [teacherIdInputError, setTeacherIdInputError] = useState("");

  const storedUserStr =
    sessionStorage.getItem("sp_user") || localStorage.getItem("sp_user");
  let userSchoolId = "";
  try {
    const parsedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
    userSchoolId = parsedUser?.school_id || "";
  } catch (e) {
    userSchoolId = "";
  }

  const schoolId =
    sessionStorage.getItem("sp_school_id") ||
    localStorage.getItem("sp_school_id") ||
    userSchoolId;

  // 📥 Fetch School + Analytics
  useEffect(() => {
    if (!schoolId) {
      setError("No school ID found. Please log in again.");
      setLoading(false);
      return;
    }

    const fetchSchoolAndAnalytics = async () => {
      try {
        const schoolRes = await fetch(`${API_BASE}/api/schools/${schoolId}`);
        if (!schoolRes.ok) throw new Error("School not found");
        const schoolData = await schoolRes.json();
        const schoolWithRelations = {
          ...schoolData.school,
          classes: schoolData.classes || [],
          teachers: schoolData.teachers || [],
        };
        setSchool(schoolWithRelations);

        // ✅ Pass the data directly
        await loadLatestExamMetrics(schoolWithRelations);

        setAnalyticsLoading(true);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setAnalyticsLoading(false);
      }
    };

    fetchSchoolAndAnalytics();
  }, [schoolId]);

  // Listen for hamburger toggle event from App.jsx header
  useEffect(() => {
    const onToggle = () => setSidebarOpen((prev) => !prev);
    window.addEventListener("toggleSchoolAdminSidebar", onToggle);
    return () =>
      window.removeEventListener("toggleSchoolAdminSidebar", onToggle);
  }, []);

  const loadLatestExamMetrics = async (schoolData) => {
    // Use schoolData instead of the state variable `school`
    if (!Array.isArray(schoolData.classes) || schoolData.classes.length === 0)
      return;

    setExamLoading(true);
    const metrics = {};

    try {
      await Promise.all(
        schoolData.classes.map(async (cls) => {
          const params = new URLSearchParams({
            school_id: schoolId,
            class: cls.class,
            section: cls.section,
          });
          const res = await fetch(`${API_BASE}/api/exams?${params}`);
          const exams = await res.json();
          if (Array.isArray(exams) && exams.length > 0) {
            const latest = exams.reduce((prev, current) => {
              const prevDate = prev.exam_date
                ? new Date(prev.exam_date)
                : new Date(0);
              const currDate = current.exam_date
                ? new Date(current.exam_date)
                : new Date(0);
              return currDate > prevDate ? current : prev;
            });
            metrics[`${cls.class}|${cls.section}`] = {
              phygrade_per_avg: latest.phygrade_per_avg,
              mathgrade_per_avg: latest.mathgrade_per_avg,
              chemgrade_per_avg: latest.chemgrade_per_avg,
              biograde_per_avg: latest.biograde_per_avg,
              totalgrade_per_avg: latest.totalgrade_per_avg,
              all_india_rank: latest.all_india_rank,
            };
          }
        }),
      );
      setClassExamData(metrics);
    } catch (err) {
      console.error("Failed to load exam metrics:", err);
      setError("Failed to load performance data");
    } finally {
      setExamLoading(false);
    }
  };

  const getActiveSubjects = (group) => {
    const base = ["Physics", "Chemistry"];
    if (!group) return [...base, "Maths", "Biology"]; // default: show all
    const upper = group.toUpperCase();
    if (upper === "PCM") {
      return [...base, "Maths"]; // Show Physics, Chemistry, Maths
    }
    if (upper === "PCB") {
      return [...base, "Biology"]; // Show Physics, Chemistry, Biology
    }
    if (upper === "PCMB") {
      return [...base, "Maths", "Biology"]; // Show all four
    }
    // fallback: if group is something else, show all
    return [...base, "Maths", "Biology"];
  };

  const subjectFieldMap = {
    Physics: "phygrade_per_avg",
    Maths: "mathgrade_per_avg",
    Chemistry: "chemgrade_per_avg",
    Biology: "biograde_per_avg",
  };

  const getGroupByClassSection = (classValue, sectionValue) => {
    if (!school?.classes) return null;
    const cls = school.classes.find(
      (c) => c.class === classValue && c.section === sectionValue,
    );
    return cls?.group || null;
  };

  const computeOverallAnalysis = () => {
    if (!classExamData || Object.keys(classExamData).length === 0) {
      return null;
    }

    const subjects = [
      "phygrade_per_avg",
      "mathgrade_per_avg",
      "chemgrade_per_avg",
      "biograde_per_avg",
    ];
    const subjectNames = {
      phygrade_per_avg: "Physics",
      mathgrade_per_avg: "Maths",
      chemgrade_per_avg: "Chemistry",
      biograde_per_avg: "Biology",
    };

    const totals = {
      phygrade_per_avg: 0,
      mathgrade_per_avg: 0,
      chemgrade_per_avg: 0,
      biograde_per_avg: 0,
    };
    const counts = {
      phygrade_per_avg: 0,
      mathgrade_per_avg: 0,
      chemgrade_per_avg: 0,
      biograde_per_avg: 0,
    };

    // Iterate over each class's exam data
    Object.values(classExamData).forEach((exam) => {
      subjects.forEach((sub) => {
        const val = exam[sub];
        if (val != null && val !== "" && !isNaN(parseFloat(val))) {
          const num = parseFloat(val);
          totals[sub] += num;
          counts[sub] += 1;
        }
      });
    });

    // Compute averages per subject (only if count > 0)
    const averages = {};
    let hasAnyData = false;

    subjects.forEach((sub) => {
      if (counts[sub] > 0) {
        averages[subjectNames[sub]] = (totals[sub] / counts[sub]).toFixed(2);
        hasAnyData = true;
      } else {
        averages[subjectNames[sub]] = null; // or '-' if you prefer
      }
    });

    if (!hasAnyData) return null;

    // Find best subject among those with valid averages
    let bestSubject = null;
    let bestAvg = -Infinity;

    for (const [subName, avg] of Object.entries(averages)) {
      if (avg !== null) {
        const numAvg = parseFloat(avg);
        if (numAvg > bestAvg) {
          bestAvg = numAvg;
          bestSubject = subName;
        }
      }
    }

    // Optionally replace nulls with '-' for display
    const displayAverages = {};
    for (const [sub, avg] of Object.entries(averages)) {
      displayAverages[sub] = avg !== null ? avg : "-";
    }

    return {
      bestSubject: bestSubject || "N/A",
      subjectAverages: displayAverages,
    };
  };

  if (loading)
    return (
      <div className="admin-layout">
        <div
          className="page-canvas"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: 14,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            Loading school data...
          </div>
        </div>
      </div>
    );
  if (error)
    return (
      <div className="admin-layout">
        <div className="page-canvas" style={{ padding: 32 }}>
          <div className="alert-banner alert-banner--error">
            <span className="alert-banner-icon">⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  if (!school)
    return (
      <div className="admin-layout">
        <div className="page-canvas" style={{ padding: 32 }}>
          <div className="alert-banner alert-banner--error">
            <span className="alert-banner-icon">⚠️</span>
            <span>No school data available. Please log in again.</span>
          </div>
        </div>
      </div>
    );

  // ✅ Reusable student report PDF generator (returns Blob)
  const generateStudentReportPDF = (studentData, schoolData, examResults) => {
    return new Promise((resolve, reject) => {
      try {
        if (
          !studentData ||
          !schoolData ||
          !Array.isArray(examResults) ||
          examResults.length === 0
        ) {
          throw new Error("Missing required data");
        }

        const doc = new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: "a4",
        });

        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 14;
        let y = 20;

        // 🔹 Helper: Get subject percentage
        const getSubjectPct = (marks, max) => {
          if (!max || max <= 0) return 0;
          return ((marks || 0) / max) * 100;
        };

        // ======================
        // 🎨 THEME COLORS
        // ======================
        const BLUE = [30, 80, 150];
        const LIGHT_BLUE = [230, 240, 255];
        const WHITE = [255, 255, 255];

        // ======================
        // 🏫 HEADER (Blue Theme)
        // ======================

        doc.setFontSize(16);
        doc.setFont("Times New Roman", "bold");
        doc.setFillColor(...BLUE);
        doc.setTextColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, 25, "F"); // Full header bar
        //doc.addImage(schoolData.logo_url, 8, 2.5, 20, 20);
        // ✅ Safely add school logo only if valid
        if (schoolData.logo_url && typeof schoolData.logo_url === "string") {
          try {
            doc.addImage(schoolData.logo_url, 8, 2.5, 20, 20);
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
            doc.internal.pageSize.width - 30,
            2,
            15,
            15,
          );
        } catch (e) {
          console.warn(
            "Failed to load Spectropy logo, falling back to text:",
            e,
          );
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

        const fullProgram =
          stream === "—" ? programName : `${programName}-${stream}`;

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
          avgMap[subj.key] = examResults.length
            ? totalPct / examResults.length
            : 0;
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
        doc.text(
          `${studentData.class}-${studentData.section}`,
          boxX + 6,
          boxY + 14,
        );

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
        doc.text(
          `${strength.charAt(0).toUpperCase() + strength.slice(1)}`,
          210,
          140,
        );
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

        // ✅ Return blob directly
        resolve(doc.output("blob"));
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleDownloadAllGradesReport = async () => {
    if (!school) {
      alert("School data not loaded.");
      return;
    }

    setExamLoading(true);
    const zip = new JSZip();

    try {
      // ✅ Fetch ALL exam records for the school (contains student info)
      const params = new URLSearchParams({ school_id: schoolId });
      const res = await fetch(`${API_BASE}/api/exams?${params}`);
      const allExamRecords = await res.json();

      if (!Array.isArray(allExamRecords) || allExamRecords.length === 0) {
        alert("No exam records found for the school.");
        return;
      }

      // ✅ Deduplicate students by student_id
      const studentMap = {};
      for (const record of allExamRecords) {
        if (record.student_id && !studentMap[record.student_id]) {
          studentMap[record.student_id] = {
            student_id: record.student_id,
            first_name: record.first_name || "",
            last_name: record.last_name || "",
            class: record.class || "",
            section: record.section || "",
          };
        }
      }

      const uniqueStudents = Object.values(studentMap);
      console.log("✅ Found", uniqueStudents.length, "unique students");

      let generatedCount = 0;

      // ✅ Generate report for each student
      for (const student of uniqueStudents) {
        try {
          // Fetch this student's full exam history
          const studentRes = await fetch(
            `${API_BASE}/api/exams/results?student_id=${student.student_id}`,
          );
          const examResults = await studentRes.json();

          if (!Array.isArray(examResults) || examResults.length === 0) {
            console.warn(
              `⚠️ No exam results for student ${student.student_id}`,
            );
            continue;
          }

          const studentData = {
            name:
              `${student.first_name} ${student.last_name}`.trim() || "Unknown",
            roll_no: student.student_id,
            class: student.class,
            section: student.section,
          };

          const pdfBlob = await generateStudentReportPDF(
            studentData,
            school,
            examResults,
          );

          const safeName = studentData.name.replace(/[^a-z0-9]/gi, "_");
          const folder = `${student.class}_${student.section}`;
          const filename = `${folder}/${safeName}_Report.pdf`;

          zip.file(filename, pdfBlob);
          generatedCount++;
        } catch (err) {
          console.error(
            `Failed to generate report for ${student.student_id}:`,
            err,
          );
        }
      }

      if (generatedCount === 0) {
        alert("No reports could be generated.");
        return;
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, `All_Student_Reports_${school.school_id}.zip`);
    } catch (err) {
      console.error("💥 ZIP generation failed:", err);
      alert("Failed to generate ZIP. Check console for details.");
    } finally {
      setExamLoading(false);
    }
  };

  // 🖼️ Overview Tab — School Info + Quick Stats + IIT Batches
  const renderSchoolHeader = () => (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">
            🏫 {school.school_name || "School Overview"}
          </h1>
          <p className="page-header-subtitle">
            {school.school_id} · {school.area || "Area N/A"},{" "}
            {school.district || "District N/A"}, {school.state || "State N/A"} ·{" "}
            {school.academic_year || "Academic Year N/A"}
          </p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-primary"
            onClick={handleDownloadAllGradesReport}
            disabled={examLoading}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {examLoading ? "⏳ Generating..." : "📥 Download All Grade Reports"}
          </button>
        </div>
      </div>
      <div className="page-content">
        {/* Stat Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {[
            {
              icon: "📚",
              label: "Total Classes",
              value: Array.isArray(school.classes) ? school.classes.length : 0,
              color: "#2563eb",
            },
            {
              icon: "👩‍🏫",
              label: "Total Teachers",
              value: Array.isArray(school.teachers)
                ? school.teachers.length
                : 0,
              color: "#7c3aed",
            },
            {
              icon: "🎓",
              label: "Total Students",
              value: Array.isArray(school.classes)
                ? school.classes.reduce((s, c) => s + (c.num_students || 0), 0)
                : 0,
              color: "#059669",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "#fff",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                padding: "20px 16px",
                boxShadow: "var(--shadow-sm)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{stat.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: stat.color }}>
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                  marginTop: 4,
                  fontWeight: 500,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* School Info */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "20px 24px",
            marginBottom: 24,
          }}
        >
          <h3
            style={{
              margin: "0 0 16px 0",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--primary-700)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            📋 School Information
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
              gap: "10px 24px",
            }}
          >
            {[
              ["School ID", school.school_id],
              ["School Name", school.school_name],
              ["State", school.state],
              ["District", school.district],
              ["Area", school.area],
              ["Academic Year", school.academic_year],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{ padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-muted)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.4px",
                  }}
                >
                  {k}
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    color: "var(--color-text-main)",
                    fontWeight: 600,
                    marginTop: 2,
                  }}
                >
                  {v || "—"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Welcome Banner */}
        <div
          style={{
            padding: "12px 20px",
            background: "linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)",
            borderRadius: 12,
            border: "1px solid #bfdbfe",
            marginBottom: 24,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 500,
              color: "#1d4ed8",
            }}
          >
            👋 Dear Correspondent, Welcome to your School RA Portal
          </p>
        </div>

        {/* Current IIT Batches inline in overview */}
        {renderIITBatches()}
        {renderTeachersTable()}
      </div>
    </div>
  );

  // renderMetricButtons replaced by sidebar tab navigation

  const renderTeachersTable = () => {
    const teacherList = Array.isArray(school?.teachers) ? school.teachers : [];

    if (teacherList.length === 0) {
      return (
        <div style={card}>
          <h3
            style={{
              margin: "0 0 12px 0",
              fontSize: 16,
              color: "#1e293b",
              fontWeight: 700,
            }}
          >
            👩‍🏫 Teachers (0)
          </h3>
          <p
            style={{
              color: "var(--color-text-muted)",
              fontSize: 13,
              margin: 0,
            }}
          >
            No teachers registered for this school yet.
          </p>
        </div>
      );
    }

    return (
      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              color: "#1e293b",
              fontWeight: 700,
            }}
          >
            👩‍🏫 Teachers ({teacherList.length})
          </h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table
            className="detail-inner-table"
            style={{ width: "100%", minWidth: 640 }}
          >
            <thead>
              <tr>
                <th style={{ width: "130px" }}>TEACHER ID</th>
                <th style={{ minWidth: "150px" }}>NAME</th>
                <th style={{ width: "130px" }}>CONTACT</th>
                <th style={{ minWidth: "180px" }}>EMAIL</th>
                <th style={{ minWidth: "220px" }}>
                  ALLOTMENTS (CLASS · SECTION · SUBJECT)
                </th>
              </tr>
            </thead>
            <tbody>
              {teacherList.map((t, idx) => (
                <tr key={t.teacher_id || t.id || idx}>
                  <td>
                    <span
                      className="school-id-badge"
                      style={{ fontSize: "11px", padding: "2px 8px" }}
                    >
                      {t.teacher_id || "-"}
                    </span>
                  </td>
                  <td>
                    <b>{t.name}</b>
                  </td>
                  <td>{t.contact || "-"}</td>
                  <td style={{ color: "#475569", fontSize: 13 }}>
                    {t.email || "-"}
                  </td>
                  <td>
                    {Array.isArray(t.teacher_assignments) &&
                    t.teacher_assignments.length > 0 ? (
                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                      >
                        {t.teacher_assignments.map((a, i) => (
                          <span key={i} className="assignment-tag">
                            {a.class} · {a.section} · {a.subject}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span
                        style={{
                          color: "var(--color-text-muted)",
                          fontSize: 12,
                          fontStyle: "italic",
                        }}
                      >
                        No allotments
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderIITBatches = () => {
    const analysis = computeOverallAnalysis();
    const totalStrength = Array.isArray(school.classes)
      ? school.classes.reduce((sum, c) => sum + (c.num_students || 0), 0)
      : 0;

    // ✅ Determine global active subjects across all classes
    const globalActiveSubjects = new Set();
    school.classes.forEach((cls) => {
      getActiveSubjects(cls.group).forEach((sub) =>
        globalActiveSubjects.add(sub),
      ); // 👈 FIXED
    });
    const globalActive = Array.from(globalActiveSubjects);

    // 📥 Download Performance Analysis + Batches Table as Single A4 PDF
    const downloadIITAnalysisPDF = () => {
      if (
        !school ||
        !Array.isArray(school.classes) ||
        school.classes.length === 0
      ) {
        alert("No data to export");
        return;
      }

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.width;
      let y = 15;

      // ===== HEADER BANNER =====
      doc.setFillColor(37, 79, 162);
      doc.rect(0, 0, pageWidth, 25, "F");
      if (school?.logo_url) {
        try {
          // Adjust size and position: 20x20, centered vertically in 25pt height
          doc.addImage(school.logo_url, "PNG", 8, 2.5, 20, 20);
        } catch (e) {
          console.warn("Failed to load school logo:", e);
        }
      }
      doc.setFontSize(14);
      doc.setFont("bold");
      doc.setTextColor(255, 255, 255);
      doc.text(school.school_name || "Unknown School", 30, 10);
      doc.setFontSize(12);
      doc.setFont("bold");
      doc.text(`Area: ${school.area || "Not Set"}`, 30, 18);

      // --- Spectropy Logo (right) ---
      try {
        doc.addImage(
          spectropyLogoUrl,
          doc.internal.pageSize.width - 30,
          2,
          15,
          15,
        );
      } catch (e) {
        console.warn("Failed to load Spectropy logo, falling back to text:", e);
      }
      doc.setFontSize(10);
      doc.setFont("italic");
      doc.text("Powered BY SPECTROPY", pageWidth - 50, 22);

      y = 35;

      // ===== TITLE =====
      doc.setFontSize(16);
      doc.setFont("bold");
      doc.setTextColor(30, 41, 59);
      doc.text("IIT Foundation School Performance Report", pageWidth / 2, y, {
        align: "center",
      });
      doc.setFontSize(8);
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 60, 30);
      y += 12;

      // ===== PERFORMANCE ANALYSIS (Aligned with computeOverallAnalysis) =====
      const subjects = [
        "phygrade_per_avg",
        "mathgrade_per_avg",
        "chemgrade_per_avg",
        "biograde_per_avg",
      ];
      const subjectNames = {
        phygrade_per_avg: "Physics",
        mathgrade_per_avg: "Maths",
        chemgrade_per_avg: "Chemistry",
        biograde_per_avg: "Biology",
      };

      const totals = {
        phygrade_per_avg: 0,
        mathgrade_per_avg: 0,
        chemgrade_per_avg: 0,
        biograde_per_avg: 0,
      };
      const counts = {
        phygrade_per_avg: 0,
        mathgrade_per_avg: 0,
        chemgrade_per_avg: 0,
        biograde_per_avg: 0,
      };

      school.classes.forEach((cls) => {
        const key = `${cls.class}|${cls.section}`;
        const exam = classExamData[key] || {};
        subjects.forEach((sub) => {
          const val = exam[sub];
          if (val != null && val !== "" && !isNaN(parseFloat(val))) {
            totals[sub] += parseFloat(val);
            counts[sub] += 1;
          }
        });
      });

      const displayAverages = {};
      let hasAnyData = false;
      subjects.forEach((sub) => {
        if (counts[sub] > 0) {
          displayAverages[subjectNames[sub]] = (
            totals[sub] / counts[sub]
          ).toFixed(2);
          hasAnyData = true;
        } else {
          displayAverages[subjectNames[sub]] = "-";
        }
      });

      let bestSubject = "Physics";
      if (hasAnyData) {
        let bestAvg = -Infinity;
        for (const [name, avg] of Object.entries(displayAverages)) {
          if (avg !== "-") {
            const num = parseFloat(avg);
            if (num > bestAvg) {
              bestAvg = num;
              bestSubject = name;
            }
          }
        }
      }

      y += 12;

      // ===== SUBJECT AVERAGES CARDS =====
      doc.setFont("bold");
      doc.setFontSize(14);
      doc.text("Subject Averages (%):", 14, y);
      y += 8;

      const colWidth = (pageWidth - 28) / globalActive.length;
      globalActive.forEach((subName, i) => {
        const x = 14 + i * colWidth;
        const avg = displayAverages[subName] || "-";
        doc.setFillColor(255, 255, 255);
        doc.rect(x, y, colWidth - 4, 24, "F");
        doc.setDrawColor(220, 220, 220);
        doc.rect(x, y, colWidth - 4, 24, "S");
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(subName, x + colWidth / 2 - 2, y + 6, { align: "center" });
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(`${avg}%`, x + colWidth / 2 - 2, y + 14, { align: "center" });
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text("Avg %", x + colWidth / 2 - 2, y + 20, { align: "center" });
      });
      y += 30;

      // ===== IIT BATCHES TABLE — Dynamic Columns =====
      doc.setFontSize(14);
      doc.setFont("bold");
      doc.setTextColor(0, 0, 0);
      doc.text("IIT Foundation Batches", 14, y);
      y += 8;

      // Build header dynamically
      const tableColumn = [
        "Class",
        "Section",
        "Foundation",
        "Program",
        "Group",
        "Students",
        ...globalActive.map((sub) => `${sub} %`), // globalActive is computed correctly above
        "Total %",
      ];

      const tableRows = school.classes.map((cls) => {
        const activeSubs = getActiveSubjects(cls.group);
        const key = `${cls.class}|${cls.section}`;
        const exam = classExamData[key] || {};
        return [
          cls.class || "-",
          cls.section || "-",
          cls.foundation || "-",
          cls.program || "-",
          cls.group || "-", // 👈 This is now used for filtering
          cls.num_students || 0,
          ...globalActive.map((sub) => {
            if (!activeSubs.includes(sub)) return ""; // 👈 Hide column if subject not active for this row
            const field = subjectFieldMap[sub];
            return exam[field] ? parseFloat(exam[field]).toFixed(2) : "-";
          }),
          exam.totalgrade_per_avg
            ? parseFloat(exam.totalgrade_per_avg).toFixed(2)
            : "-",
        ];
      });

      // Total row
      tableRows.push([
        "",
        "",
        "",
        "",
        "Total Strength:",
        totalStrength,
        ...Array(globalActive.length).fill(""),
        "",
      ]);

      // Column widths: adjust based on active subjects
      const baseWidths = { 0: 22, 1: 22, 2: 28, 3: 28, 4: 22, 5: 22 };
      const subjectWidth = 24;
      const totalWidth = 22;
      const columnStyles = { ...baseWidths };
      for (let i = 0; i < globalActive.length; i++) {
        columnStyles[6 + i] = { cellWidth: subjectWidth };
      }
      columnStyles[6 + globalActive.length] = { cellWidth: totalWidth };

      doc.autoTable({
        startY: y,
        head: [tableColumn],
        body: tableRows,
        theme: "grid",
        styles: { fontSize: 10, cellPadding: 2, halign: "center" },
        headStyles: {
          fillColor: [37, 79, 162],
          textColor: [255, 255, 255],
          fontSize: 8,
        },
        columnStyles,
        didParseCell: (data) => {
          if (
            data.row.index === tableRows.length - 1 &&
            data.column.index < 4
          ) {
            data.cell.styles.fontStyle = "normal";
            data.cell.styles.fillColor = [241, 245, 249];
          }
          if (
            data.row.index === tableRows.length - 1 &&
            data.column.index === 4
          ) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [241, 245, 249];
          }
        },
      });

      doc.save(`IIT_Foundation_Analysis_${school.school_id || "school"}.pdf`);
    };

    return (
      <div style={card}>
        <button
          onClick={downloadIITAnalysisPDF}
          disabled={examLoading}
          style={{
            padding: "8px 16px",
            background: examLoading ? "#94a3b8" : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: examLoading ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {examLoading ? "⏳ Loading..." : "📄 Download PDF"}
        </button>

        {/* ===== PERFORMANCE ANALYSIS SECTION ===== */}
        {analysis && (
          <div
            style={{
              marginBottom: "24px",
              padding: "16px",
              background: "#f8fafc",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <h3
              style={{
                margin: "0 0 12px 0",
                color: "#1e293b",
                textAlign: "center",
              }}
            >
              📊 Performance Analysis
            </h3>
            <div style={{ marginBottom: "16px", textAlign: "center" }}>
              <strong>🏆 Best Subject:</strong> {analysis.bestSubject}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-around",
                flexWrap: "wrap",
                gap: "16px",
              }}
            >
              {Object.entries(analysis.subjectAverages)
                .filter(([subject]) => globalActive.includes(subject))
                .map(([subject, avg]) => (
                  <div
                    key={subject}
                    style={{
                      width: "120px",
                      padding: "14px",
                      background: "white",
                      borderRadius: "8px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      textAlign: "center",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        fontWeight: "500",
                      }}
                    >
                      {subject}
                    </div>
                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: "700",
                        color: "#0f172a",
                        marginTop: "4px",
                      }}
                    >
                      {avg}%
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      Avg %
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ===== IIT FOUNDATION BATCHES TABLE ===== */}
        <h2>
          📚 IIT Foundation Batches (
          {Array.isArray(school.classes) ? school.classes.length : 0})
        </h2>
        {examLoading ? (
          <p>Loading performance data...</p>
        ) : Array.isArray(school.classes) && school.classes.length > 0 ? (
          <div
            style={{
              overflowX: "auto", // Enables horizontal scroll if needed
              overflowY: "hidden", // Optional: prevents vertical scroll in container
              width: "100%",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              WebkitOverflowScrolling: "touch", // Smoother scrolling on iOS
            }}
          >
            <table
              className="detail-inner-table"
              style={{ width: "100%", minWidth: "800px" }}
            >
              <thead>
                <tr>
                  <th>CLASS</th>
                  <th>SECTION</th>
                  <th>FOUNDATION</th>
                  <th>PROGRAM</th>
                  <th>GROUP</th>
                  <th>STUDENTS</th>
                  <th>PHYSICS %</th>
                  <th>MATHS %</th>
                  <th>CHEMISTRY %</th>
                  <th>BIOLOGY %</th>
                  <th>TOTAL %</th>
                </tr>
              </thead>
              <tbody>
                {school.classes.map((c, i) => {
                  const key = `${c.class}|${c.section}`;
                  const exam = classExamData[key] || {};

                  return (
                    <tr key={i}>
                      <td>
                        <b>{c.class || "-"}</b>
                      </td>
                      <td>{c.section || "-"}</td>
                      <td>{c.foundation || "-"}</td>
                      <td>{c.program || "-"}</td>
                      <td>{c.group || "-"}</td>
                      <td>
                        <span className="count-chip">
                          {c.num_students || 0}
                        </span>
                      </td>
                      <td>
                        {exam.phygrade_per_avg
                          ? parseFloat(exam.phygrade_per_avg).toFixed(2) + "%"
                          : "-"}
                      </td>
                      <td>
                        {exam.mathgrade_per_avg
                          ? parseFloat(exam.mathgrade_per_avg).toFixed(2) + "%"
                          : "-"}
                      </td>
                      <td>
                        {exam.chemgrade_per_avg
                          ? parseFloat(exam.chemgrade_per_avg).toFixed(2) + "%"
                          : "-"}
                      </td>
                      <td>
                        {exam.biograde_per_avg
                          ? parseFloat(exam.biograde_per_avg).toFixed(2) + "%"
                          : "-"}
                      </td>
                      <td>
                        <b>
                          {exam.totalgrade_per_avg
                            ? parseFloat(exam.totalgrade_per_avg).toFixed(2) +
                              "%"
                            : "-"}
                        </b>
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ background: "#f8fafc", fontWeight: "bold" }}>
                  <td
                    colSpan="5"
                    style={{
                      textAlign: "right",
                      textTransform: "uppercase",
                      fontSize: "11px",
                      letterSpacing: "0.5px",
                      color: "#64748b",
                    }}
                  >
                    Total Strength:
                  </td>
                  <td>
                    <span
                      className="count-chip"
                      style={{
                        background: "var(--primary-600)",
                        color: "#ffffff",
                      }}
                    >
                      {totalStrength}
                    </span>
                  </td>
                  <td colSpan="5"></td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p>No batches added yet.</p>
        )}
      </div>
    );
  };

  const renderExamWiseView = () => {
    const classSections = Array.isArray(school.classes)
      ? school.classes.map((c) => ({ class: c.class, section: c.section }))
      : [];
    // ✅ DEFINE subjectKeyMap HERE — at the top of the function
    const subjectKeyMap = {
      Physics: "phy_exam_per_average",
      Chemistry: "chem_exam_per_average",
      Maths: "math_exam_per_average",
      Biology: "bioexam_per_average",
    };

    const handleSelectClassSection = async (cls, sec) => {
      setExamWiseClassSection({ class: cls, section: sec });
      setExamWiseLoading(true);
      try {
        const params = new URLSearchParams({
          school_id: schoolId,
          class: cls,
          section: sec,
        });
        const res = await fetch(`${API_BASE}/api/exams?${params}`);
        const allExams = await res.json();
        const seen = new Set();
        const deduplicatedExams = allExams.filter((exam) => {
          const key = `${exam.exam_pattern}|${exam.exam_date || ""}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        deduplicatedExams.sort((a, b) => {
          const numA =
            parseInt(a.exam_pattern?.replace(/[^0-9]/g, ""), 10) || 0;
          const numB =
            parseInt(b.exam_pattern?.replace(/[^0-9]/g, ""), 10) || 0;
          return numA - numB;
        });
        setExamWiseExams(deduplicatedExams);
        setAllClassExams(allExams);
      } catch (err) {
        setError("Failed to load exams: " + err.message);
        setExamWiseExams([]);
        setAllClassExams([]);
      } finally {
        setExamWiseLoading(false);
      }
    };

    const handleViewExamResult = async (exam) => {
      setResultsLoading(true);
      try {
        const params = new URLSearchParams({
          school_id: schoolId,
          class: exam.class,
          section: exam.section,
          exam_pattern: exam.exam_pattern,
          exam_date: exam.exam_date || "",
        });
        const res = await fetch(`${API_BASE}/api/exams?${params}`);
        const results = await res.json();
        const examKey = `examwise_${exam.class}_${exam.section}_${exam.exam_pattern}_${exam.exam_date || "latest"}`;
        setExamResults((prev) => ({ ...prev, [examKey]: results }));
        setCurrentOMRExam({ ...exam, id: examKey, key: examKey });
        setView("examwise-results");
      } catch (err) {
        setError("Failed to load results: " + err.message);
      } finally {
        setResultsLoading(false);
      }
    };

    const activeSubs = examWiseClassSection
      ? getActiveSubjects(
          getGroupByClassSection(
            examWiseClassSection.class,
            examWiseClassSection.section,
          ),
        )
      : ["Physics", "Chemistry", "Maths", "Biology"];

    const computeAnalysis = (exams) => {
      if (!Array.isArray(exams) || exams.length === 0) return null;
      const subjects = [
        { key: "phy_exam_per_average", name: "Physics" },
        { key: "chem_exam_per_average", name: "Chemistry" },
        { key: "math_exam_per_average", name: "Maths" },
        { key: "bioexam_per_average", name: "Biology" },
      ];
      // Filter subjects based on activeSubs
      const filteredSubjects = subjects.filter((sub) =>
        activeSubs.includes(sub.name),
      );
      const subjectAverages = {};
      const subjectTopExams = {};
      filteredSubjects.forEach((sub) => {
        let total = 0;
        let count = 0;
        let topExam = null;
        let topValue = -1;
        exams.forEach((exam) => {
          const valStr = exam[sub.key];
          if (valStr !== undefined && valStr !== null && valStr !== "") {
            const val = parseFloat(valStr);
            if (!isNaN(val)) {
              total += val;
              count++;
              if (val > topValue) {
                topValue = val;
                topExam = exam;
              }
            }
          }
        });
        subjectAverages[sub.name] =
          count > 0 ? (total / count).toFixed(2) : "—";
        subjectTopExams[sub.name] = topExam ? topExam.exam_pattern : "—";
      });
      let bestSubject = null;
      let bestAvg = -1;
      for (const [name, avg] of Object.entries(subjectAverages)) {
        if (avg !== "—") {
          const numAvg = parseFloat(avg);
          if (numAvg > bestAvg) {
            bestAvg = numAvg;
            bestSubject = name;
          }
        }
      }
      return { bestSubject, subjectAverages, subjectTopExams };
    };

    const analysis =
      examWiseExams.length > 0 ? computeAnalysis(examWiseExams) : null;

    const computeTopStudents = (exams) => {
      if (!Array.isArray(exams) || exams.length === 0) return [];
      const studentMap = new Map();
      exams.forEach((exam) => {
        if (!exam.student_id || exam.cumulative_percentage == null) return;
        if (studentMap.has(exam.student_id)) return;
        const name =
          [exam.first_name, exam.last_name].filter(Boolean).join(" ") ||
          "Anonymous";
        const cumPct = parseFloat(exam.cumulative_percentage);
        if (!isNaN(cumPct)) {
          studentMap.set(exam.student_id, {
            id: exam.student_id,
            name,
            cumulative_percentage: cumPct,
          });
        }
      });
      return Array.from(studentMap.values())
        .sort((a, b) => b.cumulative_percentage - a.cumulative_percentage)
        .slice(0, 5)
        .map((s, i) => ({ ...s, rank: i + 1 }));
    };

    const topStudents =
      allClassExams.length > 0 ? computeTopStudents(allClassExams) : [];

    const handleGenerateCertificates = async () => {
      if (!topStudents.length || !examWiseClassSection) return;

      const hasPhysics = activeSubs.includes("Physics");
      const hasChemistry = activeSubs.includes("Chemistry");
      const hasMaths = activeSubs.includes("Maths");
      const hasBiology = activeSubs.includes("Biology");

      let examType = "FOUNDATION EXAMS"; // fallback

      if (hasPhysics && hasChemistry) {
        if (hasMaths && !hasBiology) {
          examType = "IIT FOUNDATION EXAMS";
        } else if (hasBiology && !hasMaths) {
          examType = "NEET FOUNDATION EXAMS";
        } else if (hasMaths && hasBiology) {
          examType = "IIT-NEET FOUNDATION EXAMS";
        }
        // If only Physics and Chemistry (no Maths/Biology), keep fallback or handle as needed
      }

      const grade = examWiseClassSection.class;

      for (const [index, student] of topStudents.entries()) {
        await generateCertificateFromImage(student, index + 1, examType, grade);
      }
    };

    const handleDownloadAnalysisPDF = () => {
      if (!examWiseClassSection || !analysis) return;
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      const { class: cls, section: sec } = examWiseClassSection;
      let y = 10;

      // ===== HEADER BANNER =====
      doc.setFillColor(37, 79, 162);
      doc.rect(0, 0, doc.internal.pageSize.width, 25, "F");
      // --- School Logo (left) ---
      if (school?.logo_url) {
        try {
          // Adjust size and position: 20x20, centered vertically in 25pt height
          doc.addImage(school.logo_url, "PNG", 8, 2.5, 20, 20);
        } catch (e) {
          console.warn("Failed to load school logo:", e);
        }
      }
      doc.setFontSize(14);
      doc.setFont("bold");
      doc.setTextColor(255, 255, 255);
      doc.text(school.school_name || "Unknown School", 30, 10);
      doc.setFontSize(12);
      doc.setFont("bold");
      doc.text(`Area: ${school.area || "Not Set"}`, 30, 18);

      // --- Spectropy Logo (right) ---
      try {
        doc.addImage(
          spectropyLogoUrl,
          doc.internal.pageSize.width - 30,
          2,
          15,
          15,
        );
      } catch (e) {
        console.warn("Failed to load Spectropy logo, falling back to text:", e);
      }

      doc.setFontSize(10);
      doc.setFont("italic");
      doc.text("Powered BY SPECTROPY", doc.internal.pageSize.width - 50, 22);

      y = 35;

      // ===== PERFORMANCE ANALYSIS TITLE =====
      const pageWidth = doc.internal.pageSize.width;
      doc.setFontSize(16);
      doc.setFont("bold");
      doc.setTextColor(0, 0, 0);
      doc.text(
        "IIT Foundation Batch-Wise Performace Report",
        pageWidth / 2,
        y,
        { align: "center" },
      );
      doc.setFont("bold");
      doc.setTextColor(0, 0, 0);
      doc.text(`${cls}-${sec}`, 14, 40);
      doc.setFontSize(8);
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 60, 30);
      y += 10;

      // ===== BEST SUBJECT =====
      doc.setFontSize(12);
      doc.setFont("bold");
      doc.text(
        "Best Subject: " + (analysis.bestSubject || "—"),
        pageWidth / 2,
        y,
        { align: "center" },
      );
      y += 12;

      // ===== SUBJECT AVERAGES (%) — DYNAMIC =====
      doc.setFont("bold");
      doc.text("Subject Averages (%):", 14, y);
      y += 8;

      const colWidth = (pageWidth - 28) / activeSubs.length;
      activeSubs.forEach((subject, i) => {
        const x = 14 + i * colWidth;
        const avg = analysis.subjectAverages[subject] || "—";
        doc.setFillColor(255, 255, 255);
        doc.rect(x, y, colWidth - 4, 24, "F");
        doc.setDrawColor(220, 220, 220);
        doc.rect(x, y, colWidth - 4, 24, "S");
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(subject, x + colWidth / 2 - 2, y + 6, { align: "center" });
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(`${avg}%`, x + colWidth / 2 - 2, y + 14, { align: "center" });
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text("Avg %", x + colWidth / 2 - 2, y + 20, { align: "center" });
      });
      y += 40;

      // ===== SUBJECT-WISE TOP EXAM =====
      doc.setFont("bold");
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text("Subject-wise Top Exam:", 14, y);
      y += 8;

      const examPatterns = activeSubs.map(
        (s) => analysis.subjectTopExams[s] || "—",
      );
      const avgPercents = activeSubs.map(
        (s) => `${analysis.subjectAverages[s] || "—"}%`,
      );

      doc.autoTable({
        startY: y,
        head: [activeSubs],
        body: [examPatterns, avgPercents],
        theme: "grid",
        styles: {
          fontSize: 10,
          cellPadding: 5,
          halign: "center",
          textColor: [30, 41, 59],
        },
        headStyles: {
          fillColor: [37, 79, 162],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: activeSubs.reduce(
          (acc, _, i) => ({ ...acc, [i]: { cellWidth: colWidth - 6 } }),
          {},
        ),
      });
      y = doc.lastAutoTable.finalY + 8;

      // ===== EXAM TABLE — DYNAMIC COLUMNS =====
      doc.addPage();
      y = 35;
      doc.setFont("bold");
      doc.setFontSize(12);
      doc.text("Exam Results Table", 14, y);
      y += 8;

      const tableColumn = [
        "Program",
        "Exam Date",
        "Exam Pattern",
        ...activeSubs.map((s) => `${s} %`),
        "Total %",
        "School Rank",
        "All India Rank",
      ];

      const subjectKeyMap = {
        Physics: "phy_exam_per_average",
        Chemistry: "chem_exam_per_average",
        Maths: "math_exam_per_average",
        Biology: "bioexam_per_average",
      };

      const tableRows = examWiseExams.map((exam) => [
        exam.program || "-",
        exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : "-",
        exam.exam_pattern || "-",
        ...activeSubs.map((s) =>
          exam[subjectKeyMap[s]]
            ? parseFloat(exam[subjectKeyMap[s]]).toFixed(2)
            : "-",
        ), // 👈 Only show active subjects
        exam.total_exam_per_avg
          ? parseFloat(exam.total_exam_per_avg).toFixed(2)
          : "-",
        exam.school_grade_rank ?? "-",
        exam.all_schools_grade_rank ?? "-",
      ]);

      const baseColWidths = { 0: 25, 1: 25, 2: 35, 3: activeSubs.length + 3 };
      const subjectColWidth = 30;
      const rankColWidth = 23;
      const columnStyles = {
        0: { cellWidth: 25 },
        1: { cellWidth: 25 },
        2: { cellWidth: 35 },
        ...activeSubs.reduce(
          (acc, _, i) => ({ ...acc, [3 + i]: { cellWidth: subjectColWidth } }),
          {},
        ),
        [3 + activeSubs.length]: { cellWidth: 23 },
        [4 + activeSubs.length]: { cellWidth: rankColWidth },
        [5 + activeSubs.length]: { cellWidth: rankColWidth },
      };

      doc.autoTable({
        startY: y,
        head: [tableColumn],
        body: tableRows,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 4, halign: "center" },
        headStyles: {
          fillColor: [37, 79, 162],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles,
      });

      doc.save(`Performance_Analysis_${cls}-${sec}.pdf`);
    };

    const generateCertificateFromImage = async (
      student,
      rank,
      examType,
      grade,
    ) => {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const w = doc.internal.pageSize.width; // 297mm
      const h = doc.internal.pageSize.height; // 210mm

      // ===== LOAD BASE IMAGE =====
      try {
        // ✅ Use the imported asset directly
        doc.addImage(certificateTemplate, "SVG", 0, 0, w, h);
      } catch (err) {
        console.error("Failed to add certificate template:", err);
        alert(
          "Failed to load certificate template. Check file format and path.",
          certificateTemplate,
        );

        return;
      }

      // ===== ADD SCHOOL LOGOS (TOP LEFT & RIGHT) =====
      if (school?.logo_url) {
        try {
          doc.addImage(school.logo_url, "PNG", 17, 19, 26, 26); // top left
          doc.addImage(school.logo_url, "PNG", 255, 19, 26, 26); // top right
        } catch (e) {
          console.warn("Failed to add school logo:", e);
        }
      }

      // ===== ADD STUDENT NAME =====
      doc.setFontSize(35);
      doc.setFont("Times New Roman", "bold");
      doc.setTextColor(255, 180, 0); // gold
      doc.text(student.name.toUpperCase(), w / 2, 95, { align: "center" }); // Adjust Y based on template

      // ===== ADD GRADE =====
      doc.setFontSize(20);
      doc.setFont("Times New Roman", "bold");
      doc.text(`${grade}`, w / 2 - 2, 110, { align: "center" });

      doc.setFontSize(20);
      doc.setFont("Times New Roman", "bold");
      doc.setTextColor(255, 255, 255); // gold
      doc.text(examType, w / 2, 145, { align: "center" });

      // ===== ADD RANK INSIDE MEDAL =====
      doc.setFontSize(50);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(rank.toString(), w / 2, 170, { align: "center" }); // Adjust Y for medal center

      // ===== ADD DATE =====
      doc.setFontSize(20);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(new Date().toLocaleDateString(), 50, 178);
      //doc.setLineWidth(0.2);
      //doc.line(30, 182, 70, 182);
      //doc.setFontSize(6);
      //doc.text('DATE', 45, 185);

      // ===== SAVE =====
      const safeName = student.name
        .replace(/[^a-z0-9\s]/gi, "_")
        .replace(/\s+/g, "_");
      doc.save(`Certificate_${safeName}_Rank${rank}.pdf`);
    };

    return (
      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <h2>📝 Batch Wise Results</h2>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={() => {
                if (examWiseClassSection) {
                  handleGenerateCertificates();
                } else {
                  alert(
                    "Please select a Class - Section first to generate certificates.",
                  );
                }
              }}
              style={{
                padding: "8px 14px",
                background: "#059669",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              🏆 Generate Certificates
            </button>
            <button
              onClick={handleDownloadAnalysisPDF}
              style={{
                padding: "8px 14px",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              📊 Download Analysis PDF
            </button>
          </div>
        </div>
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}
          >
            Select Class - Section:
          </label>
          <select
            onChange={(e) => {
              const [cls, sec] = e.target.value.split("|");
              if (cls && sec) handleSelectClassSection(cls, sec);
            }}
            style={{
              padding: "10px",
              fontSize: "16px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              minWidth: "250px",
            }}
          >
            <option value="">-- Choose Class - Section --</option>
            {classSections.map((cs, i) => (
              <option key={i} value={`${cs.class}|${cs.section}`}>
                {cs.class} - {cs.section}
              </option>
            ))}
          </select>
          {!examWiseClassSection ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px dashed #cbd5e1",
                marginTop: "16px",
              }}
            >
              <div style={{ fontSize: "42px", marginBottom: "12px" }}>📝</div>
              <h3
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "16px",
                  color: "#1e293b",
                  fontWeight: "700",
                }}
              >
                Select a Class &amp; Section Above
              </h3>
              <p
                style={{
                  margin: "0 auto",
                  color: "#64748b",
                  fontSize: "13.5px",
                  maxWidth: "480px",
                }}
              >
                Choose a Class and Section from the dropdown above to display
                its Performance Analysis cards, subject averages, and batch exam
                results.
              </p>
            </div>
          ) : (
            <>
              <h3 style={{ marginBottom: "16px", color: "#1e293b" }}>
                Exams for {examWiseClassSection.class} -{" "}
                {examWiseClassSection.section}
              </h3>
              {examWiseExams.length > 0 && analysis && (
                <div
                  style={{
                    marginBottom: "24px",
                    padding: "16px",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <h3
                    style={{
                      margin: "0 0 12px 0",
                      color: "#1e293b",
                      textAlign: "center",
                    }}
                  >
                    📊 Performance Analysis
                  </h3>
                  <div style={{ marginBottom: "16px", textAlign: "center" }}>
                    <strong>🏆 Best Subject:</strong>{" "}
                    {analysis.bestSubject || "—"}
                  </div>
                  <h4
                    style={{
                      marginBottom: "12px",
                      color: "#1e293b",
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>📊</span> Subject
                    Averages (%)
                  </h4>

                  {/* Styled Subject Averages as Cards */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-around",
                      flexWrap: "wrap",
                      gap: "16px",
                      marginTop: "12px",
                    }}
                  >
                    {Object.entries(analysis.subjectAverages).map(
                      ([subject, avg]) => (
                        <div
                          key={subject}
                          style={{
                            width: "140px",
                            padding: "16px",
                            background: "white",
                            borderRadius: "8px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                            textAlign: "center",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#64748b",
                              fontWeight: "500",
                            }}
                          >
                            {subject}
                          </div>
                          <div
                            style={{
                              fontSize: "20px",
                              fontWeight: "700",
                              color: "#0f172a",
                              marginTop: "4px",
                            }}
                          >
                            {avg}%
                          </div>
                          <div style={{ fontSize: "12px", color: "#64748b" }}>
                            Avg %
                          </div>
                        </div>
                      ),
                    )}
                  </div>

                  {/* Subject-wise Top Exam */}
                  <div style={{ overflowX: "auto", marginTop: "20px" }}>
                    <strong>🎯 Subject-wise Top Exam:</strong>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        marginTop: "8px",
                        border: "1px solid #cbd5e1",
                        textAlign: "center",
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#e2e8f0" }}>
                          <th
                            style={{
                              padding: "8px",
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            Physics
                          </th>
                          <th
                            style={{
                              padding: "8px",
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            Chemistry
                          </th>
                          <th
                            style={{
                              padding: "8px",
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            Maths
                          </th>
                          <th
                            style={{
                              padding: "8px",
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            Biology
                          </th>
                        </tr>
                        <tr style={{ background: "#f8fafc" }}>
                          <th
                            style={{
                              padding: "4px",
                              fontSize: "12px",
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            Exam Pattern Average %
                          </th>
                          <th
                            style={{
                              padding: "4px",
                              fontSize: "12px",
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            Exam Pattern Average %
                          </th>
                          <th
                            style={{
                              padding: "4px",
                              fontSize: "12px",
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            Exam Pattern Average %
                          </th>
                          <th
                            style={{
                              padding: "4px",
                              fontSize: "12px",
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            Exam Pattern Average %
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td
                            style={{
                              padding: "8px",
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            {analysis.subjectTopExams.Physics}
                            <br />
                            <span
                              style={{ fontSize: "12px", color: "#64748b" }}
                            >
                              {analysis.subjectAverages.Physics}%
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "8px",
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            {analysis.subjectTopExams.Chemistry}
                            <br />
                            <span
                              style={{ fontSize: "12px", color: "#64748b" }}
                            >
                              {analysis.subjectAverages.Chemistry}%
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "8px",
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            {analysis.subjectTopExams.Maths}
                            <br />
                            <span
                              style={{ fontSize: "12px", color: "#64748b" }}
                            >
                              {analysis.subjectAverages.Maths}%
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "8px",
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            {analysis.subjectTopExams.Biology}
                            <br />
                            <span
                              style={{ fontSize: "12px", color: "#64748b" }}
                            >
                              {analysis.subjectAverages.Biology}%
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {topStudents.length > 0 && (
                    <div style={{ marginTop: "24px", overflowX: "auto" }}>
                      <h4 style={{ marginBottom: "12px", color: "#1e293b" }}>
                        🏆 Top 5 Students (Cumulative Performance)
                      </h4>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          border: "1px solid #cbd5e1",
                          textAlign: "center",
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#e2e8f0" }}>
                            <th
                              style={{
                                padding: "10px",
                                border: "1px solid #cbd5e1",
                              }}
                            >
                              Rank
                            </th>
                            <th
                              style={{
                                padding: "10px",
                                border: "1px solid #cbd5e1",
                              }}
                            >
                              Student ID
                            </th>
                            <th
                              style={{
                                padding: "10px",
                                border: "1px solid #cbd5e1",
                              }}
                            >
                              Name
                            </th>
                            <th
                              style={{
                                padding: "10px",
                                border: "1px solid #cbd5e1",
                              }}
                            >
                              Cumulative %
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {topStudents.map((student) => (
                            <tr
                              key={student.id}
                              style={{ background: "#f8fafc" }}
                            >
                              <td
                                style={{
                                  padding: "10px",
                                  border: "1px solid #cbd5e1",
                                  fontWeight: "600",
                                }}
                              >
                                {student.rank}
                              </td>
                              <td
                                style={{
                                  padding: "10px",
                                  border: "1px solid #cbd5e1",
                                }}
                              >
                                {student.id}
                              </td>
                              <td
                                style={{
                                  padding: "10px",
                                  border: "1px solid #cbd5e1",
                                }}
                              >
                                {student.name}
                              </td>
                              <td
                                style={{
                                  padding: "10px",
                                  border: "1px solid #cbd5e1",
                                }}
                              >
                                {student.cumulative_percentage.toFixed(2)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ===== EXAM TABLE ===== */}
              <div style={{ overflowX: "auto", marginTop: "20px" }}>
                {examWiseLoading ? (
                  <p
                    style={{
                      color: "#64748b",
                      fontStyle: "italic",
                      padding: "16px 0",
                    }}
                  >
                    ⏳ Loading exams and performance data...
                  </p>
                ) : examWiseExams.length > 0 ? (
                  <table
                    className="detail-inner-table"
                    style={{ width: "100%", minWidth: "750px" }}
                  >
                    <thead>
                      <tr>
                        <th>PROGRAM</th>
                        <th>EXAM DATE</th>
                        <th>EXAM PATTERN</th>
                        <th>PHYSICS %</th>
                        <th>CHEMISTRY %</th>
                        <th>MATHS %</th>
                        <th>BIOLOGY %</th>
                        <th>TOTAL %</th>
                        <th>SCHOOL RANK</th>
                        <th>AIR RANK</th>
                        <th style={{ textAlign: "center" }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {examWiseExams
                        .slice()
                        .sort((a, b) => {
                          const dateA = a.exam_date
                            ? new Date(a.exam_date)
                            : null;
                          const dateB = b.exam_date
                            ? new Date(b.exam_date)
                            : null;
                          if (!dateA && !dateB) return 0;
                          if (!dateA) return 1;
                          if (!dateB) return -1;
                          return dateA - dateB;
                        })
                        .map((exam, i) => (
                          <tr key={i}>
                            <td>{exam.program || "-"}</td>
                            <td>
                              {exam.exam_date
                                ? new Date(exam.exam_date).toLocaleDateString()
                                : "-"}
                            </td>
                            <td>
                              <b>{exam.exam_pattern || "-"}</b>
                            </td>
                            <td>
                              {exam.phy_exam_per_average
                                ? parseFloat(exam.phy_exam_per_average).toFixed(
                                    2,
                                  ) + "%"
                                : "-"}
                            </td>
                            <td>
                              {exam.chem_exam_per_average
                                ? parseFloat(
                                    exam.chem_exam_per_average,
                                  ).toFixed(2) + "%"
                                : "-"}
                            </td>
                            <td>
                              {exam.math_exam_per_average
                                ? parseFloat(
                                    exam.math_exam_per_average,
                                  ).toFixed(2) + "%"
                                : "-"}
                            </td>
                            <td>
                              {exam.bioexam_per_average
                                ? parseFloat(exam.bioexam_per_average).toFixed(
                                    2,
                                  ) + "%"
                                : "-"}
                            </td>
                            <td>
                              <b>
                                {exam.total_exam_per_avg
                                  ? parseFloat(exam.total_exam_per_avg).toFixed(
                                      2,
                                    ) + "%"
                                  : "-"}
                              </b>
                            </td>
                            <td>
                              {exam.school_grade_rank !== undefined &&
                              exam.school_grade_rank !== null
                                ? exam.school_grade_rank
                                : "-"}
                            </td>
                            <td>
                              {exam.all_schools_grade_rank !== undefined &&
                              exam.all_schools_grade_rank !== null
                                ? exam.all_schools_grade_rank
                                : "-"}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <button
                                className="btn btn-primary"
                                onClick={() => handleViewExamResult(exam)}
                                style={{
                                  padding: "5px 12px",
                                  fontSize: "12px",
                                }}
                              >
                                View Exam Result
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "30px 16px",
                      background: "#f8fafc",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>
                      📄
                    </div>
                    <div
                      style={{
                        fontWeight: "600",
                        color: "#1e293b",
                        marginBottom: "4px",
                      }}
                    >
                      No exams uploaded yet
                    </div>
                    <div style={{ fontSize: "13px", color: "#64748b" }}>
                      No exam results have been registered or uploaded for{" "}
                      <strong>
                        {examWiseClassSection.class}-
                        {examWiseClassSection.section}
                      </strong>{" "}
                      yet.
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderExamWiseResultsView = () => {
    if (!currentOMRExam) {
      setView("exam");
      return null;
    }
    const results = examResults[currentOMRExam.id] || [];

    const totalStudents = results.length;
    const subjectSums = { physics: 0, chemistry: 0, maths: 0, biology: 0 };
    results.forEach((r) => {
      subjectSums.physics += r.physics_marks || 0;
      subjectSums.chemistry += r.chemistry_marks || 0;
      subjectSums.maths += r.maths_marks || 0;
      subjectSums.biology += r.biology_marks || 0;
    });

    const maxPhysics = parseInt(currentOMRExam.max_marks_physics) || 50;
    const maxChemistry = parseInt(currentOMRExam.max_marks_chemistry) || 50;
    const maxMaths = parseInt(currentOMRExam.max_marks_maths) || 50;
    const maxBiology = parseInt(currentOMRExam.max_marks_biology) || 50;

    const subjectAverages = {
      physics:
        totalStudents > 0
          ? ((subjectSums.physics / totalStudents / maxPhysics) * 100).toFixed(
              2,
            )
          : "0.00",
      chemistry:
        totalStudents > 0
          ? (
              (subjectSums.chemistry / totalStudents / maxChemistry) *
              100
            ).toFixed(2)
          : "0.00",
      maths:
        totalStudents > 0
          ? ((subjectSums.maths / totalStudents / maxMaths) * 100).toFixed(2)
          : "0.00",
      biology:
        totalStudents > 0
          ? ((subjectSums.biology / totalStudents / maxBiology) * 100).toFixed(
              2,
            )
          : "0.00",
    };
    const subjectLabels = {
      physics: "Physics",
      chemistry: "Chemistry",
      maths: "Maths",
      biology: "Biology",
    };
    const activeSubs = getActiveSubjects(
      getGroupByClassSection(currentOMRExam.class, currentOMRExam.section),
    );
    const filteredSubjectAverages = Object.fromEntries(
      activeSubs.map((subject) => {
        const key = subject.toLowerCase();
        return [key, subjectAverages[key]];
      }),
    );
    const overallAverage =
      totalStudents > 0
        ? (
            Object.values(subjectAverages).reduce(
              (sum, avg) => sum + parseFloat(avg),
              0,
            ) / 4
          ).toFixed(2)
        : "0.00";

    // ===== 2. SUBJECT-WISE TOPPERS — SINGLE MERGED TABLE =====
    const getTopStudents = (subjectKey) => {
      return [...results]
        .sort((a, b) => (b[subjectKey] || 0) - (a[subjectKey] || 0))
        .slice(0, 5)
        .map((r, idx) => ({
          rank: idx + 1,
          name: `${r.first_name || ""} ${r.last_name || ""}`.trim() || "-",
          marks: r[subjectKey] || 0,
        }));
    };

    const physicsToppers = getTopStudents("physics_marks");
    const chemistryToppers = getTopStudents("chemistry_marks");
    const mathsToppers = getTopStudents("maths_marks");
    const biologyToppers = getTopStudents("biology_marks");

    const topperRows = Array.from({ length: 5 }, (_, i) => ({
      rank: i + 1,
      physics: physicsToppers[i] || { name: "-", marks: 0 },
      chemistry: chemistryToppers[i] || { name: "-", marks: 0 },
      maths: mathsToppers[i] || { name: "-", marks: 0 },
      biology: biologyToppers[i] || { name: "-", marks: 0 },
    }));

    const gradeRanges = [
      { label: "91-100", min: 91, max: 100 },
      { label: "81-90", min: 81, max: 90 },
      { label: "71-80", min: 71, max: 80 },
      { label: "61-70", min: 61, max: 70 },
      { label: "51-60", min: 51, max: 60 },
      { label: "41-50", min: 41, max: 50 },
      { label: "0-40", min: 0, max: 40 },
    ];

    const gradeCounts = {};
    gradeRanges.forEach((range) => {
      gradeCounts[range.label] = {
        physics: 0,
        chemistry: 0,
        maths: 0,
        biology: 0,
      };
    });

    results.forEach((r) => {
      const subjects = [
        { key: "physics_marks", name: "physics", max: maxPhysics },
        { key: "chemistry_marks", name: "chemistry", max: maxChemistry },
        { key: "maths_marks", name: "maths", max: maxMaths },
        { key: "biology_marks", name: "biology", max: maxBiology },
      ];
      subjects.forEach((sub) => {
        const marks = r[sub.key] || 0;
        const percentage = sub.max > 0 ? (marks / sub.max) * 100 : 0;
        for (const range of gradeRanges) {
          if (percentage >= range.min && percentage <= range.max) {
            gradeCounts[range.label][sub.name]++;
            break;
          }
        }
      });
    });

    return (
      <div style={card}>
        <div style={{ display: "none" }}>
          <h2>
            📄 {currentOMRExam.class}-{currentOMRExam.section} |{" "}
            {currentOMRExam.exam_pattern}
          </h2>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "20px",
            paddingBottom: "16px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div>
            <button
              onClick={() => setView("exam")}
              style={{
                ...backButton,
                marginBottom: "12px",
                background: "#f8fafc",
                color: "#334155",
                border: "1px solid #cbd5e1",
                fontWeight: "600",
              }}
            >
              Back to Batch Wise Results
            </button>
            <h2
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: "24px",
                lineHeight: 1.2,
              }}
            >
              Exam Result
            </h2>
            <div
              style={{ marginTop: "6px", color: "#64748b", fontSize: "14px" }}
            >
              Class {currentOMRExam.class}-{currentOMRExam.section || "-"} |{" "}
              {currentOMRExam.exam_pattern || "-"}
              {currentOMRExam.exam_date
                ? ` | ${new Date(currentOMRExam.exam_date).toLocaleDateString()}`
                : ""}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(120px, 1fr))",
              gap: "10px",
              minWidth: "260px",
            }}
          >
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "#64748b",
                  fontWeight: "600",
                }}
              >
                Students
              </div>
              <div
                style={{
                  fontSize: "22px",
                  color: "#0f172a",
                  fontWeight: "700",
                }}
              >
                {totalStudents}
              </div>
            </div>
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "#1d4ed8",
                  fontWeight: "600",
                }}
              >
                Overall Avg
              </div>
              <div
                style={{
                  fontSize: "22px",
                  color: "#1e3a8a",
                  fontWeight: "700",
                }}
              >
                {overallAverage}%
              </div>
            </div>
          </div>
        </div>

        {/* === ANALYSIS SECTION === */}
        <div>
          {/* 1. Subject Averages (Percentages) */}
          <div
            style={{
              marginBottom: "20px",
              padding: "16px",
              background: "#f8fafc",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <h3
              style={{
                margin: "0 0 16px 0",
                color: "#1e293b",
                textAlign: "center",
              }}
            >
              📊 Subject Averages (%)
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "12px",
              }}
            >
              {Object.entries(subjectAverages).map(([subject, avg]) => (
                <div
                  key={subject}
                  style={{
                    padding: "14px",
                    background: "#fff",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#64748b",
                      fontWeight: "600",
                    }}
                  >
                    {subjectLabels[subject] || subject}
                  </div>
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: "700",
                      color: "#0f172a",
                      marginTop: "4px",
                    }}
                  >
                    {avg}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Subject-wise Toppers — SINGLE TABLE */}
          <div
            style={{
              marginBottom: "20px",
              padding: "16px",
              background: "#ffffff",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              overflow: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h3
                style={{ margin: "0", color: "#065f46", textAlign: "center" }}
              >
                🏆 Subject-wise Toppers (Top 5)
              </h3>
            </div>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
                border: "1px solid #e2e8f0",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      ...tableHeaderStyle,
                      background: "#f1f5f9",
                      width: "50px",
                    }}
                  >
                    Rank
                  </th>
                  <th
                    style={{
                      ...tableHeaderStyle,
                      background: "#f1f5f9",
                      width: "100px",
                    }}
                  >
                    Physics
                  </th>
                  <th
                    style={{
                      ...tableHeaderStyle,
                      background: "#f1f5f9",
                      width: "60px",
                    }}
                  >
                    Marks
                  </th>
                  <th
                    style={{
                      ...tableHeaderStyle,
                      background: "#f1f5f9",
                      width: "100px",
                    }}
                  >
                    Chemistry
                  </th>
                  <th
                    style={{
                      ...tableHeaderStyle,
                      background: "#f1f5f9",
                      width: "60px",
                    }}
                  >
                    Marks
                  </th>
                  <th
                    style={{
                      ...tableHeaderStyle,
                      background: "#f1f5f9",
                      width: "100px",
                    }}
                  >
                    Maths
                  </th>
                  <th
                    style={{
                      ...tableHeaderStyle,
                      background: "#f1f5f9",
                      width: "60px",
                    }}
                  >
                    Marks
                  </th>
                  <th
                    style={{
                      ...tableHeaderStyle,
                      background: "#f1f5f9",
                      width: "100px",
                    }}
                  >
                    Biology
                  </th>
                  <th
                    style={{
                      ...tableHeaderStyle,
                      background: "#f1f5f9",
                      width: "60px",
                    }}
                  >
                    Marks
                  </th>
                </tr>
              </thead>
              <tbody>
                {topperRows.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      backgroundColor: i % 2 === 0 ? "#fafafa" : "white",
                    }}
                  >
                    <td style={tableCellStyle}>{row.rank}</td>
                    <td style={tableCellStyle}>{row.physics.name}</td>
                    <td style={tableCellStyle}>{row.physics.marks}</td>
                    <td style={tableCellStyle}>{row.chemistry.name}</td>
                    <td style={tableCellStyle}>{row.chemistry.marks}</td>
                    <td style={tableCellStyle}>{row.maths.name}</td>
                    <td style={tableCellStyle}>{row.maths.marks}</td>
                    <td style={tableCellStyle}>{row.biology.name}</td>
                    <td style={tableCellStyle}>{row.biology.marks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 3. Grade-wise Distribution */}
          <div
            style={{
              padding: "16px",
              background: "#ffffff",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <h3
              style={{
                margin: "0 0 16px 0",
                color: "#b45309",
                textAlign: "center",
              }}
            >
              📈 Grade-wise Distribution (Per Subject)
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                }}
              >
                <thead>
                  <tr>
                    <th style={{ ...tableHeaderStyle, background: "#f1f5f9" }}>
                      Percentage Range
                    </th>
                    <th style={{ ...tableHeaderStyle, background: "#f1f5f9" }}>
                      Physics
                    </th>
                    <th style={{ ...tableHeaderStyle, background: "#f1f5f9" }}>
                      Chemistry
                    </th>
                    <th style={{ ...tableHeaderStyle, background: "#f1f5f9" }}>
                      Maths
                    </th>
                    <th style={{ ...tableHeaderStyle, background: "#f1f5f9" }}>
                      Biology
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gradeRanges.map((range) => (
                    <tr key={range.label} style={{ backgroundColor: "white" }}>
                      <td
                        style={{
                          ...tableCellStyle,
                          background: "#f8fafc",
                          fontWeight: "600",
                        }}
                      >
                        {range.label}
                      </td>
                      <td style={tableCellStyle}>
                        {gradeCounts[range.label].physics}
                      </td>
                      <td style={tableCellStyle}>
                        {gradeCounts[range.label].chemistry}
                      </td>
                      <td style={tableCellStyle}>
                        {gradeCounts[range.label].maths}
                      </td>
                      <td style={tableCellStyle}>
                        {gradeCounts[range.label].biology}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ===== DOWNLOAD ANALYSIS PDF BUTTON ===== */}
        <button
          onClick={() => {
            if (!results.length) return alert("No data to analyze");
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;
            const margin = 14;
            let yPos = 20;

            // ===== HEADER =====
            doc.setFillColor(30, 85, 160);
            doc.rect(0, 0, pageWidth, 20, "F");
            // --- School Logo (left) ---
            if (school?.logo_url) {
              try {
                // Adjust size and position: 20x20, centered vertically in 25pt height
                doc.addImage(school.logo_url, "PNG", 8, 2.5, 15, 15);
              } catch (e) {
                console.warn("Failed to load school logo:", e);
              }
            }
            doc.setFontSize(14);
            doc.setFont("bold");
            doc.setTextColor(255, 255, 255);
            doc.text(school.school_name || "Unknown School", 30, 10);
            doc.setFontSize(10);
            doc.setFont("bold");
            doc.text(`Area: ${school.area || "Not Set"}`, 30, 16);

            // --- Spectropy Logo (right) ---
            try {
              doc.addImage(
                spectropyLogoUrl,
                doc.internal.pageSize.width - 30,
                2,
                10,
                10,
              );
            } catch (e) {
              console.warn(
                "Failed to load Spectropy logo, falling back to text:",
                e,
              );
            }
            doc.setFont("bold");
            doc.text("Powered BY SPECTROPY", pageWidth - 15, 16, {
              align: "right",
            });
            yPos += 6;

            // ===== TITLE =====
            doc.setFontSize(18);
            doc.setTextColor(0, 0, 0);
            doc.setFont("bold");
            doc.text(`IIT Foundation Exam Analysis Report`, margin + 40, yPos);
            yPos += 9;
            doc.setFontSize(12);
            doc.text(
              `${currentOMRExam.class}-${currentOMRExam.section}`,
              margin,
              yPos,
            );
            yPos += 6;
            doc.text(`${currentOMRExam.exam_pattern}`, margin + 145, yPos - 6);
            yPos += 6;
            doc.text(
              `DATE: ${currentOMRExam.exam_date}`,
              margin + 145,
              yPos - 6,
            );
            yPos += 6;
            doc.setFontSize(6);
            doc.text(
              `Generated: ${new Date().toLocaleString()}`,
              margin + 160,
              yPos - 30,
            );
            yPos += 10;

            // ===== 1. SUBJECT AVERAGES + OVERALL TOPPERS (SIDE BY SIDE) =====
            doc.setFontSize(14);
            doc.text("Subject Averages (%)", margin, yPos);
            yPos += 6;

            // Subject Averages Table (DYNAMIC)
            const avgTableData = activeSubs.map((sub) => {
              const key = sub.toLowerCase();
              return [sub, `${filteredSubjectAverages[key] || "0.00"}%`];
            });

            doc.autoTable({
              startY: yPos,
              head: [["Subject", "Average %"]],
              body: avgTableData,
              theme: "grid",
              styles: { fontSize: 11 },
              headStyles: { fillColor: [65, 105, 225] },
              columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 30 } },
            });
            const avgTableEndY = doc.lastAutoTable.finalY;

            // Overall Toppers (Top 5) — Placed beside Subject Averages
            doc.setFontSize(14);
            doc.text("Overall Toppers (Top 5)", margin + 90, yPos - 6); // Offset X

            const overallToppers = [...results]
              .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
              .slice(0, 5)
              .map((r, i) => [
                i + 1,
                `${r.first_name || ""} ${r.last_name || ""}`.trim() || "-",
                `${r.percentage || 0}%`,
              ]);

            doc.autoTable({
              startY: yPos,
              head: [["Rank", "Name", "Percentage"]],
              body: overallToppers,
              theme: "grid",
              styles: { fontSize: 9 },
              headStyles: { fillColor: [34, 197, 94] },
              columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 40 },
                2: { cellWidth: 25 },
              },
              margin: { left: margin + 90 },
            });

            const topperTableEndY = doc.lastAutoTable.finalY;
            yPos = Math.max(avgTableEndY, topperTableEndY) + 12;

            // ===== 2. GRADE DISTRIBUTION (DYNAMIC) =====
            doc.setFontSize(14);
            doc.text("Performance Distribution", margin, yPos);
            yPos += 6;

            const gradeTableData = gradeRanges.map((range) => [
              range.label,
              ...activeSubs.map((s) => {
                const key = s.toLowerCase();
                const marks = gradeCounts[range.label][key];
                return `${marks || 0}`;
              }),
            ]);

            doc.autoTable({
              startY: yPos,
              head: [["Range(%)", ...activeSubs]],
              body: gradeTableData,
              theme: "grid",
              styles: { fontSize: 12, halign: "center" },
              headStyles: { fillColor: [65, 105, 225] },
              columnStyles: { 0: { cellWidth: 25 } },
            });
            yPos = doc.lastAutoTable.finalY + 12;

            // ===== 3. SUBJECT-WISE TOPPERS (DYNAMIC MERGED TABLE) =====
            doc.setFontSize(14);
            doc.text("Subject-wise Toppers (Top 5)", margin, yPos);
            yPos += 6;

            const topperTableData = Array.from({ length: 5 }, (_, i) => {
              const row = [i + 1];
              activeSubs.forEach((sub) => {
                const key = sub.toLowerCase();
                const topper = topperRows[i][key] || { name: "-", marks: 0 };
                row.push(topper.name, topper.marks);
              });
              return row;
            });

            const topperHeaders = ["Rank"];
            activeSubs.forEach((sub) => {
              topperHeaders.push(`${sub}\nName`, "Marks");
            });

            const totalCols = 1 + activeSubs.length * 2;
            const colWidth = (pageWidth - 28) / totalCols;
            const columnStyles = {};
            for (let i = 0; i < totalCols; i++) {
              columnStyles[i] = { cellWidth: colWidth };
            }

            doc.autoTable({
              startY: yPos,
              head: [topperHeaders],
              body: topperTableData,
              theme: "grid",
              styles: { fontSize: 9, cellPadding: 2 },
              headStyles: { fillColor: [34, 197, 94], fontSize: 9 },
              columnStyles,
            });

            // ===== SAVE =====
            doc.save(`Exam_Analysis_${currentOMRExam.id}.pdf`);
          }}
          style={{
            padding: "9px 14px",
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: "600",
            marginTop: "16px",
          }}
        >
          📥 Download Analysis PDF
        </button>

        {/* ===== STUDENT RESULTS TABLE ===== */}
        {resultsLoading ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              fontSize: "16px",
              color: "#6b7280",
            }}
          >
            🔄 Loading exam results...
          </div>
        ) : results.length > 0 ? (
          <>
            <div
              style={{
                margin: "20px 0",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  const doc = new jsPDF("landscape");
                  const pageWidth = doc.internal.pageSize.width;
                  const margin = 14;
                  let yPos = 20;

                  // === BLUE HEADER BANNER (as per Fig 2) ===
                  doc.setFillColor(30, 85, 160); // Deep Blue #1e55a0
                  doc.rect(0, 0, pageWidth, 20, "F"); // Full-width rectangle
                  const headerHeight = 20;
                  const schoolLogoSize = 15;
                  const schoolLogoX = 8;
                  const schoolLogoY = (headerHeight - schoolLogoSize) / 2;
                  const schoolTextX = school?.logo_url
                    ? schoolLogoX + schoolLogoSize + 6
                    : 14;
                  const spectropyLogoSize = 10;
                  const spectropyLogoX = pageWidth - 24;
                  const spectropyLogoY = 2;
                  if (school?.logo_url) {
                    try {
                      doc.addImage(
                        school.logo_url,
                        "PNG",
                        schoolLogoX,
                        schoolLogoY,
                        schoolLogoSize,
                        schoolLogoSize,
                      );
                    } catch (e) {
                      console.warn("Failed to load school logo:", e);
                    }
                  }
                  // School Name (Left)
                  doc.setFontSize(14);
                  doc.setTextColor(255, 255, 255); // White text
                  doc.text(
                    school.school_name || "Unknown School",
                    schoolTextX,
                    10,
                  );

                  // Area (Below school name)
                  doc.setFontSize(10);
                  doc.text(
                    `Area: ${school.area || "Not Set"}`,
                    schoolTextX,
                    16,
                  );
                  try {
                    doc.addImage(
                      spectropyLogoUrl,
                      "PNG",
                      spectropyLogoX,
                      spectropyLogoY,
                      spectropyLogoSize,
                      spectropyLogoSize,
                    );
                  } catch (e) {
                    console.warn(
                      "Failed to load Spectropy logo, falling back to text:",
                      e,
                    );
                  }

                  // Powered BY SPECTROPY (Right)
                  doc.setFontSize(10);
                  doc.text("Powered BY SPECTROPY", pageWidth - 8, 16, {
                    align: "right",
                  });
                  yPos += 6;

                  // Title
                  doc.setFontSize(18);
                  doc.setFont("bold");
                  doc.setTextColor(0, 0, 0);
                  doc.text(`IIT Foundation Exam Result`, margin + 100, yPos);
                  yPos += 9;
                  doc.setFontSize(14);
                  doc.setFont("bold");
                  doc.setTextColor(0, 0, 0);
                  doc.text(
                    `${currentOMRExam.class}-${currentOMRExam.section} `,
                    margin,
                    yPos,
                  );
                  doc.text(
                    `${currentOMRExam.exam_pattern} | DATE:${currentOMRExam.exam_date}`,
                    margin + 200,
                    yPos - 6,
                  );
                  doc.setFontSize(6);
                  doc.text(
                    `Generated: ${new Date().toLocaleString()}`,
                    margin + 230,
                    yPos - 12,
                  );

                  const headers = [
                    "Student ID",
                    "Name",
                    "Total Q",
                    "Correct",
                    "Wrong",
                    "Unattempted",
                    "Physics",
                    "Chemistry",
                    "Maths",
                    "Biology",
                    "Total Marks",
                    "%",
                    "Class Rank",
                    "School Rank",
                    "All India Rank",
                  ];
                  const sortedResults = [...results].sort(
                    (a, b) => b.percentage - a.percentage,
                  );
                  const body = sortedResults.map((r) => [
                    r.student_id || "-",
                    `${r.first_name || ""} ${r.last_name || ""}`.trim() || "-",
                    r.total_questions || 0,
                    r.correct_answers || 0,
                    r.wrong_answers || 0,
                    r.unattempted || 0,
                    r.physics_marks || 0,
                    r.chemistry_marks || 0,
                    r.maths_marks || 0,
                    r.biology_marks || 0,
                    r.total_marks || 0,
                    `${r.percentage || 0}%`,
                    r.class_rank || "-",
                    r.school_rank || "-",
                    r.all_schools_rank || "-",
                  ]);
                  doc.autoTable({
                    startY: 40,
                    head: [headers],
                    body,
                    theme: "grid",
                    styles: {
                      fontSize: 8,
                      halign: "center",
                      textColor: [0, 0, 0],
                    },
                    headStyles: {
                      fillColor: [65, 105, 255],
                      textColor: (255, 255, 255),
                    },
                    columnStyles: {
                      11: { fontStyle: "bold" }, // ✅ makes only the Percentage column bold
                    },
                  });
                  doc.save(`Exam_Results_${currentOMRExam.id}.pdf`);
                }}
                style={{
                  padding: "9px 14px",
                  background: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                }}
              >
                📥 Download Student Results PDF
              </button>
            </div>
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                overflowX: "auto",
                background: "#ffffff",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                }}
              >
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>Student ID</th>
                    <th style={tableHeaderStyle}>Name</th>
                    <th style={tableHeaderStyle}>Total Q</th>
                    <th style={tableHeaderStyle}>Correct</th>
                    <th style={tableHeaderStyle}>Wrong</th>
                    <th style={tableHeaderStyle}>Unattempted</th>
                    <th style={tableHeaderStyle}>Physics</th>
                    <th style={tableHeaderStyle}>Chemistry</th>
                    <th style={tableHeaderStyle}>Maths</th>
                    <th style={tableHeaderStyle}>Biology</th>
                    <th style={tableHeaderStyle}>Total Marks</th>
                    <th style={tableHeaderStyle}>%</th>
                    <th style={tableHeaderStyle}>Class Rank</th>
                    <th style={tableHeaderStyle}>School Rank</th>
                    <th style={tableHeaderStyle}>All India Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const sortedResults = [...results].sort(
                      (a, b) => b.percentage - a.percentage,
                    );
                    return sortedResults.map((r, i) => (
                      <tr
                        key={i}
                        style={{
                          backgroundColor: i % 2 === 0 ? "#fafafa" : "white",
                        }}
                      >
                        <td style={tableCellStyle}>{r.student_id || "-"}</td>
                        <td style={tableCellStyle}>
                          {`${r.first_name || ""} ${r.last_name || ""}`.trim() ||
                            "-"}
                        </td>
                        <td style={tableCellStyle}>{r.total_questions || 0}</td>
                        <td style={tableCellStyle}>{r.correct_answers || 0}</td>
                        <td style={tableCellStyle}>{r.wrong_answers || 0}</td>
                        <td style={tableCellStyle}>{r.unattempted || 0}</td>
                        <td style={tableCellStyle}>{r.physics_marks || 0}</td>
                        <td style={tableCellStyle}>{r.chemistry_marks || 0}</td>
                        <td style={tableCellStyle}>{r.maths_marks || 0}</td>
                        <td style={tableCellStyle}>{r.biology_marks || 0}</td>
                        <td style={tableCellStyle}>{r.total_marks || 0}</td>
                        <td style={tableCellStyle}>{r.percentage || 0}%</td>
                        <td style={tableCellStyle}>{r.class_rank || "-"}</td>
                        <td style={tableCellStyle}>{r.school_rank || "-"}</td>
                        <td style={tableCellStyle}>
                          {r.all_schools_rank || "-"}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
            📭 No results available.
          </div>
        )}
      </div>
    );
  };

  const renderStudentWiseView = () => {
    const handleViewStudent = () => {
      const id = studentIdInput.trim();
      if (!id) {
        setStudentIdInputError("Please enter a valid Student ID.");
        return;
      }
      setStudentIdInputError("");
      setSelectedStudentId(id);
      setView("student");
    };

    if (
      view === "student" &&
      selectedStudentId &&
      selectedStudentId.trim() !== ""
    ) {
      return (
        <StudentDashboard
          studentId={selectedStudentId.trim()}
          onBack={() => {
            setView("overview");
            setStudentIdInput("");
            setStudentIdInputError("");
            setSelectedStudentId("");
          }}
        />
      );
    }

    return (
      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2>🎓 Student Wise Performance</h2>
        </div>

        <div
          style={{ maxWidth: "500px", margin: "0 auto", textAlign: "center" }}
        >
          <p style={{ marginBottom: "16px", color: "#475569" }}>
            Enter a Student ID to view their detailed performance dashboard.
          </p>

          <input
            type="text"
            value={studentIdInput}
            onChange={(e) => {
              setStudentIdInput(e.target.value);
              if (studentIdInputError) setStudentIdInputError("");
            }}
            placeholder="Enter Student ID (e.g., 12345)"
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "16px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              marginBottom: "12px",
            }}
          />

          {studentIdInputError && (
            <p style={{ color: "red", marginBottom: "12px" }}>
              {studentIdInputError}
            </p>
          )}

          <button
            onClick={handleViewStudent}
            style={{
              padding: "10px 24px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500",
              width: "100%",
            }}
          >
            🔍 View Student Dashboard
          </button>
        </div>
      </div>
    );
  };

  const renderTeacherWiseView = () => {
    const handleViewTeacher = () => {
      const id = teacherIdInput.trim();
      if (!id) {
        setTeacherIdInputError("Please enter a valid Teacher ID.");
        return;
      }
      setTeacherIdInputError("");
      setSelectedTeacherId(id);
      setView("teacher");
    };

    if (
      view === "teacher" &&
      selectedTeacherId &&
      selectedTeacherId.trim() !== ""
    ) {
      return (
        <TeacherDashboard
          teacherId={selectedTeacherId.trim()}
          onBack={() => {
            setView("overview");
            setTeacherIdInput("");
            setTeacherIdInputError("");
            setSelectedTeacherId("");
          }}
        />
      );
    }

    return (
      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2>👨‍🏫 Teacher Wise Performance</h2>
        </div>

        <div
          style={{ maxWidth: "500px", margin: "0 auto", textAlign: "center" }}
        >
          <p style={{ marginBottom: "16px", color: "#475569" }}>
            Enter a Teacher ID to view their detailed performance dashboard.
          </p>

          <input
            type="text"
            value={teacherIdInput}
            onChange={(e) => {
              setTeacherIdInput(e.target.value);
              if (teacherIdInputError) setTeacherIdInputError("");
            }}
            placeholder="Enter Teacher ID (e.g., TS251101)"
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "16px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              marginBottom: "12px",
            }}
          />

          {teacherIdInputError && (
            <p style={{ color: "red", marginBottom: "12px" }}>
              {teacherIdInputError}
            </p>
          )}

          <button
            onClick={handleViewTeacher}
            style={{
              padding: "10px 24px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500",
              width: "100%",
            }}
          >
            🔍 View Teacher Dashboard
          </button>
        </div>
      </div>
    );
  };

  // ── Nav helper: set tab + matching view ──
  const goTab = (tabId) => {
    const tab = OWNER_TABS.find((t) => t.id === tabId);
    if (tab) navigate(`/school/${tab.path}`);
    setSidebarOpen(false);
    if (tabId === "overview") {
      setView("overview");
    } else if (tabId === "batchwise") {
      setView("batchwise");
    } else if (tabId === "student") {
      setView("student");
    } else if (tabId === "teacher") {
      setView("teacher");
    }
  };

  // ── Logout handler ──
  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.removeItem("sp_user");
    if (onBack) onBack();
    window.location.href = "/";
  };

  const schoolName = school?.school_name || "School";
  const schoolIdVal = school?.school_id || "";

  return (
    <div className="admin-layout school-owner-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar Rail ── */}
      <aside
        className={`sidebar-rail${sidebarOpen ? " sidebar-rail--open" : ""}`}
        aria-label="School Admin navigation"
      >
        <button
          className="sidebar-close-btn"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        >
          ✕
        </button>

        <span className="sidebar-section-label">Navigation</span>

        {OWNER_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-nav-item${activeTab === tab.id ? " sidebar-nav-item--active" : ""}`}
            onClick={() => goTab(tab.id)}
            title={tab.label}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            <span className="sidebar-nav-icon">{tab.icon}</span>
            <span className="sidebar-nav-label">{tab.label}</span>
          </button>
        ))}

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-admin-info">
            <div className="sidebar-admin-avatar">
              {schoolName.charAt(0).toUpperCase()}
              <span className="sidebar-avatar-status" title="Portal Online" />
            </div>
            <div className="sidebar-admin-details">
              <div className="sidebar-admin-name">{schoolIdVal}</div>
              <div className="sidebar-admin-role">School Admin</div>
            </div>
          </div>

          <button className="sidebar-logout-btn" onClick={handleLogout}>
            <span>⏻</span>
            <span className="sidebar-nav-label">Sign Out</span>
          </button>

          <div className="sidebar-version">
            {school?.academic_year || "v1.0"}
          </div>
        </div>
      </aside>

      {/* ── Page Canvas ── */}
      <div className="page-canvas">
        <Routes>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={renderSchoolHeader()} />
          <Route
            path="batchwise"
            element={
              view === "examwise-results"
                ? renderExamWiseResultsView()
                : renderExamWiseView()
            }
          />
          <Route path="student" element={renderStudentWiseView()} />
          <Route path="teacher" element={renderTeacherWiseView()} />
          <Route path="*" element={<Navigate to="overview" replace />} />
        </Routes>
      </div>
    </div>
  );
}

// ✅ Styles
const card = {
  border: "1px solid #d3d8e6",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  background: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
};

const infoTable = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 8,
};

const tableCell = {
  padding: "8px",
  borderBottom: "1px solid #ddd",
  color: "#333",
  textAlign: "left",
};

Object.assign(infoTable, {
  td: tableCell,
  th: { ...tableCell, fontWeight: "bold", background: "#f7f9fc" },
});

const dataTable = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 8,
};

Object.assign(dataTable, {
  th: {
    padding: "10px",
    textAlign: "left",
    background: "#f1f5f9",
    borderBottom: "2px solid #ddd",
    fontWeight: "600",
    color: "#1e293b",
  },
  td: {
    padding: "8px",
    borderBottom: "1px solid #eee",
    color: "#333",
  },
});

const backButton = {
  padding: "8px",
  background: "#6b7280",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: "12px",
};

// For Results Table
const tableHeaderStyle = {
  padding: "12px 8px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  fontWeight: "600",
  textAlign: "center",
  fontSize: "13px",
  color: "#334155",
};

const tableCellStyle = {
  padding: "10px 8px",
  border: "1px solid #e2e8f0",
  textAlign: "center",
  fontSize: "13px",
  fontWeight: "500",
  color: "#1e293b",
};
