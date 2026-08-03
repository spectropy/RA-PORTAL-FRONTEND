import React, { useState, useEffect } from 'react';
import { getSchoolById, uploadStudents, getAcademicYears } from '../api';

// 👇 NEW: Import getStudentsByClassSection (you'll need to create this API function)
import { getStudentsByClassSection } from '../api';
import { deleteStudent, deleteStudentsByClassSection } from '../api';

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
  const [deletingStudentId, setDeletingStudentId] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);

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

  // 👇 Fetch students for selected school + class-section
  const fetchStudents = async () => {
    if (!selectedSchool || !selectedClassSection) return;

    setFetchingStudents(true);
    setError('');
    try {
      // Split class-section to get class and section
      const lastDashIndex = selectedClassSection.lastIndexOf('-');
      if (lastDashIndex <= 0) return;

      const classValue = selectedClassSection.substring(0, lastDashIndex).trim();
      const sectionValue = selectedClassSection.substring(lastDashIndex + 1).trim();

      const fetchedStudents = await getStudentsByClassSection(
        selectedSchool,
        classValue,
        sectionValue
      );
      setStudents(fetchedStudents || []);
    } catch (err) {
      console.error('Error fetching students:', err);
      setError(err.message || 'Failed to load student list');
    } finally {
      setFetchingStudents(false);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const getSelectedClassSectionParts = () => {
    const lastDashIndex = selectedClassSection.lastIndexOf('-');
    if (lastDashIndex <= 0 || lastDashIndex === selectedClassSection.length - 1) {
      return null;
    }

    return {
      classValue: selectedClassSection.substring(0, lastDashIndex).trim(),
      sectionValue: selectedClassSection.substring(lastDashIndex + 1).trim()
    };
  };

  const handleDeleteStudent = async (student) => {
    if (!student.id || deletingStudentId || deletingAll) return;

    const visibleId = student.student_id || student.roll_no || 'Unknown ID';
    const confirmed = window.confirm(
      `Delete ${student.name} (${visibleId})? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingStudentId(student.id);
    setError('');
    setSuccess('');

    try {
      await deleteStudent(selectedSchool, student.id);
      setStudents(current => current.filter(item => item.id !== student.id));
      setSuccess(`Student ${visibleId} deleted successfully.`);
    } catch (err) {
      setError(err.message || 'Failed to delete student');
    } finally {
      setDeletingStudentId(null);
    }
  };

  const handleDeleteAllStudents = async () => {
    if (students.length === 0 || deletingStudentId || deletingAll) return;

    const parts = getSelectedClassSectionParts();
    if (!parts) {
      setError('Please select a valid class-section');
      return;
    }

    const confirmation = window.prompt(
      `Delete all ${students.length} students from ${selectedClassSection}? ` +
      'This action cannot be undone. Type DELETE ALL to continue.'
    );
    if (confirmation !== 'DELETE ALL') return;

    setDeletingAll(true);
    setError('');
    setSuccess('');

    try {
      const result = await deleteStudentsByClassSection(
        selectedSchool,
        parts.classValue,
        parts.sectionValue
      );
      setStudents([]);
      setSuccess(
        `${result.deletedCount} student${result.deletedCount === 1 ? '' : 's'} deleted from ${selectedClassSection}.`
      );
    } catch (err) {
      setError(err.message || 'Failed to delete students');
    } finally {
      setDeletingAll(false);
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
      const lastDashIndex = selectedClassSection.lastIndexOf('-');
      const classValue = lastDashIndex > 0 ? selectedClassSection.substring(0, lastDashIndex).trim() : selectedClassSection;
      const sectionValue = lastDashIndex > 0 ? selectedClassSection.substring(lastDashIndex + 1).trim() : '';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('class_section', selectedClassSection);
      formData.append('class', classValue);
      formData.append('section', sectionValue);

      await uploadStudents(selectedSchool, formData);
      setSuccess('Students uploaded successfully!');
      
      // Refresh student table after successful upload
      await fetchStudents();

      // Reset file input
      setFile(null);
      const fileInput = document.getElementById('file-upload');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setError(err.message || 'Failed to upload students');
    } finally {
      setLoading(false);
    }
  };

  const downloadSample = () => {
    const activeClass = selectedClassSection || 'GRADE-1-A';
    const sampleData = [
      ['Student ID', 'First Name', 'Last Name', 'Parent Phone', 'Parent Email'],
      ['101', 'A', 'GAYATHRI', '7981900487', 'parent1@email.com'],
      ['102', 'A', 'VASUDEVA REDDY', '6281571454', 'parent2@email.com']
    ];

    const csvContent = sampleData.map(row => `"${row.join('","')}"`).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `student_upload_template_${selectedSchool || 'school'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="legacy-responsive-page" style={{ padding: 16, fontFamily: "Arial, sans-serif" }}>
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
      <div className="responsive-form-row" style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
            Select Academic Year *
          </label>
          <select
            value={selectedAcademicYear}
            onChange={(e) => setSelectedAcademicYear(e.target.value)}
            disabled={deletingAll || Boolean(deletingStudentId)}
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
              setSelectedSchool(e.target.value);
              setSelectedClassSection('');
              setStudents([]);
              setSchoolData(null);
              setError('');
              setSuccess('');
            }}
            disabled={deletingAll || Boolean(deletingStudentId)}
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
                setSelectedClassSection(e.target.value);
                // 👇 Auto-fetch students when selection changes
                setStudents([]);
                setError('');
                setSuccess('');
              }}
              disabled={deletingAll || Boolean(deletingStudentId)}
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
              disabled={loading || deletingAll || Boolean(deletingStudentId)}
            >
              {loading ? 'Uploading...' : 'Upload Students'}
            </button>
          </form>

          {/* Students Table */}
          {(selectedClassSection || students.length > 0) && (
            <div style={{ marginTop: '16px' }}>
              <div className="ct-section-header" style={{ marginBottom: '8px', paddingBottom: '4px' }}>
                <div className="ct-section-title" style={{ margin: 0, border: 'none', fontSize: '13.5px' }}>
                  👥 Students in {selectedClassSection || 'Selected Class'} ({students.length})
                </div>
              </div>
              
              {fetchingStudents ? (
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '8px 0' }}>Loading students...</p>
              ) : students.length === 0 ? (
                <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--color-text-muted)', margin: '8px 0' }}>
                  No students registered for this class section yet.
                </p>
              ) : (
                <div className="ct-compact-table-outer">
                  <table className="ct-compact-table">
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Student Name</th>
                        <th>Parent Phone</th>
                        <th>Parent Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, index) => {
                        const fullName = student.name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || '—';
                        const phone = student.parent_phone || student.phone || student.phoneno || student.phone_number || student.mobile || student.contact || '-';
                        const email = student.parent_email || student.email || student.emailid || student.email_id || '-';
                        const studentId = student.student_id || student.roll_no || student.rollno || student.id;

                        return (
                          <tr key={student.id || student.student_id || index}>
                            <td>
                              <span className="school-id-badge" style={{ fontSize: '11px', padding: '1px 6px' }}>
                                {studentId}
                              </span>
                            </td>
                            <td><b>{fullName}</b></td>
                            <td>{phone}</td>
                            <td>{email}</td>
                          </tr>
                        );
                      })}
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
