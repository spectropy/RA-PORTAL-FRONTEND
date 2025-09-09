import React, { useState, useEffect } from 'react';
import { getSchoolById, uploadStudents, getAcademicYears } from '../api';

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

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
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
    // ✅ Create FormData and append BOTH file and class_section
    const formData = new FormData();
    formData.append('file', file);
    formData.append('class_section', selectedClassSection); // 👈 ADD THIS

    await uploadStudents(selectedSchool, formData); // 👈 Only pass schoolId and formData
    setSuccess('Students uploaded successfully!');
    
    // Reset form
    setFile(null);
    setSelectedClassSection('');
    document.getElementById('file-upload').value = '';
  } catch (err) {
    setError(err.message || 'Failed to upload students');
  } finally {
    setLoading(false);
  }
};

  const downloadSample = () => {
    // Create sample CSV content
    const sampleData = [
      ['Student ID', 'First Name', 'Last Name', 'Date of Birth', 'Gender', 'Parent Name', 'Parent Phone', 'Parent Email'],
      ['STD001', 'John', 'Doe', '2010-05-15', 'Male', 'Jane Doe', '9876543210', 'janedoe@email.com'],
      ['STD002', 'Jane', 'Smith', '2010-08-22', 'Female', 'Robert Smith', '9876543211', 'robertsmith@email.com']
    ];

    // Create CSV content
    const csvContent = sampleData.map(row => row.join(',')).join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'student_sample.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
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
          {/* Class-Section Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
              Select Class-Section *
            </label>
            <select
              value={selectedClassSection}
              onChange={(e) => setSelectedClassSection(e.target.value)}
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
                cursor: 'pointer'
              }}
              disabled={loading}
            >
              {loading ? 'Uploading...' : 'Upload Students'}
            </button>
          </form>

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
              <li>Download and use the sample template to ensure correct formatting</li>
              <li>Make sure all required columns are included in your file</li>
              <li>Save your file as .csv, .xlsx, or .xls format</li>
              <li>Maximum file size: 10MB</li>
              <li>All student data will be associated with the selected class-section</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}