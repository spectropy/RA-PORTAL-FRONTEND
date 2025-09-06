// src/Dashboard.jsx
import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { getSchools, createSchool } from "./api.js" // Removed uploadExcel since it's no longer used
import SchoolForm from "./components/SchoolForm.jsx"
import SchoolTable from "./components/SchoolTable.jsx"
import ReportButtons from "./components/ReportButtons.jsx"

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

  // Removed onUpload function since UploadExcel is removed

  return (
    <div style={box}>
      {/* Top bar with logout */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h1 style={h1}>🎓 SPECTROPY — School Registration & Report</h1>
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

      {/* School Form */}
      <div style={card}>
        <SchoolForm onSubmit={onAddSchool} />
      </div>

      {/* School List */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>School List</h2>
          <ReportButtons rows={schools} />
        </div>
        {loading ? <p>Loading...</p> : <SchoolTable rows={schools} />}
        {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      </div>
    </div>
  )
}