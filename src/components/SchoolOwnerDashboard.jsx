// src/components/SchoolOwnerDashboard.jsx
import React, { useRef, useState, useEffect } from "react";
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
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  Brain,
  Calculator,
  ClipboardList,
  Download,
  FileText,
  FlaskConical,
  GraduationCap,
  Images,
  LayoutDashboard,
  Leaf,
  Lightbulb,
  Loader2,
  Search,
  School as SchoolIcon,
  Target,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import StudentDashboard from "./StudentDashboard"; // adjust path as needed
import TeacherDashboard from "./TeacherDashboard";
import TopStudentsPosterGenerator from "./PosterGenerator/TopStudentsPosterGenerator.jsx";
import ExamWiseTopStudentsPosterGenerator from "./PosterGenerator/ExamWiseTopStudentsPosterGenerator.jsx";
import certificateTemplate from "../assets/certificate.png";
import spectropyLogoUrl from "../assets/logo.png";
import physicsicon from "../assets/icons/physics.png";
import chemistryicon from "../assets/icons/chemistry.png";
import mathsicon from "../assets/icons/Maths.png";
import biologyicon from "../assets/icons/biology.png";
import { generatePDF as generateNewReportPDF } from "./downloadpdf";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const OWNER_TABS = [
  {
    id: "overview",
    path: "overview",
    icon: LayoutDashboard,
    label: "Overview",
  },
  {
    id: "batchwise",
    path: "batchwise",
    icon: ClipboardList,
    label: "Batch Wise",
  },
  { id: "teacher", path: "teacher", icon: UserRoundCog, label: "Teacher Wise" },
  {
    id: "student",
    path: "student",
    icon: GraduationCap,
    label: "Student Wise",
  },
  {
    id: "top-students-poster",
    path: "top-students-poster",
    icon: Images,
    label: "Top Posters",
  },
  {
    id: "top-students-exam-wise",
    path: "top-students-exam-wise",
    icon: Images,
    label: "Top Posters by Exam",
  },
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
  const analysisDownloadButtonRef = useRef(null);
  const studentResultsDownloadButtonRef = useRef(null);
  const [examResultView, setExamResultView] = useState("cognitive");
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);

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
            <Loader2 size={32} style={{ marginBottom: 12 }} />
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
            <span className="alert-banner-icon">
              <AlertTriangle size={16} />
            </span>
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
            <span className="alert-banner-icon">
              <AlertTriangle size={16} />
            </span>
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

          const pdfBlob = await generateNewReportPDF(
            studentData,
            school,
            examResults,
            { output: "blob" },
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

  // Overview Tab - School Info + Quick Stats + IIT Batches
  const renderSchoolHeader = () => (
    <div className="animate-fade-in school-overview-page">
      <div className="page-header school-overview-header">
        <div className="page-header-left">
          <h1 className="page-header-title page-header-title--school school-overview-title">
            <SchoolIcon size={22} strokeWidth={2.2} />
            {school.school_name || "School Overview"}
          </h1>
          <p className="page-header-subtitle school-overview-meta">
            {school.school_id} - {school.area || "Area N/A"},{" "}
            {school.district || "District N/A"}, {school.state || "State N/A"} -{" "}
            {school.academic_year || "Academic Year N/A"}
          </p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-primary school-overview-report-btn"
            onClick={handleDownloadAllGradesReport}
            disabled={examLoading}
          >
            {examLoading ? (
              <>
                <Loader2 size={16} />
                Generating...
              </>
            ) : (
              <>
                <Download size={16} />
                Download All Grade Reports
              </>
            )}
          </button>
        </div>
      </div>
      <div className="page-content school-overview-content">
        <div className="school-overview-welcome">
          Dear Correspondent, Welcome to your School RA Portal
        </div>

        <div className="school-overview-stats" aria-label="School summary">
          {[
            {
              icon: BookOpen,
              label: "Total Classes",
              value: Array.isArray(school.classes) ? school.classes.length : 0,
              color: "#2563eb",
            },
            {
              icon: UserRoundCog,
              label: "Total Teachers",
              value: Array.isArray(school.teachers)
                ? school.teachers.length
                : 0,
              color: "#7c3aed",
            },
            {
              icon: GraduationCap,
              label: "Total Students",
              value: Array.isArray(school.classes)
                ? school.classes.reduce((s, c) => s + (c.num_students || 0), 0)
                : 0,
              color: "#059669",
            },
          ].map((stat) => (
            <div className="school-overview-stat" key={stat.label}>
              <stat.icon size={24} color={stat.color} />
              <div
                className="school-overview-stat__value"
                style={{ color: stat.color }}
              >
                {stat.value}
              </div>
              <div className="school-overview-stat__label">{stat.label}</div>
            </div>
          ))}
        </div>

        <section className="school-overview-section school-overview-section--info">
          <h3 className="school-overview-section-title">School Information</h3>
          <div className="school-overview-profile-card">
            <div className="school-overview-profile-heading">
              <div className="school-overview-profile-identity">
                {school.logo_url && (
                  <img
                    src={school.logo_url}
                    alt={`${school.school_name || "School"} logo`}
                    className="school-overview-profile-name-logo"
                  />
                )}
                <div className="school-overview-profile-name">
                  <div>{school.school_name || "School Name N/A"}</div>
                  <div className="school-overview-profile-subtitle">
                    {school.area || "Area N/A"},{" "}
                    {school.district || "District N/A"},{" "}
                    {school.state || "State N/A"}
                  </div>
                </div>
              </div>
              <span className="school-overview-profile-id">
                {school.school_id || "ID N/A"}
              </span>
            </div>
            <div className="school-overview-info-grid">
              {[
                ["School ID", school.school_id],
                ["State", school.state],
                ["District", school.district],
                ["Area", school.area],
                ["Academic Year", school.academic_year],
              ].map(([k, v]) => (
                <div className="school-overview-info-item" key={k}>
                  <div className="school-overview-info-label">{k}</div>
                  <div className="school-overview-info-value">{v || "-"}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

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
        <section className="school-overview-section">
          <h3 className="school-overview-section-title">
            <UserRoundCog size={18} /> Teachers (0)
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
        </section>
      );
    }

    return (
      <section className="school-overview-section">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h3 className="school-overview-section-title" style={{ margin: 0 }}>
            <UserRoundCog size={18} /> Teachers ({teacherList.length})
          </h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table
            className="detail-inner-table overview-teachers-table"
            style={{ width: "100%", minWidth: 640 }}
          >
            <thead>
              <tr style={{ padding: "12px 0px" }}>
                <th style={{ width: "120px" }}>TEACHER ID</th>
                <th style={{ minWidth: "10px" }}>NAME</th>
                <th style={{ width: "150px" }}>CONTACT</th>
                <th style={{ minWidth: "170px" }}>EMAIL</th>
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
      </section>
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

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const pageMargin = 10;
      const printableWidth = pageWidth - pageMargin * 2;
      const totalPagesExpression = "{total_pages_count_string}";
      const generatedDate = new Date().toLocaleString();

      // =========================================================
      // DESIGN COLOURS
      // =========================================================
      const COLORS = {
        navy: [18, 43, 79],
        blue: [37, 79, 162],
        brightBlue: [59, 130, 246],

        dark: [15, 23, 42],
        slate: [51, 65, 85],
        gray: [100, 116, 139],
        softGray: [148, 163, 184],

        white: [255, 255, 255],
        background: [248, 250, 252],
        lightGray: [241, 245, 249],
        border: [226, 232, 240],

        lightBlue: [239, 246, 255],
        blueBorder: [191, 219, 254],

        green: [22, 163, 74],
        lightGreen: [240, 253, 244],
        greenBorder: [187, 247, 208],

        amber: [217, 119, 6],
        lightAmber: [255, 251, 235],
        amberBorder: [253, 230, 138],

        red: [220, 38, 38],
        lightRed: [254, 242, 242],
        redBorder: [254, 202, 202],

        purple: [126, 34, 206],
        lightPurple: [250, 245, 255],
        purpleBorder: [233, 213, 255],

        cyan: [8, 145, 178],
        lightCyan: [236, 254, 255],
      };

      // =========================================================
      // HELPER FUNCTIONS
      // =========================================================
      const setFill = (color) => {
        doc.setFillColor(color[0], color[1], color[2]);
      };

      const setDraw = (color) => {
        doc.setDrawColor(color[0], color[1], color[2]);
      };

      const setText = (color) => {
        doc.setTextColor(color[0], color[1], color[2]);
      };

      const safeText = (value, fallback = "-") => {
        if (value === null || value === undefined || value === "") {
          return fallback;
        }

        return String(value);
      };

      const formatPercentage = (value) => {
        if (
          value === "-" ||
          value === null ||
          value === undefined ||
          value === ""
        ) {
          return "—";
        }

        const numericValue = parseFloat(value);

        if (Number.isNaN(numericValue)) {
          return "—";
        }

        return `${numericValue.toFixed(2)}%`;
      };

      const drawCard = ({
        x,
        y,
        width,
        height,
        fillColor = COLORS.white,
        borderColor = COLORS.border,
        radius = 3,
      }) => {
        setFill(fillColor);
        setDraw(borderColor);
        doc.setLineWidth(0.25);
        doc.roundedRect(x, y, width, height, radius, radius, "FD");
      };

      const getSubjectColor = (subjectName) => {
        const normalizedSubject = String(subjectName || "").toLowerCase();

        if (normalizedSubject.includes("physics")) {
          return {
            primary: COLORS.blue,
            light: COLORS.lightBlue,
            border: COLORS.blueBorder,
          };
        }

        if (normalizedSubject.includes("math")) {
          return {
            primary: COLORS.purple,
            light: COLORS.lightPurple,
            border: COLORS.purpleBorder,
          };
        }

        if (normalizedSubject.includes("chem")) {
          return {
            primary: COLORS.amber,
            light: COLORS.lightAmber,
            border: COLORS.amberBorder,
          };
        }

        if (normalizedSubject.includes("bio")) {
          return {
            primary: COLORS.green,
            light: COLORS.lightGreen,
            border: COLORS.greenBorder,
          };
        }

        return {
          primary: COLORS.cyan,
          light: COLORS.lightCyan,
          border: COLORS.blueBorder,
        };
      };

      const drawFooter = () => {
        const currentPageNumber = doc.internal.getCurrentPageInfo().pageNumber;

        setDraw(COLORS.border);
        doc.setLineWidth(0.25);
        doc.line(
          pageMargin,
          pageHeight - 12,
          pageWidth - pageMargin,
          pageHeight - 12,
        );

        setText(COLORS.gray);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);

        doc.text(
          `${safeText(
            school.school_name,
            "Unknown School",
          ).toUpperCase()} • IIT Foundation Performance Report`,
          pageMargin,
          pageHeight - 7,
        );

        doc.text(`Generated: ${generatedDate}`, pageWidth / 2, pageHeight - 7, {
          align: "center",
        });

        doc.setFont("helvetica", "bold");
        doc.text(
          `Page ${currentPageNumber} of ${totalPagesExpression}`,
          pageWidth - pageMargin,
          pageHeight - 7,
          {
            align: "right",
          },
        );
      };

      const fitTextToWidth = ({
        text,
        maxWidth,
        maximumFontSize,
        minimumFontSize,
        fontStyle = "bold",
      }) => {
        let fontSize = maximumFontSize;

        doc.setFont("helvetica", fontStyle);
        doc.setFontSize(fontSize);

        while (
          doc.getTextWidth(String(text)) > maxWidth &&
          fontSize > minimumFontSize
        ) {
          fontSize -= 0.5;
          doc.setFontSize(fontSize);
        }

        return fontSize;
      };

      // =========================================================
      // PERFORMANCE ANALYSIS
      // Existing data variables and calculations retained
      // =========================================================
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

        subjects.forEach((subject) => {
          const value = exam[subject];

          if (
            value !== null &&
            value !== undefined &&
            value !== "" &&
            !Number.isNaN(parseFloat(value))
          ) {
            totals[subject] += parseFloat(value);
            counts[subject] += 1;
          }
        });
      });

      const displayAverages = {};
      let hasAnyData = false;

      subjects.forEach((subject) => {
        if (counts[subject] > 0) {
          displayAverages[subjectNames[subject]] = (
            totals[subject] / counts[subject]
          ).toFixed(2);

          hasAnyData = true;
        } else {
          displayAverages[subjectNames[subject]] = "-";
        }
      });

      let bestSubject = "Physics";

      if (hasAnyData) {
        let bestAverage = -Infinity;

        Object.entries(displayAverages).forEach(([subjectName, average]) => {
          if (average !== "-") {
            const numericAverage = parseFloat(average);

            if (numericAverage > bestAverage) {
              bestAverage = numericAverage;
              bestSubject = subjectName;
            }
          }
        });
      }

      const validSubjectAverages = Object.values(displayAverages)
        .filter(
          (average) => average !== "-" && !Number.isNaN(parseFloat(average)),
        )
        .map((average) => parseFloat(average));

      const overallAverage =
        validSubjectAverages.length > 0
          ? (
              validSubjectAverages.reduce((sum, average) => sum + average, 0) /
              validSubjectAverages.length
            ).toFixed(2)
          : "-";

      const schoolName = safeText(
        school.school_name,
        "Unknown School",
      ).toUpperCase();

      // =========================================================
      // PAGE BACKGROUND
      // =========================================================
      setFill(COLORS.background);
      doc.rect(0, 0, pageWidth, pageHeight, "F");

      // =========================================================
      // MAIN HEADER
      // =========================================================
      const headerHeight = 31;

      setFill(COLORS.navy);
      doc.rect(0, 0, pageWidth, headerHeight, "F");

      // Bottom accent line
      setFill(COLORS.brightBlue);
      doc.rect(0, headerHeight - 3, pageWidth, 3, "F");

      // =========================================================
      // SCHOOL LOGO
      // =========================================================
      const schoolLogoBoxX = pageMargin;
      const schoolLogoBoxY = 4.5;
      const schoolLogoBoxSize = 22;

      setFill(COLORS.white);
      doc.roundedRect(
        schoolLogoBoxX,
        schoolLogoBoxY,
        schoolLogoBoxSize,
        schoolLogoBoxSize,
        3,
        3,
        "F",
      );

      let schoolLogoLoaded = false;

      if (school?.logo_url) {
        try {
          doc.addImage(
            school.logo_url,
            "PNG",
            schoolLogoBoxX + 2,
            schoolLogoBoxY + 2,
            schoolLogoBoxSize - 4,
            schoolLogoBoxSize - 4,
          );

          schoolLogoLoaded = true;
        } catch (error) {
          console.warn("Failed to load school logo:", error);
        }
      }

      if (!schoolLogoLoaded) {
        setFill(COLORS.lightBlue);
        doc.circle(
          schoolLogoBoxX + schoolLogoBoxSize / 2,
          schoolLogoBoxY + schoolLogoBoxSize / 2,
          7,
          "F",
        );

        setText(COLORS.blue);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(
          schoolName.charAt(0) || "S",
          schoolLogoBoxX + schoolLogoBoxSize / 2,
          schoolLogoBoxY + 14.5,
          {
            align: "center",
          },
        );
      }

      // =========================================================
      // SCHOOL IDENTITY
      // =========================================================
      const schoolTextX = schoolLogoBoxX + schoolLogoBoxSize + 6;

      const brandBoxWidth = 67;
      const brandBoxX = pageWidth - pageMargin - brandBoxWidth;

      const schoolTextMaximumWidth = brandBoxX - schoolTextX - 7;

      fitTextToWidth({
        text: schoolName,
        maxWidth: schoolTextMaximumWidth,
        maximumFontSize: 16,
        minimumFontSize: 10,
        fontStyle: "bold",
      });

      setText(COLORS.white);
      doc.text(schoolName, schoolTextX, 12.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(219, 234, 254);

      doc.text(
        `Area: ${safeText(
          school.area,
          "Not Set",
        )}  •  IIT Foundation Academic Analytics`,
        schoolTextX,
        20,
      );

      // =========================================================
      // PROPER POWERED BY SPECTROPY BRAND LOCKUP
      // =========================================================
      const brandBoxY = 4.5;
      const brandBoxHeight = 21.5;

      setFill(COLORS.white);
      setDraw(COLORS.blueBorder);
      doc.setLineWidth(0.25);

      doc.roundedRect(
        brandBoxX,
        brandBoxY,
        brandBoxWidth,
        brandBoxHeight,
        3,
        3,
        "FD",
      );

      const spectropyLogoSize = 14;
      const spectropyLogoX = brandBoxX + 4;
      const spectropyLogoY =
        brandBoxY + (brandBoxHeight - spectropyLogoSize) / 2;

      let spectropyLogoLoaded = false;

      try {
        doc.addImage(
          spectropyLogoUrl,
          "PNG",
          spectropyLogoX,
          spectropyLogoY,
          spectropyLogoSize,
          spectropyLogoSize,
        );

        spectropyLogoLoaded = true;
      } catch (error) {
        console.warn("Failed to load Spectropy logo, using fallback:", error);
      }

      if (!spectropyLogoLoaded) {
        setFill(COLORS.blue);
        doc.circle(
          spectropyLogoX + spectropyLogoSize / 2,
          spectropyLogoY + spectropyLogoSize / 2,
          spectropyLogoSize / 2,
          "F",
        );

        setText(COLORS.white);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);

        doc.text(
          "S",
          spectropyLogoX + spectropyLogoSize / 2,
          spectropyLogoY + 9.5,
          {
            align: "center",
          },
        );
      }

      // Brand divider
      const brandDividerX = spectropyLogoX + spectropyLogoSize + 4;

      setDraw(COLORS.border);
      doc.setLineWidth(0.3);
      doc.line(
        brandDividerX,
        brandBoxY + 4,
        brandDividerX,
        brandBoxY + brandBoxHeight - 4,
      );

      const brandTextX = brandDividerX + 4;

      setText(COLORS.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.3);
      doc.text("Powered by", brandTextX, brandBoxY + 6.5);

      setText(COLORS.navy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("SPECTROPY", brandTextX, brandBoxY + 13.5);

      setText(COLORS.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.8);
      doc.text("Learning Analytics", brandTextX, brandBoxY + 18);

      // =========================================================
      // REPORT TITLE
      // =========================================================
      let y = 39;

      setText(COLORS.dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);

      doc.text("IIT Foundation School Performance Report", pageMargin, y);

      setText(COLORS.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      doc.text(
        "Consolidated academic analysis across classes, sections and active subjects",
        pageMargin,
        y + 5.5,
      );

      // Generated date badge
      const dateBadgeWidth = 65;
      const dateBadgeHeight = 14;
      const dateBadgeX = pageWidth - pageMargin - dateBadgeWidth;
      const dateBadgeY = y - 6;

      drawCard({
        x: dateBadgeX,
        y: dateBadgeY,
        width: dateBadgeWidth,
        height: dateBadgeHeight,
        fillColor: COLORS.white,
        borderColor: COLORS.border,
        radius: 3,
      });

      setText(COLORS.gray);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.8);
      doc.text("REPORT GENERATED", dateBadgeX + 4, dateBadgeY + 5);

      setText(COLORS.dark);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2);
      doc.text(generatedDate, dateBadgeX + 4, dateBadgeY + 10.5);

      y += 16;

      // =========================================================
      // SUMMARY CARDS
      // =========================================================
      const summaryCards = [
        {
          label: "Overall Average",
          value: overallAverage === "-" ? "—" : `${overallAverage}%`,
          description: "Combined subject average",
          primaryColor: COLORS.blue,
          backgroundColor: COLORS.lightBlue,
          borderColor: COLORS.blueBorder,
        },
        {
          label: "Best Performing Subject",
          value: hasAnyData ? bestSubject : "No Data",
          description: "Highest school-wide average",
          primaryColor: COLORS.green,
          backgroundColor: COLORS.lightGreen,
          borderColor: COLORS.greenBorder,
        },
        {
          label: "Total Student Strength",
          value: safeText(totalStrength, "0"),
          description: "Students across all batches",
          primaryColor: COLORS.purple,
          backgroundColor: COLORS.lightPurple,
          borderColor: COLORS.purpleBorder,
        },
        {
          label: "Active Subjects",
          value: safeText(globalActive.length, "0"),
          description: "Subjects included in report",
          primaryColor: COLORS.amber,
          backgroundColor: COLORS.lightAmber,
          borderColor: COLORS.amberBorder,
        },
      ];

      const summaryCardGap = 4;
      const summaryCardWidth =
        (printableWidth - summaryCardGap * (summaryCards.length - 1)) /
        summaryCards.length;

      summaryCards.forEach((card, index) => {
        const cardX = pageMargin + index * (summaryCardWidth + summaryCardGap);

        drawCard({
          x: cardX,
          y,
          width: summaryCardWidth,
          height: 25,
          fillColor: card.backgroundColor,
          borderColor: card.borderColor,
          radius: 3,
        });

        setFill(card.primaryColor);
        doc.roundedRect(cardX, y, 3, 25, 1.5, 1.5, "F");

        setText(COLORS.gray);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);

        doc.text(card.label.toUpperCase(), cardX + 7, y + 6.5);

        const summaryValue = String(card.value);

        const summaryValueFontSize =
          summaryValue.length > 18 ? 10 : summaryValue.length > 12 ? 12 : 16;

        setText(COLORS.dark);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(summaryValueFontSize);

        doc.text(summaryValue, cardX + 7, y + 15.5, {
          maxWidth: summaryCardWidth - 11,
        });

        setText(COLORS.gray);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);

        doc.text(card.description, cardX + 7, y + 21.5, {
          maxWidth: summaryCardWidth - 11,
        });
      });

      y += 32;

      // =========================================================
      // SUBJECT PERFORMANCE SECTION
      // =========================================================
      setText(COLORS.dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.text("Subject Performance Overview", pageMargin, y);

      setText(COLORS.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(
        "School-wide average performance for each active subject",
        pageMargin,
        y + 4.5,
      );

      y += 9;

      if (globalActive.length > 0) {
        const subjectCardGap = 4;
        const subjectCardWidth =
          (printableWidth - subjectCardGap * (globalActive.length - 1)) /
          globalActive.length;

        globalActive.forEach((subjectName, index) => {
          const cardX =
            pageMargin + index * (subjectCardWidth + subjectCardGap);

          const average = displayAverages[subjectName] || "-";

          const subjectColor = getSubjectColor(subjectName);

          drawCard({
            x: cardX,
            y,
            width: subjectCardWidth,
            height: 25,
            fillColor: COLORS.white,
            borderColor: subjectColor.border,
            radius: 3,
          });

          setFill(subjectColor.light);
          doc.roundedRect(
            cardX + 3,
            y + 3,
            subjectCardWidth - 6,
            6.5,
            2,
            2,
            "F",
          );

          setText(subjectColor.primary);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.2);

          doc.text(String(subjectName).toUpperCase(), cardX + 6, y + 7.3);

          setText(COLORS.dark);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(16);

          doc.text(formatPercentage(average), cardX + 6, y + 18);

          setText(COLORS.gray);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6);

          doc.text("SCHOOL AVERAGE", cardX + 6, y + 22.5);
        });
      } else {
        drawCard({
          x: pageMargin,
          y,
          width: printableWidth,
          height: 21,
          fillColor: COLORS.white,
          borderColor: COLORS.border,
          radius: 3,
        });

        setText(COLORS.gray);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);

        doc.text(
          "No active subject performance data is available.",
          pageWidth / 2,
          y + 12,
          {
            align: "center",
          },
        );
      }

      y += 32;

      // =========================================================
      // TABLE SECTION TITLE
      // =========================================================
      setText(COLORS.dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);

      doc.text("IIT Foundation Batch Analysis", pageMargin, y);

      setText(COLORS.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);

      doc.text(
        "Class-wise and section-wise subject performance summary",
        pageMargin,
        y + 4.5,
      );

      y += 9;

      // =========================================================
      // BUILD DYNAMIC TABLE
      // =========================================================
      const tableColumns = [
        "S.No.",
        "Class",
        "Section",
        "Foundation",
        "Program",
        "Group",
        "Students",
        ...globalActive.map((subject) => `${subject} %`),
        "Total %",
      ];

      const tableRows = school.classes.map((cls, index) => {
        const activeSubjects = getActiveSubjects(cls.group);
        const key = `${cls.class}|${cls.section}`;
        const exam = classExamData[key] || {};

        return [
          index + 1,
          cls.class || "-",
          cls.section || "-",
          cls.foundation || "-",
          cls.program || "-",
          cls.group || "-",
          cls.num_students || 0,

          ...globalActive.map((subject) => {
            if (!activeSubjects.includes(subject)) {
              return "";
            }

            const field = subjectFieldMap[subject];
            const value = exam[field];

            if (
              value !== null &&
              value !== undefined &&
              value !== "" &&
              !Number.isNaN(parseFloat(value))
            ) {
              return parseFloat(value).toFixed(2);
            }

            return "-";
          }),

          exam.totalgrade_per_avg !== null &&
          exam.totalgrade_per_avg !== undefined &&
          exam.totalgrade_per_avg !== "" &&
          !Number.isNaN(parseFloat(exam.totalgrade_per_avg))
            ? parseFloat(exam.totalgrade_per_avg).toFixed(2)
            : "-",
        ];
      });

      // Total strength row
      tableRows.push([
        "",
        "",
        "",
        "",
        "",
        "TOTAL STRENGTH",
        totalStrength,
        ...Array(globalActive.length).fill(""),
        "",
      ]);

      // =========================================================
      // FULL-WIDTH TABLE COLUMN CALCULATION
      // All widths are proportionally calculated to use the
      // complete printable page width.
      // =========================================================
      const columnWeights = [
        0.5, // S.No.
        0.8, // Class
        0.8, // Section
        1.3, // Foundation
        1.4, // Program
        1.1, // Group
        0.9, // Students
        ...globalActive.map(() => 1),
        1, // Total
      ];

      const totalColumnWeight = columnWeights.reduce(
        (sum, weight) => sum + weight,
        0,
      );

      const calculatedWidths = columnWeights.map(
        (weight) => (printableWidth * weight) / totalColumnWeight,
      );

      // Correct any floating-point width difference
      const calculatedWidthTotal = calculatedWidths.reduce(
        (sum, width) => sum + width,
        0,
      );

      calculatedWidths[calculatedWidths.length - 1] +=
        printableWidth - calculatedWidthTotal;

      const columnStyles = {};

      calculatedWidths.forEach((width, index) => {
        columnStyles[index] = {
          cellWidth: width,
          halign: index === 3 || index === 4 ? "left" : "center",
        };
      });

      const subjectStartColumnIndex = 7;
      const totalPercentageColumnIndex = tableColumns.length - 1;
      const totalStrengthRowIndex = tableRows.length - 1;

      // =========================================================
      // DRAW FULL-WIDTH TABLE
      // =========================================================
      doc.autoTable({
        startY: y,

        head: [tableColumns],
        body: tableRows,

        theme: "grid",

        tableWidth: printableWidth,

        margin: {
          left: pageMargin,
          right: pageMargin,
          top: 19,
          bottom: 16,
        },

        styles: {
          font: "helvetica",
          fontSize: 7.2,
          textColor: COLORS.dark,
          lineColor: COLORS.border,
          lineWidth: 0.2,

          cellPadding: {
            top: 2.5,
            right: 1.4,
            bottom: 2.5,
            left: 1.4,
          },

          halign: "center",
          valign: "middle",
          overflow: "linebreak",
          minCellHeight: 8,
        },

        headStyles: {
          fillColor: COLORS.navy,
          textColor: COLORS.white,
          fontStyle: "bold",
          fontSize: 6.8,
          halign: "center",
          valign: "middle",
          minCellHeight: 10,
          lineColor: [53, 83, 132],
          lineWidth: 0.25,
        },

        bodyStyles: {
          fillColor: COLORS.white,
          minCellHeight: 8,
        },

        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },

        columnStyles,

        showHead: "everyPage",
        rowPageBreak: "avoid",

        didParseCell: (data) => {
          const isTotalStrengthRow =
            data.section === "body" && data.row.index === totalStrengthRowIndex;

          // Total strength row
          if (isTotalStrengthRow) {
            data.cell.styles.fillColor = COLORS.lightBlue;
            data.cell.styles.textColor = COLORS.navy;
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.lineColor = COLORS.blueBorder;
          }

          if (isTotalStrengthRow && data.column.index === 5) {
            data.cell.styles.halign = "right";
          }

          if (isTotalStrengthRow && data.column.index === 6) {
            data.cell.styles.halign = "center";
            data.cell.styles.fontSize = 9;
          }

          // Percentage performance colouring
          const isPercentageColumn =
            data.column.index >= subjectStartColumnIndex;

          if (
            data.section === "body" &&
            !isTotalStrengthRow &&
            isPercentageColumn
          ) {
            const numericValue = parseFloat(data.cell.raw);

            if (!Number.isNaN(numericValue)) {
              data.cell.styles.fontStyle = "bold";

              if (numericValue >= 75) {
                data.cell.styles.textColor = COLORS.green;
                data.cell.styles.fillColor = COLORS.lightGreen;
                data.cell.styles.lineColor = COLORS.greenBorder;
              } else if (numericValue >= 50) {
                data.cell.styles.textColor = COLORS.amber;
                data.cell.styles.fillColor = COLORS.lightAmber;
                data.cell.styles.lineColor = COLORS.amberBorder;
              } else {
                data.cell.styles.textColor = COLORS.red;
                data.cell.styles.fillColor = COLORS.lightRed;
                data.cell.styles.lineColor = COLORS.redBorder;
              }
            }
          }

          // Total percentage emphasis
          if (
            data.section === "body" &&
            !isTotalStrengthRow &&
            data.column.index === totalPercentageColumnIndex
          ) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.lineWidth = 0.4;
          }
        },

        didDrawPage: (data) => {
          const currentPageNumber =
            doc.internal.getCurrentPageInfo().pageNumber;

          // Compact header on continuation pages
          if (currentPageNumber > 1) {
            setFill(COLORS.navy);
            doc.rect(0, 0, pageWidth, 13, "F");

            setText(COLORS.white);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);

            doc.text(
              `${schoolName} — IIT Foundation Batch Analysis`,
              pageMargin,
              8.5,
            );

            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.5);

            doc.text("Powered by SPECTROPY", pageWidth - pageMargin, 8.5, {
              align: "right",
            });
          }

          drawFooter();
        },
      });

      // =========================================================
      // TOTAL PAGE NUMBER REPLACEMENT
      // =========================================================
      if (typeof doc.putTotalPages === "function") {
        doc.putTotalPages(totalPagesExpression);
      }

      // =========================================================
      // EXPORT PDF
      // =========================================================
      doc.save(`IIT_Foundation_Analysis_${school.school_id || "school"}.pdf`);
    };

    return (
      <section className="school-overview-section school-overview-section--batches">
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
          {examLoading ? (
            <>
              <Loader2 size={15} />
              Loading...
            </>
          ) : (
            <>
              <FileText size={15} />
              Download PDF
            </>
          )}
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
              Performance Analysis
            </h3>
            <div style={{ marginBottom: "16px", textAlign: "center" }}>
              <strong>Best Subject:</strong> {analysis.bestSubject}
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
        <h2 className="school-overview-section-title iit-batches-heading">
          IIT Foundation Batches (
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
              className="detail-inner-table iit-batches-table"
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
      </section>
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
      setShowDetailedAnalysis(false);
      setExamResultView("cognitive");
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
      if (!examWiseClassSection || !analysis) {
        return;
      }

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const { class: cls, section: sec } = examWiseClassSection;

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const pageMargin = 10;
      const printableWidth = pageWidth - pageMargin * 2;
      const generatedDate = new Date().toLocaleString();
      const totalPagesExpression = "{total_pages_count_string}";

      const safeActiveSubs =
        Array.isArray(activeSubs) && activeSubs.length > 0
          ? activeSubs
          : Object.keys(analysis.subjectAverages || {});

      const safeExamWiseExams = Array.isArray(examWiseExams)
        ? examWiseExams
        : [];

      // =========================================================
      // DESIGN SYSTEM
      // =========================================================
      const COLORS = {
        navy: [18, 45, 85],
        navyLight: [40, 70, 115],
        blue: [37, 99, 235],

        dark: [15, 23, 42],
        slate: [51, 65, 85],
        gray: [100, 116, 139],
        softGray: [148, 163, 184],

        white: [255, 255, 255],
        background: [248, 250, 252],
        lightGray: [241, 245, 249],
        border: [226, 232, 240],

        lightBlue: [239, 246, 255],
        blueBorder: [191, 219, 254],

        green: [22, 163, 74],
        lightGreen: [240, 253, 244],
        greenBorder: [187, 247, 208],

        amber: [217, 119, 6],
        lightAmber: [255, 251, 235],
        amberBorder: [253, 230, 138],

        red: [220, 38, 38],
        lightRed: [254, 242, 242],
        redBorder: [254, 202, 202],

        purple: [126, 34, 206],
        lightPurple: [250, 245, 255],
        purpleBorder: [233, 213, 255],

        cyan: [8, 145, 178],
        lightCyan: [236, 254, 255],
        cyanBorder: [165, 243, 252],
      };

      // =========================================================
      // BASIC HELPERS
      // =========================================================
      const setFill = (color) => {
        doc.setFillColor(color[0], color[1], color[2]);
      };

      const setDraw = (color) => {
        doc.setDrawColor(color[0], color[1], color[2]);
      };

      const setText = (color) => {
        doc.setTextColor(color[0], color[1], color[2]);
      };

      const safeText = (value, fallback = "-") => {
        if (value === null || value === undefined || value === "") {
          return fallback;
        }

        return String(value);
      };

      const isNumericValue = (value) => {
        return (
          value !== null &&
          value !== undefined &&
          value !== "" &&
          !Number.isNaN(parseFloat(value))
        );
      };

      const formatValue = (value, fallback = "-") => {
        if (!isNumericValue(value)) {
          return fallback;
        }

        return parseFloat(value).toFixed(2);
      };

      const formatPercentage = (value) => {
        if (!isNumericValue(value)) {
          return "—";
        }

        return `${parseFloat(value).toFixed(2)}%`;
      };

      const drawCard = ({
        x,
        y,
        width,
        height,
        fillColor = COLORS.white,
        borderColor = COLORS.border,
        radius = 3,
      }) => {
        setFill(fillColor);
        setDraw(borderColor);
        doc.setLineWidth(0.25);

        doc.roundedRect(x, y, width, height, radius, radius, "FD");
      };

      const fitTextToWidth = ({
        text,
        maxWidth,
        maximumFontSize,
        minimumFontSize,
        fontStyle = "bold",
      }) => {
        let fontSize = maximumFontSize;

        doc.setFont("helvetica", fontStyle);
        doc.setFontSize(fontSize);

        while (
          doc.getTextWidth(String(text)) > maxWidth &&
          fontSize > minimumFontSize
        ) {
          fontSize -= 0.5;
          doc.setFontSize(fontSize);
        }

        return fontSize;
      };

      // =========================================================
      // SUBJECT COLOUR HELPERS
      // =========================================================
      const getSubjectColor = (subjectName) => {
        const normalized = String(subjectName || "").toLowerCase();

        if (normalized.includes("physics")) {
          return {
            primary: COLORS.blue,
            light: COLORS.lightBlue,
            border: COLORS.blueBorder,
          };
        }

        if (normalized.includes("math")) {
          return {
            primary: COLORS.purple,
            light: COLORS.lightPurple,
            border: COLORS.purpleBorder,
          };
        }

        if (normalized.includes("chem")) {
          return {
            primary: COLORS.amber,
            light: COLORS.lightAmber,
            border: COLORS.amberBorder,
          };
        }

        if (normalized.includes("bio")) {
          return {
            primary: COLORS.green,
            light: COLORS.lightGreen,
            border: COLORS.greenBorder,
          };
        }

        return {
          primary: COLORS.cyan,
          light: COLORS.lightCyan,
          border: COLORS.cyanBorder,
        };
      };

      const getPerformanceTextColor = (value) => {
        const numericValue = parseFloat(value);

        if (Number.isNaN(numericValue)) {
          return COLORS.gray;
        }

        if (numericValue >= 75) {
          return COLORS.green;
        }

        if (numericValue >= 50) {
          return COLORS.amber;
        }

        return COLORS.red;
      };

      const getPerformanceLabel = (value) => {
        const numericValue = parseFloat(value);

        if (Number.isNaN(numericValue)) {
          return "No Data";
        }

        if (numericValue >= 85) {
          return "Excellent";
        }

        if (numericValue >= 70) {
          return "Very Good";
        }

        if (numericValue >= 55) {
          return "Good";
        }

        if (numericValue >= 40) {
          return "Needs Attention";
        }

        return "Critical";
      };

      const schoolName = safeText(
        school?.school_name,
        "Unknown School",
      ).toUpperCase();

      // =========================================================
      // REPORT CALCULATIONS
      // =========================================================
      const validSubjectAverages = safeActiveSubs
        .map((subject) => analysis.subjectAverages?.[subject])
        .filter((value) => isNumericValue(value))
        .map((value) => parseFloat(value));

      const overallBatchAverage =
        validSubjectAverages.length > 0
          ? (
              validSubjectAverages.reduce((sum, value) => sum + value, 0) /
              validSubjectAverages.length
            ).toFixed(2)
          : "-";

      const bestSubject = analysis.bestSubject || "—";

      const bestSubjectAverage = isNumericValue(
        analysis.subjectAverages?.[bestSubject],
      )
        ? analysis.subjectAverages[bestSubject]
        : "-";

      const totalExams = safeExamWiseExams.length;

      // =========================================================
      // POWERED BY SPECTROPY BRAND CONTAINER
      // =========================================================
      const drawSpectropyLockup = ({
        rightX = pageWidth - pageMargin,
        centerY = 15,
        compact = false,
      } = {}) => {
        const containerWidth = compact ? 42 : 58;
        const containerHeight = compact ? 8 : 15;

        const containerX = rightX - containerWidth;
        const containerY = centerY - containerHeight / 2;

        const logoPanelWidth = compact ? 11 : 18;
        const logoSize = compact ? 6 : 11;

        // Outer white container
        setFill(COLORS.white);
        setDraw([194, 213, 238]);
        doc.setLineWidth(0.35);

        doc.roundedRect(
          containerX,
          containerY,
          containerWidth,
          containerHeight,
          compact ? 2.5 : 4,
          compact ? 2.5 : 4,
          "FD",
        );

        // Logo panel divider
        const dividerX = containerX + logoPanelWidth;

        setDraw([218, 226, 238]);
        doc.setLineWidth(0.35);

        doc.line(
          dividerX,
          containerY + (compact ? 2 : 4),
          dividerX,
          containerY + containerHeight - (compact ? 2 : 4),
        );

        // Logo
        const logoX = containerX + (logoPanelWidth - logoSize) / 2;

        const logoY = containerY + (containerHeight - logoSize) / 2;

        let spectropyLogoLoaded = false;

        try {
          doc.addImage(
            spectropyLogoUrl,
            "PNG",
            logoX,
            logoY,
            logoSize,
            logoSize,
          );

          spectropyLogoLoaded = true;
        } catch (error) {
          console.warn("Failed to load Spectropy logo, using fallback:", error);
        }

        if (!spectropyLogoLoaded) {
          setFill(COLORS.blue);

          doc.circle(
            logoX + logoSize / 2,
            logoY + logoSize / 2,
            logoSize / 2,
            "F",
          );

          setText(COLORS.white);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(compact ? 6 : 9);

          doc.text("S", logoX + logoSize / 2, logoY + logoSize * 0.68, {
            align: "center",
          });
        }

        // Text section
        const textX = dividerX + (compact ? 3 : 5);

        // Powered by
        setText([91, 121, 164]);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(compact ? 4.2 : 6);

        doc.text("Powered by", textX, containerY + (compact ? 3 : 4.6));

        // SPECTROPY
        setText(COLORS.navy);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(compact ? 5.8 : 8.4);

        doc.text("SPECTROPY", textX, containerY + (compact ? 6.1 : 9.3));

        // Learning Analytics
        setText([113, 135, 166]);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(compact ? 3 : 3.9);

        doc.text(
          "Learning Analytics",
          textX,
          containerY + (compact ? 7.4 : 12.2),
        );
      };

      // =========================================================
      // MAIN HEADER
      // =========================================================
      const drawMainHeader = () => {
        setFill(COLORS.background);
        doc.rect(0, 0, pageWidth, pageHeight, "F");

        const headerHeight = 30;

        setFill(COLORS.navy);
        doc.rect(0, 0, pageWidth, headerHeight, "F");

        setFill(COLORS.blue);
        doc.rect(0, headerHeight - 2.5, pageWidth, 2.5, "F");

        // School logo
        const schoolLogoBoxX = pageMargin;
        const schoolLogoBoxY = 4;
        const schoolLogoBoxSize = 22;

        setFill(COLORS.white);

        doc.roundedRect(
          schoolLogoBoxX,
          schoolLogoBoxY,
          schoolLogoBoxSize,
          schoolLogoBoxSize,
          3,
          3,
          "F",
        );

        let schoolLogoLoaded = false;

        if (school?.logo_url) {
          try {
            doc.addImage(
              school.logo_url,
              "PNG",
              schoolLogoBoxX + 2,
              schoolLogoBoxY + 2,
              schoolLogoBoxSize - 4,
              schoolLogoBoxSize - 4,
            );

            schoolLogoLoaded = true;
          } catch (error) {
            console.warn("Failed to load school logo:", error);
          }
        }

        if (!schoolLogoLoaded) {
          setFill(COLORS.lightBlue);

          doc.circle(
            schoolLogoBoxX + schoolLogoBoxSize / 2,
            schoolLogoBoxY + schoolLogoBoxSize / 2,
            7,
            "F",
          );

          setText(COLORS.blue);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);

          doc.text(
            schoolName.charAt(0) || "S",
            schoolLogoBoxX + schoolLogoBoxSize / 2,
            schoolLogoBoxY + 14.5,
            {
              align: "center",
            },
          );
        }

        // Spectropy brand container
        const mainBrandWidth = 58;

        drawSpectropyLockup({
          rightX: pageWidth - pageMargin,
          centerY: 15,
          compact: false,
        });

        // School identity
        const schoolTextX = schoolLogoBoxX + schoolLogoBoxSize + 6;

        const brandContainerX = pageWidth - pageMargin - mainBrandWidth;

        const schoolTextMaximumWidth = brandContainerX - schoolTextX - 8;

        const schoolNameFontSize = fitTextToWidth({
          text: schoolName,
          maxWidth: schoolTextMaximumWidth,
          maximumFontSize: 16,
          minimumFontSize: 9,
          fontStyle: "bold",
        });

        setText(COLORS.white);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(schoolNameFontSize);

        doc.text(schoolName, schoolTextX, 12);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(219, 234, 254);

        doc.text(
          `Area: ${safeText(
            school?.area,
            "Not Set",
          )}  •  IIT Foundation Academic Analytics`,
          schoolTextX,
          20,
          {
            maxWidth: schoolTextMaximumWidth,
          },
        );
      };

      // =========================================================
      // CONTINUATION PAGE HEADER
      // =========================================================
      const drawContinuationHeader = () => {
        setFill(COLORS.background);
        doc.rect(0, 0, pageWidth, pageHeight, "F");

        setFill(COLORS.navy);
        doc.rect(0, 0, pageWidth, 17, "F");

        setFill(COLORS.blue);
        doc.rect(0, 15, pageWidth, 2, "F");

        setText(COLORS.white);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text(`${schoolName} - Batch ${cls}-${sec}`, pageMargin, 10);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.text("Powered BY SPECTROPY", pageWidth - pageMargin, 8, {
          align: "right",
        });
      };

      // =========================================================
      // FOOTER
      // =========================================================
      const drawFooter = () => {
        const currentPageNumber = doc.internal.getCurrentPageInfo().pageNumber;

        setDraw(COLORS.border);
        doc.setLineWidth(0.25);

        doc.line(
          pageMargin,
          pageHeight - 12,
          pageWidth - pageMargin,
          pageHeight - 12,
        );

        setText(COLORS.gray);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.2);

        doc.text("CONFIDENTIAL ACADEMIC REPORT", pageMargin, pageHeight - 7);

        doc.setFont("helvetica", "normal");

        doc.text(
          `IIT Foundation • Batch ${cls}-${sec}`,
          pageWidth / 2,
          pageHeight - 7,
          {
            align: "center",
          },
        );

        doc.setFont("helvetica", "bold");

        doc.text(
          `Page ${currentPageNumber} of ${totalPagesExpression}`,
          pageWidth - pageMargin,
          pageHeight - 7,
          {
            align: "right",
          },
        );
      };

      // =========================================================
      // FIRST PAGE
      // =========================================================
      drawMainHeader();

      let y = 38;

      // Report title
      setText(COLORS.blue);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);

      doc.text("IIT FOUNDATION", pageMargin, y);

      y += 6;

      setText(COLORS.dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);

      doc.text("Batch-Wise Performance Report", pageMargin, y);

      setText(COLORS.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);

      doc.text(
        "Consolidated exam performance and subject-level academic analysis",
        pageMargin,
        y + 5.5,
      );

      // Batch badge
      const batchBadgeWidth = 34;
      const batchBadgeHeight = 14;
      const batchBadgeX = pageWidth - pageMargin - batchBadgeWidth;

      drawCard({
        x: batchBadgeX,
        y: y - 7,
        width: batchBadgeWidth,
        height: batchBadgeHeight,
        fillColor: COLORS.lightBlue,
        borderColor: COLORS.blueBorder,
        radius: 3,
      });

      setText(COLORS.gray);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.8);

      doc.text("BATCH", batchBadgeX + 4, y - 2);

      setText(COLORS.navy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);

      doc.text(`${cls}-${sec}`, batchBadgeX + 4, y + 4.3);

      setText(COLORS.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.3);

      doc.text(`Generated: ${generatedDate}`, pageWidth - pageMargin, y + 11, {
        align: "right",
      });

      y += 17;

      // =========================================================
      // SUMMARY CARDS
      // =========================================================
      const summaryCards = [
        {
          label: "Batch",
          value: `${cls}-${sec}`,
          description: "Class and section analysed",
          primaryColor: COLORS.blue,
          backgroundColor: COLORS.lightBlue,
          borderColor: COLORS.blueBorder,
        },
        {
          label: "Batch Average",
          value: overallBatchAverage === "-" ? "—" : `${overallBatchAverage}%`,
          description: "Combined active-subject average",
          primaryColor: COLORS.purple,
          backgroundColor: COLORS.lightPurple,
          borderColor: COLORS.purpleBorder,
        },
        {
          label: "Best Subject",
          value: bestSubject,
          description:
            bestSubjectAverage === "-"
              ? "No average available"
              : `${formatPercentage(bestSubjectAverage)} subject average`,
          primaryColor: COLORS.green,
          backgroundColor: COLORS.lightGreen,
          borderColor: COLORS.greenBorder,
        },
        {
          label: "Exams Analysed",
          value: safeText(totalExams, "0"),
          description: "Exam records in this report",
          primaryColor: COLORS.amber,
          backgroundColor: COLORS.lightAmber,
          borderColor: COLORS.amberBorder,
        },
      ];

      const summaryGap = 4;

      const summaryCardWidth =
        (printableWidth - summaryGap * (summaryCards.length - 1)) /
        summaryCards.length;

      summaryCards.forEach((card, index) => {
        const cardX = pageMargin + index * (summaryCardWidth + summaryGap);

        drawCard({
          x: cardX,
          y,
          width: summaryCardWidth,
          height: 25,
          fillColor: card.backgroundColor,
          borderColor: card.borderColor,
          radius: 3,
        });

        setFill(card.primaryColor);

        doc.roundedRect(cardX, y, 3, 25, 1.5, 1.5, "F");

        setText(COLORS.gray);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.3);

        doc.text(card.label.toUpperCase(), cardX + 7, y + 6.5);

        const cardValue = String(card.value);

        const cardValueFontSize =
          cardValue.length > 18 ? 9.5 : cardValue.length > 12 ? 11 : 16;

        setText(COLORS.dark);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(cardValueFontSize);

        doc.text(cardValue, cardX + 7, y + 15.5, {
          maxWidth: summaryCardWidth - 11,
        });

        setText(COLORS.gray);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);

        doc.text(card.description, cardX + 7, y + 21.5, {
          maxWidth: summaryCardWidth - 11,
        });
      });

      y += 32;

      // =========================================================
      // SUBJECT PERFORMANCE CARDS
      // =========================================================
      setText(COLORS.dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);

      doc.text("Subject Performance Overview", pageMargin, y);

      setText(COLORS.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);

      doc.text(
        "Average performance and strongest exam pattern by active subject",
        pageMargin,
        y + 4.5,
      );

      y += 9;

      if (safeActiveSubs.length > 0) {
        const subjectGap = 4;

        const subjectCardWidth =
          (printableWidth - subjectGap * (safeActiveSubs.length - 1)) /
          safeActiveSubs.length;

        safeActiveSubs.forEach((subject, index) => {
          const cardX = pageMargin + index * (subjectCardWidth + subjectGap);

          const average = analysis.subjectAverages?.[subject] ?? "—";

          const topExam = analysis.subjectTopExams?.[subject] || "—";

          const subjectColor = getSubjectColor(subject);

          drawCard({
            x: cardX,
            y,
            width: subjectCardWidth,
            height: 29,
            fillColor: COLORS.white,
            borderColor: subjectColor.border,
            radius: 3,
          });

          setFill(subjectColor.light);

          doc.roundedRect(
            cardX + 3,
            y + 3,
            subjectCardWidth - 6,
            6.5,
            2,
            2,
            "F",
          );

          setText(subjectColor.primary);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.2);

          doc.text(String(subject).toUpperCase(), cardX + 6, y + 7.3);

          setText(COLORS.dark);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(15);

          doc.text(formatPercentage(average), cardX + 6, y + 17);

          setText(getPerformanceTextColor(average));
          doc.setFont("helvetica", "bold");
          doc.setFontSize(5.8);

          doc.text(
            getPerformanceLabel(average).toUpperCase(),
            cardX + 6,
            y + 21.5,
          );

          setText(COLORS.gray);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.8);

          doc.text(`Top exam: ${topExam}`, cardX + 6, y + 26, {
            maxWidth: subjectCardWidth - 12,
          });
        });

        y += 36;
      } else {
        drawCard({
          x: pageMargin,
          y,
          width: printableWidth,
          height: 23,
          fillColor: COLORS.white,
          borderColor: COLORS.border,
          radius: 3,
        });

        setText(COLORS.gray);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);

        doc.text(
          "No active subject performance data is available.",
          pageWidth / 2,
          y + 13,
          {
            align: "center",
          },
        );

        y += 30;
      }

      // =========================================================
      // SUBJECT-WISE TOP EXAM TABLE
      // =========================================================
      setText(COLORS.dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);

      doc.text("Subject-Wise Top Exam", pageMargin, y);

      setText(COLORS.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);

      doc.text(
        "Best-performing exam pattern and corresponding subject average",
        pageMargin,
        y + 4.5,
      );

      y += 9;

      if (safeActiveSubs.length > 0) {
        const topExamColumns = ["Metric", ...safeActiveSubs];

        const topExamRows = [
          [
            "Top Exam",
            ...safeActiveSubs.map(
              (subject) => analysis.subjectTopExams?.[subject] || "—",
            ),
          ],
          [
            "Average (%)",
            ...safeActiveSubs.map((subject) =>
              isNumericValue(analysis.subjectAverages?.[subject])
                ? formatValue(analysis.subjectAverages[subject])
                : "—",
            ),
          ],
        ];

        const topTableWeights = [1.05, ...safeActiveSubs.map(() => 1)];

        const topWeightTotal = topTableWeights.reduce(
          (sum, weight) => sum + weight,
          0,
        );

        const topColumnStyles = {};

        topTableWeights.forEach((weight, index) => {
          topColumnStyles[index] = {
            cellWidth: (printableWidth * weight) / topWeightTotal,
            halign: index === 0 ? "left" : "center",
          };
        });

        doc.autoTable({
          startY: y,

          head: [topExamColumns],
          body: topExamRows,

          theme: "grid",
          tableWidth: printableWidth,

          margin: {
            left: pageMargin,
            right: pageMargin,
            bottom: 16,
          },

          styles: {
            font: "helvetica",
            fontSize: 7.5,
            cellPadding: {
              top: 2.8,
              right: 2,
              bottom: 2.8,
              left: 2,
            },
            halign: "center",
            valign: "middle",
            textColor: COLORS.dark,
            lineColor: COLORS.border,
            lineWidth: 0.2,
            minCellHeight: 9,
          },

          headStyles: {
            fillColor: COLORS.navy,
            textColor: COLORS.white,
            fontStyle: "bold",
            halign: "center",
            lineColor: COLORS.navyLight,
            lineWidth: 0.25,
          },

          bodyStyles: {
            fillColor: COLORS.white,
          },

          alternateRowStyles: {
            fillColor: COLORS.background,
          },

          columnStyles: topColumnStyles,

          didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 0) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.textColor = COLORS.navy;
              data.cell.styles.fillColor = COLORS.lightBlue;
            }

            if (
              data.section === "body" &&
              data.row.index === 1 &&
              data.column.index > 0
            ) {
              const numericValue = parseFloat(data.cell.raw);

              if (!Number.isNaN(numericValue)) {
                data.cell.styles.fontStyle = "bold";
                data.cell.styles.textColor =
                  getPerformanceTextColor(numericValue);
              }
            }
          },
        });
      }

      drawFooter();

      // =========================================================
      // SECOND PAGE
      // =========================================================
      doc.addPage();
      drawContinuationHeader();

      y = 25;

      setText(COLORS.blue);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);

      doc.text("DETAILED ANALYSIS", pageMargin, y);

      y += 6;

      setText(COLORS.dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);

      doc.text("Exam Results Table", pageMargin, y);

      setText(COLORS.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);

      doc.text(
        `Exam-wise subject averages, overall performance and comparative ranks for batch ${cls}-${sec}`,
        pageMargin,
        y + 5,
      );

      // Exam count card
      const examCountBoxWidth = 38;
      const examCountBoxX = pageWidth - pageMargin - examCountBoxWidth;

      drawCard({
        x: examCountBoxX,
        y: y - 7,
        width: examCountBoxWidth,
        height: 14,
        fillColor: COLORS.lightBlue,
        borderColor: COLORS.blueBorder,
        radius: 3,
      });

      setText(COLORS.gray);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);

      doc.text("EXAMS ANALYSED", examCountBoxX + 4, y - 2);

      setText(COLORS.navy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);

      doc.text(safeText(totalExams, "0"), examCountBoxX + 4, y + 4.2);

      y += 13;

      // =========================================================
      // PERFORMANCE LEGEND
      // =========================================================
      setText(COLORS.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.3);

      doc.text("Performance indicator:", pageMargin, y);

      const legendItems = [
        {
          color: COLORS.green,
          label: "75% and above",
        },
        {
          color: COLORS.amber,
          label: "50% – 74.99%",
        },
        {
          color: COLORS.red,
          label: "Below 50%",
        },
      ];

      let legendX = pageMargin + 31;

      legendItems.forEach((item) => {
        setFill(item.color);
        doc.circle(legendX, y - 1, 1.1, "F");

        setText(COLORS.gray);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.3);

        doc.text(item.label, legendX + 3, y);

        legendX += doc.getTextWidth(item.label) + 13;
      });

      y += 5;

      // =========================================================
      // EXAM TABLE DATA
      // =========================================================
      const tableColumns = [
        "S.No.",
        "Program",
        "Exam Date",
        "Exam Pattern",
        ...safeActiveSubs.map((subject) => subject),
        "Overall",
        "School Rank",
        "All India Rank",
      ];

      const subjectKeyMap = {
        Physics: "phy_exam_per_average",
        Chemistry: "chem_exam_per_average",
        Maths: "math_exam_per_average",
        Biology: "bioexam_per_average",
      };

      const tableRows = safeExamWiseExams.map((exam, index) => [
        index + 1,

        exam.program || "-",

        exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : "-",

        exam.exam_pattern || "-",

        ...safeActiveSubs.map((subject) => {
          const subjectField = subjectKeyMap[subject];

          if (!subjectField) {
            return "-";
          }

          return formatValue(exam[subjectField]);
        }),

        formatValue(exam.total_exam_per_avg),

        exam.school_grade_rank ?? "-",

        exam.all_schools_grade_rank ?? "-",
      ]);

      // =========================================================
      // FULL-WIDTH TABLE COLUMN CALCULATION
      // =========================================================
      const columnWeights = [
        0.42,
        1.15,
        0.9,
        1.35,
        ...safeActiveSubs.map(() => 0.82),
        0.82,
        0.85,
        0.9,
      ];

      const totalColumnWeight = columnWeights.reduce(
        (sum, weight) => sum + weight,
        0,
      );

      const calculatedWidths = columnWeights.map(
        (weight) => (printableWidth * weight) / totalColumnWeight,
      );

      const widthDifference =
        printableWidth -
        calculatedWidths.reduce((sum, width) => sum + width, 0);

      calculatedWidths[calculatedWidths.length - 1] += widthDifference;

      const columnStyles = {};

      calculatedWidths.forEach((width, index) => {
        columnStyles[index] = {
          cellWidth: width,
          halign: index === 1 || index === 3 ? "left" : "center",
        };
      });

      const subjectStartColumnIndex = 4;

      const overallColumnIndex =
        subjectStartColumnIndex + safeActiveSubs.length;

      const schoolRankColumnIndex = overallColumnIndex + 1;

      const allIndiaRankColumnIndex = overallColumnIndex + 2;

      const tableFontSize =
        tableColumns.length >= 12 ? 6 : tableColumns.length >= 10 ? 6.5 : 7;

      // =========================================================
      // FULL-WIDTH EXAM RESULTS TABLE
      // =========================================================
      doc.autoTable({
        startY: y,

        head: [tableColumns],

        body:
          tableRows.length > 0
            ? tableRows
            : [
                [
                  "",
                  "No exam records available",
                  "",
                  "",
                  ...safeActiveSubs.map(() => ""),
                  "",
                  "",
                  "",
                ],
              ],

        theme: "grid",
        tableWidth: printableWidth,

        margin: {
          left: pageMargin,
          right: pageMargin,
          top: 23,
          bottom: 16,
        },

        styles: {
          font: "helvetica",
          fontSize: tableFontSize,
          textColor: COLORS.dark,
          lineColor: COLORS.border,
          lineWidth: 0.2,

          cellPadding: {
            top: 2.5,
            right: 1.4,
            bottom: 2.5,
            left: 1.4,
          },

          halign: "center",
          valign: "middle",
          overflow: "linebreak",
          minCellHeight: 8,
        },

        headStyles: {
          fillColor: COLORS.navy,
          textColor: COLORS.white,
          fontStyle: "bold",
          fontSize: tableFontSize,
          halign: "center",
          valign: "middle",
          minCellHeight: 10,
          lineColor: COLORS.navyLight,
          lineWidth: 0.25,
        },

        bodyStyles: {
          fillColor: COLORS.white,
        },

        alternateRowStyles: {
          fillColor: COLORS.background,
        },

        columnStyles,

        showHead: "everyPage",
        rowPageBreak: "avoid",

        willDrawPage: () => {
          const currentPageNumber =
            doc.internal.getCurrentPageInfo().pageNumber;

          if (currentPageNumber > 2) {
            drawContinuationHeader();
          }
        },

        didParseCell: (data) => {
          if (data.section !== "body") {
            return;
          }

          const isPerformanceColumn =
            data.column.index >= subjectStartColumnIndex &&
            data.column.index <= overallColumnIndex;

          if (isPerformanceColumn) {
            const numericValue = parseFloat(data.cell.raw);

            if (!Number.isNaN(numericValue)) {
              data.cell.styles.fontStyle = "bold";

              if (numericValue >= 75) {
                data.cell.styles.textColor = COLORS.green;
              } else if (numericValue >= 50) {
                data.cell.styles.textColor = COLORS.amber;
              } else {
                data.cell.styles.textColor = COLORS.red;
              }
            }
          }

          if (data.column.index === overallColumnIndex) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = COLORS.lightBlue;
            data.cell.styles.lineColor = COLORS.blueBorder;
            data.cell.styles.lineWidth = 0.3;
          }

          if (
            data.column.index === schoolRankColumnIndex ||
            data.column.index === allIndiaRankColumnIndex
          ) {
            const rankValue = parseFloat(data.cell.raw);

            if (!Number.isNaN(rankValue) && rankValue > 0 && rankValue <= 3) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.textColor = COLORS.purple;
              data.cell.styles.fillColor = COLORS.lightPurple;
            }
          }
        },

        didDrawPage: () => {
          drawFooter();
        },
      });

      // =========================================================
      // TOTAL PAGE NUMBERS
      // =========================================================
      if (typeof doc.putTotalPages === "function") {
        doc.putTotalPages(totalPagesExpression);
      }

      // =========================================================
      // DOWNLOAD
      // =========================================================
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
      <div className="batchwise-page">
        <div className="batchwise-toolbar">
          <h2 className="batchwise-title">
            <ClipboardList size={22} /> Batch Wise Results
          </h2>
          <div className="batchwise-actions">
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
              className="batchwise-action-btn batchwise-action-btn--success"
            >
              <Award size={14} />
              Generate Certificates
            </button>
            <button
              onClick={handleDownloadAnalysisPDF}
              className="batchwise-action-btn batchwise-action-btn--primary"
            >
              <BarChart3 size={14} />
              Download Analysis PDF
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
              <ClipboardList size={42} style={{ marginBottom: "12px" }} />
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
                    Performance Analysis
                  </h3>
                  <div style={{ marginBottom: "16px", textAlign: "center" }}>
                    <strong>Best Subject:</strong> {analysis.bestSubject || "—"}
                  </div>
                  <h4
                    style={{
                      marginBottom: "12px",
                      color: "#1e293b",
                    }}
                  >
                    Subject Averages (%)
                  </h4>

                  {/* Styled Subject Averages as Cards */}
                  <div
                    className="batchwise-subject-averages"
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
                          className="batchwise-subject-average-card"
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
                  <div
                    className="batchwise-analysis-table-wrap"
                    style={{ overflowX: "auto", marginTop: "20px" }}
                  >
                    <strong>Subject-wise Top Exam:</strong>
                    <table
                      className="batchwise-analysis-table batchwise-top-exam-table"
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
                    <div
                      className="batchwise-analysis-table-wrap"
                      style={{ marginTop: "24px", overflowX: "auto" }}
                    >
                      <h4 style={{ marginBottom: "12px", color: "#1e293b" }}>
                        Top 5 Students (Cumulative Performance)
                      </h4>
                      <table
                        className="batchwise-analysis-table batchwise-top-students-table"
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
              <div
                className="batchwise-exams-section"
                style={{ overflowX: "auto", marginTop: "20px" }}
              >
                {examWiseLoading ? (
                  <p
                    style={{
                      color: "#64748b",
                      fontStyle: "italic",
                      padding: "16px 0",
                    }}
                  >
                    Loading exams and performance data...
                  </p>
                ) : examWiseExams.length > 0 ? (
                  <>
                    <table
                      className="detail-inner-table batchwise-exams-table"
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
                                  ? new Date(
                                      exam.exam_date,
                                    ).toLocaleDateString()
                                  : "-"}
                              </td>
                              <td>
                                <b>{exam.exam_pattern || "-"}</b>
                              </td>
                              <td>
                                {exam.phy_exam_per_average
                                  ? parseFloat(
                                      exam.phy_exam_per_average,
                                    ).toFixed(2) + "%"
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
                                  ? parseFloat(
                                      exam.bioexam_per_average,
                                    ).toFixed(2) + "%"
                                  : "-"}
                              </td>
                              <td>
                                <b>
                                  {exam.total_exam_per_avg
                                    ? parseFloat(
                                        exam.total_exam_per_avg,
                                      ).toFixed(2) + "%"
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
                                    padding: "4px 8px",
                                    fontSize: "10px",
                                  }}
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    <div className="batchwise-exam-cards">
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
                          <article className="batchwise-exam-card" key={i}>
                            <div className="batchwise-exam-card__header">
                              <div>
                                <div className="batchwise-exam-card__title">
                                  {exam.exam_pattern || "-"}
                                </div>
                                <div className="batchwise-exam-card__meta">
                                  {exam.program || "-"} ·{" "}
                                  {exam.exam_date
                                    ? new Date(
                                        exam.exam_date,
                                      ).toLocaleDateString()
                                    : "-"}
                                </div>
                              </div>
                              <button
                                className="btn btn-primary batchwise-exam-card__btn"
                                onClick={() => handleViewExamResult(exam)}
                              >
                                View
                              </button>
                            </div>
                            <div className="batchwise-exam-card__scores">
                              <span>
                                Phy{" "}
                                <b>
                                  {exam.phy_exam_per_average
                                    ? parseFloat(
                                        exam.phy_exam_per_average,
                                      ).toFixed(2) + "%"
                                    : "-"}
                                </b>
                              </span>
                              <span>
                                Chem{" "}
                                <b>
                                  {exam.chem_exam_per_average
                                    ? parseFloat(
                                        exam.chem_exam_per_average,
                                      ).toFixed(2) + "%"
                                    : "-"}
                                </b>
                              </span>
                              <span>
                                Math{" "}
                                <b>
                                  {exam.math_exam_per_average
                                    ? parseFloat(
                                        exam.math_exam_per_average,
                                      ).toFixed(2) + "%"
                                    : "-"}
                                </b>
                              </span>
                              <span>
                                Bio{" "}
                                <b>
                                  {exam.bioexam_per_average
                                    ? parseFloat(
                                        exam.bioexam_per_average,
                                      ).toFixed(2) + "%"
                                    : "-"}
                                </b>
                              </span>
                              <span className="batchwise-exam-card__total">
                                Total{" "}
                                <b>
                                  {exam.total_exam_per_avg
                                    ? parseFloat(
                                        exam.total_exam_per_avg,
                                      ).toFixed(2) + "%"
                                    : "-"}
                                </b>
                              </span>
                            </div>
                            <div className="batchwise-exam-card__ranks">
                              <span>
                                School Rank{" "}
                                <b>{exam.school_grade_rank ?? "-"}</b>
                              </span>
                              <span>
                                AIR Rank{" "}
                                <b>{exam.all_schools_grade_rank ?? "-"}</b>
                              </span>
                            </div>
                          </article>
                        ))}
                    </div>
                  </>
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
                    <FileText size={28} style={{ marginBottom: "8px" }} />
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

    const parseQuestionResults = (value) => {
      if (!value) return {};
      if (typeof value === "string") {
        try {
          return JSON.parse(value) || {};
        } catch {
          return {};
        }
      }
      return typeof value === "object" ? value : {};
    };

    const getQuestionNumber = (question) =>
      Number(String(question || "").match(/\d+/)?.[0] || 0);

    const bloomSkills = [
      "Remember",
      "Understand",
      "Apply",
      "Analyse",
      "Evaluate",
      "Create",
    ];

    const normalizeBloomSkill = (value) => {
      const normalized = String(value || "")
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (["remember", "remembering"].includes(normalized)) return "Remember";
      if (["understand", "understanding"].includes(normalized)) return "Understand";
      if (["apply", "applying"].includes(normalized)) return "Apply";
      if (["analyse", "analysis", "analyze", "analysing", "analyzing"].includes(normalized)) {
        return "Analyse";
      }
      if (["evaluate", "evaluating"].includes(normalized)) return "Evaluate";
      if (["create", "creating"].includes(normalized)) return "Create";
      return "";
    };

    const getQuestionResponseStatus = (details = {}) => {
      const status = String(details?.status || "").toLowerCase();
      const option = details?.option ?? details?.options ?? "";
      const marks = Number(details?.marks);

      if (status.includes("incorrect")) return "incorrect";
      if (status.includes("correct")) return "correct";
      if (status.includes("not") || status.includes("unattempted") || !option) {
        return "unattempted";
      }
      if (Number.isFinite(marks) && marks > 0) return "correct";
      if (option) return "incorrect";
      return "unattempted";
    };

    const normalizeStoredDifficultyLevel = (value) => {
      const normalized = String(value || "")
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (normalized === "very easy") return "Very Easy";
      if (normalized === "easy") return "Easy";
      if (normalized === "medium") return "Medium";
      if (normalized === "hard" || normalized === "difficult") return "Hard";
      if (normalized === "very hard") return "Very Hard";
      return "";
    };

    const getQuestionSubject = (question, details = {}, totalQuestionCount = 0) => {
      const storedSubject = details?.subject || details?.Subject;
      if (storedSubject) return String(storedSubject);

      const questionNumber = getQuestionNumber(question);
      if (!questionNumber || !activeSubs.length) return "General";

      const questionsPerSubject = Math.max(
        1,
        Math.ceil((totalQuestionCount || questionNumber) / activeSubs.length),
      );
      const subjectIndex = Math.min(
        activeSubs.length - 1,
        Math.floor((questionNumber - 1) / questionsPerSubject),
      );

      return activeSubs[subjectIndex] || "General";
    };

    const questionMap = {};
    results.forEach((studentResult) => {
      const questions = parseQuestionResults(studentResult.question_results);
      Object.entries(questions).forEach(([question, details]) => {
        const questionKey = String(question || "").trim();
        if (!questionKey) return;

        if (!questionMap[questionKey]) {
          questionMap[questionKey] = {
            question: questionKey,
            subject: details?.subject || details?.Subject || "",
            correct: 0,
            incorrect: 0,
            unattempted: 0,
            total_students: 0,
            total_marks: 0,
            blooms_skill: "",
            stored_difficulty_level: "",
          };
        }

        const row = questionMap[questionKey];
        row.subject = row.subject || details?.subject || details?.Subject || "";
        row.blooms_skill =
          row.blooms_skill ||
          normalizeBloomSkill(
            details?.blooms_skill ||
              details?.bloomsSkill ||
              details?.["Blooms Skill"] ||
              details?.["Bloom's Skill"],
          );
        row.stored_difficulty_level =
          row.stored_difficulty_level ||
          normalizeStoredDifficultyLevel(
            details?.difficulty_level ||
              details?.difficultyLevel ||
              details?.difficulty ||
              details?.["Difficulty Level"],
          );
        const marks = Number(details?.marks);
        const responseStatus = getQuestionResponseStatus(details);

        row.total_students += 1;
        row.total_marks += Number.isFinite(marks) ? marks : 0;

        if (responseStatus === "incorrect") {
          row.incorrect += 1;
        } else if (responseStatus === "correct") {
          row.correct += 1;
        } else {
          row.unattempted += 1;
        }
      });
    });

    const totalQuestionCountForMapping = Math.max(
      ...Object.keys(questionMap).map(getQuestionNumber),
      Object.keys(questionMap).length,
      0,
    );

    const questionAnalytics = Object.values(questionMap)
      .map((question) => {
        const total = question.total_students || totalStudents || 1;
        const correctPercentage = (question.correct / total) * 100;
        const difficultyScore =
          ((question.incorrect + question.unattempted) / total) * 100;
        const difficultyLevel =
          difficultyScore >= 60
            ? "Difficult"
            : correctPercentage >= 70
              ? "Easy"
              : "Medium";

        return {
          ...question,
          subject: getQuestionSubject(
            question.question,
            { subject: question.subject },
            totalQuestionCountForMapping,
          ),
          blooms_skill: question.blooms_skill,
          stored_difficulty_level: question.stored_difficulty_level,
          correct_percentage: correctPercentage.toFixed(2),
          incorrect_percentage: ((question.incorrect / total) * 100).toFixed(2),
          unattempted_percentage: (
            (question.unattempted / total) *
            100
          ).toFixed(2),
          average_marks: (question.total_marks / total).toFixed(2),
          difficulty_score: difficultyScore.toFixed(2),
          difficulty_level: difficultyLevel,
        };
      })
      .sort((a, b) => {
        const first = getQuestionNumber(a.question);
        const second = getQuestionNumber(b.question);
        return first - second;
      });

    const bloomTaggedQuestions = questionAnalytics.filter(
      (question) => question.blooms_skill,
    );
    const calculateMastery = (questions) => {
      const totals = questions.reduce(
        (sum, question) => ({
          correct: sum.correct + question.correct,
          responses:
            sum.responses +
            question.correct +
            question.incorrect +
            question.unattempted,
        }),
        { correct: 0, responses: 0 },
      );

      return totals.responses > 0
        ? ((totals.correct / totals.responses) * 100).toFixed(2)
        : "0.00";
    };
    const lowerOrderQuestions = bloomTaggedQuestions.filter((question) =>
      ["Remember", "Understand"].includes(question.blooms_skill),
    );
    const higherOrderQuestions = bloomTaggedQuestions.filter((question) =>
      ["Apply", "Analyse", "Evaluate", "Create"].includes(question.blooms_skill),
    );
    const bloomSummaryCards = [
      {
        title: "Overall Cognitive Mastery",
        value: `${calculateMastery(bloomTaggedQuestions)}%`,
        helper: "Across all Bloom-tagged questions",
        Icon: Target,
        iconColor: "#1681ff",
        valueColor: "#061a4f",
        bg: "linear-gradient(135deg, #eef6ff 0%, #f7fbff 100%)",
      },
      {
        title: "Lower Order Thinking",
        value: `${calculateMastery(lowerOrderQuestions)}%`,
        helper: "Remember + Understand",
        Icon: Brain,
        iconColor: "#10b981",
        valueColor: "#061a4f",
        bg: "linear-gradient(135deg, #eafbf6 0%, #f7fffc 100%)",
      },
      {
        title: "Higher Order Thinking",
        value: `${calculateMastery(higherOrderQuestions)}%`,
        helper: "Apply + Analyse + Evaluate + Create",
        Icon: Lightbulb,
        iconColor: "#ff7a1a",
        valueColor: "#a20f2d",
        bg: "linear-gradient(135deg, #fff2e8 0%, #fff9f4 100%)",
      },
      {
        title: "Questions Analysed",
        value: bloomTaggedQuestions.length,
        helper: "Questions with Bloom skill tags",
        Icon: FileText,
        iconColor: "#3b82f6",
        valueColor: "#061a4f",
        bg: "linear-gradient(135deg, #f0f3ff 0%, #fbfaff 100%)",
      },
      {
        title: "Students",
        value: results.length || totalStudents || 0,
        helper: "Students in selected exam",
        Icon: UsersRound,
        iconColor: "#fb5b7b",
        valueColor: "#a20f2d",
        bg: "linear-gradient(135deg, #fff0f5 0%, #fff7fa 100%)",
      },
    ];
    const bloomDistributionColors = {
      Remember: "#2f8cff",
      Understand: "#34c99a",
      Apply: "#ffc83d",
      Analyse: "#ff8a45",
      Evaluate: "#ff5f7d",
      Create: "#8f6df6",
    };
    const bloomDistribution = bloomSkills.map((skill) => {
      const count = bloomTaggedQuestions.filter(
        (question) => question.blooms_skill === skill,
      ).length;
      const percentage =
        bloomTaggedQuestions.length > 0
          ? Math.round((count / bloomTaggedQuestions.length) * 100)
          : 0;

      return {
        skill,
        count,
        percentage,
        color: bloomDistributionColors[skill],
      };
    });
    let bloomDistributionCursor = 0;
    const bloomDistributionSegments = bloomDistribution
      .filter((item) => item.count > 0)
      .map((item) => {
        const precisePercentage =
          bloomTaggedQuestions.length > 0
            ? (item.count / bloomTaggedQuestions.length) * 100
            : 0;
        const start = bloomDistributionCursor;
        const end = start + precisePercentage;
        const midpoint = start + precisePercentage / 2;
        const angle = (midpoint / 100) * 360 - 90;
        const radius = 82;
        bloomDistributionCursor = end;

        return {
          ...item,
          gradient: `${item.color} ${start}% ${end}%`,
          labelStyle: {
            left: `calc(50% + ${Math.cos((angle * Math.PI) / 180) * radius}px)`,
            top: `calc(50% + ${Math.sin((angle * Math.PI) / 180) * radius}px)`,
          },
        };
      });
    const bloomDistributionGradient =
      bloomDistributionSegments.map((item) => item.gradient).join(", ") ||
      "#e2e8f0 0% 100%";
    const bloomPerformance = bloomSkills.map((skill) => {
      const skillQuestions = bloomTaggedQuestions.filter(
        (question) => question.blooms_skill === skill,
      );
      const correct = skillQuestions.reduce(
        (sum, question) => sum + question.correct,
        0,
      );
      const incorrect = skillQuestions.reduce(
        (sum, question) => sum + question.incorrect,
        0,
      );
      const unattempted = skillQuestions.reduce(
        (sum, question) => sum + question.unattempted,
        0,
      );
      const totalResponses = correct + incorrect + unattempted;

      return {
        skill,
        percentage:
          totalResponses > 0 ? Math.round((correct / totalResponses) * 100) : 0,
        color: bloomDistributionColors[skill],
      };
    });
    const cognitiveBalance = (() => {
      const lotsCount = bloomDistribution
        .filter((item) => ["Remember", "Understand"].includes(item.skill))
        .reduce((sum, item) => sum + item.count, 0);
      const hotsCount = bloomDistribution
        .filter((item) =>
          ["Apply", "Analyse", "Evaluate", "Create"].includes(item.skill),
        )
        .reduce((sum, item) => sum + item.count, 0);
      const total = lotsCount + hotsCount;
      const lotsPercentage = total > 0 ? Math.round((lotsCount / total) * 100) : 0;
      const hotsPercentage = total > 0 ? 100 - lotsPercentage : 0;

      return {
        lotsCount,
        hotsCount,
        lotsPercentage,
        hotsPercentage,
        gradient:
          total > 0
            ? `#22b981 0% ${lotsPercentage}%, #ff7a1a ${lotsPercentage}% 100%`
          : "#e2e8f0 0% 100%",
      };
    })();

    const cognitivePerformanceTrend = (() => {
      const normalizeExamDateValue = (value) => {
        if (!value) return "";
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
        return String(value).trim().slice(0, 10);
      };
      const getExamOrder = (exam) =>
        parseInt(String(exam?.exam_pattern || "").replace(/[^0-9]/g, ""), 10) || 0;
      const getExamTime = (exam) => {
        const date = new Date(exam?.exam_date || exam?.created_at || "");
        return Number.isNaN(date.getTime()) ? 0 : date.getTime();
      };
      const getTrendKey = (exam) =>
        [
          exam?.school_id || currentOMRExam.school_id || schoolId || "",
          exam?.program || currentOMRExam.program || "",
          exam?.exam_pattern || "",
          exam?.class || "",
          exam?.section || "",
          normalizeExamDateValue(exam?.exam_date),
        ].join("|");
      const sameValue = (left, right) =>
        String(left || "").trim().toLowerCase() ===
        String(right || "").trim().toLowerCase();
      const sourceRows =
        Array.isArray(allClassExams) && allClassExams.length > 0
          ? allClassExams
          : results;
      const scopedRows = sourceRows.filter(
        (exam) =>
          sameValue(exam.class, currentOMRExam.class) &&
          sameValue(exam.section, currentOMRExam.section) &&
          (!currentOMRExam.school_id ||
            sameValue(exam.school_id, currentOMRExam.school_id)) &&
          (!currentOMRExam.program ||
            sameValue(exam.program, currentOMRExam.program)),
      );
      const grouped = new Map();

      scopedRows.forEach((exam) => {
        const key = getTrendKey(exam);
        if (!grouped.has(key)) {
          grouped.set(key, {
            key,
            exam_pattern: exam.exam_pattern || "Exam",
            exam_date: exam.exam_date || "",
            created_at: exam.created_at || "",
            rows: [],
          });
        }
        const group = grouped.get(key);
        group.rows.push(exam);
        if (!group.exam_date && exam.exam_date) group.exam_date = exam.exam_date;
        if (exam.created_at && (!group.created_at || exam.created_at > group.created_at)) {
          group.created_at = exam.created_at;
        }
      });

      const currentKey = getTrendKey(currentOMRExam);
      if (!grouped.has(currentKey)) {
        grouped.set(currentKey, {
          key: currentKey,
          exam_pattern: currentOMRExam.exam_pattern || "Current",
          exam_date: currentOMRExam.exam_date || "",
          created_at: currentOMRExam.created_at || "",
          rows: results,
        });
      }

      const sortedGroups = Array.from(grouped.values()).sort((a, b) => {
        const orderA = getExamOrder(a);
        const orderB = getExamOrder(b);
        if (orderA !== orderB) return orderA - orderB;
        const timeA = getExamTime(a);
        const timeB = getExamTime(b);
        if (timeA !== timeB) return timeA - timeB;
        return String(a.exam_pattern).localeCompare(String(b.exam_pattern));
      });
      const currentIndex = sortedGroups.findIndex((group) => group.key === currentKey);
      const visibleGroups =
        currentIndex >= 0 ? sortedGroups.slice(0, currentIndex + 1) : sortedGroups;

      return visibleGroups.map((group, index) => {
        const totals = group.rows.reduce(
          (acc, studentResult) => {
            const questions = parseQuestionResults(studentResult.question_results);
            Object.values(questions).forEach((details) => {
              const skill = normalizeBloomSkill(
                details?.blooms_skill ||
                  details?.bloomsSkill ||
                  details?.["Blooms Skill"] ||
                  details?.["Bloom's Skill"],
              );
              const bucket = ["Remember", "Understand"].includes(skill)
                ? "lots"
                : ["Apply", "Analyse", "Evaluate", "Create"].includes(skill)
                  ? "hots"
                  : "";
              if (!bucket) return;

              acc[bucket].total += 1;
              if (getQuestionResponseStatus(details) === "correct") {
                acc[bucket].correct += 1;
              }
            });
            return acc;
          },
          {
            lots: { correct: 0, total: 0 },
            hots: { correct: 0, total: 0 },
          },
        );

        const pct = (bucket) =>
          bucket.total > 0 ? Math.round((bucket.correct / bucket.total) * 100) : null;
        return {
          key: group.key,
          label: group.exam_pattern || `Exam ${index + 1}`,
          lots: pct(totals.lots),
          hots: pct(totals.hots),
        };
      });
    })();
    const trendChart = (() => {
      const width = 520;
      const height = 235;
      const padding = { top: 16, right: 18, bottom: 36, left: 64 };
      const plotWidth = width - padding.left - padding.right;
      const plotHeight = height - padding.top - padding.bottom;
      const xForIndex = (index) =>
        padding.left +
        (cognitivePerformanceTrend.length <= 1
          ? plotWidth / 2
          : (plotWidth / (cognitivePerformanceTrend.length - 1)) * index);
      const yForValue = (value) =>
        padding.top + plotHeight - ((value ?? 0) / 100) * plotHeight;
      const pointsFor = (key) =>
        cognitivePerformanceTrend
          .map((item, index) => `${xForIndex(index)},${yForValue(item[key])}`)
          .join(" ");

      return {
        width,
        height,
        padding,
        plotWidth,
        plotHeight,
        xForIndex,
        yForValue,
        lotsPoints: pointsFor("lots"),
        hotsPoints: pointsFor("hots"),
      };
    })();
    const studentCognitiveDistribution = (() => {
      const bands = [
        {
          label: "Advanced Thinkers",
          range: "80-100%",
          min: 80,
          max: 100,
          count: 0,
          color: "#8f6df6",
          bg: "linear-gradient(90deg, rgba(143, 109, 246, 0.16), rgba(143, 109, 246, 0.05))",
          clipPath: "polygon(42% 0, 58% 0, 70% 100%, 30% 100%)",
        },
        {
          label: "Proficient",
          range: "60-79%",
          min: 60,
          max: 79.999,
          count: 0,
          color: "#34c99a",
          bg: "linear-gradient(90deg, rgba(52, 201, 154, 0.16), rgba(52, 201, 154, 0.05))",
          clipPath: "polygon(30% 0, 70% 0, 82% 100%, 18% 100%)",
        },
        {
          label: "Developing",
          range: "40-59%",
          min: 40,
          max: 59.999,
          count: 0,
          color: "#ffc83d",
          bg: "linear-gradient(90deg, rgba(255, 200, 61, 0.18), rgba(255, 200, 61, 0.06))",
          clipPath: "polygon(18% 0, 82% 0, 94% 100%, 6% 100%)",
        },
        {
          label: "Foundation",
          range: "0-39%",
          min: 0,
          max: 39.999,
          count: 0,
          color: "#ff6f8d",
          bg: "linear-gradient(90deg, rgba(255, 111, 141, 0.18), rgba(255, 111, 141, 0.06))",
          clipPath: "polygon(6% 0, 94% 0, 100% 100%, 0 100%)",
        },
      ];

      results.forEach((studentResult) => {
        const questions = parseQuestionResults(studentResult.question_results);
        const totals = Object.values(questions).reduce(
          (acc, details) => {
            const skill = normalizeBloomSkill(
              details?.blooms_skill ||
                details?.bloomsSkill ||
                details?.["Blooms Skill"] ||
                details?.["Bloom's Skill"],
            );
            if (!skill) return acc;

            acc.total += 1;
            if (getQuestionResponseStatus(details) === "correct") {
              acc.correct += 1;
            }
            return acc;
          },
          { correct: 0, total: 0 },
        );
        const accuracy =
          totals.total > 0 ? (totals.correct / totals.total) * 100 : 0;
        const band =
          bands.find((item) => accuracy >= item.min && accuracy <= item.max) ||
          bands[bands.length - 1];
        band.count += 1;
      });

      const studentCount = results.length || totalStudents || 0;
      return bands.map((band) => ({
        ...band,
        percentage:
          studentCount > 0 ? Math.round((band.count / studentCount) * 100) : 0,
      }));
    })();
    const cognitiveKeyInsights = (() => {
      const lowerOrderMastery = parseFloat(calculateMastery(lowerOrderQuestions)) || 0;
      const higherOrderMastery = parseFloat(calculateMastery(higherOrderQuestions)) || 0;
      const hotsGap = Math.round(lowerOrderMastery - higherOrderMastery);
      const taggedSkillPerformance = bloomPerformance
        .filter((item) =>
          bloomTaggedQuestions.some((question) => question.blooms_skill === item.skill),
        )
        .sort((a, b) => b.percentage - a.percentage);
      const topSkills = taggedSkillPerformance
        .slice(0, 2)
        .map((item) => item.skill);
      const strongestText =
        topSkills.length > 1
          ? `Strong performance in ${topSkills[0]} and ${topSkills[1]} levels.`
          : topSkills.length === 1
            ? `Strong performance in ${topSkills[0]} level.`
            : "Bloom-tagged performance data is not available yet.";

      const hotsSupportCount = results.reduce((count, studentResult) => {
        const questions = parseQuestionResults(studentResult.question_results);
        const totals = Object.values(questions).reduce(
          (acc, details) => {
            const skill = normalizeBloomSkill(
              details?.blooms_skill ||
                details?.bloomsSkill ||
                details?.["Blooms Skill"] ||
                details?.["Bloom's Skill"],
            );
            if (!["Apply", "Analyse", "Evaluate", "Create"].includes(skill)) {
              return acc;
            }

            acc.total += 1;
            if (getQuestionResponseStatus(details) === "correct") {
              acc.correct += 1;
            }
            return acc;
          },
          { correct: 0, total: 0 },
        );
        const hotsAccuracy =
          totals.total > 0 ? (totals.correct / totals.total) * 100 : null;
        return hotsAccuracy !== null && hotsAccuracy < 40 ? count + 1 : count;
      }, 0);
      const hotsInsight =
        hotsGap >= 10
          ? `HOTS trails LOTS by ${hotsGap}%, needs focused improvement.`
          : higherOrderMastery < 60
            ? "HOTS needs focused improvement."
            : "HOTS performance is broadly in line with LOTS.";
      const recommendation =
        cognitiveBalance.hotsPercentage < 50
          ? "Increase application-based and open-ended questions in future assessments."
          : higherOrderMastery < 60
            ? "Add focused practice for Apply, Analyse, Evaluate, and Create questions."
            : "Maintain a balanced mix of LOTS and HOTS questions.";

      return [
        {
          text: strongestText,
          Icon: Target,
          color: "#ff3158",
        },
        {
          text: hotsInsight,
          Icon: Activity,
          color: "#22b981",
        },
        {
          text: `${hotsSupportCount} students require targeted support in higher-order thinking.`,
          Icon: UsersRound,
          color: "#1681ff",
        },
        {
          text: recommendation,
          Icon: Lightbulb,
          color: "#ffb11a",
        },
      ];
    })();

    const subjectDifficultySummary = activeSubs.map((subject) => {
      const subjectQuestions = questionAnalytics.filter(
        (question) =>
          String(question.subject || "").toLowerCase() ===
          String(subject || "").toLowerCase(),
      );
      const totalQuestions = subjectQuestions.length || 0;
      const difficultCount = subjectQuestions.filter(
        (question) => question.difficulty_level === "Difficult",
      ).length;
      const mediumCount = subjectQuestions.filter(
        (question) => question.difficulty_level === "Medium",
      ).length;
      const easyCount = subjectQuestions.filter(
        (question) => question.difficulty_level === "Easy",
      ).length;
      const pct = (count) =>
        totalQuestions > 0 ? ((count / totalQuestions) * 100).toFixed(2) : "0.00";

      return {
        subject,
        total_questions: totalQuestions,
        difficult_count: difficultCount,
        medium_count: mediumCount,
        easy_count: easyCount,
        difficult_percentage: pct(difficultCount),
        medium_percentage: pct(mediumCount),
        easy_percentage: pct(easyCount),
      };
    });

    const subjectBloomSkillSummary = activeSubs.map((subject) => {
      const subjectQuestions = questionAnalytics.filter(
        (question) =>
          String(question.subject || "").toLowerCase() ===
          String(subject || "").toLowerCase(),
      );

      return {
        subject,
        total_questions: subjectQuestions.length,
        skills: bloomSkills.map((skill) => {
          const skillQuestions = subjectQuestions.filter(
            (question) => question.blooms_skill === skill,
          );
          const correct = skillQuestions.reduce(
            (sum, question) => sum + question.correct,
            0,
          );
          const incorrect = skillQuestions.reduce(
            (sum, question) => sum + question.incorrect,
            0,
          );
          const unattempted = skillQuestions.reduce(
            (sum, question) => sum + question.unattempted,
            0,
          );
          const totalResponses = correct + incorrect + unattempted;
          const pct = (count) =>
            totalResponses > 0
              ? ((count / totalResponses) * 100).toFixed(2)
              : "0.00";

          return {
            skill,
            questions: skillQuestions.length,
            correct,
            incorrect,
            unattempted,
            correct_percentage: pct(correct),
            incorrect_percentage: pct(incorrect),
            unattempted_percentage: pct(unattempted),
          };
        }),
      };
    });

    const mostDifficultQuestions = [...questionAnalytics]
      .sort((a, b) => parseFloat(b.difficulty_score) - parseFloat(a.difficulty_score))
      .slice(0, 5);
    const easiestQuestions = [...questionAnalytics]
      .sort((a, b) => parseFloat(b.correct_percentage) - parseFloat(a.correct_percentage))
      .slice(0, 5);
    const mediumQuestions = questionAnalytics
      .filter((question) => question.difficulty_level === "Medium")
      .sort(
        (a, b) =>
          Math.abs(parseFloat(a.correct_percentage) - 50) -
          Math.abs(parseFloat(b.correct_percentage) - 50),
      )
      .slice(0, 5);

    const bloomTaxonomyAnalyticsSection = (
        <section
          className="exam-results-page bloom-analysis"
          data-bloom-taxonomy-analytics
          style={{ marginBottom: "20px" }}
        >
          {questionAnalytics.length > 0 && (
            <div
              className="bloom-summary-grid"
              style={{
                display: "grid",
                gap: "14px",
                marginBottom: "20px",
              }}
            >
              {bloomSummaryCards.map((card) => {
                const Icon = card.Icon;

                return (
                  <div
                    key={card.title}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "44px minmax(0, 1fr)",
                      alignItems: "center",
                      gap: "12px",
                      padding: "18px 16px",
                      borderRadius: "8px",
                      background: card.bg,
                      border: "1px solid #e8eef7",
                      minHeight: "118px",
                      boxShadow: "0 8px 22px rgba(15, 47, 99, 0.06)",
                    }}
                  >
                    <Icon
                      size={44}
                      strokeWidth={2.2}
                      color={card.iconColor}
                      aria-hidden="true"
                    />
                    <div>
                      <div
                        style={{
                          color: "#0b1f5c",
                          fontSize: "12px",
                          fontWeight: "900",
                          lineHeight: 1.25,
                          marginBottom: "4px",
                        }}
                      >
                        {card.title}
                      </div>
                      <div
                        style={{
                          color: card.valueColor,
                          fontSize: "30px",
                          fontWeight: "900",
                          lineHeight: 1,
                          marginBottom: "7px",
                        }}
                      >
                        {card.value}
                      </div>
                      <div
                        style={{
                          color: "#30507f",
                          fontSize: "11px",
                          fontWeight: "700",
                          lineHeight: 1.3,
                        }}
                      >
                        {card.helper}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {questionAnalytics.length > 0 && (
            <div
              className="bloom-chart-grid"
              style={{
                display: "grid",
                alignItems: "stretch",
                gap: "18px",
                marginBottom: "20px",
              }}
            >
            <div
              style={{
                padding: "16px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                boxShadow: "0 8px 22px rgba(15, 47, 99, 0.05)",
                width: "100%",
                maxWidth: "none",
                minHeight: "324px",
              }}
            >
              <h3
                style={{
                  margin: "0 0 16px",
                  color: "#0b1f5c",
                  fontSize: "16px",
                  fontWeight: "900",
                }}
              >
                Question Distribution by Bloom&apos;s Skill
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))",
                  alignItems: "center",
                  gap: "14px",

                }}
              >
                <div
                  style={{
                    width: "min(100%, 210px)",
                    aspectRatio: "1",
                    borderRadius: "50%",
                    background: `conic-gradient(${bloomDistributionGradient})`,
                    display: "grid",
                    placeItems: "center",
                    justifySelf: "center",
                    position: "relative",
                  }}
                >
                  {bloomDistributionSegments.map((item) => (
                    <span
                      key={`${item.skill}-donut-label`}
                      style={{
                        position: "absolute",
                        ...item.labelStyle,
                        transform: "translate(-50%, -50%)",
                        color: item.skill === "Apply" ? "#0b1f5c" : "#ffffff",
                        fontSize: "14px",
                        fontWeight: "900",
                        lineHeight: 1,
                        textShadow:
                          item.skill === "Apply"
                            ? "0 1px 2px rgba(255, 255, 255, 0.45)"
                            : "0 1px 2px rgba(15, 23, 42, 0.3)",
                        pointerEvents: "none",
                      }}
                    >
                      {item.percentage}%
                    </span>
                  ))}
                  <div
                    style={{
                      width: "104px",
                      height: "104px",
                      borderRadius: "50%",
                      background: "#ffffff",
                      display: "grid",
                      placeItems: "center",
                      textAlign: "center",
                      boxShadow: "inset 0 0 0 1px #e2e8f0",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: "#0b1f5c",
                          fontSize: "30px",
                          fontWeight: "900",
                          lineHeight: 1,
                        }}
                      >
                        {bloomTaggedQuestions.length}
                      </div>
                      <div
                        style={{
                          color: "#30507f",
                          fontSize: "11px",
                          fontWeight: "800",
                          marginTop: "4px",
                        }}
                      >
                        Questions
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "11px",
                    minWidth: 0,
                  }}
                >
                  {bloomDistribution.map((item) => (
                    <div
                      key={item.skill}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "16px minmax(82px, 1fr) max-content",
                        alignItems: "center",
                        gap: "8px",
                        color: "#0b1f5c",
                        fontSize: "14px",
                        fontWeight: "800",
                        minWidth: 0,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: "12px",
                          height: "12px",
                          borderRadius: "3px",
                          background: item.color,
                        }}
                      />
                      <span>{item.skill}</span>
                      <span>
                        {item.percentage}% ({item.count})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div
              className="bloom-centered-chart-card"
              style={{
                padding: "16px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                boxShadow: "0 8px 22px rgba(15, 47, 99, 0.05)",
                width: "100%",
                maxWidth: "none",
                minHeight: "324px",
              }}
            >
              <h3
                style={{
                  margin: "0 0 16px",
                  color: "#0b1f5c",
                  fontSize: "16px",
                  fontWeight: "900",
                }}
              >
                Overall Performance by Bloom&apos;s Skill
              </h3>
              <div className="bloom-centered-chart-body">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "26px minmax(0, 1fr)",
                  gap: "10px",
                  height: "230px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    paddingTop: "12px",
                    paddingBottom: "48px",
                    color: "#30507f",
                    fontSize: "11px",
                    fontWeight: "800",
                  }}
                >
                  {[100, 80, 60, 40, 20, 0].map((value) => (
                    <span key={value}>{value}</span>
                  ))}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                    alignItems: "end",
                    gap: "clamp(4px, 1cqi, 14px)",
                    borderLeft: "1px solid #dbe5f2",
                    borderBottom: "1px solid #dbe5f2",
                    padding: "12px 4px 48px",
                    background:
                      "repeating-linear-gradient(to top, transparent 0, transparent 31px, #edf2f7 32px)",
                  }}
                >
                  {bloomPerformance.map((item) => (
                    <div
                      key={item.skill}
                      style={{
                        height: "100%",
                        display: "grid",
                        alignItems: "end",
                        justifyItems: "center",
                        position: "relative",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          bottom: `calc(${item.percentage}% + 7px)`,
                          color: "#0b1f5c",
                          fontSize: "12px",
                          fontWeight: "900",
                          whiteSpace: "normal",
                          overflowWrap: "anywhere",
                          textAlign: "center",
                        }}
                      >
                        {item.percentage}%
                      </span>
                      <div
                        style={{
                          width: "34px",
                          minWidth: 0,
                          maxWidth: "100%",
                          height: `${item.percentage}%`,
                          minHeight: item.percentage > 0 ? "4px" : 0,
                          borderRadius: "6px 6px 2px 2px",
                          background: item.color,
                          boxShadow: "0 6px 12px rgba(15, 47, 99, 0.12)",
                        }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          top: "100%",
                          width: "100%",
                          marginTop: "8px",
                          color: "#0b1f5c",
                          fontSize: "11px",
                          fontWeight: "800",
                          whiteSpace: "normal",
                          overflowWrap: "anywhere",
                          textAlign: "center",
                        }}
                      >
                        {item.skill}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              </div>
            </div>
            <div
              className="bloom-centered-chart-card"
              style={{
                padding: "16px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                boxShadow: "0 8px 22px rgba(15, 47, 99, 0.05)",
                width: "100%",
                maxWidth: "none",
                minHeight: "324px",
              }}
            >
              <h3
                style={{
                  margin: "0 0 16px",
                  color: "#0b1f5c",
                  fontSize: "16px",
                  fontWeight: "900",
                }}
              >
                Cognitive Balance
              </h3>
              <div className="bloom-centered-chart-body">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(44px, 1fr) minmax(0, 176px) minmax(44px, 1fr)",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px",
                  marginTop: "12px",
                }}
              >
                <div
                  style={{
                    color: "#10a878",
                    textAlign: "center",
                    fontWeight: "900",
                    lineHeight: 1.1,
                  }}
                >
                  <div style={{ fontSize: "20px" }}>
                    {cognitiveBalance.lotsPercentage}%
                  </div>
                  <div style={{ fontSize: "12px" }}>LOTS</div>
                </div>
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    borderRadius: "50%",
                    background: `conic-gradient(${cognitiveBalance.gradient})`,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: "90px",
                      height: "90px",
                      borderRadius: "50%",
                      background: "#ffffff",
                      display: "grid",
                      placeItems: "center",
                      textAlign: "center",
                      boxShadow: "inset 0 0 0 1px #e2e8f0",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: "#0b1f5c",
                          fontSize: "24px",
                          fontWeight: "900",
                          lineHeight: 1,
                        }}
                      >
                        {bloomTaggedQuestions.length > 0 ? "100%" : "0%"}
                      </div>
                      <div
                        style={{
                          color: "#30507f",
                          fontSize: "11px",
                          fontWeight: "800",
                          marginTop: "4px",
                        }}
                      >
                        Questions
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    color: "#ff6f1a",
                    textAlign: "center",
                    fontWeight: "900",
                    lineHeight: 1.1,
                  }}
                >
                  <div style={{ fontSize: "20px" }}>
                    {cognitiveBalance.hotsPercentage}%
                  </div>
                  <div style={{ fontSize: "12px" }}>HOTS</div>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gap: "10px",
                  marginTop: "18px",
                  color: "#0b1f5c",
                  fontSize: "12px",
                  fontWeight: "800",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: "#22b981",
                    }}
                  />
                  <span>LOTS (Remember + Understand)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: "#ff7a1a",
                    }}
                  />
                  <span>HOTS (Apply + Analyse + Evaluate + Create)</span>
                </div>
              </div>
              </div>
            </div>
            </div>
          )}

          {questionAnalytics.length > 0 && (
            <div
              className="bloom-chart-grid"
              style={{
                display: "grid",
                alignItems: "stretch",
                gap: "18px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  padding: "16px",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  boxShadow: "0 8px 22px rgba(15, 47, 99, 0.05)",
                  width: "100%",
                  maxWidth: "none",
                  minHeight: "280px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                    marginBottom: "8px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      color: "#0b1f5c",
                      fontSize: "18px",
                      fontWeight: "900",
                    }}
                  >
                    Cognitive Performance Trend
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      color: "#0b1f5c",
                      fontSize: "14px",
                      fontWeight: "800",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          background: "#22b981",
                        }}
                      />
                      LOTS
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          background: "#ff7a1a",
                        }}
                      />
                      HOTS
                    </span>
                  </div>
                </div>

                <div style={{ width: "100%", overflowX: "hidden" }}>
                  <svg
                    width="100%"
                    height="220"
                    viewBox={`0 0 ${trendChart.width} ${trendChart.height}`}
                    role="img"
                    aria-label="Cognitive performance trend for current and previous exams"
                    style={{ display: "block" }}
                  >
                    {[100, 80, 60, 40, 20, 0].map((value) => {
                      const y = trendChart.yForValue(value);
                      return (
                        <g key={`trend-grid-${value}`}>
                          <line
                            x1={trendChart.padding.left}
                            y1={y}
                            x2={trendChart.padding.left + trendChart.plotWidth}
                            y2={y}
                            stroke="#edf2f7"
                            strokeWidth="1"
                          />
                          <text
                            x={trendChart.padding.left - 10}
                            y={y + 4}
                            textAnchor="end"
                            fill="#30507f"
                            fontSize="12"
                            fontWeight="800"
                          >
                            {value}
                          </text>
                        </g>
                      );
                    })}
                    <line
                      x1={trendChart.padding.left}
                      y1={trendChart.padding.top}
                      x2={trendChart.padding.left}
                      y2={trendChart.padding.top + trendChart.plotHeight}
                      stroke="#dbe5f2"
                      strokeWidth="1"
                    />
                    <line
                      x1={trendChart.padding.left}
                      y1={trendChart.padding.top + trendChart.plotHeight}
                      x2={trendChart.padding.left + trendChart.plotWidth}
                      y2={trendChart.padding.top + trendChart.plotHeight}
                      stroke="#dbe5f2"
                      strokeWidth="1"
                    />
                    {cognitivePerformanceTrend.length > 1 && (
                      <>
                        <polyline
                          points={trendChart.lotsPoints}
                          fill="none"
                          stroke="#22b981"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <polyline
                          points={trendChart.hotsPoints}
                          fill="none"
                          stroke="#ff7a1a"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </>
                    )}
                    {cognitivePerformanceTrend.map((item, index) => {
                      const x = trendChart.xForIndex(index);
                      const labelY =
                        trendChart.padding.top + trendChart.plotHeight + 26;
                      return (
                        <g key={item.key}>
                          <text
                            x={x}
                            y={labelY}
                            textAnchor={index === 0 ? "start" : index === cognitivePerformanceTrend.length - 1 ? "end" : "middle"}
                            fill="#0b1f5c"
                            fontSize="12"
                            fontWeight="800"
                          >
                            {item.label}
                          </text>
                          {[
                            { key: "lots", color: "#22b981", dy: -14 },
                            { key: "hots", color: "#ff7a1a", dy: 22 },
                          ].map((series) => {
                            const value = item[series.key] ?? 0;
                            const y = trendChart.yForValue(value);
                            return (
                              <g key={`${item.key}-${series.key}`}>
                                <circle
                                  cx={x}
                                  cy={y}
                                  r="6"
                                  fill={series.color}
                                  stroke="#ffffff"
                                  strokeWidth="2"
                                />
                                <text
                                  x={x}
                                  y={Math.max(14, Math.min(trendChart.height - 12, y + series.dy))}
                                  textAnchor="middle"
                                  fill={series.color}
                                  fontSize="12"
                                  fontWeight="900"
                                >
                                  {value}%
                                </text>
                              </g>
                            );
                          })}
                        </g>
                      );
                    })}
                    <text
                      x="24"
                      y="118"
                      fill="#30507f"
                      fontSize="12"
                      fontWeight="800"
                      transform="rotate(-90 24 118)"
                      textAnchor="middle"
                    >
                      Accuracy (%)
                    </text>
                  </svg>
                </div>
              </div>
              <div
                style={{
                  padding: "16px",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  boxShadow: "0 8px 22px rgba(15, 47, 99, 0.05)",
                  width: "100%",
                  maxWidth: "none",
                  minHeight: "280px",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 14px",
                    color: "#0b1f5c",
                    fontSize: "18px",
                    fontWeight: "900",
                  }}
                >
                  Student Distribution by Cognitive Level
                </h3>
                <div
                  style={{
                    display: "grid",
                    gap: "6px",
                  }}
                >
                  {studentCognitiveDistribution.map((band, index) => (
                    <div
                      key={band.label}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(40px, 28%) minmax(0, 1fr)",
                        alignItems: "center",
                        minHeight: "48px",
                        borderRadius: "8px",
                        background: band.bg,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: "100%",
                          background: band.color,
                          clipPath: band.clipPath,
                        }}
                      />
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) max-content",
                          alignItems: "center",
                          gap: "12px",
                          padding: "10px 8px",
                          color: "#0b1f5c",
                          fontSize: "14px",
                          fontWeight: "800",
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{

                            whiteSpace: "normal",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {band.label} ({band.range})
                        </span>
                        <span
                          style={{
                            color:
                              band.label === "Foundation"
                                ? "#a20f2d"
                                : band.color,
                            fontSize: "20px",
                            fontWeight: "900",
                          }}
                        >
                          {band.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div
                style={{
                  padding: "16px",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  boxShadow: "0 8px 22px rgba(15, 47, 99, 0.05)",
                  width: "100%",
                  maxWidth: "none",
                  minHeight: "280px",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 14px",
                    color: "#0b1f5c",
                    fontSize: "18px",
                    fontWeight: "900",
                  }}
                >
                  Key Insights
                </h3>
                <div
                  style={{
                    display: "grid",
                    gap: "14px",
                  }}
                >
                  {cognitiveKeyInsights.map((insight) => {
                    const Icon = insight.Icon;

                    return (
                      <div
                        key={insight.text}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "42px minmax(0, 1fr)",
                          alignItems: "center",
                          gap: "12px",
                          color: "#0b1f5c",
                          fontSize: "14px",
                          fontWeight: "700",
                          lineHeight: 1.35,
                          minHeight: "42px",
                        }}
                      >
                        <Icon
                          size={34}
                          strokeWidth={2.4}
                          color={insight.color}
                          aria-hidden="true"
                        />
                        <span>{insight.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {questionAnalytics.length === 0 && (
              <div
                style={{
                  padding: "40px",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  color: "#64748b",
                  textAlign: "center",
                  border: "1px dashed #cbd5e1",
                }}
              >
              No Bloom&apos;s taxonomy analytics available for this exam.
            </div>
          )}
        </section>
      );

    return (
      <div className="exam-results-page exam-results-tabbed">
        <div style={{ display: "none" }}>
          <h2>
            {currentOMRExam.class}-{currentOMRExam.section} |{" "}
            {currentOMRExam.exam_pattern}
          </h2>
        </div>

        <div
          className="exam-results-header"
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
          <div className="exam-results-header-main">
            <div className="exam-results-heading">
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
          </div>
          <div className="exam-results-header-actions">

            <div className="exam-view-switcher" role="group" aria-label="Exam views">
              {[
                { id: "cognitive", label: "Cognitive Analysis" },
                { id: "analysis", label: "Exam Analysis" },
                { id: "results", label: "Exam Result" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="exam-view-button"
                  aria-pressed={examResultView === item.id}
                  aria-controls={`exam-view-${item.id}`}
                  onClick={() => setExamResultView(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              className="page-back-nav exam-results-back"
              onClick={() => setView("exam")}
            >
              Back to Batch Wise Results
            </button>
          </div>
          </div>

        <section id="exam-view-cognitive" className="exam-view-panel" aria-label="Cognitive Analysis" hidden={examResultView !== "cognitive"}>
          <div className="exam-view-actions">
            <button type="button" className="exam-results-header-download" onClick={() => setView("subject-bloom-analytics")}>
              Detailed Analysis
            </button>
          </div>
          {bloomTaxonomyAnalyticsSection}
        </section>

        {/* === ANALYSIS SECTION === */}
        <section id="exam-view-analysis" className="exam-view-panel" aria-label="Exam Analysis" hidden={examResultView !== "analysis"}>
          <div className="exam-view-actions">
            <button
              type="button"
              className="exam-results-header-download"
              disabled={resultsLoading || results.length === 0}
              onClick={() => analysisDownloadButtonRef.current?.click()}
            >
              <Download size={15} />
              Download Analysis PDF
            </button>
          </div>
          {/* 1. Subject Averages (Percentages) */}
          <div
            className="exam-results-analysis-section exam-results-analysis-section--averages"
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
              Subject Averages (%)
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
            className="exam-results-analysis-section exam-results-analysis-section--toppers"
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
                Subject-wise Toppers (Top 5)
              </h3>
            </div>

            <div className="exam-results-table-scroll">
              <table
                className="exam-results-toppers-table"
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
          </div>

          {/* 3. Grade-wise Distribution */}
          <div
            className="exam-results-analysis-section exam-results-analysis-section--grades"
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
            <div
              className="exam-results-table-scroll"
              style={{ overflowX: "auto" }}
            >
              <table
                className="exam-results-grade-table"
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

        </section>

        {/* Keep the existing PDF handler mounted for the analysis download. */}
        <div hidden>
        <button
          className="exam-results-download-btn exam-results-download-btn--analysis"
          ref={analysisDownloadButtonRef}
          onClick={() => {
            if (!results.length) {
              alert("No data to analyze");
              return;
            }

            const doc = new jsPDF({
              orientation: "landscape",
              unit: "mm",
              format: "a4",
            });

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            const margin = 10;
            const contentWidth = pageWidth - margin * 2;
            const generatedDate = new Date().toLocaleString();

            const safeResults = Array.isArray(results) ? results : [];
            const safeActiveSubs = Array.isArray(activeSubs) ? activeSubs : [];
            const safeGradeRanges = Array.isArray(gradeRanges)
              ? gradeRanges
              : [];

            // =========================================================
            // COLOUR SYSTEM
            // =========================================================
            const COLORS = {
              navy: [18, 45, 85],
              navyLight: [41, 72, 117],
              blue: [37, 99, 235],

              dark: [15, 23, 42],
              gray: [100, 116, 139],
              softGray: [148, 163, 184],

              white: [255, 255, 255],
              background: [248, 250, 252],
              lightGray: [241, 245, 249],
              border: [226, 232, 240],

              lightBlue: [239, 246, 255],
              blueBorder: [191, 219, 254],

              green: [22, 163, 74],
              lightGreen: [240, 253, 244],

              amber: [217, 119, 6],
              lightAmber: [255, 251, 235],

              red: [220, 38, 38],
              lightRed: [254, 242, 242],

              purple: [126, 34, 206],
              lightPurple: [250, 245, 255],
            };

            // =========================================================
            // HELPERS
            // =========================================================
            const setFill = (color) => {
              doc.setFillColor(color[0], color[1], color[2]);
            };

            const setDraw = (color) => {
              doc.setDrawColor(color[0], color[1], color[2]);
            };

            const setText = (color) => {
              doc.setTextColor(color[0], color[1], color[2]);
            };

            const safeText = (value, fallback = "-") => {
              if (value === null || value === undefined || value === "") {
                return fallback;
              }

              return String(value);
            };

            const isNumericValue = (value) => {
              return (
                value !== null &&
                value !== undefined &&
                value !== "" &&
                !Number.isNaN(parseFloat(value))
              );
            };

            const formatValue = (value, fallback = "0.00") => {
              if (!isNumericValue(value)) {
                return fallback;
              }

              return parseFloat(value).toFixed(2);
            };

            const formatPercentage = (value) => {
              if (!isNumericValue(value)) {
                return "—";
              }

              return `${parseFloat(value).toFixed(2)}%`;
            };

            const getStudentName = (student) => {
              const name =
                `${student?.first_name || ""} ${student?.last_name || ""}`.trim();

              return name || "-";
            };

            const getPerformanceColor = (value) => {
              const numericValue = parseFloat(value);

              if (Number.isNaN(numericValue)) {
                return COLORS.gray;
              }

              if (numericValue >= 75) {
                return COLORS.green;
              }

              if (numericValue >= 50) {
                return COLORS.amber;
              }

              return COLORS.red;
            };

            const fitTextToWidth = ({
              text,
              maxWidth,
              maximumFontSize,
              minimumFontSize,
            }) => {
              let fontSize = maximumFontSize;

              doc.setFont("helvetica", "bold");
              doc.setFontSize(fontSize);

              while (
                doc.getTextWidth(String(text)) > maxWidth &&
                fontSize > minimumFontSize
              ) {
                fontSize -= 0.5;
                doc.setFontSize(fontSize);
              }

              return fontSize;
            };

            const createColumnStyles = ({
              tableWidth,
              weights,
              leftAlignedIndexes = [],
            }) => {
              const totalWeight = weights.reduce(
                (sum, weight) => sum + weight,
                0,
              );

              const columnStyles = {};
              let usedWidth = 0;

              weights.forEach((weight, index) => {
                const width =
                  index === weights.length - 1
                    ? tableWidth - usedWidth
                    : (tableWidth * weight) / totalWeight;

                usedWidth += width;

                columnStyles[index] = {
                  cellWidth: width,
                  halign: leftAlignedIndexes.includes(index)
                    ? "left"
                    : "center",
                };
              });

              return columnStyles;
            };

            const formatExamDate = (value) => {
              if (!value) {
                return "-";
              }

              const parsedDate = new Date(value);

              if (Number.isNaN(parsedDate.getTime())) {
                return String(value);
              }

              return parsedDate.toLocaleDateString();
            };

            // =========================================================
            // CALCULATED VALUES
            // =========================================================
            const sortedResults = [...safeResults].sort(
              (a, b) =>
                (parseFloat(b.percentage) || 0) -
                (parseFloat(a.percentage) || 0),
            );

            const overallToppers = sortedResults
              .slice(0, 5)
              .map((student, index) => [
                index + 1,
                getStudentName(student),
                formatPercentage(student.percentage || 0),
              ]);

            const validPercentages = safeResults
              .map((student) => parseFloat(student.percentage))
              .filter((value) => !Number.isNaN(value));

            const overallAverage =
              validPercentages.length > 0
                ? (
                    validPercentages.reduce((sum, value) => sum + value, 0) /
                    validPercentages.length
                  ).toFixed(2)
                : "-";

            let bestSubject = "—";
            let bestSubjectAverage = -Infinity;

            safeActiveSubs.forEach((subject) => {
              const subjectKey = subject.toLowerCase();

              const average = parseFloat(filteredSubjectAverages?.[subjectKey]);

              if (!Number.isNaN(average) && average > bestSubjectAverage) {
                bestSubjectAverage = average;
                bestSubject = subject;
              }
            });

            const schoolName = safeText(
              school?.school_name,
              "Unknown School",
            ).toUpperCase();

            // =========================================================
            // SMALL SPECTROPY CONTAINER
            // =========================================================
            const drawSpectropyBrand = () => {
              const containerWidth = 51;
              const containerHeight = 15;

              const containerX = pageWidth - margin - containerWidth;

              const containerY = 3.5;

              const logoPanelWidth = 16;
              const logoSize = 10;

              setFill(COLORS.white);
              setDraw([190, 211, 239]);
              doc.setLineWidth(0.25);

              doc.roundedRect(
                containerX,
                containerY,
                containerWidth,
                containerHeight,
                3,
                3,
                "FD",
              );

              const dividerX = containerX + logoPanelWidth;

              setDraw([218, 226, 238]);
              doc.setLineWidth(0.25);

              doc.line(
                dividerX,
                containerY + 2.5,
                dividerX,
                containerY + containerHeight - 2.5,
              );

              const logoX = containerX + (logoPanelWidth - logoSize) / 2;

              const logoY = containerY + (containerHeight - logoSize) / 2;

              let logoLoaded = false;

              try {
                doc.addImage(
                  spectropyLogoUrl,
                  "PNG",
                  logoX,
                  logoY,
                  logoSize,
                  logoSize,
                );

                logoLoaded = true;
              } catch (error) {
                console.warn("Failed to load Spectropy logo:", error);
              }

              if (!logoLoaded) {
                setFill(COLORS.blue);

                doc.circle(
                  logoX + logoSize / 2,
                  logoY + logoSize / 2,
                  logoSize / 2,
                  "F",
                );

                setText(COLORS.white);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6);

                doc.text("S", logoX + logoSize / 2, logoY + 6.7, {
                  align: "center",
                });
              }

              const textX = dividerX + 3;

              setText([91, 121, 164]);
              doc.setFont("helvetica", "normal");
              doc.setFontSize(4.3);

              doc.text("Powered by", textX, containerY + 4.2);

              setText(COLORS.navy);
              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);

              doc.text("SPECTROPY", textX, containerY + 9.1);

              setText([113, 135, 166]);
              doc.setFont("helvetica", "normal");
              doc.setFontSize(3.6);

              doc.text("Learning Analytics", textX, containerY + 12.5);
            };

            // =========================================================
            // BACKGROUND AND HEADER
            // =========================================================
            setFill(COLORS.background);
            doc.rect(0, 0, pageWidth, pageHeight, "F");

            const headerHeight = 22;

            setFill(COLORS.navy);
            doc.rect(0, 0, pageWidth, headerHeight, "F");

            setFill(COLORS.blue);
            doc.rect(0, headerHeight - 2, pageWidth, 2, "F");

            // =========================================================
            // SCHOOL LOGO OR INITIAL
            // =========================================================
            const schoolLogoBoxX = margin;
            const schoolLogoBoxY = 3;
            const schoolLogoBoxSize = 16;

            setFill(COLORS.white);

            doc.roundedRect(
              schoolLogoBoxX,
              schoolLogoBoxY,
              schoolLogoBoxSize,
              schoolLogoBoxSize,
              2.5,
              2.5,
              "F",
            );

            let schoolLogoLoaded = false;

            if (school?.logo_url) {
              try {
                doc.addImage(
                  school.logo_url,
                  "PNG",
                  schoolLogoBoxX + 1.5,
                  schoolLogoBoxY + 1.5,
                  schoolLogoBoxSize - 3,
                  schoolLogoBoxSize - 3,
                );

                schoolLogoLoaded = true;
              } catch (error) {
                console.warn("Failed to load school logo:", error);
              }
            }

            // When the school has no logo, show only the first letter
            if (!schoolLogoLoaded) {
              setFill(COLORS.lightBlue);

              doc.circle(
                schoolLogoBoxX + schoolLogoBoxSize / 2,
                schoolLogoBoxY + schoolLogoBoxSize / 2,
                5.2,
                "F",
              );

              setText(COLORS.blue);
              doc.setFont("helvetica", "bold");
              doc.setFontSize(9);

              doc.text(
                schoolName.charAt(0) || "S",
                schoolLogoBoxX + schoolLogoBoxSize / 2,
                schoolLogoBoxY + 10.8,
                {
                  align: "center",
                },
              );
            }

            drawSpectropyBrand();

            // =========================================================
            // SCHOOL IDENTITY
            // =========================================================
            const schoolTextX = schoolLogoBoxX + schoolLogoBoxSize + 5;

            const brandX = pageWidth - margin - 51;

            const schoolTextMaxWidth = brandX - schoolTextX - 7;

            const schoolNameFontSize = fitTextToWidth({
              text: schoolName,
              maxWidth: schoolTextMaxWidth,
              maximumFontSize: 13,
              minimumFontSize: 8,
            });

            setText(COLORS.white);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(schoolNameFontSize);

            doc.text(schoolName, schoolTextX, 9);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.5);
            doc.setTextColor(219, 234, 254);

            doc.text(
              `Area: ${safeText(school?.area, "Not Set")}`,
              schoolTextX,
              15,
            );

            // =========================================================
            // TITLE AND EXAM INFORMATION
            // =========================================================
            let yPos = 29;

            setText(COLORS.dark);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);

            doc.text("IIT Foundation Exam Analysis Report", margin, yPos);

            setText(COLORS.gray);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.5);

            doc.text(`Generated: ${generatedDate}`, pageWidth - margin, yPos, {
              align: "right",
            });

            yPos += 7;

            // One compact metadata line instead of cards
            setFill(COLORS.white);
            setDraw(COLORS.border);
            doc.setLineWidth(0.25);

            doc.roundedRect(margin, yPos, contentWidth, 11, 2.5, 2.5, "FD");

            setText(COLORS.gray);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(5.7);

            doc.text("CLASS & SECTION", margin + 5, yPos + 4);

            doc.text("EXAM PATTERN", margin + 57, yPos + 4);

            doc.text("EXAM DATE", margin + 150, yPos + 4);

            doc.text("STUDENTS", margin + 205, yPos + 4);

            doc.text("OVERALL AVG.", margin + 237, yPos + 4);

            setText(COLORS.navy);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.4);

            doc.text(
              `${safeText(currentOMRExam?.class)}-${safeText(
                currentOMRExam?.section,
              )}`,
              margin + 5,
              yPos + 8.5,
            );

            doc.text(
              safeText(currentOMRExam?.exam_pattern),
              margin + 57,
              yPos + 8.5,
              {
                maxWidth: 83,
              },
            );

            doc.text(
              formatExamDate(currentOMRExam?.exam_date),
              margin + 150,
              yPos + 8.5,
            );

            doc.text(String(safeResults.length), margin + 205, yPos + 8.5);

            doc.text(
              overallAverage === "-" ? "—" : `${overallAverage}%`,
              margin + 237,
              yPos + 8.5,
            );

            yPos += 16;

            // Compact best-subject line
            setText(COLORS.gray);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.8);

            doc.text("Best Subject:", margin, yPos);

            setText(COLORS.green);
            doc.setFont("helvetica", "bold");

            doc.text(bestSubject, margin + 18, yPos);

            setText(COLORS.gray);
            doc.setFont("helvetica", "normal");

            if (bestSubjectAverage !== -Infinity) {
              doc.text(
                `(${bestSubjectAverage.toFixed(2)}%)`,
                margin + 18 + doc.getTextWidth(bestSubject) + 2,
                yPos,
              );
            }

            yPos += 5;

            // =========================================================
            // TOP AREA: SUBJECT AVERAGES + OVERALL TOPPERS
            // =========================================================
            const topGap = 5;
            const subjectAverageWidth = 82;
            const overallTopperWidth =
              contentWidth - subjectAverageWidth - topGap;

            const subjectAverageX = margin;
            const overallTopperX = margin + subjectAverageWidth + topGap;

            setText(COLORS.dark);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);

            doc.text("Subject Averages", subjectAverageX, yPos);

            doc.text("Overall Toppers", overallTopperX, yPos);

            yPos += 4;

            const topTablesStartY = yPos;

            const averageTableData = safeActiveSubs.map((subject) => {
              const subjectKey = subject.toLowerCase();

              return [
                subject,
                formatPercentage(filteredSubjectAverages?.[subjectKey]),
              ];
            });

            doc.autoTable({
              startY: topTablesStartY,

              head: [["Subject", "Average"]],

              body:
                averageTableData.length > 0
                  ? averageTableData
                  : [["No active subjects", "—"]],

              theme: "grid",
              tableWidth: subjectAverageWidth,

              margin: {
                left: subjectAverageX,
                right: pageWidth - subjectAverageX - subjectAverageWidth,
              },

              styles: {
                font: "helvetica",
                fontSize: 8.3,
                cellPadding: {
                  top: 2,
                  right: 2,
                  bottom: 2,
                  left: 2,
                },
                textColor: COLORS.dark,
                lineColor: COLORS.border,
                lineWidth: 0.2,
                valign: "middle",
                minCellHeight: 7.5,
              },

              headStyles: {
                fillColor: COLORS.navy,
                textColor: COLORS.white,
                fontStyle: "bold",
                fontSize: 8.4,
                halign: "center",
                minCellHeight: 8.5,
                lineColor: COLORS.navyLight,
              },

              columnStyles: {
                0: {
                  cellWidth: subjectAverageWidth * 0.62,
                  halign: "left",
                },
                1: {
                  cellWidth: subjectAverageWidth * 0.38,
                  halign: "center",
                },
              },

              alternateRowStyles: {
                fillColor: COLORS.background,
              },

              didParseCell: (data) => {
                if (data.section === "body" && data.column.index === 1) {
                  const numericValue = parseFloat(data.cell.raw);

                  if (!Number.isNaN(numericValue)) {
                    data.cell.styles.fontStyle = "bold";
                    data.cell.styles.textColor =
                      getPerformanceColor(numericValue);
                  }
                }
              },
            });

            const averageTableEndY = doc.lastAutoTable.finalY;

            doc.autoTable({
              startY: topTablesStartY,

              head: [["Rank", "Student Name", "Percentage"]],

              body:
                overallToppers.length > 0
                  ? overallToppers
                  : [["-", "No result records", "—"]],

              theme: "grid",
              tableWidth: overallTopperWidth,

              margin: {
                left: overallTopperX,
                right: pageWidth - overallTopperX - overallTopperWidth,
              },

              styles: {
                font: "helvetica",
                fontSize: 8.3,
                cellPadding: {
                  top: 2,
                  right: 2,
                  bottom: 2,
                  left: 2,
                },
                textColor: COLORS.dark,
                lineColor: COLORS.border,
                lineWidth: 0.2,
                valign: "middle",
                minCellHeight: 7.5,
              },

              headStyles: {
                fillColor: COLORS.green,
                textColor: COLORS.white,
                fontStyle: "bold",
                fontSize: 8.4,
                halign: "center",
                minCellHeight: 8.5,
                lineColor: COLORS.green,
              },

              columnStyles: {
                0: {
                  cellWidth: overallTopperWidth * 0.13,
                  halign: "center",
                },
                1: {
                  cellWidth: overallTopperWidth * 0.62,
                  halign: "left",
                },
                2: {
                  cellWidth: overallTopperWidth * 0.25,
                  halign: "center",
                },
              },

              alternateRowStyles: {
                fillColor: COLORS.background,
              },

              didParseCell: (data) => {
                if (data.section !== "body") {
                  return;
                }

                if (data.column.index === 0) {
                  data.cell.styles.fontStyle = "bold";

                  if (data.row.index === 0) {
                    data.cell.styles.fillColor = COLORS.lightPurple;
                    data.cell.styles.textColor = COLORS.purple;
                  } else if (data.row.index === 1) {
                    data.cell.styles.fillColor = COLORS.lightBlue;
                    data.cell.styles.textColor = COLORS.blue;
                  } else if (data.row.index === 2) {
                    data.cell.styles.fillColor = COLORS.lightAmber;
                    data.cell.styles.textColor = COLORS.amber;
                  }
                }

                if (data.column.index === 2) {
                  data.cell.styles.fontStyle = "bold";
                }
              },
            });

            const topperTableEndY = doc.lastAutoTable.finalY;

            yPos = Math.max(averageTableEndY, topperTableEndY) + 7;

            // =========================================================
            // LOWER AREA: DISTRIBUTION + SUBJECT TOPPERS
            // =========================================================
            const lowerGap = 5;
            const distributionWidth = 93;
            const subjectTopperWidth =
              contentWidth - distributionWidth - lowerGap;

            const distributionX = margin;
            const subjectTopperX = margin + distributionWidth + lowerGap;

            setText(COLORS.dark);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);

            doc.text("Performance Distribution", distributionX, yPos);

            doc.text("Subject-Wise Toppers", subjectTopperX, yPos);

            yPos += 4;

            const lowerTablesStartY = yPos;

            // =========================================================
            // PERFORMANCE DISTRIBUTION TABLE
            // =========================================================
            const gradeTableData = safeGradeRanges.map((range) => [
              range.label,

              ...safeActiveSubs.map((subject) => {
                const subjectKey = subject.toLowerCase();

                return safeText(gradeCounts?.[range.label]?.[subjectKey], "0");
              }),
            ]);

            const gradeWeights = [1.1, ...safeActiveSubs.map(() => 0.9)];

            doc.autoTable({
              startY: lowerTablesStartY,

              head: [["Range", ...safeActiveSubs]],

              body:
                gradeTableData.length > 0
                  ? gradeTableData
                  : [["No data", ...safeActiveSubs.map(() => "0")]],

              theme: "grid",
              tableWidth: distributionWidth,

              margin: {
                left: distributionX,
                right: pageWidth - distributionX - distributionWidth,
              },

              styles: {
                font: "helvetica",
                fontSize: 7.8,
                cellPadding: {
                  top: 1.8,
                  right: 1,
                  bottom: 1.8,
                  left: 1,
                },
                halign: "center",
                valign: "middle",
                textColor: COLORS.dark,
                lineColor: COLORS.border,
                lineWidth: 0.2,
                minCellHeight: 7,
              },

              headStyles: {
                fillColor: COLORS.navy,
                textColor: COLORS.white,
                fontStyle: "bold",
                fontSize: 7.9,
                halign: "center",
                minCellHeight: 8,
                lineColor: COLORS.navyLight,
              },

              alternateRowStyles: {
                fillColor: COLORS.background,
              },

              columnStyles: createColumnStyles({
                tableWidth: distributionWidth,
                weights: gradeWeights,
                leftAlignedIndexes: [0],
              }),

              didParseCell: (data) => {
                if (data.section === "body" && data.column.index === 0) {
                  data.cell.styles.fontStyle = "bold";
                  data.cell.styles.textColor = COLORS.navy;
                  data.cell.styles.fillColor = COLORS.lightBlue;
                }
              },
            });

            const distributionEndY = doc.lastAutoTable.finalY;

            // =========================================================
            // SUBJECT-WISE TOPPER TABLE
            // =========================================================
            const subjectTopperData = Array.from(
              {
                length: 5,
              },
              (_, index) => {
                const row = [index + 1];

                safeActiveSubs.forEach((subject) => {
                  const subjectKey = subject.toLowerCase();

                  const topper = topperRows?.[index]?.[subjectKey] || {
                    name: "-",
                    marks: 0,
                  };

                  row.push(topper.name || "-", safeText(topper.marks, "0"));
                });

                return row;
              },
            );

            const subjectTopperHeaders = ["Rank"];

            safeActiveSubs.forEach((subject) => {
              subjectTopperHeaders.push(subject, "Marks");
            });

            const subjectTopperWeights = [0.42];

            safeActiveSubs.forEach(() => {
              subjectTopperWeights.push(1.35, 0.57);
            });

            const subjectTopperFontSize =
              safeActiveSubs.length >= 4
                ? 6.5
                : safeActiveSubs.length === 3
                  ? 7.2
                  : 8;

            doc.autoTable({
              startY: lowerTablesStartY,

              head: [subjectTopperHeaders],
              body: subjectTopperData,

              theme: "grid",
              tableWidth: subjectTopperWidth,

              margin: {
                left: subjectTopperX,
                right: pageWidth - subjectTopperX - subjectTopperWidth,
              },

              styles: {
                font: "helvetica",
                fontSize: subjectTopperFontSize,
                cellPadding: {
                  top: 1.8,
                  right: 1,
                  bottom: 1.8,
                  left: 1,
                },
                halign: "center",
                valign: "middle",
                textColor: COLORS.dark,
                lineColor: COLORS.border,
                lineWidth: 0.2,
                overflow: "linebreak",
                minCellHeight: 7,
              },

              headStyles: {
                fillColor: COLORS.green,
                textColor: COLORS.white,
                fontStyle: "bold",
                fontSize: subjectTopperFontSize,
                halign: "center",
                minCellHeight: 8,
                lineColor: COLORS.green,
              },

              alternateRowStyles: {
                fillColor: COLORS.background,
              },

              columnStyles: createColumnStyles({
                tableWidth: subjectTopperWidth,
                weights: subjectTopperWeights,
                leftAlignedIndexes: safeActiveSubs.map(
                  (_, index) => 1 + index * 2,
                ),
              }),

              didParseCell: (data) => {
                if (data.section !== "body") {
                  return;
                }

                if (data.column.index === 0) {
                  data.cell.styles.fontStyle = "bold";

                  if (data.row.index === 0) {
                    data.cell.styles.fillColor = COLORS.lightPurple;
                    data.cell.styles.textColor = COLORS.purple;
                  } else if (data.row.index === 1) {
                    data.cell.styles.fillColor = COLORS.lightBlue;
                    data.cell.styles.textColor = COLORS.blue;
                  } else if (data.row.index === 2) {
                    data.cell.styles.fillColor = COLORS.lightAmber;
                    data.cell.styles.textColor = COLORS.amber;
                  }
                }

                if (data.column.index > 0 && data.column.index % 2 === 0) {
                  data.cell.styles.fontStyle = "bold";
                  data.cell.styles.textColor = COLORS.navy;
                }
              },
            });

            const subjectTopperEndY = doc.lastAutoTable.finalY;

            const contentEndY = Math.max(distributionEndY, subjectTopperEndY);

            // =========================================================
            // FOOTER
            // =========================================================
            const footerY = pageHeight - 7;

            setDraw(COLORS.border);
            doc.setLineWidth(0.25);

            doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

            setText(COLORS.gray);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(5.8);

            doc.text("CONFIDENTIAL ACADEMIC REPORT", margin, footerY);

            doc.setFont("helvetica", "normal");

            doc.text(
              `IIT Foundation • ${safeText(currentOMRExam?.class)}-${safeText(
                currentOMRExam?.section,
              )}`,
              pageWidth / 2,
              footerY,
              {
                align: "center",
              },
            );

            doc.setFont("helvetica", "bold");

            doc.text("Page 1 of 1", pageWidth - margin, footerY, {
              align: "right",
            });

            // =========================================================
            // SAVE
            // =========================================================
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
          <Download size={15} />
          Download Analysis PDF
        </button>
        </div>

        <section id="exam-view-results" className="exam-view-panel" aria-label="Exam Result" hidden={examResultView !== "results"}>
          <div className="exam-view-actions">
            <button
              type="button"
              className="exam-results-header-download exam-results-header-download--student"
              disabled={resultsLoading || results.length === 0}
              onClick={() => studentResultsDownloadButtonRef.current?.click()}
            >
              <Download size={15} />
              Download Student Results PDF
            </button>
          </div>
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
            Loading exam results...
          </div>
        ) : results.length > 0 ? (
          <div className="exam-results-student-results-block">
            <div
              className="exam-results-student-download-row"
              style={{
                margin: "20px 0",
                display: "none",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                className="exam-results-download-btn exam-results-download-btn--students"
                ref={studentResultsDownloadButtonRef}
                onClick={() => {
                  if (!Array.isArray(results) || results.length === 0) {
                    alert("No data to export");
                    return;
                  }

                  const doc = new jsPDF({
                    orientation: "landscape",
                    unit: "mm",
                    format: "a4",
                  });

                  const pageWidth = doc.internal.pageSize.getWidth();
                  const pageHeight = doc.internal.pageSize.getHeight();

                  const margin = 10;
                  const printableWidth = pageWidth - margin * 2;
                  const generatedDate = new Date().toLocaleString();
                  const totalPagesExpression = "{total_pages_count_string}";

                  // =========================================================
                  // DESIGN SYSTEM
                  // =========================================================
                  const COLORS = {
                    navy: [18, 45, 85],
                    navyLight: [42, 72, 117],
                    blue: [37, 99, 235],

                    dark: [15, 23, 42],
                    gray: [100, 116, 139],
                    softGray: [148, 163, 184],

                    white: [255, 255, 255],
                    background: [248, 250, 252],
                    lightGray: [241, 245, 249],
                    border: [226, 232, 240],

                    lightBlue: [239, 246, 255],
                    blueBorder: [191, 219, 254],

                    green: [22, 163, 74],
                    lightGreen: [240, 253, 244],

                    amber: [217, 119, 6],
                    lightAmber: [255, 251, 235],

                    red: [220, 38, 38],
                    lightRed: [254, 242, 242],

                    purple: [126, 34, 206],
                    lightPurple: [250, 245, 255],
                  };

                  // =========================================================
                  // HELPERS
                  // =========================================================
                  const setFill = (color) => {
                    doc.setFillColor(color[0], color[1], color[2]);
                  };

                  const setDraw = (color) => {
                    doc.setDrawColor(color[0], color[1], color[2]);
                  };

                  const setText = (color) => {
                    doc.setTextColor(color[0], color[1], color[2]);
                  };

                  const safeText = (value, fallback = "-") => {
                    if (value === null || value === undefined || value === "") {
                      return fallback;
                    }

                    return String(value);
                  };

                  const isNumericValue = (value) => {
                    return (
                      value !== null &&
                      value !== undefined &&
                      value !== "" &&
                      !Number.isNaN(parseFloat(value))
                    );
                  };

                  const formatNumber = (value, fallback = "0") => {
                    if (!isNumericValue(value)) {
                      return fallback;
                    }

                    return String(value);
                  };

                  const formatPercentage = (value) => {
                    if (!isNumericValue(value)) {
                      return "0.00%";
                    }

                    return `${parseFloat(value).toFixed(2)}%`;
                  };

                  const formatExamDate = (value) => {
                    if (!value) {
                      return "-";
                    }

                    const parsedDate = new Date(value);

                    if (Number.isNaN(parsedDate.getTime())) {
                      return String(value);
                    }

                    return parsedDate.toLocaleDateString();
                  };

                  const getStudentName = (student) => {
                    const fullName =
                      `${student?.first_name || ""} ${student?.last_name || ""}`.trim();

                    return fullName || "-";
                  };

                  const fitTextToWidth = ({
                    text,
                    maxWidth,
                    maximumFontSize,
                    minimumFontSize,
                    fontStyle = "bold",
                  }) => {
                    let fontSize = maximumFontSize;

                    doc.setFont("helvetica", fontStyle);
                    doc.setFontSize(fontSize);

                    while (
                      doc.getTextWidth(String(text)) > maxWidth &&
                      fontSize > minimumFontSize
                    ) {
                      fontSize -= 0.5;
                      doc.setFontSize(fontSize);
                    }

                    return fontSize;
                  };

                  const getPerformanceColor = (value) => {
                    const percentage = parseFloat(value);

                    if (Number.isNaN(percentage)) {
                      return COLORS.gray;
                    }

                    if (percentage >= 75) {
                      return COLORS.green;
                    }

                    if (percentage >= 50) {
                      return COLORS.amber;
                    }

                    return COLORS.red;
                  };

                  const schoolName = safeText(
                    school?.school_name,
                    "Unknown School",
                  ).toUpperCase();

                  const schoolInitial =
                    schoolName && schoolName !== "UNKNOWN SCHOOL"
                      ? schoolName.charAt(0)
                      : "S";

                  // =========================================================
                  // RESULT CALCULATIONS
                  // =========================================================
                  const sortedResults = [...results].sort(
                    (a, b) =>
                      (parseFloat(b.percentage) || 0) -
                      (parseFloat(a.percentage) || 0),
                  );

                  const highestPercentage =
                    sortedResults.length > 0
                      ? parseFloat(sortedResults[0]?.percentage) || 0
                      : 0;

                  // =========================================================
                  // SMALL POWERED BY SPECTROPY CONTAINER
                  // =========================================================
                  const drawSpectropyBrand = ({
                    rightX = pageWidth - margin,
                    centerY = 12,
                    compact = false,
                  } = {}) => {
                    const containerWidth = compact ? 46 : 52;
                    const containerHeight = compact ? 11 : 15;

                    const containerX = rightX - containerWidth;
                    const containerY = centerY - containerHeight / 2;

                    const logoPanelWidth = compact ? 13 : 16;
                    const logoSize = compact ? 7 : 10;

                    // White container
                    setFill(COLORS.white);
                    setDraw([190, 211, 239]);
                    doc.setLineWidth(0.25);

                    doc.roundedRect(
                      containerX,
                      containerY,
                      containerWidth,
                      containerHeight,
                      compact ? 2 : 2.8,
                      compact ? 2 : 2.8,
                      "FD",
                    );

                    // Divider
                    const dividerX = containerX + logoPanelWidth;

                    setDraw([218, 226, 238]);
                    doc.setLineWidth(0.25);

                    doc.line(
                      dividerX,
                      containerY + 2,
                      dividerX,
                      containerY + containerHeight - 2,
                    );

                    // Spectropy logo
                    const logoX = containerX + (logoPanelWidth - logoSize) / 2;

                    const logoY = containerY + (containerHeight - logoSize) / 2;

                    let spectropyLogoLoaded = false;

                    try {
                      doc.addImage(
                        spectropyLogoUrl,
                        "PNG",
                        logoX,
                        logoY,
                        logoSize,
                        logoSize,
                      );

                      spectropyLogoLoaded = true;
                    } catch (error) {
                      console.warn("Failed to load Spectropy logo:", error);
                    }

                    if (!spectropyLogoLoaded) {
                      setFill(COLORS.blue);

                      doc.circle(
                        logoX + logoSize / 2,
                        logoY + logoSize / 2,
                        logoSize / 2,
                        "F",
                      );

                      setText(COLORS.white);
                      doc.setFont("helvetica", "bold");
                      doc.setFontSize(compact ? 4.8 : 6);

                      doc.text(
                        "S",
                        logoX + logoSize / 2,
                        logoY + logoSize * 0.68,
                        {
                          align: "center",
                        },
                      );
                    }

                    const textX = dividerX + (compact ? 2.5 : 3);

                    // Powered by
                    setText([91, 121, 164]);
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(compact ? 3.3 : 4.2);

                    doc.text(
                      "Powered by",
                      textX,
                      containerY + (compact ? 3.5 : 4.2),
                    );

                    // Spectropy
                    setText(COLORS.navy);
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(compact ? 6.2 : 7.4);

                    doc.text(
                      "SPECTROPY",
                      textX,
                      containerY + (compact ? 7.2 : 9),
                    );

                    // Tagline
                    setText([113, 135, 166]);
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(compact ? 2.8 : 3.4);

                    doc.text(
                      "Learning Analytics",
                      textX,
                      containerY + (compact ? 9.5 : 12.2),
                    );
                  };

                  // =========================================================
                  // MAIN HEADER
                  // =========================================================
                  const drawMainHeader = () => {
                    setFill(COLORS.background);
                    doc.rect(0, 0, pageWidth, pageHeight, "F");

                    const headerHeight = 24;

                    setFill(COLORS.navy);
                    doc.rect(0, 0, pageWidth, headerHeight, "F");

                    setFill(COLORS.blue);
                    doc.rect(0, headerHeight - 2, pageWidth, 2, "F");

                    // School logo or initial
                    const schoolLogoBoxX = margin;
                    const schoolLogoBoxY = 3.5;
                    const schoolLogoBoxSize = 17;

                    setFill(COLORS.white);

                    doc.roundedRect(
                      schoolLogoBoxX,
                      schoolLogoBoxY,
                      schoolLogoBoxSize,
                      schoolLogoBoxSize,
                      2.5,
                      2.5,
                      "F",
                    );

                    let schoolLogoLoaded = false;

                    if (school?.logo_url) {
                      try {
                        doc.addImage(
                          school.logo_url,
                          "PNG",
                          schoolLogoBoxX + 1.5,
                          schoolLogoBoxY + 1.5,
                          schoolLogoBoxSize - 3,
                          schoolLogoBoxSize - 3,
                        );

                        schoolLogoLoaded = true;
                      } catch (error) {
                        console.warn("Failed to load school logo:", error);
                      }
                    }

                    // Show school initial when logo is missing or fails
                    if (!schoolLogoLoaded) {
                      setFill(COLORS.lightBlue);

                      doc.circle(
                        schoolLogoBoxX + schoolLogoBoxSize / 2,
                        schoolLogoBoxY + schoolLogoBoxSize / 2,
                        5.5,
                        "F",
                      );

                      setText(COLORS.blue);
                      doc.setFont("helvetica", "bold");
                      doc.setFontSize(9);

                      doc.text(
                        schoolInitial,
                        schoolLogoBoxX + schoolLogoBoxSize / 2,
                        schoolLogoBoxY + 11.2,
                        {
                          align: "center",
                        },
                      );
                    }

                    // Small Spectropy container
                    drawSpectropyBrand({
                      rightX: pageWidth - margin,
                      centerY: headerHeight / 2,
                    });

                    const schoolTextX = schoolLogoBoxX + schoolLogoBoxSize + 5;

                    const brandContainerX = pageWidth - margin - 52;

                    const schoolTextMaxWidth =
                      brandContainerX - schoolTextX - 7;

                    const schoolNameFontSize = fitTextToWidth({
                      text: schoolName,
                      maxWidth: schoolTextMaxWidth,
                      maximumFontSize: 13.5,
                      minimumFontSize: 8,
                      fontStyle: "bold",
                    });

                    setText(COLORS.white);
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(schoolNameFontSize);

                    doc.text(schoolName, schoolTextX, 10);

                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(6.8);
                    doc.setTextColor(219, 234, 254);

                    doc.text(
                      `Area: ${safeText(school?.area, "Not Set")}`,
                      schoolTextX,
                      16,
                    );
                  };

                  // =========================================================
                  // CONTINUATION-PAGE HEADER
                  // =========================================================
                  const drawContinuationHeader = () => {
                    setFill(COLORS.background);
                    doc.rect(0, 0, pageWidth, pageHeight, "F");

                    setFill(COLORS.navy);
                    doc.rect(0, 0, pageWidth, 15, "F");

                    setFill(COLORS.blue);
                    doc.rect(0, 13.5, pageWidth, 1.5, "F");

                    setText(COLORS.white);
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(7.5);

                    doc.text(
                      `${schoolName} — IIT Foundation Exam Results`,
                      margin,
                      8.8,
                      {
                        maxWidth: pageWidth - 75,
                      },
                    );

                    drawSpectropyBrand({
                      rightX: pageWidth - margin,
                      centerY: 7.5,
                      compact: true,
                    });
                  };

                  // =========================================================
                  // FIRST PAGE CONTENT
                  // =========================================================
                  drawMainHeader();

                  let yPos = 31;

                  // Report title
                  setText(COLORS.blue);
                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(6.5);

                  doc.text("IIT FOUNDATION", margin, yPos);

                  yPos += 5;

                  setText(COLORS.dark);
                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(15);

                  doc.text("Exam Result Report", margin, yPos);

                  setText(COLORS.gray);
                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(6.5);

                  doc.text(
                    `Generated: ${generatedDate}`,
                    pageWidth - margin,
                    yPos,
                    {
                      align: "right",
                    },
                  );

                  yPos += 7;

                  // =========================================================
                  // COMPACT EXAM INFORMATION STRIP
                  // =========================================================
                  setFill(COLORS.white);
                  setDraw(COLORS.border);
                  doc.setLineWidth(0.25);

                  doc.roundedRect(
                    margin,
                    yPos,
                    printableWidth,
                    11,
                    2.5,
                    2.5,
                    "FD",
                  );

                  const infoColumns = [
                    {
                      label: "CLASS & SECTION",
                      value: `${safeText(currentOMRExam?.class)}-${safeText(
                        currentOMRExam?.section,
                      )}`,
                      x: margin + 5,
                      width: 42,
                    },
                    {
                      label: "EXAM PATTERN",
                      value: safeText(currentOMRExam?.exam_pattern),
                      x: margin + 54,
                      width: 92,
                    },
                    {
                      label: "EXAM DATE",
                      value: formatExamDate(currentOMRExam?.exam_date),
                      x: margin + 153,
                      width: 43,
                    },
                    {
                      label: "STUDENTS",
                      value: String(sortedResults.length),
                      x: margin + 205,
                      width: 30,
                    },
                    {
                      label: "HIGHEST SCORE",
                      value: `${highestPercentage.toFixed(2)}%`,
                      x: margin + 240,
                      width: 35,
                    },
                  ];

                  infoColumns.forEach((item) => {
                    setText(COLORS.gray);
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(5.2);

                    doc.text(item.label, item.x, yPos + 4);

                    const infoValueFontSize = fitTextToWidth({
                      text: item.value,
                      maxWidth: item.width,
                      maximumFontSize: 7.5,
                      minimumFontSize: 5.5,
                      fontStyle: "bold",
                    });

                    setText(COLORS.navy);
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(infoValueFontSize);

                    doc.text(item.value, item.x, yPos + 8.5, {
                      maxWidth: item.width,
                    });
                  });

                  yPos += 15;

                  // =========================================================
                  // TABLE DATA
                  // =========================================================
                  const headers = [
                    "Student ID",
                    "Student Name",
                    "Total Qs",
                    "Correct",
                    "Wrong",
                    "Unattempted",
                    "Physics",
                    "Chemistry",
                    "Maths",
                    "Biology",
                    "Total Marks",
                    "Score %",
                    "Class Rank",
                    "School Rank",
                    "All India Rank",
                  ];

                  const body = sortedResults.map((result) => [
                    safeText(result.student_id),

                    getStudentName(result),

                    formatNumber(result.total_questions),

                    formatNumber(result.correct_answers),

                    formatNumber(result.wrong_answers),

                    formatNumber(result.unattempted),

                    formatNumber(result.physics_marks),

                    formatNumber(result.chemistry_marks),

                    formatNumber(result.maths_marks),

                    formatNumber(result.biology_marks),

                    formatNumber(result.total_marks),

                    formatPercentage(result.percentage),

                    result.class_rank ?? "-",

                    result.school_rank ?? "-",

                    result.all_schools_rank ?? "-",
                  ]);

                  // =========================================================
                  // FULL-WIDTH COLUMN SIZING
                  // =========================================================
                  const columnWeights = [
                    1.05, // Student ID
                    1.85, // Student Name
                    0.72, // Total Questions
                    0.72, // Correct
                    0.68, // Wrong
                    0.88, // Unattempted
                    0.78, // Physics
                    0.85, // Chemistry
                    0.74, // Maths
                    0.75, // Biology
                    0.9, // Total Marks
                    0.78, // Percentage
                    0.82, // Class Rank
                    0.86, // School Rank
                    0.92, // All India Rank
                  ];

                  const totalColumnWeight = columnWeights.reduce(
                    (sum, weight) => sum + weight,
                    0,
                  );

                  const calculatedWidths = columnWeights.map(
                    (weight) => (printableWidth * weight) / totalColumnWeight,
                  );

                  const widthDifference =
                    printableWidth -
                    calculatedWidths.reduce((sum, width) => sum + width, 0);

                  calculatedWidths[calculatedWidths.length - 1] +=
                    widthDifference;

                  const columnStyles = {};

                  calculatedWidths.forEach((width, index) => {
                    columnStyles[index] = {
                      cellWidth: width,
                      halign: index === 0 || index === 1 ? "left" : "center",
                    };
                  });

                  const percentageColumnIndex = 11;
                  const classRankColumnIndex = 12;
                  const schoolRankColumnIndex = 13;
                  const allIndiaRankColumnIndex = 14;

                  /*
                   * Keep table text larger for normal class sizes.
                   * Reduce it slightly only when many rows are present.
                   */
                  const tableFontSize =
                    sortedResults.length <= 20
                      ? 7.6
                      : sortedResults.length <= 35
                        ? 7.1
                        : 6.7;

                  const headerFontSize = sortedResults.length <= 25 ? 7 : 6.6;

                  // =========================================================
                  // FULL-WIDTH RESULTS TABLE
                  // =========================================================
                  doc.autoTable({
                    startY: yPos,

                    head: [headers],
                    body,

                    theme: "grid",
                    tableWidth: printableWidth,

                    margin: {
                      left: margin,
                      right: margin,
                      top: 20,
                      bottom: 16,
                    },

                    styles: {
                      font: "helvetica",
                      fontSize: tableFontSize,
                      textColor: COLORS.dark,
                      lineColor: COLORS.border,
                      lineWidth: 0.2,

                      cellPadding: {
                        top: 1.8,
                        right: 1,
                        bottom: 1.8,
                        left: 1,
                      },

                      halign: "center",
                      valign: "middle",
                      overflow: "linebreak",
                      minCellHeight: 7,
                    },

                    headStyles: {
                      fillColor: COLORS.navy,
                      textColor: COLORS.white,
                      fontStyle: "bold",
                      fontSize: headerFontSize,
                      halign: "center",
                      valign: "middle",
                      minCellHeight: 9,
                      lineColor: COLORS.navyLight,
                      lineWidth: 0.25,
                    },

                    bodyStyles: {
                      fillColor: COLORS.white,
                    },

                    alternateRowStyles: {
                      fillColor: COLORS.background,
                    },

                    columnStyles,

                    showHead: "everyPage",
                    rowPageBreak: "avoid",

                    willDrawPage: () => {
                      const currentPageNumber =
                        doc.internal.getCurrentPageInfo().pageNumber;

                      if (currentPageNumber > 1) {
                        drawContinuationHeader();
                      }
                    },

                    didParseCell: (data) => {
                      if (data.section !== "body") {
                        return;
                      }

                      // Student name emphasis
                      if (data.column.index === 1) {
                        data.cell.styles.fontStyle = "bold";
                      }

                      // Correct answers
                      if (data.column.index === 3) {
                        data.cell.styles.textColor = COLORS.green;
                        data.cell.styles.fontStyle = "bold";
                      }

                      // Wrong answers
                      if (data.column.index === 4) {
                        data.cell.styles.textColor = COLORS.red;
                        data.cell.styles.fontStyle = "bold";
                      }

                      // Unattempted
                      if (data.column.index === 5) {
                        data.cell.styles.textColor = COLORS.amber;
                      }

                      // Percentage column
                      if (data.column.index === percentageColumnIndex) {
                        const percentage = parseFloat(data.cell.raw);

                        data.cell.styles.fontStyle = "bold";
                        data.cell.styles.textColor =
                          getPerformanceColor(percentage);

                        data.cell.styles.fillColor = COLORS.lightBlue;

                        data.cell.styles.lineColor = COLORS.blueBorder;

                        data.cell.styles.lineWidth = 0.3;
                      }

                      // Rank columns
                      if (
                        data.column.index === classRankColumnIndex ||
                        data.column.index === schoolRankColumnIndex ||
                        data.column.index === allIndiaRankColumnIndex
                      ) {
                        const rank = parseFloat(data.cell.raw);

                        if (!Number.isNaN(rank) && rank > 0 && rank <= 3) {
                          data.cell.styles.fontStyle = "bold";
                          data.cell.styles.textColor = COLORS.purple;
                          data.cell.styles.fillColor = COLORS.lightPurple;
                        }
                      }
                    },

                    didDrawPage: () => {
                      const currentPageNumber =
                        doc.internal.getCurrentPageInfo().pageNumber;

                      // Footer separator
                      setDraw(COLORS.border);
                      doc.setLineWidth(0.25);

                      doc.line(
                        margin,
                        pageHeight - 12,
                        pageWidth - margin,
                        pageHeight - 12,
                      );

                      setText(COLORS.gray);
                      doc.setFont("helvetica", "bold");
                      doc.setFontSize(5.8);

                      doc.text(
                        "CONFIDENTIAL ACADEMIC REPORT",
                        margin,
                        pageHeight - 7,
                      );

                      doc.setFont("helvetica", "normal");

                      doc.text(
                        `IIT Foundation • ${safeText(
                          currentOMRExam?.class,
                        )}-${safeText(currentOMRExam?.section)}`,
                        pageWidth / 2,
                        pageHeight - 7,
                        {
                          align: "center",
                        },
                      );

                      doc.setFont("helvetica", "bold");

                      doc.text(
                        `Page ${currentPageNumber} of ${totalPagesExpression}`,
                        pageWidth - margin,
                        pageHeight - 7,
                        {
                          align: "right",
                        },
                      );
                    },
                  });

                  // =========================================================
                  // TOTAL PAGE NUMBERS
                  // =========================================================
                  if (typeof doc.putTotalPages === "function") {
                    doc.putTotalPages(totalPagesExpression);
                  }

                  // =========================================================
                  // DOWNLOAD
                  // =========================================================
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
                <Download size={15} />
                Download Student Results PDF
              </button>
            </div>
            <div
              className="exam-results-student-table-wrap"
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                overflowX: "auto",
                background: "#ffffff",
              }}
            >
              <table
                className="exam-results-student-table"
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
          </div>
        ) : (
          <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
            📭 No results available.
          </div>
        )}
        </section>

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
      <div className="studentwise-page">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2>
            <GraduationCap size={22} /> Student Wise Performance
          </h2>
        </div>

        <div className="studentwise-form-panel">
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
            <Search size={18} />
            View Student Dashboard
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
      <div className="teacherwise-page">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2>
            <UserRoundCog size={22} /> Teacher Wise Performance
          </h2>
        </div>

        <div className="teacherwise-form-panel">
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
            <Search size={18} />
            View Teacher Dashboard
          </button>
        </div>
      </div>
    );
  };

  const renderSubjectBloomAnalyticsView = () => {
    if (!currentOMRExam) {
      setView("examwise-results");
      return null;
    }

    const results = examResults[currentOMRExam.id] || [];
    const activeSubs = getActiveSubjects(
      getGroupByClassSection(currentOMRExam.class, currentOMRExam.section),
    );
    const parseQuestionResults = (value) => {
      if (!value) return {};
      if (typeof value === "string") {
        try {
          return JSON.parse(value) || {};
        } catch {
          return {};
        }
      }
      return typeof value === "object" ? value : {};
    };
    const getQuestionNumber = (question) =>
      Number(String(question || "").match(/\d+/)?.[0] || 0);
    const normalizeBloomSkill = (value) => {
      const normalized = String(value || "")
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (["remember", "remembering"].includes(normalized)) return "Remember";
      if (["understand", "understanding"].includes(normalized)) return "Understand";
      if (["apply", "applying"].includes(normalized)) return "Apply";
      if (["analyse", "analysis", "analyze", "analysing", "analyzing"].includes(normalized)) {
        return "Analyse";
      }
      if (["evaluate", "evaluating"].includes(normalized)) return "Evaluate";
      if (["create", "creating"].includes(normalized)) return "Create";
      return "";
    };
    const getQuestionResponseStatus = (details = {}) => {
      const status = String(details?.status || "").toLowerCase();
      const option = details?.option ?? details?.options ?? "";
      const marks = Number(details?.marks);

      if (status.includes("incorrect")) return "incorrect";
      if (status.includes("correct")) return "correct";
      if (status.includes("not") || status.includes("unattempted") || !option) {
        return "unattempted";
      }
      if (Number.isFinite(marks) && marks > 0) return "correct";
      if (option) return "incorrect";
      return "unattempted";
    };
    const uniqueQuestionNumbers = new Set();
    results.forEach((studentResult) => {
      Object.keys(parseQuestionResults(studentResult.question_results)).forEach(
        (question) => {
          const questionNumber = getQuestionNumber(question);
          if (questionNumber) uniqueQuestionNumbers.add(questionNumber);
        },
      );
    });
    const totalQuestionCountForMapping = Math.max(
      ...Array.from(uniqueQuestionNumbers),
      uniqueQuestionNumbers.size,
      0,
    );
    const normalizeSubjectName = (value) => {
      const normalized = String(value || "")
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (normalized.includes("math")) return "Maths";
      if (normalized.includes("physics")) return "Physics";
      if (normalized.includes("chemistry")) return "Chemistry";
      if (normalized.includes("biology")) return "Biology";
      return "";
    };
    const getQuestionSubject = (question, details = {}) => {
      const storedSubject = details?.subject || details?.Subject;
      const normalizedStoredSubject = normalizeSubjectName(storedSubject);
      if (normalizedStoredSubject) return normalizedStoredSubject;

      const questionNumber = getQuestionNumber(question);
      if (!questionNumber || !activeSubs.length) return "General";

      const questionsPerSubject = Math.max(
        1,
        Math.ceil((totalQuestionCountForMapping || questionNumber) / activeSubs.length),
      );
      const subjectIndex = Math.min(
        activeSubs.length - 1,
        Math.floor((questionNumber - 1) / questionsPerSubject),
      );

      return activeSubs[subjectIndex] || "General";
    };
    const subjectCardMeta = {
      Maths: {
        title: "Mathematics",
        Icon: Calculator,
        iconColor: "#1681ff",
        accent: "#2f8cff",
        bg: "linear-gradient(135deg, #eaf4ff 0%, #f7fbff 100%)",
      },
      Physics: {
        title: "Physics",
        Icon: Activity,
        iconColor: "#8f6df6",
        accent: "#2f8cff",
        bg: "linear-gradient(135deg, #f0eaff 0%, #fbf9ff 100%)",
      },
      Chemistry: {
        title: "Chemistry",
        Icon: FlaskConical,
        iconColor: "#10a878",
        accent: "#34c99a",
        bg: "linear-gradient(135deg, #eafbf6 0%, #f7fffc 100%)",
      },
      Biology: {
        title: "Biology",
        Icon: Leaf,
        iconColor: "#fb5b7b",
        accent: "#34c99a",
        bg: "linear-gradient(135deg, #fff0f5 0%, #fff9fb 100%)",
      },
    };
    const subjectTotals = activeSubs.reduce((acc, subject) => {
      acc[subject] = {
        subject,
        correct: 0,
        total: 0,
        lotsCorrect: 0,
        lotsTotal: 0,
        hotsCorrect: 0,
        hotsTotal: 0,
        questionKeys: new Set(),
        skills: {
          Remember: { correct: 0, total: 0 },
          Understand: { correct: 0, total: 0 },
          Apply: { correct: 0, total: 0 },
          Analyse: { correct: 0, total: 0 },
          Evaluate: { correct: 0, total: 0 },
          Create: { correct: 0, total: 0 },
        },
      };
      return acc;
    }, {});

    results.forEach((studentResult) => {
      const questions = parseQuestionResults(studentResult.question_results);
      Object.entries(questions).forEach(([question, details]) => {
        const skill = normalizeBloomSkill(
          details?.blooms_skill ||
            details?.bloomsSkill ||
            details?.["Blooms Skill"] ||
            details?.["Bloom's Skill"],
        );
        if (!skill) return;

        const subject = getQuestionSubject(question, details);
        if (!subjectTotals[subject]) return;

        const responseStatus = getQuestionResponseStatus(details);
        const isCorrect = responseStatus === "correct";
        const subjectTotal = subjectTotals[subject];
        subjectTotal.total += 1;
        subjectTotal.questionKeys.add(String(question || "").trim());
        if (isCorrect) subjectTotal.correct += 1;
        subjectTotal.skills[skill].total += 1;
        if (isCorrect) subjectTotal.skills[skill].correct += 1;

        if (["Remember", "Understand"].includes(skill)) {
          subjectTotal.lotsTotal += 1;
          if (isCorrect) subjectTotal.lotsCorrect += 1;
        } else if (["Apply", "Analyse", "Evaluate", "Create"].includes(skill)) {
          subjectTotal.hotsTotal += 1;
          if (isCorrect) subjectTotal.hotsCorrect += 1;
        }
      });
    });

    const toPercent = (correct, total) =>
      total > 0 ? Math.round((correct / total) * 100) : 0;
    const subjectBloomCards = activeSubs.map((subject) => {
      const totals = subjectTotals[subject];
      const meta = subjectCardMeta[subject] || {
        title: subject,
        Icon: BookOpen,
        iconColor: "#1681ff",
        accent: "#2f8cff",
        bg: "linear-gradient(135deg, #eef6ff 0%, #f7fbff 100%)",
      };

      return {
        ...meta,
        subject,
        mastery: toPercent(totals.correct, totals.total),
        lots: toPercent(totals.lotsCorrect, totals.lotsTotal),
        hots: toPercent(totals.hotsCorrect, totals.hotsTotal),
        questions: totals.questionKeys.size,
      };
    });
    const subjectBloomSkillColors = {
      Remember: "#2f8cff",
      Understand: "#34c99a",
      Apply: "#ffc83d",
      Analyse: "#ff8a45",
      Evaluate: "#ff5f7d",
      Create: "#8f6df6",
    };
    const subjectBloomSkillPerformance = activeSubs.map((subject) => {
      const totals = subjectTotals[subject];
      return {
        subject,
        label: subject === "Maths" ? "Mathematics" : subject,
        skills: Object.entries(totals.skills).map(([skill, values]) => ({
          skill,
          percentage: toPercent(values.correct, values.total),
          color: subjectBloomSkillColors[skill],
        })),
      };
    });
    const subjectSkillChart = {
      width: 690,
      height: 285,
      padding: { top: 18, right: 10, bottom: 58, left: 56 },
    };
    subjectSkillChart.plotWidth =
      subjectSkillChart.width -
      subjectSkillChart.padding.left -
      subjectSkillChart.padding.right;
    subjectSkillChart.plotHeight =
      subjectSkillChart.height -
      subjectSkillChart.padding.top -
      subjectSkillChart.padding.bottom;
    subjectSkillChart.groupWidth =
      subjectSkillChart.plotWidth /
      Math.max(subjectBloomSkillPerformance.length, 1);
    subjectSkillChart.barWidth = Math.min(
      20,
      Math.max(12, subjectSkillChart.groupWidth / 9),
    );
    subjectSkillChart.yForValue = (value) =>
      subjectSkillChart.padding.top +
      subjectSkillChart.plotHeight -
      (value / 100) * subjectSkillChart.plotHeight;
    const getHeatmapCellColor = (value) => {
      if (value >= 80) return "#34c99a";
      if (value >= 60) return "#d6df4d";
      if (value >= 40) return "#ff9852";
      return "#ff6f8d";
    };
    const heatmapLegend = [
      { label: ">= 80% (Strong)", color: "#34c99a" },
      { label: "60-79% (Developing)", color: "#d6df4d" },
      { label: "40-59% (Needs Support)", color: "#ff9852" },
      { label: "< 40% (Critical)", color: "#ff6f8d" },
    ];
    const subjectHotsLotsDistribution = activeSubs.map((subject) => {
      const totals = subjectTotals[subject];
      const correctTotal = totals.lotsCorrect + totals.hotsCorrect;
      const lots = correctTotal > 0
        ? Math.round((totals.lotsCorrect / correctTotal) * 100)
        : 0;

      return {
        subject,
        label: subject === "Maths" ? "Mathematics" : subject,
        lots,
        hots: correctTotal > 0 ? 100 - lots : 0,
      };
    });
    const formatSkillList = (skills) => {
      if (skills.length <= 1) return skills[0] || "";
      if (skills.length === 2) return `${skills[0]} and ${skills[1]}`;
      return `${skills.slice(0, -1).join(", ")} and ${skills[skills.length - 1]}`;
    };
    const subjectStrengthGapInsights = subjectBloomSkillPerformance.map((subjectGroup) => {
      const availableSkills = subjectGroup.skills.filter(
        (item) => subjectTotals[subjectGroup.subject]?.skills?.[item.skill]?.total > 0,
      );
      const rankedStrongSkills = [...availableSkills].sort(
        (first, second) => second.percentage - first.percentage,
      );
      const rankedGapSkills = [...availableSkills].sort(
        (first, second) => first.percentage - second.percentage,
      );
      const strengthSkills = rankedStrongSkills.slice(0, 2).map((item) => item.skill);
      const gapSkills = rankedGapSkills
        .filter((item) => item.percentage < 60)
        .slice(0, 2)
        .map((item) => item.skill);

      return {
        subject: subjectGroup.subject,
        label: subjectGroup.label,
        meta: subjectCardMeta[subjectGroup.subject],
        strengthText: strengthSkills.length
          ? `Strong in ${formatSkillList(strengthSkills)}`
          : "No Bloom skill strength available",
        gapText: gapSkills.length
          ? `Needs focus on ${formatSkillList(gapSkills)}`
          : "Consistent performance",
      };
    });

    return (
      <div className="exam-results-page subject-bloom-page">
        <div
          className="subject-bloom-header"
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
            <h2
              style={{
                margin: 0,
                color: "#0b1f5c",
                fontSize: "24px",
                lineHeight: 1.15,
                fontWeight: "900",
              }}
            >
              Subject-wise Bloom&apos;s Taxonomy Analytics
            </h2>
            <div
              style={{
                marginTop: "6px",
                color: "#42639b",
                fontSize: "14px",
              }}
            >
              Compare cognitive performance across subjects
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <button
              className="page-back-nav exam-results-back"
              onClick={() => setView("examwise-results")}
            >
              Back to Exam Result
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))",
            gap: "12px",
          }}
        >
          {subjectBloomCards.map((card) => {
            const Icon = card.Icon;

            return (
              <div
                key={card.subject}
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  background: card.bg,
                  boxShadow: "0 8px 22px rgba(15, 47, 99, 0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "8px",
                      display: "grid",
                      placeItems: "center",
                      background: card.iconColor,
                      color: "#ffffff",
                    }}
                  >
                    <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <h3
                    style={{
                      margin: 0,
                      color: card.iconColor,
                      fontSize: "16px",
                      fontWeight: "900",
                    }}
                  >
                    {card.title}
                  </h3>
                </div>
                <div
                  style={{
                    padding: "8px",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.75)",
                  }}
                >
                  <div
                    style={{
                      color: "#0b1f5c",
                      fontSize: "12px",
                      fontWeight: "700",
                    }}
                  >
                    Cognitive Mastery
                  </div>
                  <div
                    style={{
                      color: "#061a4f",
                      fontSize: "21px",
                      fontWeight: "900",
                      lineHeight: 1,
                      margin: "3px 0 7px",
                    }}
                  >
                    {card.mastery}%
                  </div>
                  <div
                    style={{
                      height: "8px",
                      borderRadius: "999px",
                      background: "#d8e1ef",
                      overflow: "hidden",
                      marginBottom: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: `${card.mastery}%`,
                        height: "100%",
                        borderRadius: "999px",
                        background: card.accent,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                      color: "#0b1f5c",
                      fontSize: "13px",
                      fontWeight: "900",
                      marginBottom: "10px",
                    }}
                  >
                    <span>LOTS</span>
                    <span style={{ color: "#10a878" }}>{card.lots}%</span>
                    <span style={{ color: "#94a3b8" }}>|</span>
                    <span>HOTS</span>
                    <span style={{ color: "#e11d48" }}>{card.hots}%</span>
                  </div>
                  <div
                    style={{
                      color: "#0b1f5c",
                      fontSize: "12px",
                      fontWeight: "700",
                    }}
                  >
                    Questions <span style={{ marginLeft: "14px" }}>{card.questions}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div
          className="subject-bloom-panels"
          style={{
            display: "grid",
            gap: "14px",
            marginTop: "14px",
          }}
        >
        <div
          className="subject-bloom-performance-card"
          style={{
            padding: "12px",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            boxShadow: "0 8px 22px rgba(15, 47, 99, 0.05)",
            minWidth: 0,
          }}
        >
          <h3
            style={{
              margin: "0 0 14px",
              color: "#0b1f5c",
              fontSize: "15px",
              fontWeight: "900",
            }}
          >
            Subject-wise Performance by Bloom&apos;s Skill
          </h3>
          <div className="subject-bloom-scroll" tabIndex={0} role="region" aria-label="Subject performance chart, scroll horizontally to see all subjects">
            <svg
              width="100%"
              height="285"
              viewBox={`0 0 ${subjectSkillChart.width} ${subjectSkillChart.height}`}
              role="img"
              aria-label="Subject-wise performance by Bloom skill"
              className="subject-bloom-performance-chart"
            >
              {[100, 80, 60, 40, 20, 0].map((value) => {
                const y = subjectSkillChart.yForValue(value);
                return (
                  <g key={`subject-skill-grid-${value}`}>
                    <line
                      x1={subjectSkillChart.padding.left}
                      y1={y}
                      x2={subjectSkillChart.padding.left + subjectSkillChart.plotWidth}
                      y2={y}
                      stroke="#edf2f7"
                      strokeWidth="1"
                    />
                    <text
                      x={subjectSkillChart.padding.left - 10}
                      y={y + 4}
                      textAnchor="end"
                      fill="#30507f"
                      fontSize="12"
                      fontWeight="800"
                    >
                      {value}
                    </text>
                  </g>
                );
              })}
              <line
                x1={subjectSkillChart.padding.left}
                y1={subjectSkillChart.padding.top}
                x2={subjectSkillChart.padding.left}
                y2={subjectSkillChart.padding.top + subjectSkillChart.plotHeight}
                stroke="#dbe5f2"
                strokeWidth="1"
              />
              <line
                x1={subjectSkillChart.padding.left}
                y1={subjectSkillChart.padding.top + subjectSkillChart.plotHeight}
                x2={subjectSkillChart.padding.left + subjectSkillChart.plotWidth}
                y2={subjectSkillChart.padding.top + subjectSkillChart.plotHeight}
                stroke="#dbe5f2"
                strokeWidth="1"
              />
              <text
                x="16"
                y={subjectSkillChart.padding.top + subjectSkillChart.plotHeight / 2}
                fill="#30507f"
                fontSize="12"
                fontWeight="800"
                transform={`rotate(-90 16 ${subjectSkillChart.padding.top + subjectSkillChart.plotHeight / 2})`}
                textAnchor="middle"
              >
                Accuracy (%)
              </text>
              {subjectBloomSkillPerformance.map((subjectGroup, subjectIndex) => {
                const groupStart =
                  subjectSkillChart.padding.left +
                  subjectSkillChart.groupWidth * subjectIndex;
                const groupCenter = groupStart + subjectSkillChart.groupWidth / 2;
                const barsWidth =
                  subjectGroup.skills.length * subjectSkillChart.barWidth +
                  (subjectGroup.skills.length - 1) * 6;
                const barsStart = groupCenter - barsWidth / 2;

                return (
                  <g key={subjectGroup.subject}>
                    {subjectGroup.skills.map((item, skillIndex) => {
                      const x =
                        barsStart + skillIndex * (subjectSkillChart.barWidth + 6);
                      const y = subjectSkillChart.yForValue(item.percentage);
                      const barHeight =
                        subjectSkillChart.padding.top +
                        subjectSkillChart.plotHeight -
                        y;

                      return (
                        <g key={`${subjectGroup.subject}-${item.skill}`}>
                          <rect
                            x={x}
                            y={y}
                            width={subjectSkillChart.barWidth}
                            height={barHeight}
                            rx="4"
                            fill={item.color}
                          />
                          <text
                            x={x + subjectSkillChart.barWidth / 2}
                            y={Math.max(12, y - 6)}
                            textAnchor="middle"
                            fill="#0b1f5c"
                            fontSize="11"
                            fontWeight="900"
                          >
                            {item.percentage}
                          </text>
                        </g>
                      );
                    })}
                    <text
                      x={groupCenter}
                      y={
                        subjectSkillChart.padding.top +
                        subjectSkillChart.plotHeight +
                        24
                      }
                      textAnchor="middle"
                      fill="#0b1f5c"
                      fontSize="12"
                      fontWeight="800"
                    >
                      {subjectGroup.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "16px",
              marginTop: "8px",
              color: "#0b1f5c",
              fontSize: "11px",
              fontWeight: "700",
            }}
          >
            {Object.entries(subjectBloomSkillColors).map(([skill, color]) => (
              <span
                key={skill}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "3px",
                    background: color,
                  }}
                />
                {skill}
              </span>
            ))}
          </div>
        </div>
        <div
          style={{
            padding: "12px",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            boxShadow: "0 8px 22px rgba(15, 47, 99, 0.05)",
          }}
        >
          <h3
            style={{
              margin: "0 0 14px",
              color: "#0b1f5c",
              fontSize: "15px",
              fontWeight: "900",
            }}
          >
            Subject x Bloom&apos;s Skill Mastery (Heatmap)
          </h3>
          <div className="subject-bloom-scroll" tabIndex={0} role="region" aria-label="Bloom skill heatmap, scroll horizontally to see all skills">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "96px repeat(6, minmax(58px, 1fr))",
                minWidth: "500px",
                color: "#0b1f5c",
                fontSize: "11px",
                fontWeight: "800",
              }}
            >
              <div />
              {Object.keys(subjectBloomSkillColors).map((skill) => (
                <div
                  key={`heatmap-heading-${skill}`}
                  style={{
                    padding: "8px 6px",
                    textAlign: "center",
                  }}
                >
                  {skill}
                </div>
              ))}
              {subjectBloomSkillPerformance.map((subjectGroup) => (
                <React.Fragment key={`heatmap-row-${subjectGroup.subject}`}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "8px 8px 8px 0",
                      fontWeight: "900",
                    }}
                  >
                    {subjectGroup.label}
                  </div>
                  {subjectGroup.skills.map((item) => (
                    <div
                      key={`${subjectGroup.subject}-${item.skill}-heatmap`}
                      style={{
                        display: "grid",
                        placeItems: "center",
                        minHeight: "42px",
                        background: getHeatmapCellColor(item.percentage),
                        border: "1px solid rgba(255, 255, 255, 0.85)",
                        color: item.percentage >= 40 ? "#0b1f5c" : "#ffffff",
                        fontWeight: "900",
                      }}
                    >
                      {item.percentage}%
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginTop: "12px",
              color: "#0b1f5c",
              fontSize: "10px",
              fontWeight: "700",
            }}
          >
            {heatmapLegend.map((item) => (
              <span
                key={item.label}
                style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "3px",
                    background: item.color,
                  }}
                />
                {item.label}
              </span>
            ))}
          </div>
        </div>
        </div>
        <div
          className="subject-bloom-panels"
          style={{
            display: "grid",
            gap: "14px",
            marginTop: "14px",
          }}
        >
          <div
            style={{
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              boxShadow: "0 8px 22px rgba(15, 47, 99, 0.05)",
              minWidth: 0,
            }}
          >
            <h3
              style={{
                margin: "0 0 14px",
                color: "#0b1f5c",
                fontSize: "15px",
                fontWeight: "900",
              }}
            >
              Subject-wise HOTS vs LOTS
            </h3>
            <div style={{ display: "grid", gap: "10px" }}>
              {subjectHotsLotsDistribution.map((item) => (
                <div
                  key={`${item.subject}-hots-lots`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "96px minmax(0, 1fr)",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      color: "#0b1f5c",
                      fontSize: "13px",
                      fontWeight: "800",
                      textAlign: "right",
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      width: "100%",
                      height: "28px",
                      borderRadius: "5px",
                      overflow: "hidden",
                      background: "#f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        width: `${item.lots}%`,
                        minWidth: item.lots > 0 ? "26px" : 0,
                        display: "grid",
                        placeItems: "center",
                        background: "#34c99a",
                        color: "#0b1f5c",
                        fontSize: "12px",
                        fontWeight: "900",
                      }}
                    >
                      {item.lots > 0 ? `${item.lots}%` : ""}
                    </div>
                    <div
                      style={{
                        width: `${item.hots}%`,
                        minWidth: item.hots > 0 ? "26px" : 0,
                        display: "grid",
                        placeItems: "center",
                        background: "#ff8a45",
                        color: "#0b1f5c",
                        fontSize: "12px",
                        fontWeight: "900",
                      }}
                    >
                      {item.hots > 0 ? `${item.hots}%` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "14px",
                marginTop: "14px",
                color: "#0b1f5c",
                fontSize: "11px",
                fontWeight: "700",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: "#34c99a",
                  }}
                />
                LOTS (Remember + Understand)
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: "#ff8a45",
                  }}
                />
                HOTS (Apply + Analyse + Evaluate + Create)
              </span>
            </div>
          </div>
          <div
            style={{
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              boxShadow: "0 8px 22px rgba(15, 47, 99, 0.05)",
            }}
          >
            <h3
              style={{
                margin: "0 0 14px",
                color: "#0b1f5c",
                fontSize: "15px",
                fontWeight: "900",
              }}
            >
              Subject-wise Cognitive Strengths &amp; Gaps
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
                gap: "10px",
              }}
            >
              {subjectStrengthGapInsights.map((item) => (
                <div
                  key={`${item.subject}-strength-gap`}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    overflow: "hidden",
                    background: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      padding: "8px 10px",
                      background: item.meta?.bg || "#eef6ff",
                      color: item.meta?.iconColor || "#0b1f5c",
                      fontSize: "13px",
                      fontWeight: "900",
                      textAlign: "center",
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gap: "10px",
                      padding: "12px 10px",
                      color: "#0b1f5c",
                      fontSize: "11px",
                      fontWeight: "700",
                      lineHeight: 1.35,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "22px minmax(0, 1fr)",
                        alignItems: "start",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          background: "#34c99a",
                          color: "#ffffff",
                        }}
                      >
                        <Award size={14} strokeWidth={2.5} aria-hidden="true" />
                      </span>
                      <span>{item.strengthText}</span>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "22px minmax(0, 1fr)",
                        alignItems: "start",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          background: "#ff5f7d",
                          color: "#ffffff",
                        }}
                      >
                        <AlertTriangle size={14} strokeWidth={2.5} aria-hidden="true" />
                      </span>
                      <span>{item.gapText}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
    } else if (tabId === "top-students-poster") {
      setView("top-students-poster");
    } else if (tabId === "top-students-exam-wise") {
      setView("top-students-exam-wise");
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
  const schoolLogoUrl =
    typeof school?.logo_url === "string" && school.logo_url.trim()
      ? school.logo_url.trim()
      : "";

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

        {OWNER_TABS.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`sidebar-nav-item${activeTab === tab.id ? " sidebar-nav-item--active" : ""}`}
              onClick={() => goTab(tab.id)}
              title={tab.label}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              <span className="sidebar-nav-icon">
                <TabIcon size={18} strokeWidth={2} />
              </span>
              <span className="sidebar-nav-label">{tab.label}</span>
            </button>
          );
        })}

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-admin-info">
            {schoolLogoUrl ? (
              <div className="sidebar-admin-avatar sidebar-admin-avatar--logo">
                <img
                  src={schoolLogoUrl}
                  alt={`${schoolName || "School"} logo`}
                  className="sidebar-admin-logo"
                />
                <span className="sidebar-avatar-status" title="Portal Online" />
              </div>
            ) : (
              <div className="sidebar-admin-avatar">
                {schoolName.charAt(0).toUpperCase()}
                <span className="sidebar-avatar-status" title="Portal Online" />
              </div>
            )}
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
            Version - 3.0
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
              view === "subject-bloom-analytics"
                ? renderSubjectBloomAnalyticsView()
                : view === "examwise-results"
                ? renderExamWiseResultsView()
                : renderExamWiseView()
            }
          />
          <Route path="student" element={renderStudentWiseView()} />
          <Route path="teacher" element={renderTeacherWiseView()} />
          <Route
            path="top-students-poster"
            element={
              <div className="animate-fade-in">
                <div className="page-header">
                  <div className="page-header-left">
                    <h1 className="page-header-title">Top Students Poster</h1>
                    <p className="page-header-subtitle">
                      Generate poster downloads for your school.
                    </p>
                  </div>
                  <button type="button" className="poster-secondary-btn" onClick={() => navigate(-1)}>
                    ← Back to Top Students
                  </button>
                </div>
                <div className="page-content">
                  <TopStudentsPosterGenerator mode="school" school={school} />
                </div>
              </div>
            }
          />
          <Route
            path="top-students-exam-wise"
            element={
              <div className="animate-fade-in">
                <div className="page-header">
                  <div className="page-header-left">
                    <h1 className="page-header-title">Exam-wise Top Students Poster</h1>
                    <p className="page-header-subtitle">
                      Select a template and export the selected exam poster.
                    </p>
                  </div>
                </div>
                <div className="page-content">
                  <ExamWiseTopStudentsPosterGenerator mode="school" school={school} />
                </div>
              </div>
            }
          />
          <Route
            path="top-students-exam-wise/poster"
            element={
              <div className="animate-fade-in">
                <div className="page-header">
                  <div className="page-header-left">
                    <h1 className="page-header-title">Exam-wise Top Students Poster</h1>
                    <p className="page-header-subtitle">Select a template and export the selected exam poster.</p>
                  </div>
                  <button type="button" className="poster-secondary-btn" onClick={() => navigate(-1)}>
                    ← Back to Top Students by Exam
                  </button>
                </div>
                <div className="page-content">
                  <ExamWiseTopStudentsPosterGenerator mode="school" school={school} />
                </div>
              </div>
            }
          />
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
