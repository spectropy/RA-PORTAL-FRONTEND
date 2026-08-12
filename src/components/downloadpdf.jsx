import { jsPDF } from "jspdf";
import "jspdf-autotable";

import spectropyLogoUrl from "../assets/logo.png";

const rankIconUrls = {
  class: "/assets/classrank.png",
  school: "/assets/schoolrank.png",
  allIndia: "/assets/allinidarank.png",
};

const subjectIconUrls = {
  maths: "/assets/pi.png",
  biology: "/assets/leaf.png",
};

// Optional approved CEO signature only.
// import ceoSignatureUrl from "../assets/ceo-signature.png";
const ceoSignatureUrl = null;

// ============================================================================
// IMAGE HELPERS
// ============================================================================

const toDataUrl = async (src) => {
  if (!src || typeof src !== "string") return null;
  if (/^data:image\/(png|jpe?g|webp|svg\+xml);/i.test(src)) return src;
  try {
    const res = await fetch(src, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Unable to load report image:", src, error);
    return null;
  }
};

const svgToPng = async (svg, width = 160, height = 160) => {
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = svgUrl;
  });
};

// ============================================================================
// ICON SVG LIBRARY
// ============================================================================

const ICON_SVG = {
  // ── Subject icons ──────────────────────────────────────────────────────────
  atom: (c = "#2563EB") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <g fill="none" stroke="${c}" stroke-width="3.5">
        <ellipse cx="32" cy="32" rx="27" ry="10"/>
        <ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(60 32 32)"/>
        <ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(120 32 32)"/>
      </g>
      <circle cx="32" cy="32" r="5.5" fill="${c}"/>
    </svg>`,

  magnet: (c = "#2563EB") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path d="M16 10h12v26c0 6.6 5.4 12 12 12s12-5.4 12-12V10h12v26c0 13.3-10.7 24-24 24S16 49.3 16 36V10Z"
        fill="${c}"/>
      <rect x="16" y="10" width="12" height="12" fill="#EF4444"/>
      <rect x="52" y="10" width="12" height="12" fill="#EF4444"/>
      <rect x="16" y="23" width="12" height="6" fill="white" opacity=".78"/>
      <rect x="52" y="23" width="12" height="6" fill="white" opacity=".78"/>
    </svg>`,

  bulb: (c = "#2563EB") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path d="M32 6c-11 0-20 8.7-20 19.5 0 6.8 3.4 11.5 7.2 15.1 2.2 2.1 3.8 4.8 4.5 7.8h16.6c.7-3 2.3-5.7 4.5-7.8C48.6 37 52 32.3 52 25.5 52 14.7 43 6 32 6Z"
        fill="${c}"/>
      <path d="M24 52h16M26 58h12" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
      <path d="M27 27h10l-6 9h8" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M18 8 13 3M46 8l5-5M32 1v6" stroke="${c}" stroke-width="4" stroke-linecap="round" opacity=".8"/>
    </svg>`,

  bolt: (c = "#2563EB") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path d="M36 3 10 36h19l-4 25 29-36H34l2-22Z"
        fill="${c}" stroke="${c}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M31 15 20 30h15l-2 12 11-14H31l0-13Z"
        fill="white" opacity=".82"/>
    </svg>`,

  flask: (c = "#0F9F95") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path d="M24 7h16M28 7v18L13 49c-3 5 0 8 5 8h28c5 0 8-3 5-8L36 25V7"
        fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path fill="${c}" opacity=".9" d="M18 45h28l5 9H13l5-9Z"/>
      <circle cx="27" cy="42" r="3" fill="${c}"/>
      <circle cx="38" cy="47" r="2.5" fill="white" opacity=".8"/>
    </svg>`,

  pi: (c = "#7C3FC2") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <text x="8" y="52" font-size="52" font-family="Georgia,serif"
        font-weight="700" fill="${c}">&#960;</text>
    </svg>`,

  leaf: (c = "#3A9D23") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path fill="${c}" d="M54 8C34 10 14 18 10 37c-2 9 4 17 13 17 22 0 31-25 31-46Z"/>
      <path d="M16 48C29 36 39 25 49 14" stroke="white" stroke-width="4" stroke-linecap="round"/>
    </svg>`,

  // ── Snapshot row icons ──────────────────────────────────────────────────────
  trophy: (c = "#F59E0B") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path fill="${c}" d="M20 8h24v11c0 12-6 20-12 20s-12-8-12-20V8Z"/>
      <path fill="none" stroke="${c}" stroke-width="5"
        d="M20 14H9c0 12 5 18 15 18M44 14h11c0 12-5 18-15 18"/>
      <path fill="${c}" d="M28 38h8v9h10v8H18v-8h10v-9Z"/>
    </svg>`,

  star: (c = "#1E55A0") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path fill="${c}"
        d="m32 6 7.7 15.7L57 24.2 44.5 36.4 47.5 54 32 45.8 16.5 54l3-17.6L7 24.2l17.3-2.5L32 6Z"/>
    </svg>`,

  target: (c = "#EA4335") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="24" fill="none" stroke="${c}" stroke-width="5"/>
      <circle cx="32" cy="32" r="14" fill="none" stroke="${c}" stroke-width="5"/>
      <circle cx="32" cy="32" r="5" fill="${c}"/>
      <path d="M32 32 55 9M46 8h10v10" stroke="${c}" stroke-width="4.5"
        stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

  // ── Ranking icons ──────────────────────────────────────────────────────────
  podium: (c = "#1E55A0") => `
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 64 64"
     fill="none">

  <!-- Trophy / achievement mark -->
  <path
    d="M32 5
       L34.2 9.5
       L39.2 10.2
       L35.6 13.7
       L36.5 18.6
       L32 16.2
       L27.5 18.6
       L28.4 13.7
       L24.8 10.2
       L29.8 9.5
       Z"
    fill="${c}"
  />

  <!-- Second place -->
  <rect
    x="5"
    y="37"
    width="16"
    height="21"
    rx="2.5"
    fill="${c}"
    opacity="0.72"
  />

  <!-- First place -->
  <rect
    x="24"
    y="26"
    width="16"
    height="32"
    rx="2.5"
    fill="${c}"
  />

  <!-- Third place -->
  <rect
    x="43"
    y="42"
    width="16"
    height="16"
    rx="2.5"
    fill="${c}"
    opacity="0.55"
  />

  <!-- Rank numbers -->
  <text
    x="32"
    y="40"
    text-anchor="middle"
    font-size="13"
    font-family="Arial, sans-serif"
    font-weight="700"
    fill="white"
  >1</text>

  <text
    x="13"
    y="50"
    text-anchor="middle"
    font-size="11"
    font-family="Arial, sans-serif"
    font-weight="700"
    fill="white"
  >2</text>

  <text
    x="51"
    y="53"
    text-anchor="middle"
    font-size="11"
    font-family="Arial, sans-serif"
    font-weight="700"
    fill="white"
  >3</text>

</svg>
`,

  school: (c = "#0F9F95") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path fill="${c}" d="M7 25 32 8l25 17v31H7V25Z"/>
      <rect x="14" y="31" width="8" height="8" fill="white"/>
      <rect x="42" y="31" width="8" height="8" fill="white"/>
      <rect x="27" y="39" width="10" height="17" fill="white"/>
      <path d="M31 8V2h12v11" stroke="${c}" stroke-width="4" fill="none"/>
    </svg>`,

  india: (c = "#7C3FC2") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path fill="${c}"
        d="M22 5 34 8l4 7 8 3-2 8 6 5-5 6-3 10-6 4-4 9-5-8-6-5-2-10-7-5 5-8-1-8 6-11Z"/>
      <circle cx="30" cy="23" r="3.5" fill="white"/>
    </svg>`,

  // ── Student card icons ─────────────────────────────────────────────────────
  medal: (c = "#1E55A0") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="36" width="13" height="20" rx="1.8" fill="${c}" opacity=".88"/>
      <rect x="26" y="25" width="13" height="31" rx="1.8" fill="${c}"/>
      <rect x="44" y="31" width="12" height="25" rx="1.8" fill="${c}" opacity=".78"/>
      <path d="M32 7 35 13l7 1-5 5 1 7-6-3.5L26 26l1-7-5-5 7-1 3-6Z" fill="${c}"/>
      <text x="12" y="51" font-size="10" font-family="Arial" font-weight="700" fill="white">2</text>
      <text x="30" y="43" font-size="10" font-family="Arial" font-weight="700" fill="white">1</text>
    </svg>`,

  buildingRank: (c = "#0F9F95") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path d="M8 26 32 10l24 16v32H8V26Z" fill="${c}"/>
      <rect x="16" y="32" width="8" height="8" fill="white" opacity=".95"/>
      <rect x="40" y="32" width="8" height="8" fill="white" opacity=".95"/>
      <rect x="27" y="43" width="10" height="15" fill="white" opacity=".95"/>
      <path d="M32 10V4h12v13" stroke="${c}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="32" cy="28" r="4" fill="white" opacity=".95"/>
    </svg>`,

  globeRank: (c = "#7C3FC2") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path fill="${c}" d="M23 5 35 8l4 7 8 3-2 8 6 5-5 6-3 10-6 4-4 8-6-7-6-5-2-10-7-5 5-8-1-8 7-11Z"/>
      <circle cx="31" cy="24" r="3.5" fill="white" opacity=".9"/>
      <path d="M18 46 10 58M44 45l8 13" stroke="${c}" stroke-width="4" stroke-linecap="round" opacity=".85"/>
    </svg>`,

  graduation: (c = "#1E55A0") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path fill="${c}" d="M3 22 32 7l29 15-29 15L3 22Z"/>
      <path fill="${c}" opacity=".85"
        d="M13 30v14c0 6 10 11 19 11s19-5 19-11V30l-19 10-19-10Z"/>
      <path stroke="${c}" stroke-width="4" stroke-linecap="round" d="M58 24v18"/>
      <circle cx="58" cy="46" r="4" fill="${c}"/>
    </svg>`,

  users: (c = "#1E55A0") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <circle cx="23" cy="20" r="10" fill="${c}"/>
      <circle cx="44" cy="22" r="8" fill="${c}" opacity=".8"/>
      <path fill="${c}" d="M5 54c1-14 8-21 18-21s17 7 18 21H5Z"/>
      <path fill="${c}" opacity=".8" d="M34 54c1-11 6-17 14-17 7 0 12 6 13 17H34Z"/>
    </svg>`,

  id: (c = "#1E55A0") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="8" y="12" width="48" height="40" rx="8"
        fill="none" stroke="${c}" stroke-width="5"/>
      <circle cx="25" cy="29" r="7" fill="${c}"/>
      <path fill="${c}" d="M15 44c1-8 5-12 10-12s9 4 10 12H15Z"/>
      <path d="M40 25h10M40 34h10M40 43h7"
        stroke="${c}" stroke-width="4" stroke-linecap="round"/>
    </svg>`,

  // ── Utility icons ──────────────────────────────────────────────────────────
  info: (c = "#1E55A0") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="26" fill="none" stroke="${c}" stroke-width="5"/>
      <circle cx="32" cy="20" r="3.5" fill="${c}"/>
      <path d="M32 29v18" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
    </svg>`,

  clipboard: (c = "#1E55A0") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect x="13" y="10" width="38" height="47" rx="5"
        fill="none" stroke="${c}" stroke-width="5"/>
      <rect x="22" y="5" width="20" height="12" rx="4" fill="${c}"/>
      <path d="M22 28h20M22 38h20M22 48h13"
        stroke="${c}" stroke-width="4" stroke-linecap="round"/>
    </svg>`,

  // ── Header icons ───────────────────────────────────────────────────────────
  pin: (c = "#B8D0EC") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path fill="${c}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75
        7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5
        2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>`,

  calIcon: (c = "#B8D0EC") => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path fill="${c}" d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5C3.89 3
        3.01 3.9 3.01 5L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1
        -.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>
    </svg>`,

  // ── Spectropy bar-chart brand icon (3 ascending bars) ─────────────────────
  spectropyBars: () => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 34">
      <rect x="1"  y="20" width="11" height="14" rx="2" fill="#818CF8"/>
      <rect x="15" y="10" width="11" height="24" rx="2" fill="#6366F1"/>
      <rect x="29" y="1"  width="11" height="33" rx="2" fill="#4F46E5"/>
    </svg>`,
};

// ============================================================================
// REPORT  —  generatePDF
// ============================================================================

export const generatePDF = async (studentData, schoolData, examResults) => {
  if (!studentData || !schoolData) {
    throw new Error("Missing required data for PDF generation");
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  if (typeof doc.autoTable !== "function") {
    throw new Error(
      'jspdf-autotable is not loaded. Add import "jspdf-autotable";',
    );
  }

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm

  // --------------------------------------------------------------------------
  // COLOUR PALETTE
  // --------------------------------------------------------------------------
  const C = {
    navy: [9, 42, 88],
    navyMid: [17, 61, 122],
    blue: [30, 85, 160],
    ink: [20, 33, 58],
    muted: [86, 102, 126],
    border: [214, 224, 238],
    border2: [194, 209, 226],
    white: [255, 255, 255],
    soft: [247, 250, 254],
    paleBlue: [241, 247, 255],
    track: [226, 231, 238],
    green: [25, 128, 64],
    red: [224, 55, 48],
    teal: [16, 146, 139],
    purple: [113, 67, 190],
    amber: [245, 158, 11],
  };

  // --------------------------------------------------------------------------
  // SUBJECTS  (unchanged)
  // --------------------------------------------------------------------------
  const SUBJECTS = [
    {
      key: "physics",
      label: "Physics",
      marks: "physics_marks",
      max: "max_marks_physics",
      color: [21, 96, 202],
      icon: "bolt",
    },
    {
      key: "chemistry",
      label: "Chemistry",
      marks: "chemistry_marks",
      max: "max_marks_chemistry",
      color: C.teal,
      icon: "flask",
    },
    {
      key: "maths",
      label: "Mathematics",
      marks: "maths_marks",
      max: "max_marks_maths",
      color: C.purple,
      icon: "pi",
    },
    {
      key: "biology",
      label: "Biology",
      marks: "biology_marks",
      max: "max_marks_biology",
      color: [58, 157, 35],
      icon: "leaf",
    },
  ];

  const useDummyExamResults = false;
  const dummyExamResults = Array.from({ length: 18 }, (_, index) => {
    const examNo = index + 1;
    const maxMarks = 100;
    const physics = 58 + ((index * 7) % 34);
    const chemistry = 55 + ((index * 5) % 36);
    const maths = 52 + ((index * 9) % 38);
    const biology = 60 + ((index * 6) % 32);
    const total = physics + chemistry + maths + biology;
    const percentage = (total / (maxMarks * 4)) * 100;

    return {
      date: `2026-${String(Math.floor(index / 3) + 1).padStart(2, "0")}-${String(
        6 + ((index * 4) % 22),
      ).padStart(2, "0")}`,
      exam: `Practice Assessment ${examNo}`,
      program: "IIT-MED",
      correct_answers: 24 + ((index * 3) % 28),
      wrong_answers: 4 + (index % 8),
      unattempted: 2 + ((index * 2) % 7),
      physics_marks: physics,
      max_marks_physics: maxMarks,
      chemistry_marks: chemistry,
      max_marks_chemistry: maxMarks,
      maths_marks: maths,
      max_marks_maths: maxMarks,
      biology_marks: biology,
      max_marks_biology: maxMarks,
      total_marks: total,
      percentage,
      class_rank: 1 + (index % 12),
      school_rank: 3 + ((index * 2) % 25),
      all_schools_rank: 25 + ((index * 11) % 180),
    };
  });
  const reportExamResults = useDummyExamResults
    ? dummyExamResults
    : examResults;
  if (!Array.isArray(reportExamResults) || !reportExamResults.length) {
    throw new Error("Missing required data for PDF generation");
  }

  // --------------------------------------------------------------------------
  // UTILITY FUNCTIONS  (unchanged)
  // --------------------------------------------------------------------------
  const safe = (v, fb = "-") =>
    v === null || v === undefined || v === "" ? fb : String(v);
  const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));

  const examName = (exam) => safe(exam?.exam, "Assessment").replace(/_/g, " ");
  const formatDate = (value) => {
    if (!value) return "-";
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return `${match[3]} ${months[Number(match[2]) - 1]} ${match[1]}`;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const subjectPct = (exam, subject) => {
    const max = Number(exam?.[subject.max]);
    if (!Number.isFinite(max) || max <= 0) return null;
    return clamp((Number(exam?.[subject.marks] || 0) / max) * 100);
  };

  const examMax = (exam, subjects) =>
    subjects.reduce((s, sub) => {
      const v = Number(exam?.[sub.max]);
      return s + (v > 0 ? v : 0);
    }, 0);

  const examTotal = (exam, subjects) => {
    const d = Number(exam?.total_marks ?? exam?.total);
    if (Number.isFinite(d)) return d;
    return subjects.reduce((s, sub) => s + Number(exam?.[sub.marks] || 0), 0);
  };

  const examPct = (exam, subjects) => {
    const d = Number(exam?.percentage);
    if (Number.isFinite(d)) return clamp(d);
    const max = examMax(exam, subjects);
    return max > 0 ? clamp((examTotal(exam, subjects) / max) * 100) : 0;
  };

  // --------------------------------------------------------------------------
  // DATA PROCESSING  (unchanged)
  // --------------------------------------------------------------------------
  const exams = [...reportExamResults].sort(
    (a, b) => new Date(a?.date || 0) - new Date(b?.date || 0),
  );

  let activeSubjects = SUBJECTS.filter((s) =>
    exams.some((e) => Number(e?.[s.max]) > 0),
  );
  if (!activeSubjects.length)
    activeSubjects = SUBJECTS.filter((s) =>
      exams.some((e) => e?.[s.marks] !== undefined),
    );
  if (!activeSubjects.length) activeSubjects = SUBJECTS;

  const averages = {};
  activeSubjects.forEach((s) => {
    const vals = exams.map((e) => subjectPct(e, s)).filter((v) => v !== null);
    averages[s.key] = vals.length
      ? vals.reduce((a, v) => a + v, 0) / vals.length
      : 0;
  });

  const rankedSubjects = activeSubjects
    .map((s) => ({ ...s, average: averages[s.key] || 0 }))
    .sort((a, b) => b.average - a.average);

  const strongest = rankedSubjects[0];
  const focus = rankedSubjects[rankedSubjects.length - 1];

  const overallAverage =
    exams.reduce((sum, e) => sum + examPct(e, activeSubjects), 0) /
    exams.length;

  const bestExam = exams.reduce(
    (best, cur) =>
      !best || examPct(cur, activeSubjects) > examPct(best, activeSubjects)
        ? cur
        : best,
    null,
  );

  const latestExam = exams[exams.length - 1];

  const PROGRAMS = {
    MAE: "Maestro",
    CAT: "Catalyst",
    PIO: "Pioneer",
    FF: "Future Foundation",
  };
  const programCode = safe(exams[0]?.program, "-").toUpperCase();
  const programName = PROGRAMS[programCode] || programCode;
  const subjectKeys = new Set(activeSubjects.map((s) => s.key));

  let stream = "";
  if (
    ["physics", "chemistry", "maths", "biology"].every((k) =>
      subjectKeys.has(k),
    )
  )
    stream = "IIT-MED";
  else if (["physics", "chemistry", "maths"].every((k) => subjectKeys.has(k)))
    stream = "IIT";
  else if (["physics", "chemistry", "biology"].every((k) => subjectKeys.has(k)))
    stream = "MED";

  const fullProgram = stream ? `${programName} / ${stream}` : programName;

  // --------------------------------------------------------------------------
  // IMAGE LOADING
  // --------------------------------------------------------------------------
  const [
    spectropyLogo,
    schoolLogo,
    ceoSignature,
    rankIcons,
    subjectIcons,
    iconMap,
  ] = await Promise.all([
    toDataUrl(spectropyLogoUrl),
    toDataUrl(
      schoolData?.logo_base64 ||
        schoolData?.logo_data_url ||
        schoolData?.logo_url,
    ),
    toDataUrl(ceoSignatureUrl),
    (async () => {
      const entries = await Promise.all(
        Object.entries(rankIconUrls).map(async ([k, src]) => [
          k,
          await toDataUrl(src),
        ]),
      );
      return Object.fromEntries(entries);
    })(),
    (async () => {
      const entries = await Promise.all(
        Object.entries(subjectIconUrls).map(async ([k, src]) => [
          k,
          await toDataUrl(src),
        ]),
      );
      return Object.fromEntries(entries);
    })(),
    (async () => {
      const entries = await Promise.all(
        Object.entries(ICON_SVG).map(async ([k, f]) => [
          k,
          await svgToPng(f(), 180, 180),
        ]),
      );
      return Object.fromEntries(entries);
    })(),
  ]);

  // ==========================================================================
  // DRAW HELPERS
  // ==========================================================================

  const setText = (size, color = C.ink, style = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const line = (x1, y1, x2, y2, color = C.border, width = 0.25) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x1, y1, x2, y2);
  };

  const dashedLine = (
    x1,
    y1,
    x2,
    y2,
    color = C.border,
    width = 0.3,
    dash = 2,
  ) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    const total = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.floor(total / (dash * 2));
    for (let i = 0; i < steps; i++) {
      const t1 = (i * 2 * dash) / total;
      const t2 = ((i * 2 + 1) * dash) / total;
      doc.line(
        x1 + (x2 - x1) * t1,
        y1 + (y2 - y1) * t1,
        x1 + (x2 - x1) * t2,
        y1 + (y2 - y1) * t2,
      );
    }
  };

  const rounded = (
    x,
    y,
    w,
    h,
    fill = C.white,
    border = C.border,
    radius = 3.5,
  ) => {
    doc.setFillColor(...fill);
    doc.setDrawColor(...border);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, w, h, radius, radius, "FD");
  };

  const drawImageContain = (dataUrl, x, y, w, h) => {
    if (!dataUrl) return false;
    try {
      const props = doc.getImageProperties(dataUrl);
      const scale = Math.min(w / props.width, h / props.height);
      const dw = props.width * scale;
      const dh = props.height * scale;
      const fmt = /^data:image\/jpe?g/i.test(dataUrl)
        ? "JPEG"
        : /^data:image\/webp/i.test(dataUrl)
          ? "WEBP"
          : "PNG";
      doc.addImage(dataUrl, fmt, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      return true;
    } catch (e) {
      console.warn("Image draw failed", e);
      return false;
    }
  };

  const drawImageCoverCircle = (dataUrl, cx, cy, r) => {
    if (!dataUrl) return false;
    try {
      const props = doc.getImageProperties(dataUrl);
      const box = r * 2;
      const scale = Math.max(box / props.width, box / props.height);
      const dw = props.width * scale;
      const dh = props.height * scale;
      const fmt = /^data:image\/jpe?g/i.test(dataUrl)
        ? "JPEG"
        : /^data:image\/webp/i.test(dataUrl)
          ? "WEBP"
          : "PNG";

      doc.saveGraphicsState();
      doc.circle(cx, cy, r, null);
      doc.clip();
      doc.discardPath();
      doc.addImage(dataUrl, fmt, cx - dw / 2, cy - dh / 2, dw, dh);
      doc.restoreGraphicsState();
      return true;
    } catch (e) {
      console.warn("Image draw failed", e);
      return false;
    }
  };

  const drawIconCircle = (
    iconKey,
    x,
    y,
    size,
    bg = [239, 246, 255],
    border = C.border,
  ) => {
    doc.setFillColor(...bg);
    doc.setDrawColor(...border);
    doc.setLineWidth(0.2);
    doc.circle(x, y, size / 2, "FD");
    drawImageContain(
      iconMap[iconKey],
      x - size * 0.28,
      y - size * 0.28,
      size * 0.56,
      size * 0.56,
    );
  };

  const drawRankImageCircle = (
    dataUrl,
    fallbackIcon,
    x,
    y,
    size,
    bg,
    border,
  ) => {
    doc.setFillColor(...bg);
    doc.setDrawColor(...border);
    doc.setLineWidth(0.35);
    doc.circle(x, y, size / 2, "FD");

    const imageAdded = drawImageContain(
      dataUrl,
      x - size * 0.36,
      y - size * 0.36,
      size * 0.72,
      size * 0.72,
    );

    if (!imageAdded) {
      drawImageContain(
        iconMap[fallbackIcon],
        x - size * 0.3,
        y - size * 0.3,
        size * 0.6,
        size * 0.6,
      );
    }
  };

  const fitText = (
    value,
    x,
    y,
    maxWidth,
    startSize,
    align = "left",
    color = C.ink,
    style = "bold",
  ) => {
    const str = safe(value);
    let size = startSize;
    doc.setFont("helvetica", style);
    while (size > 6.2) {
      doc.setFontSize(size);
      if (doc.getTextWidth(str) <= maxWidth) break;
      size -= 0.4;
    }
    doc.setTextColor(...color);
    doc.text(str, x, y, { align });
  };

  // ==========================================================================
  // HEADER  —  exact 3-zone design from reference image
  // ==========================================================================
  const HEADER_H = 27;

  const drawHeader = (pageLabel = null) => {
    // ── Navy background ───────────────────────────────────────────────────
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, pageWidth, HEADER_H, "F");

    // ── ZONE 1 : School info (left, x = 0 – 110) ─────────────────────────
    // White circle with subtle inner ring for school logo
    doc.setFillColor(...C.white);
    doc.setDrawColor(170, 200, 235);
    doc.setLineWidth(0.6);
    doc.circle(20.5, HEADER_H / 2, 9.6, "FD");

    const schoolAdded = drawImageCoverCircle(
      schoolLogo,
      20.5,
      HEADER_H / 2,
      9.2,
    );
    if (!schoolAdded) {
      // Placeholder: small navy filled inner circle + bold initial
      doc.setFillColor(...C.navy);
      doc.circle(20.5, HEADER_H / 2, 7.5, "F");
      setText(11, C.white, "bold");
      doc.text(
        safe(schoolData?.school_name, "S").charAt(0).toUpperCase(),
        20.5,
        HEADER_H / 2 + 4,
        { align: "center" },
      );
    }

    // School name
    fitText(
      safe(schoolData?.school_name, "School Name").toUpperCase(),
      33.5,
      9,
      74,
      11.8,
      "left",
      C.white,
    );

    // Location (pin icon + area)
    drawImageContain(iconMap["pin"], 33.5, 12.5, 3.8, 3.8);
    setText(6.2, [185, 210, 240], "normal");
    doc.text(safe(schoolData?.area, ""), 38.4, 15.2);

    // Academic year (calendar icon + text)
    drawImageContain(iconMap["calIcon"], 33.5, 17.2, 3.8, 3.8);
    setText(6.2, [185, 210, 240], "normal");
    doc.text(
      `Academic Year : ${safe(schoolData?.academic_year, "-")}`,
      38.4,
      19.8,
    );

    // ── Vertical divider 1 ────────────────────────────────────────────────
    doc.setDrawColor(100, 140, 185);
    doc.setLineWidth(0.45);
    // Section dividers intentionally omitted for a cleaner header.

    // ── ZONE 2 : Center title (x = 110 – 226) ───────────────────────────
    // Large report title
    fitText(
      "IIT FOUNDATION REPORT CARD",
      pageWidth / 2,
      11.5,
      82,
      18.5,
      "center",
      C.white,
    );

    if (pageLabel) {
      // Pill badge for page 2
      setText(7.5, C.white, "bold");
      const pw = doc.getTextWidth(pageLabel) + 10;
      doc.setFillColor(22, 70, 140);
      doc.setDrawColor(80, 130, 190);
      doc.setLineWidth(0.3);
      doc.roundedRect(pageWidth / 2 - pw / 2, 15, pw, 7.5, 3.5, 3.5, "FD");
      doc.setTextColor(...C.white);
      doc.text(pageLabel, pageWidth / 2, 20, { align: "center" });
    } else {
      // Subtitle with decorative horizontal lines on both sides
      const sub = "STUDENT PERFORMANCE REPORT";
      setText(6.8, [185, 210, 240], "normal");
      const tw = doc.getTextWidth(sub);
      const subY = 19.5;
      const lineY = subY - 1.8;
      const leftEnd = pageWidth / 2 - tw / 2 - 3;
      const rightStart = pageWidth / 2 + tw / 2 + 3;
      // Left rule
      doc.setDrawColor(130, 168, 215);
      doc.setLineWidth(0.35);
      doc.line(110, lineY, leftEnd, lineY);
      // Subtitle text
      doc.setTextColor(185, 210, 240);
      doc.text(sub, pageWidth / 2, subY, { align: "center" });
      // Right rule
      doc.line(rightStart, lineY, 187, lineY);
    }

    // ── Vertical divider 2 ────────────────────────────────────────────────
    doc.setDrawColor(100, 140, 185);
    doc.setLineWidth(0.45);
    // Section dividers intentionally omitted for a cleaner header.

    // ── ZONE 3 : Spectropy branding (right, x = 226 – 297) ───────────────
    doc.setFillColor(...C.white);
    doc.setDrawColor(170, 200, 235);
    doc.setLineWidth(0.6);
    doc.circle(249, HEADER_H / 2, 7.8, "FD");

    const spectropyAdded = drawImageContain(
      spectropyLogo,
      243.8,
      HEADER_H / 2 - 5.2,
      10.4,
      10.4,
    );

    if (!spectropyAdded) {
      doc.setFillColor(...C.navy);
      doc.circle(249, HEADER_H / 2, 6, "F");
      setText(9, C.white, "bold");
      doc.text("S", 249, HEADER_H / 2 + 3.2, { align: "center" });
    }
    // "SPECTROPY" bold white
    setText(12.5, C.white, "bold");
    doc.text("SPECTROPY", pageWidth - 10, 12.5, { align: "right" });
    // Powered by
    setText(6.4, [185, 210, 240], "normal");
    doc.text("Powered by Spectropy", pageWidth - 10, 17.8, {
      align: "right",
    });
  };

  // ==========================================================================
  // FOOTER
  // ==========================================================================
  const drawFooterBar = (pageText) => {
    doc.setFillColor(...C.navy);
    doc.rect(0, 198, pageWidth, 12, "F");

    setText(5.8, [185, 210, 240], "italic");
    doc.text(
      "This report is generated using data from the Spectropy evaluation platform.",
      pageWidth / 2,
      205.5,
      { align: "center" },
    );

    setText(6.5, C.white, "normal");
    doc.text(pageText, pageWidth - 12, 205.5, { align: "right" });
  };

  // ==========================================================================
  // PAGE 1
  // ==========================================================================

  drawHeader();

  // --------------------------------------------------------------------------
  // Student Hero Card  (y=29–51)
  // --------------------------------------------------------------------------
  rounded(8, 29, 281, 22, C.soft, C.border2, 3.5);

  // Student name + subtitle, vertically centered in the hero card.
  fitText(
    safe(studentData?.name, "Student Name").toUpperCase(),
    16,
    40.2,
    102,
    16.5,
    "left",
    C.navy,
  );
  setText(7, C.muted, "normal");
  doc.text("STUDENT PERFORMANCE PROFILE", 16, 44.8);

  // ── Meta chips (Grade | Section | Roll No.) ──
  // Chip 1 – Grade
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.border2);
  doc.setLineWidth(0.35);
  doc.roundedRect(112, 34.5, 112, 11, 3, 3, "FD");
  line(147.5, 36.4, 147.5, 43.3, C.border2, 0.3);
  line(184, 36.4, 184, 43.3, C.border2, 0.3);
  drawImageContain(iconMap["graduation"], 116, 36.8, 6, 6);
  setText(7.4, C.ink, "bold");
  doc.text(`${safe(studentData?.class)}`, 124, 41.5);

  // Chip 2 – Section
  drawImageContain(iconMap["users"], 152.2, 36.8, 6, 6);
  doc.text(`Section ${safe(studentData?.section)}`, 160.2, 41.5);

  // Chip 3 – Roll No
  drawImageContain(iconMap["id"], 189, 36.8, 6, 6);
  doc.text(`Roll No. ${safe(studentData?.roll_no)}`, 197.2, 41.5);

  // Program badge — solid navy pill (right)
  doc.setFillColor(...C.navy);
  doc.roundedRect(237, 34.2, 44, 12, 3.5, 3.5, "F");
  fitText(fullProgram.toUpperCase(), 259, 41.5, 41, 9, "center", C.white);

  // --------------------------------------------------------------------------
  // LEFT COLUMN — Subject Performance Card  (x=8, y=53, w=132.5, h=65)
  // --------------------------------------------------------------------------
  rounded(8, 53, 132.5, 65, C.white, C.border2, 3.5);

  setText(10.5, C.navy, "bold");
  doc.text("SUBJECT PERFORMANCE", 13, 60.5);
  setText(6.3, C.muted, "normal");
  doc.text("Subject-wise performance in current evaluation cycle", 13, 65.5);

  const subRowY = 76;
  const subRowH = 10.5;

  // Per-subject icon backgrounds matching the reference image colors
  const subjectIconBg = [
    [232, 241, 255], // Physics – light blue
    [226, 247, 245], // Chemistry – light teal
    [240, 233, 252], // Mathematics – light purple
    [229, 247, 227], // Biology – light green
  ];

  activeSubjects.forEach((subject, i) => {
    const y = subRowY + i * subRowH;
    const pct = clamp(averages[subject.key]);
    const bg = subjectIconBg[i] || [240, 244, 252];

    // Icon circle (colored bg, no border)
    doc.setFillColor(...bg);
    doc.setDrawColor(...bg);
    doc.setLineWidth(0);
    doc.circle(17.5, y, 4.4, "FD");
    drawImageContain(
      subjectIcons[subject.key] || iconMap[subject.icon],
      15,
      y - 2.5,
      5,
      5,
    );

    // Subject name
    setText(8.5, C.ink, "bold");
    doc.text(subject.label, 26, y + 1);

    // Progress bar
    const bx = 50,
      bw = 68;
    doc.setFillColor(...C.track);
    doc.roundedRect(bx, y - 2.1, bw, 4.4, 2.2, 2.2, "F");
    doc.setFillColor(...subject.color);
    doc.roundedRect(
      bx,
      y - 2.1,
      Math.max(0.5, (pct / 100) * bw),
      4.4,
      2.2,
      2.2,
      "F",
    );

    // Percentage value
    setText(10, C.navy, "bold");
    doc.text(`${pct.toFixed(0)}%`, 133, y + 2.5, { align: "right" });
  });

  // Percentage scale
  const scaleY = subRowY + activeSubjects.length * subRowH + 2.5;
  line(50, scaleY, 118, scaleY, C.border2, 0.3);
  [0, 25, 50, 75, 100].forEach((tick) => {
    const x = 50 + (tick / 100) * 68;
    line(x, scaleY, x, scaleY + 1.5, C.border2, 0.2);
    setText(5.2, C.muted, "normal");
    doc.text(`${tick}%`, x, scaleY + 4.5, { align: "center" });
  });

  // --------------------------------------------------------------------------
  // RIGHT COLUMN — Performance Snapshot Card  (x=144.5, y=53, w=144.5, h=65)
  // --------------------------------------------------------------------------
  rounded(144.5, 53, 144.5, 65, C.white, C.border2, 3.5);

  setText(10.5, C.navy, "bold");
  doc.text("PERFORMANCE SNAPSHOT", 149.5, 60.5);
  setText(6.3, C.muted, "normal");
  doc.text("Key highlights from current assessment cycle", 149.5, 65.5);

  // Vertical divider between overall-avg and snapshot rows
  line(202, 68, 202, 112, C.border, 0.3);

  // ── LEFT sub-section: Overall Average ─────────────────────────────────
  setText(7.8, C.navy, "bold");
  doc.text("OVERALL AVERAGE", 175, 80, { align: "center" });

  setText(29, C.navy, "bold");
  doc.text(`${overallAverage.toFixed(1)}%`, 175, 97, { align: "center" });

  // Progress bar
  doc.setFillColor(...C.track);
  doc.roundedRect(152, 101.5, 46, 4, 2, 2, "F");
  doc.setFillColor(20, 100, 210);
  doc.roundedRect(
    152,
    101.5,
    Math.max(0.6, (overallAverage / 100) * 46),
    4,
    2,
    2,
    "F",
  );

  // ── RIGHT sub-section: Best Exam / Strongest / Focus ──────────────────
  const snapRows = [
    {
      icon: "trophy",
      label: "BEST EXAM",
      sub: examName(bestExam),
      val: `${examPct(bestExam, activeSubjects).toFixed(1)}%`,
      bg: [255, 247, 229],
    },
    {
      icon: "star",
      label: "STRONGEST SUBJECT",
      sub: strongest?.label || "-",
      val: `${(strongest?.average || 0).toFixed(1)}%`,
      bg: [239, 246, 255],
    },
    {
      icon: "target",
      label: "FOCUS AREA",
      sub: focus?.label || "-",
      val: `${(focus?.average || 0).toFixed(1)}%`,
      bg: [255, 241, 239],
    },
  ];

  snapRows.forEach((row, i) => {
    const y = 75.5 + i * 13;
    if (i > 0) line(206, y - 6.5, 284, y - 6.5, C.border, 0.2);
    drawIconCircle(row.icon, 214.5, y, 9, row.bg, C.white);
    setText(6.4, C.ink, "bold");
    doc.text(row.label, 225, y - 1.2);
    setText(7, C.muted, "normal");
    doc.text(row.sub, 225, y + 3.4);
    setText(13, C.navy, "bold");
    doc.text(row.val, 282, y + 1.4, { align: "right" });
  });

  // --------------------------------------------------------------------------
  // Ranking Snapshot Card  (y=121, h=24.5)
  // --------------------------------------------------------------------------
  rounded(8, 121, 281, 24.5, C.white, C.border2, 3.5);

  setText(10.5, C.navy, "bold");
  doc.text("RANKING SNAPSHOT", 13, 128);
  setText(6.3, C.muted, "normal");
  doc.text("Overall standing in the current evaluation cycle", 13, 133);

  const rankItems = [
    {
      image: rankIcons.class,
      fallbackIcon: "medal",
      value: safe(latestExam?.class_rank),
      label: "CLASS RANK",
      color: C.blue,
      bg: [232, 242, 255],
    },
    {
      image: rankIcons.school,
      fallbackIcon: "buildingRank",
      value: safe(latestExam?.school_rank),
      label: "SCHOOL RANK",
      color: C.teal,
      bg: [226, 248, 246],
    },
    {
      image: rankIcons.allIndia,
      fallbackIcon: "globeRank",
      value: safe(latestExam?.all_schools_rank),
      label: "ALL INDIA RANK",
      color: C.purple,
      bg: [240, 233, 252],
    },
  ];

  rankItems.forEach((rank, i) => {
    const cx = 88 + i * 66.5;
    if (i > 0) line(cx - 33.2, 123, cx - 33.2, 141.5, C.border2, 0.3);

    drawRankImageCircle(
      rank.image,
      rank.fallbackIcon,
      cx - 10,
      131.5,
      14.5,
      rank.bg,
      C.border,
    );

    setText(22.5, rank.color, "bold");
    doc.text(String(rank.value), cx + 4.5, 133.2);

    setText(6.8, C.ink, "bold");
    doc.text(rank.label, cx + 4.5, 139.5);

    // Colored underline bar
    doc.setFillColor(...rank.color);
    doc.roundedRect(cx - 20, 141.8, 40, 1, 0.5, 0.5, "F");
  });

  // --------------------------------------------------------------------------
  // Insight / Info Card  (y=148, h=14)
  // --------------------------------------------------------------------------
  rounded(8, 148, 281, 14, C.paleBlue, [199, 218, 242], 3);

  drawIconCircle("info", 16.5, 155, 9, C.white, [199, 218, 242]);

  setText(9, C.ink, "normal");
  doc.text(
    `Strong overall achievement with excellent performance in ${strongest?.label || "the strongest subject"}.`,
    24,
    154.2,
  );
  setText(8, C.muted, "normal");
  doc.text(
    `Greater consistency in ${focus?.label || "the focus area"} can further improve the overall result.`,
    24,
    158.5,
  );

  // --------------------------------------------------------------------------
  // Signature Section  (y=164, h=30)
  // --------------------------------------------------------------------------
  rounded(8, 164, 281, 30, C.white, C.border2, 3.5);

  const sigLabels = [
    "SPECTROPY CEO",
    "PARENT / GUARDIAN",
    "IIT COORDINATOR",
    "SCHOOL PRINCIPAL",
  ];
  const latestDate = formatDate(latestExam?.date);

  sigLabels.forEach((label, i) => {
    const cellW = 281 / 4;
    const cellX = 8 + i * cellW;
    const center = cellX + cellW / 2;

    if (i > 0) line(cellX, 167, cellX, 190.5, C.border2, 0.3);

    // Role label
    setText(6.8, C.navy, "bold");
    doc.text(label, center, 170.5, { align: "center" });

    // Signature area
    if (i === 0 && ceoSignature) {
      drawImageContain(ceoSignature, center - 15, 172.5, 30, 8);
    } else {
      // Handwriting placeholder: gentle wavy-ish dashed line
      dashedLine(center - 17, 181, center + 17, 181, [160, 180, 210], 0.4, 1.8);
    }

    // Date
    setText(6.2, C.muted, "normal");
    doc.text(`Date:  ${latestDate}`, center, 189.5, { align: "center" });
  });

  drawFooterBar("Page 1 of 2");

  // ==========================================================================
  // PAGE 2  —  Assessment History ONLY  (no trend chart per reference)
  // ==========================================================================

  doc.addPage();
  drawHeader("PAGE 2 OF 2");

  // --------------------------------------------------------------------------
  // Large section title with big clipboard icon
  // --------------------------------------------------------------------------
  // Clipboard icon (large)
  drawIconCircle("clipboard", 18, 38.5, 13, [232, 241, 255], C.border);

  // "ASSESSMENT HISTORY" large bold
  setText(14, C.navy, "bold");
  doc.text("ACADEMIC PERFORMANCE RECORD", 26.5, 39);
  setText(7.5, C.muted, "normal");
  doc.text("Detailed Performance Across All Assessments", 26.5, 43);

  // --------------------------------------------------------------------------
  // Table
  // --------------------------------------------------------------------------
  const tableBody = exams.map((exam) => {
    const maximum = examMax(exam, activeSubjects);
    const total = examTotal(exam, activeSubjects);
    return [
      formatDate(exam?.date),
      examName(exam),
      String(Math.round(Number(exam?.correct_answers || 0))),
      String(Math.round(Number(exam?.wrong_answers || 0))),
      String(Math.round(Number(exam?.unattempted || 0))),
      ...activeSubjects.map((s) => {
        const pct = subjectPct(exam, s);
        return pct === null ? "-" : `${pct.toFixed(0)}%`;
      }),
      maximum > 0
        ? `${Math.round(total)}/${Math.round(maximum)}`
        : `${Math.round(total)}`,
      `${examPct(exam, activeSubjects).toFixed(1)}%`,
      safe(exam?.class_rank),
      safe(exam?.school_rank),
      safe(exam?.all_schools_rank),
    ];
  });

  const head = [
    [
      { content: "ASSESSMENT", colSpan: 2 },
      { content: "RESPONSE ANALYSIS", colSpan: 3 },
      { content: "SUBJECT PERFORMANCE(%)", colSpan: activeSubjects.length },
      { content: "RESULT", colSpan: 2 },
      { content: "RANKING", colSpan: 3 },
    ],
    [
      "Date",
      "Exam",
      "Correct",
      "Wrong",
      "Unattempted",
      ...activeSubjects.map((s) =>
        s.key === "chemistry"
          ? "CHEM"
          : s.key === "physics"
            ? "PHY"
            : s.key === "maths"
              ? "MATH"
              : "BIO",
      ),
      "Total\n(Max)",
      "%",
      "Class\nRank",
      "School\nRank",
      "All India\nRank",
    ],
  ];

  const percentageIndex = 5 + activeSubjects.length + 1;
  const lastRowIndex = tableBody.length - 1;
  const tableWidth = 281;
  const fixedColumnWidth = 24 + 41 + 17 + 16 + 25 + 22 + 15 + 18 + 19 + 22;
  const subjectColumnWidth =
    (tableWidth - fixedColumnWidth) / Math.max(activeSubjects.length, 1);
  const tableColumnStyles = {
    0: { cellWidth: 24 },
    1: { cellWidth: 41 },
    2: { cellWidth: 17 },
    3: { cellWidth: 16 },
    4: { cellWidth: 25 },
  };
  activeSubjects.forEach((_, i) => {
    tableColumnStyles[5 + i] = { cellWidth: subjectColumnWidth };
  });
  tableColumnStyles[5 + activeSubjects.length] = { cellWidth: 22 };
  tableColumnStyles[percentageIndex] = { cellWidth: 15 };
  tableColumnStyles[percentageIndex + 1] = { cellWidth: 18 };
  tableColumnStyles[percentageIndex + 2] = { cellWidth: 19 };
  tableColumnStyles[percentageIndex + 3] = { cellWidth: 22 };

  const tableStartY = 49;
  const tableTargetBottomY = 180;
  const estimatedHeaderHeight = 18.5;
  const targetBodyRowHeight =
    (tableTargetBottomY - tableStartY - estimatedHeaderHeight) /
    Math.max(tableBody.length, 1);
  const minBodyRowHeight = 6.5;
  const maxBodyRowHeight = 9.2;
  const tableBodyRowHeight = Math.max(
    minBodyRowHeight,
    Math.min(maxBodyRowHeight, targetBodyRowHeight),
  );
  const tableBodyFontSize = Math.max(
    6.3,
    Math.min(8.4, tableBodyRowHeight * 0.62),
  );
  const tableHeaderFontSize = Math.max(
    5.9,
    Math.min(7.2, tableBodyFontSize - 0.2),
  );
  const tableCellPadding = Math.max(
    0.75,
    Math.min(1.2, tableBodyRowHeight * 0.09),
  );

  doc.autoTable({
    head,
    body: tableBody,
    startY: tableStartY,
    theme: "grid",
    margin: { left: 8, right: 8, bottom: 18 },

    styles: {
      font: "helvetica",
      fontSize: tableBodyFontSize,
      textColor: C.ink,
      lineColor: C.border,
      lineWidth: 0.2,
      cellPadding: tableCellPadding,
      minCellHeight: tableBodyRowHeight,
      halign: "center",
      valign: "middle",
      overflow: "linebreak",
    },

    headStyles: {
      fillColor: C.navy,
      textColor: C.white,
      fontStyle: "bold",
      fontSize: tableHeaderFontSize,
      minCellHeight: Math.max(7.5, Math.min(8, tableBodyRowHeight * 0.84)),
      lineColor: [55, 95, 148],
      lineWidth: 0.25,
    },

    columnStyles: tableColumnStyles,

    alternateRowStyles: { fillColor: [248, 251, 255] },

    didParseCell: (data) => {
      if (data.section === "head" && data.row.index === 0) {
        data.cell.styles.fontSize = tableHeaderFontSize + 1;
      }

      // Sub-header row (row index 1) — slightly lighter navy
      if (data.section === "head" && data.row.index === 1) {
        data.cell.styles.fillColor = C.navyMid;
      }

      if (data.section !== "body") return;

      // Latest row — very light blue highlight
      if (data.row.index === lastRowIndex) {
        data.cell.styles.fillColor = [238, 246, 255];
      }

      // Correct answers — green bold
      if (data.column.index === 2) {
        data.cell.styles.textColor = C.green;
        data.cell.styles.fontStyle = "bold";
      }

      // Wrong answers — red bold
      if (data.column.index === 3) {
        data.cell.styles.textColor = C.red;
        data.cell.styles.fontStyle = "bold";
      }

      // Percentage column — navy bold (matching reference)
      if (data.column.index === percentageIndex) {
        data.cell.styles.textColor = C.navy;
        data.cell.styles.fontStyle = "bold";
      }
    },

    // Blue left-accent on latest row (first column only)
    didDrawCell: (data) => {
      if (
        data.section === "body" &&
        data.row.index === lastRowIndex &&
        data.column.index === 0
      ) {
        doc.setFillColor(30, 85, 160);
        doc.rect(data.cell.x, data.cell.y, 1.8, data.cell.height, "F");
      }
    },
  });

  // --------------------------------------------------------------------------
  // Info box below table
  // --------------------------------------------------------------------------
  const infoY = Math.min((doc.lastAutoTable?.finalY || 172) + 4, 182);
  rounded(8, infoY, 281, 9.5, C.soft, C.border, 2.5);
  drawIconCircle("info", 15, infoY + 4.8, 7, C.white, C.border);
  setText(6, C.muted, "normal");
  doc.text(
    "Rank values are calculated based on the performance of all students who appeared in the same assessment.",
    22,
    infoY + 5.5,
  );

  drawFooterBar("Page 2 of 2");

  // --------------------------------------------------------------------------
  // Save
  // --------------------------------------------------------------------------
  const safeStudentName = safe(studentData?.name, "Student")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");

  doc.save(
    `ReportCard_${safeStudentName}_${new Date().toISOString().split("T")[0]}.pdf`,
  );
};
