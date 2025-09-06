// src/components/SchoolOwnerDashboard.jsx
import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function SchoolOwnerDashboard({ onBack }) {
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const schoolId = sessionStorage.getItem("sp_school_id");

  useEffect(() => {
    if (!schoolId) {
      setError("No school ID found. Please log in again.");
      setLoading(false);
      return;
    }

    const fetchSchool = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/schools/${schoolId}`);
        if (!res.ok) throw new Error("School not found");

        const data = await res.json();
        setSchool(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSchool();
  }, [schoolId]);

  if (loading) return <p>Loading school data...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  if (!school) return <p>No school data available.</p>;

  return (
    <div style={{ maxWidth: 1100, margin: '24px auto', padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>🏫 {school.school_name}</h1>
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
            <tr>
              <td><strong>School Name:</strong></td>
              <td>{school.school_name || '-'}</td>
            </tr>
            <tr>
              <td><strong>School ID:</strong></td>
              <td>{school.school_id || '-'}</td>
            </tr>
            <tr>
              <td><strong>Area:</strong></td>
              <td>{school.area || '-'}</td>
            </tr>
            <tr>
              <td><strong>District:</strong></td>
              <td>{school.district || '-'}</td>
            </tr>
            <tr>
              <td><strong>State:</strong></td>
              <td>{school.state || '-'}</td>
            </tr>
            <tr>
              <td><strong>Academic Year:</strong></td>
              <td>{school.academic_year || '-'}</td>
            </tr>
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
    </div>
  );
}

// ✅ Corrected Styles
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

// ✅ Properly define styles for td and th
const tableCell = {
  padding: '8px',
  borderBottom: '1px solid #ddd',
  color: '#333',
  textAlign: 'left',
};

// Apply same style to all td and th in tables
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