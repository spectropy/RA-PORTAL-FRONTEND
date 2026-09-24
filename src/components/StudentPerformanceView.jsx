import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Award,
  BarChart3,
  Brain,
  Calculator,
  FileDown,
  FlaskConical,
  Hash,
  Leaf,
  Lightbulb,
  Settings,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
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

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

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
  { key: "physics", label: "Physics", color: COLORS.blue, iconColor: "#8f6df6", Icon: Activity },
  { key: "chemistry", label: "Chemistry", color: COLORS.cyan, iconColor: "#10a878", Icon: FlaskConical },
  { key: "maths", label: "Mathematics", color: COLORS.violet, iconColor: "#1681ff", Icon: Calculator },
  { key: "biology", label: "Biology", color: COLORS.green, iconColor: "#fb5b7b", Icon: Leaf },
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

const SUBJECT_GROUPS = {
  PCM: ["physics", "chemistry", "maths"],
  PCB: ["physics", "chemistry", "biology"],
  PCMB: ["physics", "chemistry", "maths", "biology"],
};

const getResultSubjects = (result = {}) => {
  const group = String(result.subject_group || "").toUpperCase();
  const keys = SUBJECT_GROUPS[group] || SUBJECTS.map((subject) => subject.key);

  return SUBJECTS.filter((subject) => keys.includes(subject.key)).map(
    (subject) => ({
      ...subject,
      marks: result[`${subject.key}_marks`],
      correct: result[`${subject.key}_correct_answers`],
      incorrect: result[`${subject.key}_incorrect_answers`],
      notAttempted: result[`${subject.key}_not_attempted`],
    }),
  );
};

const getQuestionRows = (questionResults) => {
  if (!questionResults) return [];

  const parsed =
    typeof questionResults === "string"
      ? (() => {
          try {
            return JSON.parse(questionResults);
          } catch {
            return null;
          }
        })()
      : questionResults;

  if (!parsed || typeof parsed !== "object") return [];

  return Object.entries(parsed)
    .map(([question, value]) => {
      const option = value?.option ?? value?.options ?? "";
      const marks = value?.marks ?? "";

      return {
        question,
        option,
        key: value?.key ?? "",
        marks,
        status:
          value?.status ||
          (option ? (toNum(marks) > 0 ? "Correct" : "Incorrect") : "Not Attempted"),
      };
    })
    .sort((a, b) => {
      const first = Number(String(a.question).match(/\d+/)?.[0] || 0);
      const second = Number(String(b.question).match(/\d+/)?.[0] || 0);
      return first - second;
    });
};

const BLOOM_SKILLS = [
  { key: "Remember", color: "#2f8cff", group: "LOTS" },
  { key: "Understand", color: "#34c99a", group: "LOTS" },
  { key: "Apply", color: "#0891b2", group: "HOTS" },
  { key: "Analyse", color: "#ff8a45", group: "HOTS" },
  { key: "Evaluate", color: "#ff5f7d", group: "HOTS" },
  { key: "Create", color: "#8f6df6", group: "HOTS" },
];

const BLOOM_SKILL_ICONS = {
  Remember: Brain,
  Understand: Award,
  Apply: Lightbulb,
  Analyse: BarChart3,
  Evaluate: Target,
  Create: Settings,
};

const normalizeQuestionLabel = (value) =>
  String(value || "").trim().toUpperCase().replace(/\s+/g, "");

const getSubjectMasteryBand = (percentage) => {
  if (percentage === null || percentage === undefined) {
    return { key: "unassessed", label: "No questions" };
  }
  if (percentage >= 80) return { key: "excellent", label: "Excellent" };
  if (percentage >= 60) return { key: "proficient", label: "Proficient" };
  if (percentage >= 40) return { key: "developing", label: "Developing" };
  return { key: "support", label: "Needs Support" };
};

function BloomSkillLegend() {
  return (
    <div className="sp-bloom-chart-legend">
      {BLOOM_SKILLS.map((skill) => (
        <span key={skill.key}>
          <i style={{ background: skill.color }} />
          {skill.key}
        </span>
      ))}
    </div>
  );
}

const parseQuestionResults = (value) => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" ? value : {};
};

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

const getBloomSkill = (details = {}) =>
  normalizeBloomSkill(
    details?.blooms_skill ||
      details?.bloomsSkill ||
      details?.["Blooms Skill"] ||
      details?.["Bloom's Skill"],
  );

const normalizeCognitiveSubject = (value) => {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (["physics", "phy"].includes(normalized)) return "physics";
  if (["chemistry", "chemical science", "chem"].includes(normalized)) {
    return "chemistry";
  }
  if (["math", "maths", "mathematics"].includes(normalized)) return "maths";
  if (["biology", "bio", "biological science"].includes(normalized)) {
    return "biology";
  }
  return "";
};

const getQuestionNumber = (question) =>
  Number(String(question || "").match(/\d+/)?.[0] || 0);

const getCognitiveSubject = (
  details = {},
  question = "",
  result = {},
  totalQuestionCount = 0,
) => {
  const storedSubject = normalizeCognitiveSubject(
    details?.subject ||
      details?.Subject ||
      details?.subject_name ||
      details?.subjectName,
  );
  if (storedSubject) return storedSubject;

  const activeSubjects = getResultSubjects(result);
  const questionNumber = getQuestionNumber(question);
  if (!questionNumber || !activeSubjects.length) return "";

  const questionsPerSubject = Math.max(
    1,
    Math.ceil((totalQuestionCount || questionNumber) / activeSubjects.length),
  );
  const subjectIndex = Math.min(
    activeSubjects.length - 1,
    Math.floor((questionNumber - 1) / questionsPerSubject),
  );
  return activeSubjects[subjectIndex]?.key || "";
};

const getCognitiveResponseStatus = (details = {}) => {
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

const emptyCognitiveCounts = () => ({
  correct: 0,
  incorrect: 0,
  unattempted: 0,
  total: 0,
});

const addCognitiveResponse = (bucket, status) => {
  bucket.total += 1;
  bucket[status] += 1;
};

const cognitivePercentage = (bucket) =>
  bucket.total > 0 ? round((bucket.correct / bucket.total) * 100) : null;

const getCognitiveLevel = (percentage) => {
  if (percentage === null) return { label: "No questions", tone: "primary" };
  if (percentage >= 80) return { label: "Advanced Thinker", tone: "success" };
  if (percentage >= 60) return { label: "Proficient", tone: "primary" };
  if (percentage >= 40) return { label: "Developing", tone: "warning" };
  return { label: "Foundation", tone: "danger" };
};

const buildStudentCognitiveAnalysis = (examResults = []) => {
  const skills = Object.fromEntries(
    BLOOM_SKILLS.map(({ key }) => [key, emptyCognitiveCounts()]),
  );
  const lots = emptyCognitiveCounts();
  const hots = emptyCognitiveCounts();
  const overall = emptyCognitiveCounts();
  const subjects = Object.fromEntries(
    SUBJECTS.map((subject) => [
      subject.key,
      {
        ...subject,
        overall: emptyCognitiveCounts(),
        lots: emptyCognitiveCounts(),
        hots: emptyCognitiveCounts(),
        skills: Object.fromEntries(
          BLOOM_SKILLS.map(({ key }) => [key, emptyCognitiveCounts()]),
        ),
      },
    ]),
  );
  let allQuestions = 0;
  let subjectTaggedQuestions = 0;

  const chronologicalResults = [...examResults].sort((a, b) => {
    const first = a.date ? new Date(a.date).getTime() : 0;
    const second = b.date ? new Date(b.date).getTime() : 0;
    return first - second;
  });

  const trend = chronologicalResults.map((result, index) => {
    const examOverall = emptyCognitiveCounts();
    const examLots = emptyCognitiveCounts();
    const examHots = emptyCognitiveCounts();
    const questions = parseQuestionResults(result.question_results);
    const questionEntries = Object.entries(questions);
    const totalQuestionCountForMapping = Math.max(
      ...questionEntries.map(([question]) => getQuestionNumber(question)),
      questionEntries.length,
      0,
    );
    allQuestions += questionEntries.length;

    questionEntries.forEach(([question, details]) => {
      const skill = getBloomSkill(details);
      if (!skill) return;

      const status = getCognitiveResponseStatus(details);
      const group = BLOOM_SKILLS.find((item) => item.key === skill)?.group;
      const groupBucket = group === "LOTS" ? lots : hots;
      const examGroupBucket = group === "LOTS" ? examLots : examHots;
      const subjectKey = getCognitiveSubject(
        details,
        question,
        result,
        totalQuestionCountForMapping,
      );

      addCognitiveResponse(skills[skill], status);
      addCognitiveResponse(groupBucket, status);
      addCognitiveResponse(overall, status);
      addCognitiveResponse(examGroupBucket, status);
      addCognitiveResponse(examOverall, status);

      if (subjectKey && subjects[subjectKey]) {
        const subject = subjects[subjectKey];
        const subjectGroupBucket = group === "LOTS" ? subject.lots : subject.hots;
        addCognitiveResponse(subject.skills[skill], status);
        addCognitiveResponse(subjectGroupBucket, status);
        addCognitiveResponse(subject.overall, status);
        subjectTaggedQuestions += 1;
      }
    });

    return {
      exam: formatExamName(result.exam, `Exam ${index + 1}`),
      shortExam: `E${index + 1}`,
      date: formatDate(result.date),
      overall: cognitivePercentage(examOverall),
      lots: cognitivePercentage(examLots),
      hots: cognitivePercentage(examHots),
      taggedQuestions: examOverall.total,
    };
  });

  const skillPerformance = BLOOM_SKILLS.map(({ key, color, group }) => ({
    skill: key,
    color,
    group,
    ...skills[key],
    percentage: cognitivePercentage(skills[key]),
  }));
  const overallPercentage = cognitivePercentage(overall);
  const lotsPercentage = cognitivePercentage(lots);
  const hotsPercentage = cognitivePercentage(hots);
  const gap =
    lotsPercentage !== null && hotsPercentage !== null
      ? round(lotsPercentage - hotsPercentage)
      : null;
  const coverage = allQuestions > 0 ? round((overall.total / allQuestions) * 100) : 0;
  const sufficientlyMeasured = skillPerformance
    .filter((skill) => skill.total >= 3 && skill.percentage !== null)
    .sort((a, b) => b.percentage - a.percentage);
  const strongestSkill = sufficientlyMeasured[0] || null;
  const weakestSkill = sufficientlyMeasured[sufficientlyMeasured.length - 1] || null;
  const insights = [];

  if (strongestSkill) {
    insights.push(
      `${strongestSkill.skill} is the strongest measured cognitive skill at ${strongestSkill.percentage}%.`,
    );
  }
  if (weakestSkill && weakestSkill.skill !== strongestSkill?.skill) {
    insights.push(
      `${weakestSkill.skill} needs the most support at ${weakestSkill.percentage}%.`,
    );
  }
  if (gap !== null) {
    if (gap >= 10) {
      insights.push(`HOTS trails LOTS by ${gap} percentage points; prioritise application and reasoning practice.`);
    } else if (gap <= -10) {
      insights.push(`HOTS leads LOTS by ${Math.abs(gap)} percentage points; reinforce recall and conceptual foundations.`);
    } else {
      insights.push("LOTS and HOTS performance is balanced within 10 percentage points.");
    }
  }
  if (coverage < 70) {
    insights.push(`Bloom coverage is ${coverage}%; interpret the result cautiously until more questions are tagged.`);
  }

  const subjectPerformance = SUBJECTS.map(({ key }) => {
    const subject = subjects[key];
    const skillResults = BLOOM_SKILLS.map(({ key: skill, color, group }) => ({
      skill,
      color,
      group,
      ...subject.skills[skill],
      percentage: cognitivePercentage(subject.skills[skill]),
    }));
    const overallMastery = cognitivePercentage(subject.overall);
    const lotsMastery = cognitivePercentage(subject.lots);
    const hotsMastery = cognitivePercentage(subject.hots);

    return {
      key: subject.key,
      label: subject.label,
      color: subject.color,
      iconColor: subject.iconColor,
      Icon: subject.Icon,
      overall: overallMastery,
      lots: lotsMastery,
      hots: hotsMastery,
      gap:
        lotsMastery !== null && hotsMastery !== null
          ? round(lotsMastery - hotsMastery)
          : null,
      correct: subject.overall.correct,
      total: subject.overall.total,
      skills: skillResults,
      ...Object.fromEntries(
        skillResults.map((skill) => [skill.skill, skill.percentage]),
      ),
    };
  }).filter((subject) => subject.total > 0);

  const measuredSubjects = subjectPerformance
    .filter((subject) => subject.total >= 3)
    .sort((a, b) => b.overall - a.overall);
  const strongestSubject = measuredSubjects[0] || null;
  const prioritySubject = measuredSubjects[measuredSubjects.length - 1] || null;

  return {
    hasData: overall.total > 0,
    overall: { ...overall, percentage: overallPercentage },
    lots: { ...lots, percentage: lotsPercentage },
    hots: { ...hots, percentage: hotsPercentage },
    level: getCognitiveLevel(overallPercentage),
    gap,
    coverage,
    allQuestions,
    untaggedQuestions: Math.max(0, allQuestions - overall.total),
    skillPerformance,
    trend,
    insights,
    subjectPerformance,
    subjectTaggedQuestions,
    subjectCoverage:
      overall.total > 0 ? round((subjectTaggedQuestions / overall.total) * 100) : 0,
    strongestSubject,
    prioritySubject,
  };
};

const sanitizeFileName = (value) =>
  String(value || "exam")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_");

const getStudentDetailsLine = (studentData = {}, result = {}) => {
  const grade = studentData?.class ? `${studentData.class}` : "Grade";
  const section = studentData?.section ? `Section ${studentData.section}` : "Section";
  const rollNo =
    studentData?.roll_no || studentData?.student_id || result?.student_id || "-";
  const programGroup = [result?.program, result?.subject_group]
    .filter(Boolean)
    .join(" / ");

  return [
    studentData?.name || "Student",
    grade,
    section,
    `Roll No. ${rollNo}`,
    formatDate(result?.date),
    programGroup,
  ]
    .filter(Boolean)
    .join("  -  ");
};

const toDataUrl = async (src) => {
  if (!src || typeof src !== "string") return null;
  if (/^data:image\/(png|jpe?g|webp|svg\+xml);/i.test(src)) return src;

  try {
    const response = await fetch(src, { mode: "cors" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Unable to load analytics report image:", src, error);
    return null;
  }
};

const downloadExamAnalyticsReport = async ({
  studentName,
  studentData,
  schoolData,
  result,
  questionRows,
  cognitiveAnalysis,
}) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const navy = [15, 47, 99];
  const title = formatExamName(result.exam, "Exam");
  const generatedOn = new Date().toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const [schoolLogo, spectropyLogo] = await Promise.all([
    toDataUrl(
      schoolData?.logo_base64 || schoolData?.logo_data_url || schoolData?.logo_url,
    ),
    toDataUrl(spectropyLogoUrl),
  ]);

  doc.setProperties({
    title: `${title} Analytics Report`,
    subject: "Student cognitive and question-wise analytics",
    creator: "SPECTROPY Result Analysis Portal",
  });

  const getImageFormat = (dataUrl) => {
    if (/^data:image\/jpe?g/i.test(dataUrl)) return "JPEG";
    if (/^data:image\/webp/i.test(dataUrl)) return "WEBP";
    return "PNG";
  };

  const drawImageContain = (dataUrl, x, y, w, h) => {
    if (!dataUrl) return false;

    try {
      const props = doc.getImageProperties(dataUrl);
      const scale = Math.min(w / props.width, h / props.height);
      const dw = props.width * scale;
      const dh = props.height * scale;
      doc.addImage(
        dataUrl,
        getImageFormat(dataUrl),
        x + (w - dw) / 2,
        y + (h - dh) / 2,
        dw,
        dh,
      );
      return true;
    } catch (error) {
      console.warn("Unable to draw analytics report image:", error);
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

      doc.saveGraphicsState();
      doc.circle(cx, cy, r, null);
      doc.clip();
      doc.discardPath();
      doc.addImage(
        dataUrl,
        getImageFormat(dataUrl),
        cx - dw / 2,
        cy - dh / 2,
        dw,
        dh,
      );
      doc.restoreGraphicsState();
      return true;
    } catch (error) {
      console.warn("Unable to draw analytics report circle image:", error);
      return false;
    }
  };

  const drawLocationIcon = (x, y) => {
    doc.setFillColor(190, 213, 240);
    doc.circle(x, y - 1.45, 1.25, "F");
    doc.triangle(x - 0.9, y - 0.6, x + 0.9, y - 0.6, x, y + 1.15, "F");
    doc.setFillColor(15, 47, 99);
    doc.circle(x, y - 1.5, 0.38, "F");
  };

  const drawCalendarIcon = (x, y) => {
    doc.setDrawColor(190, 213, 240);
    doc.setLineWidth(0.22);
    doc.roundedRect(x - 1.35, y - 2.2, 2.7, 2.9, 0.3, 0.3, "S");
    doc.line(x - 1.35, y - 1.3, x + 1.35, y - 1.3);
    doc.line(x - 0.72, y - 2.65, x - 0.72, y - 1.9);
    doc.line(x + 0.72, y - 2.65, x + 0.72, y - 1.9);
  };

  const drawHeader = () => {
    const headerHeight = 34;

    doc.setFillColor(...navy);
    doc.rect(0, 0, pageWidth, headerHeight, "F");

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(170, 200, 235);
    doc.setLineWidth(0.6);
    doc.circle(16, headerHeight / 2, 9.6, "FD");

    const schoolAdded = drawImageCoverCircle(schoolLogo, 16, headerHeight / 2, 8.6);
    if (!schoolAdded) {
      doc.setFillColor(...navy);
      doc.circle(16, headerHeight / 2, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(
        String(schoolData?.school_name || "S").charAt(0).toUpperCase(),
        16,
        headerHeight / 2 + 3.5,
        { align: "center" },
      );
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.3);
    doc.setTextColor(255, 255, 255);
    const schoolName = String(schoolData?.school_name || "School Name").toUpperCase();
    doc.text(doc.splitTextToSize(schoolName, 43), 29, 10.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(190, 213, 240);
    drawLocationIcon(30, 18.3);
    if (schoolData?.area) {
      doc.text(String(schoolData.area), 34, 18.3);
    }
    drawCalendarIcon(30, 24);
    doc.text(`Academic Year : ${schoolData?.academic_year || "-"}`, 34, 24);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.2);
    doc.setTextColor(255, 255, 255);
    doc.text("STUDENT ANALYTICS REPORT", pageWidth / 2, 13, {
      align: "center",
    });

    doc.setDrawColor(130, 168, 215);
    doc.setLineWidth(0.35);
    doc.line(pageWidth / 2 - 38, 21, pageWidth / 2 - 18, 21);
    doc.line(pageWidth / 2 + 18, 21, pageWidth / 2 + 38, 21);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(190, 213, 240);
    doc.text("COGNITIVE & QUESTION ANALYSIS", pageWidth / 2, 23, {
      align: "center",
    });

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(170, 200, 235);
    doc.setLineWidth(0.6);
    doc.circle(pageWidth - 48, headerHeight / 2, 8.6, "FD");
    const spectropyAdded = drawImageCoverCircle(
      spectropyLogo,
      pageWidth - 48,
      headerHeight / 2,
      7.4,
    );
    if (!spectropyAdded) {
      doc.setFillColor(...navy);
      doc.circle(pageWidth - 48, headerHeight / 2, 6.2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("S", pageWidth - 48, headerHeight / 2 + 2.8, {
        align: "center",
      });
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.setTextColor(255, 255, 255);
    doc.text("SPECTROPY", pageWidth - 12, 14, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(190, 213, 240);
    doc.text("Powered by Spectropy", pageWidth - 12, 20, { align: "right" });
  };

  const addFooter = () => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on ${generatedOn}`, margin, pageHeight - 8);
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, {
        align: "right",
      });
    }
  };

  const contentWidth = pageWidth - margin * 2;
  const pdfBandStyle = (percentage) => {
    const band = getSubjectMasteryBand(percentage);
    if (band.key === "excellent") {
      return {
        ...band,
        fill: [217, 248, 230],
        text: [4, 120, 87],
        accent: [16, 185, 129],
      };
    }
    if (band.key === "proficient") {
      return {
        ...band,
        fill: [232, 250, 239],
        text: [21, 128, 61],
        accent: [73, 214, 135],
      };
    }
    if (band.key === "developing") {
      return {
        ...band,
        fill: [255, 246, 214],
        text: [146, 64, 14],
        accent: [245, 197, 24],
      };
    }
    if (band.key === "support") {
      return {
        ...band,
        fill: [255, 231, 237],
        text: [190, 18, 60],
        accent: [244, 63, 104],
      };
    }
    return {
      ...band,
      fill: [242, 246, 250],
      text: [71, 85, 105],
      accent: [148, 163, 184],
    };
  };

  const formatPdfPercent = (value) =>
    value === null || value === undefined ? "-" : `${value}%`;

  const ensureSpace = (neededHeight, currentY) => {
    if (currentY + neededHeight <= pageHeight - 16) return currentY;
    doc.addPage();
    drawHeader();
    return 43;
  };

  const drawSectionTitle = (label, description, y, rightText = "") => {
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(description, margin, y + 5);
    if (rightText) {
      doc.setFillColor(239, 246, 255);
      doc.setTextColor(0, 53, 122);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      const pillWidth = Math.max(22, doc.getTextWidth(rightText) + 8);
      doc.roundedRect(pageWidth - margin - pillWidth, y - 4.5, pillWidth, 8, 3, 3, "F");
      doc.text(rightText, pageWidth - margin - pillWidth / 2, y + 0.7, {
        align: "center",
      });
    }
  };

  const drawMiniCard = ({ x, y, w, h, label, value, note, border, fill }) => {
    doc.setFillColor(...fill);
    doc.setDrawColor(...border);
    doc.setLineWidth(0.55);
    doc.roundedRect(x, y, w, h, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.7);
    doc.setTextColor(0, 53, 122);
    doc.text(String(label || "").toUpperCase(), x + 4, y + 5.2);
    doc.setFontSize(13.5);
    doc.setTextColor(15, 23, 42);
    doc.text(String(value || "-"), x + 4, y + 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.9);
    doc.setTextColor(71, 85, 105);
    doc.text(doc.splitTextToSize(String(note || ""), w - 8), x + 4, y + h - 4.5);
  };

  drawHeader();

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(title, margin, 43);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12.8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    getStudentDetailsLine({ ...studentData, name: studentName }, result),
    margin,
    50,
  );

  doc.autoTable({
    startY: 58,
    theme: "grid",
    margin: { left: margin, right: margin },
    head: [["Total Marks", "Percentage", "Class Rank", "School Rank", "All India Rank"]],
    body: [
      [
        round(result.total, 0),
        `${round(result.percentage)}%`,
        result.class_rank ?? "—",
        result.school_rank ?? "—",
        result.all_schools_rank ?? "—",
      ],
    ],
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 4,
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      fillColor: [239, 246, 255],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      lineColor: [203, 213, 225],
    },
    bodyStyles: {
      textColor: [15, 23, 42],
      fontStyle: "bold",
    },
  });

  let y = doc.lastAutoTable.finalY + 12;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Subject-wise analytics", margin, y);

  doc.autoTable({
    startY: y + 5,
    theme: "striped",
    margin: { left: margin, right: margin },
    head: [["Subject", "Marks", "Correct", "Incorrect", "Not Attempted"]],
    body: subjectRows.map((subject) => [
      subject.label,
      toNum(subject.marks),
      toNum(subject.correct),
      toNum(subject.incorrect),
      toNum(subject.notAttempted),
    ]),
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      cellPadding: 3.5,
      valign: "middle",
    },
    headStyles: {
      fillColor: navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  y = doc.lastAutoTable.finalY + 12;
  if (y > pageHeight - 50) {
    doc.addPage();
    y = margin;
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Question-wise analytics", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`${questionRows.length} questions`, pageWidth - margin, y, {
    align: "right",
  });

  doc.autoTable({
    startY: y + 5,
    theme: "grid",
    margin: { left: margin, right: margin },
    tableWidth: "auto",
    head: [["Question", "Option", "Key", "Marks", "Status", "Peer correct %"]],
    body: questionRows.map((question) => [
      question.question,
      question.option || "—",
      question.key || "—",
      question.marks === "" ? "—" : question.marks,
      question.status || "—",
      question.peerCorrectPercentage === null
        ? "—"
        : `${question.peerCorrectPercentage}%`,
    ]),
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 2.8,
      valign: "middle",
    },
    headStyles: {
      fillColor: navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      lineColor: navy,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 27 },
      2: { cellWidth: 27 },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 38 },
      5: { cellWidth: "auto", halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 4) return;

      const status = String(data.cell.raw || "").toLowerCase();
      data.cell.styles.fontStyle = "bold";
      data.cell.styles.halign = "center";

      if (status.includes("incorrect")) {
        data.cell.styles.fillColor = [254, 226, 226];
        data.cell.styles.textColor = [153, 27, 27];
      } else if (status.includes("correct")) {
        data.cell.styles.fillColor = [220, 252, 231];
        data.cell.styles.textColor = [22, 101, 52];
      } else if (status.includes("not") || status.includes("unattempted")) {
        data.cell.styles.fillColor = [254, 249, 195];
        data.cell.styles.textColor = [133, 77, 14];
      }

      return;
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 5) return;

      const percentage = Number.parseFloat(String(data.cell.raw || ""));
      if (!Number.isFinite(percentage)) return;

      const x = data.cell.x + 2;
      const y = data.cell.y + data.cell.height - 2.4;
      const width = Math.max(0, data.cell.width - 4);
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(x, y, width, 1.2, 0.6, 0.6, "F");
      if (percentage > 0) {
        doc.setFillColor(59, 130, 246);
        doc.roundedRect(x, y, width * clamp(percentage, 0, 100) / 100, 1.2, 0.6, 0.6, "F");
      }
    },
  });

  addFooter();

  const fileName = [
    sanitizeFileName(studentName),
    sanitizeFileName(formatExamName(result.exam, "Exam")),
    "analytics_report.pdf",
  ].join("_");

  doc.save(fileName);
};

const downloadExamAnalyticsLandscapeReport = ({
  studentName,
  studentData,
  result,
  questionRows,
  cognitiveAnalysis,
}) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;
  const contentWidth = pageWidth - margin * 2;
  const title = formatExamName(result.exam, "Exam");
  const analysis = cognitiveAnalysis || buildStudentCognitiveAnalysis([result]);
  const navy = [15, 47, 99];
  const softBorder = [203, 213, 225];
  const generatedOn = new Date().toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  doc.setProperties({
    title: `${title} Analytics Report`,
    subject: "Student cognitive and question-wise analytics",
    creator: "SPECTROPY Result Analysis Portal",
  });

  const bandStyle = (percentage) => {
    const band = getSubjectMasteryBand(percentage);
    if (band.key === "excellent") return { ...band, fill: [217, 248, 230], text: [4, 120, 87], bar: [16, 185, 129] };
    if (band.key === "proficient") return { ...band, fill: [232, 250, 239], text: [21, 128, 61], bar: [73, 214, 135] };
    if (band.key === "developing") return { ...band, fill: [255, 246, 214], text: [146, 64, 14], bar: [245, 197, 24] };
    if (band.key === "support") return { ...band, fill: [255, 231, 237], text: [190, 18, 60], bar: [244, 63, 104] };
    return { ...band, fill: [242, 246, 250], text: [71, 85, 105], bar: [148, 163, 184] };
  };

  const pct = (value) => (value === null || value === undefined ? "-" : `${value}%`);
  const ensureSpace = (needed, y) => {
    if (y + needed <= pageHeight - 12) return y;
    doc.addPage();
    return margin + 4;
  };

  const drawPill = (text, x, y) => {
    const width = Math.max(22, doc.getTextWidth(text) + 7);
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(x - width, y - 4.5, width, 7.5, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.setTextColor(0, 53, 122);
    doc.text(text, x - width / 2, y + 0.6, { align: "center" });
  };

  const drawSection = (heading, description, y, rightText = "", pillYOffset = 0) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.4);
    doc.setTextColor(15, 23, 42);
    doc.text(heading, margin + 3, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text(description, margin + 3, y + 5);
    if (rightText) drawPill(rightText, pageWidth - margin - 3, y);
  };

  const drawCard = ({ x, y, w, h, label, value, note, border, fill }) => {
    doc.setFillColor(...fill);
    doc.setDrawColor(...border);
    doc.setLineWidth(0.45);
    doc.roundedRect(x, y, w, h, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5);
    doc.setTextColor(0, 53, 122);
    doc.text(String(label).toUpperCase(), x + 3, y + 4.2);
    doc.setFontSize(11.8);
    doc.setTextColor(15, 23, 42);
    doc.text(String(value), x + 3, y + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.2);
    doc.setTextColor(71, 85, 105);
    doc.text(doc.splitTextToSize(String(note), w - 6), x + 3, y + h - 3.5);
  };

  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...softBorder);
  doc.roundedRect(margin, 7, contentWidth, 20, 2.5, 2.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...navy);
  doc.text("STUDENT ANALYTICS REPORT", margin + 5, 15);
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(title, pageWidth - margin - 5, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(getStudentDetailsLine({ ...studentData, name: studentName }, result), margin + 5, 22);
  doc.text(`Generated on ${generatedOn}`, pageWidth - margin - 5, 21, { align: "right" });

  let y = 36;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...softBorder);
  doc.roundedRect(margin, y - 8, contentWidth, 38, 2, 2, "FD");
  drawSection(
    "Cognitive Analysis",
    "Bloom-tagged mastery for this exam only.",
    y - 2,
    `${analysis.overall.total} tagged response${analysis.overall.total === 1 ? "" : "s"}`,
  );

  if (analysis.hasData) {
    const gap = 4;
    const cardW = (contentWidth - 18 - gap * 3) / 4;
    const cardY = y + 6;
    [
      ["Overall mastery", pct(analysis.overall.percentage), `${analysis.overall.correct}/${analysis.overall.total} correct`, [59, 130, 246], [239, 246, 255]],
      ["LOTS", pct(analysis.lots.percentage), "Remember + Understand", [16, 185, 129], [236, 253, 245]],
      ["HOTS", pct(analysis.hots.percentage), "Apply + Analyse + Evaluate + Create", [245, 158, 11], [255, 251, 235]],
      [
        "Cognitive level",
        analysis.level.label,
        analysis.gap === null ? "LOTS/HOTS gap unavailable" : `${Math.abs(analysis.gap)} point LOTS/HOTS gap`,
        [37, 99, 235],
        [248, 250, 252],
      ],
    ].forEach(([label, value, note, border, fill], index) => {
      drawCard({
        x: margin + 9 + (cardW + gap) * index,
        y: cardY,
        w: cardW,
        h: 17,
        label,
        value,
        note,
        border,
        fill,
      });
    });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("Cognitive analysis is unavailable because this exam does not have Bloom-tagged questions.", margin + 12, y + 12);
  }

  y = 70;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...softBorder);
  doc.roundedRect(margin, y - 8, contentWidth, 86, 2, 2, "FD");
  drawSection(
    "Subject-wise Cognitive Analytics",
    "Subject mastery calculated from this exam's Bloom-tagged questions.",
    y - 2,
    `${analysis.subjectPerformance.length} subject${analysis.subjectPerformance.length === 1 ? "" : "s"}`,
  );

  if (analysis.subjectPerformance.length > 0) {
    const subjectGap = 4;
    const subjectW = (contentWidth - 18 - subjectGap * 3) / 4;
    const subjectY = y + 7;
    const subjectColors = [[139, 92, 246], [6, 182, 212], [37, 99, 235], [244, 63, 94]];
    analysis.subjectPerformance.slice(0, 4).forEach((subject, index) => {
      const x = margin + 9 + (subjectW + subjectGap) * index;
      const color = subjectColors[index] || [37, 99, 235];
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...softBorder);
      doc.roundedRect(x, subjectY, subjectW, 23, 2, 2, "FD");
      doc.setFillColor(...color);
      doc.circle(x + 6, subjectY + 7, 3.2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);
      doc.text(subject.label, x + 11, subjectY + 8);
      doc.setFontSize(11.5);
      doc.setTextColor(...color);
      doc.text(pct(subject.overall), x + subjectW - 5, subjectY + 8, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.3);
      doc.setTextColor(71, 85, 105);
      doc.text(`${subject.correct}/${subject.total} tagged questions correct`, x + 5, subjectY + 14);
      doc.setFillColor(232, 250, 239);
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(x + 5, subjectY + 16.5, subjectW / 2 - 7, 5, 1.4, 1.4, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(4.9);
      doc.setTextColor(0, 121, 90);
      doc.text(`LOTS ${pct(subject.lots)}`, x + subjectW / 4 + 1, subjectY + 20, { align: "center" });
      doc.setFillColor(255, 237, 213);
      doc.setDrawColor(253, 186, 116);
      doc.roundedRect(x + subjectW / 2 + 2, subjectY + 16.5, subjectW / 2 - 7, 5, 1.4, 1.4, "FD");
      doc.setTextColor(194, 65, 12);
      doc.text(`HOTS ${pct(subject.hots)}`, x + subjectW * 0.75 - 1, subjectY + 20, { align: "center" });
    });

    doc.autoTable({
      startY: subjectY + 29,
      theme: "grid",
      margin: { left: margin + 5, right: margin + 5 },
      tableWidth: contentWidth - 10,
      head: [["Subject", ...BLOOM_SKILLS.map((skill) => skill.key), "Subject Level"]],
      body: analysis.subjectPerformance.map((subject) => {
        const subjectBand = bandStyle(subject.overall);
        return [
          subject.label,
          ...BLOOM_SKILLS.map(({ key }) => {
            const skill = subject.skills.find((item) => item.skill === key);
            return skill?.percentage === null ? "-\nN/A" : `${skill.percentage}%\n${skill.correct}/${skill.total}`;
          }),
          `${subjectBand.label}\n${pct(subject.overall)}`,
        ];
      }),
      styles: {
        font: "helvetica",
        fontSize: 5.8,
        cellPadding: 1.8,
        halign: "center",
        valign: "middle",
        lineColor: [226, 232, 240],
        textColor: [15, 23, 42],
      },
      headStyles: {
        fillColor: [239, 246, 255],
        textColor: [15, 23, 42],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 31, halign: "left", fontStyle: "bold" },
        7: { cellWidth: 33, fontStyle: "bold" },
      },
      didParseCell: (data) => {
        if (data.section === "head" && data.column.index > 0 && data.column.index < 7) {
          const color = BLOOM_SKILLS[data.column.index - 1].color.replace("#", "");
          const red = Number.parseInt(color.slice(0, 2), 16);
          const green = Number.parseInt(color.slice(2, 4), 16);
          const blue = Number.parseInt(color.slice(4, 6), 16);
          data.cell.styles.fillColor = [
            Math.round(red + (255 - red) * 0.78),
            Math.round(green + (255 - green) * 0.78),
            Math.round(blue + (255 - blue) * 0.78),
          ];
        }
        if (data.section !== "body") return;
        if (data.column.index > 0 && data.column.index < 7) {
          const subject = analysis.subjectPerformance[data.row.index];
          const skill = subject.skills[data.column.index - 1];
          const style = bandStyle(skill?.percentage);
          data.cell.styles.fillColor = style.fill;
          data.cell.styles.fontStyle = skill?.percentage === null ? "normal" : "bold";
        }
        if (data.column.index === 7) {
          const style = bandStyle(analysis.subjectPerformance[data.row.index].overall);
          data.cell.styles.fillColor = style.fill;
          data.cell.styles.textColor = style.text;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = doc.lastAutoTable.finalY + 12;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("No subject-level Bloom-tagged data is available for this exam.", margin + 12, y + 18);
    y += 28;
  }

  y = ensureSpace(45, y);
  drawSection(
    "Question-wise Analytics",
    "Stored response evidence and the percentage of other students who answered each question correctly.",
    y,
    `${questionRows.length} questions`,
  );

  doc.autoTable({
    startY: y + 9,
    theme: "grid",
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [["Question", "Option", "Key", "Marks", "Status", "Peer correct %"]],
    body: questionRows.map((question) => [
      question.question,
      question.option || "-",
      question.key || "-",
      question.marks === "" ? "-" : question.marks,
      question.status || "-",
      question.peerCorrectPercentage === null ? "-" : `${question.peerCorrectPercentage}%`,
    ]),
    styles: {
      font: "helvetica",
      fontSize: 7.2,
      cellPadding: 2.5,
      valign: "middle",
      lineColor: [226, 232, 240],
    },
    headStyles: {
      fillColor: [239, 246, 255],
      textColor: [51, 65, 85],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      3: { cellWidth: 25, halign: "center" },
      4: { cellWidth: 40, halign: "center" },
      5: { cellWidth: "auto", halign: "center", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (data.column.index === 4) {
        const status = String(data.cell.raw || "").toLowerCase();
        data.cell.styles.fontStyle = "bold";
        if (status.includes("incorrect")) {
          data.cell.styles.fillColor = [254, 226, 226];
          data.cell.styles.textColor = [220, 38, 38];
        } else if (status.includes("correct")) {
          data.cell.styles.fillColor = [220, 252, 231];
          data.cell.styles.textColor = [5, 150, 105];
        } else {
          data.cell.styles.fillColor = [254, 249, 195];
          data.cell.styles.textColor = [133, 77, 14];
        }
      }
      if (data.column.index === 5) {
        const tones = [
          { fill: [239, 246, 255], text: [37, 99, 235] },
          { fill: [236, 253, 245], text: [5, 150, 105] },
          { fill: [255, 247, 237], text: [249, 115, 22] },
          { fill: [250, 245, 255], text: [147, 51, 234] },
          { fill: [255, 241, 242], text: [244, 63, 94] },
        ];
        const tone = tones[data.row.index % tones.length];
        data.cell.styles.fillColor = tone.fill;
        data.cell.styles.textColor = tone.text;
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 5) return;
      const percentage = Number.parseFloat(String(data.cell.raw || ""));
      if (!Number.isFinite(percentage)) return;
      const tones = [[37, 99, 235], [5, 150, 105], [249, 115, 22], [147, 51, 234], [244, 63, 94]];
      const x = data.cell.x + data.cell.width * 0.42;
      const yBar = data.cell.y + data.cell.height / 2 + 1.4;
      const width = data.cell.width * 0.48;
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(x, yBar, width, 1.2, 0.6, 0.6, "F");
      doc.setFillColor(...tones[data.row.index % tones.length]);
      doc.roundedRect(x, yBar, width * clamp(percentage, 0, 100) / 100, 1.2, 0.6, 0.6, "F");
    },
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 5, {
      align: "right",
    });
  }

  doc.save(
    [
      sanitizeFileName(studentName),
      sanitizeFileName(formatExamName(result.exam, "Exam")),
      "analytics_report.pdf",
    ].join("_"),
  );
};

const downloadExamAnalyticsPerfectLayoutReport = async ({
  studentName,
  studentData,
  schoolData,
  result,
  questionRows,
  cognitiveAnalysis,
}) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const title = formatExamName(result.exam, "Exam");
  const analysis = cognitiveAnalysis || buildStudentCognitiveAnalysis([result]);
  const navy = [15, 47, 99];
  const pageBg = [245, 248, 252];
  const softBorder = [203, 213, 225];
  const mutedText = [71, 85, 105];
  const primaryText = [30, 41, 59];
  const overviewMargin = 8;
  const overviewInset = 13;
  const questionMargin = 12;
  const thinBorder = 0.16;
  const cardBorder = 0.28;
  const [schoolLogo, spectropyLogo] = await Promise.all([
    toDataUrl(
      schoolData?.logo_base64 || schoolData?.logo_data_url || schoolData?.logo_url,
    ),
    toDataUrl(spectropyLogoUrl),
  ]);

  doc.setProperties({
    title: `${title} Analytics Report`,
    subject: "Student cognitive and question-wise analytics",
    creator: "SPECTROPY Result Analysis Portal",
  });

  const getImageFormat = (dataUrl) => {
    if (/^data:image\/jpe?g/i.test(dataUrl)) return "JPEG";
    if (/^data:image\/webp/i.test(dataUrl)) return "WEBP";
    return "PNG";
  };

  const drawImageCoverCircle = (dataUrl, cx, cy, r) => {
    if (!dataUrl) return false;
    try {
      const props = doc.getImageProperties(dataUrl);
      const box = r * 2;
      const scale = Math.max(box / props.width, box / props.height);
      const dw = props.width * scale;
      const dh = props.height * scale;
      doc.saveGraphicsState();
      doc.circle(cx, cy, r, null);
      doc.clip();
      doc.discardPath();
      doc.addImage(
        dataUrl,
        getImageFormat(dataUrl),
        cx - dw / 2,
        cy - dh / 2,
        dw,
        dh,
      );
      doc.restoreGraphicsState();
      return true;
    } catch (error) {
      console.warn("Unable to draw analytics report image:", error);
      return false;
    }
  };

  const pct = (value) =>
    value === null || value === undefined ? "No questions" : `${value}%`;
  const hexToRgb = (hex) => {
    const value = String(hex || "").replace("#", "");
    return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
  };
  const bandStyle = (percentage) => {
    const band = getSubjectMasteryBand(percentage);
    if (band.key === "excellent") return { ...band, fill: [217, 248, 230], text: [4, 120, 87] };
    if (band.key === "proficient") return { ...band, fill: [232, 250, 239], text: [21, 128, 61] };
    if (band.key === "developing") return { ...band, fill: [255, 246, 214], text: [146, 64, 14] };
    if (band.key === "support") return { ...band, fill: [255, 231, 237], text: [190, 18, 60] };
    return { ...band, fill: [242, 246, 250], text: [71, 85, 105] };
  };

  const drawPill = (text, x, y) => {
    const width = Math.max(22, doc.getTextWidth(text) + 7);
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(x - width, y - 4.5, width, 7.5, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.setTextColor(0, 53, 122);
    doc.text(text, x - width / 2, y + 0.6, { align: "center" });
  };

  const drawSection = (heading, description, y, rightText = "", pillYOffset = 0) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...primaryText);
    doc.text(heading, overviewInset, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(...mutedText);
    doc.text(description, overviewInset, y + 5);
    if (rightText) drawPill(rightText, pageWidth - overviewInset, y + pillYOffset);
  };

  const drawMetricCard = ({ x, y, w, label, value, note, border, fill }) => {
    doc.setFillColor(...fill);
    doc.setDrawColor(...border);
    doc.setLineWidth(cardBorder);
    doc.roundedRect(x, y, w, 19.5, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.4);
    doc.setTextColor(0, 53, 122);
    doc.text(String(label).toUpperCase(), x + 3, y + 4.7);
    doc.setFontSize(16);
    doc.setTextColor(...primaryText);
    doc.text(String(value), x + 3, y + 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.4);
    doc.setTextColor(...mutedText);
    doc.text(doc.splitTextToSize(String(note), w - 6), x + 3, y + 17);
  };

  const drawInfoCard = ({ x, y, w, label, value, accent, fill }) => {
    doc.setFillColor(...fill);
    doc.setDrawColor(191, 219, 254);
    doc.setLineWidth(cardBorder);
    doc.roundedRect(x, y, w, 13.8, 1.5, 1.5, "FD");
    doc.setFillColor(...accent);
    doc.roundedRect(x, y, 1.4, 13.8, 0.7, 0.7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(...mutedText);
    doc.text(String(label).toUpperCase(), x + 4.3, y + 5.2);
    const valueText = String(value || "-");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryText);
    if (label === "Student") {
      let valueFontSize = 11;
      doc.setFontSize(valueFontSize);
      while (valueFontSize > 6 && doc.getTextWidth(valueText) > w - 8) {
        valueFontSize -= 0.5;
        doc.setFontSize(valueFontSize);
      }
      doc.text(valueText, x + 4.3, y + 10.7);
    } else {
      doc.setFontSize(11);
      doc.text(doc.splitTextToSize(valueText, w - 8), x + 4.3, y + 10.7);
    }
  };

  const drawBloomCard = ({ x, y, w, skill }) => {
    const color = hexToRgb(skill.color);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(220, 230, 242);
    doc.setLineWidth(cardBorder);
    doc.roundedRect(x, y, w, 15.2, 1.7, 1.7, "FD");
    doc.setFillColor(...color);
    doc.circle(x + 3.6, y + 4.6, 1.15, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.setTextColor(15, 47, 99);
    doc.text(skill.skill, x + 6.3, y + 5.6);
    doc.setFontSize(11);
    doc.text(pct(skill.percentage), x + 2.8, y + 11.3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.9);
    doc.setTextColor(...mutedText);
    doc.text(
      skill.total > 0
        ? `${skill.correct}/${skill.total} correct`
        : "No tagged questions",
      x + 2.8,
      y + 14.1,
    );
  };

  const drawFooter = (page, total) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...mutedText);
    doc.text(`Page ${page} of ${total}`, questionMargin, pageHeight - 4.5);
  };

  doc.setFillColor(...pageBg);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageWidth, 22.2, "F");

  doc.setFillColor(255, 255, 255);
  doc.circle(15.5, 11.1, 8.1, "F");
  if (!drawImageCoverCircle(schoolLogo, 15.5, 11.1, 6.8)) {
    doc.setFillColor(...navy);
    doc.circle(15.5, 11.1, 5.8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("S", 15.5, 13.4, { align: "center" });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(doc.splitTextToSize(String(schoolData?.school_name || "School Name").toUpperCase(), 54), 27.8, 8.4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(190, 213, 240);
  doc.text(schoolData?.area || "-", 27.8, 13.5);
  doc.text(`Academic Year : ${schoolData?.academic_year || "-"}`, 27.8, 18.1);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("STUDENT ANALYTICS REPORT", pageWidth / 2, 9.6, { align: "center" });
  doc.setDrawColor(130, 168, 215);
  doc.setLineWidth(0.45);
  doc.line(pageWidth / 2 - 37, 16.7, pageWidth / 2 - 20, 16.7);
  doc.line(pageWidth / 2 + 20, 16.7, pageWidth / 2 + 37, 16.7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(190, 213, 240);
  doc.text("SUBJECT & QUESTION ANALYSIS", pageWidth / 2, 18.3, { align: "center" });

  doc.setFillColor(255, 255, 255);
  doc.circle(pageWidth - 42, 11.1, 7.7, "F");
  drawImageCoverCircle(spectropyLogo, pageWidth - 42, 11.1, 6.4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("SPECTROPY", pageWidth - 8, 9.2, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(190, 213, 240);
  doc.text("Powered by Spectropy", pageWidth - 8, 15.4, { align: "right" });

  const gradeSection = `${studentData?.class || "-"}${studentData?.section ? ` / ${studentData.section}` : ""}`;
  const program = [result?.program, result?.subject_group].filter(Boolean).join(" / ") || "-";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...primaryText);
  doc.text(title.toUpperCase(), overviewMargin, 29.2);

  const infoY = 34.2;
  const infoGap = 3.5;
  const infoW = (pageWidth - overviewMargin * 2 - infoGap * 4) / 5;
  [
    ["Student", studentName, [37, 99, 235], [239, 246, 255]],
    ["Grade / Section", gradeSection, [139, 92, 246], [245, 243, 255]],
    ["Roll No.", studentData?.roll_no || studentData?.student_id || result?.student_id || "-", [6, 182, 212], [236, 254, 255]],
    ["Exam Date", formatDate(result?.date), [245, 158, 11], [255, 251, 235]],
    ["Program", program, [16, 185, 129], [236, 253, 245]],
  ].forEach(([label, value, accent, fill], index) => {
    drawInfoCard({
      x: overviewMargin + (infoW + infoGap) * index,
      y: infoY,
      w: infoW,
      label,
      value,
      accent,
      fill,
    });
  });

  let y = 50.5;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...softBorder);
  doc.setLineWidth(cardBorder);
  doc.roundedRect(overviewMargin, y, pageWidth - overviewMargin * 2, 57.8, 2, 2, "FD");
  drawSection(
    "Cognitive Analysis",
    "Bloom-tagged mastery for this exam only.",
    y + 7,
    `${analysis.overall.total} tagged response${analysis.overall.total === 1 ? "" : "s"}`,
    0,
  );

  if (analysis.hasData) {
    const gap = 3.8;
    const cardW = (pageWidth - overviewInset * 2 - gap * 3) / 4;
    [
      ["Overall mastery", pct(analysis.overall.percentage), `${analysis.overall.correct}/${analysis.overall.total} correct`, [59, 130, 246], [239, 246, 255]],
      ["LOTS", pct(analysis.lots.percentage), "Remember + Understand", [16, 185, 129], [236, 253, 245]],
      ["HOTS", pct(analysis.hots.percentage), "Apply + Analyse + Evaluate + Create", [245, 158, 11], [255, 251, 235]],
      [
        "Cognitive level",
        analysis.level.label,
        analysis.gap === null ? "LOTS/HOTS gap unavailable" : `${Math.abs(analysis.gap)} point LOTS/HOTS gap`,
        [37, 99, 235],
        [248, 250, 252],
      ],
    ].forEach(([label, value, note, border, fill], index) => {
      drawMetricCard({
        x: overviewInset + (cardW + gap) * index,
        y: y + 13.8,
        w: cardW,
        label,
        value,
        note,
        border,
        fill,
      });
    });

    const bloomGap = 2.5;
    const bloomW = (pageWidth - overviewInset * 2 - bloomGap * 5) / 6;
    analysis.skillPerformance.forEach((skill, index) => {
      drawBloomCard({
        x: overviewInset + (bloomW + bloomGap) * index,
        y: y + 36.8,
        w: bloomW,
        skill,
      });
    });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...mutedText);
    doc.text("No Bloom-tagged questions are available for this exam.", overviewInset, y + 22);
  }

  y = 111.1;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...softBorder);
  doc.setLineWidth(cardBorder);
  doc.roundedRect(overviewMargin, y, pageWidth - overviewMargin * 2, 90.4, 2, 2, "FD");
  drawSection(
    "Subject-wise Cognitive Analytics",
    "Subject mastery calculated from this exam's Bloom-tagged questions.",
    y + 7,
    `${analysis.subjectPerformance.length} subject${analysis.subjectPerformance.length === 1 ? "" : "s"}`,
  );

  if (analysis.subjectPerformance.length > 0) {
    const subjectGap = 3.5;
    const subjectW = (pageWidth - overviewInset * 2 - subjectGap * 3) / 4;
    const subjectY = y + 13.8;
    const subjectColors = [[139, 92, 246], [6, 182, 212], [37, 99, 235], [244, 63, 94]];
    analysis.subjectPerformance.slice(0, 4).forEach((subject, index) => {
      const x = overviewInset + (subjectW + subjectGap) * index;
      const color = subjectColors[index] || [37, 99, 235];
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...softBorder);
      doc.setLineWidth(cardBorder);
      doc.roundedRect(x, subjectY, subjectW, 25, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...primaryText);
      doc.text(subject.label, x + 5, subjectY + 8.5);
      doc.setFontSize(16);
      doc.setTextColor(...color);
      doc.text(pct(subject.overall), x + subjectW - 5, subjectY + 8.8, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.7);
      doc.setTextColor(...mutedText);
      doc.text(`${subject.correct}/${subject.total} tagged questions correct`, x + 5, subjectY + 13.5);
      const drawSubjectBadgeValue = (label, value, centerX) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.9);
        const labelWidth = doc.getTextWidth(`${label} `);
        doc.setFontSize(8);
        const valueWidth = doc.getTextWidth(value);
        const textX = centerX - (labelWidth + valueWidth) / 2;
        doc.setFontSize(4.9);
        doc.text(`${label} `, textX, subjectY + 21.5);
        doc.setFontSize(8);
        doc.text(value, textX + labelWidth, subjectY + 21.5);
      };
      doc.setFillColor(232, 250, 239);
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(x + 4, subjectY + 16.5, subjectW / 2 - 5, 7, 1.4, 1.4, "FD");
      doc.setTextColor(0, 121, 90);
      drawSubjectBadgeValue("LOTS", pct(subject.lots), x + subjectW / 4 + 1.5);
      doc.setFillColor(255, 237, 213);
      doc.setDrawColor(253, 186, 116);
      doc.roundedRect(x + subjectW / 2 + 1, subjectY + 16.5, subjectW / 2 - 5, 7, 1.4, 1.4, "FD");
      doc.setTextColor(194, 65, 12);
      drawSubjectBadgeValue("HOTS", pct(subject.hots), x + subjectW * 0.75 - 1.5);
    });

    doc.autoTable({
      startY: subjectY + 27.8,
      theme: "grid",
      margin: { left: overviewInset, right: overviewInset },
      tableWidth: pageWidth - overviewInset * 2,
      head: [["Subject", ...BLOOM_SKILLS.map((skill) => skill.key), "Subject Level"]],
      body: analysis.subjectPerformance.map((subject) => {
        const subjectBand = bandStyle(subject.overall);
        return [
          subject.label,
          ...BLOOM_SKILLS.map(({ key }) => {
            const skill = subject.skills.find((item) => item.skill === key);
            return skill?.percentage === null
              ? "No questions"
              : `${skill.percentage}%\n${skill.correct}/${skill.total}`;
          }),
          `${subjectBand.label}\n${pct(subject.overall)}`,
        ];
      }),
      styles: {
        font: "helvetica",
        fontSize: 7,
        cellPadding: 1.7,
        halign: "center",
        valign: "middle",
        lineColor: [226, 232, 240],
        lineWidth: thinBorder,
        textColor: primaryText,
      },
      headStyles: {
        fillColor: [239, 246, 255],
        textColor: primaryText,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 31, halign: "left", fontStyle: "bold" },
        7: { cellWidth: 33, fontStyle: "bold" },
      },
      didParseCell: (data) => {
        if (data.section === "head" && data.column.index > 0 && data.column.index < 7) {
          const color = BLOOM_SKILLS[data.column.index - 1].color.replace("#", "");
          const red = Number.parseInt(color.slice(0, 2), 16);
          const green = Number.parseInt(color.slice(2, 4), 16);
          const blue = Number.parseInt(color.slice(4, 6), 16);
          data.cell.styles.fillColor = [
            Math.round(red + (255 - red) * 0.78),
            Math.round(green + (255 - green) * 0.78),
            Math.round(blue + (255 - blue) * 0.78),
          ];
        }
        if (data.section !== "body") return;
        if (data.column.index > 0 && data.column.index < 7) {
          const subject = analysis.subjectPerformance[data.row.index];
          const skill = subject.skills[data.column.index - 1];
          const style = bandStyle(skill?.percentage);
          data.cell.styles.fillColor = style.fill;
          data.cell.styles.fontStyle = skill?.percentage === null ? "normal" : "bold";
        }
        if (data.column.index === 7) {
          const style = bandStyle(analysis.subjectPerformance[data.row.index].overall);
          data.cell.styles.fillColor = style.fill;
          data.cell.styles.textColor = style.text;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...mutedText);
    doc.text("No subject-level cognitive data is available for this exam.", overviewInset, y + 23);
  }
  const questionsPerPage = 12;
  const questionPages = Array.from(
    { length: Math.ceil(questionRows.length / questionsPerPage) },
    (_, index) => questionRows.slice(index * questionsPerPage, (index + 1) * questionsPerPage),
  );
  const totalPages = 1 + questionPages.length;
  drawFooter(1, totalPages);

  questionPages.forEach((pageRows, pageIndex) => {
    doc.addPage("a4", "landscape");
    doc.setFillColor(...pageBg);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    const firstQuestion = pageIndex * questionsPerPage + 1;
    const lastQuestion = firstQuestion + pageRows.length - 1;
    drawSection(
      "Question-wise Analytics",
      pageIndex === 0
        ? "Stored response evidence and the percentage of other students who answered each question correctly."
        : `Questions ${firstQuestion}-${lastQuestion}`,
      13.5,
      pageIndex === 0 ? `${questionRows.length} questions` : "",
    );

    doc.autoTable({
    startY: 32.5,
    theme: "grid",
    margin: { left: questionMargin, right: questionMargin },
    tableWidth: pageWidth - questionMargin * 2,
    head: [["Question", "Option", "Key", "Marks", "Status", "Peer correct %"]],
    body: pageRows.map((question) => [
      question.question,
      question.option || "-",
      question.key || "-",
      question.marks === "" ? "-" : question.marks,
      question.status || "-",
      question.peerCorrectPercentage === null ? "-" : `${question.peerCorrectPercentage}%`,
    ]),
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 2.4,
      halign: "center",
      valign: "middle",
      lineColor: [226, 232, 240],
      lineWidth: thinBorder,
      minCellHeight: 12.35,
      textColor: primaryText,
    },
    headStyles: {
      fillColor: [239, 246, 255],
      textColor: [51, 65, 85],
      fontStyle: "bold",
      halign: "center",
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 35.3 },
      1: { cellWidth: 31.8 },
      2: { cellWidth: 26.5 },
      3: { cellWidth: 26.5, halign: "center" },
      4: { cellWidth: 39.5, halign: "center" },
      5: { cellWidth: "auto", halign: "center", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (data.column.index === 4) {
        const status = String(data.cell.raw || "").toLowerCase();
        data.cell.styles.fontStyle = "bold";
        if (status.includes("incorrect")) {
          data.cell.styles.fillColor = [254, 226, 226];
          data.cell.styles.textColor = [220, 38, 38];
        } else if (status.includes("correct")) {
          data.cell.styles.fillColor = [220, 252, 231];
          data.cell.styles.textColor = [5, 150, 105];
        } else {
          data.cell.styles.fillColor = [254, 249, 195];
          data.cell.styles.textColor = [133, 77, 14];
        }
      }
      if (data.column.index === 5) {
        const tones = [
          { fill: [239, 246, 255], text: [37, 99, 235] },
          { fill: [236, 253, 245], text: [5, 150, 105] },
          { fill: [255, 247, 237], text: [249, 115, 22] },
          { fill: [250, 245, 255], text: [147, 51, 234] },
          { fill: [255, 241, 242], text: [244, 63, 94] },
        ];
        const tone = tones[(pageIndex * questionsPerPage + data.row.index) % tones.length];
        data.cell.styles.fillColor = tone.fill;
        data.cell.styles.textColor = tone.text;
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 5) return;
      const percentage = Number.parseFloat(String(data.cell.raw || ""));
      if (!Number.isFinite(percentage)) return;
      const tones = [[37, 99, 235], [5, 150, 105], [249, 115, 22], [147, 51, 234], [244, 63, 94]];
      const toneIndex = (pageIndex * questionsPerPage + data.row.index) % tones.length;
      const x = data.cell.x + data.cell.width * 0.36;
      const yBar = data.cell.y + data.cell.height / 2 + 1.4;
      const width = data.cell.width * 0.56;
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(x, yBar, width, 1.2, 0.6, 0.6, "F");
      doc.setFillColor(...tones[toneIndex]);
      doc.roundedRect(x, yBar, width * clamp(percentage, 0, 100) / 100, 1.2, 0.6, 0.6, "F");
    },
  });
    drawFooter(pageIndex + 2, totalPages);
  });

  doc.save(
    [
      sanitizeFileName(studentName),
      sanitizeFileName(formatExamName(result.exam, "Exam")),
      "analytics_report.pdf",
    ].join("_"),
  );
};

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
  const reportCognitiveAnalysis = buildStudentCognitiveAnalysis(examResults);
  const reportPercent = (value) =>
    value === null || value === undefined ? "No questions" : `${value}%`;
  const slateText = [30, 41, 59];
  const mutedSlate = [71, 85, 105];
  const softLine = [203, 213, 225];
  const pageFill = [245, 248, 252];
  const cardFill = [255, 255, 255];
  const accentBlue = [37, 99, 235];
  const accentGreen = [16, 185, 129];
  const accentAmber = [245, 158, 11];
  const accentRose = [244, 63, 94];
  const reportMargin = 12;
  const reportContentWidth = pageWidth - reportMargin * 2;

  const reportScores = sortedExamResults.map((result) =>
    clamp(toNum(result.percentage), 0, 100),
  );
  const reportAverage = reportScores.length
    ? round(reportScores.reduce((sum, value) => sum + value, 0) / reportScores.length)
    : 0;
  const latestResult = sortedExamResults[sortedExamResults.length - 1] || {};
  const previousResult =
    sortedExamResults[sortedExamResults.length - 2] || latestResult;
  const latestPct = round(toNum(latestResult.percentage));
  const improvement = round(toNum(latestResult.percentage) - toNum(previousResult.percentage));
  const totals = sortedExamResults.reduce(
    (accumulator, result) => ({
      correct: accumulator.correct + toNum(result.correct_answers),
      wrong: accumulator.wrong + toNum(result.wrong_answers),
      unattempted: accumulator.unattempted + toNum(result.unattempted),
    }),
    { correct: 0, wrong: 0, unattempted: 0 },
  );
  const attemptedQuestions = totals.correct + totals.wrong;
  const totalQuestions = attemptedQuestions + totals.unattempted;
  const accuracyPct = attemptedQuestions
    ? round((totals.correct / attemptedQuestions) * 100)
    : 0;
  const attemptPct = totalQuestions
    ? round((attemptedQuestions / totalQuestions) * 100)
    : 0;
  const consistencyPct = round(clamp(100 - standardDeviation(reportScores) * 2, 0, 100));
  const nextTarget = Math.min(100, Math.ceil(latestPct + 5));

  const strongestMeasuredSubject = reportCognitiveAnalysis.strongestSubject;
  const priorityMeasuredSubject =
    reportCognitiveAnalysis.prioritySubject?.key !== strongestMeasuredSubject?.key
      ? reportCognitiveAnalysis.prioritySubject
      : null;
  const guidanceItems = [];
  if (priorityMeasuredSubject) {
    const lowestMeasuredSkill = [...priorityMeasuredSubject.skills]
      .filter((skill) => skill.total > 0 && skill.percentage !== null)
      .sort((a, b) => a.percentage - b.percentage)[0];
    guidanceItems.push(
      lowestMeasuredSkill
        ? `Prioritise ${priorityMeasuredSubject.label}: ${lowestMeasuredSkill.skill} is the lowest measured Bloom skill at ${lowestMeasuredSkill.percentage}%.`
        : `Prioritise ${priorityMeasuredSubject.label}: cognitive mastery is ${priorityMeasuredSubject.overall}%.`,
    );
  }
  if (strongestMeasuredSubject) {
    guidanceItems.push(
      `Extend ${strongestMeasuredSubject.label}: cognitive mastery is ${strongestMeasuredSubject.overall}%. Use higher-difficulty practice.`,
    );
  }
  if (!guidanceItems.length) {
    guidanceItems.push(
      "Add or review Bloom and subject tags to generate evidence-based learning guidance.",
    );
  }
  guidanceItems.push(`Set the next score target at ${nextTarget}% and review progress after the next assessment.`);

  const hexToRgbForReport = (hex) => {
    const value = String(hex || "").replace("#", "");
    return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
  };

  const drawReportPageHeader = (heading, subheading) => {
    doc.setFillColor(...pageFill);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, pageWidth, 22, "F");
    doc.setFont("Times New Roman", "bold");
    doc.setFontSize(17);
    doc.setTextColor(255, 255, 255);
    doc.text(heading, reportMargin, 12);
    doc.setFont("Times New Roman", "normal");
    doc.setFontSize(9);
    doc.text(subheading, reportMargin, 18);
    doc.setFont("Times New Roman", "bold");
    doc.setFontSize(10);
    doc.text(studentData.name || "Student", pageWidth - reportMargin, 12, { align: "right" });
    doc.setFont("Times New Roman", "normal");
    doc.setFontSize(8);
    doc.text(
      `${studentData.class || "-"}-${studentData.section || "-"} | Roll No. ${studentData.roll_no || "-"}`,
      pageWidth - reportMargin,
      18,
      { align: "right" },
    );
  };

  const drawReportCard = ({ x, y: cardY, w, h, title: cardTitle, value, note, color }) => {
    doc.setFillColor(...cardFill);
    doc.setDrawColor(...softLine);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, cardY, w, h, 2.4, 2.4, "FD");
    doc.setFillColor(...color);
    doc.roundedRect(x, cardY, 2.2, h, 1, 1, "F");
    doc.setFont("Times New Roman", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...mutedSlate);
    doc.text(String(cardTitle).toUpperCase(), x + 5, cardY + 7);
    doc.setFontSize(20);
    doc.setTextColor(...slateText);
    doc.text(String(value), x + 5, cardY + 17);
    doc.setFont("Times New Roman", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...mutedSlate);
    doc.text(doc.splitTextToSize(String(note), w - 10), x + 5, cardY + 24);
  };

  doc.addPage();
  drawReportPageHeader(
    "Performance Guidance & Learning Snapshot",
    "Generated summary from marks, attempts, trends, and Bloom-tagged responses.",
  );

  const snapshotY = 32;
  const snapshotGap = 4;
  const snapshotW = (reportContentWidth - snapshotGap * 3) / 4;
  [
    ["Overall Average", `${reportAverage}%`, `${examResults.length} assessment${examResults.length === 1 ? "" : "s"} included`, accentBlue],
    ["Latest Score", `${latestPct}%`, improvement >= 0 ? `+${improvement}% from previous` : `${improvement}% from previous`, accentGreen],
    ["Accuracy", `${accuracyPct}%`, `${Math.round(totals.correct)} correct answers`, accentAmber],
    ["Attempt Rate", `${attemptPct}%`, `${Math.round(totals.unattempted)} unattempted questions`, accentRose],
  ].forEach(([cardTitle, value, note, color], index) => {
    drawReportCard({
      x: reportMargin + (snapshotW + snapshotGap) * index,
      y: snapshotY,
      w: snapshotW,
      h: 31,
      title: cardTitle,
      value,
      note,
      color,
    });
  });

  [
    ["Consistency", `${consistencyPct}%`, "Stability across recorded exams", [139, 92, 246]],
    ["Strength", strength.charAt(0).toUpperCase() + strength.slice(1), "Highest average subject", accentGreen],
    ["Focus Area", weak.charAt(0).toUpperCase() + weak.slice(1), "Lowest average subject", accentRose],
    ["Next Target", `${nextTarget}%`, "Recommended next milestone", accentBlue],
  ].forEach(([cardTitle, value, note, color], index) => {
    drawReportCard({
      x: reportMargin + index * 70,
      y: 70,
      w: index === 3 ? 63 : 65,
      h: 31,
      title: cardTitle,
      value,
      note,
      color,
    });
  });

  doc.setFillColor(...cardFill);
  doc.setDrawColor(...softLine);
  doc.roundedRect(reportMargin, 109, 128, 48, 2.5, 2.5, "FD");
  doc.setFont("Times New Roman", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...slateText);
  doc.text("Performance Guidance", reportMargin + 5, 118);
  doc.setFont("Times New Roman", "normal");
  doc.setFontSize(9.2);
  doc.setTextColor(...slateText);
  guidanceItems.slice(0, 4).forEach((item, index) => {
    const itemY = 127 + index * 9.5;
    doc.setFillColor(...(index === 0 ? accentAmber : accentBlue));
    doc.circle(reportMargin + 6, itemY - 2.5, 1.5, "F");
    doc.text(doc.splitTextToSize(item, 112), reportMargin + 11, itemY);
  });

  doc.setFillColor(...cardFill);
  doc.setDrawColor(...softLine);
  doc.roundedRect(reportMargin + 136, 109, reportContentWidth - 136, 48, 2.5, 2.5, "FD");
  doc.setFont("Times New Roman", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...slateText);
  doc.text("Learning Snapshot", reportMargin + 141, 118);
  doc.setFont("Times New Roman", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...mutedSlate);
  [
    `Best exam: ${formatExamName(bestExam.exam, "Exam")} at ${(bestExam.percentage || 0).toFixed(1)}%.`,
    `Strongest measured cognitive area: ${reportCognitiveAnalysis.strongestSubject?.label || "No questions"}.`,
    `Priority measured cognitive area: ${reportCognitiveAnalysis.prioritySubject?.label || "No questions"}.`,
    `Bloom coverage: ${reportCognitiveAnalysis.coverage}% of recorded questions.`,
  ].forEach((line, index) => {
    doc.text(line, reportMargin + 141, 128 + index * 7);
  });

  doc.setFont("Times New Roman", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...slateText);
  doc.text("Cognitive Analysis", reportMargin, 172);

  if (reportCognitiveAnalysis.hasData) {
    const cognitiveY = 178;
    const cognitiveGap = 4;
    const cognitiveW = (reportContentWidth - cognitiveGap * 3) / 4;
    [
      ["Overall Mastery", reportPercent(reportCognitiveAnalysis.overall.percentage), `${reportCognitiveAnalysis.overall.correct}/${reportCognitiveAnalysis.overall.total} correct`, accentBlue],
      ["LOTS", reportPercent(reportCognitiveAnalysis.lots.percentage), "Remember + Understand", accentGreen],
      ["HOTS", reportPercent(reportCognitiveAnalysis.hots.percentage), "Apply + Analyse + Evaluate + Create", accentAmber],
      ["Cognitive Level", reportCognitiveAnalysis.level.label, reportCognitiveAnalysis.gap === null ? "LOTS/HOTS gap unavailable" : `${Math.abs(reportCognitiveAnalysis.gap)} point gap`, [139, 92, 246]],
    ].forEach(([cardTitle, value, note, color], index) => {
      drawReportCard({
        x: reportMargin + (cognitiveW + cognitiveGap) * index,
        y: cognitiveY,
        w: cognitiveW,
        h: 28,
        title: cardTitle,
        value,
        note,
        color,
      });
    });
  } else {
    doc.setFont("Times New Roman", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...mutedSlate);
    doc.text("Cognitive analysis is unavailable because Bloom-tagged questions are not available.", reportMargin, 183);
  }

  doc.addPage();
  drawReportPageHeader(
    "Subject Bloom's Taxonomy Analytics",
    "Subject-wise cognitive mastery generated from Bloom-tagged responses.",
  );

  if (reportCognitiveAnalysis.hasData && reportCognitiveAnalysis.subjectPerformance.length > 0) {
    const subjectCardY = 32;
    const subjectGap = 4;
    const subjectW = (reportContentWidth - subjectGap * 3) / 4;
    reportCognitiveAnalysis.subjectPerformance.slice(0, 4).forEach((subject, index) => {
      const x = reportMargin + (subjectW + subjectGap) * index;
      const color = hexToRgbForReport(subject.color);
      doc.setFillColor(...cardFill);
      doc.setDrawColor(...softLine);
      doc.roundedRect(x, subjectCardY, subjectW, 31, 2.5, 2.5, "FD");
      doc.setFont("Times New Roman", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...slateText);
      doc.text(subject.label, x + 5, subjectCardY + 8);
      doc.setFontSize(19);
      doc.setTextColor(...color);
      doc.text(reportPercent(subject.overall), x + subjectW - 5, subjectCardY + 14, { align: "right" });
      doc.setFont("Times New Roman", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...mutedSlate);
      doc.text(`${subject.correct}/${subject.total} tagged responses correct`, x + 5, subjectCardY + 18);
      doc.setFont("Times New Roman", "bold");
      doc.setFontSize(8.4);
      doc.setTextColor(5, 150, 105);
      doc.text(`LOTS ${reportPercent(subject.lots)}`, x + 5, subjectCardY + 26);
      doc.setTextColor(194, 65, 12);
      doc.text(`HOTS ${reportPercent(subject.hots)}`, x + subjectW - 5, subjectCardY + 26, { align: "right" });
    });

    doc.autoTable({
      startY: 72,
      theme: "grid",
      margin: { left: reportMargin, right: reportMargin },
      tableWidth: reportContentWidth,
      head: [["Subject", ...BLOOM_SKILLS.map((skill) => skill.key), "Subject Level"]],
      body: reportCognitiveAnalysis.subjectPerformance.map((subject) => {
        const subjectBand = getSubjectMasteryBand(subject.overall);
        return [
          subject.label,
          ...BLOOM_SKILLS.map(({ key }) => {
            const skill = subject.skills.find((item) => item.skill === key);
            return skill?.percentage === null
              ? "No questions"
              : `${skill.percentage}%\n${skill.correct}/${skill.total}`;
          }),
          `${subjectBand.label}\n${reportPercent(subject.overall)}`,
        ];
      }),
      styles: {
        font: "Times New Roman",
        fontSize: 8.5,
        cellPadding: 2.2,
        halign: "center",
        valign: "middle",
        textColor: slateText,
        lineColor: [226, 232, 240],
        lineWidth: 0.18,
      },
      headStyles: {
        fillColor: [239, 246, 255],
        textColor: slateText,
        fontStyle: "bold",
        fontSize: 8.5,
      },
      columnStyles: {
        0: { cellWidth: 30, halign: "left", fontStyle: "bold" },
        7: { cellWidth: 32, fontStyle: "bold" },
      },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        if (data.column.index >= 1 && data.column.index <= 6) {
          const raw = String(data.cell.raw || "");
          if (raw.includes("No questions")) {
            data.cell.styles.fillColor = [248, 250, 252];
            data.cell.styles.textColor = mutedSlate;
          } else {
            const value = Number.parseFloat(raw);
            if (value >= 80) data.cell.styles.fillColor = [220, 252, 231];
            else if (value >= 60) data.cell.styles.fillColor = [239, 246, 255];
            else if (value >= 40) data.cell.styles.fillColor = [254, 249, 195];
            else data.cell.styles.fillColor = [254, 226, 226];
          }
        }
        if (data.column.index === 7) {
          data.cell.styles.fillColor = [236, 253, 245];
          data.cell.styles.textColor = [4, 120, 87];
        }
      },
    });

    const insightY = Math.min((doc.lastAutoTable?.finalY || 128) + 12, 168);
    doc.setFillColor(...cardFill);
    doc.setDrawColor(...softLine);
    doc.roundedRect(reportMargin, insightY, reportContentWidth, 25, 2.5, 2.5, "FD");
    doc.setFont("Times New Roman", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...slateText);
    doc.text("Cognitive Insights", reportMargin + 5, insightY + 8);
    doc.setFont("Times New Roman", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...mutedSlate);
    (reportCognitiveAnalysis.insights.length
      ? reportCognitiveAnalysis.insights
      : ["No additional Bloom insight is available for the current data."]
    ).slice(0, 3).forEach((insight, index) => {
      doc.text(doc.splitTextToSize(insight, reportContentWidth - 12), reportMargin + 5, insightY + 15 + index * 5.5);
    });
  } else {
    doc.setFont("Times New Roman", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...mutedSlate);
    doc.text(
      "Subject Bloom's Taxonomy Analytics is unavailable because recognized Bloom and subject tags are not available.",
      reportMargin,
      42,
    );
  }

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
  const [selectedExamResult, setSelectedExamResult] = useState(null);
  const [peerQuestionAnalytics, setPeerQuestionAnalytics] = useState({
    status: "idle",
    byQuestion: {},
    peerStudentCount: 0,
  });

  useEffect(() => {
    if (!selectedExamResult) {
      setPeerQuestionAnalytics({
        status: "idle",
        byQuestion: {},
        peerStudentCount: 0,
      });
      return undefined;
    }

    const context = {
      schoolId: selectedExamResult.school_id || student?.school_id,
      program: selectedExamResult.program,
      examPattern:
        selectedExamResult.exam_pattern || selectedExamResult.exam,
      classValue: selectedExamResult.class || student?.class,
      section: selectedExamResult.section || student?.section,
      examDate: selectedExamResult.exam_date || selectedExamResult.date,
      studentId:
        selectedExamResult.student_id ||
        student?.student_id ||
        student?.roll_no,
    };

    if (Object.values(context).some((value) => !String(value || "").trim())) {
      setPeerQuestionAnalytics({
        status: "unavailable",
        byQuestion: {},
        peerStudentCount: 0,
      });
      return undefined;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      program: context.program,
      exam_pattern: context.examPattern,
      class: context.classValue,
      section: context.section,
      exam_date: String(context.examDate).slice(0, 10),
      exclude_student_id: context.studentId,
    });

    setPeerQuestionAnalytics({
      status: "loading",
      byQuestion: {},
      peerStudentCount: 0,
    });

    fetch(
      `${API_BASE}/api/schools/${encodeURIComponent(context.schoolId)}/exam-datasets/question-peer-statistics?${params}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load peer question statistics");
        }
        return payload;
      })
      .then((payload) => {
        const byQuestion = Object.fromEntries(
          (payload.questions || []).map((question) => [
            normalizeQuestionLabel(question.question),
            question,
          ]),
        );
        setPeerQuestionAnalytics({
          status: "ready",
          byQuestion,
          peerStudentCount: Number(payload.peer_student_count) || 0,
        });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        console.error("Unable to load peer question statistics:", error);
        setPeerQuestionAnalytics({
          status: "error",
          byQuestion: {},
          peerStudentCount: 0,
        });
      });

    return () => controller.abort();
  }, [selectedExamResult, student]);

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
      nextTarget: Math.min(100, Math.ceil(toNum(latestExam?.percentage) + 5)),
      orderedResults: [...chronologicalResults].reverse(),
    };
  }, [examResults]);

  const cognitiveAnalysis = useMemo(
    () => buildStudentCognitiveAnalysis(examResults),
    [examResults],
  );

  const strongestMeasuredSubject = cognitiveAnalysis.strongestSubject;
  const priorityMeasuredSubject =
    cognitiveAnalysis.prioritySubject?.key !== strongestMeasuredSubject?.key
      ? cognitiveAnalysis.prioritySubject
      : null;
  const teacherActions = useMemo(() => {
    if (!strongestMeasuredSubject) {
      return [
        "Add or review Bloom and subject tags to generate evidence-based teaching actions.",
      ];
    }

    const actions = [];

    if (priorityMeasuredSubject) {
      const lowestMeasuredSkill = [...priorityMeasuredSubject.skills]
        .filter((skill) => skill.total > 0 && skill.percentage !== null)
        .sort((a, b) => a.percentage - b.percentage)[0];

      actions.push(
        lowestMeasuredSkill
          ? `Prioritise ${priorityMeasuredSubject.label}: ${lowestMeasuredSkill.skill} is the lowest measured Bloom skill at ${lowestMeasuredSkill.percentage}%. Use guided practice and corrective feedback.`
          : `Prioritise ${priorityMeasuredSubject.label}: cognitive mastery is ${priorityMeasuredSubject.overall}%. Review its lowest Bloom-skill results first.`,
      );
    }

    actions.push(
      `Extend ${strongestMeasuredSubject.label}: cognitive mastery is ${strongestMeasuredSubject.overall}%. Use higher-difficulty application and reasoning questions to maintain progress.`,
    );

    if (!priorityMeasuredSubject) {
      actions.push(
        "Gather at least three Bloom-tagged questions in another subject before identifying a separate priority subject.",
      );
    }

    return actions;
  }, [priorityMeasuredSubject, strongestMeasuredSubject]);

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
    nextTarget,
    orderedResults,
  } = analytics;

  const studentName = student?.name || "Student";
  const classLabel = `${student?.class || "—"}${student?.section ? `-${student.section}` : ""}`;
  const isParentProfile = title === "Your Child's Profile";
  const selectedQuestionRows = selectedExamResult
    ? getQuestionRows(selectedExamResult.question_results).map((question) => {
        const peerStats =
          peerQuestionAnalytics.byQuestion[
            normalizeQuestionLabel(question.question)
          ];
        return {
          ...question,
          peerCorrectPercentage: peerStats?.correct_percentage ?? null,
          peerCorrectCount: peerStats?.correct_count ?? 0,
          peerResponseCount: peerStats?.peer_count ?? 0,
          peerStatsStatus: peerQuestionAnalytics.status,
        };
      })
    : [];
  const selectedExamCognitiveAnalysis = useMemo(
    () =>
      selectedExamResult
        ? buildStudentCognitiveAnalysis([selectedExamResult])
        : buildStudentCognitiveAnalysis([]),
    [selectedExamResult],
  );

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
              {!isParentProfile && !selectedExamResult && (
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

        {selectedExamResult ? (
          <section className="sp-dashboard-section sp-exam-detail">
            <SectionHeader
              eyebrow="Exam analysis"
              title={formatExamName(selectedExamResult.exam, "Exam")}
              description={getStudentDetailsLine(student, selectedExamResult)}
              action={
                <div className="sp-detail-actions">
                  <button
                    type="button"
                    className="sp-button sp-button-small sp-detail-download-button"
                    disabled={peerQuestionAnalytics.status === "loading"}
                    onClick={async () => {
                      try {
                        await downloadExamAnalyticsPerfectLayoutReport({
                          studentName,
                          studentData: student,
                          schoolData: school || {},
                          result: selectedExamResult,
                          questionRows: selectedQuestionRows,
                          cognitiveAnalysis: selectedExamCognitiveAnalysis,
                        });
                      } catch (error) {
                        console.error(error);
                        window.alert(
                          "Unable to generate analytics PDF. Please try again.",
                        );
                      }
                    }}
                  >
                    <FileDown size={15} strokeWidth={2.3} aria-hidden="true" />
                    {peerQuestionAnalytics.status === "loading"
                      ? "Preparing Peer Data..."
                      : "Download Analytics PDF"}
                  </button>
                  <button
                    type="button"
                    className="sp-button sp-button-small sp-detail-back-button"
                    onClick={() => setSelectedExamResult(null)}
                  >
                    Back
                  </button>
                </div>
              }
            />

            <section className="sp-panel sp-detail-panel sp-exam-cognitive-panel">
              <div className="sp-panel-header">
                <div>
                  <h3>Cognitive Analysis</h3>
                  <p>Bloom-tagged mastery for this exam only.</p>
                </div>
                <span className="sp-panel-badge">
                  {selectedExamCognitiveAnalysis.overall.total} tagged response
                  {selectedExamCognitiveAnalysis.overall.total === 1 ? "" : "s"}
                </span>
              </div>

              {selectedExamCognitiveAnalysis.hasData ? (
                <>
                  <div className="sp-exam-cognitive-summary">
                    <article className="sp-exam-cognitive-card sp-exam-cognitive-overall">
                      <span className="sp-exam-cognitive-icon" aria-hidden="true">
                        <Target size={17} strokeWidth={2.4} />
                      </span>
                      <div>
                        <span>Overall mastery</span>
                        <strong>{selectedExamCognitiveAnalysis.overall.percentage}%</strong>
                        <small>
                          {selectedExamCognitiveAnalysis.overall.correct}/
                          {selectedExamCognitiveAnalysis.overall.total} correct
                        </small>
                      </div>
                    </article>
                    <article className="sp-exam-cognitive-card sp-exam-cognitive-lots">
                      <span className="sp-exam-cognitive-icon" aria-hidden="true">
                        <Brain size={17} strokeWidth={2.4} />
                      </span>
                      <div>
                        <span>LOTS</span>
                        <strong>
                          {selectedExamCognitiveAnalysis.lots.percentage ?? "No questions"}
                          {selectedExamCognitiveAnalysis.lots.percentage === null ? "" : "%"}
                        </strong>
                        <small>Remember + Understand</small>
                      </div>
                    </article>
                    <article className="sp-exam-cognitive-card sp-exam-cognitive-hots">
                      <span className="sp-exam-cognitive-icon" aria-hidden="true">
                        <Lightbulb size={17} strokeWidth={2.4} />
                      </span>
                      <div>
                        <span>HOTS</span>
                        <strong>
                          {selectedExamCognitiveAnalysis.hots.percentage ?? "No questions"}
                          {selectedExamCognitiveAnalysis.hots.percentage === null ? "" : "%"}
                        </strong>
                        <small>Apply + Analyse + Evaluate + Create</small>
                      </div>
                    </article>
                    <article className={`sp-exam-cognitive-card sp-exam-cognitive-level sp-tone-${selectedExamCognitiveAnalysis.level.tone}`}>
                      <span className="sp-exam-cognitive-icon" aria-hidden="true">
                        <Award size={17} strokeWidth={2.4} />
                      </span>
                      <div>
                        <span>Cognitive level</span>
                        <strong>{selectedExamCognitiveAnalysis.level.label}</strong>
                        <small>
                          {selectedExamCognitiveAnalysis.gap === null
                            ? "LOTS/HOTS gap not available"
                            : `${Math.abs(selectedExamCognitiveAnalysis.gap)} point LOTS/HOTS gap`}
                        </small>
                      </div>
                    </article>
                  </div>

                  <div className="sp-exam-cognitive-skills">
                    {selectedExamCognitiveAnalysis.skillPerformance.map((skill) => (
                      <div className="sp-exam-cognitive-skill" key={skill.skill}>
                        <span>
                          <i style={{ background: skill.color }} />
                          {skill.skill}
                        </span>
                        <strong>
                          {skill.percentage === null ? "No questions" : `${skill.percentage}%`}
                        </strong>
                        <small>
                          {skill.total > 0
                            ? `${skill.correct}/${skill.total} correct`
                            : "No tagged questions"}
                        </small>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="sp-inline-empty sp-cognitive-empty">
                  Cognitive analysis is unavailable because this exam does not have Bloom-tagged questions.
                </div>
              )}
            </section>

            <section className="sp-panel sp-detail-panel sp-exam-subject-cognitive-panel sp-subject-bloom-matrix-panel">
              <div className="sp-panel-header">
                <div>
                  <h3>Subject-wise Cognitive Analytics</h3>
                  <p>Subject mastery calculated from this exam's Bloom-tagged questions.</p>
                </div>
                <span className="sp-panel-badge">
                  {selectedExamCognitiveAnalysis.subjectPerformance.length} subject
                  {selectedExamCognitiveAnalysis.subjectPerformance.length === 1 ? "" : "s"}
                </span>
              </div>

              {selectedExamCognitiveAnalysis.subjectPerformance.length > 0 ? (
                <>
                  <div className="sp-subject-bloom-cards sp-exam-subject-cognitive-cards">
                    {selectedExamCognitiveAnalysis.subjectPerformance.map((subject) => (
                      <article
                        className="sp-panel sp-subject-bloom-card"
                        key={subject.key}
                        style={{
                          "--subject-color": subject.color,
                          "--subject-icon-color": subject.iconColor,
                        }}
                      >
                        <div className="sp-subject-bloom-card-head">
                          <div>
                            <span className="sp-subject-bloom-icon" aria-hidden="true">
                              {React.createElement(subject.Icon, {
                                size: 19,
                                strokeWidth: 2.3,
                              })}
                            </span>
                            <h3>{subject.label}</h3>
                          </div>
                          <strong>{subject.overall}%</strong>
                        </div>
                        <p>
                          {subject.correct}/{subject.total} tagged questions correct
                        </p>
                        <dl>
                          <div>
                            <dt>LOTS</dt>
                            <dd>{subject.lots === null ? "No questions" : `${subject.lots}%`}</dd>
                          </div>
                          <div>
                            <dt>HOTS</dt>
                            <dd>{subject.hots === null ? "No questions" : `${subject.hots}%`}</dd>
                          </div>
                          <div>
                            <dt>Gap</dt>
                            <dd>{subject.gap === null ? "—" : `${Math.abs(subject.gap)} pts`}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>

                  <div className="sp-mastery-legend" aria-label="Mastery level legend">
                    <span className="sp-mastery-excellent"><i /> <strong>≥ 80%</strong> Excellent</span>
                    <span className="sp-mastery-proficient"><i /> <strong>60 – 79%</strong> Proficient</span>
                    <span className="sp-mastery-developing"><i /> <strong>40 – 59%</strong> Developing</span>
                    <span className="sp-mastery-support"><i /> <strong>&lt; 40%</strong> Needs Support</span>
                  </div>

                  <div className="sp-subject-bloom-table-wrap sp-exam-subject-cognitive-table-wrap">
                    <table className="sp-subject-bloom-table">
                      <thead>
                        <tr>
                          <th>Subject</th>
                          {BLOOM_SKILLS.map((skill) => {
                            const SkillIcon = BLOOM_SKILL_ICONS[skill.key];
                            return (
                              <th key={skill.key} style={{ "--skill-color": skill.color }}>
                                <span className="sp-mastery-skill-heading">
                                  <SkillIcon size={17} strokeWidth={2.4} aria-hidden="true" />
                                  {skill.key}
                                </span>
                              </th>
                            );
                          })}
                          <th>Subject Level</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedExamCognitiveAnalysis.subjectPerformance.map((subject) => {
                          const SubjectIcon = subject.Icon;
                          const subjectBand = getSubjectMasteryBand(subject.overall);
                          return (
                            <tr key={subject.key}>
                              <th>
                                <span className="sp-mastery-subject-heading">
                                  <SubjectIcon
                                    size={19}
                                    strokeWidth={2.3}
                                    style={{ color: subject.iconColor }}
                                    aria-hidden="true"
                                  />
                                  {subject.label}
                                </span>
                              </th>
                              {subject.skills.map((skill) => {
                                const band = getSubjectMasteryBand(skill.percentage);
                                return (
                                  <td
                                    className={`sp-mastery-cell sp-mastery-${band.key}`}
                                    key={skill.skill}
                                  >
                                    <strong>
                                      {skill.percentage === null
                                        ? "—"
                                        : `${skill.percentage}%`}
                                    </strong>
                                    {skill.percentage !== null && (
                                      <span className="sp-mastery-progress" aria-hidden="true">
                                        <span style={{ width: `${skill.percentage}%` }} />
                                      </span>
                                    )}
                                    <small>
                                      {skill.total > 0
                                        ? `${skill.correct}/${skill.total}`
                                        : "No questions"}
                                    </small>
                                  </td>
                                );
                              })}
                              <td className={`sp-subject-level sp-mastery-${subjectBand.key}`}>
                                <strong>{subjectBand.label}</strong>
                                <small>{subject.overall}%</small>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="sp-inline-empty sp-cognitive-empty">
                  Subject-wise cognitive analytics is unavailable because this exam does not have recognized subject tags.
                </div>
              )}
            </section>

            <section className="sp-panel sp-detail-panel">
              <div className="sp-panel-header">
                <div>
                  <h3>Question-wise analytics</h3>
                  <p>
                    Stored response evidence and the percentage of other students
                    who answered each question correctly.
                  </p>
                </div>
                <span className="sp-panel-badge">
                  {selectedQuestionRows.length} questions
                </span>
              </div>

              {selectedQuestionRows.length > 0 ? (
                <div className="sp-question-table-wrap">
                  <table className="sp-question-table">
                    <thead>
                      <tr>
                        <th>Question</th>
                        <th>Option</th>
                        <th>Key</th>
                        <th>Marks</th>
                        <th>Status</th>
                        <th title="Percentage of other students in this class and section who answered correctly">
                          Peer correct %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedQuestionRows.map((question, questionIndex) => (
                        <tr key={question.question}>
                          <td>{question.question}</td>
                          <td>{question.option || "—"}</td>
                          <td>{question.key || "—"}</td>
                          <td>{question.marks === "" ? "—" : question.marks}</td>
                          <td>
                            <span
                              className={`sp-status-pill sp-status-pill-${String(
                                question.status,
                              )
                                .toLowerCase()
                                .replace(/\s+/g, "-")}`}
                            >
                              {question.status}
                            </span>
                          </td>
                          <td>
                            {question.peerStatsStatus === "loading" ? (
                              <span className="sp-peer-rate sp-peer-rate-loading">
                                Loading
                              </span>
                            ) : question.peerCorrectPercentage === null ? (
                              <span
                                className="sp-peer-rate sp-peer-rate-unavailable"
                                title="Peer response data is unavailable"
                              >
                                —
                              </span>
                            ) : (
                              <span
                                className={`sp-peer-rate sp-peer-rate-tone-${questionIndex % 5}`}
                                title={`${question.peerCorrectCount}/${question.peerResponseCount} other students answered correctly`}
                              >
                                <strong>{question.peerCorrectPercentage}%</strong>
                                <span className="sp-peer-rate-track" aria-hidden="true">
                                  <span
                                    style={{
                                      width: `${clamp(question.peerCorrectPercentage, 0, 100)}%`,
                                    }}
                                  />
                                </span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="sp-inline-empty">
                  No question-wise data available for this exam.
                </div>
              )}
            </section>
          </section>
        ) : examResults.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="sp-overview-layout">
            <section
              className="sp-metrics-grid"
              aria-label="Performance summary"
            >
              <MetricCard
                icon={<Trophy size={21} strokeWidth={2.4} />}
                label="Average score"
                value={`${overallAverage}%`}
                helper={`${examResults.length} assessment${examResults.length === 1 ? "" : "s"}`}
                tone={scoreBand.tone}
              />
              <MetricCard
                icon={<TrendingUp size={21} strokeWidth={2.4} />}
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
                icon={<Target size={21} strokeWidth={2.4} />}
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
                icon={<Hash size={21} strokeWidth={2.4} />}
                label="Class rank"
                value={
                  latestExam?.class_rank ? `#${latestExam.class_rank}` : "—"
                }
                helper="Current exam"
                tone="primary"
              />
              <MetricCard
                icon={<Users size={21} strokeWidth={2.4} />}
                label="School rank"
                value={
                  latestExam?.school_rank ? `#${latestExam.school_rank}` : "—"
                }
                helper="Current exam"
                tone="primary"
              />
              <MetricCard
                icon={<Star size={21} strokeWidth={2.4} />}
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

            <div className="sp-overview-main">
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

            {/* Score overview removed from the student view.
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
            */}

            <section className="sp-dashboard-section sp-overview-insights">
              <div className="sp-teacher-insight-grid">
                <section className="sp-panel sp-recommendation-panel">
                  <div className="sp-panel-header">
                    <div className="sp-panel-title-group">
                      <span className="sp-panel-title-icon sp-recommendation-title-icon" aria-hidden="true">
                        <Lightbulb size={22} strokeWidth={2.4} />
                      </span>
                      <div>
                        <h3>Recommended teacher actions</h3>
                        <p>
                          Suggested from measured subject and Bloom-skill
                          performance.
                        </p>
                      </div>
                    </div>
                    <span className="sp-panel-badge">Measured insight</span>
                  </div>
                  <ol className="sp-action-list">
                    {teacherActions.map((recommendation, index) => (
                      <li key={recommendation}>
                        <span>{index + 1}</span>
                        <p>{recommendation}</p>
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="sp-panel sp-snapshot-panel">
                  <div className="sp-panel-header">
                    <div className="sp-panel-title-group">
                      <span className="sp-panel-title-icon sp-snapshot-title-icon" aria-hidden="true">
                        <BarChart3 size={22} strokeWidth={2.4} />
                      </span>
                      <div>
                        <h3>Learning snapshot</h3>
                        <p>Evidence summary from Bloom-tagged questions.</p>
                      </div>
                    </div>
                  </div>
                  <dl className="sp-snapshot-list">
                    <div>
                      <dt>Strongest measured subject</dt>
                      <dd>
                        {strongestMeasuredSubject?.label || "More evidence needed"}{" "}
                        <span>
                          {strongestMeasuredSubject
                            ? `${strongestMeasuredSubject.overall}%`
                            : "—"}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Priority measured subject</dt>
                      <dd>
                        {priorityMeasuredSubject?.label || "More evidence needed"}{" "}
                        <span>
                          {priorityMeasuredSubject
                            ? `${priorityMeasuredSubject.overall}%`
                            : "—"}
                        </span>
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
            </div>
            </div>

            <section className="sp-dashboard-section sp-cognitive-section">
              <SectionHeader
                eyebrow="Bloom's taxonomy"
                title="Cognitive Analysis"
                description="Cumulative mastery across Bloom-tagged questions from all recorded exams. Unattempted questions are included in the calculation."
                action={
                  <span className="sp-count-chip">
                    {cognitiveAnalysis.overall.total} tagged response
                    {cognitiveAnalysis.overall.total === 1 ? "" : "s"}
                  </span>
                }
              />

              {cognitiveAnalysis.hasData ? (
                <>
                  <div className="sp-cognitive-summary">
                    <article className="sp-cognitive-summary-card sp-cognitive-overall">
                      <div className="sp-cognitive-summary-head">
                        <span className="sp-cognitive-summary-icon" aria-hidden="true">
                          <Target size={18} strokeWidth={2.4} />
                        </span>
                        <span>Overall cognitive mastery</span>
                      </div>
                      <strong>{cognitiveAnalysis.overall.percentage}%</strong>
                      <small>
                        {cognitiveAnalysis.overall.correct}/
                        {cognitiveAnalysis.overall.total} correct
                      </small>
                    </article>
                    <article className="sp-cognitive-summary-card sp-cognitive-lots">
                      <div className="sp-cognitive-summary-head">
                        <span className="sp-cognitive-summary-icon" aria-hidden="true">
                          <Brain size={18} strokeWidth={2.4} />
                        </span>
                        <span>Lower Order Thinking</span>
                      </div>
                      <strong>{cognitiveAnalysis.lots.percentage ?? "No questions"}{cognitiveAnalysis.lots.percentage === null ? "" : "%"}</strong>
                      <small>Remember + Understand</small>
                    </article>
                    <article className="sp-cognitive-summary-card sp-cognitive-hots">
                      <div className="sp-cognitive-summary-head">
                        <span className="sp-cognitive-summary-icon" aria-hidden="true">
                          <Lightbulb size={18} strokeWidth={2.4} />
                        </span>
                        <span>Higher Order Thinking</span>
                      </div>
                      <strong>{cognitiveAnalysis.hots.percentage ?? "No questions"}{cognitiveAnalysis.hots.percentage === null ? "" : "%"}</strong>
                      <small>Apply + Analyse + Evaluate + Create</small>
                    </article>
                    <article className={`sp-cognitive-summary-card sp-cognitive-level sp-tone-${cognitiveAnalysis.level.tone}`}>
                      <div className="sp-cognitive-level-main">
                        <div className="sp-cognitive-summary-head">
                          <span className="sp-cognitive-summary-icon" aria-hidden="true">
                            <Award size={18} strokeWidth={2.4} />
                          </span>
                          <span>Cognitive level</span>
                        </div>
                        <strong>{cognitiveAnalysis.level.label}</strong>
                        <small>
                          {cognitiveAnalysis.gap === null
                            ? "LOTS/HOTS gap not available"
                            : `${Math.abs(cognitiveAnalysis.gap)} point LOTS/HOTS gap`}
                        </small>
                      </div>
                    </article>
                  </div>

                  <div className="sp-cognitive-level-ranges" aria-label="Cognitive level percentage ranges">
                    <span><b>Foundation:</b> &lt;40%</span>
                    <span><b>Developing:</b> 40–&lt;60%</span>
                    <span><b>Proficient:</b> 60–&lt;80%</span>
                    <span><b>Advanced Thinker:</b> ≥80%</span>
                  </div>

                  <div className="sp-cognitive-grid">
                    <section className="sp-panel sp-cognitive-skills-panel">
                      <div className="sp-panel-header">
                        <div>
                          <h3>Bloom skill mastery</h3>
                          <p>Correct answers out of all questions at each level.</p>
                        </div>
                        <span className="sp-panel-badge">
                          {cognitiveAnalysis.coverage}% coverage
                        </span>
                      </div>
                      <div className="sp-cognitive-skill-list">
                        {cognitiveAnalysis.skillPerformance.map((skill) => (
                          <article className="sp-cognitive-skill-row" key={skill.skill}>
                            <div className="sp-cognitive-donut">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={[
                                      { name: "Mastery", value: skill.percentage ?? 0 },
                                      {
                                        name: "Remaining",
                                        value: skill.percentage === null
                                          ? 100
                                          : 100 - skill.percentage,
                                      },
                                    ]}
                                    dataKey="value"
                                    startAngle={90}
                                    endAngle={-270}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="67%"
                                    outerRadius="88%"
                                    stroke="none"
                                    isAnimationActive={false}
                                  >
                                    <Cell fill={skill.color} />
                                    <Cell fill="#e8edf4" />
                                  </Pie>
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="sp-cognitive-donut-value">
                                <strong>
                                  {skill.percentage === null
                                    ? "—"
                                    : `${skill.percentage}%`}
                                </strong>
                              </div>
                            </div>
                            <div className="sp-cognitive-donut-copy">
                              <strong>{skill.skill}</strong>
                              <span>{skill.group}</span>
                            </div>
                            <div className="sp-cognitive-skill-track">
                              <span
                                style={{
                                  width: `${skill.percentage ?? 0}%`,
                                  background: skill.color,
                                }}
                              />
                            </div>
                            <div className="sp-cognitive-skill-score">
                              <strong>
                                {skill.percentage === null
                                  ? "No questions"
                                  : `${skill.percentage}%`}
                              </strong>
                              <small>
                                {skill.total > 0
                                  ? `${skill.correct}/${skill.total} correct`
                                  : "No tagged questions"}
                              </small>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>

                    <ChartCard
                      title="Cognitive performance trend"
                      subtitle="Exam-wise overall, LOTS, and HOTS mastery"
                      badge={`${cognitiveAnalysis.trend.filter((item) => item.taggedQuestions > 0).length} measured exams`}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={cognitiveAnalysis.trend}
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
                            ticks={[0, 25, 50, 75, 100]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#64748b", fontSize: 11 }}
                            tickFormatter={(value) => `${value}%`}
                          />
                          <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            labelFormatter={(_, payload) => {
                              const row = payload?.[0]?.payload;
                              return row ? `${row.exam} - ${row.date}` : "Assessment";
                            }}
                            formatter={(value, name) => [
                              value === null ? "No questions" : `${value}%`,
                              name,
                            ]}
                          />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                          <Line
                            type="monotone"
                            dataKey="overall"
                            name="Overall"
                            stroke={COLORS.blue}
                            strokeWidth={2.6}
                            connectNulls={false}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="lots"
                            name="LOTS"
                            stroke={COLORS.green}
                            strokeWidth={2.2}
                            connectNulls={false}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="hots"
                            name="HOTS"
                            stroke="#ff7a1a"
                            strokeWidth={2.2}
                            connectNulls={false}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>

                  <div className="sp-cognitive-footer-grid">
                    <section className="sp-panel sp-cognitive-evidence">
                      <div className="sp-panel-header">
                        <div>
                          <h3>Evidence quality</h3>
                          <p>How much of the available question data supports this analysis.</p>
                        </div>
                      </div>
                      <dl>
                        <div>
                          <dt>Bloom coverage</dt>
                          <dd>{cognitiveAnalysis.coverage}%</dd>
                        </div>
                        <div>
                          <dt>Tagged questions</dt>
                          <dd>{cognitiveAnalysis.overall.total}</dd>
                        </div>
                        <div>
                          <dt>Untagged questions</dt>
                          <dd>{cognitiveAnalysis.untaggedQuestions}</dd>
                        </div>
                        <div>
                          <dt>Unattempted tagged</dt>
                          <dd>{cognitiveAnalysis.overall.unattempted}</dd>
                        </div>
                      </dl>
                    </section>

                    <section className="sp-panel sp-cognitive-insights">
                      <div className="sp-panel-header">
                        <div>
                          <h3>Cognitive insights</h3>
                          <p>Priority observations based on measured performance.</p>
                        </div>
                      </div>
                      <ul>
                        {cognitiveAnalysis.insights.map((insight) => (
                          <li key={insight}>{insight}</li>
                        ))}
                      </ul>
                    </section>
                  </div>
                </>
              ) : (
                <div className="sp-inline-empty sp-cognitive-empty">
                  Cognitive analysis is unavailable because the recorded questions do not contain valid Bloom taxonomy tags.
                </div>
              )}
            </section>

            <section className="sp-dashboard-section sp-subject-bloom-section">
              <SectionHeader
                eyebrow="Subject intelligence"
                title="Subject Bloom's Taxonomy Analytics"
                description="Cumulative subject-wise mastery calculated from correctly answered Bloom-tagged questions, including unattempted questions in the denominator."
                action={
                  <span className="sp-count-chip">
                    {cognitiveAnalysis.subjectCoverage}% subject coverage
                  </span>
                }
              />

              {cognitiveAnalysis.subjectPerformance.length > 0 ? (
                <>
                  <div className="sp-subject-bloom-cards">
                    {cognitiveAnalysis.subjectPerformance.map((subject) => (
                      <article
                        className="sp-panel sp-subject-bloom-card"
                        key={subject.key}
                        style={{
                          "--subject-color": subject.color,
                          "--subject-icon-color": subject.iconColor,
                        }}
                      >
                        <div className="sp-subject-bloom-card-head">
                          <div>
                            <span className="sp-subject-bloom-icon" aria-hidden="true">
                              {React.createElement(subject.Icon, {
                                size: 19,
                                strokeWidth: 2.3,
                              })}
                            </span>
                            <h3>{subject.label}</h3>
                          </div>
                          <strong>{subject.overall}%</strong>
                        </div>
                        <p>
                          {subject.correct}/{subject.total} tagged questions correct
                        </p>
                        <dl>
                          <div>
                            <dt>LOTS</dt>
                            <dd>{subject.lots === null ? "No questions" : `${subject.lots}%`}</dd>
                          </div>
                          <div>
                            <dt>HOTS</dt>
                            <dd>{subject.hots === null ? "No questions" : `${subject.hots}%`}</dd>
                          </div>
                          <div>
                            <dt>Gap</dt>
                            <dd>{subject.gap === null ? "—" : `${Math.abs(subject.gap)} pts`}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>

                  <div className="sp-subject-bloom-grid">
                    <ChartCard
                      title="Subject cognitive profile"
                      subtitle="Mastery comparison across all six Bloom levels"
                      badge={`${cognitiveAnalysis.subjectPerformance.length} subjects`}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={cognitiveAnalysis.subjectPerformance}
                          margin={{ top: 6, right: 8, left: -16, bottom: 0 }}
                        >
                          <CartesianGrid
                            stroke="#e2e8f0"
                            strokeDasharray="4 4"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#64748b", fontSize: 11 }}
                          />
                          <YAxis
                            domain={[0, 100]}
                            ticks={[0, 25, 50, 75, 100]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#64748b", fontSize: 10 }}
                            tickFormatter={(value) => `${value}%`}
                          />
                          <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            formatter={(value, name) => [
                              value === null ? "No questions" : `${value}%`,
                              name,
                            ]}
                          />
                          <Legend content={<BloomSkillLegend />} />
                          {BLOOM_SKILLS.map((skill) => (
                            <Bar
                              key={skill.key}
                              dataKey={skill.key}
                              name={skill.key}
                              fill={skill.color}
                              radius={[3, 3, 0, 0]}
                              maxBarSize={18}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    <section className="sp-panel sp-subject-bloom-matrix-panel">
                      <div className="sp-panel-header">
                        <div>
                          <h3>Subject × Bloom mastery</h3>
                          <p>Exact mastery and response evidence for every measured skill.</p>
                        </div>
                      </div>
                      <div className="sp-mastery-legend" aria-label="Mastery level legend">
                        <span className="sp-mastery-excellent"><i /> <strong>≥ 80%</strong> Excellent</span>
                        <span className="sp-mastery-proficient"><i /> <strong>60 – 79%</strong> Proficient</span>
                        <span className="sp-mastery-developing"><i /> <strong>40 – 59%</strong> Developing</span>
                        <span className="sp-mastery-support"><i /> <strong>&lt; 40%</strong> Needs Support</span>
                      </div>
                      <div className="sp-subject-bloom-table-wrap">
                        <table className="sp-subject-bloom-table">
                          <thead>
                            <tr>
                              <th>Subject</th>
                              {BLOOM_SKILLS.map((skill) => {
                                const SkillIcon = BLOOM_SKILL_ICONS[skill.key];
                                return (
                                  <th key={skill.key} style={{ "--skill-color": skill.color }}>
                                    <span className="sp-mastery-skill-heading">
                                      <SkillIcon size={17} strokeWidth={2.4} aria-hidden="true" />
                                      {skill.key}
                                    </span>
                                  </th>
                                );
                              })}
                              <th>Subject Level</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cognitiveAnalysis.subjectPerformance.map((subject) => {
                              const SubjectIcon = subject.Icon;
                              const subjectBand = getSubjectMasteryBand(subject.overall);
                              return (
                                <tr key={subject.key}>
                                  <th>
                                    <span className="sp-mastery-subject-heading">
                                      <SubjectIcon
                                        size={19}
                                        strokeWidth={2.3}
                                        style={{ color: subject.iconColor }}
                                        aria-hidden="true"
                                      />
                                      {subject.label}
                                    </span>
                                  </th>
                                  {subject.skills.map((skill) => {
                                    const band = getSubjectMasteryBand(skill.percentage);
                                    return (
                                      <td
                                        className={`sp-mastery-cell sp-mastery-${band.key}`}
                                        key={skill.skill}
                                      >
                                        <strong>
                                          {skill.percentage === null
                                            ? "—"
                                            : `${skill.percentage}%`}
                                        </strong>
                                        {skill.percentage !== null && (
                                          <span className="sp-mastery-progress" aria-hidden="true">
                                            <span style={{ width: `${skill.percentage}%` }} />
                                          </span>
                                        )}
                                        <small>
                                          {skill.total > 0
                                            ? `${skill.correct}/${skill.total}`
                                            : "No questions"}
                                        </small>
                                      </td>
                                    );
                                  })}
                                  <td className={`sp-subject-level sp-mastery-${subjectBand.key}`}>
                                    <strong>{subjectBand.label}</strong>
                                    <small>{subject.overall}%</small>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>

                  <div className="sp-subject-bloom-insights">
                    <article className="sp-subject-bloom-insight sp-subject-bloom-strength">
                      <span className="sp-subject-bloom-insight-icon" aria-hidden="true">
                        <TrendingUp size={24} strokeWidth={2.5} />
                      </span>
                      <span>Strongest measured subject</span>
                      <strong>
                        {cognitiveAnalysis.strongestSubject?.label || "More evidence needed"}
                      </strong>
                      <p>
                        {cognitiveAnalysis.strongestSubject
                          ? `${cognitiveAnalysis.strongestSubject.overall}% cognitive mastery across ${cognitiveAnalysis.strongestSubject.total} tagged questions.`
                          : "At least three tagged questions are required before identifying a strength."}
                      </p>
                    </article>
                    <article className="sp-subject-bloom-insight sp-subject-bloom-priority">
                      <span className="sp-subject-bloom-insight-icon" aria-hidden="true">
                        <TrendingDown size={24} strokeWidth={2.5} />
                      </span>
                      <span>Priority measured subject</span>
                      <strong>
                        {cognitiveAnalysis.prioritySubject?.label || "More evidence needed"}
                      </strong>
                      <p>
                        {cognitiveAnalysis.prioritySubject
                          ? `${cognitiveAnalysis.prioritySubject.overall}% cognitive mastery; review its lowest Bloom-skill results first.`
                          : "At least three tagged questions are required before identifying a priority."}
                      </p>
                    </article>
                  </div>
                </>
              ) : (
                <div className="sp-inline-empty sp-cognitive-empty">
                  Subject Bloom analytics is unavailable because the Bloom-tagged questions do not contain recognized subject tags.
                </div>
              )}
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
                          "Actions",
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
                          <td>
                            <button
                              type="button"
                              className="sp-button sp-button-small"
                              onClick={() => setSelectedExamResult(result)}
                            >
                              View
                            </button>
                          </td>
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

                    <button
                      type="button"
                      className="sp-button sp-button-small sp-mobile-view-button"
                      onClick={() => setSelectedExamResult(result)}
                    >
                      View
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {!selectedExamResult && (
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
        )}
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
  .sp-button-small {
    min-height: 28px;
    padding: 5px 10px;
    border: 1px solid #cfe0f6;
    color: #1d4ed8;
    background: #eff6ff;
    font-size: 11px;
    box-shadow: 0 1px 2px rgba(15,23,42,.04);
  }
  .sp-detail-actions {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 10px;
  }
  .sp-detail-download-button {
    min-height: 42px;
    padding: 10px 18px;
    border-color: #0f2f63;
    border-radius: 8px;
    color: #fff;
    background: #0f2f63;
    font-size: 14px;
    font-weight: 850;
  }
  .sp-detail-back-button {
    min-height: 42px;
    padding: 10px 22px;
    border-color: #b8d4fb;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 850;
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

  .sp-cognitive-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  .sp-cognitive-summary-card {
    min-width: 0;
    padding: 16px;
    border: 1px solid #dce3ec;
    border-top: 3px solid #2563eb;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 1px 3px rgba(15,23,42,.055);
  }
  .sp-cognitive-summary-head {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .sp-cognitive-summary-head > span:last-child {
    display: block;
    color: var(--sp-slate-500);
    font-size: 10px;
    font-weight: 850;
    letter-spacing: .055em;
    text-transform: uppercase;
  }
  .sp-cognitive-summary-icon {
    display: grid;
    place-items: center;
    flex: 0 0 32px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: #fff;
    background: #2563eb;
  }
  .sp-cognitive-lots .sp-cognitive-summary-icon { background: #10b981; }
  .sp-cognitive-hots .sp-cognitive-summary-icon { background: #ff7a1a; }
  .sp-cognitive-level .sp-cognitive-summary-icon { background: #2563eb; }
  .sp-cognitive-summary-card strong {
    display: block;
    margin-top: 7px;
    color: var(--sp-navy);
    font-size: clamp(20px, 2.4vw, 27px);
    line-height: 1.1;
  }
  .sp-cognitive-summary-card small {
    display: block;
    margin-top: 7px;
    color: var(--sp-slate-500);
    font-size: 10.5px;
    line-height: 1.4;
  }
  .sp-cognitive-lots { border-top-color: #10b981; }
  .sp-cognitive-hots { border-top-color: #ff7a1a; }
  .sp-cognitive-level.sp-tone-success { border-top-color: #10b981; }
  .sp-cognitive-level.sp-tone-warning { border-top-color: #f59e0b; }
  .sp-cognitive-level.sp-tone-danger { border-top-color: #ef4444; }
  .sp-cognitive-level strong { font-size: clamp(18px, 2vw, 23px); }
  .sp-cognitive-level-main { min-width: 0; }
  .sp-cognitive-level-ranges {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px 18px;
    margin: 8px 2px 0;
    color: #111827;
    font-size: 9px;
    line-height: 1.4;
  }
  .sp-cognitive-level-ranges b { font-weight: 700; }

  .sp-cognitive-grid,
  .sp-cognitive-footer-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 12px;
  }
  .sp-cognitive-skills-panel { padding-bottom: 14px; }
  .sp-cognitive-skill-list {
    display: flex;
    flex-direction: column;
    gap: 13px;
    padding: 14px;
  }
  .sp-cognitive-skill-row {
    display: grid;
    grid-template-columns: 90px minmax(120px, 1fr) 92px;
    align-items: center;
    gap: 14px;
    min-width: 0;
    padding: 0;
  }
  .sp-cognitive-skill-row .sp-cognitive-donut { display: none; }
  .sp-cognitive-donut-copy { min-width: 0; }
  .sp-cognitive-donut-copy > strong {
    display: block;
    color: var(--sp-navy);
    font-size: 12px;
    font-weight: 900;
  }
  .sp-cognitive-donut-copy > span {
    display: block;
    margin-top: 4px;
    color: var(--sp-slate-500);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0;
  }
  .sp-cognitive-skill-track {
    height: 9px;
    overflow: hidden;
    border-radius: 999px;
    background: #e8edf4;
  }
  .sp-cognitive-skill-track span {
    display: block;
    height: 100%;
    border-radius: inherit;
  }
  .sp-cognitive-skill-score {
    text-align: right;
  }
  .sp-cognitive-skill-score > strong {
    display: block;
    color: var(--sp-navy);
    font-size: 13px;
    font-weight: 900;
  }
  .sp-cognitive-skill-score > small {
    display: block;
    margin-top: 4px;
    color: var(--sp-slate-500);
    font-size: 9px;
    line-height: 1.3;
  }
  .sp-cognitive-evidence,
  .sp-cognitive-insights { padding-bottom: 14px; }
  .sp-cognitive-evidence dl {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin: 14px;
  }
  .sp-cognitive-evidence dl > div {
    padding: 10px;
    border-radius: 8px;
    background: var(--sp-slate-50);
  }
  .sp-cognitive-evidence dt {
    color: var(--sp-slate-500);
    font-size: 9px;
    line-height: 1.35;
  }
  .sp-cognitive-evidence dd {
    margin: 5px 0 0;
    color: var(--sp-navy);
    font-size: 17px;
    font-weight: 850;
  }
  .sp-cognitive-evidence dl > div:nth-child(1) {
    border: 1px solid #cfe6fb;
    background: linear-gradient(135deg, #f4faff, #e5f3ff);
  }
  .sp-cognitive-evidence dl > div:nth-child(1) dd { color: #1059ad; }
  .sp-cognitive-evidence dl > div:nth-child(2) {
    border: 1px solid #d2efde;
    background: linear-gradient(135deg, #f5fff9, #e8f8ef);
  }
  .sp-cognitive-evidence dl > div:nth-child(2) dd { color: #087f4f; }
  .sp-cognitive-evidence dl > div:nth-child(3) {
    border: 1px solid #f4dfcf;
    background: linear-gradient(135deg, #fffaf6, #fff0e5);
  }
  .sp-cognitive-evidence dl > div:nth-child(3) dd { color: #a64b12; }
  .sp-cognitive-evidence dl > div:nth-child(4) {
    border: 1px solid #e1d9f7;
    background: linear-gradient(135deg, #fbf9ff, #f0ebff);
  }
  .sp-cognitive-evidence dl > div:nth-child(4) dd { color: #5526a9; }
  .sp-cognitive-insights ul {
    display: grid;
    gap: 8px;
    margin: 14px;
    padding: 0;
    list-style: none;
  }
  .sp-cognitive-insights li {
    position: relative;
    padding: 10px 10px 10px 29px;
    border-radius: 8px;
    color: var(--sp-slate-600);
    background: var(--sp-slate-50);
    font-size: 11px;
    line-height: 1.45;
  }
  .sp-cognitive-insights li::before {
    content: "";
    position: absolute;
    top: 15px;
    left: 12px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #2563eb;
  }
  .sp-cognitive-insights li:nth-child(1) {
    color: #17553b;
    background: linear-gradient(100deg, #effcf5, #e5f8ee);
  }
  .sp-cognitive-insights li:nth-child(1)::before { background: #20b977; }
  .sp-cognitive-insights li:nth-child(2) {
    color: #82411b;
    background: linear-gradient(100deg, #fff8f1, #ffede0);
  }
  .sp-cognitive-insights li:nth-child(2)::before { background: #f47a25; }
  .sp-cognitive-insights li:nth-child(3) {
    color: #8d2038;
    background: linear-gradient(100deg, #fff2f5, #ffe5eb);
  }
  .sp-cognitive-insights li:nth-child(3)::before { background: #ef3159; }
  .sp-cognitive-insights li:nth-child(n+4) {
    color: #44308f;
    background: linear-gradient(100deg, #f8f5ff, #eee8ff);
  }
  .sp-cognitive-insights li:nth-child(n+4)::before { background: #7252d6; }
  .sp-cognitive-empty { margin-top: 0; }

  .sp-subject-bloom-cards {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  .sp-subject-bloom-card {
    padding: 14px;
    border-top: 3px solid var(--subject-color, #2563eb);
  }
  .sp-subject-bloom-card-head,
  .sp-subject-bloom-card-head > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .sp-subject-bloom-card-head > div { justify-content: flex-start; }
  .sp-subject-bloom-icon {
    display: grid;
    place-items: center;
    flex: 0 0 34px;
    width: 34px;
    height: 34px;
    border-radius: 9px;
    color: #fff;
    background: var(--subject-icon-color, var(--subject-color, #2563eb));
  }
  .sp-subject-bloom-card h3 {
    margin: 0;
    color: var(--sp-navy);
    font-size: 13px;
  }
  .sp-subject-bloom-card-head > strong {
    color: var(--subject-color, #2563eb);
    font-size: 21px;
  }
  .sp-subject-bloom-card > p {
    margin: 8px 0 12px;
    color: var(--sp-slate-500);
    font-size: 10px;
  }
  .sp-subject-bloom-card dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5px;
    margin: 0;
  }
  .sp-subject-bloom-card dl > div {
    padding: 8px 5px;
    border-radius: 7px;
    background: var(--sp-slate-50);
    text-align: center;
  }
  .sp-subject-bloom-card dl > div:nth-child(1) {
    border: 1px solid #bfe8cf;
    background: linear-gradient(135deg, #f1fcf5, #e2f7ea);
  }
  .sp-subject-bloom-card dl > div:nth-child(1) dt,
  .sp-subject-bloom-card dl > div:nth-child(1) dd { color: #087b4a; }
  .sp-subject-bloom-card dl > div:nth-child(2) {
    border: 1px solid #f4d1b8;
    background: linear-gradient(135deg, #fff8f1, #ffeadc);
  }
  .sp-subject-bloom-card dl > div:nth-child(2) dt,
  .sp-subject-bloom-card dl > div:nth-child(2) dd { color: #c45a16; }
  .sp-subject-bloom-card dl > div:nth-child(3) {
    display: none;
  }
  .sp-subject-bloom-card dt {
    color: var(--sp-slate-500);
    font-size: 8px;
    font-weight: 800;
  }
  .sp-subject-bloom-card dd {
    margin: 4px 0 0;
    color: var(--sp-slate-700);
    font-size: 11px;
    font-weight: 850;
  }
  .sp-subject-bloom-grid {
    display: grid;
    grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr);
    gap: 12px;
    margin-top: 12px;
  }
  .sp-bloom-chart-legend {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 7px 12px;
    padding: 4px 8px 0;
  }
  .sp-bloom-chart-legend span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--sp-slate-600);
    font-size: 10px;
    white-space: nowrap;
  }
  .sp-bloom-chart-legend i {
    display: block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .sp-subject-bloom-matrix-panel {
    min-width: 0;
    overflow: hidden;
    padding-bottom: 12px;
  }
  .sp-subject-bloom-section .sp-subject-bloom-grid { grid-template-columns: 1fr; }
  .sp-subject-bloom-matrix-panel .sp-panel-header h3 { font-size: 15px; }
  .sp-subject-bloom-matrix-panel .sp-panel-header p { font-size: 12px; }
  .sp-mastery-legend {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin: 10px 14px 0;
    color: #111827;
    font-size: 11px;
  }
  .sp-mastery-legend span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .sp-mastery-legend i {
    width: 9px;
    height: 9px;
    border: 4px solid transparent;
    border-radius: 50%;
  }
  .sp-mastery-legend .sp-mastery-excellent i { border-color: #b9f1d5; background: #10b981; }
  .sp-mastery-legend .sp-mastery-proficient i { border-color: #d5f5e1; background: #60d994; }
  .sp-mastery-legend .sp-mastery-developing i { border-color: #fff1b8; background: #f5c518; }
  .sp-mastery-legend .sp-mastery-support i { border-color: #ffd7df; background: #f43f68; }
  .sp-subject-bloom-table-wrap {
    margin: 14px;
    overflow-x: auto;
    overflow-y: hidden;
    border: 1px solid var(--sp-slate-200);
    border-radius: 8px;
  }
  .sp-subject-bloom-table {
    width: 100%;
    min-width: 860px;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 10px;
    text-align: center;
  }
  .sp-subject-bloom-table th,
  .sp-subject-bloom-table td {
    padding: 10px 4px;
    border-right: 1px solid var(--sp-slate-100);
    border-bottom: 1px solid var(--sp-slate-100);
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .sp-subject-bloom-table th:last-child,
  .sp-subject-bloom-table td:last-child { border-right: 0; }
  .sp-subject-bloom-table tr:last-child th,
  .sp-subject-bloom-table tr:last-child td { border-bottom: 0; }
  .sp-subject-bloom-table thead th {
    color: var(--sp-slate-600);
    background: var(--sp-slate-50);
    font-size: 10px;
  }
  .sp-subject-bloom-table tbody th {
    color: var(--sp-navy);
    background: #fbfdff;
    text-align: left;
    white-space: normal;
  }
  .sp-subject-bloom-table td strong {
    display: block;
    color: var(--sp-slate-700);
    font-size: 12px;
  }
  .sp-subject-bloom-table td small {
    display: block;
    margin-top: 3px;
    color: var(--sp-slate-500);
    font-size: 9px;
  }
  .sp-subject-bloom-matrix-panel .sp-subject-bloom-table thead th:first-child,
  .sp-subject-bloom-matrix-panel .sp-subject-bloom-table thead th:last-child {
    background: #f3f7fb;
  }
  .sp-subject-bloom-matrix-panel .sp-subject-bloom-table thead th:nth-child(2) { background: #e4f1ff; }
  .sp-subject-bloom-matrix-panel .sp-subject-bloom-table thead th:nth-child(3) { background: #e2f8ea; }
  .sp-subject-bloom-matrix-panel .sp-subject-bloom-table thead th:nth-child(4) { background: #fff4c9; }
  .sp-subject-bloom-matrix-panel .sp-subject-bloom-table thead th:nth-child(5) { background: #ffead5; }
  .sp-subject-bloom-matrix-panel .sp-subject-bloom-table thead th:nth-child(6) { background: #ffe2e9; }
  .sp-subject-bloom-matrix-panel .sp-subject-bloom-table thead th:nth-child(7) { background: #eee8ff; }
  .sp-mastery-skill-heading,
  .sp-mastery-subject-heading {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .sp-mastery-skill-heading svg { color: var(--skill-color, #2563eb); }
  .sp-mastery-subject-heading { justify-content: flex-start; }
  .sp-subject-bloom-matrix-panel .sp-mastery-cell,
  .sp-subject-bloom-matrix-panel .sp-subject-level {
    border: 3px solid #fff;
    border-radius: 8px;
  }
  .sp-subject-bloom-matrix-panel .sp-mastery-cell.sp-mastery-excellent,
  .sp-subject-bloom-matrix-panel .sp-subject-level.sp-mastery-excellent { background: #d9f8e6; }
  .sp-subject-bloom-matrix-panel .sp-mastery-cell.sp-mastery-proficient,
  .sp-subject-bloom-matrix-panel .sp-subject-level.sp-mastery-proficient { background: #e8faef; }
  .sp-subject-bloom-matrix-panel .sp-mastery-cell.sp-mastery-developing,
  .sp-subject-bloom-matrix-panel .sp-subject-level.sp-mastery-developing { background: #fff6d6; }
  .sp-subject-bloom-matrix-panel .sp-mastery-cell.sp-mastery-support,
  .sp-subject-bloom-matrix-panel .sp-subject-level.sp-mastery-support { background: #ffe7ed; }
  .sp-subject-bloom-matrix-panel .sp-mastery-cell.sp-mastery-unassessed,
  .sp-subject-bloom-matrix-panel .sp-subject-level.sp-mastery-unassessed { background: #f2f6fa; }
  .sp-mastery-progress {
    display: block;
    height: 6px;
    margin: 6px auto 0;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(15, 23, 42, .08);
  }
  .sp-mastery-progress > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #10b981;
  }
  .sp-mastery-proficient .sp-mastery-progress > span { background: #49d687; }
  .sp-mastery-developing .sp-mastery-progress > span { background: #f5c518; }
  .sp-mastery-support .sp-mastery-progress > span { background: #f43f68; }
  .sp-subject-level strong {
    color: var(--sp-navy) !important;
    font-size: 11px !important;
  }
  .sp-subject-level small {
    color: var(--sp-slate-700) !important;
    font-size: 11px !important;
    font-weight: 850;
  }
  .sp-subject-bloom-insights {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 12px;
  }
  .sp-subject-bloom-insight {
    position: relative;
    min-height: 96px;
    padding: 15px 16px 15px 68px;
    border: 1px solid #dce3ec;
    border-left: 4px solid #10b981;
    border-radius: 9px;
    background: #fff;
  }
  .sp-subject-bloom-priority { border-left-color: #ef4444; }
  .sp-subject-bloom-insight > span:not(.sp-subject-bloom-insight-icon) {
    display: block;
    color: var(--sp-slate-500);
    font-size: 9px;
    font-weight: 850;
    letter-spacing: .06em;
    text-transform: uppercase;
  }
  .sp-subject-bloom-insight-icon {
    position: absolute;
    top: 50%;
    left: 16px;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    transform: translateY(-50%);
    border-radius: 50%;
  }
  .sp-subject-bloom-strength .sp-subject-bloom-insight-icon {
    color: #079447;
    border: 1px solid #bbf7d0;
    background: #dcfce7;
  }
  .sp-subject-bloom-priority .sp-subject-bloom-insight-icon {
    color: #dc3545;
    border: 1px solid #fecdd3;
    background: #ffe4e8;
  }
  .sp-subject-bloom-insight strong {
    display: block;
    margin-top: 5px;
    color: var(--sp-navy);
    font-size: 16px;
  }
  .sp-subject-bloom-insight p {
    margin: 5px 0 0;
    color: var(--sp-slate-500);
    font-size: 11px;
    line-height: 1.45;
  }

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

  .sp-exam-detail {
    display: grid;
    gap: 12px;
  }
  .sp-exam-cognitive-panel {
    padding-bottom: 14px;
  }
  .sp-exam-cognitive-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    padding: 14px 14px 0;
  }
  .sp-exam-cognitive-card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-width: 0;
    padding: 12px;
    border: 1px solid var(--sp-slate-200);
    border-top: 3px solid #2563eb;
    border-radius: 8px;
    background: #fff;
  }
  .sp-exam-cognitive-lots { border-top-color: #10b981; }
  .sp-exam-cognitive-hots { border-top-color: #ff7a1a; }
  .sp-exam-cognitive-level.sp-tone-success { border-top-color: #10b981; }
  .sp-exam-cognitive-level.sp-tone-warning { border-top-color: #f59e0b; }
  .sp-exam-cognitive-level.sp-tone-danger { border-top-color: #ef4444; }
  .sp-exam-cognitive-icon {
    display: grid;
    place-items: center;
    flex: 0 0 30px;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    color: #fff;
    background: #2563eb;
  }
  .sp-exam-cognitive-lots .sp-exam-cognitive-icon { background: #10b981; }
  .sp-exam-cognitive-hots .sp-exam-cognitive-icon { background: #ff7a1a; }
  .sp-exam-cognitive-card div { min-width: 0; }
  .sp-exam-cognitive-card div > span {
    display: block;
    color: var(--sp-slate-500);
    font-size: 9px;
    font-weight: 850;
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  .sp-exam-cognitive-card strong {
    display: block;
    margin-top: 5px;
    color: var(--sp-navy);
    font-size: 20px;
    line-height: 1.15;
  }
  .sp-exam-cognitive-level strong {
    font-size: 17px;
  }
  .sp-exam-cognitive-card small {
    display: block;
    margin-top: 5px;
    color: var(--sp-slate-500);
    font-size: 10px;
    line-height: 1.35;
  }
  .sp-exam-cognitive-skills {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 8px;
    padding: 10px 14px 0;
  }
  .sp-exam-cognitive-skill {
    min-width: 0;
    padding: 9px 8px;
    border: 1px solid var(--sp-slate-100);
    border-radius: 8px;
    background: var(--sp-slate-50);
  }
  .sp-exam-cognitive-skill span {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: var(--sp-navy);
    font-size: 10px;
    font-weight: 850;
  }
  .sp-exam-cognitive-skill i {
    flex: 0 0 8px;
    width: 8px;
    height: 8px;
    border-radius: 999px;
  }
  .sp-exam-cognitive-skill strong {
    display: block;
    margin-top: 7px;
    color: var(--sp-navy);
    font-size: 14px;
  }
  .sp-exam-cognitive-skill small {
    display: block;
    margin-top: 3px;
    color: var(--sp-slate-500);
    font-size: 8.5px;
    line-height: 1.3;
  }
  .sp-exam-subject-cognitive-panel {
    padding-bottom: 14px;
  }
  .sp-exam-subject-cognitive-panel > .sp-panel-header h3 { font-size: 16px; }
  .sp-exam-subject-cognitive-panel > .sp-panel-header p { font-size: 12px; }
  .sp-exam-subject-cognitive-panel > .sp-panel-header .sp-panel-badge { font-size: 11px; }
  .sp-exam-subject-cognitive-panel .sp-subject-bloom-card h3 { font-size: 14px; }
  .sp-exam-subject-cognitive-panel .sp-subject-bloom-card-head > strong { font-size: 23px; }
  .sp-exam-subject-cognitive-panel .sp-subject-bloom-card > p { font-size: 11px; }
  .sp-exam-subject-cognitive-panel .sp-subject-bloom-card dt { font-size: 9px; }
  .sp-exam-subject-cognitive-panel .sp-subject-bloom-card dd { font-size: 12px; }
  .sp-exam-subject-cognitive-panel .sp-subject-bloom-table thead th,
  .sp-exam-subject-cognitive-panel .sp-subject-bloom-table tbody th { font-size: 11px; }
  .sp-exam-subject-cognitive-panel .sp-subject-bloom-table td strong { font-size: 13px; }
  .sp-exam-subject-cognitive-panel .sp-subject-bloom-table td small { font-size: 9.5px; }
  .sp-exam-subject-cognitive-cards {
    padding: 14px 14px 0;
  }
  .sp-exam-subject-cognitive-table-wrap {
    margin-top: 12px;
  }
  .sp-detail-panel {
    padding-bottom: 14px;
  }
  .sp-question-table-wrap {
    max-height: 600px;
    margin: 16px;
    overflow: auto;
    border: 1px solid var(--sp-slate-200);
    border-radius: 8px;
  }
  .sp-question-table {
    width: 100%;
    min-width: 780px;
    border-collapse: collapse;
    font-size: 14px;
  }
  .sp-question-table th,
  .sp-question-table td {
    padding: 14px 18px;
    border-bottom: 1px solid var(--sp-slate-100);
    text-align: left;
  }
  .sp-question-table th {
    position: sticky;
    top: 0;
    z-index: 1;
    color: var(--sp-slate-600);
    background: var(--sp-slate-50);
    font-size: 12px;
    font-weight: 850;
    text-transform: uppercase;
    letter-spacing: .03em;
  }
  .sp-question-table th:last-child {
    min-width: 260px;
    background: linear-gradient(135deg, #f8f7ff, #f2efff);
  }
  .sp-question-table tbody tr:last-child td {
    border-bottom: 0;
  }
  .sp-status-pill {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 850;
    white-space: nowrap;
  }
  .sp-status-pill-correct {
    color: #047857;
    background: #ecfdf5;
  }
  .sp-status-pill-incorrect {
    color: #b91c1c;
    background: #fef2f2;
  }
  .sp-status-pill-not-attempted {
    color: #b45309;
    background: #fffbeb;
  }
  .sp-peer-rate {
    --peer-color: #2878e9;
    --peer-fill: #79adf7;
    --peer-track: #dcecff;
    --peer-bg: #f1f7ff;
    display: grid;
    grid-template-columns: 62px minmax(100px, 1fr);
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 48px;
    padding: 9px 16px;
    border-radius: 11px;
    color: var(--peer-color);
    background: var(--peer-bg);
  }
  .sp-peer-rate > strong {
    font-size: 16px;
    font-weight: 850;
    white-space: nowrap;
  }
  .sp-peer-rate-track {
    display: block;
    height: 10px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--peer-track);
  }
  .sp-peer-rate-track > span {
    display: block;
    height: 100%;
    min-width: 3px;
    border-radius: inherit;
    background: var(--peer-fill);
  }
  .sp-peer-rate-tone-1 {
    --peer-color: #07966a;
    --peer-fill: #68c9aa;
    --peer-track: #d9f3ea;
    --peer-bg: #effaf6;
  }
  .sp-peer-rate-tone-2 {
    --peer-color: #e68a13;
    --peer-fill: #ffc667;
    --peer-track: #fff0d5;
    --peer-bg: #fff8eb;
  }
  .sp-peer-rate-tone-3 {
    --peer-color: #7c3aed;
    --peer-fill: #b487f4;
    --peer-track: #eee3ff;
    --peer-bg: #f7f2ff;
  }
  .sp-peer-rate-tone-4 {
    --peer-color: #ed3f68;
    --peer-fill: #f58ba5;
    --peer-track: #ffe2e9;
    --peer-bg: #fff2f5;
  }
  .sp-peer-rate-loading,
  .sp-peer-rate-unavailable {
    display: inline-grid;
    grid-template-columns: 1fr;
    width: auto;
    min-width: 86px;
    min-height: 32px;
    padding: 6px 10px;
    color: var(--sp-slate-500);
    background: var(--sp-slate-50);
    font-size: 11px;
    font-weight: 800;
    text-align: center;
  }
  .sp-mobile-view-button {
    width: 100%;
    margin-top: 12px;
  }

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

  .sp-overview-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) clamp(220px, 19vw, 250px);
    gap: 12px;
    align-items: stretch;
    margin: 14px 0 0;
  }
  .sp-overview-main {
    display: flex;
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
    flex-direction: column;
    gap: 12px;
  }
  .sp-overview-main > .sp-overview-insights {
    order: 1;
    flex: 1 1 auto;
    min-height: 0;
    margin-top: 0 !important;
  }
  .sp-overview-main > .sp-insight-strip {
    order: 2;
    flex: 0 0 118px;
    min-height: 118px;
    box-sizing: border-box;
  }
  .sp-overview-insights .sp-teacher-insight-grid {
    grid-template-columns: minmax(0, 1.2fr) minmax(290px, .8fr);
    gap: 10px;
    height: 100%;
    min-height: 330px;
    margin-top: 0 !important;
    transform: none;
  }
  .sp-overview-insights .sp-recommendation-panel,
  .sp-overview-insights .sp-snapshot-panel {
    height: 100%;
    box-sizing: border-box;
    padding-bottom: 16px;
  }
  .sp-overview-insights .sp-panel-header { padding: 16px 16px 0; }
  .sp-overview-insights .sp-panel-header h3 { font-size: 18px; }
  .sp-overview-insights .sp-panel-header p { font-size: 13px; line-height: 1.5; }
  .sp-overview-insights .sp-panel-badge { font-size: 11.5px; }
  .sp-overview-insights .sp-panel-title-group {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 12px;
  }
  .sp-overview-insights .sp-panel-title-icon {
    display: grid;
    place-items: center;
    flex: 0 0 44px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
  }
  .sp-overview-insights .sp-recommendation-title-icon {
    color: #f2a000;
    background: #fff0c9;
  }
  .sp-overview-insights .sp-snapshot-title-icon {
    color: #09a934;
    background: #d9f7df;
  }
  .sp-overview-insights .sp-action-list { gap: 10px; margin: 14px 14px 0; }
  .sp-overview-insights .sp-action-list li { gap: 11px; padding: 12px; }
  .sp-overview-insights .sp-action-list li > span {
    width: 27px;
    height: 27px;
  }
  .sp-overview-insights .sp-action-list li > span { font-size: 13px; }
  .sp-overview-insights .sp-action-list p { font-size: 14px; line-height: 1.5; }
  .sp-overview-insights .sp-snapshot-list { margin: 10px 16px 0; }
  .sp-overview-insights .sp-snapshot-list > div { padding: 12px 0; }
  .sp-overview-insights .sp-snapshot-list dt { font-size: 13px; }
  .sp-overview-insights .sp-snapshot-list dd { font-size: 15px; }
  .sp-overview-insights .sp-snapshot-list dd span { font-size: 15px; }
  .sp-overview-main > .sp-insight-strip {
    grid-template-columns: minmax(0, 1fr) 330px;
    padding: 12px 14px;
  }
  .sp-overview-main > .sp-insight-strip .sp-eyebrow { font-size: 11px; }
  .sp-overview-main > .sp-insight-strip .sp-insight-main strong { font-size: 26px; }
  .sp-overview-main > .sp-insight-strip .sp-insight-main p { font-size: 13px; }
  .sp-overview-main .sp-insight-stats div { padding: 9px 12px; }
  .sp-overview-main .sp-insight-stats span { font-size: 11px; }
  .sp-overview-main .sp-insight-stats strong { font-size: 17px; }
  .sp-overview-layout > .sp-metrics-grid {
    grid-column: 2;
    grid-row: 1;
    grid-template-columns: 1fr;
    grid-template-rows: repeat(6, minmax(54px, 1fr));
    gap: 7px;
    margin: 0;
  }
  .sp-overview-layout .sp-metric-card {
    align-items: center;
    min-height: 54px;
    box-sizing: border-box;
    padding: 8px 9px;
    gap: 13px;
  }
  .sp-overview-layout .sp-metric-icon {
    flex-basis: 34px;
    width: 34px;
    height: 34px;
    border-radius: 9px;
    font-size: 17px;
  }
  .sp-overview-layout .sp-metric-copy { padding-left: 2px; }
  .sp-overview-layout .sp-eyebrow { font-size: 8.5px; }
  .sp-overview-layout .sp-metric-value { margin-top: 3px; font-size: 18px; }
  .sp-overview-layout .sp-metric-helper {
    max-width: 170px;
    margin-top: 3px;
    overflow: hidden;
    font-size: 9px;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sp-overview-layout .sp-metric-card:nth-child(1) {
    border-color: #bfdbfe;
    background: linear-gradient(120deg, #f8fbff, #edf6ff);
  }
  .sp-overview-layout .sp-metric-card:nth-child(1) .sp-metric-icon {
    color: #1672d4;
    background: #dbeafe;
  }
  .sp-overview-layout .sp-metric-card:nth-child(2) {
    border-color: #f5d99a;
    background: linear-gradient(120deg, #fffdf7, #fff5dc);
  }
  .sp-overview-layout .sp-metric-card:nth-child(2) .sp-metric-icon {
    color: #f59e0b;
    background: #ffedc2;
  }
  .sp-overview-layout .sp-metric-card:nth-child(3) {
    border-color: #b7e7c3;
    background: linear-gradient(120deg, #f6fff8, #e5f9e9);
  }
  .sp-overview-layout .sp-metric-card:nth-child(3) .sp-metric-icon {
    color: #0aaa35;
    background: #d1f5d9;
  }
  .sp-overview-layout .sp-metric-card:nth-child(4) {
    border-color: #ddd0fa;
    background: linear-gradient(120deg, #fbf9ff, #f1ebff);
  }
  .sp-overview-layout .sp-metric-card:nth-child(4) .sp-metric-icon {
    color: #6d28d9;
    background: #e9ddff;
  }
  .sp-overview-layout .sp-metric-card:nth-child(5) {
    border-color: #f6c8ce;
    background: linear-gradient(120deg, #fff9fa, #ffecef);
  }
  .sp-overview-layout .sp-metric-card:nth-child(5) .sp-metric-icon {
    color: #dc2745;
    background: #ffdce2;
  }
  .sp-overview-layout .sp-metric-card:nth-child(6) {
    border-color: #bcd9f7;
    background: linear-gradient(120deg, #f8fbff, #e8f3ff);
  }
  .sp-overview-layout .sp-metric-card:nth-child(6) .sp-metric-icon {
    color: #1267cc;
    background: #d5eaff;
  }
  .sp-overview-layout .sp-metric-card:nth-child(1) .sp-eyebrow,
  .sp-overview-layout .sp-metric-card:nth-child(6) .sp-eyebrow { color: #155fb8; }
  .sp-overview-layout .sp-metric-card:nth-child(2) .sp-eyebrow { color: #a96500; }
  .sp-overview-layout .sp-metric-card:nth-child(3) .sp-eyebrow { color: #087b2a; }
  .sp-overview-layout .sp-metric-card:nth-child(4) .sp-eyebrow { color: #5b21b6; }
  .sp-overview-layout .sp-metric-card:nth-child(5) .sp-eyebrow { color: #b51d38; }

  .sp-overview-insights .sp-action-list li:first-child {
    background: linear-gradient(100deg, #fff2f4, #ffe7ec);
  }
  .sp-overview-insights .sp-action-list li:first-child > span {
    background: #d91f3d;
  }
  .sp-overview-insights .sp-action-list li:last-child {
    background: linear-gradient(100deg, #f2f8ff, #e6f2ff);
  }
  .sp-overview-insights .sp-action-list li:last-child > span {
    background: #1262bf;
  }
  .sp-overview-insights .sp-snapshot-list > div {
    border-bottom: 0;
    border-radius: 8px;
    margin-bottom: 8px;
    padding: 12px;
  }
  .sp-overview-insights .sp-snapshot-list > div:nth-child(1),
  .sp-overview-insights .sp-snapshot-list > div:nth-child(4) {
    background: #e7f8e9;
  }
  .sp-overview-insights .sp-snapshot-list > div:nth-child(2) {
    background: #ffedef;
  }
  .sp-overview-insights .sp-snapshot-list > div:nth-child(3) {
    background: #eaf4ff;
  }
  .sp-overview-insights .sp-snapshot-list > div:nth-child(1) dd span,
  .sp-overview-insights .sp-snapshot-list > div:nth-child(4) dd span { color: #07962e; }
  .sp-overview-insights .sp-snapshot-list > div:nth-child(2) dd span { color: #d91f3d; }
  .sp-overview-insights .sp-snapshot-list > div:nth-child(3) dd span { color: #1262bf; }

  .sp-overview-main > .sp-insight-strip {
    border-color: #f2d58e;
    border-left-color: #f2a900;
    background: linear-gradient(115deg, #fffdf8, #fff8e7);
  }
  .sp-overview-main > .sp-insight-strip .sp-insight-icon {
    color: #ef9f00;
    background: #fff0c7;
  }
  .sp-overview-main > .sp-insight-strip .sp-insight-icon::after { color: #ef9f00; }
  .sp-overview-main > .sp-insight-strip .sp-eyebrow { color: #102a63; }
  .sp-overview-main > .sp-insight-strip .sp-insight-main p { color: #425b7e; }
  .sp-overview-main .sp-insight-stats {
    grid-template-columns: 105px 205px;
    justify-self: end;
    width: 320px;
    max-width: 100%;
    min-width: 0;
    border: 0;
    gap: 10px;
    background: transparent;
    transform: translateX(-10px);
  }
  .sp-overview-main .sp-insight-stats div {
    border: 0;
    border-radius: 9px;
    background: #e7f2ff;
  }
  .sp-overview-main .sp-insight-stats div + div {
    border: 0;
    background: #f1e8ff;
  }
  .sp-overview-main .sp-insight-stats div:first-child strong { color: #1262bf; }
  .sp-overview-main .sp-insight-stats div:last-child strong { color: #7023b8; }
  .sp-overview-layout + .sp-cognitive-section { margin-top: 18px; }

  @media (max-width: 1199px) {
    .sp-overview-layout { grid-template-columns: minmax(0, 1fr); }
    .sp-overview-layout > .sp-metrics-grid {
      grid-column: 1;
      grid-row: 1;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      grid-template-rows: none;
      gap: 10px;
    }
    .sp-overview-main { grid-column: 1; grid-row: 2; }
    .sp-overview-main > .sp-overview-insights {
      flex: none;
      margin-top: 0 !important;
    }
    .sp-overview-main > .sp-insight-strip {
      flex: none;
      min-height: 0;
    }
    .sp-overview-insights .sp-teacher-insight-grid,
    .sp-overview-insights .sp-recommendation-panel,
    .sp-overview-insights .sp-snapshot-panel { height: auto; }
    .sp-overview-insights .sp-teacher-insight-grid {
      min-height: 0;
      transform: none;
    }
    .sp-overview-main .sp-insight-stats {
      width: min(100%, 320px);
      transform: none;
    }
    .sp-overview-layout .sp-metric-card {
      align-items: flex-start;
      min-height: 84px;
      padding: 12px;
    }
    .sp-overview-layout .sp-eyebrow { font-size: 9px; }
    .sp-overview-layout .sp-metric-value { font-size: 21px; }
    .sp-overview-layout .sp-metric-helper {
      margin-top: 5px;
      font-size: 10px;
      white-space: normal;
    }
  }

  @media (max-width: 1120px) {
    .sp-metrics-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .sp-subject-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sp-exam-cognitive-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sp-exam-cognitive-skills { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .sp-chart-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sp-chart-wide { grid-column: span 1; }
    .sp-teacher-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sp-cognitive-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sp-cognitive-evidence dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sp-subject-bloom-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sp-subject-bloom-grid { grid-template-columns: 1fr; }
  }

  @media (max-width: 860px) {
    .sp-overview-layout > .sp-metrics-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .sp-overview-insights .sp-teacher-insight-grid {
      grid-template-columns: minmax(0, 1fr);
      width: 100%;
    }
    .sp-overview-insights .sp-recommendation-panel,
    .sp-overview-insights .sp-snapshot-panel {
      min-width: 0;
      width: 100%;
    }
    .sp-overview-main .sp-insight-stats {
      justify-self: stretch;
      width: 100%;
    }
    .sp-overview-main > .sp-insight-strip { grid-template-columns: 1fr; }
    .sp-hero-content { grid-template-columns: auto minmax(0,1fr); }
    .sp-status-badge { grid-column: 2; justify-self: start; }
    .sp-insight-strip, .sp-teacher-insight-grid,
    .sp-cognitive-grid, .sp-cognitive-footer-grid,
    .sp-subject-bloom-insights { grid-template-columns: 1fr; }
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
    .sp-overview-insights .sp-panel-header {
      align-items: flex-start;
      gap: 10px;
      padding: 12px 12px 0;
    }
    .sp-overview-insights .sp-panel-title-group { gap: 10px; }
    .sp-overview-insights .sp-panel-title-icon {
      flex-basis: 38px;
      width: 38px;
      height: 38px;
    }
    .sp-overview-insights .sp-panel-header h3 { font-size: 16px; }
    .sp-overview-insights .sp-panel-header p,
    .sp-overview-insights .sp-action-list p { font-size: 12px; }
    .sp-overview-insights .sp-action-list { margin: 12px 10px 0; }
    .sp-overview-insights .sp-snapshot-list { margin: 9px 12px 0; }
    .sp-overview-insights .sp-snapshot-list > div { gap: 10px; padding: 10px; }
    .sp-overview-insights .sp-snapshot-list dt { min-width: 0; }
    .sp-overview-insights .sp-snapshot-list dd {
      flex: 0 1 55%;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .sp-chart-card { min-height: 250px; }
    .sp-chart-area { height: 195px; padding: 6px 2px 10px; }
    .sp-subject-grid { grid-template-columns: 1fr; }
    .sp-subject-card { border-radius: 15px; }
    .sp-exam-cognitive-summary { grid-template-columns: 1fr; }
    .sp-exam-cognitive-skills { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sp-question-table-wrap { margin: 12px; }
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
    .sp-overview-main .sp-insight-stats { grid-template-columns: 1fr; }
    .sp-overview-insights .sp-recommendation-panel .sp-panel-header {
      flex-direction: column;
    }
    .sp-overview-insights .sp-panel-badge { align-self: flex-start; }
    .sp-overview-insights .sp-snapshot-list > div {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
    }
    .sp-overview-insights .sp-snapshot-list dd {
      max-width: 150px;
      text-align: right;
    }
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
    .sp-cognitive-summary { grid-template-columns: 1fr; }
    .sp-cognitive-evidence dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sp-cognitive-skill-row { grid-template-columns: 78px minmax(0, 1fr); }
    .sp-cognitive-skill-score { grid-column: 2; text-align: left; }
    .sp-exam-cognitive-skills { grid-template-columns: 1fr; }
    .sp-subject-bloom-cards { grid-template-columns: 1fr; }
  }

  @media (prefers-reduced-motion: reduce) {
    .sp-button { transition: none; }
  }
`;
