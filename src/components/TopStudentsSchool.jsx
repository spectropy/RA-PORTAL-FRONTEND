// src/components/TopStudentsSchool.jsx
import React, { useState, useEffect } from "react";
import { getSchools } from "../api.js"; // Adjust path if needed

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const TopStudentsSchool = () => {
  // State
  const [schools, setSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [topStudentsByClass, setTopStudentsByClass] = useState({});
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState("");

  // Fetch schools on mount
  useEffect(() => {
    const loadSchools = async () => {
      try {
        const data = await getSchools();
        setSchools(data);
      } catch (err) {
        setError("Failed to load schools: " + (err.message || "Unknown error"));
      } finally {
        setLoadingSchools(false);
      }
    };
    loadSchools();
  }, []);

  // Fetch top students when school is selected
  useEffect(() => {
    if (!selectedSchoolId) {
      setTopStudentsByClass({});
      return;
    }

    const loadTopStudents = async () => {
      setLoadingStudents(true);
      setError("");
      try {
        const url = `${API_BASE}/api/exams?school_id=${selectedSchoolId}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

        const exams = await res.json();
        if (!Array.isArray(exams)) throw new Error("Invalid exam data");

        // 1. Group exams by class|section and aggregate student percentages
        const classGroups = {};

        exams.forEach((exam) => {
          // Use exam.percentage or fallback to totalgrade_per_avg
          const score = parseFloat(exam.percentage ?? exam.totalgrade_per_avg);
          if (!exam.class || !exam.section || !exam.student_id || isNaN(score))
            return;

          const key = `${exam.class}|${exam.section}`;

          if (!classGroups[key]) classGroups[key] = {};
          console.log("ClassGroups so far:", classGroups);
          console.log("grounp key:", key, "student_id:", exam.student_id);

          if (!classGroups[key][exam.student_id]) {
            const name =
              [exam.first_name, exam.last_name].filter(Boolean).join(" ") ||
              "Anonymous";
            classGroups[key][exam.student_id] = {
              student_id: exam.student_id,
              name,
              class: exam.class,
              section: exam.section,
              scores: [],
            };
          }
          classGroups[key][exam.student_id].scores.push(score);
        });

        // 2. Compute average score per student and take Top 5 per class-section
        const result = {};

        for (const [key, studentObj] of Object.entries(classGroups)) {
          const studentList = Object.values(studentObj).map((s) => {
            const avgPct =
              s.scores.reduce((a, b) => a + b, 0) / s.scores.length;
            return {
              student_id: s.student_id,
              name: s.name,
              class: s.class,
              section: s.section,
              cumulative_percentage: parseFloat(avgPct.toFixed(2)),
            };
          });

          const top5 = studentList
            .sort((a, b) => b.cumulative_percentage - a.cumulative_percentage)
            .slice(0, 5)
            .map((s, i) => ({ ...s, rank: i + 1 }));

          result[key] = top5;
        }

        setTopStudentsByClass(result);
      } catch (err) {
        console.error("Error loading top students:", err);
        setError(
          "Failed to load student data: " + (err.message || "Unknown error"),
        );
        setTopStudentsByClass({});
      } finally {
        setLoadingStudents(false);
      }
    };

    loadTopStudents();
  }, [selectedSchoolId]);

  // CSV Download
  const downloadCSV = () => {
    const csvRows = [];
    // Add header
    csvRows.push([
      "School ID",
      "Class",
      "Section",
      "Rank",
      "Student ID",
      "Name",
      "Cumulative %",
    ]);

    for (const [key, students] of Object.entries(topStudentsByClass)) {
      const [cls, sec] = key.split("|");
      students.forEach((s) => {
        csvRows.push([
          selectedSchoolId,
          cls,
          sec,
          s.rank,
          s.student_id,
          `"${s.name.replace(/"/g, '""')}"`, // escape quotes
          s.cumulative_percentage.toFixed(2),
        ]);
      });
    }

    const csvContent = csvRows.map((e) => e.join(",")).join("\n");
    const blob = new Blob(["\uFEFF", csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Top_5_Students_${selectedSchoolId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Render
  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "20px", color: "#1e293b" }}>
        Top 5 Students by Class & Section
      </h2>

      {/* School Dropdown */}
      <div style={{ marginBottom: "20px" }}>
        <label
          style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}
        >
          Select School:
        </label>
        {loadingSchools ? (
          <p>Loading schools...</p>
        ) : (
          <select
            value={selectedSchoolId}
            onChange={(e) => setSelectedSchoolId(e.target.value)}
            style={{
              padding: "10px",
              fontSize: "16px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              minWidth: "250px",
              width: "100%",
              maxWidth: "500px",
            }}
          >
            <option value="">— Choose a School —</option>
            {schools.map((school) => (
              <option key={school.school_id} value={school.school_id}>
                {school.school_name} ({school.school_id})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Export Button */}
      {selectedSchoolId && Object.keys(topStudentsByClass).length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <button
            onClick={downloadCSV}
            style={{
              padding: "10px 20px",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "500",
              fontSize: "15px",
            }}
          >
            Download CSV
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <p style={{ color: "crimson", marginBottom: "16px" }}>{error}</p>
      )}

      {/* Loading */}
      {loadingStudents && <p>Loading student performance data...</p>}

      {/* Results */}
      {!selectedSchoolId && !loadingSchools && (
        <p>Please select a school to view top students.</p>
      )}

      {selectedSchoolId &&
        !loadingStudents &&
        Object.keys(topStudentsByClass).length === 0 && (
          <p>No performance data found for this school.</p>
        )}

      {Object.keys(topStudentsByClass).length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          {Object.entries(topStudentsByClass)
            .sort(([a], [b]) => {
              const [ca, sa] = a.split("|");
              const [cb, sb] = b.split("|");
              if (ca !== cb)
                return ca.localeCompare(cb, undefined, { numeric: true });
              return sa.localeCompare(sb);
            })
            .map(([key, students]) => {
              const [cls, sec] = key.split("|");
              return (
                <div
                  key={key}
                  style={{
                    border: "1px solid #e2e8f0",
                    overflowY: "auto",
                    borderRadius: "8px",
                    padding: "16px",
                  }}
                >
                  <h3 style={{ margin: "0 0 16px 0", color: "#1e293b" }}>
                    Class {cls} - Section {sec}
                  </h3>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      textAlign: "center",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        <th
                          style={{
                            padding: "10px",
                            border: "1px solid #cbd5e1",
                          }}
                        >
                          Rank
                        </th>
                        <th
                          style={{
                            padding: "10px",
                            border: "1px solid #cbd5e1",
                          }}
                        >
                          Student ID
                        </th>
                        <th
                          style={{
                            padding: "10px",
                            border: "1px solid #cbd5e1",
                          }}
                        >
                          Name
                        </th>
                        <th
                          style={{
                            padding: "10px",
                            border: "1px solid #cbd5e1",
                          }}
                        >
                          Cumulative %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s) => (
                        <tr
                          key={s.student_id}
                          style={{ background: "#f8fafc" }}
                        >
                          <td
                            style={{
                              padding: "10px",
                              border: "1px solid #cbd5e1",
                              fontWeight: "600",
                            }}
                          >
                            {s.rank}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            {s.student_id}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            {s.name}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            {s.cumulative_percentage.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default TopStudentsSchool;
