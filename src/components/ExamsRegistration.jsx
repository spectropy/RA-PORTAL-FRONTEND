import React, { useState, useEffect } from 'react';
import { getSchoolById, createExam, getExams } from '../api';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
// Define the constants as requested
const FOUNDATION_OPTIONS = [
  { id: 'IIT-MED', name: 'IIT-MED' },
  { id: 'IIT', name: 'IIT' },
  { id: 'MED', name: 'MED' },
  { id: 'FF', name: 'FF' }
];

const PROGRAM_OPTIONS = [
  { id: 'CAT', name: 'CAT' },
  { id: 'MAE', name: 'MAE' },
  { id: 'PIO', name: 'PIO' }
];

// Exam patterns based on program selection
const getExamPatternsByProgram = (program) => {
  switch (program) {
    case 'CAT':
      return [
        { id: 'PART_TEST', name: 'Part Test' },
        { id: 'UNIT_TEST', name: 'Unit Test' }
      ];
    case 'MAE':
    case 'PIO':
      return [
        { id: 'WEEK_TEST', name: 'Week Test' },
        { id: 'UNIT_TEST', name: 'Unit Test' }
      ];
    default:
      return [];
  }
};

// Auto template based on program
const getTemplateByProgram = (program) => {
  switch (program) {
    case 'CAT':
      return 'CATALYST';
    case 'MAE':
      return 'MAESTRO';
    case 'PIO':
      return 'PIONEER';
    default:
      return '';
  }
};

// PDF Download Component
const ExamResultsView = ({ selectedExam, onBack }) => {
  const [file, setFile] = useState(null);
  const [examResults, setExamResults] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return alert('Please select a file');
    if (!selectedExam?.id) return alert('Invalid exam');

    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/api/exams/${selectedExam.id}/results/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setExamResults(data.results || []);
        setPreview(true);
        alert('✅ Results uploaded successfully!');
      } else {
        alert('❌ Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('⚠️ Network error. Check console for details.');
    } finally {
      setUploading(false);
    }
  };

  const downloadPDF = () => {
    if (!examResults.length) return alert('No data to download');

    import('jspdf').then((jsPDF) => {
      import('jspdf-autotable').then(() => {
        const doc = new jsPDF.default('landscape');

        // Title
        doc.setFontSize(18);
        doc.text(`Exam Results - ${selectedExam.exam_template} (${selectedExam.class})`, 14, 22);
        doc.setFontSize(12);
        doc.text(`School: ${selectedExam.school_id} | Foundation: ${selectedExam.foundation} | Program: ${selectedExam.program}`, 14, 30);

        // Table
        doc.autoTable({
          startY: 40,
          head: [
            [
              'Student ID',
              'Student Name',
              'Total Q',
              'Correct',
              'Wrong',
              'Unattempted',
              'Physics',
              'Chemistry',
              'Maths',
              'Biology',
              'Total Marks',
              'Percentage',
              'Class Rank',
              'School Rank',
              'All Schools Rank'
            ]
          ],
          body: examResults.map(r => [
            r.student_id || '-',
            `${r.first_name || ''} ${r.last_name || ''}`.trim() || '-',
            r.total_questions || 0,
            r.correct || 0,
            r.wrong || 0,
            r.unattempted || 0,
            r.physics_marks || 0,
            r.chemistry_marks || 0,
            r.maths_marks || 0,
            r.biology_marks || 0,
            r.total_marks || 0,
            `${r.percentage || 0}%`,
            r.class_rank || '-',
            r.school_rank || '-',
            r.all_schools_rank || '-'
          ]),
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [30, 144, 255], fontSize: 9 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          didDrawPage: (data) => {
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(
              `Generated on: ${new Date().toLocaleString()}`,
              data.settings.margin.left,
              doc.internal.pageSize.height - 10
            );
          }
        });

        doc.save(`Exam_Results_${selectedExam.id}_${new Date().toISOString().split('T')[0]}.pdf`);
      });
    });
  };

  const tableHeaderStyle = {
    padding: '10px 8px',
    textAlign: 'left',
    borderBottom: '2px solid #ddd',
    backgroundColor: '#f8f9fa',
    fontWeight: 'bold',
    fontSize: '12px',
    position: 'sticky',
    top: 0
  };

  const tableCellStyle = {
    padding: '8px',
    borderBottom: '1px solid #eee',
    fontSize: '12px'
  };

  return (
    <div style={{ marginTop: '20px', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <h2 style={{ color: '#1e90ff', margin: 0 }}>
          📊 Exam Results: {selectedExam?.exam_template} ({selectedExam?.class})
        </h2>
        <button
          onClick={onBack}
          style={{
            padding: '8px 16px',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          ← Back to Exams List
        </button>
      </div>

      {!preview ? (
        <div style={{ 
          padding: '30px', 
          border: '2px dashed #1e90ff', 
          borderRadius: '8px', 
          background: '#f8f9fa',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#1e90ff', marginBottom: '20px' }}>📤 Upload Exam Results</h3>
          <p style={{ marginBottom: '20px', color: '#555' }}>
            <strong>Supported formats:</strong> CSV, XLSX, XLS<br/>
            <strong>Required columns:</strong> Student ID, First Name, Last Name, Physics, Chemistry, Maths, Biology, Total Questions, Correct, Wrong, Unattempted
          </p>
          <div style={{ marginBottom: '20px' }}>
            <input 
              type="file" 
              accept=".csv,.xlsx,.xls" 
              onChange={handleFileChange} 
              style={{ 
                padding: '10px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                width: '100%',
                maxWidth: '400px',
                margin: '0 auto',
                display: 'block'
              }} 
            />
          </div>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            style={{
              padding: '12px 24px',
              background: uploading ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {uploading ? (
              <>
                <span>⏳ Uploading...</span>
              </>
            ) : (
              <>
                <span>🚀 Upload & Process Results</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <>
          <div style={{ 
            marginBottom: '20px', 
            display: 'flex', 
            justifyContent: 'flex-end' 
          }}>
            <button
              onClick={downloadPDF}
              style={{
                padding: '12px 24px',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📥 Download as PDF
            </button>
          </div>

          <div style={{ 
            overflowX: 'auto', 
            border: '1px solid #ddd', 
            borderRadius: '8px',
            background: 'white'
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              fontSize: '12px',
              minWidth: '1200px'
            }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Student ID</th>
                  <th style={tableHeaderStyle}>Student Name</th>
                  <th style={tableHeaderStyle}>Total Q</th>
                  <th style={tableHeaderStyle}>Correct</th>
                  <th style={tableHeaderStyle}>Wrong</th>
                  <th style={tableHeaderStyle}>Unattempted</th>
                  <th style={tableHeaderStyle}>Physics</th>
                  <th style={tableHeaderStyle}>Chemistry</th>
                  <th style={tableHeaderStyle}>Maths</th>
                  <th style={tableHeaderStyle}>Biology</th>
                  <th style={tableHeaderStyle}>Total Marks</th>
                  <th style={tableHeaderStyle}>%</th>
                  <th style={tableHeaderStyle}>Class Rank</th>
                  <th style={tableHeaderStyle}>School Rank</th>
                  <th style={tableHeaderStyle}>All Schools Rank</th>
                </tr>
              </thead>
              <tbody>
                {examResults.length > 0 ? (
                  examResults.map((r, index) => (
                    <tr key={index} style={{ 
                      borderBottom: '1px solid #eee',
                      backgroundColor: index % 2 === 0 ? '#fafafa' : 'white'
                    }}>
                      <td style={tableCellStyle}>{r.student_id || '-'}</td>
                      <td style={tableCellStyle}>{`${r.first_name || ''} ${r.last_name || ''}`.trim() || '-'}</td>
                      <td style={tableCellStyle}>{r.total_questions || 0}</td>
                      <td style={tableCellStyle}>{r.correct || 0}</td>
                      <td style={tableCellStyle}>{r.wrong || 0}</td>
                      <td style={tableCellStyle}>{r.unattempted || 0}</td>
                      <td style={tableCellStyle}>{r.physics_marks || 0}</td>
                      <td style={tableCellStyle}>{r.chemistry_marks || 0}</td>
                      <td style={tableCellStyle}>{r.maths_marks || 0}</td>
                      <td style={tableCellStyle}>{r.biology_marks || 0}</td>
                      <td style={tableCellStyle}>{r.total_marks || 0}</td>
                      <td style={tableCellStyle}>{r.percentage || 0}%</td>
                      <td style={tableCellStyle}>{r.class_rank || '-'}</td>
                      <td style={tableCellStyle}>{r.school_rank || '-'}</td>
                      <td style={tableCellStyle}>{r.all_schools_rank || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="15" style={{ padding: '40px', textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
                      No results data available. Please upload a file.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default function ExamsRegistration({ schools = [] }) {
  const [foundations, setFoundations] = useState(FOUNDATION_OPTIONS);
  const [programs, setPrograms] = useState(PROGRAM_OPTIONS);
  const [selectedFoundation, setSelectedFoundation] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [examTemplate, setExamTemplate] = useState(''); // Will be auto-set
  const [examPattern, setExamPattern] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [schoolData, setSchoolData] = useState(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // For table
  const [exams, setExams] = useState([]);
  const [showForm, setShowForm] = useState(true); // Toggle between form and table
  const [availableExamPatterns, setAvailableExamPatterns] = useState([]);

  // For exam results view
  const [selectedExam, setSelectedExam] = useState(null);
  const [showExamView, setShowExamView] = useState(false);

  // Fetch exams for table
  const fetchExams = async () => {
    try {
      const data = await getExams();
      setExams(data);
    } catch (err) {
      console.error('Failed to fetch exams:', err);
    }
  };

  // Update exam patterns and template when program changes
  useEffect(() => {
    if (selectedProgram) {
      const patterns = getExamPatternsByProgram(selectedProgram);
      setAvailableExamPatterns(patterns);
      const template = getTemplateByProgram(selectedProgram);
      setExamTemplate(template);
      
      // Reset exam pattern if invalid
      if (examPattern && !patterns.some(p => p.id === examPattern)) {
        setExamPattern('');
      }
    } else {
      setExamTemplate('');
      setAvailableExamPatterns([]);
    }
  }, [selectedProgram]);

  useEffect(() => {
    if (selectedSchool) {
      fetchSchoolData();
    }
  }, [selectedSchool]);

  useEffect(() => {
    fetchExams();
  }, []);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!selectedFoundation) {
      setError('Please select a foundation');
      return;
    }
    
    if (!selectedProgram) {
      setError('Please select a program');
      return;
    }
    
    if (!selectedSchool) {
      setError('Please select a school');
      return;
    }
    
    if (!selectedClass) {
      setError('Please select a class');
      return;
    }
    
    if (!examPattern) {
      setError('Please select exam pattern');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        school_id: selectedSchool,
        foundation: selectedFoundation,
        program: selectedProgram,
        exam_template: examTemplate, // Auto-set based on program
        exam_pattern: examPattern,
        class: selectedClass,
        // Remove created_at - let backend handle it
      };

      await createExam(payload);
      setSuccess('Exam created successfully!');
      
      // Refresh exams list
      fetchExams();
      
      // Reset form
      setSelectedFoundation('');
      setSelectedProgram('');
      setExamPattern('');
      setSelectedClass('');
    } catch (err) {
      setError(err.message || 'Failed to create exam');
    } finally {
      setLoading(false);
    }
  };

  // Get school name by ID
  const getSchoolName = (schoolId) => {
    const school = schools.find(s => s.school_id === schoolId);
    return school ? school.school_name : schoolId;
  };

  // Handle "Exam View" button click from table
  const handleExamViewClick = (exam) => {
    setSelectedExam(exam);
    setShowExamView(true);
    setShowForm(false);
  };

  // Handle back to exams list
  const handleBackToExamsList = () => {
    setShowExamView(false);
    setShowForm(false); // Stay in table view
  };

  return (
    <div style={{ marginTop: '20px', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      
      {/* Toggle between form and table */}
      <div style={{ 
        marginBottom: '20px', 
        display: 'flex', 
        gap: '10px',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <h2 style={{ color: '#1e90ff', margin: 0 }}>
          {showExamView ? '📊 Exam Results' : 'Exams Management'}
        </h2>
        
        {!showExamView && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setShowForm(true);
                setShowExamView(false);
              }}
              style={{
                padding: '8px 16px',
                background: showForm ? '#1e90ff' : '#f8f9fa',
                color: showForm ? 'white' : '#1e90ff',
                border: '1px solid #1e90ff',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              📝 Registration Form
            </button>
            
            <button
              onClick={() => {
                setShowForm(false);
                setShowExamView(false);
              }}
              style={{
                padding: '8px 16px',
                background: !showForm && !showExamView ? '#1e90ff' : '#f8f9fa',
                color: !showForm && !showExamView ? 'white' : '#1e90ff',
                border: '1px solid #1e90ff',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              📋 Exams List
            </button>
          </div>
        )}
      </div>

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

      {/* Show Form */}
      {showForm && !showExamView && (
        <div style={{ 
          padding: '20px', 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          background: '#fff',
          marginBottom: '30px'
        }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#1e90ff' }}>📝 Exams Registration</h3>
          
          {/* Foundation and Program Selection */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Foundation Selection *
              </label>
              <select
                value={selectedFoundation}
                onChange={(e) => setSelectedFoundation(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                required
              >
                <option value="">-- Select Foundation --</option>
                {foundations.map(foundation => (
                  <option key={foundation.id} value={foundation.id}>{foundation.name}</option>
                ))}
              </select>
            </div>
            
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Program Selection *
              </label>
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                required
              >
                <option value="">-- Select Program --</option>
                {programs.map(program => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* School Selection */}
          <div style={{ marginBottom: '20px' }}>
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

          {loading && <p>Loading school data...</p>}

          {selectedSchool && schoolData && (
            <>
              {/* Class Selection */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                  Select Class *
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
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
                      Class {cls.class} - Section {cls.section}
                    </option>
                  ))}
                </select>
              </div>

              {/* Auto-set Exam Template (display only, no selection) */}
              {selectedProgram && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    Exam Template (Auto-set based on Program)
                  </label>
                  <div style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    background: '#f8f9fa',
                    color: '#495057'
                  }}>
                    {examTemplate}
                  </div>
                </div>
              )}

              {/* Exam Pattern Selection */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                  Exam Pattern *
                </label>
                <select
                  value={examPattern}
                  onChange={(e) => setExamPattern(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                  required
                  disabled={!selectedProgram}
                >
                  <option value="">-- Select Exam Pattern --</option>
                  {availableExamPatterns.map(pattern => (
                    <option key={pattern.id} value={pattern.id}>
                      {pattern.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                onClick={handleSubmit}
                style={{
                  padding: '10px 20px',
                  background: '#1e90ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
                disabled={loading || !selectedProgram}
              >
                {loading ? 'Creating...' : 'Add Exam'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Show Exams Table */}
      {!showForm && !showExamView && (
        <div style={{ 
          padding: '20px', 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          background: '#fff'
        }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#1e90ff' }}>📋 Registered Exams</h3>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>School Name</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Class</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Foundation</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Program</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Exam Pattern</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {exams.length > 0 ? (
                  exams.map((exam) => (
                    <tr key={exam.id || exam.exam_id} style={{ 
                      borderBottom: '1px solid #eee',
                      backgroundColor: 'white'
                    }}>
                      <td style={{ padding: '12px' }}>{getSchoolName(exam.school_id)}</td>
                      <td style={{ padding: '12px' }}>
                        Class {exam.class}
                      </td>
                      <td style={{ padding: '12px' }}>{exam.foundation}</td>
                      <td style={{ padding: '12px' }}>{exam.program}</td>
                      <td style={{ padding: '12px' }}>
                        {exam.exam_pattern.replace('_', ' ')}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={() => handleExamViewClick(exam)}
                          style={{
                            padding: '6px 12px',
                            background: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          📊 Exam View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" style={{ padding: '20px', textAlign: 'center', fontStyle: 'italic' }}>
                      No exams registered yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Show Exam Results View */}
      {showExamView && (
        <ExamResultsView 
          selectedExam={selectedExam} 
          onBack={handleBackToExamsList} 
        />
      )}
    </div>
  );
}