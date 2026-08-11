import { jsPDF } from "jspdf";
import "jspdf-autotable";

import spectropyLogoDataUrl from "../assets/spectropy-logo.png?inline";

const SPECTROPY_LOGO = spectropyLogoDataUrl;

// Keep null until you have the real approved signature.
// const CEO_SIGNATURE_IMAGE = ceoSignatureDataUrl;
const CEO_SIGNATURE_IMAGE = null;

export const generatePDF = (studentData, schoolData, examResults) => {
  if (
    !studentData ||
    !schoolData ||
    !Array.isArray(examResults) ||
    !examResults.length
  ) {
    throw new Error("Missing required data for PDF generation");
  }

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // IMPORTANT:
  // This confirms jspdf-autotable is loaded before continuing.
  if (typeof doc.autoTable !== "function") {
    throw new Error(
      "jspdf-autotable is not loaded. Check your jspdf-autotable import.",
    );
  }

  // =========================================================
  // THEME
  // =========================================================

  const C = {
    navy: [30, 85, 160],
    darkNavy: [23, 54, 93],

    ink: [23, 32, 51],
    muted: [103, 116, 136],

    white: [255, 255, 255],

    panel: [246, 248, 252],
    panelBlue: [242, 247, 255],

    border: [221, 228, 238],
    track: [231, 235, 240],

    green: [46, 139, 87],
    greenSoft: [237, 248, 241],

    amber: [216, 155, 36],

    red: [200, 90, 84],
    redSoft: [253, 241, 240],

    teal: [26, 145, 137],

    purple: [116, 82, 181],

    subjectBlue: [45, 108, 196],
  };

  // =========================================================
  // SUBJECT CONFIGURATION
  // =========================================================

  const SUBJECTS = [
    {
      key: "physics",
      label: "Physics",
      short: "Phy",
      marks: "physics_marks",
      max: "max_marks_physics",
      color: C.subjectBlue,
      badge: "P",
    },

    {
      key: "chemistry",
      label: "Chemistry",
      short: "Chem",
      marks: "chemistry_marks",
      max: "max_marks_chemistry",
      color: C.teal,
      badge: "C",
    },

    {
      key: "maths",
      label: "Mathematics",
      short: "Math",
      marks: "maths_marks",
      max: "max_marks_maths",
      color: C.purple,
      badge: "M",
    },

    {
      key: "biology",
      label: "Biology",
      short: "Bio",
      marks: "biology_marks",
      max: "max_marks_biology",
      color: C.green,
      badge: "B",
    },
  ];

  // =========================================================
  // BASIC HELPERS
  // =========================================================

  const text = (value, fallback = "—") => {
    if (value === null || value === undefined || value === "") {
      return fallback;
    }

    return String(value);
  };

  const clamp = (value) => {
    return Math.max(0, Math.min(100, Number(value) || 0));
  };

  const initials = (name) => {
    const parts = text(name, "Student").trim().split(/\s+/).filter(Boolean);

    return (
      parts
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "ST"
    );
  };

  const formatDate = (value) => {
    if (!value) return "—";

    const raw = String(value);

    // Prevent timezone shifting when backend gives YYYY-MM-DD
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

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

    if (Number.isNaN(date.getTime())) {
      return raw;
    }

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const examName = (exam) => {
    return text(exam?.exam, "Assessment").replace(/_/g, " ");
  };

  // =========================================================
  // PERCENTAGE HELPERS
  // =========================================================

  const subjectPct = (exam, subject) => {
    const maxMarks = Number(exam?.[subject.max]);

    if (!Number.isFinite(maxMarks) || maxMarks <= 0) {
      return null;
    }

    const marks = Number(exam?.[subject.marks] || 0);

    return clamp((marks / maxMarks) * 100);
  };

  const examMax = (exam, subjects) => {
    return subjects.reduce((sum, subject) => {
      const maxMarks = Number(exam?.[subject.max]);

      return sum + (Number.isFinite(maxMarks) && maxMarks > 0 ? maxMarks : 0);
    }, 0);
  };

  const examTotal = (exam, subjects) => {
    // Use backend total if available.
    const directTotal = Number(exam?.total_marks ?? exam?.total);

    if (Number.isFinite(directTotal)) {
      return directTotal;
    }

    // Otherwise calculate.
    return subjects.reduce(
      (sum, subject) => sum + Number(exam?.[subject.marks] || 0),
      0,
    );
  };

  const examPct = (exam, subjects) => {
    // Prefer backend percentage.
    const directPercentage = Number(exam?.percentage);

    if (Number.isFinite(directPercentage)) {
      return clamp(directPercentage);
    }

    const maximum = examMax(exam, subjects);

    if (maximum <= 0) return 0;

    return clamp((examTotal(exam, subjects) / maximum) * 100);
  };

  // =========================================================
  // IMAGE HELPERS
  // =========================================================

  const isDataImage = (src) => {
    return (
      typeof src === "string" && /^data:image\/(png|jpe?g);base64,/i.test(src)
    );
  };

  const addImageSafe = (src, x, y, width, height) => {
    if (!isDataImage(src)) {
      return false;
    }

    try {
      const format = /^data:image\/jpe?g/i.test(src) ? "JPEG" : "PNG";

      doc.addImage(src, format, x, y, width, height);

      return true;
    } catch (error) {
      console.warn("PDF image failed:", error);

      return false;
    }
  };

  // =========================================================
  // DRAWING HELPERS
  // =========================================================

  const line = (x1, y1, x2, y2, color = C.border, width = 0.25) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);

    doc.line(x1, y1, x2, y2);
  };

  const panel = (x, y, width, height, fill = C.white) => {
    doc.setFillColor(...fill);

    doc.setDrawColor(...C.border);

    doc.setLineWidth(0.25);

    doc.roundedRect(x, y, width, height, 3, 3, "FD");
  };

  const section = (label, x, y, width = 55) => {
    doc.setFillColor(...C.darkNavy);

    doc.roundedRect(x, y, width, 7, 1.5, 1.5, "F");

    doc.setFont("helvetica", "bold");

    doc.setFontSize(8.2);

    doc.setTextColor(...C.white);

    doc.text(label.toUpperCase(), x + 4, y + 4.8);
  };

  const fitText = (
    value,
    x,
    y,
    maxWidth,
    startSize,
    align = "left",
    color = C.ink,
  ) => {
    const valueString = text(value);

    let size = startSize;

    doc.setFont("helvetica", "bold");

    while (size > 6.5) {
      doc.setFontSize(size);

      if (doc.getTextWidth(valueString) <= maxWidth) {
        break;
      }

      size -= 0.5;
    }

    doc.setTextColor(...color);

    doc.text(valueString, x, y, {
      align,
    });
  };

  // =========================================================
  // PREPARE EXAM DATA
  // =========================================================

  const exams = [...examResults].sort((a, b) => {
    const aTime = new Date(a?.date || 0).getTime();

    const bTime = new Date(b?.date || 0).getTime();

    return aTime - bTime;
  });

  // Detect subjects using max marks first.
  let activeSubjects = SUBJECTS.filter((subject) =>
    exams.some((exam) => Number(exam?.[subject.max]) > 0),
  );

  // Fallback if max marks are missing.
  if (!activeSubjects.length) {
    activeSubjects = SUBJECTS.filter((subject) =>
      exams.some((exam) => exam?.[subject.marks] !== undefined),
    );
  }

  if (!activeSubjects.length) {
    activeSubjects = SUBJECTS;
  }

  // =========================================================
  // SUBJECT AVERAGES
  // =========================================================

  const averages = {};

  activeSubjects.forEach((subject) => {
    const values = exams
      .map((exam) => subjectPct(exam, subject))
      .filter((value) => value !== null);

    averages[subject.key] = values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;
  });

  const subjectRanking = activeSubjects
    .map((subject) => ({
      ...subject,

      average: averages[subject.key] || 0,
    }))
    .sort((a, b) => b.average - a.average);

  const strongest = subjectRanking[0];

  const focus = subjectRanking[subjectRanking.length - 1];

  // =========================================================
  // OVERALL PERFORMANCE
  // =========================================================

  const percentages = exams.map((exam) => examPct(exam, activeSubjects));

  const overallAverage =
    percentages.reduce((a, b) => a + b, 0) / percentages.length;

  const bestExam = exams.reduce((best, current) => {
    if (!best) {
      return current;
    }

    return examPct(current, activeSubjects) > examPct(best, activeSubjects)
      ? current
      : best;
  }, null);

  const firstExam = exams[0];

  const latestExam = exams[exams.length - 1];

  const firstPct = examPct(firstExam, activeSubjects);

  const latestPct = examPct(latestExam, activeSubjects);

  const change = latestPct - firstPct;

  // =========================================================
  // PROGRAM
  // =========================================================

  const PROGRAMS = {
    MAE: "Maestro",
    CAT: "Catalyst",
    PIO: "Pioneer",
    FF: "Future Foundation",
  };

  const programCode = text(exams[0]?.program, "—").toUpperCase();

  const programName = PROGRAMS[programCode] || programCode;

  const subjectKeys = new Set(activeSubjects.map((subject) => subject.key));

  let stream = "—";

  if (
    ["physics", "chemistry", "maths", "biology"].every((key) =>
      subjectKeys.has(key),
    )
  ) {
    stream = "IIT-MED";
  } else if (
    ["physics", "chemistry", "maths"].every((key) => subjectKeys.has(key))
  ) {
    stream = "IIT";
  } else if (
    ["physics", "chemistry", "biology"].every((key) => subjectKeys.has(key))
  ) {
    stream = "MED";
  }

  const fullProgram =
    stream === "—" ? programName : `${programName} • ${stream}`;

  // =========================================================
  // PERFORMANCE INSIGHT
  // =========================================================

  const insight = (() => {
    let opening = "Overall performance needs focused improvement";

    if (overallAverage >= 90) {
      opening = "Outstanding overall performance";
    } else if (overallAverage >= 80) {
      opening = "Strong overall achievement";
    } else if (overallAverage >= 70) {
      opening = "Good overall performance";
    } else if (overallAverage >= 60) {
      opening = "Satisfactory overall performance";
    }

    let trend =
      "Performance has remained broadly consistent across the assessment period.";

    if (change >= 5) {
      trend = `Performance improved by ${change.toFixed(
        1,
      )} percentage points across the assessment period.`;
    } else if (change <= -5) {
      trend =
        "Recent assessments show a decline, so greater consistency should be prioritised.";
    }

    return [
      `${opening}, with ${
        strongest?.label || "—"
      } emerging as the strongest subject.`,

      `${trend} Continued practice in ${
        focus?.label || "—"
      } can improve overall consistency.`,
    ];
  })();

  // =========================================================
  // SCHOOL LOGO
  // =========================================================

  const drawSchoolLogo = (x, y, size) => {
    // Only Base64/data URL logos are drawn directly.
    // Remote URLs automatically use school initial fallback.
    if (addImageSafe(schoolData?.logo_url, x, y, size, size)) {
      return;
    }

    doc.setFillColor(...C.white);

    doc.circle(x + size / 2, y + size / 2, size / 2, "F");

    doc.setFont("helvetica", "bold");

    doc.setFontSize(size * 0.75);

    doc.setTextColor(...C.darkNavy);

    const schoolInitial =
      text(schoolData?.school_name, "S").trim()[0]?.toUpperCase() || "S";

    doc.text(schoolInitial, x + size / 2, y + size * 0.68, {
      align: "center",
    });
  };

  // =========================================================
  // HEADER
  // =========================================================

  const drawHeader = (compact = false) => {
    const headerHeight = compact ? 21 : 24;

    doc.setFillColor(...C.darkNavy);

    doc.rect(0, 0, pageWidth, headerHeight, "F");

    // SCHOOL LOGO
    const logoSize = compact ? 13 : 15;

    drawSchoolLogo(9, (headerHeight - logoSize) / 2, logoSize);

    // SCHOOL NAME
    fitText(
      text(schoolData?.school_name, "School Name").toUpperCase(),
      27,
      compact ? 8.5 : 9.5,
      78,
      compact ? 11 : 12.5,
      "left",
      C.white,
    );

    // SCHOOL META
    doc.setFont("helvetica", "normal");

    doc.setFontSize(compact ? 7 : 7.7);

    doc.setTextColor(225, 233, 246);

    const headerMeta = [
      text(schoolData?.area, ""),

      schoolData?.academic_year
        ? `Academic Year: ${schoolData.academic_year}`
        : "",
    ]
      .filter(Boolean)
      .join(" • ");

    doc.text(headerMeta || "Student Performance Report", 27, compact ? 15 : 17);

    // DIVIDER
    line(111, 4.5, 111, headerHeight - 4.5, [92, 126, 169], 0.35);

    // REPORT TITLE
    fitText(
      "IIT FOUNDATION REPORT",
      pageWidth / 2,
      compact ? 9 : 10,
      95,
      compact ? 16 : 18,
      "center",
      C.white,
    );

    doc.setFont("helvetica", "normal");

    doc.setFontSize(compact ? 7.4 : 8.4);

    doc.setTextColor(225, 233, 246);

    doc.text(
      "STUDENT PERFORMANCE REPORT",
      pageWidth / 2,
      compact ? 15.5 : 17.5,
      {
        align: "center",
      },
    );

    // RIGHT DIVIDER
    line(220, 4.5, 220, headerHeight - 4.5, [92, 126, 169], 0.35);

    // SPECTROPY LOGO
    const spectropyAdded = addImageSafe(
      SPECTROPY_LOGO,
      pageWidth - 63,
      compact ? 5 : 5.5,
      12,
      12,
    );

    doc.setFont("helvetica", "bold");

    doc.setFontSize(compact ? 9 : 10);

    doc.setTextColor(...C.white);

    doc.text(
      "SPECTROPY",
      spectropyAdded ? pageWidth - 48 : pageWidth - 62,
      compact ? 10 : 10.5,
    );

    doc.setFont("helvetica", "normal");

    doc.setFontSize(6.7);

    doc.setTextColor(225, 233, 246);

    doc.text(
      "Powered by SPECTROPY",
      spectropyAdded ? pageWidth - 48 : pageWidth - 62,
      compact ? 15.5 : 16.3,
    );
  };

  // =========================================================
  // FOOTER
  // =========================================================

  const drawFooter = (pageNo, totalPages) => {
    line(10, pageHeight - 8.5, pageWidth - 10, pageHeight - 8.5);

    doc.setFont("helvetica", "normal");

    doc.setFontSize(6.5);

    doc.setTextColor(...C.muted);

    doc.text(
      "Student Performance Analytics • Generated by Spectropy",
      10,
      pageHeight - 4.4,
    );

    doc.text(
      `Page ${pageNo} of ${totalPages}`,
      pageWidth - 10,
      pageHeight - 4.4,
      {
        align: "right",
      },
    );
  };

  // =========================================================
  // PAGE 1
  // =========================================================

  drawHeader(false);

  // =========================================================
  // STUDENT IDENTITY
  // =========================================================

  const studentY = 29;

  panel(10, studentY, pageWidth - 20, 23, C.panelBlue);

  // INITIALS AVATAR
  doc.setFillColor(...C.white);

  doc.setDrawColor(...C.border);

  doc.circle(24, studentY + 11.5, 8.5, "FD");

  doc.setFont("helvetica", "bold");

  doc.setFontSize(12);

  doc.setTextColor(...C.navy);

  doc.text(initials(studentData?.name), 24, studentY + 14, {
    align: "center",
  });

  // STUDENT NAME
  fitText(
    text(studentData?.name, "Student Name").toUpperCase(),
    38,
    studentY + 10,
    110,
    17.5,
    "left",
    C.darkNavy,
  );

  // STUDENT DETAILS
  doc.setFont("helvetica", "normal");

  doc.setFontSize(9);

  doc.setTextColor(...C.ink);

  doc.text(`Grade: ${text(studentData?.class)}`, 38, studentY + 17.5);

  doc.text(`Section: ${text(studentData?.section)}`, 70, studentY + 17.5);

  doc.text(`Roll No.: ${text(studentData?.roll_no)}`, 106, studentY + 17.5);

  // PROGRAM BADGE
  doc.setFont("helvetica", "bold");

  doc.setFontSize(9);

  const programBadgeWidth = Math.max(
    36,
    Math.min(58, doc.getTextWidth(fullProgram.toUpperCase()) + 12),
  );

  doc.setFillColor(...C.darkNavy);

  doc.roundedRect(
    pageWidth - 15 - programBadgeWidth,
    studentY + 6.5,
    programBadgeWidth,
    10,
    3,
    3,
    "F",
  );

  doc.setTextColor(...C.white);

  doc.text(
    fullProgram.toUpperCase(),
    pageWidth - 15 - programBadgeWidth / 2,
    studentY + 13,
    {
      align: "center",
    },
  );

  // =========================================================
  // MAIN PERFORMANCE PANELS
  // =========================================================

  const mainY = 57;
  const mainHeight = 73;

  const leftX = 10;
  const leftWidth = 171;

  const rightX = 185;
  const rightWidth = pageWidth - rightX - 10;

  panel(leftX, mainY, leftWidth, mainHeight);

  panel(rightX, mainY, rightWidth, mainHeight);

  section("Subject Performance", leftX + 7, mainY + 5, 61);

  section("Performance Snapshot", rightX + 7, mainY + 5, 64);

  // =========================================================
  // SUBJECT BARS
  // =========================================================

  const subjectStartY = mainY + 21;

  const rowGap = activeSubjects.length <= 3 ? 17 : 14.5;

  activeSubjects.forEach((subject, index) => {
    const y = subjectStartY + index * rowGap;

    const percentage = clamp(averages[subject.key]);

    // Subject circular badge
    doc.setFillColor(...subject.color);

    doc.circle(leftX + 12, y + 3.3, 3.7, "F");

    doc.setFont("helvetica", "bold");

    doc.setFontSize(7.5);

    doc.setTextColor(...C.white);

    doc.text(subject.badge, leftX + 12, y + 5.4, {
      align: "center",
    });

    // Subject name
    doc.setFontSize(9.2);

    doc.setTextColor(...C.ink);

    doc.text(subject.label, leftX + 21, y + 5);

    // Progress track
    const barX = leftX + 58;

    const barWidth = leftWidth - 58 - 31;

    doc.setFillColor(...C.track);

    doc.roundedRect(barX, y + 0.5, barWidth, 5.5, 2.5, 2.5, "F");

    const fillWidth = (percentage / 100) * barWidth;

    if (fillWidth > 0.8) {
      doc.setFillColor(...subject.color);

      doc.roundedRect(barX, y + 0.5, fillWidth, 5.5, 2.5, 2.5, "F");
    }

    // Percentage
    doc.setFontSize(10.2);

    doc.setTextColor(...C.ink);

    doc.text(`${percentage.toFixed(0)}%`, leftX + leftWidth - 10, y + 5, {
      align: "right",
    });
  });

  // =========================================================
  // SUBJECT SCALE
  // =========================================================

  const scaleX = leftX + 58;

  const scaleWidth = leftWidth - 58 - 31;

  const scaleY = mainY + mainHeight - 8;

  line(scaleX, scaleY, scaleX + scaleWidth, scaleY);

  [0, 25, 50, 75, 100].forEach((value) => {
    const x = scaleX + (value / 100) * scaleWidth;

    line(x, scaleY - 1.5, x, scaleY + 1.5);

    doc.setFont("helvetica", "normal");

    doc.setFontSize(6.1);

    doc.setTextColor(...C.muted);

    doc.text(`${value}%`, x, scaleY + 5, {
      align: "center",
    });
  });

  // =========================================================
  // PERFORMANCE SNAPSHOT
  // =========================================================

  const snapshotCenterX = rightX + rightWidth / 2;

  doc.setFont("helvetica", "bold");

  doc.setFontSize(27);

  doc.setTextColor(...C.darkNavy);

  doc.text(`${overallAverage.toFixed(1)}%`, snapshotCenterX, mainY + 30, {
    align: "center",
  });

  doc.setFontSize(8);

  doc.setTextColor(...C.muted);

  doc.text("OVERALL AVERAGE", snapshotCenterX, mainY + 36, {
    align: "center",
  });

  line(rightX + 10, mainY + 41, rightX + rightWidth - 10, mainY + 41);

  const snapshotRows = [
    [
      "BEST EXAM",

      `${examName(bestExam)} • ${examPct(bestExam, activeSubjects).toFixed(
        1,
      )}%`,

      C.amber,
    ],

    [
      "STRONGEST SUBJECT",

      `${strongest?.label || "—"} • ${(strongest?.average || 0).toFixed(1)}%`,

      C.navy,
    ],

    [
      "FOCUS AREA",

      `${focus?.label || "—"} • ${(focus?.average || 0).toFixed(1)}%`,

      C.red,
    ],
  ];

  snapshotRows.forEach(([label, value, color], index) => {
    const y = mainY + 48 + index * 8.5;

    doc.setFillColor(...color);

    doc.circle(rightX + 10, y - 1.5, 1.6, "F");

    doc.setFont("helvetica", "bold");

    doc.setFontSize(6.7);

    doc.setTextColor(...C.muted);

    doc.text(label, rightX + 15, y);

    fitText(
      value,
      rightX + rightWidth - 8,
      y,
      rightWidth - 51,
      8.5,
      "right",
      C.ink,
    );
  });

  // =========================================================
  // RANKING SNAPSHOT
  // =========================================================

  const rankY = 135;

  panel(10, rankY, pageWidth - 20, 24);

  section("Ranking Snapshot", 17, rankY + 4, 49);

  const rankItems = [
    ["CLASS RANK", text(latestExam?.class_rank), C.navy],

    ["SCHOOL RANK", text(latestExam?.school_rank), C.teal],

    ["ALL INDIA RANK", text(latestExam?.all_schools_rank), C.purple],
  ];

  const rankLeft = 72;

  const rankRight = pageWidth - 18;

  const rankWidth = (rankRight - rankLeft) / 3;

  rankItems.forEach(([label, value, color], index) => {
    const x = rankLeft + index * rankWidth;

    const center = x + rankWidth / 2;

    if (index > 0) {
      line(x, rankY + 7, x, rankY + 19);
    }

    doc.setFont("helvetica", "bold");

    doc.setFontSize(18);

    doc.setTextColor(...color);

    doc.text(value, center, rankY + 13, {
      align: "center",
    });

    doc.setFontSize(7.2);

    doc.setTextColor(...C.ink);

    doc.text(label, center, rankY + 19.3, {
      align: "center",
    });
  });

  // =========================================================
  // PERFORMANCE INSIGHT
  // =========================================================

  const insightY = 164;

  panel(10, insightY, pageWidth - 20, 18, C.panelBlue);

  section("Performance Insight", 17, insightY + 3, 52);

  doc.setFont("helvetica", "normal");

  doc.setFontSize(8.1);

  doc.setTextColor(...C.ink);

  const insightLine1 = doc.splitTextToSize(insight[0], 200);

  const insightLine2 = doc.splitTextToSize(insight[1], 200);

  doc.text(insightLine1[0] || "", 76, insightY + 8.5);

  doc.text(insightLine2[0] || "", 76, insightY + 13.5);

  // =========================================================
  // SIGNATURES
  // =========================================================

  const signatureBaseY = 187;

  const signatureCellWidth = (pageWidth - 20) / 4;

  const signatures = [
    ["Spectropy CEO", CEO_SIGNATURE_IMAGE],

    ["Parent / Guardian", null],

    ["IIT Coordinator", null],

    ["School Principal", null],
  ];

  signatures.forEach(([label, signature], index) => {
    const x = 10 + index * signatureCellWidth;

    const center = x + signatureCellWidth / 2;

    // Vertical separators
    if (index > 0) {
      line(x, 185, x, 201);
    }

    // CEO signature only
    const hasSignature =
      index === 0 && addImageSafe(signature, center - 13, 184.5, 26, 7);

    if (!hasSignature) {
      line(
        center - 20,
        signatureBaseY + 3,
        center + 20,
        signatureBaseY + 3,
        [140, 150, 164],
      );
    }

    doc.setFont("helvetica", "bold");

    doc.setFontSize(7.4);

    doc.setTextColor(...C.ink);

    doc.text(label, center, 196.5, {
      align: "center",
    });

    doc.setFont("helvetica", "normal");

    doc.setFontSize(6.2);

    doc.setTextColor(...C.muted);

    doc.text(
      index === 0 && !hasSignature
        ? "Authorized Signatory"
        : "Date: ____________",
      center,
      201,
      {
        align: "center",
      },
    );
  });

  // =========================================================
  // PAGE 2
  // =========================================================

  doc.addPage();

  drawHeader(true);

  // =========================================================
  // TREND PANEL
  // =========================================================

  const trendY = 29;

  panel(10, trendY, pageWidth - 20, 66);

  section("Performance Trend", 17, trendY + 5, 51);

  const chartX = 26;
  const chartY = trendY + 18;

  const chartWidth = 178;
  const chartHeight = 38;

  // Y grid lines
  [0, 20, 40, 60, 80, 100].forEach((value) => {
    const y = chartY + chartHeight - (value / 100) * chartHeight;

    line(chartX, y, chartX + chartWidth, y, [232, 236, 242]);

    doc.setFont("helvetica", "normal");

    doc.setFontSize(6.2);

    doc.setTextColor(...C.muted);

    doc.text(String(value), chartX - 4, y + 2, {
      align: "right",
    });
  });

  // Axes
  line(chartX, chartY, chartX, chartY + chartHeight, [170, 180, 194]);

  line(
    chartX,
    chartY + chartHeight,
    chartX + chartWidth,
    chartY + chartHeight,
    [170, 180, 194],
  );

  // Show last 8 tests max.
  const chartExams = exams.slice(-8);

  const chartPoints = chartExams.map((exam, index) => {
    const percentage = examPct(exam, activeSubjects);

    const x =
      chartExams.length === 1
        ? chartX + chartWidth / 2
        : chartX + (index / (chartExams.length - 1)) * chartWidth;

    const y = chartY + chartHeight - (percentage / 100) * chartHeight;

    return {
      exam,
      percentage,
      x,
      y,
    };
  });

  // Trend line
  doc.setDrawColor(...C.navy);

  doc.setLineWidth(0.7);

  for (let i = 1; i < chartPoints.length; i++) {
    doc.line(
      chartPoints[i - 1].x,
      chartPoints[i - 1].y,
      chartPoints[i].x,
      chartPoints[i].y,
    );
  }

  // Trend points
  chartPoints.forEach((point, index) => {
    doc.setFillColor(...C.navy);

    doc.circle(point.x, point.y, 1.8, "F");

    // Percentage
    doc.setFont("helvetica", "bold");

    doc.setFontSize(6.4);

    doc.setTextColor(...C.ink);

    doc.text(`${point.percentage.toFixed(1)}%`, point.x, point.y - 3, {
      align: "center",
    });

    // Exam
    doc.setFont("helvetica", "normal");

    doc.setFontSize(5.8);

    doc.setTextColor(...C.muted);

    doc.text(
      examName(point.exam).slice(0, 10),
      point.x,
      chartY + chartHeight + 5,
      {
        align: "center",
      },
    );

    // Date
    if (
      chartPoints.length <= 6 ||
      index % 2 === 0 ||
      index === chartPoints.length - 1
    ) {
      doc.text(
        formatDate(point.exam?.date).replace(/\s\d{4}$/, ""),
        point.x,
        chartY + chartHeight + 9,
        {
          align: "center",
        },
      );
    }
  });

  // =========================================================
  // IMPROVEMENT SUMMARY
  // =========================================================

  const summaryX = 215;

  const summaryWidth = pageWidth - summaryX - 17;

  panel(
    summaryX,
    trendY + 15,
    summaryWidth,
    43,
    change >= 0 ? C.greenSoft : C.redSoft,
  );

  doc.setFont("helvetica", "bold");

  doc.setFontSize(8);

  doc.setTextColor(...C.muted);

  doc.text(
    change >= 0 ? "IMPROVEMENT" : "CHANGE",
    summaryX + summaryWidth / 2,
    trendY + 25,
    {
      align: "center",
    },
  );

  doc.setFontSize(22);

  doc.setTextColor(...(change >= 0 ? C.green : C.red));

  doc.text(
    `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
    summaryX + summaryWidth / 2,
    trendY + 38,
    {
      align: "center",
    },
  );

  doc.setFont("helvetica", "normal");

  doc.setFontSize(7);

  doc.setTextColor(...C.ink);

  doc.text(
    `${examName(firstExam)} → ${examName(latestExam)}`,
    summaryX + summaryWidth / 2,
    trendY + 46,
    {
      align: "center",
    },
  );

  line(summaryX + 7, trendY + 50, summaryX + summaryWidth - 7, trendY + 50);

  doc.setFont("helvetica", "bold");

  doc.setFontSize(7.1);

  doc.setTextColor(...C.muted);

  doc.text(
    `CURRENT ${latestPct.toFixed(1)}% • BEST ${examPct(
      bestExam,
      activeSubjects,
    ).toFixed(1)}%`,
    summaryX + summaryWidth / 2,
    trendY + 55.5,
    {
      align: "center",
    },
  );

  // =========================================================
  // ASSESSMENT HISTORY
  // =========================================================

  section("Assessment History", 17, 100, 50);

  doc.setFont("helvetica", "normal");

  doc.setFontSize(7.1);

  doc.setTextColor(...C.muted);

  doc.text(
    "Response accuracy, subject performance, total score, percentage and rankings",
    71,
    104.8,
  );

  // =========================================================
  // TABLE BODY
  // =========================================================

  const tableBody = exams.map((exam) => {
    const maximum = examMax(exam, activeSubjects);

    const total = examTotal(exam, activeSubjects);

    return [
      formatDate(exam?.date),

      examName(exam),

      String(Math.round(Number(exam?.correct_answers || 0))),

      String(Math.round(Number(exam?.wrong_answers || 0))),

      String(Math.round(Number(exam?.unattempted || 0))),

      ...activeSubjects.map((subject) => {
        const percentage = subjectPct(exam, subject);

        return percentage === null ? "—" : `${percentage.toFixed(0)}%`;
      }),

      maximum > 0
        ? `${Math.round(total)}/${Math.round(maximum)}`
        : `${Math.round(total)}`,

      `${examPct(exam, activeSubjects).toFixed(1)}%`,

      text(exam?.class_rank),

      text(exam?.school_rank),

      text(exam?.all_schools_rank),
    ];
  });

  // =========================================================
  // GROUPED TABLE HEADERS
  // =========================================================

  const head = [
    [
      {
        content: "ASSESSMENT",
        colSpan: 2,
      },

      {
        content: "RESPONSE ANALYSIS",
        colSpan: 3,
      },

      {
        content: "SUBJECT PERFORMANCE (%)",
        colSpan: activeSubjects.length,
      },

      {
        content: "RESULT",
        colSpan: 2,
      },

      {
        content: "RANKING",
        colSpan: 3,
      },
    ],

    [
      "Date",
      "Exam",

      "Correct",
      "Wrong",
      "Unattempted",

      ...activeSubjects.map((subject) => subject.short),

      "Total Marks",

      "Percentage",

      "Class Rank",

      "School Rank",

      "All India Rank",
    ],
  ];

  // =========================================================
  // TABLE COLUMN INDEXES
  // =========================================================

  const percentageColumn = 5 + activeSubjects.length + 1;

  const classRankColumn = percentageColumn + 1;

  const schoolRankColumn = percentageColumn + 2;

  const allIndiaRankColumn = percentageColumn + 3;

  // =========================================================
  // DRAW TABLE
  // =========================================================

  doc.autoTable({
    head,
    body: tableBody,

    startY: 111,

    theme: "grid",

    margin: {
      left: 10,
      right: 10,
      top: 27,
      bottom: 13,
    },

    styles: {
      font: "helvetica",

      fontSize: 7,

      textColor: C.ink,

      lineColor: C.border,

      lineWidth: 0.2,

      cellPadding: 1.45,

      halign: "center",

      valign: "middle",

      fillColor: C.white,

      overflow: "linebreak",
    },

    headStyles: {
      fillColor: C.darkNavy,

      textColor: C.white,

      fontStyle: "bold",

      fontSize: 6.7,

      halign: "center",

      valign: "middle",

      lineColor: [98, 124, 158],

      lineWidth: 0.2,
    },

    alternateRowStyles: {
      fillColor: [249, 250, 252],
    },

    columnStyles: {
      0: {
        cellWidth: 21,
      },

      1: {
        cellWidth: 27,
        fontStyle: "bold",
      },

      2: {
        cellWidth: 14,
      },

      3: {
        cellWidth: 14,
      },

      4: {
        cellWidth: 18,
      },
    },

    didParseCell: (data) => {
      if (data.section !== "body") {
        return;
      }

      // Highlight latest exam
      if (data.row.index === tableBody.length - 1) {
        data.cell.styles.fillColor = C.panelBlue;
      }

      // Correct answers = green
      if (data.column.index === 2) {
        data.cell.styles.textColor = C.green;

        data.cell.styles.fontStyle = "bold";
      }

      // Wrong answers = red
      if (data.column.index === 3) {
        data.cell.styles.textColor = C.red;

        data.cell.styles.fontStyle = "bold";
      }

      // Percentage
      if (data.column.index === percentageColumn) {
        data.cell.styles.textColor = C.navy;

        data.cell.styles.fontStyle = "bold";
      }

      // Ranking
      if (
        [classRankColumn, schoolRankColumn, allIndiaRankColumn].includes(
          data.column.index,
        )
      ) {
        data.cell.styles.fontStyle = "bold";
      }
    },

    didDrawPage: (data) => {
      // When table continues onto another page,
      // redraw the compact report header.
      if (data.pageNumber > 1) {
        drawHeader(true);
      }
    },
  });

  // =========================================================
  // TABLE NOTE
  // =========================================================

  const tableEndY = doc.lastAutoTable?.finalY || 170;

  if (tableEndY < pageHeight - 18) {
    doc.setFillColor(...C.panel);

    doc.roundedRect(10, tableEndY + 4, pageWidth - 20, 8, 2, 2, "F");

    doc.setFont("helvetica", "normal");

    doc.setFontSize(6.5);

    doc.setTextColor(...C.muted);

    doc.text(
      "Ranks shown are based on the values supplied in the assessment dataset.",
      14,
      tableEndY + 9.2,
    );
  }

  // =========================================================
  // FOOTERS
  // =========================================================

  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);

    drawFooter(page, totalPages);
  }

  // =========================================================
  // SAVE FILE
  // =========================================================

  const safeStudentName = text(studentData?.name, "Student")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");

  const fileName = `ReportCard_${safeStudentName}_${
    new Date().toISOString().split("T")[0]
  }.pdf`;

  doc.save(fileName);
};
