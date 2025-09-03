// src/ParentDashboard.jsx
import React, { useState, useEffect } from "react";

export default function ParentDashboard({ onBack }) {
  const [child, setChild] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true); // Add loading state

  useEffect(() => {
    // Simulate API delay (optional, for realism)
    setTimeout(() => {
      setChild({
        name: "Rahul Reddy",
        roll_no: 12,
        class: "GRADE-11",
        section: "A",
        school: "Spectropy High, Hyderabad",
        performance: "Good (87%)",
        attendance: "94%"
      });

      setTeachers([
        { name: "Anita Desai", subject: "Mathematics", email: "anita.desai@school.edu", phone: "+91 98765 43210" },
        { name: "Ravi Kumar", subject: "Physics", email: "ravi.kumar@school.edu", phone: "+91 87654 32109" },
        { name: "Sita Patel", subject: "English", email: "sita.patel@school.edu", phone: "+91 76543 21098" },
      ]);

      setLoading(false);
    }, 300);
  }, []);

  // ✅ Guard: Don't render if still loading or no child
  if (loading) {
    return (
      <div style={styles.container}>
        <button onClick={onBack} style={styles.backButton}>← Back</button>
        <p>Loading child data...</p>
      </div>
    );
  }

  if (!child) {
    return (
      <div style={styles.container}>
        <button onClick={onBack} style={styles.backButton}>← Back</button>
        <p style={{ color: 'red' }}>Child data not found.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <button onClick={onBack} style={styles.backButton}>← Back</button>

      <h2>👨‍👩‍👧‍👦 Parent Dashboard</h2>
      <div style={styles.profile}>
        <h3>Child: {child.name}</h3>
        <p><strong>Roll No:</strong> {child.roll_no}</p>
        <p><strong>Class:</strong> {child.class} - {child.section}</p>
        <p><strong>School:</strong> {child.school}</p>
        <p><strong>Performance:</strong> {child.performance}</p>
        <p><strong>Attendance:</strong> {child.attendance}</p>
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

// === Styles ===
const styles = {
  container: { padding: 20, fontFamily: 'Arial, sans-serif' },
  backButton: { padding: '8px 16px', margin: '0 0 16px', border: '1px solid #4682b4', background: 'white', color: '#4682b4', borderRadius: 6, cursor: 'pointer' },
  profile: { background: '#f0f8ff', padding: 16, borderRadius: 8, border: '1px solid #add8e6' },
  divider: { margin: '20px 0', borderColor: '#ddd' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 10 },
  th: { textAlign: 'left', padding: '8px', borderBottom: '2px solid #ddd', background: '#f0f8ff' },
  td: { padding: '8px', borderBottom: '1px solid #eee' },
};