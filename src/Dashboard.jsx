import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { getSchools, createSchool } from "./api.js"
import SchoolForm from "./components/SchoolForm.jsx"
import SchoolTable from "./components/SchoolTable.jsx"
import ReportButtons from "./components/ReportButtons.jsx"
import ClassTeacherRegistration from "./components/ClassTeacherRegistration.jsx"
import StudentRegistration from "./components/StudentRegistration.jsx"
import ExamsRegistration from "./components/ExamsRegistration.jsx"
import LMSExamRegistration from "./components/LMSExamRegistration.jsx"
import QueriesPage from "./components/QueriesPage.jsx";

export default function Dashboard() {
  const navigate = useNavigate()
  const logout = () => {
    sessionStorage.removeItem("sp_user")
    navigate("/login", { replace: true })
  }

  const box = {
    maxWidth: 1100,
    margin: "24px auto",
    padding: 16,
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial",
  }
  const h1 = { margin: 0, fontSize: 24 }
  const card = {
    border: "1px solid #d3d8e6",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    background: "#fff",
  }

  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState('school-registration')

  async function refresh() {
    setLoading(true)
    setError("")
    try {
      const rows = await getSchools()
      setSchools(rows)
    } catch (e) {
      setError(e.message || "Failed to load schools")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function onAddSchool(payload) {
    setError("")
    try {
      await createSchool(payload)
      await refresh()
    } catch (e) {
      setError(e.message || "Failed to create school")
    }
  }

  const tabs = [
    { id: 'school-registration', label: '🏫 School Registration' },
    { id: 'class-teacher-registration', label: '👩‍🏫 Class/Teacher Registration' },
    { id: 'student-registration', label: '🎓 Student Registration' },
    { id: 'exams-registration', label: '📝 OMR Exams ' },
    { id: 'lms-exam-registration', label: '📚 LMS Exam Converter' },
    { id: 'queries', label: '🔍 Queries' },
  ];

  return (
    <div style={box}>
      {/* Top bar with logout */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h1 style={h1}>🎓 SPECTROPY — School Management System</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => navigate("/login")}
            style={{
              padding: "6px 10px",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              background: "#f1f5f9",
              cursor: "pointer",
            }}
          >
            Back to Login
          </button>
          <button
            onClick={logout}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "none",
              background: "#ef4444",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px', 
        overflowX: 'auto',
        padding: '10px 0',
        borderBottom: '1px solid #e0e0e0'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              background: activeTab === tab.id ? '#1e90ff' : '#f8f9fa',
              color: activeTab === tab.id ? 'white' : '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Render content based on active tab */}
      {activeTab === 'school-registration' && (
        <div>
          {/* School Form */}
          <div style={card}>
            <SchoolForm onSubmit={onAddSchool} />
          </div>
          
          {/* School List - Now moved inside School Registration tab */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>School List</h2>
              <ReportButtons rows={schools} />
            </div>
            {loading ? <p>Loading...</p> : <SchoolTable rows={schools} />}
            {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
          </div>
        </div>
      )}

      {activeTab === 'class-teacher-registration' && (
        <div style={card}>
          <ClassTeacherRegistration schools={schools} />
        </div>
      )}

      {activeTab === 'student-registration' && (
        <div style={card}>
          <StudentRegistration schools={schools} />
        </div>
      )}

      {activeTab === 'exams-registration' && (
        <div style={card}>
          <ExamsRegistration schools={schools} />
        </div>
      )}

      {activeTab === 'lms-exam-registration' && (
        <div style={card}>
          <LMSExamRegistration />
        </div>
      )}

      {activeTab === 'queries' && (
        <div style={card}>
          <QueriesPage />
        </div>
      )}
    </div>
  )
}