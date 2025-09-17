// src/StudentDashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function StudentDashboard({ onBack }) {
  const [student, setStudent] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [examResults, setExamResults] = useState([]); // 👈 NEW
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hasFetched = useRef(false);

  useEffect(() => {
    const user = sessionStorage.getItem("sp_user");
    const parsedUser = user ? JSON.parse(user) : null;

    const studentId = parsedUser?.student_id || null;
    const schoolId = parsedUser?.school_id || null;
    const classValue = parsedUser?.class || null;
    const sectionValue = parsedUser?.section || null;

    if (!studentId || !schoolId || !classValue || !sectionValue) {
      setError("No student or school context found. Please log in again.");
      setLoading(false);
      return;
    }

    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchStudentData = async () => {
      try {
        setStudent(parsedUser);

        // 👉 FETCH EXAM RESULTS
        const resultsRes = await fetch(`${API_BASE}/api/exams/results?student_id=${encodeURIComponent(studentId)}`);
        if (!resultsRes.ok) throw new Error("Failed to fetch exam results");
        const resultsData = await resultsRes.json();
        setExamResults(resultsData);

        // Fetch teachers (unchanged)
        const schoolRes = await fetch(`${API_BASE}/api/schools/${schoolId}`);
        if (!schoolRes.ok) throw new Error(`Failed to fetch school details: ${schoolRes.status}`);
        const schoolData = await schoolRes.json();

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
  }, []);

  // 👇 DOWNLOAD AS PDF FUNCTION
  const downloadPDF = () => {
    if (!student || examResults.length === 0) return;

    const doc = new jsPDF();
    const schoolName = student.school_name || "School Name";

    // Title
    doc.setFontSize(18);
    doc.text(`${schoolName} - Student Report Card`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Name: ${student.name} | Roll No: ${student.roll_no} | Class: ${student.class}-${student.section}`, 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 40);

    // Table
    const tableColumn = [
      "Date", "Exam", "Program", "Physics", "Chemistry", "Maths", "Biology", "Total", "%", "Class Rank", "School Rank", "All Schools"
    ];
    const tableRows = examResults.map(r => [
      r.date,
      r.exam,
      r.program,
      r.physics.toFixed(2),
      r.chemistry.toFixed(2),
      r.maths.toFixed(2),
      r.biology.toFixed(2),
      r.total.toFixed(2),
      r.percentage.toFixed(2),
      r.class_rank,
      r.school_rank,
      r.all_schools_rank
    ]);

    doc.autoTable({
      startY: 50,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [70, 130, 180] }, // SteelBlue
      margin: { top: 50 },
    });

    doc.save(`ReportCard_${student.name}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <button onClick={onBack} style={styles.backButton}>← Back</button>
        <p>Loading student data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <button onClick={onBack} style={styles.backButton}>← Back</button>
        <p style={{ color: 'red', fontWeight: 'bold' }}>{error}</p>
      </div>
    );
  }

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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3>📊 Exam Results</h3>
        {examResults.length > 0 && (
          <button onClick={downloadPDF} style={styles.downloadButton}>
            📄 Download Report Card (PDF)
          </button>
        )}
      </div>

      {examResults.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Exam</th>
                <th>Program</th>
                <th>Physics</th>
                <th>Chemistry</th>
                <th>Maths</th>
                <th>Biology</th>
                <th>Total</th>
                <th>%</th>
                <th>Class Rank</th>
                <th>School Rank</th>
                <th>All Schools</th>
              </tr>
            </thead>
            <tbody>
              {examResults.map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td>{r.exam}</td>
                  <td>{r.program}</td>
                  <td>{r.physics.toFixed(2)}</td>
                  <td>{r.chemistry.toFixed(2)}</td>
                  <td>{r.maths.toFixed(2)}</td>
                  <td>{r.biology.toFixed(2)}</td>
                  <td>{r.total.toFixed(2)}</td>
                  <td>{r.percentage.toFixed(2)}</td>
                  <td>{r.class_rank}</td>
                  <td>{r.school_rank}</td>
                  <td>{r.all_schools_rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: '#718096', fontStyle: 'italic' }}>
          No exam results available yet.
        </p>
      )}

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
  container: { padding: 20, fontFamily: 'Arial, sans-serif', maxWidth: 1200, margin: '0 auto' },
  backButton: { padding: '8px 16px', margin: '0 0 16px', border: '1px solid #4682b4', background: 'white', color: '#4682b4', borderRadius: 6, cursor: 'pointer' },
  downloadButton: {
    padding: '10px 20px',
    background: '#4682b4',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  profile: { background: '#f0f8ff', padding: 16, borderRadius: 8, border: '1px solid #add8e6', marginBottom: 20 },
  divider: { margin: '20px 0', borderColor: '#ddd' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: 10,
    fontSize: '0.9em',
    whiteSpace: 'nowrap'
  },
  th: {
    textAlign: 'left',
    padding: '12px 8px',
    borderBottom: '2px solid #ddd',
    background: '#f0f8ff',
    position: 'sticky',
    top: 0
  },
  td: {
    padding: '10px 8px',
    borderBottom: '1px solid #eee'
  },
};