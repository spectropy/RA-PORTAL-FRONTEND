// src/components/TeacherDashboard.jsx
import React, { useState, useEffect } from "react";

export default function TeacherDashboard({ onBack }) {
  const [teacher, setTeacher] = useState(null);
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = sessionStorage.getItem("sp_user");

    if (!user) {
      alert("No user data found. Please log in again.");
      onBack();
      return;
    }

    try {
      const parsed = JSON.parse(user);
      if (parsed.role !== "TEACHER") {
        alert("Access denied. Teachers only.");
        onBack();
        return;
      }

      // ✅ Ensure teacher_assignments is always an array (defensive)
      setTeacher({
        ...parsed,
        teacher_assignments: Array.isArray(parsed.teacher_assignments)
          ? parsed.teacher_assignments
          : [],
      });

      // ✅ Use school_name from session (set by /api/teachers/login)
      setSchoolName(parsed.school_name || "Unknown School");
    } catch (err) {
      console.error("Failed to parse user data:", err);
      alert("Session corrupted. Please log in again.");
      onBack();
    } finally {
      setLoading(false);
    }
  }, [onBack]);

  if (loading) {
    return <div style={styles.centered}>Loading teacher dashboard...</div>;
  }

  if (!teacher) {
    return <div style={styles.centered}>No teacher data available.</div>;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>👩‍🏫 Teacher Dashboard</h1>
          <p style={styles.subtitle}>
            Welcome, <strong>{teacher.name}</strong> • {teacher.teacher_id}
          </p>
          <p style={styles.school}>
            School: <strong>{schoolName}</strong>
          </p>
        </div>
        <button
          onClick={() => {
            // Clear session on logout
            sessionStorage.removeItem("sp_user");
            onBack();
          }}
          style={styles.logoutBtn}
        >
          ← Logout
        </button>
      </div>

      {/* Assignments Section — Only This Remains */}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>📚 Your ALLOTMENTS</h2>
        {teacher.teacher_assignments.length > 0 ? (
          <div style={styles.assignmentsGrid}>
            {teacher.teacher_assignments.map((assignment, idx) => (
              <div
                key={idx}
                style={styles.assignmentCard}
              >
                <div style={styles.assignmentHeader}>
                  <span style={styles.classTag}>
                    {assignment.class} • {assignment.section}
                  </span>
                </div>
                <div style={styles.subject}>
                  <strong>Subject:</strong> {assignment.subject}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.noData}>You have no assigned classes yet.</p>
        )}
      </div>
    </div>
  );
}

// ✅ Styles
const styles = {
  container: {
    maxWidth: 1200,
    margin: '24px auto',
    padding: '0 16px',
  },
  centered: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '80vh',
    fontSize: '18px',
    color: '#4a5568',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '24px 0',
    borderBottom: '2px solid #e2e8f0',
    marginBottom: '24px',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '28px',
    color: '#2d3748',
  },
  subtitle: {
    margin: '0 0 4px 0',
    fontSize: '16px',
    color: '#4a5568',
  },
  school: {
    margin: 0,
    fontSize: '14px',
    color: '#718096',
  },
  logoutBtn: {
    padding: '8px 16px',
    background: '#e53e3e',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  card: {
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '20px',
    color: '#2d3748',
    fontWeight: '600',
  },
  assignmentsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
  },
  assignmentCard: {
    background: '#f8fafc',
    border: '1px solid #cbd5e0',
    borderRadius: '8px',
    padding: '16px',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
  },
  assignmentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  classTag: {
    background: '#4299e1',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
  },
  subject: {
    fontSize: '15px',
    color: '#2d3748',
    marginTop: '4px',
  },
  noData: {
    color: '#718096',
    fontSize: '16px',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '20px',
  },
};