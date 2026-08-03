import React, { useEffect, useCallback } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { getSchools, createSchool } from "./api.js";
import { useState } from "react";
import SchoolForm from "./components/SchoolForm.jsx";
import SchoolTable from "./components/SchoolTable.jsx";
import ReportButtons from "./components/ReportButtons.jsx";
import ClassTeacherRegistration from "./components/ClassTeacherRegistration.jsx";
import StudentRegistration from "./components/StudentRegistration.jsx";
import ExamsRegistration from "./components/ExamsRegistration.jsx";
import LMSExamRegistration from "./components/LMSExamRegistration.jsx";
import QueriesPage from "./components/QueriesPage.jsx";
import TopStudentsSchool from "./components/TopStudentsSchool.jsx";

// ─── Tab Definitions ────────────────────────────────────────────
// path is relative to /admin/
const TABS = [
  { id: "schools", path: "schools", icon: "🏫", label: "Schools" },
  { id: "classes", path: "classes", icon: "👩‍🏫", label: "Class & Teacher" },
  { id: "students", path: "students", icon: "🎓", label: "Students" },
  { id: "exams", path: "exams", icon: "📝", label: "OMR Exams" },
  { id: "lms", path: "lms", icon: "📚", label: "LMS Converter" },
  { id: "queries", path: "queries", icon: "🔍", label: "Queries" },
  {
    id: "top-students",
    path: "top-students",
    icon: "🏆",
    label: "Top Students",
  },
];

// ─── Skeleton rows while loading ─────────────────────────────────
function SkeletonRows() {
  return (
    <div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton" style={{ width: 72, height: 14 }} />
          <div className="skeleton" style={{ width: 210, height: 14 }} />
          <div className="skeleton" style={{ width: 90, height: 14 }} />
          <div className="skeleton" style={{ width: 60, height: 14 }} />
          <div className="skeleton" style={{ width: 50, height: 14 }} />
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export default function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Derive active tab from current URL segment
  // location.pathname inside /admin/* looks like "/admin/schools"
  const segment = location.pathname.split("/")[2] || "schools"; // "schools" | "classes" | …
  const activeTab = TABS.find((t) => t.path === segment)?.id || "schools";
  const isAddSchool = location.pathname === "/admin/add-school";

  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Data ─────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSchools(await getSchools());
    } catch (e) {
      setError(e.message || "Failed to load schools");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Mobile sidebar toggle event ──────────────────────────────
  useEffect(() => {
    const onToggle = () => setSidebarOpen((p) => !p);
    window.addEventListener("toggleAdminSidebar", onToggle);
    return () => window.removeEventListener("toggleAdminSidebar", onToggle);
  }, []);

  // ── Navigation helpers ───────────────────────────────────────
  const goTab = (tab) => {
    navigate(`/admin/${tab.path}`);
    setSidebarOpen(false);
  };

  async function handleAddSchool(payload) {
    await createSchool(payload);
    await refresh();
    navigate("/admin/schools");
  }

  const totalClasses = schools.reduce(
    (s, sc) => s + (sc.classes_count || 0),
    0,
  );
  const totalTeachers = schools.reduce(
    (s, sc) => s + (sc.teachers_count || 0),
    0,
  );
  const adminName = user?.username || user?.name || "Admin";

  // ── Render ───────────────────────────────────────────────────
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

      {/* ── Sidebar Rail ──────────────────────────────────────── */}
      <aside
        className={`sidebar-rail${sidebarOpen ? " sidebar-rail--open" : ""}`}
        aria-label="Admin navigation"
      >
        <button
          className="sidebar-close-btn"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        >
          ✕
        </button>

        <span className="sidebar-section-label">Navigation</span>

        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-nav-item${activeTab === tab.id && !isAddSchool ? " sidebar-nav-item--active" : ""}`}
            onClick={() => goTab(tab)}
            title={tab.label}
            aria-current={
              activeTab === tab.id && !isAddSchool ? "page" : undefined
            }
          >
            <span className="sidebar-nav-icon">{tab.icon}</span>
            <span className="sidebar-nav-label">{tab.label}</span>
          </button>
        ))}

        {/* Sidebar footer */}
        <div className="sidebar-footer">
          <div className="sidebar-admin-info">
            <div className="sidebar-admin-avatar">
              {adminName.charAt(0).toUpperCase()}
              <span className="sidebar-avatar-status" title="Portal Online" />
            </div>
            <div className="sidebar-admin-details">
              <div className="sidebar-admin-name">{adminName}</div>
              <div className="sidebar-admin-role">Super Admin</div>
            </div>
          </div>

          {onLogout && (
            <button className="sidebar-logout-btn" onClick={onLogout}>
              <span>⏻</span>
              <span className="sidebar-nav-label">Sign Out</span>
            </button>
          )}

          <div className="sidebar-version">
            v1.0 · {schools.length} school{schools.length !== 1 ? "s" : ""}
          </div>
        </div>
      </aside>

      {/* ── Page Canvas ───────────────────────────────────────── */}
      <div className="page-canvas">
        <Routes>
          {/* Default → redirect to /admin/schools */}
          <Route index element={<Navigate to="schools" replace />} />

          {/* ── Schools list ── */}
          <Route
            path="schools"
            element={
              <div className="animate-fade-in">
                <div className="page-header">
                  <div className="page-header-left">
                    <h1 className="page-header-title">
                      🏫 School Registration
                    </h1>
                    <p className="page-header-subtitle">
                      {schools.length} school{schools.length !== 1 ? "s" : ""}{" "}
                      registered
                      {totalClasses > 0 &&
                        ` · ${totalClasses} classes · ${totalTeachers} teachers`}
                    </p>
                  </div>
                  <div className="page-header-actions">
                    <button
                      className="btn-link-primary"
                      onClick={() => navigate("/admin/add-school")}
                      aria-label="Add a new school"
                    >
                      + Add School ↗
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="responsive-status-wrap" style={{ padding: "16px 32px 0" }}>
                    <div className="alert-banner alert-banner--error">
                      <span className="alert-banner-icon">⚠️</span>
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                {loading ? (
                  <div className="responsive-status-wrap" style={{ padding: "0 32px" }}>
                    <SkeletonRows />
                  </div>
                ) : (
                  <SchoolTable
                    rows={schools}
                    onSchoolDeleted={refresh}
                    exportButtons={<ReportButtons rows={schools} />}
                  />
                )}
              </div>
            }
          />

          {/* ── Add School ── */}
          <Route
            path="add-school"
            element={
              <div className="animate-fade-in">
                <div
                  className="page-header"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 16,
                  }}
                >
                  <div className="page-header-left">
                    <h1 className="page-header-title">Add New School</h1>
                    <p className="page-header-subtitle">
                      Fill in the details below to register a new school in the
                      portal.
                    </p>
                  </div>
                  <button
                    className="page-back-nav"
                    style={{ marginTop: 4 }}
                    onClick={() => navigate("/admin/schools")}
                  >
                    ← Back to Schools
                  </button>
                </div>
                <div className="page-content">
                  <div className="form-page-wrap">
                    <SchoolForm
                      onSubmit={handleAddSchool}
                      existingSchools={schools}
                      onCancel={() => navigate("/admin/schools")}
                    />
                  </div>
                </div>
              </div>
            }
          />

          {/* ── Class & Teacher ── */}
          <Route
            path="classes/*"
            element={
              <div className="animate-fade-in">
                <div className="page-header">
                  <div className="page-header-left">
                    <h1 className="page-header-title">
                      👩‍🏫 Class &amp; Teacher Registration
                    </h1>
                    <p className="page-header-subtitle">
                      Add classes, sections, and assign teachers per subject.
                    </p>
                  </div>
                </div>
                <div className="page-content">
                  <ClassTeacherRegistration schools={schools} />
                </div>
              </div>
            }
          />

          {/* ── Students ── */}
          <Route
            path="students"
            element={
              <div className="animate-fade-in">
                <div className="page-header">
                  <div className="page-header-left">
                    <h1 className="page-header-title">
                      🎓 Student Registration
                    </h1>
                    <p className="page-header-subtitle">
                      Register and manage student records across schools.
                    </p>
                  </div>
                </div>
                <div className="page-content">
                  <StudentRegistration schools={schools} />
                </div>
              </div>
            }
          />

          {/* ── OMR Exams ── */}
          <Route
            path="exams"
            element={
              <div className="animate-fade-in">
                <div className="page-header">
                  <div className="page-header-left">
                    <h1 className="page-header-title">
                      📝 OMR Exam Registration
                    </h1>
                    <p className="page-header-subtitle">
                      Create exam records and upload OMR score sheets.
                    </p>
                  </div>
                </div>
                <div className="page-content">
                  <ExamsRegistration schools={schools} />
                </div>
              </div>
            }
          />

          {/* ── LMS Converter ── */}
          <Route
            path="lms"
            element={
              <div className="animate-fade-in">
                <div className="page-header">
                  <div className="page-header-left">
                    <h1 className="page-header-title">📚 LMS Exam Converter</h1>
                    <p className="page-header-subtitle">
                      Convert and import LMS exam result files.
                    </p>
                  </div>
                </div>
                <div className="page-content">
                  <LMSExamRegistration />
                </div>
              </div>
            }
          />

          {/* ── Queries ── */}
          <Route
            path="queries"
            element={
              <div className="animate-fade-in">
                <div className="page-header">
                  <div className="page-header-left">
                    <h1 className="page-header-title">🔍 Queries</h1>
                    <p className="page-header-subtitle">
                      View and respond to support queries.
                    </p>
                  </div>
                </div>
                <div className="page-content">
                  <QueriesPage />
                </div>
              </div>
            }
          />

          {/* ── Top Students ── */}
          <Route
            path="top-students"
            element={
              <div className="animate-fade-in">
                <div className="page-header">
                  <div className="page-header-left">
                    <h1 className="page-header-title">🏆 Top Students</h1>
                    <p className="page-header-subtitle">
                      View top 5 students by class &amp; section across all
                      schools.
                    </p>
                  </div>
                </div>
                <div className="page-content">
                  <TopStudentsSchool />
                </div>
              </div>
            }
          />

          {/* Catch-all: unknown sub-paths → schools */}
          <Route path="*" element={<Navigate to="schools" replace />} />
        </Routes>
      </div>
    </div>
  );
}
