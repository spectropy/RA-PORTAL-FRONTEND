// src/StudentDashboard.jsx
import React, { useState, useEffect, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function StudentDashboard({ onBack }) {
  const [student, setStudent] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hasFetched = useRef(false); // Prevent multiple fetches

  useEffect(() => {
    // 👇 READ sp_user INSIDE effect — ensures it's fresh after React hydration
    const user = sessionStorage.getItem("sp_user");
    const parsedUser = user ? JSON.parse(user) : null;

    const studentId = parsedUser?.student_id || null;
    const schoolId = parsedUser?.school_id || null;
    const classValue = parsedUser?.class || null;
    const sectionValue = parsedUser?.section || null;

    // Skip if any required data missing
    if (!studentId || !schoolId || !classValue || !sectionValue) {
      setError("No student or school context found. Please log in again.");
      setLoading(false);
      return;
    }

    // ✅ Only run once per login
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchStudentData = async () => {
      try {
        // ✅ Use the parsed data directly — we trust the login flow
        setStudent(parsedUser);

        // ✅ Fetch teachers assigned to this student’s class/section
        const res = await fetch(`${API_BASE}/api/schools/${schoolId}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch school details: ${res.status} ${res.statusText}`);
        }

        const schoolData = await res.json();
        const assignedTeachers = [];

        if (Array.isArray(schoolData.teachers)) {
          for (const teacher of schoolData.teachers) {
            if (Array.isArray(teacher.teacher_assignments)) {
              const assignments = teacher.teacher_assignments.filter(
                a => a.class === classValue && a.section === sectionValue
              );
              if (assignments.length > 0) {
                assignedTeachers.push({
                  name: teacher.name,
                  subject: assignments[0].subject,
                  email: teacher.email,
                  phone: teacher.contact,
                });
              }
            }
          }
        }

        setTeachers(assignedTeachers);
      } catch (err) {
        console.error("Error fetching student data:", err);
        setError("Failed to load student data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, []); // 👈 EMPTY DEPENDENCY ARRAY — runs ONCE after mount

  // Show loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <button onClick={onBack} style={styles.backButton}>← Back</button>
        <p>Loading student data...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div style={styles.container}>
        <button onClick={onBack} style={styles.backButton}>← Back</button>
        <p style={{ color: 'red', fontWeight: 'bold' }}>{error}</p>
      </div>
    );
  }

  // Show no student state
  if (!student) {
    return (
      <div style={styles.container}>
        <button onClick={onBack} style={styles.backButton}>← Back</button>
        <p style={{ color: 'red' }}>Student data unavailable.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <button onClick={onBack} style={styles.backButton}>← Back</button>

      <h2>🎓 Student Dashboard</h2>
      <div style={styles.profile}>
        <h3>{student.name}</h3>
        <p><strong>Roll No:</strong> {student.roll_no}</p>
        <p><strong>Class:</strong> {student.class} - {student.section}</p>
        <p><strong>DOB:</strong> {student.dob || "Not provided"}</p>
        <p><strong>Email:</strong> {student.parent_email || "Not provided"}</p>
        <p><strong>Phone:</strong> {student.parent_phone || "Not provided"}</p>
        <p><strong>Address:</strong> {student.address || "Not provided"}</p>
      </div>

      <hr style={styles.divider} />

      <h3>👨‍🏫 Teachers</h3>
      {teachers.length > 0 ? (
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Teacher</th>
              <th>Subject</th>
              <th>Email</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t, i) => (
              <tr key={i}>
                <td>{t.name}</td>
                <td>{t.subject}</td>
                <td><a href={`mailto:${t.email}`}>{t.email}</a></td>
                <td>{t.phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: '#718096', fontStyle: 'italic' }}>
          No teachers assigned to your class yet.
        </p>
      )}
    </div>
  );
}

// === Styles ===
const styles = {
  container: { padding: 20, fontFamily: 'Arial, sans-serif', maxWidth: 800, margin: '0 auto' },
  backButton: { padding: '8px 16px', margin: '0 0 16px', border: '1px solid #4682b4', background: 'white', color: '#4682b4', borderRadius: 6, cursor: 'pointer' },
  profile: { background: '#f0f8ff', padding: 16, borderRadius: 8, border: '1px solid #add8e6', marginBottom: 20 },
  divider: { margin: '20px 0', borderColor: '#ddd' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 10 },
  th: { textAlign: 'left', padding: '8px', borderBottom: '2px solid #ddd', background: '#f0f8ff' },
  td: { padding: '8px', borderBottom: '1px solid #eee' },
};