// src/TeacherDashboard.jsx
import React, { useState, useEffect } from "react";

export default function TeacherDashboard({ onBack, role }) {
  const [teacher, setTeacher] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");

  const teacherId = sessionStorage.getItem('sp_teacher_id') || 'TCH001';

  useEffect(() => {
    // Simulate fetch
    setTimeout(() => {
      setTeacher({
        id: teacherId,
        name: "Anita Desai",
        subject: "Mathematics",
        class: "GRADE-11",
        section: "A",
        email: "anita.desai@school.edu",
        phone: "+91 98765 43210",
        school_name: "Spectropy High, Hyderabad"
      });

      // Mock students
      setStudents([
        { roll_no: 1, name: "Rahul Reddy", class: "GRADE-11", section: "A", gender: "Male" },
        { roll_no: 2, name: "Priya Sharma", class: "GRADE-11", section: "A", gender: "Female" },
        { roll_no: 3, name: "Arjun Mehta", class: "GRADE-11", section: "B", gender: "Male" },
        { roll_no: 4, name: "Neha Singh", class: "GRADE-12", section: "A", gender: "Female" },
      ]);
      setLoading(false);
    }, 500);
  }, [teacherId]);

  const filtered = students.filter(s => {
    return (classFilter ? s.class === classFilter : true) &&
           (sectionFilter ? s.section === sectionFilter : true);
  });

  const classes = [...new Set(students.map(s => s.class))].sort();
  const sections = [...new Set(students.map(s => s.section))].sort();

  return (
    <div style={styles.container}>
      <button onClick={onBack} style={styles.backButton}>← Back</button>

      <h2>👩‍🏫 Teacher Dashboard</h2>
      {teacher && (
        <div style={styles.profile}>
          <p><strong>Name:</strong> {teacher.name}</p>
          <p><strong>Subject:</strong> {teacher.subject}</p>
          <p><strong>Class:</strong> {teacher.class} - {teacher.section}</p>
          <p><strong>Email:</strong> {teacher.email}</p>
          <p><strong>Phone:</strong> {teacher.phone}</p>
          <p><strong>School:</strong> {teacher.school_name}</p>
        </div>
      )}

      <hr style={styles.divider} />

      <h3>📚 Students in Your Classes</h3>
      <div style={styles.filterRow}>
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={styles.select}>
          <option value="">All Classes</option>
          {classes.map(cls => <option key={cls} value={cls}>{cls}</option>)}
        </select>
        <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} style={styles.select}>
          <option value="">All Sections</option>
          {sections.map(sec => <option key={sec} value={sec}>{sec}</option>)}
        </select>
      </div>

      {loading ? (
        <p>Loading students...</p>
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
            {filtered.map(s => (
              <tr key={s.roll_no}>
                <td>{s.roll_no}</td>
                <td>{s.name}</td>
                <td>{s.class}</td>
                <td>{s.section}</td>
                <td>{s.gender}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles = {
  container: { padding: 20, fontFamily: 'Arial, sans-serif' },
  backButton: { padding: '8px 16px', margin: '0 0 16px', border: '1px solid #4682b4', background: 'white', color: '#4682b4', borderRadius: 6, cursor: 'pointer' },
  profile: { background: '#f0f8ff', padding: 16, borderRadius: 8, border: '1px solid #add8e6' },
  divider: { margin: '20px 0', borderColor: '#ddd' },
  filterRow: { display: 'flex', gap: 10, marginBottom: 16 },
  select: { padding: '6px 8px', fontSize: 14, border: '1px solid #ccc', borderRadius: 6 },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 10 },
  th: { textAlign: 'left', padding: '8px', borderBottom: '2px solid #ddd', background: '#f0f8ff' },
  td: { padding: '8px', borderBottom: '1px solid #eee' },
};