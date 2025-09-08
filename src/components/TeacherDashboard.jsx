// src/components/TeacherDashboard.jsx
import React, { useState, useEffect } from "react";

export default function TeacherDashboard({ onBack }) {
  const [teacher, setTeacher] = useState(null);
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

  useEffect(() => {
    const fetchTeacherData = async () => {
      try {
        // Get teacher data from session
        const user = sessionStorage.getItem("sp_user");
        if (!user) {
          alert("Not authorized. Please log in.");
          onBack();
          return;
        }

        const userData = JSON.parse(user);
        if (userData.role !== "TEACHER") {
          alert("Access denied.");
          onBack();
          return;
        }

        setTeacher(userData);

        // Fetch all students of the school
        const schoolId = userData.school_id;
        const res = await fetch(`${API_BASE}/api/students?school_id=${schoolId}`);
        
        if (!res.ok) throw new Error("Failed to fetch students");

        const studentList = await res.json();
        setAllStudents(studentList);

        // Filter students based on teacher's assignments
        const assignedClasses = new Set();
        const assignedSections = new Set();

        if (Array.isArray(userData.teacher_assignments)) {
          userData.teacher_assignments.forEach((a) => {
            assignedClasses.add(a.class);
            assignedSections.add(a.section);
          });
        }

        const filteredStudents = studentList.filter((s) =>
          assignedClasses.has(s.class) && assignedSections.has(s.section)
        );

        setStudents(filteredStudents);
      } catch (err) {
        console.error("Error loading teacher dashboard:", err);
        alert("Failed to load data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchTeacherData();
  }, [onBack]);

  // Get unique classes and sections from teacher's assignments
  const classes = Array.from(
    new Set(teacher?.teacher_assignments?.map((a) => a.class) || [])
  ).sort();

  const sections = Array.from(
    new Set(teacher?.teacher_assignments?.map((a) => a.section) || [])
  ).sort();

  // Filter students by class and section
  const filtered = students.filter((s) => {
    return (classFilter ? s.class === classFilter : true) &&
           (sectionFilter ? s.section === sectionFilter : true);
  });

  if (loading) return <p style={styles.container}>Loading teacher profile and students...</p>;
  if (!teacher) return <p style={styles.container}>No teacher data available.</p>;

  return (
    <div style={styles.container}>
      <button onClick={onBack} style={styles.backButton}>
        ← Back
      </button>

      <h2>👩‍🏫 Teacher Dashboard</h2>

      {/* Teacher Profile */}
      <div style={styles.profile}>
        <p><strong>Name:</strong> {teacher.name}</p>
        <p><strong>Email:</strong> {teacher.email || 'Not provided'}</p>
        <p><strong>Contact:</strong> {teacher.contact || 'Not provided'}</p>
        <p><strong>School ID:</strong> {teacher.school_id}</p>
      </div>

      {/* Assignments */}
      <div style={styles.assignments}>
        <h3>📘 Your Assignments</h3>
        {Array.isArray(teacher.teacher_assignments) && teacher.teacher_assignments.length > 0 ? (
          <div style={styles.badgeContainer}>
            {teacher.teacher_assignments.map((a, idx) => (
              <span key={idx} style={styles.badge}>
                {a.class} • {a.section} • {a.subject}
              </span>
            ))}
          </div>
        ) : (
          <p>No class assignments yet.</p>
        )}
      </div>

      <hr style={styles.divider} />

      {/* Student List */}
      <h3>📚 Students in Your Classes</h3>

      <div style={styles.filterRow}>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          style={styles.select}
        >
          <option value="">All Classes</option>
          {classes.map((cls) => (
            <option key={cls} value={cls}>{cls}</option>
          ))}
        </select>

        <select
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          style={styles.select}
        >
          <option value="">All Sections</option>
          {sections.map((sec) => (
            <option key={sec} value={sec}>{sec}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Loading students...</p>
      ) : filtered.length === 0 ? (
        <p>No students found in the selected classes.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Roll No</th>
              <th>Name</th>
              <th>Class</th>
              <th>Section</th>
              <th>Gender</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.roll_no || s.id}>
                <td>{s.roll_no || "—"}</td>
                <td>{s.name}</td>
                <td>{s.class}</td>
                <td>{s.section}</td>
                <td>{s.gender || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Styles
const styles = {
  container: {
    padding: 20,
    fontFamily: 'Arial, sans-serif',
    maxWidth: 1100,
    margin: '0 auto',
  },
  backButton: {
    padding: '8px 16px',
    margin: '0 0 16px',
    border: '1px solid #4682b4',
    background: 'white',
    color: '#4682b4',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: '500',
  },
  profile: {
    background: '#f0f8ff',
    padding: 16,
    borderRadius: 8,
    border: '1px solid #add8e6',
    marginBottom: 16,
  },
  assignments: {
    background: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    border: '1px solid #ddd',
    marginBottom: 16,
  },
  badgeContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  badge: {
    padding: '4px 8px',
    background: '#1e90ff',
    color: 'white',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 'bold',
  },
  divider: {
    margin: '20px 0',
    borderColor: '#ddd',
  },
  filterRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  select: {
    padding: '6px 8px',
    fontSize: 14,
    border: '1px solid #ccc',
    borderRadius: 6,
    minWidth: 140,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: 10,
  },
  th: {
    textAlign: 'left',
    padding: '10px',
    borderBottom: '2px solid #ddd',
    background: '#f0f8ff',
    fontWeight: '600',
  },
  td: {
    padding: '8px',
    borderBottom: '1px solid #eee',
    color: '#333',
  },
};