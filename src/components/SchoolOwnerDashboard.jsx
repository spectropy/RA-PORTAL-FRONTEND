// src/components/SchoolOwnerDashboard.jsx
import React, { useState, useEffect } from "react";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function SchoolOwnerDashboard({ onBack }) {
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [classAverages, setClassAverages] = useState([]);
  const [subjectSummaries, setSubjectSummaries] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const schoolId = sessionStorage.getItem("sp_school_id");

  // 📥 Fetch School + Analytics
  useEffect(() => {
    if (!schoolId) {
      setError("No school ID found. Please log in again.");
      setLoading(false);
      return;
    }

    const fetchSchoolAndAnalytics = async () => {
      try {
        // Fetch school
        const schoolRes = await fetch(`${API_BASE}/api/schools/${schoolId}`);
        if (!schoolRes.ok) throw new Error("School not found");
        const schoolData = await schoolRes.json();

        const schoolWithRelations = {
          ...schoolData.school,
          classes: schoolData.classes || [],
          teachers: schoolData.teachers || []
        };

        setSchool(schoolWithRelations);

        // Fetch analytics
        setAnalyticsLoading(true);

        const avgRes = await fetch(`${API_BASE}/api/analytics/class-average?school_id=${schoolId}`);
        const subjRes = await fetch(`${API_BASE}/api/analytics/subject-summary?school_id=${schoolId}`);

        if (!avgRes.ok || !subjRes.ok) throw new Error("Failed to load analytics");

        const avgData = await avgRes.json();
        const subjData = await subjRes.json();

        setClassAverages(Array.isArray(avgData) ? avgData : []);
        setSubjectSummaries(Array.isArray(subjData) ? subjData : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setAnalyticsLoading(false);
      }
    };

    fetchSchoolAndAnalytics();
  }, [schoolId]);

  // 📄 PDF Download Handler
  const downloadPDF = (type, data, title) => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text(title, 14, 22);

    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    if (type === 'class-averages' && data.length > 0) {
      doc.autoTable({
        startY: 40,
        head: [['Class', 'Group', 'Exam Pattern', 'Physics', 'Chemistry', 'Maths', 'Biology', 'Total %']],
        body: data.map(row => [
          row.class || '-',
          row.group || '-',
          row.exam_pattern || '-',
          (row.physics_average ?? 0).toFixed(2),
          (row.chemistry_average ?? 0).toFixed(2),
          (row.maths_average ?? 0).toFixed(2),
          (row.biology_average ?? 0).toFixed(2),
          (row.total_percentage ?? 0).toFixed(2)
        ])
      });
    } else if (type === 'subject-summaries' && data.length > 0) {
      doc.autoTable({
        startY: 40,
        head: [['Class', 'Subject', 'Exam Pattern', 'Avg %', 'Teachers']],
        body: data.map(row => [
          row.class || '-',
          row.subject || '-',
          row.exam_pattern || '-',
          (row.total_percentage ?? 0).toFixed(2),
          Array.isArray(row.teachers_assigned_names) ? row.teachers_assigned_names.join(', ') : '-'
        ])
      });
    }

    doc.save(`${type}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) return <p>Loading school data...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  if (!school) return <p>No school data available.</p>;

  return (
    <div style={{ maxWidth: 1100, margin: '24px auto', padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>🏫 {school.school_name || 'Unknown School'}</h1>
        <button
          onClick={onBack}
          style={{
            padding: '8px 16px',
            background: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer'
          }}
        >
          ← Back to Login
        </button>
      </div>

      {/* School Details Card */}
      <div style={card}>
        <h2>📌 School Details</h2>
        <table style={infoTable}>
          <tbody>
            <tr><td><strong>School Name:</strong></td><td>{school.school_name || '-'}</td></tr>
            <tr><td><strong>School ID:</strong></td><td>{school.school_id || '-'}</td></tr>
            <tr><td><strong>Area:</strong></td><td>{school.area || '-'}</td></tr>
            <tr><td><strong>District:</strong></td><td>{school.district || '-'}</td></tr>
            <tr><td><strong>State:</strong></td><td>{school.state || '-'}</td></tr>
            <tr><td><strong>Academic Year:</strong></td><td>{school.academic_year || '-'}</td></tr>
          </tbody>
        </table>
      </div>

      {/* Classes */}
      <div style={card}>
        <h2>📚 Classes ({Array.isArray(school.classes) ? school.classes.length : 0})</h2>
        {Array.isArray(school.classes) && school.classes.length > 0 ? (
          <table style={dataTable}>
            <thead>
              <tr>
                <th>Class</th>
                <th>Section</th>
                <th>Foundation</th>
                <th>Program</th>
                <th>Group</th>
                <th>Students</th>
              </tr>
            </thead>
            <tbody>
              {school.classes.map((c, i) => (
                <tr key={i}>
                  <td>{c.class || '-'}</td>
                  <td>{c.section || '-'}</td>
                  <td>{c.foundation || '-'}</td>
                  <td>{c.program || '-'}</td>
                  <td>{c.group || '-'}</td>
                  <td>{c.num_students || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No classes added yet.</p>
        )}
      </div>

      {/* Teachers */}
      <div style={card}>
        <h2>🧑‍🏫 Teachers ({Array.isArray(school.teachers) ? school.teachers.length : 0})</h2>
        {Array.isArray(school.teachers) && school.teachers.length > 0 ? (
          <table style={dataTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Assignments</th>
              </tr>
            </thead>
            <tbody>
              {school.teachers.map((t, i) => (
                <tr key={i}>
                  <td>{t.name || '-'}</td>
                  <td>{t.contact || '-'}</td>
                  <td>{t.email || '-'}</td>
                  <td>
                    {Array.isArray(t.teacher_assignments) && t.teacher_assignments.length > 0 ? (
                      t.teacher_assignments.map((a, idx) => (
                        <span key={idx} style={badge}>
                          {a.class}•{a.section}•{a.subject}
                        </span>
                      ))
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No teachers added yet.</p>
        )}
      </div>

      {/* ✅ Class Averages */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2>📈 Class Averages ({classAverages.length})</h2>
          {classAverages.length > 0 && (
            <button
              onClick={() => downloadPDF('class-averages', classAverages, 'Class Averages Report')}
              style={downloadButton}
            >
              📄 Download PDF
            </button>
          )}
        </div>

        {analyticsLoading ? (
          <p>Loading class averages...</p>
        ) : classAverages.length > 0 ? (
          <table style={dataTable}>
            <thead>
              <tr>
                <th>Class</th>
                <th>Group</th>
                <th>Exam Pattern</th>
                <th>Physics</th>
                <th>Chemistry</th>
                <th>Maths</th>
                <th>Biology</th>
                <th>Total %</th>
              </tr>
            </thead>
            <tbody>
              {classAverages.map((item, i) => (
                <tr key={i}>
                  <td>{item.class || '-'}</td>
                  <td>{item.group || '-'}</td>
                  <td>{item.exam_pattern || '-'}</td>
                  <td>{(item.physics_average ?? 0).toFixed(2)}</td>
                  <td>{(item.chemistry_average ?? 0).toFixed(2)}</td>
                  <td>{(item.maths_average ?? 0).toFixed(2)}</td>
                  <td>{(item.biology_average ?? 0).toFixed(2)}</td>
                  <td>{(item.total_percentage ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No class average data available. Upload exam results to generate.</p>
        )}
      </div>

      {/* ✅ Subject Summaries */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2>📚 Subject Summaries ({subjectSummaries.length})</h2>
          {subjectSummaries.length > 0 && (
            <button
              onClick={() => downloadPDF('subject-summaries', subjectSummaries, 'Subject Summary Report')}
              style={downloadButton}
            >
              📄 Download PDF
            </button>
          )}
        </div>

        {analyticsLoading ? (
          <p>Loading subject summaries...</p>
        ) : subjectSummaries.length > 0 ? (
          <table style={dataTable}>
            <thead>
              <tr>
                <th>Class</th>
                <th>Subject</th>
                <th>Exam Pattern</th>
                <th>Avg %</th>
                <th>Teachers</th>
              </tr>
            </thead>
            <tbody>
              {subjectSummaries.map((item, i) => (
                <tr key={i}>
                  <td>{item.class || '-'}</td>
                  <td>{item.subject || '-'}</td>
                  <td>{item.exam_pattern || '-'}</td>
                  <td>{(item.total_percentage ?? 0).toFixed(2)}</td>
                  <td>
                    {Array.isArray(item.teachers_assigned_names) && item.teachers_assigned_names.length > 0
                      ? item.teachers_assigned_names.join(', ')
                      : '-'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No subject summary data available. Upload exam results to generate.</p>
        )}
      </div>
    </div>
  );
}

// ✅ Styles
const card = {
  border: "1px solid #d3d8e6",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  background: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
};

const infoTable = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: 8,
};

const tableCell = {
  padding: '8px',
  borderBottom: '1px solid #ddd',
  color: '#333',
  textAlign: 'left',
};

Object.assign(infoTable, {
  td: tableCell,
  th: { ...tableCell, fontWeight: 'bold', background: '#f7f9fc' }
});

const dataTable = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: 8,
};

Object.assign(dataTable, {
  th: {
    padding: '10px',
    textAlign: 'left',
    background: '#f1f5f9',
    borderBottom: '2px solid #ddd',
    fontWeight: '600',
    color: '#1e293b'
  },
  td: {
    padding: '8px',
    borderBottom: '1px solid #eee',
    color: '#333'
  }
});

const badge = {
  display: 'inline-block',
  padding: '2px 6px',
  margin: '2px 0',
  background: '#3b82f6',
  color: 'white',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: '500',
};

const downloadButton = {
  padding: '8px 16px',
  background: '#10b981',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500',
  display: 'flex',
  alignItems: 'center',
  gap: '6px'
};