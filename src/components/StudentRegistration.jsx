import React, { useState, useEffect, useRef } from 'react';
import {
  deleteStudent,
  deleteStudentsByClassSection,
  getAcademicYears,
  getSchoolById,
  getStudentsByClassSection,
  uploadStudents
} from '../api';

export default function StudentRegistration({ schools = [] }) {
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [schoolData, setSchoolData] = useState(null);
  const [selectedClassSection, setSelectedClassSection] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 👇 NEW: State for students table
  const [students, setStudents] = useState([]);
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [deletingStudents, setDeletingStudents] = useState(false);
  const studentRequestId = useRef(0);

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

  // 👇 NEW: Fetch students when class-section changes
  useEffect(() => {
    if (selectedSchool && selectedClassSection) {
      fetchStudents();
    }
  }, [selectedSchool, selectedClassSection]);

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

  // 👇 NEW: Fetch students for selected school + class-section
  const fetchStudents = async () => {
    if (!selectedSchool || !selectedClassSection) return;

    const requestId = ++studentRequestId.current;
    const schoolId = selectedSchool;
    const classSection = selectedClassSection;
    setFetchingStudents(true);
    try {
      // Split class-section to get class and section
      const lastDashIndex = classSection.lastIndexOf('-');
      if (lastDashIndex <= 0) return;

      const classValue = classSection.substring(0, lastDashIndex).trim();
      const sectionValue = classSection.substring(lastDashIndex + 1).trim();

      const fetchedStudents = await getStudentsByClassSection(
        schoolId,
        classValue,
        sectionValue
      );
      if (requestId === studentRequestId.current) {
        setStudents(fetchedStudents || []);
      }
    } catch (err) {
      if (requestId === studentRequestId.current) {
        console.error('Error fetching students:', err);
        setError('Failed to load student list');
      }
    } finally {
      if (requestId === studentRequestId.current) {
        setFetchingStudents(false);
      }
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const getSelectedClassSection = () => {
    const lastDashIndex = selectedClassSection.lastIndexOf('-');
    if (lastDashIndex <= 0) return null;
    return {
      classValue: selectedClassSection.substring(0, lastDashIndex).trim(),
      sectionValue: selectedClassSection.substring(lastDashIndex + 1).trim()
    };
  };

  const handleDeleteStudent = async student => {
    if (!student.id || !window.confirm(`Delete ${student.name || student.student_id}?`)) return;
    setDeletingStudents(true);
    setError('');
    setSuccess('');
    try {
      await deleteStudent(selectedSchool, student.id);
      setSuccess('Student deleted successfully.');
      await fetchStudents();
    } catch (err) {
      setError(err.message || 'Failed to delete student');
    } finally {
      setDeletingStudents(false);
    }
  };

  const handleDeleteClassSection = async () => {
    const context = getSelectedClassSection();
    if (!context || !students.length) return;
    const confirmed = window.confirm(
      `Delete all ${students.length} students in ${selectedClassSection}? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingStudents(true);
    setError('');
    setSuccess('');
    try {
      const result = await deleteStudentsByClassSection(
        selectedSchool,
        context.classValue,
        context.sectionValue
      );
      setStudents([]);
      setSuccess(result.message || 'Students deleted successfully.');
    } catch (err) {
      setError(err.message || 'Failed to delete students');
    } finally {
      setDeletingStudents(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedSchool) {
      setError('Please select a school first');
      return;
    }
    
    if (!selectedClassSection) {
      setError('Please select a class-section');
      return;
    }
    
    if (!file) {
      setError('Please select an Excel file to upload');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('class_section', selectedClassSection);

      await uploadStudents(selectedSchool, formData);
      setSuccess('Students uploaded successfully!');
      
      // 👇 NEW: Refresh student table after successful upload
      await fetchStudents();

      // Reset file input
      setFile(null);
      document.getElementById('file-upload').value = '';
    } catch (err) {
      setError(err.message || 'Failed to upload students');
    } finally {
      setLoading(false);
    }
  };

  const downloadSample = () => {
    const sampleData = [
      ['ROLLNO', 'CLASS', 'NAME', 'PHONENO', 'EMAILID'],
      ['116001', 'Grade - 6', 'A GAYATHRI', '7981900487', 'parent1@email.com'],
      ['116002', 'Grade - 6', 'A VASUDEVA REDDY', '6281571454', 'parent2@email.com']
    ];

    const csvContent = sampleData.map(row => `"${row.join('","')}"`).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'student_upload_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: 16, fontFamily: "Arial, sans-serif" }}>
      <h3 style={{ margin: '0 0 20px 0', color: '#1e90ff' }}>🎓 Student Registration</h3>
      
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
            onChange={(e) => {
              studentRequestId.current += 1;
              setSelectedSchool(e.target.value);
              setSelectedClassSection('');
              setStudents([]);
              setFetchingStudents(false);
              setError('');
              setSuccess('');
            }}
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
          {/* Class-Section Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
              Select Class-Section *
            </label>
            <select
              value={selectedClassSection}
              onChange={(e) => {
                studentRequestId.current += 1;
                setSelectedClassSection(e.target.value);
                setStudents([]);
                setFetchingStudents(false);
                setError('');
                setSuccess('');
              }}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              required
            >
              <option value="">-- Select Class-Section --</option>
              {schoolData.classes && schoolData.classes.map(cls => (
                <option key={`${cls.class}-${cls.section}`} value={`${cls.class}-${cls.section}`}>
                  Class {cls.class} - Section {cls.section}
                </option>
              ))}
            </select>
          </div>

          {/* File Upload Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>
                Upload Excel File *
              </label>
              <div style={{ 
                border: '2px dashed #1e90ff', 
                borderRadius: '8px', 
                padding: '20px', 
                textAlign: 'center',
                cursor: 'pointer'
              }}>
                <input
                  type="file"
                  id="file-upload"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  required
                />
                <label 
                  htmlFor="file-upload"
                  style={{ 
                    display: 'block',
                    cursor: 'pointer',
                    color: '#1e90ff',
                    textDecoration: 'underline'
                  }}
                >
                  {file ? file.name : 'Click to select Excel file or drag and drop'}
                </label>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                  Supported formats: .csv, .xlsx, .xls
                </p>
              </div>
            </div>

            {/* Download Sample Button */}
            <div style={{ marginBottom: '20px' }}>
              <button
                type="button"
                onClick={downloadSample}
                style={{
                  padding: '8px 16px',
                  background: '#f8f9fa',
                  color: '#1e90ff',
                  border: '1px solid #1e90ff',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: '10px'
                }}
              >
                📥 Download Sample Template
              </button>
              <span style={{ fontSize: '12px', color: '#666' }}>
                Use this template to format your Excel file correctly
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                background: '#1e90ff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginBottom: '30px' // 👈 Add space before table
              }}
              disabled={loading}
            >
              {loading ? 'Uploading...' : 'Upload Students'}
            </button>
          </form>

          {/* 👇 NEW: Students Table */}
          {(selectedClassSection || students.length > 0) && (
            <div style={{ marginTop: '30px' }}>
              <h4 style={{ color: '#1e90ff', marginBottom: '15px' }}>
                👥 Students in {selectedClassSection || 'Selected Class'}
              </h4>
              {students.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteClassSection}
                  disabled={deletingStudents}
                  style={{
                    padding: '8px 12px',
                    marginBottom: '12px',
                    background: '#dc3545',
                    color: 'white',
                    border: 0,
                    borderRadius: '4px',
                    cursor: deletingStudents ? 'not-allowed' : 'pointer'
                  }}
                >
                  {deletingStudents ? 'Deleting...' : 'Delete All Students in Class-Section'}
                </button>
              )}
              
              {fetchingStudents ? (
                <p>Loading students...</p>
              ) : students.length === 0 ? (
                <p style={{ fontStyle: 'italic', color: '#666' }}>
                  No students found. Upload a file to get started.
                </p>
              ) : (
                <div style={{ 
                  overflowX: 'auto', 
                  border: '1px solid #ddd', 
                  borderRadius: '8px'
                }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    fontSize: '14px',
                    minWidth: '600px'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Student Id</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Student Name</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Phone</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Email</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, index) => (
                        <tr key={student.id || student.student_id} style={{
                          backgroundColor: index % 2 === 0 ? '#fafafa' : 'white',
                          borderBottom: '1px solid #eee'
                        }}>
                          <td style={{ padding: '12px' }}>{student.student_id || student.roll_no}</td>
                          <td style={{ padding: '12px' }}>{student.name}</td>
                          <td style={{ padding: '12px' }}>{student.parent_phone || '-'}</td>
                          <td style={{ padding: '12px' }}>{student.parent_email || '-'}</td>
                          <td style={{ padding: '12px' }}>
                            <button
                              type="button"
                              onClick={() => handleDeleteStudent(student)}
                              disabled={deletingStudents}
                              style={{
                                padding: '6px 10px',
                                background: '#dc3545',
                                color: 'white',
                                border: 0,
                                borderRadius: '4px',
                                cursor: deletingStudents ? 'not-allowed' : 'pointer'
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
              )}
            </div>
          )}

          {/* Instructions */}
          <div style={{ 
            marginTop: '30px', 
            padding: '15px', 
            background: '#f8f9fa', 
            border: '1px solid #e9ecef', 
            borderRadius: '8px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#1e90ff' }}>📋 Upload Instructions</h4>
            <ul style={{ margin: '0', padding: '0 0 0 20px', fontSize: '14px' }}>
              <li>Download and use the sample template to ensure correct column names</li>
              <li><strong>Important:</strong> Student's class and section are set by your dropdown selection above, NOT the 'CLASS' column in the file</li>
              <li>Save file as .csv, .xlsx, or .xls</li>
              <li>Max file size: 10MB</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
