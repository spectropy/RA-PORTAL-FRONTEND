// src/components/ParentDashboard.jsx
// ─────────────────────────────────────────────────────────────────
// Data-fetching shell for the PARENT view.
// Parent session contains the child's student_id / school_id.
// Fetches child's exam results + school data, then delegates all
// rendering to the shared <StudentPerformanceView> component.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from "react";
import StudentPerformanceView from "./StudentPerformanceView";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

// Helper: sort exam results by type + number
const EXAM_TYPE_PRIORITY = (name = "") => {
  if (name.startsWith("WEEK_TEST"))  return 0;
  if (name.startsWith("UNIT_TEST"))  return 1;
  if (name.startsWith("GRAND_TEST")) return 2;
  return 3;
};
const EXAM_NUM = (name = "") => {
  const m = name.match(/.*_(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
};
const sortExams = (list) =>
  [...list].sort((a, b) => {
    const pa = EXAM_TYPE_PRIORITY(a.exam), pb = EXAM_TYPE_PRIORITY(b.exam);
    if (pa !== pb) return pa - pb;
    const na = EXAM_NUM(a.exam),           nb = EXAM_NUM(b.exam);
    if (na !== nb) return na - nb;
    return a.exam.localeCompare(b.exam);
  });

export default function ParentDashboard({ onBack }) {
  const [student,     setStudent]     = useState(null);
  const [school,      setSchool]      = useState(null);
  const [examResults, setExamResults] = useState([]);
  const [teachers,    setTeachers]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchData = async () => {
      try {
        // ── 1. Read parent session (contains child context) ──
        const raw = localStorage.getItem("sp_user") || sessionStorage.getItem("sp_user");
        const parsedUser = raw ? JSON.parse(raw) : null;

        if (
          !parsedUser?.student_id ||
          !parsedUser?.school_id  ||
          !parsedUser?.class      ||
          !parsedUser?.section
        ) {
          throw new Error("No child or school context found. Please log in again.");
        }

        const { student_id, school_id, class: cls, section } = parsedUser;
        setStudent(parsedUser);

        // ── 2. Child's exam results ──────────────────────────
        const resRes = await fetch(
          `${API_BASE}/api/exams/results?student_id=${encodeURIComponent(student_id)}`
        );
        if (!resRes.ok) throw new Error("Failed to fetch exam results.");
        const rawResults = await resRes.json();
        setExamResults(sortExams(rawResults || []));

        // ── 3. School data + teachers ────────────────────────
        const schRes = await fetch(`${API_BASE}/api/schools/${school_id}`);
        if (!schRes.ok) throw new Error("Failed to fetch school details.");
        const schData = await schRes.json();
        setSchool(schData.school);

        // Filter teachers assigned to child's class/section
        const assigned = [];
        for (const teacher of schData.teachers || []) {
          for (const a of teacher.teacher_assignments || []) {
            if (a.class === cls && a.section === section) {
              assigned.push({
                name:    teacher.name,
                subject: a.subject,
                email:   teacher.email,
                phone:   teacher.contact,
              });
              break;
            }
          }
        }
        setTeachers(assigned);
      } catch (err) {
        console.error("ParentDashboard fetch error:", err);
        setError(err.message || "Failed to load child data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ── Loading / error states ───────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        Loading your child's dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: "crimson", fontWeight: "bold" }}>⚠️ {error}</p>
        {onBack && <button onClick={onBack}>← Back</button>}
      </div>
    );
  }

  // ── Delegate rendering to shared view ───────────────────────
  return (
    <StudentPerformanceView
      student={student}
      school={school}
      examResults={examResults}
      teachers={teachers}
      title="👨‍👧 Your Child's Profile"
      onBack={onBack}
    />
  );
}
