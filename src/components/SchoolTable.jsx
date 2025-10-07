import React, { useState, useEffect } from 'react';

// API base (use env var in production)
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function SchoolTable({ rows, onSchoolDeleted }) {
  const [expanded, setExpanded] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'school_id', direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingDetails, setLoadingDetails] = useState({});
  const [schoolDetails, setSchoolDetails] = useState({});

  if (!rows?.length) {
    return <p className="help">No schools yet.</p>;
  }

  // Filter schools based on search term
  const filteredRows = rows.filter((r) =>
    Object.values(r).some((val) =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Sorting handler
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Sort rows
  const sortedRows = [...filteredRows].sort((a, b) => {
    const aValue = a[sortConfig.key] || '';
    const bValue = b[sortConfig.key] || '';
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleExpand = (schoolId) => {
    const isCurrentlyExpanded = !!expanded[schoolId];
    setExpanded((prev) => ({ ...prev, [schoolId]: !isCurrentlyExpanded }));

    // If expanding, fetch details
    if (!isCurrentlyExpanded) {
      fetchSchoolDetails(schoolId);
    }
  };

  const fetchSchoolDetails = async (schoolId) => {
    if (schoolDetails[schoolId] || loadingDetails[schoolId]) return;

    setLoadingDetails((prev) => ({ ...prev, [schoolId]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/schools/${schoolId}`);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);

      const data = await res.json();

      // ✅ Ensure fallbacks
      const classes = Array.isArray(data.classes) ? data.classes : [];
      const teachers = Array.isArray(data.teachers) ? data.teachers : [];

      setSchoolDetails((prev) => ({
        ...prev,
        [schoolId]: {
          classes,
          teachers,
        },
      }));
    } catch (err) {
      console.error('Failed to load school details:', err);
      setSchoolDetails((prev) => ({
        ...prev,
        [schoolId]: { classes: [], teachers: [] },
      }));
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [schoolId]: false }));
    }
  };

  const handleDeleteSchool = async (schoolId) => {
    if (!window.confirm(`Are you sure you want to delete school ${schoolId}? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/schools/${schoolId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(`Failed to delete school: ${res.status}`);
      }

      // Notify parent to remove from list or refetch
      if (typeof onSchoolDeleted === 'function') {
        onSchoolDeleted(schoolId);
      }

      // Also collapse if expanded
      setExpanded(prev => {
        const newState = { ...prev };
        delete newState[schoolId];
        return newState;
      });

      alert(`School ${schoolId} deleted successfully.`);
    } catch (err) {
      console.error('Failed to delete school:', err);
      alert('Failed to delete school. Please try again.');
    }
  };

  const isExpanded = (schoolId) => !!expanded[schoolId];

  return (
    <div style={{ marginTop: '20px' }}>
      {/* Search Bar */}
      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="Search schools (name, ID, area, state...)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            fontSize: '14px',
          }}
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            style={{
              padding: '0 10px',
              border: '1px solid #e2e8f0',
              background: '#f7fafc',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Results Count */}
      <p className="help" style={{ marginBottom: '8px' }}>
        Showing {sortedRows.length} of {rows.length} school(s)
      </p>

      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <table style={{ minWidth: '100%', width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f7fafc' }}>
              <th style={{ ...th, cursor: 'pointer' }} onClick={() => requestSort('school_id')}>
                SCHOOL_ID {sortConfig.key === 'school_id' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ ...th, cursor: 'pointer' }} onClick={() => requestSort('school_name')}>
                SCHOOL_NAME {sortConfig.key === 'school_name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={th}>AREA</th>
              <th style={th}>DISTRICT</th>
              <th style={{ ...th, cursor: 'pointer' }} onClick={() => requestSort('state')}>
                STATE {sortConfig.key === 'state' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={th}>ACADEMIC_YEAR</th>
              <th style={th}>CLASSES</th>
              <th style={th}>TEACHERS</th>
              <th style={th}>DETAILS</th>
              <th style={th}>ACTIONS</th> {/* 👈 NEW COLUMN */}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ ...td, textAlign: 'center', padding: '20px', color: '#718096' }}>
                  No matching schools found.
                </td>
              </tr>
            ) : (
              sortedRows.map((r) => (
                <React.Fragment key={r.school_id}>
                  <tr
                    style={{ cursor: 'pointer', backgroundColor: isExpanded(r.school_id) ? '#ebf8ff' : 'white' }}
                    onClick={() => toggleExpand(r.school_id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpand(r.school_id);
                      }
                    }}
                    aria-expanded={isExpanded(r.school_id)}
                    aria-controls={`details-${r.school_id}`}
                  >
                    <td style={td}>{r.school_id}</td>
                    <td style={td}>{r.school_name}</td>
                    <td style={td}>{r.area || '-'}</td>
                    <td style={td}>{r.district || '-'}</td>
                    <td style={td}>{r.state}</td>
                    <td style={td}>{r.academic_year}</td>
                    <td style={td}>{r.classes_count || 0}</td>
                    <td style={td}>{r.teachers_count || 0}</td>
                    <td style={td}>
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(r.school_id);
                        }}
                        aria-label={isExpanded(r.school_id) ? 'Hide details' : 'Show details'}
                      >
                        {isExpanded(r.school_id) ? '▼ Hide' : '▶ Show'}
                      </button>
                    </td>
                    <td style={td}> {/* 👈 DELETE BUTTON */}
                      <button
                        className="btn btn-outline"
                        style={{
                          fontSize: '12px',
                          padding: '4px 8px',
                          color: '#e53e3e',
                          borderColor: '#e53e3e',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSchool(r.school_id);
                        }}
                        aria-label="Delete school"
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Row: Fetch and Show Class & Teacher Details */}
                  {isExpanded(r.school_id) && (
                    <tr id={`details-${r.school_id}`} aria-labelledby={`school-${r.school_id}`}>
                      <td colSpan={10} style={{ padding: '16px', backgroundColor: '#f8fafc', borderTop: 'none' }}>
                        {loadingDetails[r.school_id] ? (
                          <p>Loading details...</p>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '24px',
                            }}
                          >
                            {/* Classes Table */}
                            <div>
                              <h4 style={sectionHeader}>
                                Classes ({schoolDetails[r.school_id]?.classes?.length || 0})
                              </h4>
                              {schoolDetails[r.school_id]?.classes?.length > 0 ? (
                                <table style={innerTable}>
                                  <thead>
                                    <tr style={{ backgroundColor: '#ebf4ff' }}>
                                      <th style={thSmall}>CLASS</th>
                                      <th style={thSmall}>SECTION</th>
                                      <th style={thSmall}>FOUNDATION</th>
                                      <th style={thSmall}>PROGRAM</th>
                                      <th style={thSmall}>GROUP</th>
                                      <th style={thSmall}>STUDENTS</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {schoolDetails[r.school_id].classes.map((c, idx) => (
                                      <tr key={idx}>
                                        <td style={tdSmall}>{c.class}</td>
                                        <td style={tdSmall}>{c.section}</td>
                                        <td style={tdSmall}>{c.foundation}</td>
                                        <td style={tdSmall}>{c.program}</td>
                                        <td style={tdSmall}>{c.group}</td>
                                        <td style={tdSmall}>{c.num_students}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p style={emptyText}>- No classes added -</p>
                              )}
                            </div>

                            {/* Teachers Table */}
                            <div>
                              <h4 style={sectionHeader}>
                                Teachers ({schoolDetails[r.school_id]?.teachers?.length || 0})
                              </h4>
                              {schoolDetails[r.school_id]?.teachers?.length > 0 ? (
                                <table style={innerTable}>
                                  <thead>
                                    <tr style={{ backgroundColor: '#ebf4ff' }}>
                                      <th style={thSmall}>TEACHER ID</th> {/* 👈 ADDED */}
                                      <th style={thSmall}>NAME</th>
                                      <th style={thSmall}>CONTACT</th>
                                      <th style={thSmall}>EMAIL</th>
                                      <th style={thSmall}>ALLOTMENTS</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {schoolDetails[r.school_id].teachers.map((t, idx) => (
                                      <tr key={idx}>
                                        <td style={{ ...tdSmall, fontFamily: 'monospace', fontWeight: 500 }}>
                                          {t.teacher_id || '-'}
                                        </td>
                                        <td style={tdSmall}>{t.name}</td>
                                        <td style={tdSmall}>{t.contact || '-'}</td>
                                        <td style={tdSmall}>{t.email || '-'}</td>
                                        <td style={tdSmall}>
                                          {Array.isArray(t.teacher_assignments) && t.teacher_assignments.length > 0 ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                              {t.teacher_assignments.map((a, i) => (
                                                <span key={i} style={badge}>
                                                  {a.class} • {a.section} • {a.subject}
                                                </span>
                                              ))}
                                            </div>
                                          ) : (
                                            <span style={emptySpan}>-</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p style={emptyText}>- No teachers added -</p>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Shared styles
const th = {
  padding: '10px 12px',
  textAlign: 'left',
  borderBottom: '1px solid #e2e8f0',
  fontSize: '13px',
  fontWeight: '600',
  color: '#4a5568',
};

const td = {
  padding: '8px 12px',
  borderBottom: '1px solid #edf2f7',
  fontSize: '14px',
  color: '#2d3748',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const thSmall = { ...th, fontSize: '12px' };
const tdSmall = { ...td, fontSize: '13px', padding: '6px 10px' };
const sectionHeader = {
  margin: '0 0 10px 0',
  fontSize: '16px',
  color: '#2d3748',
  fontWeight: '600',
};
const innerTable = { width: '100%', borderCollapse: 'collapse' };
const emptyText = { color: '#718096', fontSize: '14px' };
const emptySpan = { color: '#718096' };
const badge = {
  display: 'inline-block',
  padding: '2px 6px',
  backgroundColor: '#4299e1',
  color: 'white',
  borderRadius: '4px',
  fontSize: '12px',
  whiteSpace: 'nowrap',
};