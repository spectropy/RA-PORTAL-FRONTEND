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
import jsPDF from "jspdf";
import "jspdf-autotable";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

// ─── Tab Definitions ────────────────────────────────────────────
const TEACHER_TABS = [
  { id: "overview", path: "overview", icon: "👩‍🏫", label: "Overview" },
  { id: "performance", path: "performance", icon: "📊", label: "Performance" },
  { id: "report", path: "report", icon: "📄", label: "PDF Report" },
];

// ─── Analytics Helper ────────────────────────────────────────────
function computeExamAnalytics(exams, teacherAssignments) {
  const assignments = Array.isArray(teacherAssignments)
    ? teacherAssignments
    : [];

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
    const subjectAverages = {
      physics: exam.phy_exam_per_average ?? exam.physics_percentage,
      chemistry: exam.chem_exam_per_average ?? exam.chemistry_percentage,
      maths: exam.math_exam_per_average ?? exam.maths_percentage,
      biology: exam.bioexam_per_average ?? exam.biology_percentage,
    };

    Object.entries(subjectAverages).forEach(([subject, value]) => {
      if (value == null || value === "") return;
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) g[subject].push(numericValue);
    });
  });

  const avg = (arr) =>
    arr.length
      ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)
      : null;

  const examPatterns = Object.entries(patternMap).map(([pattern, csData]) => {
    const averagesByClassSection = {};
    for (const [cs, s] of Object.entries(csData)) {
      averagesByClassSection[cs] = {
        Physics: avg(s.physics),
        Chemistry: avg(s.chemistry),
        Biology: avg(s.biology),
        Maths: avg(s.maths),
      };
    }
    return { exam_pattern: pattern, averagesByClassSection };
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [examPatterns, setExamPatterns] = useState([]);
  const [bestWeekTestsByGrade, setBestWeekTestsByGrade] = useState([]);
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
        const schoolId = user.school_id;

        let teacherData = null;
        let sName = "Unknown School";

        if (isProxyView) {
          // ── School Owner viewing a teacher by ID ──
          const schoolRes = await fetch(`${API_BASE}/api/schools/${schoolId}`);
          if (!schoolRes.ok) throw new Error("Failed to load school data.");
          const schoolData = await schoolRes.json();
          sName = schoolData.school?.school_name || "Unknown School";

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
          if (user.role !== "TEACHER")
            throw new Error("Access denied. Teachers only.");
          teacherData = {
            ...user,
            teacher_assignments: Array.isArray(user.teacher_assignments)
              ? user.teacher_assignments
              : [],
          };
          sName = user.school_name || "Unknown School";
        }

        setTeacher(teacherData);
        setSchoolName(sName);

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
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 14;
    let y = 20;

    // Blue header banner
    doc.setFillColor(30, 85, 160);
    doc.rect(0, 0, pageWidth, 20, "F");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(schoolName || "Unknown School", 14, 12);
    doc.setFontSize(10);
    doc.text("Powered BY SPECTROPY", pageWidth - 20, 15, { align: "right" });
    y += 10;

    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("IIT Foundation Teacher Report", pageWidth / 2, y, {
      align: "center",
    });
    y += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Teacher: ${teacher.name}`, margin, y);
    y += 6;
    doc.text(`ID: ${teacher.teacher_id}`, margin, y);
    y += 6;
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin + 150, y - 10);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Allotments
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Your ALLOTMENTS", margin, y);
    doc.setFont("helvetica", "italic");
    y += 8;
    if (teacher.teacher_assignments.length > 0) {
      teacher.teacher_assignments.forEach((a) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(`${a.class}-${a.section} | ${a.subject}`, margin, y);
        y += 6;
      });
    } else {
      doc.text("No assigned classes.", margin, y);
      y += 6;
    }
    y += 8;

    // Best week test table
    if (bestWeekTestsByGrade.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Performance Analysis: Best Week Test by Grade", margin, y);
      doc.setFont("helvetica", "normal");
      y += 10;
      doc.autoTable({
        startY: y,
        head: [["Grade", "Best Exam Pattern", "Best Average (%)"]],
        body: bestWeekTestsByGrade.map((item) => [
          `Grade ${item.grade}`,
          item.bestExamPattern,
          `${item.bestAverage}%`,
        ]),
        theme: "grid",
        styles: { fontSize: 10, cellPadding: 3, halign: "center" },
        headStyles: { fillColor: [66, 153, 225] },
        margin: { left: margin, right: margin },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    // Exam averages table
    if (examPatterns.length > 0) {
      const teacherCS = [
        ...new Set(
          teacher.teacher_assignments.map((a) => `${a.class}-${a.section}`),
        ),
      ];
      const subjects = ["Physics", "Chemistry", "Biology", "Maths"];
      const dynCols = [];
      const colHeaders = ["Exam Pattern"];
      for (const subj of subjects) {
        for (const cs of teacherCS) {
          if (
            teacher.teacher_assignments.some(
              (a) => a.subject === subj && `${a.class}-${a.section}` === cs,
            )
          ) {
            dynCols.push({ subject: subj, classSection: cs });
            colHeaders.push(`${subj} (${cs})`);
          }
        }
      }
      doc.setFont("helvetica", "bold");
      doc.text("Exam Performance Averages", margin, y);
      y += 10;
      doc.autoTable({
        startY: y,
        head: [colHeaders],
        body: examPatterns.map((p) => {
          const row = [p.exam_pattern];
          dynCols.forEach((col) => {
            const a = p.averagesByClassSection[col.classSection]?.[col.subject];
            row.push(a != null ? `${a}%` : "N/A");
          });
          return row;
        }),
        theme: "striped",
        styles: { fontSize: 10, cellPadding: 2.5, halign: "center" },
        headStyles: { fillColor: [66, 153, 225] },
        margin: { left: margin, right: margin },
      });
    }

    doc.save(
      `Teacher_Report_${teacher.teacher_id}_${new Date().toISOString().slice(0, 10)}.pdf`,
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
            <h2 className="td-proxy-title">👩‍🏫 {teacher.name}</h2>
            <p className="td-proxy-meta">
              {teacher.teacher_id} · {schoolName}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={downloadPDF}>
              📄 Download PDF
            </button>
            {onBack && (
              <button className="btn btn-outline" onClick={onBack}>
                ← Back to Overview
              </button>
            )}
          </div>
        </div>
        <OverviewContent teacher={teacher} />
        <PerformanceContent
          teacher={teacher}
          examPatterns={examPatterns}
          bestWeekTestsByGrade={bestWeekTestsByGrade}
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

  return (
    <div className="admin-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar Rail ────────────────────────────────────── */}
      <aside
        className={`sidebar-rail${sidebarOpen ? " sidebar-rail--open" : ""}`}
        aria-label="Teacher navigation"
      >
        <button
          className="sidebar-close-btn"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        >
          ✕
        </button>

        <span className="sidebar-section-label">Navigation</span>

        {TEACHER_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-nav-item${activeTab === tab.id ? " sidebar-nav-item--active" : ""}`}
            onClick={() => goTab(tab)}
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
              {(teacher.name || "T").charAt(0).toUpperCase()}
              <span className="sidebar-avatar-status" title="Online" />
            </div>
            <div className="sidebar-admin-details">
              <div className="sidebar-admin-name">{teacher.name}</div>
              <div className="sidebar-admin-role">{teacher.teacher_id}</div>
            </div>
          </div>

          {onBack && (
            <button className="sidebar-logout-btn" onClick={onBack}>
              <span>⏻</span>
              <span className="sidebar-nav-label">Sign Out</span>
            </button>
          )}

          <div className="sidebar-version">{schoolName}</div>
        </div>
      </aside>

      {/* ── Page Canvas ─────────────────────────────────────── */}
      <div className="page-canvas">
        <Routes>
          <Route index element={<Navigate to="overview" replace />} />

          <Route
            path="overview"
            element={
              <div className="animate-fade-in">
                <div className="page-header">
                  <div className="page-header-left">
                    <h1 className="page-header-title">👩‍🏫 Overview</h1>
                    <p className="page-header-subtitle">
                      {teacher.name} · {teacher.teacher_id} · {schoolName}
                    </p>
                  </div>
                </div>
                <div className="page-content">
                  <OverviewContent teacher={teacher} />
                </div>
              </div>
            }
          />

          <Route
            path="performance"
            element={
              <div className="animate-fade-in">
                <div className="page-header">
                  <div className="page-header-left">
                    <h1 className="page-header-title">📊 Performance</h1>
                    <p className="page-header-subtitle">
                      Grade analysis & exam pattern averages
                    </p>
                  </div>
                </div>
                <div className="page-content">
                  <PerformanceContent
                    teacher={teacher}
                    examPatterns={examPatterns}
                    bestWeekTestsByGrade={bestWeekTestsByGrade}
                  />
                </div>
              </div>
            }
          />

          <Route
            path="report"
            element={
              <div className="animate-fade-in">
                <div className="page-header">
                  <div className="page-header-left">
                    <h1 className="page-header-title">📄 PDF Report</h1>
                    <p className="page-header-subtitle">
                      Download your full performance report
                    </p>
                  </div>
                </div>
                <div className="page-content">
                  <ReportContent
                    teacher={teacher}
                    schoolName={schoolName}
                    bestWeekTestsByGrade={bestWeekTestsByGrade}
                    examPatterns={examPatterns}
                    onDownload={downloadPDF}
                  />
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

// ─────────────────────────────────────────────────────────────────
// Sub-page: Overview — Profile card + Allotments
// ─────────────────────────────────────────────────────────────────
function OverviewContent({ teacher }) {
  return (
    <>
      {/* Profile Card */}
      <div className="td-card">
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
                  ✉ {teacher.email}
                </span>
              )}
              {teacher.contact && (
                <span className="td-badge td-badge--gray">
                  📞 {teacher.contact}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Allotments */}
      <div className="td-card">
        <h2 className="td-section-title">📚 Your Allotments</h2>
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
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-page: Performance — Best week tests + Exam averages table
// ─────────────────────────────────────────────────────────────────
function PerformanceContent({ teacher, examPatterns, bestWeekTestsByGrade }) {
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

  return (
    <>
      {/* Best Week Test by Grade */}
      {bestWeekTestsByGrade.length > 0 && (
        <div className="td-card">
          <h2 className="td-section-title">🏆 Best Week Test by Grade</h2>

          {/* Best overall highlight */}
          {(() => {
            const best = bestWeekTestsByGrade.reduce((a, b) =>
              parseFloat(a.bestAverage) > parseFloat(b.bestAverage) ? a : b,
            );
            return (
              <div className="td-best-banner">
                🏆 Best Overall: <strong>Grade {best.grade}</strong> —{" "}
                {best.bestExamPattern} — <strong>{best.bestAverage}%</strong>
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
        </div>
      )}

      {/* Exam Performance Averages Table */}
      {examPatterns.length > 0 && (
        <div className="td-card">
          <h2 className="td-section-title">📋 Exam Performance Averages</h2>
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
                      const n = val ? parseFloat(val) : null;
                      return (
                        <td key={j} className="td-td">
                          {val != null ? (
                            <span
                              className={
                                n >= 75
                                  ? "td-score td-score--high"
                                  : n >= 50
                                    ? "td-score td-score--mid"
                                    : "td-score td-score--low"
                              }
                            >
                              {val}%
                            </span>
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
        </div>
      )}

      {examPatterns.length === 0 && teacher.teacher_assignments.length > 0 && (
        <div className="td-card">
          <p className="td-no-data">
            No exam results found for your assigned classes.
          </p>
        </div>
      )}

      {teacher.teacher_assignments.length === 0 && (
        <div className="td-card">
          <p className="td-no-data">
            No class allotments found. Contact your administrator.
          </p>
        </div>
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
    <div className="td-card td-report-card">
      <div className="td-report-icon">📄</div>
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
        <span>👩‍🏫 {teacher.name}</span>
        <span>🆔 {teacher.teacher_id}</span>
        <span>🏫 {schoolName}</span>
        <span>📅 {new Date().toLocaleDateString("en-IN")}</span>
      </div>

      <button className="btn btn-primary td-report-btn" onClick={onDownload}>
        ⬇ Download PDF Report
      </button>
    </div>
  );
}
