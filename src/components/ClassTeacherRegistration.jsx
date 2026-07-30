import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  getSchoolById, 
  createClass, 
  createTeacher, 
  assignTeacherToClass, 
  getAcademicYears,  
  deleteClassById, 
  deleteAssignmentById  
} from '../api';

// ===== Constants =====
const GRADE_OPTIONS = Array.from({ length: 10 }, (_, i) => `GRADE-${i + 1}`);
const SECTION_OPTIONS = "ABCDEF TULIPS IRIS DAFFODILS MPC_A MPC_B MPC_C MPC BIPC"
  .split(" ")               // → ['ABCDEF', 'TULIPS', 'IRIS', 'DAFFODILS']
  .flatMap(part => 
    part === "ABCDEF" ? part.split("") : [part]
  );
//const SECTION_OPTIONS = "ABCDEF TULIPS IRIS DAFFODILS".split("");
const FOUNDATION_OPTIONS = ["IIT-MED", "IIT", "MED"];
const PROGRAM_OPTIONS = ["CAT", "MAE", "PIO", "NGHS_MAE", "FF"];
const GROUP_OPTIONS = ["PCM", "PCB", "PCMB"];

const forcedGroupForFoundation = (foundation) => {
  if (foundation === "IIT-MED") return "PCMB";
  if (foundation === "IIT") return "PCM";
  if (foundation === "MED") return "PCB";
  return "";
};

const getSubjectOptions = (foundation) => {
  if (foundation === "IIT-MED") {
    return ["Physics", "Chemistry", "Maths", "Biology"];
  } else if (foundation === "IIT") {
    return ["Physics", "Chemistry", "Maths"];
  } else if (foundation === "MED") {
    return ["Physics", "Chemistry", "Biology"];
  } else {
    return ["Physics", "Chemistry", "Maths", "Biology", "English", "Computer Science"];
  }
};

export default function ClassTeacherRegistration({ schools = [] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [schoolData, setSchoolData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const resolveSubTabFromPath = () => {
    const subPath = location.pathname.split('/')[3] || 'overview';
    if (subPath === 'add-class') return 'addClass';
    if (subPath === 'add-teacher') return 'addTeacher';
    if (subPath === 'assign-teacher') return 'assignTeacher';
    return 'overview';
  };

  // Sub-tab navigation state: 'overview' | 'addClass' | 'addTeacher' | 'assignTeacher'
  const [activeSubTab, setActiveSubTab] = useState(resolveSubTabFromPath());

  useEffect(() => {
    setActiveSubTab(resolveSubTabFromPath());
  }, [location.pathname]);

  const goSubTab = (path) => {
    navigate(`/admin/classes/${path}`);
  };

  // Overview view toggle for tables: 'all' | 'classes' | 'teachers'
  const [tableFilter, setTableFilter] = useState('all');

  // New class form state
  const [newClass, setNewClass] = useState({
    class: '',
    foundation: '',
    program: '',
    group: '',
    section: '',
    numStudents: ''
  });

  // New teacher form state
  const [newTeacher, setNewTeacher] = useState({
    teacherId: '',
    name: '',
    contact: '',
    email: ''
  });

  // Teacher assignment state
  const [assignment, setAssignment] = useState({
    teacherId: '',
    class: '',
    section: '',
    subject: ''
  });

  const [selectedClassFoundation, setSelectedClassFoundation] = useState('');

  useEffect(() => {
    const fetchAcademicYearsData = async () => {
      try {
        const years = await getAcademicYears();
        setAcademicYears(years);
        
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const startYear = currentMonth >= 3 ? currentYear : currentYear - 1;
        const defaultAcademicYear = `${startYear}-${startYear + 1}`;
        
        const defaultYear = years.find(y => y.id === defaultAcademicYear) || years[0];
        if (defaultYear) {
          setSelectedAcademicYear(defaultYear.id);
        }
      } catch (err) {
        console.error('Error fetching academic years:', err);
        setError('Failed to load academic years');
      }
    };

    fetchAcademicYearsData();
  }, []);

  useEffect(() => {
    if (selectedSchool && selectedAcademicYear) {
      fetchSchoolData();
    }
  }, [selectedSchool, selectedAcademicYear]);

  // Auto-generate teacher ID
  useEffect(() => {
    if (selectedSchool && schoolData?.teachers?.length > 0) {
      const existingNumbers = schoolData.teachers
        .map(t => {
          const match = t.teacher_id.match(new RegExp(`^${selectedSchool}(\\d{2})$`));
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(n => n > 0);

      const nextNumber = existingNumbers.length > 0
        ? Math.max(...existingNumbers) + 1
        : 1;

      const newTeacherId = `${selectedSchool}${String(nextNumber).padStart(2, '0')}`;
      setNewTeacher(prev => ({ ...prev, teacherId: newTeacherId }));
    } else if (selectedSchool) {
      setNewTeacher(prev => ({ ...prev, teacherId: `${selectedSchool}01` }));
    }
  }, [selectedSchool, schoolData?.teachers]);

  const [actionLoading, setActionLoading] = useState(false);

  const fetchSchoolData = async (silent = false) => {
    if (!selectedSchool) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await getSchoolById(selectedSchool);
      setSchoolData(data);
    } catch (err) {
      if (!silent) setError(err.message || 'Failed to load school data');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!selectedSchool) {
      setError('Please select a school first.');
      return;
    }

    // ✅ Duplicate validation for class + section
    const isDuplicate = schoolData?.classes?.some(
      cls => cls.class === newClass.class && cls.section === newClass.section
    );

    if (isDuplicate) {
      setError(`Class "${newClass.class} - Section ${newClass.section}" already exists for this school.`);
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        school_id: selectedSchool,
        class: newClass.class,
        foundation: newClass.foundation,
        program: newClass.program,
        group: newClass.group,
        section: newClass.section,
        num_students: parseInt(newClass.numStudents) || 0,
        academic_year: selectedAcademicYear
      };

      const res = await createClass(payload);

      // ⚡ Optimistic Instant State Update
      const addedClass = {
        id: res?.data?.id || res?.id || Date.now(),
        school_id: selectedSchool,
        class: newClass.class,
        section: newClass.section,
        foundation: newClass.foundation || '-',
        program: newClass.program || '-',
        group: newClass.group || '-',
        num_students: parseInt(newClass.numStudents) || 0
      };

      setSchoolData(prev => ({
        ...prev,
        classes: [...(prev?.classes || []), addedClass]
      }));

      setSuccess('Class added successfully!');
      setNewClass({ class: '', foundation: '', program: '', group: '', section: '', numStudents: '' });
      goSubTab('overview');

      // 🔄 Silent background sync
      fetchSchoolData(true);
    } catch (err) {
      setError(err.message || 'Failed to add class');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!selectedSchool) {
      setError('Please select a school first.');
      return;
    }
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        school_id: selectedSchool,
        teacher_id: newTeacher.teacherId,
        name: newTeacher.name,
        contact: newTeacher.contact,
        email: newTeacher.email
      };

      const res = await createTeacher(payload);

      // ⚡ Optimistic Instant State Update
      const addedTeacher = {
        id: res?.data?.id || res?.id || Date.now(),
        school_id: selectedSchool,
        teacher_id: newTeacher.teacherId,
        name: newTeacher.name,
        contact: newTeacher.contact || '-',
        email: newTeacher.email || '-',
        teacher_assignments: []
      };

      setSchoolData(prev => ({
        ...prev,
        teachers: [...(prev?.teachers || []), addedTeacher]
      }));

      setSuccess('Teacher added successfully!');
      setNewTeacher({ teacherId: '', name: '', contact: '', email: '' });
      goSubTab('overview');

      // 🔄 Silent background sync
      fetchSchoolData(true);
    } catch (err) {
      setError(err.message || 'Failed to add teacher');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignTeacher = async (e) => {
    e.preventDefault();
    if (!selectedSchool) {
      setError('Please select a school first.');
      return;
    }

    // ✅ Duplicate assignment validation
    const targetTeacher = schoolData?.teachers?.find(t => t.teacher_id === assignment.teacherId);
    const isDuplicateAsgn = targetTeacher?.teacher_assignments?.some(
      a => a.class === assignment.class && a.section === assignment.section && a.subject === assignment.subject
    );

    if (isDuplicateAsgn) {
      setError(`Teacher "${targetTeacher?.name || assignment.teacherId}" is already assigned to ${assignment.subject} for ${assignment.class}-${assignment.section}.`);
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        school_id: selectedSchool,
        teacher_id: assignment.teacherId,
        class: assignment.class,
        section: assignment.section,
        subject: assignment.subject
      };

      const res = await assignTeacherToClass(payload);

      // ⚡ Optimistic Instant State Update
      const addedAssignment = {
        id: res?.data?.id || res?.id || Date.now(),
        class: assignment.class,
        section: assignment.section,
        subject: assignment.subject
      };

      setSchoolData(prev => ({
        ...prev,
        teachers: (prev?.teachers || []).map(t =>
          t.teacher_id === assignment.teacherId
            ? { ...t, teacher_assignments: [...(t.teacher_assignments || []), addedAssignment] }
            : t
        )
      }));

      setSuccess('Teacher assigned to class successfully!');
      setAssignment({ teacherId: '', class: '', section: '', subject: '' });
      goSubTab('overview');

      // 🔄 Silent background sync
      fetchSchoolData(true);
    } catch (err) {
      setError(err.message || 'Failed to assign teacher');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClassChange = (e) => {
    const { name, value } = e.target;
    setNewClass(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'foundation') {
        const forced = forcedGroupForFoundation(value);
        if (forced) updated.group = forced;
      }
      return updated;
    });
  };

  const handleTeacherChange = (e) => {
    setNewTeacher({ ...newTeacher, [e.target.name]: e.target.value });
  };

  const handleAssignmentChange = (e) => {
    const { name, value } = e.target;
    setAssignment(prev => ({ ...prev, [name]: value }));

    if (name === 'class' && schoolData?.classes) {
      const selectedClass = schoolData.classes.find(cls => cls.class === value);
      setSelectedClassFoundation(selectedClass?.foundation || '');
    }
  };

  const handleDeleteClass = async (classId, className, section) => {
    if (!confirm(`Are you sure you want to delete class ${className}-${section}? All subject assignments will be removed.`)) {
      return;
    }
    setError('');
    setSuccess('');

    // ⚡ Optimistic Delete
    setSchoolData(prev => ({
      ...prev,
      classes: (prev?.classes || []).filter(cls => cls.id !== classId)
    }));

    try {
      await deleteClassById(classId);
      setSuccess('Class deleted successfully!');
      fetchSchoolData(true);
    } catch (err) {
      setError(err.message || 'Failed to delete class');
      fetchSchoolData(false); // rollback on error
    }
  };

  const handleDeleteAssignment = async (assignmentId, subject, className, section) => {
    if (!confirm(`Remove assignment: ${subject} for ${className}-${section}?`)) {
      return;
    }
    setError('');
    setSuccess('');

    // ⚡ Optimistic Delete
    setSchoolData(prev => ({
      ...prev,
      teachers: (prev?.teachers || []).map(t => ({
        ...t,
        teacher_assignments: (t.teacher_assignments || []).filter(a => a.id !== assignmentId)
      }))
    }));

    try {
      await deleteAssignmentById(assignmentId);
      setSuccess('Assignment removed successfully!');
      fetchSchoolData(true);
    } catch (err) {
      setError(err.message || 'Failed to delete assignment');
      fetchSchoolData(false); // rollback on error
    }
  };

  // Metric totals calculations
  const totalClassesCount = schoolData?.classes?.length || 0;
  const totalTeachersCount = schoolData?.teachers?.length || 0;
  const totalAssignmentsCount = schoolData?.teachers?.reduce((sum, t) => sum + (t.teacher_assignments?.length || 0), 0) || 0;

  return (
    <div className="ct-reg-wrap">
      {error && (
        <div className="alert-banner alert-banner--error" style={{ marginBottom: 16 }}>
          <span className="alert-banner-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert-banner alert-banner--success" style={{ marginBottom: 16 }}>
          <span className="alert-banner-icon">✅</span>
          <span>{success}</span>
        </div>
      )}

      {/* 1. Persistent Top Selection Bar */}
      <div className="ct-section" style={{ marginBottom: 16 }}>
        <div className="ct-section-title">🏫 Select School & Academic Year</div>
        <div className="form-grid-2">
          <div className="form-field">
            <label className="form-label">Academic Year *</label>
            <select
              className="form-input"
              value={selectedAcademicYear}
              onChange={(e) => setSelectedAcademicYear(e.target.value)}
              required
            >
              <option value="">-- Select Academic Year --</option>
              {academicYears.map(year => (
                <option key={year.id} value={year.id}>{year.name}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">School *</label>
            <select
              className="form-input"
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
              required
            >
              <option value="">-- Select School --</option>
              {schools.map(school => (
                <option key={school.school_id} value={school.school_id}>
                  {school.school_name} ({school.school_id})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '12px 0' }}>
          Loading school data...
        </p>
      )}

      {selectedSchool && selectedAcademicYear && schoolData && (
        <>
          {/* ════════════════════════════════════════════════════
              SUB-TAB 1: OVERVIEW & RECORDS
          ════════════════════════════════════════════════════ */}
          {activeSubTab === 'overview' && (
            <div className="animate-fade-in">


              {/* Table Filter Bar */}
              <div className="ct-filter-bar">
                <span className="ct-filter-label">Filter View:</span>
                <button
                  type="button"
                  className={`ct-filter-chip ${tableFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setTableFilter('all')}
                >
                  All Records
                </button>
                <button
                  type="button"
                  className={`ct-filter-chip ${tableFilter === 'classes' ? 'active' : ''}`}
                  onClick={() => setTableFilter('classes')}
                >
                  Classes Only ({totalClassesCount})
                </button>
                <button
                  type="button"
                  className={`ct-filter-chip ${tableFilter === 'teachers' ? 'active' : ''}`}
                  onClick={() => setTableFilter('teachers')}
                >
                  Teachers Only ({totalTeachersCount})
                </button>
              </div>

              {/* Existing Classes Section */}
              {(tableFilter === 'all' || tableFilter === 'classes') && (
                <div className="ct-section">
                  <div className="ct-section-header">
                    <div className="ct-section-title" style={{ margin: 0, border: 'none' }}>
                      📚 Existing Classes ({totalClassesCount})
                    </div>
                    <button
                      type="button"
                      onClick={() => goSubTab('add-class')}
                      className="btn btn-primary btn-sm"
                    >
                      ➕ Add Class
                    </button>
                  </div>

                  {schoolData.classes && schoolData.classes.length > 0 ? (
                    <div className="ct-compact-table-outer">
                      <table className="ct-compact-table">
                        <thead>
                          <tr>
                            <th>Class</th>
                            <th>Section</th>
                            <th>Foundation</th>
                            <th>Program</th>
                            <th>Group</th>
                            <th className="text-center">Students</th>
                            <th className="text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schoolData.classes.map((cls, index) => (
                            <tr key={index}>
                              <td><b>{cls.class}</b></td>
                              <td>{cls.section}</td>
                              <td>{cls.foundation || '-'}</td>
                              <td>{cls.program || '-'}</td>
                              <td>{cls.group || '-'}</td>
                              <td className="text-center">{cls.num_students || 0}</td>
                              <td className="text-center">
                                <button
                                  type="button"
                                  className="btn-icon-delete"
                                  onClick={() => handleDeleteClass(cls.id, cls.class, cls.section)}
                                  style={{ fontSize: 11, padding: '3px 8px' }}
                                >
                                  🗑️ Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No classes found for this school.</p>
                  )}
                </div>
              )}

              {/* Existing Teachers Section */}
              {(tableFilter === 'all' || tableFilter === 'teachers') && (
                <div className="ct-section">
                  <div className="ct-section-header">
                    <div className="ct-section-title" style={{ margin: 0, border: 'none' }}>
                      👩‍🏫 Existing Teachers ({totalTeachersCount})
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => goSubTab('add-teacher')}
                        className="btn btn-primary btn-sm"
                      >
                        👩‍🏫 Add Teacher
                      </button>
                      <button
                        type="button"
                        onClick={() => goSubTab('assign-teacher')}
                        className="btn btn-outline btn-sm"
                      >
                        🔗 Assign Teacher
                      </button>
                    </div>
                  </div>

                  {schoolData.teachers && schoolData.teachers.length > 0 ? (
                    <div className="ct-compact-table-outer">
                      <table className="ct-compact-table">
                        <thead>
                          <tr>
                            <th>Teacher ID</th>
                            <th>Name</th>
                            <th>Contact</th>
                            <th>Email</th>
                            <th>Subject Allotments</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schoolData.teachers.map((teacher, index) => (
                            <tr key={index}>
                              <td><span className="school-id-badge">{teacher.teacher_id}</span></td>
                              <td><b>{teacher.name}</b></td>
                              <td>{teacher.contact || '-'}</td>
                              <td>{teacher.email || '-'}</td>
                              <td>
                                {teacher.teacher_assignments && teacher.teacher_assignments.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {teacher.teacher_assignments.map((asgn, idx) => (
                                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                        <span className="assignment-tag">
                                          {asgn.class} · {asgn.section} · {asgn.subject}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteAssignment(asgn.id, asgn.subject, asgn.class, asgn.section)}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                            fontSize: 11,
                                            padding: 0
                                          }}
                                          title="Remove Allotment"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No teachers found for this school.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              SUB-TAB 2: ADD CLASS FORM
          ════════════════════════════════════════════════════ */}
          {activeSubTab === 'addClass' && (
            <div className="animate-fade-in ct-section">
              <div className="ct-form-page-header">
                <div className="ct-section-title" style={{ margin: 0, border: 'none' }}>➕ Add New Class</div>
                <button
                  type="button"
                  onClick={() => goSubTab('overview')}
                  className="btn btn-outline btn-sm"
                >
                  ← Back to Overview
                </button>
              </div>

              <form onSubmit={handleAddClass}>
                <div className="form-grid-2">
                  <div className="form-field">
                    <label className="form-label">Class *</label>
                    <select
                      className="form-input"
                      name="class"
                      value={newClass.class}
                      onChange={handleClassChange}
                      required
                    >
                      <option value="">-- Select Class --</option>
                      {GRADE_OPTIONS.map(grade => (
                        <option key={grade} value={grade}>{grade}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="form-label">Section *</label>
                    <select
                      className="form-input"
                      name="section"
                      value={newClass.section}
                      onChange={handleClassChange}
                      required
                    >
                      <option value="">-- Select Section --</option>
                      {SECTION_OPTIONS.map(sec => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="form-label">Foundation</label>
                    <select
                      className="form-input"
                      name="foundation"
                      value={newClass.foundation}
                      onChange={handleClassChange}
                    >
                      <option value="">-- Select Foundation --</option>
                      {FOUNDATION_OPTIONS.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="form-label">Program</label>
                    <select
                      className="form-input"
                      name="program"
                      value={newClass.program}
                      onChange={handleClassChange}
                    >
                      <option value="">-- Select Program --</option>
                      {PROGRAM_OPTIONS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="form-label">Group</label>
                    <select
                      className="form-input"
                      name="group"
                      value={newClass.group}
                      onChange={handleClassChange}
                    >
                      <option value="">-- Select Group --</option>
                      {GROUP_OPTIONS.map(gp => (
                        <option key={gp} value={gp}>{gp}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="form-label">Number of Students</label>
                    <input
                      type="number"
                      className="form-input"
                      name="numStudents"
                      value={newClass.numStudents}
                      onChange={handleClassChange}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>

                <div className="form-actions" style={{ marginTop: 20 }}>
                  <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                    {actionLoading ? 'Adding...' : '➕ Add Class'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => goSubTab('overview')}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              SUB-TAB 3: ADD TEACHER FORM
          ════════════════════════════════════════════════════ */}
          {activeSubTab === 'addTeacher' && (
            <div className="animate-fade-in ct-section">
              <div className="ct-form-page-header">
                <div className="ct-section-title" style={{ margin: 0, border: 'none' }}>👩‍🏫 Add New Teacher</div>
                <button
                  type="button"
                  onClick={() => goSubTab('overview')}
                  className="btn btn-outline btn-sm"
                >
                  ← Back to Overview
                </button>
              </div>

              <form onSubmit={handleAddTeacher}>
                <div className="form-grid-2">
                  <div className="form-field">
                    <label className="form-label">Teacher ID (Auto-generated)</label>
                    <input
                      type="text"
                      className="form-input"
                      name="teacherId"
                      value={newTeacher.teacherId}
                      readOnly
                      style={{ backgroundColor: '#f1f5f9', fontWeight: 700 }}
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      name="name"
                      value={newTeacher.name}
                      onChange={handleTeacherChange}
                      placeholder="Full Teacher Name"
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">Contact Number</label>
                    <input
                      type="text"
                      className="form-input"
                      name="contact"
                      value={newTeacher.contact}
                      onChange={handleTeacherChange}
                      placeholder="e.g. +91 9876543210"
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      name="email"
                      value={newTeacher.email}
                      onChange={handleTeacherChange}
                      placeholder="teacher@school.com"
                    />
                  </div>
                </div>

                <div className="form-actions" style={{ marginTop: 20 }}>
                  <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                    {actionLoading ? 'Adding...' : '➕ Add Teacher'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => goSubTab('overview')}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              SUB-TAB 4: ASSIGN TEACHER FORM
          ════════════════════════════════════════════════════ */}
          {activeSubTab === 'assignTeacher' && (
            <div className="animate-fade-in ct-section">
              <div className="ct-form-page-header">
                <div className="ct-section-title" style={{ margin: 0, border: 'none' }}>🔗 Assign Teacher to Class</div>
                <button
                  type="button"
                  onClick={() => goSubTab('overview')}
                  className="btn btn-outline btn-sm"
                >
                  ← Back to Overview
                </button>
              </div>

              <form onSubmit={handleAssignTeacher}>
                <div className="form-grid-2">
                  <div className="form-field">
                    <label className="form-label">Select Teacher *</label>
                    <select
                      className="form-input"
                      name="teacherId"
                      value={assignment.teacherId}
                      onChange={handleAssignmentChange}
                      required
                    >
                      <option value="">-- Select Teacher --</option>
                      {schoolData.teachers && schoolData.teachers.map(t => (
                        <option key={t.id} value={t.teacher_id}>
                          {t.name} ({t.teacher_id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="form-label">Select Class *</label>
                    <select
                      className="form-input"
                      name="class"
                      value={assignment.class}
                      onChange={handleAssignmentChange}
                      required
                    >
                      <option value="">-- Select Class --</option>
                      {schoolData.classes && schoolData.classes.map(cls => (
                        <option key={`${cls.class}-${cls.section}`} value={cls.class}>
                          {cls.class}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="form-label">Select Section *</label>
                    <select
                      className="form-input"
                      name="section"
                      value={assignment.section}
                      onChange={handleAssignmentChange}
                      required
                    >
                      <option value="">-- Select Section --</option>
                      {schoolData.classes && schoolData.classes.map(cls => (
                        <option key={`${cls.class}-${cls.section}`} value={cls.section}>
                          {cls.section}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="form-label">Select Subject *</label>
                    <select
                      className="form-input"
                      name="subject"
                      value={assignment.subject}
                      onChange={handleAssignmentChange}
                      required
                    >
                      <option value="">-- Select Subject --</option>
                      {getSubjectOptions(selectedClassFoundation).map(subject => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-actions" style={{ marginTop: 20 }}>
                  <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                    {actionLoading ? 'Assigning...' : '🔗 Assign Teacher'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => goSubTab('overview')}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}
