import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function SchoolTable({ rows, onSchoolDeleted, exportButtons }) {
  const [expanded, setExpanded] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'school_id', direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingDetails, setLoadingDetails] = useState({});
  const [schoolDetails, setSchoolDetails] = useState({});

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const filteredRows = (rows || []).filter((r) =>
    Object.values(r).some((val) =>
      String(val ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedRows = [...filteredRows].sort((a, b) => {
    const aValue = a[sortConfig.key] ?? '';
    const bValue = b[sortConfig.key] ?? '';
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const isExpanded = (schoolId) => !!expanded[schoolId];

  const toggleExpand = (schoolId) => {
    const isCurrentlyExpanded = !!expanded[schoolId];
    setExpanded((prev) => ({ ...prev, [schoolId]: !isCurrentlyExpanded }));
    if (!isCurrentlyExpanded) {
      fetchSchoolDetails(schoolId);
    }
  };

  const fetchSchoolDetails = async (schoolId) => {
    if (schoolDetails[schoolId] || loadingDetails[schoolId]) return;

    setLoadingDetails((prev) => ({ ...prev, [schoolId]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/schools/${schoolId}`);
      if (!res.ok) throw new Error(`Failed to fetch details: ${res.status}`);

      const data = await res.json();
      const classes = Array.isArray(data.classes) ? data.classes : [];
      const teachers = Array.isArray(data.teachers) ? data.teachers : [];

      setSchoolDetails((prev) => ({
        ...prev,
        [schoolId]: { classes, teachers },
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

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/schools/${deleteTarget}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(`Failed to delete school: ${res.status}`);
      }

      if (typeof onSchoolDeleted === 'function') {
        onSchoolDeleted(deleteTarget);
      }

      setExpanded((prev) => {
        const newState = { ...prev };
        delete newState[deleteTarget];
        return newState;
      });

      setToast({ type: 'success', msg: `School ${deleteTarget} deleted successfully.` });
    } catch (err) {
      console.error('Failed to delete school:', err);
      setToast({ type: 'error', msg: err.message || 'Failed to delete school.' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const renderDetails = (schoolId) => {
    const classes = schoolDetails[schoolId]?.classes || [];
    const teachers = schoolDetails[schoolId]?.teachers || [];

    return (
      <div className="detail-row-inner">
        <div>
          <div className="detail-section-title">📚 Classes ({classes.length})</div>
          {classes.length > 0 ? (
            <div className="detail-inner-table-wrap">
              <table className="detail-inner-table">
                <thead>
                  <tr>
                    <th>CLASS</th>
                    <th>SECTION</th>
                    <th>FOUNDATION</th>
                    <th>PROGRAM</th>
                    <th>GROUP</th>
                    <th>STUDENTS</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c, idx) => (
                    <tr key={idx}>
                      <td>{c.class}</td>
                      <td>{c.section}</td>
                      <td>{c.foundation || '-'}</td>
                      <td>{c.program || '-'}</td>
                      <td>{c.group || '-'}</td>
                      <td>{c.num_students || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-inline">No records added yet.</p>
          )}
        </div>

        <div>
          <div className="detail-section-title">👩‍🏫 Teachers ({teachers.length})</div>
          {teachers.length > 0 ? (
            <div className="detail-inner-table-wrap">
              <table className="detail-inner-table">
                <thead>
                  <tr>
                    <th>TEACHER ID</th>
                    <th>NAME</th>
                    <th>CONTACT</th>
                    <th>ALLOTMENTS</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t, idx) => (
                    <tr key={idx}>
                      <td>{t.teacher_id || '-'}</td>
                      <td>{t.name}</td>
                      <td>{t.contact || '-'}</td>
                      <td>
                        {Array.isArray(t.teacher_assignments) && t.teacher_assignments.length > 0 ? (
                          t.teacher_assignments.map((a, i) => (
                            <span key={i} className="assignment-tag">
                              {a.class} · {a.section} · {a.subject}
                            </span>
                          ))
                        ) : (
                          <span className="empty-inline">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-inline">No records added yet.</p>
          )}
        </div>
      </div>
    );
  };

  if (!rows || rows.length === 0) {
    return (
      <>
        {toast && (
          <div className={`alert-banner alert-banner--${toast.type}`} style={{ margin: '16px 32px' }}>
            <span className="alert-banner-icon">{toast.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{toast.msg}</span>
          </div>
        )}
        <div className="table-empty-state">
          <div className="table-empty-icon">🏫</div>
          <h3 className="table-empty-title">No schools registered yet</h3>
          <p className="table-empty-body">Click "+ Add School" above to register your first school.</p>
        </div>
      </>
    );
  }

  return (
    <>
      {toast && (
        <div className={`alert-banner alert-banner--${toast.type}`} style={{ margin: '16px 32px' }}>
          <span className="alert-banner-icon">{toast.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      <div className="table-toolbar">
        <div className="table-search-wrap">
          <span className="table-search-icon">🔍</span>
          <input
            className="table-search-input"
            type="text"
            placeholder="Search by name, ID, state..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="table-search-clear" onClick={() => setSearchTerm('')}>
              ✕
            </button>
          )}
        </div>
        <span className="results-count-label">
          Showing {sortedRows.length} of {rows.length} schools
        </span>
        {/* PDF / CSV export buttons — sit right of the search bar */}
        {exportButtons && (
          <div className="toolbar-export-slot">{exportButtons}</div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="data-table-outer">
        <table className="data-table">
          <thead>
            <tr>
              <th className={sortConfig.key === 'school_id' ? 'sorted' : ''} onClick={() => requestSort('school_id')}>
                SCHOOL_ID <span className="sort-arrow">{sortConfig.key === 'school_id' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th className={sortConfig.key === 'school_name' ? 'sorted' : ''} onClick={() => requestSort('school_name')}>
                SCHOOL NAME <span className="sort-arrow">{sortConfig.key === 'school_name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th className={sortConfig.key === 'state' ? 'sorted' : ''} onClick={() => requestSort('state')}>
                STATE <span className="sort-arrow">{sortConfig.key === 'state' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th className={sortConfig.key === 'academic_year' ? 'sorted' : ''} onClick={() => requestSort('academic_year')}>
                ACADEMIC YEAR <span className="sort-arrow">{sortConfig.key === 'academic_year' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th className="text-center">CLASSES</th>
              <th className="text-center">TEACHERS</th>
              <th className="text-center">DETAILS</th>
              <th className="text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="table-empty-state">
                    <div className="table-empty-icon">🔍</div>
                    <h3 className="table-empty-title">No matching schools found</h3>
                    <p className="table-empty-body">Try adjusting your search query.</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedRows.map((r) => (
                <React.Fragment key={r.school_id}>
                  <tr className={isExpanded(r.school_id) ? 'row-expanded' : ''}>
                    <td>
                      <span className="school-id-badge">{r.school_id}</span>
                    </td>
                    <td>{r.school_name}</td>
                    <td>{r.state}</td>
                    <td>{r.academic_year}</td>
                    <td className="text-center">
                      <span className="count-chip">{r.classes_count || 0}</span>
                    </td>
                    <td className="text-center">
                      <span className="count-chip">{r.teachers_count || 0}</span>
                    </td>
                    <td className="text-center">
                      <button
                        className="btn-icon-expand"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(r.school_id);
                        }}
                      >
                        {isExpanded(r.school_id) ? '▼ Hide' : '▶ Show'}
                      </button>
                    </td>
                    <td className="text-center">
                      <button
                        className="btn-icon-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(r.school_id);
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                  {isExpanded(r.school_id) && (
                    <tr className="detail-row">
                      <td colSpan={8}>
                        {loadingDetails[r.school_id] ? (
                          <p className="empty-inline" style={{ padding: '16px 0' }}>
                            Loading...
                          </p>
                        ) : (
                          renderDetails(r.school_id)
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

      {/* Mobile Cards */}
      <div className="school-cards-mobile">
        {sortedRows.length === 0 ? (
          <div className="table-empty-state">
            <div className="table-empty-icon">🔍</div>
            <h3 className="table-empty-title">No matching schools found</h3>
            <p className="table-empty-body">Try adjusting your search query.</p>
          </div>
        ) : (
          sortedRows.map((r) => (
            <div key={r.school_id} className="school-card-m">
              <div className="school-card-m-top">
                <div className="school-card-m-row1">
                  <div className="school-card-m-name">{r.school_name}</div>
                  <span className="school-id-badge">{r.school_id}</span>
                </div>
                <div className="school-card-m-tags">
                  <span className="school-meta-tag">📍 {r.state}</span>
                  <span className="school-meta-tag">📅 {r.academic_year}</span>
                  {r.area && <span className="school-meta-tag">🏘 {r.area}</span>}
                  {r.district && <span className="school-meta-tag">🗺 {r.district}</span>}
                </div>
                <div className="school-card-m-counts">
                  <span className="school-count-item">
                    📚 <span className="school-count-num">{r.classes_count || 0}</span> Classes
                  </span>
                  <span className="school-count-item">
                    👩‍🏫 <span className="school-count-num">{r.teachers_count || 0}</span> Teachers
                  </span>
                </div>
              </div>
              <div className="school-card-m-actions">
                <button className="btn-icon-expand" onClick={() => toggleExpand(r.school_id)}>
                  {isExpanded(r.school_id) ? '▼ Hide Details' : '▶ View Details'}
                </button>
                <button className="btn-icon-delete" onClick={() => setDeleteTarget(r.school_id)}>
                  🗑️ Delete
                </button>
              </div>
              {isExpanded(r.school_id) && (
                <div className="school-card-detail">
                  {loadingDetails[r.school_id] ? (
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Loading...</p>
                  ) : (
                    renderDetails(r.school_id)
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">🗑️</div>
            <h3 className="modal-title">Delete School</h3>
            <p className="modal-body">
              Are you sure you want to delete <span className="modal-school-id">{deleteTarget}</span>? This cannot be undone.
            </p>
            <div className="modal-warning-note">
              ⚠️ All classes, teachers, and student data for this school will be permanently removed.
            </div>
            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn-modal-delete" disabled={deleting} onClick={confirmDelete}>
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
