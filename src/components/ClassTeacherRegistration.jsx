import React, { useState, useEffect } from 'react';
import { getSchoolById, createClass, createTeacher, assignTeacherToClass, getAcademicYears } from '../api';

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

  const fetchSchoolData = async () => {
    if (!selectedSchool) return;
    
    setLoading(true);
    setError('');
    try {
      const data = await getSchoolById(selectedSchool);
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
    setNewClass({
      ...newClass,
      [e.target.name]: e.target.value
    });
  };

  const handleTeacherChange = (e) => {
    setNewTeacher({
      ...newTeacher,
      [e.target.name]: e.target.value
    });
  };

  const handleAssignmentChange = (e) => {
    setAssignment({
      ...assignment,
      [e.target.name]: e.target.value
    });
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
                      <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #eee' }}>Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schoolData.classes.map((cls, index) => (
                      <tr key={index}>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{cls.class}</td>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{cls.section}</td>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{cls.foundation || '-'}</td>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{cls.program || '-'}</td>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{cls.num_students || 0}</td>
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
                    </tr>
                  </thead>
                  <tbody>
                    {schoolData.teachers.map((teacher, index) => (
                      <tr key={index}>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{teacher.teacherId}</td>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{teacher.name}</td>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{teacher.contact || '-'}</td>
                        <td style={{ padding: '8px', border: '1px solid #eee' }}>{teacher.email || '-'}</td>
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
                  <input
                    type="text"
                    name="class"
                    value={newClass.class}
                    onChange={handleClassChange}
                    placeholder="e.g., 6, 7, 8"
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
                    Section *
                  </label>
                  <input
                    type="text"
                    name="section"
                    value={newClass.section}
                    onChange={handleClassChange}
                    placeholder="e.g., A, B, C"
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
                    Foundation
                  </label>
                  <input
                    type="text"
                    name="foundation"
                    value={newClass.foundation}
                    onChange={handleClassChange}
                    placeholder="e.g., CBSE, ICSE"
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
                    Program
                  </label>
                  <input
                    type="text"
                    name="program"
                    value={newClass.program}
                    onChange={handleClassChange}
                    placeholder="e.g., Regular, Advanced"
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
                    Group
                  </label>
                  <input
                    type="text"
                    name="group"
                    value={newClass.group}
                    onChange={handleClassChange}
                    placeholder="e.g., Science, Arts"
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
                    Number of Students
                  </label>
                  <input
                    type="number"
                    name="numStudents"
                    value={newClass.numStudents}
                    onChange={handleClassChange}
                    placeholder="0"
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
                    onChange={handleTeacherChange}
                    placeholder="Teacher ID"
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
                      <option key={teacher.teacherId} value={teacher.teacherId}>
                        {teacher.name} ({teacher.teacherId})
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
                  <input
                    type="text"
                    name="subject"
                    value={assignment.subject}
                    onChange={handleAssignmentChange}
                    placeholder="Subject name"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                    required
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
                {loading ? 'Assigning...' : 'Assign Teacher'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}