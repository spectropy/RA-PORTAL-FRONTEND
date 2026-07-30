import React, { useMemo } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
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

function generatePDF(studentData, schoolData, examResults) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  const BLUE = [37, 99, 235];
  const NAVY = [15, 23, 42];
  const LIGHT_BLUE = [239, 246, 255];
  const WHITE = [255, 255, 255];
  const BORDER = [203, 213, 225];

  const validSubjectAverages = SUBJECTS.map((subject) => {
    const scores = examResults
      .map((result) =>
        getSubjectPct(
          result[`${subject.key}_marks`],
          result[`max_marks_${subject.key}`],
        ),
      )
      .filter((value) => value !== null);

    return {
      ...subject,
      average: scores.length
        ? scores.reduce((sum, value) => sum + value, 0) / scores.length
        : 0,
    };
  });

  const sortedSubjects = [...validSubjectAverages].sort(
    (a, b) => b.average - a.average,
  );
  const bestExam = [...examResults].sort(
    (a, b) => toNum(b.percentage) - toNum(a.percentage),
  )[0];
  const overallAverage = examResults.length
    ? examResults.reduce((sum, result) => sum + toNum(result.percentage), 0) /
      examResults.length
    : 0;

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...WHITE);
  doc.text(
    schoolData?.school_name || studentData?.school_name || "School",
    14,
    13,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Area: ${schoolData?.area || "N/A"}`, 14, 21);
  doc.text("Powered by SPECTROPY", pageWidth - 55, 17);

  const studentName = studentData?.name || "Student";
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Student Performance Report", 14, 41);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${studentName}  •  Roll No: ${studentData?.roll_no || studentData?.student_id || "—"}  •  Class ${studentData?.class || "—"}-${studentData?.section || "—"}`,
    14,
    49,
  );

  const cards = [
    ["Overall Average", `${round(overallAverage)}%`],
    ["Best Score", `${round(bestExam?.percentage)}%`],
    ["Best Subject", sortedSubjects[0]?.label || "—"],
    [
      "Priority Subject",
      sortedSubjects[sortedSubjects.length - 1]?.label || "—",
    ],
  ];

  cards.forEach(([label, value], index) => {
    const x = 14 + index * 69;
    doc.setFillColor(...LIGHT_BLUE);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, 57, 62, 24, 2, 2, "FD");
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(label.toUpperCase(), x + 4, 65);
    doc.setTextColor(...NAVY);
    doc.setFontSize(15);
    doc.text(String(value), x + 4, 75);
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text("Subject averages", 14, 94);

  validSubjectAverages.forEach((subject, index) => {
    const x = 14 + index * 48;
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, 100, 42, 29, 2, 2, "S");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(subject.label, x + 4, 109);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text(`${round(subject.average)}%`, x + 4, 121);
  });

  const insightX = 220;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(insightX, 94, 62, 35, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Teacher focus", insightX + 4, 103);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const focusText = `Prioritise ${sortedSubjects[sortedSubjects.length - 1]?.label || "the weakest subject"} and review progress after the next assessment.`;
  doc.text(doc.splitTextToSize(focusText, 54), insightX + 4, 111);

  const signatureY = pageHeight - 25;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text("Parent / Guardian", 20, signatureY);
  doc.text("Class Teacher", 126, signatureY);
  doc.text("School Principal", 232, signatureY);

  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...NAVY);
  doc.text("Detailed Exam Results", 14, 16);

  const tableData = examResults.map((result) => [
    formatDate(result.date),
    formatExamName(result.exam, "—"),
    result.program || "—",
    Math.round(toNum(result.correct_answers)),
    Math.round(toNum(result.wrong_answers)),
    Math.round(toNum(result.unattempted)),
    ...SUBJECTS.map((subject) => {
      const pct = getSubjectPct(
        result[`${subject.key}_marks`],
        result[`max_marks_${subject.key}`],
      );
      return pct === null
        ? "—"
        : `${toNum(result[`${subject.key}_marks`])} (${round(pct, 0)}%)`;
    }),
    round(result.total, 0),
    `${round(result.percentage)}%`,
    result.class_rank ?? "—",
  ]);

  doc.autoTable({
    head: [
      [
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
      ],
    ],
    body: tableData,
    startY: 22,
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: 1.7,
      textColor: NAVY,
      lineColor: BORDER,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: BLUE,
      textColor: WHITE,
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 8, right: 8 },
  });

  const safeName = studentName.replace(/[^a-z0-9]+/gi, "_");
  doc.save(
    `ReportCard_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}

export default function StudentPerformanceView({
  student,
  school,
  examResults = [],
  teachers = [],
  title = "Student Performance",
  onBack,
}) {
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

  return (
    <>
      <style>{DASHBOARD_CSS}</style>
      {(onBack || examResults.length > 0) && (
        <div className="sp-page-action">
          {onBack && (
            <button
              type="button"
              className="sp-button sp-button-page"
              onClick={onBack}
            >
              Back
            </button>
          )}
          {examResults.length > 0 && (
            <button
              type="button"
              className="sp-button sp-button-page sp-button-page-primary"
              onClick={() => {
                try {
                  generatePDF(student, school || {}, examResults);
                } catch (error) {
                  console.error(error);
                  window.alert(
                    "Unable to generate the report card. Please try again.",
                  );
                }
              }}
            >
              Download report
            </button>
          )}
        </div>
      )}

    <div className="sp-dashboard">

      <header className="sp-hero">
        <div className="sp-hero-content">
          <div className="sp-avatar" aria-hidden="true">
            {getInitials(studentName)}
          </div>
          <div className="sp-identity">
            <span className="sp-hero-kicker">{title}</span>
            <h1>{studentName}</h1>
            <div className="sp-identity-meta">
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
          <section className="sp-metrics-grid" aria-label="Performance summary">
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
              value={latestExam?.class_rank ? `#${latestExam.class_rank}` : "—"}
              helper="Current exam"
              tone="primary"
            />
            <MetricCard
              icon="#"
              label="School rank"
              value={latestExam?.school_rank ? `#${latestExam.school_rank}` : "â€”"}
              helper="Current exam"
              tone="primary"
            />
            <MetricCard
              icon="#"
              label="All India rank"
              value={latestExam?.all_schools_rank ? `#${latestExam.all_schools_rank}` : "â€”"}
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
                        return row ? `${row.exam} • ${row.date}` : "Assessment";
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
                      tick={{ fill: "#334155", fontSize: 12, fontWeight: 600 }}
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
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
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
                      Suggested from the student’s current performance pattern.
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
                      <strong>{Math.round(toNum(result.wrong_answers))}</strong>
                    </div>
                    <div>
                      <span>Class rank</span>
                      <strong>
                        {result.class_rank ? `#${result.class_rank}` : "—"}
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
                    {teacher.phone && <a href={`tel:${teacher.phone}`}>Call</a>}
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
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    width: 100%;
    max-width: 1180px;
    margin: 0 auto;
    padding: 14px 20px 0;
    box-sizing: border-box;
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
    max-width: 1180px;
    margin: 0 auto;
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
    margin-left: auto;
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
    display: block;
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
  .sp-table-scroll { overflow-x: auto; overscroll-behavior-inline: contain; }
  .sp-table { width: 100%; min-width: 1280px; border-collapse: collapse; font-size: 11px; white-space: nowrap; }
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
  }
  .sp-table td { padding: 10px 10px; border-bottom: 1px solid #eef2f7; color: var(--sp-slate-600); }
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
  }

  @media (prefers-reduced-motion: reduce) {
    .sp-button { transition: none; }
  }
`;
