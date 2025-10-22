import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSchools, createSchool } from "./api.js";
import SchoolForm from "./components/SchoolForm.jsx";
import SchoolTable from "./components/SchoolTable.jsx";
import ReportButtons from "./components/ReportButtons.jsx";
import ClassTeacherRegistration from "./components/ClassTeacherRegistration.jsx";
import StudentRegistration from "./components/StudentRegistration.jsx";
import ExamsRegistration from "./components/ExamsRegistration.jsx";
import LMSExamRegistration from "./components/LMSExamRegistration.jsx";
import QueriesPage from "./components/QueriesPage.jsx";

export default function Dashboard() {
  const navigate = useNavigate();
  const logout = () => {
    sessionStorage.removeItem("sp_user");
    navigate("/login", { replace: true });
  };

  // -------------------- Responsive Styles --------------------
  const styles = {
    box: {
      maxWidth: "min(1200px, 100%)",
      margin: "auto",
      padding: "clamp(12px, 3vw, 24px)",
      fontFamily:
        "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, Cantarell, 'Noto Sans', Helvetica Neue, Arial",
    },
    headerWrap: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "clamp(12px, 2vw, 24px)",
      gap: 12,
    },
    title: {
      margin: 0,
      fontSize: "clamp(18px, 2.2vw, 26px)",
      lineHeight: 1.3,
    },
    topButtons: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
    },
    smallButton: {
      padding: "8px 12px",
      border: "1px solid #cbd5e1",
      borderRadius: 8,
      background: "#f1f5f9",
      cursor: "pointer",
      fontSize: "clamp(13px, 1.5vw, 14px)",
    },
    logoutButton: {
      padding: "8px 12px",
      borderRadius: 8,
      border: "none",
      background: "#ef4444",
      color: "#fff",
      cursor: "pointer",
      fontSize: "clamp(13px, 1.5vw, 14px)",
    },
    tabsWrap: {
      display: "flex",
      flexWrap: "nowrap",
      gap: 10,
      marginBottom: 20,
      overflowX: "auto",
      padding: "8px 4px",
      borderBottom: "1px solid #e0e0e0",
      WebkitOverflowScrolling: "touch",
      scrollbarWidth: "none",
    },
    tabButton: (active) => ({
      flex: "0 0 auto",
      padding: "10px 16px",
      background: active ? "#1e90ff" : "#f8f9fa",
      color: active ? "white" : "#475569",
      border: "1px solid #cbd5e1",
      borderRadius: "8px 8px 0 0",
      cursor: "pointer",
      fontWeight: active ? 600 : 400,
      whiteSpace: "nowrap",
      fontSize: "clamp(13px, 1.5vw, 15px)",
      transition: "all 0.2s ease",
    }),
    card: {
      border: "1px solid #d3d8e6",
      borderRadius: 12,
      padding: "clamp(12px, 2vw, 20px)",
      marginBottom: "clamp(12px, 2vw, 20px)",
      background: "#fff",
      boxShadow: "0 3px 10px rgba(0,0,0,0.04)",
    },
  };

  // -------------------- State --------------------
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("school-registration");

  // -------------------- Data Fetch --------------------
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const rows = await getSchools();
      setSchools(rows);
    } catch (e) {
      setError(e.message || "Failed to load schools");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onAddSchool(payload) {
    setError("");
    try {
      await createSchool(payload);
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to create school");
    }
  }

  const tabs = [
    { id: "school-registration", label: "🏫 School Registration" },
    { id: "class-teacher-registration", label: "👩‍🏫 Class/Teacher Registration" },
    { id: "student-registration", label: "🎓 Student Registration" },
    { id: "exams-registration", label: "📝 OMR Exams" },
    { id: "lms-exam-registration", label: "📚 LMS Exam Converter" },
    { id: "queries", label: "🔍 Queries" },
  ];

  // -------------------- Render --------------------
  return (
    <div style={styles.box}>
      {/* Header */}
      <div style={styles.headerWrap}>
        <h1 style={styles.title}>🎓 SPECTROPY — School Management System</h1>
        <div style={styles.topButtons}>
          <button
            onClick={() => navigate("/login")}
            style={styles.smallButton}
          >
            Back to Login
          </button>
          <button onClick={logout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabsWrap}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={styles.tabButton(activeTab === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "school-registration" && (
  <>
    <div style={styles.card}>
      {/* ✅ Pass existing schools to enable duplicate check */}
      <SchoolForm onSubmit={onAddSchool} existingSchools={schools} />
    </div>
    <div style={styles.card}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          gap: 8,
        }}
      >
        <h2 style={{ margin: 0, fontSize: "clamp(16px, 2vw, 20px)" }}>
          School List
        </h2>
        <ReportButtons rows={schools} />
      </div>
      {loading ? <p>Loading...</p> : <SchoolTable rows={schools} />}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
    </div>
  </>
)}

      {activeTab === "class-teacher-registration" && (
        <div style={styles.card}>
          <ClassTeacherRegistration schools={schools} />
        </div>
      )}

      {activeTab === "student-registration" && (
        <div style={styles.card}>
          <StudentRegistration schools={schools} />
        </div>
      )}

      {activeTab === "exams-registration" && (
        <div style={styles.card}>
          <ExamsRegistration schools={schools} />
        </div>
      )}

      {activeTab === "lms-exam-registration" && (
        <div style={styles.card}>
          <LMSExamRegistration />
        </div>
      )}

      {activeTab === "queries" && (
        <div style={styles.card}>
          <QueriesPage />
        </div>
      )}
    </div>
  );
}
