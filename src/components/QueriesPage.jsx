// src/components/QueriesPage.jsx
import React, { useState, useEffect } from "react";
import { getPrograms } from "../api.js"; // Keep this if you still need initial program list
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

export default function QueriesPage() {
  const [programs, setPrograms] = useState([]);
  const [examPatterns, setExamPatterns] = useState([]);
  const [schools, setSchools] = useState([]);
  
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedExamPattern, setSelectedExamPattern] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load programs on mount (assuming /api/programs returns list of program IDs)
  useEffect(() => {
    getPrograms()
      .then(data => setPrograms(data.map(p => p.id)))
      .catch(err => setError("Failed to load programs"));
  }, []);

  // 🔁 Unified data fetch: exam patterns, schools, and stats in one call
  useEffect(() => {
  if (!selectedProgram) {
    setExamPatterns([]);
    setSchools([]);
    setStats(null);
    return;
  }

  setLoading(true);
  setError("");

  const params = new URLSearchParams({ program: selectedProgram });
  if (selectedExamPattern) params.append("exam_pattern", selectedExamPattern);
  if (selectedSchool) params.append("school", selectedSchool);

  // ✅ Use async IIFE inside useEffect
  (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/queries/dashboard?${params}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json(); // This will fail if response is HTML
      console.log("📥 API Response received:", data);
      setExamPatterns(data.examPatterns || []);
      setSchools(data.schools || []);
      setStats(data.stats);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || "Failed to load dashboard data");
      setExamPatterns([]);
      setSchools([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  })();
}, [selectedProgram, selectedExamPattern, selectedSchool]);

  // ✅ Reset school when exam pattern changes
  useEffect(() => {
    setSelectedSchool("");
  }, [selectedExamPattern]);

  return (
    <div>
      <h2 style={{ marginBottom: "16px", fontSize: "20px" }}>🔍 Query Dashboard</h2>

      {/* Program Selector */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "24px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
            Program:
          </label>
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              minWidth: "180px",
            }}
          >
            <option value="">— Select Program —</option>
            {programs.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Exam Pattern Selector */}
        {examPatterns.length > 0 && (
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
              Exam Pattern:
            </label>
            <select
              value={selectedExamPattern}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedExamPattern(value);
                // Optional: clear school when switching to "All Patterns"
                if (value === "") setSelectedSchool("");
              }}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                minWidth: "180px",
              }}
            >
              <option value="">— All Patterns —</option>
              {examPatterns.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* School Selector */}
      {schools.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
            School:
          </label>
          <select
            value={selectedSchool}
            onChange={(e) => setSelectedSchool(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              minWidth: "180px",
            }}
          >
            <option value="">— All Schools —</option>
            {schools.map((school) => (
              <option key={school} value={school}>
                {school}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error & Loading */}
      {error && <p style={{ color: "crimson", marginBottom: "12px" }}>{error}</p>}
      {loading && <p>Loading statistics...</p>}

      {/* Stats Table */}
      {stats && !loading && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr>
                <th style={headerStyle}>Exam Pattern</th>
                <th style={headerStyle}>Schools</th>
                <th style={headerStyle}>Classes</th>
                <th style={headerStyle}>Students</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(stats) ? (
                stats.map((row, i) => (
                  <tr key={i}>
                    <td style={cellStyle}>{row.examPattern}</td>
                    <td style={cellStyle}>{row.schoolCount}</td>
                    <td style={cellStyle}>{row.classCount}</td>
                    <td style={cellStyle}>{row.studentCount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={cellStyle}>{stats.examPattern || "— Total —"}</td>
                  <td style={cellStyle}>{stats.schoolCount}</td>
                  <td style={cellStyle}>{stats.classCount}</td>
                  <td style={cellStyle}>{stats.studentCount}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const headerStyle = {
  backgroundColor: "#f8fafc",
  padding: "10px 12px",
  textAlign: "left",
  borderBottom: "2px solid #cbd5e1",
  fontWeight: "600",
};

const cellStyle = {
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
};