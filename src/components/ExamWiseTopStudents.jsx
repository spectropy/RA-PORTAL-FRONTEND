import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getSchools } from "../api.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const numberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const buildGroups = (rows) => {
  const groups = new Map();

  rows.forEach((row) => {
    const percentage = numberOrNull(row.percentage ?? row.totalgrade_per_avg);
    if (!row.class || !row.section || !row.exam_pattern || !row.student_id || percentage === null) return;

    const examDate = row.exam_date || "";
    const key = [row.class, row.section, row.exam_pattern, examDate].join("|");
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        className: row.class,
        section: row.section,
        examPattern: row.exam_pattern,
        examDate,
        students: new Map(),
      });
    }

    const group = groups.get(key);
    const studentKey = String(row.student_id);
    if (!group.students.has(studentKey)) {
      group.students.set(studentKey, {
        student_id: row.student_id,
        name: [row.first_name, row.last_name].filter(Boolean).join(" ") || row.name || "Anonymous",
        percentage,
      });
    }
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      students: [...group.students.values()]
        .sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name))
        .slice(0, 5)
        .map((student, index) => ({ ...student, rank: index + 1 })),
    }))
    .filter((group) => group.students.length)
    .sort((a, b) =>
      String(a.className).localeCompare(String(b.className), undefined, { numeric: true }) ||
      String(a.section).localeCompare(String(b.section)) ||
      String(a.examPattern).localeCompare(String(b.examPattern)),
    );
};

export default function ExamWiseTopStudents({ mode = "admin", schools = [], school }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [availableSchools, setAvailableSchools] = useState(schools);
  const [selectedSchoolId, setSelectedSchoolId] = useState(
    mode === "school" ? school?.school_id || "" : searchParams.get("school_id") || "",
  );
  const [selectedExam, setSelectedExam] = useState(() => {
    const pattern = searchParams.get("exam_pattern") || "";
    const date = searchParams.get("exam_date") || "";
    return pattern ? `${pattern}|${date}` : "";
  });
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(mode !== "school" && !schools.length);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode === "school") return;
    if (schools.length) {
      setAvailableSchools(schools);
      setLoadingSchools(false);
      return;
    }
    getSchools()
      .then(setAvailableSchools)
      .catch((e) => setError(e.message || "Failed to load schools"))
      .finally(() => setLoadingSchools(false));
  }, [mode, schools]);

  useEffect(() => {
    if (mode === "school" && school?.school_id) {
      setSelectedSchoolId(school.school_id);
    }
  }, [mode, school]);

  useEffect(() => {
    if (!selectedSchoolId) {
      setGroups([]);
      setSelectedExam("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/api/exams?school_id=${encodeURIComponent(selectedSchoolId)}`)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load exam results");
        return response.json();
      })
      .then((rows) => {
        if (!cancelled) setGroups(buildGroups(Array.isArray(rows) ? rows : []));
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || "Failed to load exam results");
          setGroups([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedSchoolId]);

  const examOptions = useMemo(() => {
    const unique = new Map();
    groups.forEach((group) => {
      const key = `${group.examPattern}|${group.examDate}`;
      if (!unique.has(key)) unique.set(key, { key, label: group.examDate ? `${group.examPattern} - ${group.examDate}` : group.examPattern });
    });
    return [...unique.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [groups]);
  const visibleGroups = useMemo(
    () => selectedSchoolId && selectedExam
      ? groups.filter((group) => `${group.examPattern}|${group.examDate}` === selectedExam)
      : [],
    [groups, selectedExam, selectedSchoolId],
  );
  const schoolRows = mode === "school" ? (school ? [school] : []) : availableSchools.length ? availableSchools : schools;
  const openPosterGenerator = (group) => {
    const params = new URLSearchParams({
      school_id: selectedSchoolId,
      class: group.className,
      section: group.section,
      exam_pattern: group.examPattern,
    });
    if (group.examDate) params.set("exam_date", group.examDate);
    navigate(`${mode === "school" ? "/school" : "/admin"}/top-students-exam-wise/poster?${params.toString()}`);
  };

  const downloadCSV = () => {
    const selectedExamLabel = examOptions.find((exam) => exam.key === selectedExam)?.label || selectedExam;
    const csvRows = [[
      "School ID",
      "Class",
      "Section",
      "Rank",
      "Student ID",
      "Name",
      "exam %",
      "exam",
    ]];

    visibleGroups.forEach((group) => {
      const examLabel = group.examDate ? `${group.examPattern} - ${group.examDate}` : group.examPattern || selectedExamLabel;
      group.students.forEach((student) => {
        csvRows.push([
          selectedSchoolId,
          group.className,
          group.section,
          student.rank,
          student.student_id,
          student.name,
          `${student.percentage.toFixed(2)}%`,
          examLabel,
        ]);
      });
    });

    const csvContent = csvRows
      .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Top_Students_Exam_${selectedSchoolId}_${selectedExam.replace(/[^a-z0-9_-]+/gi, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const groupedByClassSection = useMemo(() => {
    const result = new Map();
    visibleGroups.forEach((group) => {
      const key = `${group.className}|${group.section}`;
      if (!result.has(key)) result.set(key, []);
      result.get(key).push(group);
    });
    return [...result.entries()];
  }, [visibleGroups]);

  return (
    <div style={{ margin: "0 auto" }}>
      <div style={{ marginBottom: 20, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, maxWidth: 900 }}>
        <label style={{ display: "block", fontWeight: 500, minWidth: 0 }}>
          Select School:
        {loadingSchools ? <p>Loading schools...</p> : (
          <select value={selectedSchoolId} onChange={(e) => { setSelectedSchoolId(e.target.value); setSelectedExam(""); }} disabled={mode === "school"} style={{ display: "block", marginTop: 8, padding: 10, fontSize: 16, borderRadius: 8, border: "1px solid #cbd5e1", width: "100%", boxSizing: "border-box" }}>
            <option value="">— Choose a School —</option>
            {schoolRows.map((row) => <option key={row.school_id} value={row.school_id}>{row.school_name || row.name} ({row.school_id})</option>)}
          </select>
        )}
        </label>
        <label style={{ display: "block", fontWeight: 500, minWidth: 0 }}>
          Select Exam:
          <select value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)} disabled={!selectedSchoolId || !groups.length} style={{ display: "block", marginTop: 8, padding: 10, fontSize: 16, borderRadius: 8, border: "1px solid #cbd5e1", width: "100%", boxSizing: "border-box" }}>
            <option value="">— Choose an Exam —</option>
            {examOptions.map((exam) => <option key={exam.key} value={exam.key}>{exam.label}</option>)}
          </select>
        </label>
      </div>
      {error && <p style={{ color: "crimson", marginBottom: 16 }}>{error}</p>}
      {loading && <p>Loading exam results...</p>}
      {!loading && !selectedSchoolId && !loadingSchools && <p>Please select a school and exam to view results.</p>}
      {!loading && selectedSchoolId && !selectedExam && <p>Please select an exam to view results.</p>}
      {!loading && selectedSchoolId && selectedExam && !groups.length && <p>No exam performance data found for this school.</p>}
      {!loading && selectedSchoolId && selectedExam && groups.length > 0 && !visibleGroups.length && <p>No results match the selected exam.</p>}
      {selectedSchoolId && selectedExam && visibleGroups.length > 0 && (
        <button type="button" className="btn-link-primary" onClick={downloadCSV} style={{ marginBottom: 20, background: "#10b981", borderColor: "#10b981" }}>
          Download CSV
        </button>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {groupedByClassSection.map(([key, classGroups]) => {
          const [className, section] = key.split("|");
          return (
            <div className="responsive-table-scroll" key={key} style={{ border: "1px solid #e2e8f0", overflowY: "auto", borderRadius: 8, padding: 16 }}>
              <h3 style={{ margin: "0 0 16px", color: "#1e293b" }}>Class {className} - Section {section}</h3>
              {classGroups.map((group) => (
                <div key={group.key} style={{ marginBottom: 22 }}>
                  <h4 style={{ margin: "0 0 10px", color: "#334155" }}>{group.examPattern}{group.examDate ? ` - ${group.examDate}` : ""}</h4>
                  <button type="button" className="poster-secondary-btn" onClick={() => openPosterGenerator(group)} style={{ marginBottom: 12 }}>Generate Poster</button>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
                    <thead><tr style={{ background: "#f1f5f9" }}><th style={{ padding: 10, border: "1px solid #cbd5e1" }}>Rank</th><th style={{ padding: 10, border: "1px solid #cbd5e1" }}>Student ID</th><th style={{ padding: 10, border: "1px solid #cbd5e1" }}>Name</th><th style={{ padding: 10, border: "1px solid #cbd5e1" }}>Exam %</th></tr></thead>
                    <tbody>{group.students.map((student) => <tr key={student.student_id} style={{ background: "#f8fafc" }}><td style={{ padding: 10, border: "1px solid #cbd5e1", fontWeight: 600 }}>{student.rank}</td><td style={{ padding: 10, border: "1px solid #cbd5e1" }}>{student.student_id}</td><td style={{ padding: 10, border: "1px solid #cbd5e1" }}>{student.name}</td><td style={{ padding: 10, border: "1px solid #cbd5e1" }}>{student.percentage.toFixed(2)}%</td></tr>)}</tbody>
                  </table>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
