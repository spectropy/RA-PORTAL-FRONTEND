import React, { useState } from 'react';

export default function SchoolTable({ rows }) {
  const [expanded, setExpanded] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'school_id', direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');

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
    setExpanded((prev) => ({
      ...prev,
      [schoolId]: !prev[schoolId],
    }));
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
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ ...td, textAlign: 'center', padding: '20px', color: '#718096' }}>
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
                    <td style={td}>{r.classes?.length || 0}</td>
                    <td style={td}>{r.teachers?.length || 0}</td>
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
                  </tr>

                  {/* Expanded Row: Class & Teacher Details */}
                  {isExpanded(r.school_id) && (
                    <tr id={`details-${r.school_id}`} aria-labelledby={`school-${r.school_id}`}>
                      <td colSpan={9} style={{ padding: '16px', backgroundColor: '#f8fafc', borderTop: 'none' }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                            gap: '24px',
                          }}
                        >
                          {/* Classes Table */}
                          <div>
                            <h4
                              id={`classes-header-${r.school_id}`}
                              style={{
                                margin: '0 0 10px 0',
                                fontSize: '16px',
                                color: '#2d3748',
                                fontWeight: '600',
                              }}
                            >
                              Classes ({r.classes?.length || 0})
                            </h4>
                            {r.classes && r.classes.length > 0 ? (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead>
                                  <tr style={{ backgroundColor: '#ebf4ff' }}>
                                    <th style={{ ...th, fontSize: '12px' }}>CLASS</th>
                                    <th style={{ ...th, fontSize: '12px' }}>SECTION</th>
                                    <th style={{ ...th, fontSize: '12px' }}>FOUNDATION</th>
                                    <th style={{ ...th, fontSize: '12px' }}>PROGRAM</th>
                                    <th style={{ ...th, fontSize: '12px' }}>GROUP</th>
                                    <th style={{ ...th, fontSize: '12px' }}>STUDENTS</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.classes.map((c, idx) => (
                                    <tr key={idx}>
                                      <td style={td}>{c.class}</td>
                                      <td style={td}>{c.section}</td>
                                      <td style={td}>{c.foundation}</td>
                                      <td style={td}>{c.program}</td>
                                      <td style={td}>{c.group}</td>
                                      <td style={td}>{c.num_students}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p style={{ color: '#718096', fontSize: '14px' }}>- No classes added -</p>
                            )}
                          </div>

                          {/* Teachers Table */}
                          <div>
                            <h4
                              id={`teachers-header-${r.school_id}`}
                              style={{
                                margin: '0 0 10px 0',
                                fontSize: '16px',
                                color: '#2d3748',
                                fontWeight: '600',
                              }}
                            >
                              Teachers ({r.teachers?.length || 0})
                            </h4>
                            {r.teachers && r.teachers.length > 0 ? (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead>
                                  <tr style={{ backgroundColor: '#ebf4ff' }}>
                                    <th style={{ ...th, fontSize: '12px' }}>NAME</th>
                                    <th style={{ ...th, fontSize: '12px' }}>CONTACT</th>
                                    <th style={{ ...th, fontSize: '12px' }}>EMAIL</th>
                                    <th style={{ ...th, fontSize: '12px' }}>ASSIGNMENTS</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.teachers.map((t, idx) => (
                                    <tr key={idx}>
                                      <td style={td}>{t.name}</td>
                                      <td style={td}>{t.contact || '-'}</td>
                                      <td style={td}>{t.email || '-'}</td>
                                      <td style={td}>
                                        {t.assignments.length > 0 ? (
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {t.assignments.map((a, i) => (
                                              <span
                                                key={i}
                                                style={{
                                                  display: 'inline-block',
                                                  padding: '2px 6px',
                                                  backgroundColor: '#4299e1',
                                                  color: 'white',
                                                  borderRadius: '4px',
                                                  fontSize: '12px',
                                                  whiteSpace: 'nowrap',
                                                }}
                                              >
                                                {a.class} • {a.section} • {a.subject}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <span style={{ color: '#718096' }}>-</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p style={{ color: '#718096', fontSize: '14px' }}>- No teachers added -</p>
                            )}
                          </div>
                        </div>
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