// src/StudentDashboard.jsx
import React, { useState, useEffect } from "react";

export default function StudentDashboard({ onBack }) {
  const [student, setStudent] = useState(null); // Start as null
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true); // Add loading state

  const studentId = sessionStorage.getItem('sp_student_id') || 'STD001';

  useEffect(() => {
    // Simulate API delay (optional)
    setTimeout(() => {
      setStudent({
        name: "Rahul Reddy",
        roll_no: 12,
        class: "GRADE-11",
        section: "A",
        dob: "12 Mar 2006",
        email: "rahul.reddy@student.school.edu",
        phone: "+91 99887 76655",
        address: "Hyderabad, Telangana"
      });

      setTeachers([
        { name: "Anita Desai", subject: "Mathematics", email: "anita.desai@school.edu", phone: "+91 98765 43210" },
        { name: "Ravi Kumar", subject: "Physics", email: "ravi.kumar@school.edu", phone: "+91 87654 32109" },
        { name: "Sita Patel", subject: "English", email: "sita.patel@school.edu", phone: "+91 76543 21098" },
      ]);

      setLoading(false);
    }, 300);
  }, [studentId]);

  // ✅ Guard: Don't render if still loading or no student
  if (loading) {
    return (
      <div style={styles.container}>
        <button onClick={onBack} style={styles.backButton}>← Back</button>
        <p>Loading student data...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div style={styles.container}>
        <button onClick={onBack} style={styles.backButton}>← Back</button>
        <p style={{ color: 'red' }}>Student not found.</p>
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
        <p><strong>DOB:</strong> {student.dob}</p>
        <p><strong>Email:</strong> {student.email}</p>
        <p><strong>Phone:</strong> {student.phone}</p>
        <p><strong>Address:</strong> {student.address}</p>
      </div>

      <hr style={styles.divider} />

      <h3>👨‍🏫 Teachers</h3>
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
    </div>
  );
}

// === Styles (Unchanged) ===
const styles = {
  container: { padding: 20, fontFamily: 'Arial, sans-serif' },
  backButton: { padding: '8px 16px', margin: '0 0 16px', border: '1px solid #4682b4', background: 'white', color: '#4682b4', borderRadius: 6, cursor: 'pointer' },
  profile: { background: '#f0f8ff', padding: 16, borderRadius: 8, border: '1px solid #add8e6' },
  divider: { margin: '20px 0', borderColor: '#ddd' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 10 },
  th: { textAlign: 'left', padding: '8px', borderBottom: '2px solid #ddd', background: '#f0f8ff' },
  td: { padding: '8px', borderBottom: '1px solid #eee' },
};