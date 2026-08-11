// src/components/TeacherDashboard.jsx
// ─────────────────────────────────────────────────────────────────
// Data-fetching shell + sidebar navigation for the TEACHER role.
// Sub-routes: /teacher/overview · /teacher/performance · /teacher/report
// Also handles "proxy view" when called from SchoolOwnerDashboard
// with an external teacherId prop.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  Award,
  BarChart3,
  Download,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Mail,
  Phone,
  UserRoundCog,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import spectropyLogoUrl from "../assets/logo.png";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

// ─── Tab Definitions ────────────────────────────────────────────
const TEACHER_TABS = [
  {
    id: "overview",
    path: "overview",
    icon: LayoutDashboard,
    label: "Overview",
  },
  {
    id: "performance",
    path: "performance",
    icon: BarChart3,
    label: "Performance",
  },
];

// ─── Analytics Helper ────────────────────────────────────────────
function computeExamAnalytics(exams, teacherAssignments) {
  const assignments = Array.isArray(teacherAssignments)
    ? teacherAssignments
    : [];

  const getSubjectPercentage = (exam, percentageKey, marksKey, maxMarksKey) => {
    const directPercentage = parseFloat(exam[percentageKey]);
    if (Number.isFinite(directPercentage)) return directPercentage;

    const marks = parseFloat(exam[marksKey]);
    const maxMarks = parseFloat(exam[maxMarksKey]);

    if (!Number.isFinite(marks) || !Number.isFinite(maxMarks) || maxMarks <= 0) {
      return null;
    }

    return (marks / maxMarks) * 100;
  };

  // Group by (exam_pattern, class-section) and compute subject averages
  const patternMap = {};
  exams.forEach((exam) => {
    const pattern = exam.exam_pattern || "N/A";
    const classSection = `${exam.class || "N/A"}-${exam.section || "N/A"}`;
    if (!patternMap[pattern]) patternMap[pattern] = {};
    if (!patternMap[pattern][classSection])
      patternMap[pattern][classSection] = {
        physics: [],
        chemistry: [],
        maths: [],
        biology: [],
      };

    const g = patternMap[pattern][classSection];
    const physicsPercentage = getSubjectPercentage(
      exam,
      "physics_percentage",
      "physics_marks",
      "max_marks_physics",
    );
    const chemistryPercentage = getSubjectPercentage(
      exam,
      "chemistry_percentage",
      "chemistry_marks",
      "max_marks_chemistry",
    );
    const mathsPercentage = getSubjectPercentage(
      exam,
      "maths_percentage",
      "maths_marks",
      "max_marks_maths",
    );
    const biologyPercentage = getSubjectPercentage(
      exam,
      "biology_percentage",
      "biology_marks",
      "max_marks_biology",
    );

    if (physicsPercentage != null) g.physics.push(physicsPercentage);
    if (chemistryPercentage != null) g.chemistry.push(chemistryPercentage);
    if (mathsPercentage != null) g.maths.push(mathsPercentage);
    if (biologyPercentage != null) g.biology.push(biologyPercentage);
  });

  const avg = (arr) =>
    arr.length
      ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)
      : null;

  const stats = (arr) => {
    const values = arr
      .map((value) => parseFloat(value))
      .filter((value) => Number.isFinite(value));

    if (!values.length) return null;

    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const highest = Math.max(...values);
    const lowest = Math.min(...values);
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;

    return {
      average: average.toFixed(1),
      count: values.length,
      highest: highest.toFixed(1),
      lowest: lowest.toFixed(1),
      median: median.toFixed(1),
      spread: (highest - lowest).toFixed(1),
    };
  };

  const examPatterns = Object.entries(patternMap).map(([pattern, csData]) => {
    const averagesByClassSection = {};
    const detailsByClassSection = {};
    for (const [cs, s] of Object.entries(csData)) {
      averagesByClassSection[cs] = {
        Physics: avg(s.physics),
        Chemistry: avg(s.chemistry),
        Biology: avg(s.biology),
        Maths: avg(s.maths),
      };
      detailsByClassSection[cs] = {
        Physics: stats(s.physics),
        Chemistry: stats(s.chemistry),
        Biology: stats(s.biology),
        Maths: stats(s.maths),
      };
    }
    return { exam_pattern: pattern, averagesByClassSection, detailsByClassSection };
  });
  examPatterns.sort((a, b) => a.exam_pattern.localeCompare(b.exam_pattern));

  // Best week test per grade — only for teacher's assigned subjects
  const teacherTeaches = new Set(
    assignments.map((a) => `${a.class}-${a.section}|${a.subject}`),
  );

  const gradeBest = {};
  examPatterns.forEach(({ exam_pattern, averagesByClassSection }) => {
    Object.entries(averagesByClassSection).forEach(([cs, subjects]) => {
      let grade = "N/A";
      if (cs.startsWith("GRADE-")) {
        const parts = cs.split("-");
        if (parts.length >= 2) grade = parts[1];
      } else {
        grade = cs.split("-")[0];
      }
      if (!/^\d+$/.test(grade)) return;

      ["Physics", "Chemistry", "Biology", "Maths"].forEach((subject) => {
        if (!teacherTeaches.has(`${cs}|${subject}`)) return;
        const avgVal = subjects[subject];
        if (avgVal == null) return;
        const n = parseFloat(avgVal);
        if (isNaN(n)) return;
        if (!gradeBest[grade] || n > gradeBest[grade].bestAvg)
          gradeBest[grade] = { bestTest: exam_pattern, bestAvg: n };
      });
    });
  });

  const bestWeekTestsByGrade = Object.entries(gradeBest).map(
    ([grade, data]) => ({
      grade,
      bestExamPattern: data.bestTest,
      bestAverage: data.bestAvg.toFixed(1),
    }),
  );

  return { examPatterns, bestWeekTestsByGrade };
}

// ─── Main Component ──────────────────────────────────────────────
export default function TeacherDashboard({
  onBack,
  teacherId: externalTeacherId,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active tab from URL
  const segment = location.pathname.split("/")[2] || "overview";
  const activeTab =
    TEACHER_TABS.find((t) => t.path === segment)?.id || "overview";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teacher, setTeacher] = useState(null);
  const [schoolName, setSchoolName] = useState("");
  const [schoolLogoUrl, setSchoolLogoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [examPatterns, setExamPatterns] = useState([]);
  const [bestWeekTestsByGrade, setBestWeekTestsByGrade] = useState([]);
  const [teacherRankRows, setTeacherRankRows] = useState([]);
  const [teacherRanksError, setTeacherRanksError] = useState("");
  const hasFetched = useRef(false);

  const isProxyView = !!externalTeacherId && externalTeacherId.trim() !== "";

  // ── Sidebar toggle via global event (from App header hamburger) ──
  useEffect(() => {
    if (isProxyView) return; // No sidebar in proxy view
    const onToggle = () => setSidebarOpen((p) => !p);
    window.addEventListener("toggleTeacherSidebar", onToggle);
    return () => window.removeEventListener("toggleTeacherSidebar", onToggle);
  }, [isProxyView]);

  // ── Data Fetching ──────────────────────────────────────────────
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const load = async () => {
      try {
        const raw =
          localStorage.getItem("sp_user") || sessionStorage.getItem("sp_user");
        if (!raw) throw new Error("User session not found. Please log in.");
        const user = JSON.parse(raw);
        const sessionUser = user?.teacher || user?.user || user;
        const schoolId = sessionUser?.school_id || user?.school_id;

        let teacherData = null;
        let sName = "Unknown School";
        let sLogo = "";

        if (isProxyView) {
          // ── School Owner viewing a teacher by ID ──
          const schoolRes = await fetch(`${API_BASE}/api/schools/${schoolId}`);
          if (!schoolRes.ok) throw new Error("Failed to load school data.");
          const schoolData = await schoolRes.json();
          sName = schoolData.school?.school_name || "Unknown School";
          sLogo = schoolData.school?.logo_url || "";

          const targetId = externalTeacherId.trim().toUpperCase();
          const found = schoolData.teachers?.find(
            (t) => t.teacher_id?.trim().toUpperCase() === targetId,
          );
          if (!found) throw new Error("Teacher not found in your school.");

          teacherData = {
            ...found,
            teacher_assignments: Array.isArray(found.teacher_assignments)
              ? found.teacher_assignments
              : [],
          };
        } else {
          // ── Teacher self-view ──
          if (sessionUser.role && sessionUser.role !== "TEACHER")
            throw new Error("Access denied. Teachers only.");
          const teacherId = sessionUser.teacher_id || user.teacher_id;
          if (!teacherId) {
            throw new Error("Teacher ID not found. Please log in again.");
          }

          const teacherRes = await fetch(`${API_BASE}/api/teachers/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teacher_id: teacherId.trim().toUpperCase(),
              password: teacherId.trim().toUpperCase(),
            }),
          });

          if (!teacherRes.ok) {
            throw new Error("Failed to refresh teacher assignments.");
          }

          const teacherPayload = await teacherRes.json();
          teacherData = {
            role: "TEACHER",
            ...teacherPayload.teacher,
            teacher_assignments: Array.isArray(
              teacherPayload.teacher?.teacher_assignments,
            )
              ? teacherPayload.teacher.teacher_assignments
              : [],
          };

          const refreshedSession = JSON.stringify(teacherData);
          localStorage.setItem("sp_user", refreshedSession);
          sessionStorage.setItem("sp_user", refreshedSession);
          sName =
            teacherData.school_name ||
            sessionUser.school_name ||
            user.school_name ||
            "Unknown School";
          sLogo =
            teacherData.school_logo_url ||
            teacherData.logo_url ||
            sessionUser.school_logo_url ||
            sessionUser.logo_url ||
            user.school_logo_url ||
            user.logo_url ||
            "";
        }

        setTeacher(teacherData);
        setSchoolName(sName);
        setSchoolLogoUrl(sLogo);

        const examsRes = await fetch(
          `${API_BASE}/api/exams?school_id=${schoolId}`,
        );
        if (!examsRes.ok) throw new Error("Failed to fetch exam data.");
        const exams = await examsRes.json();

        const { examPatterns, bestWeekTestsByGrade } = computeExamAnalytics(
          exams,
          teacherData.teacher_assignments,
        );
        setExamPatterns(examPatterns);
        setBestWeekTestsByGrade(bestWeekTestsByGrade);

        setTeacherRanksError("");
        const rankPayloadBody = {
          teacher_id: teacherData.teacher_id,
          school_id: schoolId,
          assignments: teacherData.teacher_assignments,
        };
        let rankRes = await fetch(`${API_BASE}/api/teachers/ranks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rankPayloadBody),
        });

        if (!rankRes.ok && teacherData.teacher_id) {
          rankRes = await fetch(
            `${API_BASE}/api/teachers/${teacherData.teacher_id}/ranks`,
          );
        }

        if (rankRes.ok) {
          const rankPayload = await rankRes.json();
          setTeacherRankRows(Array.isArray(rankPayload.rows) ? rankPayload.rows : []);
        } else {
          setTeacherRankRows([]);
          setTeacherRanksError("Teacher rankings could not be loaded.");
        }
      } catch (err) {
        console.error("TeacherDashboard error:", err);
        setError(err.message || "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isProxyView, externalTeacherId]);

  // ── PDF Generator ─────────────────────────────────────────────
  const downloadPDF = () => {
    if (!teacher) return;

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

    const safeAssignments = Array.isArray(teacher.teacher_assignments)
      ? teacher.teacher_assignments
      : [];

    const safeBestWeekTests = Array.isArray(bestWeekTestsByGrade)
      ? bestWeekTestsByGrade
      : [];

    const safeExamPatterns = Array.isArray(examPatterns) ? examPatterns : [];

    // =========================================================
    // DESIGN SYSTEM
    // =========================================================
    const COLORS = {
      navy: [18, 45, 85],
      navyLight: [43, 73, 118],
      blue: [37, 99, 235],

      dark: [15, 23, 42],
      gray: [100, 116, 139],

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

    const formatPercentage = (value) => {
      if (!isNumericValue(value)) {
        return "N/A";
      }

      return `${parseFloat(value).toFixed(2)}%`;
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

    const createColumnStyles = ({
      tableWidth,
      weights,
      leftAlignedIndexes = [],
    }) => {
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

      const columnStyles = {};
      let consumedWidth = 0;

      weights.forEach((weight, index) => {
        const cellWidth =
          index === weights.length - 1
            ? tableWidth - consumedWidth
            : (tableWidth * weight) / totalWeight;

        consumedWidth += cellWidth;

        columnStyles[index] = {
          cellWidth,
          halign: leftAlignedIndexes.includes(index) ? "left" : "center",
        };
      });

      return columnStyles;
    };

    const schoolDisplayName = safeText(
      schoolName,
      "Unknown School",
    ).toUpperCase();

    const schoolInitial =
      schoolDisplayName !== "UNKNOWN SCHOOL"
        ? schoolDisplayName.charAt(0)
        : "S";

    const schoolLogoForPdf =
      typeof schoolLogoUrl === "string" && schoolLogoUrl.trim()
        ? schoolLogoUrl.trim()
        : null;

    const spectropyLogo =
      typeof spectropyLogoUrl !== "undefined" ? spectropyLogoUrl : null;

    // =========================================================
    // SMALL POWERED BY SPECTROPY CONTAINER
    // =========================================================
    const drawSpectropyBrand = ({
      rightX = pageWidth - margin,
      centerY = 12,
      compact = false,
    } = {}) => {
      const containerWidth = compact ? 45 : 50;
      const containerHeight = compact ? 10 : 14;

      const containerX = rightX - containerWidth;
      const containerY = centerY - containerHeight / 2;

      const logoPanelWidth = compact ? 12 : 15;
      const logoSize = compact ? 7 : 9;

      setFill(COLORS.white);
      setDraw([190, 211, 239]);
      doc.setLineWidth(0.25);

      doc.roundedRect(
        containerX,
        containerY,
        containerWidth,
        containerHeight,
        compact ? 2 : 2.5,
        compact ? 2 : 2.5,
        "FD",
      );

      const dividerX = containerX + logoPanelWidth;

      setDraw([218, 226, 238]);
      doc.setLineWidth(0.25);

      doc.line(
        dividerX,
        containerY + 2,
        dividerX,
        containerY + containerHeight - 2,
      );

      const logoX = containerX + (logoPanelWidth - logoSize) / 2;

      const logoY = containerY + (containerHeight - logoSize) / 2;

      let logoLoaded = false;

      if (spectropyLogo) {
        try {
          doc.addImage(spectropyLogo, "PNG", logoX, logoY, logoSize, logoSize);

          logoLoaded = true;
        } catch (error) {
          console.warn("Failed to load Spectropy logo:", error);
        }
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
        doc.setFontSize(compact ? 4.5 : 5.5);

        doc.text("S", logoX + logoSize / 2, logoY + logoSize * 0.69, {
          align: "center",
        });
      }

      const textX = dividerX + (compact ? 2.2 : 2.8);

      setText([91, 121, 164]);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(compact ? 4 : 5);

      doc.text("Powered by", textX, containerY + (compact ? 3.4 : 4.3));

      setText(COLORS.navy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(compact ? 6.6 : 8.2);

      doc.text("SPECTROPY", textX, containerY + (compact ? 7.1 : 9));

      setText([113, 135, 166]);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(compact ? 3 : 3.8);

      doc.text("Learning Analytics", textX, containerY + (compact ? 9.2 : 12));
    };

    // =========================================================
    // PAGE HEADERS
    // =========================================================
    const headerDrawnPages = new Set();

    const drawMainHeader = () => {
      const currentPage = doc.internal.getCurrentPageInfo().pageNumber;

      if (headerDrawnPages.has(currentPage)) {
        return;
      }

      setFill(COLORS.background);
      doc.rect(0, 0, pageWidth, pageHeight, "F");

      const headerHeight = 26;

      setFill(COLORS.navy);
      doc.rect(0, 0, pageWidth, headerHeight, "F");

      setFill(COLORS.blue);
      doc.rect(0, headerHeight - 2, pageWidth, 2, "F");

      // School logo container
      const logoBoxX = margin;
      const logoBoxY = 4;
      const logoBoxSize = 18;

      setFill(COLORS.white);

      doc.roundedRect(
        logoBoxX,
        logoBoxY,
        logoBoxSize,
        logoBoxSize,
        2.5,
        2.5,
        "F",
      );

      let schoolLogoLoaded = false;

      if (schoolLogoForPdf) {
        try {
          doc.addImage(
            schoolLogoForPdf,
            "PNG",
            logoBoxX + 2,
            logoBoxY + 2,
            logoBoxSize - 4,
            logoBoxSize - 4,
          );

          schoolLogoLoaded = true;
        } catch (error) {
          console.warn("Failed to load school logo:", error);
        }
      }

      // Display the school initial if there is no usable logo
      if (!schoolLogoLoaded) {
        setFill(COLORS.lightBlue);

        doc.circle(
          logoBoxX + logoBoxSize / 2,
          logoBoxY + logoBoxSize / 2,
          5.5,
          "F",
        );

        setText(COLORS.blue);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);

        doc.text(schoolInitial, logoBoxX + logoBoxSize / 2, logoBoxY + 11.2, {
          align: "center",
        });
      }

      drawSpectropyBrand({
        rightX: pageWidth - margin,
        centerY: headerHeight / 2,
      });

      const schoolTextX = logoBoxX + logoBoxSize + 6;

      const brandContainerX = pageWidth - margin - 50;

      const schoolTextMaxWidth = brandContainerX - schoolTextX - 8;

      const schoolFontSize = fitTextToWidth({
        text: schoolDisplayName,
        maxWidth: schoolTextMaxWidth,
        maximumFontSize: 13,
        minimumFontSize: 8,
      });

      setText(COLORS.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(schoolFontSize);

      doc.text(schoolDisplayName, schoolTextX, 10.5);

      setText([219, 234, 254]);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);

      doc.text("IIT Foundation Academic Report", schoolTextX, 17.5);

      headerDrawnPages.add(currentPage);
    };

    const drawContinuationHeader = () => {
      const currentPage = doc.internal.getCurrentPageInfo().pageNumber;

      if (headerDrawnPages.has(currentPage)) {
        return;
      }

      setFill(COLORS.background);
      doc.rect(0, 0, pageWidth, pageHeight, "F");

      setFill(COLORS.navy);
      doc.rect(0, 0, pageWidth, 15, "F");

      setFill(COLORS.blue);
      doc.rect(0, 13.5, pageWidth, 1.5, "F");

      setText(COLORS.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);

      doc.text(`${schoolDisplayName} - Teacher Report`, margin, 8.8, {
        maxWidth: pageWidth - 75,
      });

      drawSpectropyBrand({
        rightX: pageWidth - margin,
        centerY: 7.5,
        compact: true,
      });

      headerDrawnPages.add(currentPage);
    };

    const ensureSectionSpace = (currentY, requiredHeight = 28) => {
      if (currentY + requiredHeight > pageHeight - 17) {
        doc.addPage();
        drawContinuationHeader();
        return 22;
      }

      return currentY;
    };

    // =========================================================
    // FIRST PAGE
    // =========================================================
    drawMainHeader();

    let y = 34;

    // =========================================================
    // REPORT TITLE
    // =========================================================
    setText(COLORS.blue);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text("IIT FOUNDATION", margin, y);

    y += 5;

    setText(COLORS.dark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);

    doc.text("Teacher Performance Report", margin, y);

    setText(COLORS.gray);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);

    doc.text(`Generated: ${generatedDate}`, pageWidth - margin, y, {
      align: "right",
    });

    y += 7;

    // =========================================================
    // COMPACT TEACHER INFORMATION STRIP
    // =========================================================
    setFill(COLORS.white);
    setDraw(COLORS.border);
    doc.setLineWidth(0.25);

    doc.roundedRect(margin, y, printableWidth, 12, 2.5, 2.5, "FD");

    const uniqueClassSections = [
      ...new Set(
        safeAssignments.map(
          (assignment) => `${assignment.class}-${assignment.section}`,
        ),
      ),
    ];

    const teacherInfo = [
      {
        label: "TEACHER",
        value: safeText(teacher.name),
        x: margin + 5,
        width: 80,
      },
      {
        label: "TEACHER ID",
        value: safeText(teacher.teacher_id),
        x: margin + 95,
        width: 48,
      },
      {
        label: "ALLOTMENTS",
        value: String(safeAssignments.length),
        x: margin + 156,
        width: 32,
      },
      {
        label: "CLASSES",
        value: String(uniqueClassSections.length),
        x: margin + 200,
        width: 30,
      },
      {
        label: "SUBJECTS",
        value: String(
          new Set(safeAssignments.map((assignment) => assignment.subject)).size,
        ),
        x: margin + 242,
        width: 30,
      },
    ];

    teacherInfo.forEach((item) => {
      setText(COLORS.gray);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.4);

      doc.text(item.label, item.x, y + 4.2);

      const valueFontSize = fitTextToWidth({
        text: item.value,
        maxWidth: item.width,
        maximumFontSize: 8,
        minimumFontSize: 5.5,
      });

      setText(COLORS.navy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(valueFontSize);

      doc.text(item.value, item.x, y + 9, {
        maxWidth: item.width,
      });
    });

    y += 18;

    // =========================================================
    // ALLOTMENTS TABLE
    // =========================================================
    setText(COLORS.dark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    doc.text("Teaching Allotments", margin, y);

    setText(COLORS.gray);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);

    doc.text(
      "Classes, sections and subjects assigned to the teacher",
      margin,
      y + 4,
    );

    y += 7;

    const allotmentRows =
      safeAssignments.length > 0
        ? safeAssignments.map((assignment, index) => [
            index + 1,
            safeText(assignment.class),
            safeText(assignment.section),
            safeText(assignment.subject),
          ])
        : [["-", "-", "-", "No assigned classes"]];

    doc.autoTable({
      startY: y,

      head: [["S.No.", "Class", "Section", "Subject"]],

      body: allotmentRows,

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
        fontSize: 8.4,
        cellPadding: {
          top: 2,
          right: 2,
          bottom: 2,
          left: 2,
        },
        halign: "center",
        valign: "middle",
        textColor: COLORS.dark,
        lineColor: COLORS.border,
        lineWidth: 0.2,
        minCellHeight: 7.5,
      },

      headStyles: {
        fillColor: COLORS.navy,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "center",
        minCellHeight: 8.5,
        lineColor: COLORS.navyLight,
      },

      alternateRowStyles: {
        fillColor: COLORS.background,
      },

      columnStyles: createColumnStyles({
        tableWidth: printableWidth,
        weights: [0.45, 0.8, 0.8, 2.2],
        leftAlignedIndexes: [3],
      }),

      showHead: "everyPage",
      rowPageBreak: "avoid",

      willDrawPage: () => {
        drawContinuationHeader();
      },

      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = COLORS.navy;
        }
      },
    });

    y = doc.lastAutoTable.finalY + 9;

    // =========================================================
    // BEST WEEK TEST TABLE
    // =========================================================
    if (safeBestWeekTests.length > 0) {
      y = ensureSectionSpace(y, 35);

      setText(COLORS.dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);

      doc.text("Best Week Test by Grade", margin, y);

      setText(COLORS.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);

      doc.text(
        "Highest-performing weekly assessment for each grade",
        margin,
        y + 4,
      );

      y += 7;

      const bestWeekRows = safeBestWeekTests.map((item) => [
        `Grade ${safeText(item.grade)}`,
        safeText(item.bestExamPattern),
        formatPercentage(item.bestAverage),
      ]);

      doc.autoTable({
        startY: y,

        head: [["Grade", "Best Exam Pattern", "Best Average"]],

        body: bestWeekRows,

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
          fontSize: 8.5,
          cellPadding: {
            top: 2,
            right: 2,
            bottom: 2,
            left: 2,
          },
          halign: "center",
          valign: "middle",
          textColor: COLORS.dark,
          lineColor: COLORS.border,
          lineWidth: 0.2,
          minCellHeight: 7.5,
        },

        headStyles: {
          fillColor: COLORS.blue,
          textColor: COLORS.white,
          fontStyle: "bold",
          fontSize: 8.5,
          minCellHeight: 8.5,
          lineColor: COLORS.blue,
        },

        alternateRowStyles: {
          fillColor: COLORS.background,
        },

        columnStyles: createColumnStyles({
          tableWidth: printableWidth,
          weights: [0.8, 2.2, 1],
          leftAlignedIndexes: [1],
        }),

        showHead: "everyPage",
        rowPageBreak: "avoid",

        willDrawPage: () => {
          drawContinuationHeader();
        },

        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 2) {
            const average = parseFloat(data.cell.raw);

            if (!Number.isNaN(average)) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.textColor = getPerformanceColor(average);
            }
          }
        },
      });

      y = doc.lastAutoTable.finalY + 9;
    }

    // =========================================================
    // EXAM PERFORMANCE AVERAGES
    // =========================================================
    if (safeExamPatterns.length > 0) {
      y = ensureSectionSpace(y, 40);

      const teacherClassSections = [
        ...new Set(
          safeAssignments.map(
            (assignment) => `${assignment.class}-${assignment.section}`,
          ),
        ),
      ];

      const subjects = ["Physics", "Chemistry", "Biology", "Maths"];

      const dynamicColumns = [];
      const columnHeaders = ["Exam Pattern"];

      subjects.forEach((subject) => {
        teacherClassSections.forEach((classSection) => {
          const hasAssignment = safeAssignments.some(
            (assignment) =>
              assignment.subject === subject &&
              `${assignment.class}-${assignment.section}` === classSection,
          );

          if (hasAssignment) {
            dynamicColumns.push({
              subject,
              classSection,
            });

            columnHeaders.push(`${subject} (${classSection})`);
          }
        });
      });

      setText(COLORS.dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);

      doc.text("Exam Performance Averages", margin, y);

      setText(COLORS.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);

      doc.text(
        "Exam-pattern averages for assigned subjects and classes",
        margin,
        y + 4,
      );

      y += 7;

      const examAverageRows = safeExamPatterns.map((pattern) => {
        const row = [safeText(pattern.exam_pattern)];

        dynamicColumns.forEach((column) => {
          const average =
            pattern.averagesByClassSection?.[column.classSection]?.[
              column.subject
            ];

          row.push(average != null ? formatPercentage(average) : "N/A");
        });

        return row;
      });

      const examColumnWeights = [1.4, ...dynamicColumns.map(() => 1)];

      const examTableFontSize =
        columnHeaders.length <= 5
          ? 8.5
          : columnHeaders.length <= 8
            ? 7.5
            : columnHeaders.length <= 11
              ? 6.8
              : 6.1;

      const examHeaderFontSize =
        columnHeaders.length <= 6 ? 8 : columnHeaders.length <= 10 ? 6.8 : 5.9;

      doc.autoTable({
        startY: y,

        head: [columnHeaders],

        body:
          examAverageRows.length > 0
            ? examAverageRows
            : [["No examination data", ...dynamicColumns.map(() => "N/A")]],

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
          fontSize: examTableFontSize,
          cellPadding: {
            top: 2,
            right: 1.2,
            bottom: 2,
            left: 1.2,
          },
          halign: "center",
          valign: "middle",
          textColor: COLORS.dark,
          lineColor: COLORS.border,
          lineWidth: 0.2,
          overflow: "linebreak",
          minCellHeight: 7.5,
        },

        headStyles: {
          fillColor: COLORS.navy,
          textColor: COLORS.white,
          fontStyle: "bold",
          fontSize: examHeaderFontSize,
          halign: "center",
          minCellHeight: 9,
          lineColor: COLORS.navyLight,
        },

        alternateRowStyles: {
          fillColor: COLORS.background,
        },

        columnStyles: createColumnStyles({
          tableWidth: printableWidth,
          weights: examColumnWeights,
          leftAlignedIndexes: [0],
        }),

        showHead: "everyPage",
        rowPageBreak: "avoid",

        willDrawPage: () => {
          drawContinuationHeader();
        },

        didParseCell: (data) => {
          if (data.section !== "body") {
            return;
          }

          if (data.column.index === 0) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = COLORS.navy;
            data.cell.styles.fillColor = COLORS.lightBlue;
          }

          if (data.column.index > 0) {
            const average = parseFloat(data.cell.raw);

            if (!Number.isNaN(average)) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.textColor = getPerformanceColor(average);
            }
          }
        },
      });
    }

    // =========================================================
    // FOOTERS
    // =========================================================
    const totalPages = doc.internal.getNumberOfPages();

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      doc.setPage(pageNumber);

      setDraw(COLORS.border);
      doc.setLineWidth(0.25);

      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

      setText(COLORS.gray);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.8);

      doc.text("CONFIDENTIAL ACADEMIC REPORT", margin, pageHeight - 7);

      doc.setFont("helvetica", "normal");

      doc.text(
        `Teacher: ${safeText(teacher.name)}`,
        pageWidth / 2,
        pageHeight - 7,
        {
          align: "center",
        },
      );

      doc.setFont("helvetica", "bold");

      doc.text(
        `Page ${pageNumber} of ${totalPages}`,
        pageWidth - margin,
        pageHeight - 7,
        {
          align: "right",
        },
      );
    }

    // =========================================================
    // SAVE
    // =========================================================
    doc.save(
      `Teacher_Report_${teacher.teacher_id}_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`,
    );
  };

  // ─────────────────────────────────────────────────────────────
  // Loading / Error states
  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "#64748b",
          fontSize: 16,
        }}
      >
        ⏳ Loading teacher dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: "crimson", fontWeight: "bold", marginBottom: 16 }}>
          ⚠️ {error}
        </p>
        {onBack && (
          <button className="btn btn-outline" onClick={onBack}>
            ← Back
          </button>
        )}
      </div>
    );
  }

  if (!teacher) {
    return (
      <div style={{ padding: 32, color: "#64748b" }}>
        No teacher data available.
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Proxy view (School Owner looking at a teacher) — no sidebar
  // ─────────────────────────────────────────────────────────────
  if (isProxyView) {
    return (
      <div className="td-proxy-wrap">
        <div className="td-proxy-header">
          <div>
            <h2 className="td-proxy-title">
              <UserRoundCog size={22} /> {teacher.name}
            </h2>
            <p className="td-proxy-meta">
              {teacher.teacher_id} · {schoolName}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={downloadPDF}>
              <Download size={16} />
              Download PDF
            </button>
            {onBack && (
              <button className="btn btn-outline" onClick={onBack}>
                ← Back to Overview
              </button>
            )}
          </div>
        </div>
        <OverviewContent
          teacher={teacher}
          bestWeekTestsByGrade={bestWeekTestsByGrade}
        />
        <PerformanceContent
          teacher={teacher}
          examPatterns={examPatterns}
          bestWeekTestsByGrade={bestWeekTestsByGrade}
          teacherRankRows={teacherRankRows}
          teacherRanksError={teacherRanksError}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Self-view: full sidebar layout with nested routes
  // ─────────────────────────────────────────────────────────────
  const goTab = (tab) => {
    navigate(`/teacher/${tab.path}`);
    setSidebarOpen(false);
  };

  const renderPageShell = ({
    icon: Icon,
    title,
    subtitle,
    actions,
    children,
  }) => (
    <div className="animate-fade-in teacher-page">
      <div className="page-header teacher-page-header">
        <div className="page-header-left">
          <h1 className="page-header-title teacher-page-title">
            <Icon size={22} strokeWidth={2.2} />
            {title}
          </h1>
          <p className="page-header-subtitle">{subtitle}</p>
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
      <div className="page-content teacher-page-content">{children}</div>
    </div>
  );

  return (
    <div className="admin-layout">
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar-rail${sidebarOpen ? " sidebar-rail--open" : ""}`}
        aria-label="Teacher navigation"
      >
        <button
          className="sidebar-close-btn"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        >
          <X size={16} />
        </button>

        <span className="sidebar-section-label">Navigation</span>

        {TEACHER_TABS.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`sidebar-nav-item${activeTab === tab.id ? " sidebar-nav-item--active" : ""}`}
              onClick={() => goTab(tab)}
              title={tab.label}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              <span className="sidebar-nav-icon">
                <TabIcon size={16} />
              </span>
              <span className="sidebar-nav-label">{tab.label}</span>
            </button>
          );
        })}

        <div className="sidebar-footer">
          <div className="sidebar-admin-info">
            {schoolLogoUrl ? (
              <div className="sidebar-admin-avatar sidebar-admin-avatar--logo">
                <img
                  src={schoolLogoUrl}
                  alt={`${schoolName || "School"} logo`}
                  className="sidebar-admin-logo"
                />
                <span className="sidebar-avatar-status" title="Online" />
              </div>
            ) : (
              <div className="sidebar-admin-avatar">
                {(teacher.name || "T").charAt(0).toUpperCase()}
                <span className="sidebar-avatar-status" title="Online" />
              </div>
            )}
            <div className="sidebar-admin-details">
              <div className="sidebar-admin-name">{teacher.name}</div>
              <div className="sidebar-admin-role">{teacher.teacher_id}</div>
            </div>
          </div>

          {onBack && (
            <button className="sidebar-logout-btn" onClick={onBack}>
              <span className="sidebar-nav-label">Sign Out</span>
            </button>
          )}

          <div className="sidebar-version">{schoolName}</div>
        </div>
      </aside>

      <div className="page-canvas">
        <Routes>
          <Route index element={<Navigate to="overview" replace />} />

          <Route
            path="overview"
            element={renderPageShell({
              icon: UserRoundCog,
              title: "Overview",
              subtitle: `${teacher.name} - ${teacher.teacher_id} - ${schoolName}`,
              children: (
                <OverviewContent
                  teacher={teacher}
                  bestWeekTestsByGrade={bestWeekTestsByGrade}
                />
              ),
            })}
          />

          <Route
            path="performance"
            element={renderPageShell({
              icon: BarChart3,
              title: "Performance",
              subtitle: "Grade analysis and exam pattern averages",
              actions: (
                <button
                  className="btn btn-primary td-report-btn"
                  onClick={downloadPDF}
                >
                  <Download size={16} />
                  Download PDF Report
                </button>
              ),
              children: (
                <PerformanceContent
                  teacher={teacher}
                  examPatterns={examPatterns}
                  bestWeekTestsByGrade={bestWeekTestsByGrade}
                  teacherRankRows={teacherRankRows}
                  teacherRanksError={teacherRanksError}
                />
              ),
            })}
          />

          <Route
            path="report"
            element={<Navigate to="../performance" replace />}
          />

          <Route path="*" element={<Navigate to="overview" replace />} />
        </Routes>
      </div>
    </div>
  );
}
function OverviewContent({ teacher, bestWeekTestsByGrade = [] }) {
  return (
    <>
      <section className="td-card td-card--profile">
        <div className="td-profile-grid">
          <div className="td-avatar-wrap">
            <div className="td-avatar-circle">
              {(teacher.name || "T").charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="td-profile-info">
            <h2 className="td-profile-name">{teacher.name}</h2>
            <div className="td-profile-meta">
              <span className="td-badge td-badge--blue">
                ID: {teacher.teacher_id}
              </span>
              {teacher.email && (
                <span className="td-badge td-badge--gray">
                  <Mail size={12} style={{ marginRight: 4 }} /> {teacher.email}
                </span>
              )}
              {teacher.contact && (
                <span className="td-badge td-badge--gray">
                  <Phone size={12} style={{ marginRight: 4 }} /> {teacher.contact}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Allotments */}
      <section className="td-card">
        <h2 className="td-section-title">
          <GraduationCap size={18} /> Your Allotments
        </h2>
        {teacher.teacher_assignments.length > 0 ? (
          <div className="td-assignments-grid">
            {teacher.teacher_assignments.map((a, idx) => (
              <div key={idx} className="td-assignment-card">
                <div className="td-assignment-header">
                  <span className="td-class-tag">
                    {a.class} · {a.section}
                  </span>
                </div>
                <div className="td-subject-label">
                  <strong>Subject:</strong> {a.subject}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="td-no-data">No assigned classes yet.</p>
        )}
      </section>

      {bestWeekTestsByGrade.length > 0 && (
        <section className="td-card">
          <h2 className="td-section-title">
            <Award size={18} /> Best Week Test by Grade
          </h2>

          {(() => {
            const best = bestWeekTestsByGrade.reduce((a, b) =>
              parseFloat(a.bestAverage) > parseFloat(b.bestAverage) ? a : b,
            );
            return (
              <div className="td-best-banner">
                Best Overall: <strong>Grade {best.grade}</strong> -{" "}
                {best.bestExamPattern} - <strong>{best.bestAverage}%</strong>
              </div>
            );
          })()}

          <div className="td-grade-grid">
            {bestWeekTestsByGrade.map((item, i) => (
              <div key={i} className="td-grade-card">
                <div className="td-grade-label">Grade {item.grade}</div>
                <div className="td-grade-exam">{item.bestExamPattern}</div>
                <div className="td-grade-score">{item.bestAverage}%</div>
                <div className="td-grade-sub">Avg Score</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-page: Performance — Best week tests + Exam averages table
// ─────────────────────────────────────────────────────────────────
function PerformanceContent({
  teacher,
  examPatterns,
  bestWeekTestsByGrade,
  teacherRankRows,
  teacherRanksError,
}) {
  const teacherCS = [
    ...new Set(
      teacher.teacher_assignments.map((a) => `${a.class}-${a.section}`),
    ),
  ];
  const subjects = ["Physics", "Chemistry", "Biology", "Maths"];
  const columns = [];
  for (const subj of subjects) {
    for (const cs of teacherCS) {
      if (
        teacher.teacher_assignments.some(
          (a) => a.subject === subj && `${a.class}-${a.section}` === cs,
        )
      ) {
        columns.push({ subject: subj, classSection: cs });
      }
    }
  }

  const getAvg = (subject, classSection, patternData) =>
    patternData.averagesByClassSection[classSection]?.[subject] || null;

  const getDetails = (subject, classSection, patternData) =>
    patternData.detailsByClassSection?.[classSection]?.[subject] || null;

  const scoreClassName = (value) => {
    const n = value ? parseFloat(value) : null;
    if (n == null || Number.isNaN(n)) return "td-score td-score--na";
    if (n >= 75) return "td-score td-score--high";
    if (n >= 50) return "td-score td-score--mid";
    return "td-score td-score--low";
  };

  const formatPercent = (value) => {
    const number = parseFloat(value);
    return Number.isFinite(number) ? `${number.toFixed(1)}%` : "N/A";
  };

  const rankClassName = (rank) => {
    const number = parseInt(rank, 10);
    if (!Number.isFinite(number)) return "td-rank-badge td-rank-badge--muted";
    if (number <= 3) return "td-rank-badge td-rank-badge--top";
    if (number <= 10) return "td-rank-badge td-rank-badge--good";
    return "td-rank-badge";
  };

  const validTeacherRanks = teacherRankRows
    .map((row) => parseInt(row.all_india_rank, 10))
    .filter((rank) => Number.isFinite(rank));

  return (
    <>
      <section className="td-card">
        <h2 className="td-section-title">
          <Award size={18} /> Teacher Performance Rankings
        </h2>
        {teacherRankRows.length > 0 ? (
          <>
          <div className="td-rank-summary-grid">
            <div className="td-rank-summary">
              <span>Best Rank</span>
              <strong>
                {validTeacherRanks.length
                  ? `#${Math.min(...validTeacherRanks)}`
                  : "-"}
              </strong>
            </div>
            <div className="td-rank-summary">
              <span>Ranked Entries</span>
              <strong>{teacherRankRows.length}</strong>
            </div>
            <div className="td-rank-summary">
              <span>Average Score</span>
              <strong>
                {formatPercent(
                  teacherRankRows.reduce(
                    (sum, row) => sum + (parseFloat(row.average) || 0),
                    0,
                  ) / teacherRankRows.length,
                )}
              </strong>
            </div>
          </div>
          <div className="td-table-scroll">
            <table className="td-table">
              <thead>
                <tr>
                  <th className="td-th">Exam</th>
                  <th className="td-th">Class</th>
                  <th className="td-th">Subject</th>
                  <th className="td-th">Average</th>
                  <th className="td-th">All India Rank</th>
                </tr>
              </thead>
              <tbody>
                {teacherRankRows.map((row, index) => (
                  <tr
                    key={`${row.exam_pattern}-${row.exam_date}-${row.class_section}-${row.subject}-${index}`}
                    className={index % 2 === 0 ? "td-tr-even" : "td-tr-odd"}
                  >
                    <td className="td-td td-td--pattern">
                      {row.exam_pattern}
                      {row.exam_date && (
                        <span className="td-rank-date">{row.exam_date}</span>
                      )}
                    </td>
                    <td className="td-td">{row.class_section}</td>
                    <td className="td-td">{row.subject}</td>
                    <td className="td-td">
                      <span className={scoreClassName(row.average)}>
                        {formatPercent(row.average)}
                      </span>
                    </td>
                    <td className="td-td">
                      <span className={rankClassName(row.all_india_rank)}>
                        #{row.all_india_rank || "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="td-rank-cards">
            {teacherRankRows.map((row, index) => (
              <article
                className="td-rank-card"
                key={`${row.exam_pattern}-${row.exam_date}-${row.class_section}-${row.subject}-card-${index}`}
              >
                <div>
                  <strong>{row.exam_pattern}</strong>
                  <span>
                    {row.class_section} · {row.subject}
                  </span>
                </div>
                <div className="td-rank-card__metrics">
                  <span className={scoreClassName(row.average)}>
                    {formatPercent(row.average)}
                  </span>
                  <span className={rankClassName(row.all_india_rank)}>
                    #{row.all_india_rank || "-"}
                  </span>
                </div>
              </article>
            ))}
          </div>
          </>
        ) : (
          <p className="td-no-data">
            {teacherRanksError ||
              "No teacher ranking data found for the assigned classes."}
          </p>
        )}
      </section>

      {/* Exam Performance Averages Table */}
      {examPatterns.length > 0 && (
        <section className="td-card">
          <h2 className="td-section-title">Exam Performance Averages</h2>
          <div className="td-table-scroll">
            <table className="td-table">
              <thead>
                <tr>
                  <th className="td-th">Exam Pattern</th>
                  {columns.map((col, i) => (
                    <th key={i} className="td-th">
                      {col.subject}
                      <span className="td-th-sub">{col.classSection}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {examPatterns.map((p, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? "td-tr-even" : "td-tr-odd"}
                  >
                    <td className="td-td td-td--pattern">{p.exam_pattern}</td>
                    {columns.map((col, j) => {
                      const val = getAvg(col.subject, col.classSection, p);
                      return (
                        <td key={j} className="td-td">
                          {val != null ? (
                            <span className={scoreClassName(val)}>{val}%</span>
                          ) : (
                            <span className="td-score td-score--na">N/A</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="td-exam-average-cards">
            {examPatterns.map((p, i) => (
              <article className="td-exam-average-card" key={i}>
                <div className="td-exam-average-card__header">
                  <div className="td-exam-average-card__title">
                    {p.exam_pattern}
                  </div>
                </div>
                <div className="td-exam-average-card__grid">
                  {columns.map((col, j) => {
                    const val = getAvg(col.subject, col.classSection, p);
                    return (
                      <div className="td-exam-average-card__item" key={j}>
                        <div>
                          <span>{col.subject}</span>
                          <small>{col.classSection}</small>
                        </div>
                        {val != null ? (
                          <span className={scoreClassName(val)}>{val}%</span>
                        ) : (
                          <span className="td-score td-score--na">N/A</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {examPatterns.length === 0 && teacher.teacher_assignments.length > 0 && (
        <section className="td-card">
          <p className="td-no-data">
            No exam results found for your assigned classes.
          </p>
        </section>
      )}

      {teacher.teacher_assignments.length === 0 && (
        <section className="td-card">
          <p className="td-no-data">
            No class allotments found. Contact your administrator.
          </p>
        </section>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-page: Report — PDF preview + download
// ─────────────────────────────────────────────────────────────────
function ReportContent({
  teacher,
  schoolName,
  bestWeekTestsByGrade,
  examPatterns,
  onDownload,
}) {
  return (
    <section className="td-card td-report-card">
      <div className="td-report-icon">
        <FileText size={40} />
      </div>
      <h2 className="td-report-title">Teacher Performance Report</h2>
      <p className="td-report-desc">
        Download a full PDF report including your allotments, best week test
        performance by grade, and complete exam average breakdown across all
        your assigned classes.
      </p>

      {/* Summary stats */}
      <div className="td-report-stats">
        <div className="td-stat-item">
          <div className="td-stat-num">
            {teacher.teacher_assignments.length}
          </div>
          <div className="td-stat-label">Allotments</div>
        </div>
        <div className="td-stat-item">
          <div className="td-stat-num">{bestWeekTestsByGrade.length}</div>
          <div className="td-stat-label">Grades Tracked</div>
        </div>
        <div className="td-stat-item">
          <div className="td-stat-num">{examPatterns.length}</div>
          <div className="td-stat-label">Exam Patterns</div>
        </div>
      </div>

      <div className="td-report-meta">
        <span>{teacher.name}</span>
        <span>{teacher.teacher_id}</span>
        <span>{schoolName}</span>
        <span>{new Date().toLocaleDateString("en-IN")}</span>
      </div>

      <button className="btn btn-primary td-report-btn" onClick={onDownload}>
        <Download size={16} />
        Download PDF Report
      </button>
    </section>
  );
}
