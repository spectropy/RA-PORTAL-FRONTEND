import React, { useState, useEffect } from 'react';
import { getSchoolById, createClass, createTeacher, assignTeacherToClass, getAcademicYears, updateClassById, deleteClassById, updateAssignmentById,deleteAssignmentById  } from '../api';

// ===== Constants =====
const GRADE_OPTIONS = Array.from({ length: 10 }, (_, i) => `GRADE-${i + 1}`);
const SECTION_OPTIONS = "ABCDEF".split("");
const FOUNDATION_OPTIONS = ["IIT-MED", "IIT", "MED", "FF"];
const PROGRAM_OPTIONS = ["CAT", "MAE", "PIO"];
const GROUP_OPTIONS = ["PCM", "PCB", "PCMB"];

const forcedGroupForFoundation = (foundation) => {
  if (foundation === "IIT-MED") return "PCMB";
  if (foundation === "IIT") return "PCM";
  if (foundation === "MED") return "PCB";
  return "";
};

// ✅ Dynamic subject options based on foundation
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
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [schoolData, setSchoolData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  // ✅ Track foundation of selected class for subject dropdown
  const [selectedClassFoundation, setSelectedClassFoundation] = useState('');

  useEffect(() => {
    // Fetch academic years
    const fetchAcademicYearsData = async () => {
      try {
        const years = await getAcademicYears();
        setAcademicYears(years);
        
        // Set default to current academic year
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        // If month is April or later, use current year as start year
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

  // ✅ Auto-generate teacher ID based on existing teachers
  useEffect(() => {
    if (selectedSchool && schoolData?.teachers?.length > 0) {
      // Extract numeric suffixes from existing teacher IDs
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
      // First teacher for this school
      setNewTeacher(prev => ({ ...prev, teacherId: `${selectedSchool}01` }));
    }
  }, [selectedSchool, schoolData?.teachers]);

  const fetchSchoolData = async () => {
    if (!selectedSchool) return;
    
    setLoading(true);
    setError('');
    try {
      const data = await getSchoolById(selectedSchool);
      console.log('School data:', data); 
      setSchoolData(data);
    } catch (err) {
      setError(err.message || 'Failed to load school data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!selectedSchool) {
      setError('Please select a school first');
      return;
    }

    setLoading(true);
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

      await createClass(payload);
      setSuccess('Class added successfully!');
      
      // Reset form
      setNewClass({
        class: '',
        foundation: '',
        program: '',
        group: '',
        section: '',
        numStudents: ''
      });
      
      // Refresh school data
      await fetchSchoolData();
    } catch (err) {
      setError(err.message || 'Failed to add class');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!selectedSchool) {
      setError('Please select a school first');
      return;
    }

    setLoading(true);
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

      await createTeacher(payload);
      setSuccess('Teacher added successfully!');
      
      // Reset form
      setNewTeacher({
        teacherId: '',
        name: '',
        contact: '',
        email: ''
      });
      
      // Refresh school data
      await fetchSchoolData();
    } catch (err) {
      setError(err.message || 'Failed to add teacher');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTeacher = async (e) => {
    e.preventDefault();
    if (!selectedSchool) {
      setError('Please select a school first');
      return;
    }

    setLoading(true);
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

      await assignTeacherToClass(payload);
      setSuccess('Teacher assigned to class successfully!');
      
      // Reset form
      setAssignment({
        teacherId: '',
        class: '',
        section: '',
        subject: ''
      });
      
      // Refresh school data
      await fetchSchoolData();
    } catch (err) {
      setError(err.message || 'Failed to assign teacher');
    } finally {
      setLoading(false);
    }
  };

  const handleClassChange = (e) => {
    const { name, value } = e.target;
    setNewClass(prev => {
      const updated = { ...prev, [name]: value };

      // Auto-set group if foundation is selected
      if (name === 'foundation') {
        const forced = forcedGroupForFoundation(value);
        if (forced) {
          updated.group = forced;
        }
      }

      return updated;
    });
  };

  const handleTeacherChange = (e) => {
    setNewTeacher({
      ...newTeacher,
      [e.target.name]: e.target.value
    });
  };

  // ✅ Updated to track class foundation for subject dropdown
  const handleAssignmentChange = (e) => {
    const { name, value } = e.target;
    setAssignment(prev => ({ ...prev, [name]: value }));

    // If class is changed, find its foundation
    if (name === 'class' && schoolData?.classes) {
      const selectedClass = schoolData.classes.find(cls => cls.class === value);
      setSelectedClassFoundation(selectedClass?.foundation || '');
    }
  };

  const handleUpdateClass = async (classId, updatedData) => {
  setLoading(true);
  setError('');
  setSuccess('');

  try {
    await updateClassById(classId, {
      class: updatedData.class,
      section: updatedData.section,
      foundation: updatedData.foundation,
      program: updatedData.program,
      group: updatedData.group,
      num_students: parseInt(updatedData.numStudents) || 0
    });

    setSuccess('Class updated successfully!');
    await fetchSchoolData(); // Refresh data
  } catch (err) {
    setError(err.message || 'Failed to update class');
  } finally {
    setLoading(false);
  }
};

const handleDeleteClass = async (classId, className, section) => {
  if (!confirm(`Are you sure you want to delete class ${className}-${section}? All subject assignments will be removed.`)) {
    return;
  }

  setLoading(true);
  setError('');
  setSuccess('');

  try {
    await deleteClassById(classId);
    setSuccess('Class deleted successfully!');
    await fetchSchoolData();
  } catch (err) {
    setError(err.message || 'Failed to delete class');
  } finally {
    setLoading(false);
  }
};

const handleUpdateAssignment = async (assignmentId, updatedData) => {
  setLoading(true);
  setError('');
  setSuccess('');

  try {
    await updateAssignmentById(assignmentId, {
      class: updatedData.class,
      section: updatedData.section,
      subject: updatedData.subject
    });

    setSuccess('Assignment updated successfully!');
    await fetchSchoolData();
  } catch (err) {
    setError(err.message || 'Failed to update assignment');
  } finally {
    setLoading(false);
  }
};

const handleDeleteAssignment = async (assignmentId, subject, className, section) => {
  if (!confirm(`Remove assignment: ${subject} for ${className}-${section}?`)) {
    return;
  }

  setLoading(true);
  setError('');
  setSuccess('');

  try {
    await deleteAssignmentById(assignmentId);
    setSuccess('Assignment removed successfully!');
    await fetchSchoolData();
  } catch (err) {
    setError(err.message || 'Failed to delete assignment');
  } finally {
    setLoading(false);
  }
};

  return (
    <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h3 style={{ margin: '0 0 20px 0', color: '#1e90ff' }}>👩‍🏫 Class/Teacher Registration</h3>
      
      {error && (
        <div style={{ 
          padding: '10px', 
          background: '#fff5f5', 
          border: '1px solid #e3342f', 
          color: '#e3342f', 
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          {error}
        </div>
      )}
      
      {success && (
        <div style={{ 
          padding: '10px', 
          background: '#f3faf7', 
          border: '1px solid #38c172', 
          color: '#38c172', 
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          {success}
        </div>
      )}

      {/* Academic Year and School Selection */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
            Select Academic Year *
          </label>
          <select
            value={selectedAcademicYear}
            onChange={(e) => setSelectedAcademicYear(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
            required
          >
            <option value="">-- Select Academic Year --</option>
            {academicYears.map(year => (
              <option key={year.id} value={year.id}>{year.name}</option>
            ))}
          </select>
        </div>
        
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
            Select School *
          </label>
          <select
            value={selectedSchool}
            onChange={(e) => setSelectedSchool(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
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

      {loading && <p>Loading school data...</p>}

      {selectedSchool && selectedAcademicYear && schoolData && (
        <>
          {/* Display existing classes */}
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
              Existing Classes
            </h4>
            {schoolData.classes && schoolData.classes.length > 0 ? (
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #eee' }}>Class</th>
                      <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #eee' }}>Section</th>
                      <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #eee' }}>Foundation</th>
                      <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #eee' }}>Program</th>
                      <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #eee' }}>Group</th>
                      <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #eee' }}>Students</th>
                      <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #eee' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schoolData.classes.map((cls, index) => (
                      <tr key={index}>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{cls.class}</td>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{cls.section}</td>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{cls.foundation || '-'}</td>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{cls.program || '-'}</td>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{cls.group || '-'}</td>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{cls.num_students || 0}</td>
                        <td style={{ padding: '8px', border: '1px solid #eee', textAlign: 'center' }}>
                          <button
                            onClick={() => handleUpdateClass(cls.id, {
                             class: cls.class,
                             section: cls.section,
                             foundation: cls.foundation,
                             program: cls.program,
                             group: cls.group,
                             numStudents: cls.num_students
                             })}
                            style={{
                              background: '#0e87eaff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              marginRight: '5px'
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClass(cls.id, cls.class, cls.section)}
                            style={{
                              background: '#ef7a3cff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No classes found for this school.</p>
            )}
          </div>

          {/* Display existing teachers */}
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
              Existing Teachers
            </h4>
            {schoolData.teachers && schoolData.teachers.length > 0 ? (
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #eee' }}>Teacher ID</th>
                      <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #eee' }}>Name</th>
                      <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #eee' }}>Contact</th>
                      <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #eee' }}>Email</th>
                      <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #eee' }}>Subjects Allotments</th>
                      <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #eee' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schoolData.teachers.map((teacher, index) => (
                      <tr key={index}>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{teacher.teacher_id}</td>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{teacher.name}</td>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{teacher.contact || '-'}</td>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{teacher.email || '-'}</td>
                        <td style={{ padding: '8px', border: '1px solid #eee', verticalAlign: 'top' }}>
                          {teacher.teacher_assignments && teacher.teacher_assignments.length > 0 ? (
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {teacher.teacher_assignments.map((assignment, idx) => (
                              <span
                               key={idx}
                                style={{
                                display: 'inline-block',
                                background: '#78adf1ff',
                                color: 'white',
                                padding: '2px 4px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '500',
                                whiteSpace: 'nowrap'
                               }}
                               >
                              {assignment.class} • {assignment.section} • {assignment.subject}
                             </span>
                             ))}
                          </div>
                        ) : (
                       <span>-</span>
                       )}
                        </td>
                        <td style={{ padding: '8px', border: '1px solid #eee', textAlign: 'center' }}>
                          <button
                            onClick={() => handleUpdateAssignment(assignment.id, {
                              class: assignment.class,
                              section: assignment.section,
                              subject: assignment.subject
                            })}
                            style={{
                              background: '#089ff1ff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              marginRight: '5px'
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteAssignment(assignment.id,assignment.subject,assignment.class,assignment.section)}
                            style={{
                              background: '#f88155ff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No teachers found for this school.</p>
            )}
          </div>

          {/* Add New Class Form */}
          <div style={{ marginBottom: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 15px 0' }}>Add New Class</h4>
            <form onSubmit={handleAddClass}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    Class *
                  </label>
                  <select
                    name="class"
                    value={newClass.class}
                    onChange={handleClassChange}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                    required
                  >
                    <option value="">-- Select Class --</option>
                    {GRADE_OPTIONS.map(grade => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    Section *
                  </label>
                  <select
                    name="section"
                    value={newClass.section}
                    onChange={handleClassChange}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                    required
                  >
                    <option value="">-- Select Section --</option>
                    {SECTION_OPTIONS.map(sec => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    Foundation
                  </label>
                  <select
                    name="foundation"
                    value={newClass.foundation}
                    onChange={handleClassChange}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                  >
                    <option value="">-- Select Foundation --</option>
                    {FOUNDATION_OPTIONS.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    Program
                  </label>
                  <select
                    name="program"
                    value={newClass.program}
                    onChange={handleClassChange}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                  >
                    <option value="">-- Select Program --</option>
                    {PROGRAM_OPTIONS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    Group
                  </label>
                  <select
                    name="group"
                    value={newClass.group}
                    onChange={handleClassChange}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                  >
                    <option value="">-- Select Group --</option>
                    {GROUP_OPTIONS.map(gp => (
                      <option key={gp} value={gp}>{gp}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    Number of Students
                  </label>
                  <input
                    type="number"
                    name="numStudents"
                    value={newClass.numStudents}
                    onChange={handleClassChange}
                    placeholder="0"
                    min="0"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                  />
                </div>
              </div>
              
              <button
                type="submit"
                style={{
                  marginTop: '15px',
                  padding: '10px 20px',
                  background: '#1e90ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add Class'}
              </button>
            </form>
          </div>

          {/* Add New Teacher Form */}
          <div style={{ marginBottom: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 15px 0' }}>Add New Teacher</h4>
            <form onSubmit={handleAddTeacher}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    Teacher ID *
                  </label>
                  <input
                    type="text"
                    name="teacherId"
                    value={newTeacher.teacherId}
                    readOnly // ✅ Auto-generated, so make it read-only
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      backgroundColor: '#f0f0f0'
                    }}
                    required
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={newTeacher.name}
                    onChange={handleTeacherChange}
                    placeholder="Teacher Name"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                    required
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    Contact
                  </label>
                  <input
                    type="text"
                    name="contact"
                    value={newTeacher.contact}
                    onChange={handleTeacherChange}
                    placeholder="Phone number"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={newTeacher.email}
                    onChange={handleTeacherChange}
                    placeholder="Email address"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                  />
                </div>
              </div>
              
              <button
                type="submit"
                style={{
                  marginTop: '15px',
                  padding: '10px 20px',
                  background: '#1e90ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add Teacher'}
              </button>
            </form>
          </div>

          {/* Assign Teacher to Class Form */}
          <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 15px 0' }}>Assign Teacher to Class</h4>
            <form onSubmit={handleAssignTeacher}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    Teacher ID *
                  </label>
                  <select
                    name="teacherId"
                    value={assignment.teacherId}
                    onChange={handleAssignmentChange}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                    required
                  >
                    <option value="">-- Select Teacher --</option>
                    {schoolData.teachers && schoolData.teachers.map(teacher => (
                      <option key={teacher.id} value={teacher.teacher_id}>
                        {teacher.name} ({teacher.teacher_id})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    Class *
                  </label>
                  <select
                    name="class"
                    value={assignment.class}
                    onChange={handleAssignmentChange}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
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
                
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    Section *
                  </label>
                  <select
                    name="section"
                    value={assignment.section}
                    onChange={handleAssignmentChange}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
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
                
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    Subject *
                  </label>
                  <select
                    name="subject"
                    value={assignment.subject}
                    onChange={handleAssignmentChange}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                    required
                  >
                    <option value="">-- Select Subject --</option>
                    {getSubjectOptions(selectedClassFoundation).map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <button
                type="submit"
                style={{
                  marginTop: '15px',
                  padding: '10px 20px',
                  background: '#1e90ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                disabled={loading}
              >
                {loading ? 'Assigning...' : 'Assign Teacher'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}