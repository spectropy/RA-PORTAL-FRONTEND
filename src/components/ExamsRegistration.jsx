// src/components/ExamsRegistration.jsx
import React, { useState, useEffect } from 'react';
import { getSchoolById, createExam, getExams } from '../api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Define the constants as requested
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
        { id: 'PART_TEST_1', name: 'Part Test 1', type: 'PART_TEST' },
        { id: 'PART_TEST_2', name: 'Part Test 2', type: 'PART_TEST' },
        { id: 'PART_TEST_3', name: 'Part Test 3', type: 'PART_TEST' },
        { id: 'PART_TEST_4', name: 'Part Test 4', type: 'PART_TEST' },
        { id: 'PART_TEST_5', name: 'Part Test 5', type: 'PART_TEST' },
        { id: 'PART_TEST_6', name: 'Part Test 6', type: 'PART_TEST' },
        { id: 'UNIT_TEST_1', name: 'Unit Test 1', type: 'UNIT_TEST' },
        { id: 'UNIT_TEST_2', name: 'Unit Test 2', type: 'UNIT_TEST' },
        { id: 'UNIT_TEST_3', name: 'Unit Test 3', type: 'UNIT_TEST' },
        { id: 'UNIT_TEST_4', name: 'Unit Test 4', type: 'UNIT_TEST' },
        { id: 'UNIT_TEST_5', name: 'Unit Test 5', type: 'UNIT_TEST' },
        { id: 'GRAND_TEST_1', name: 'Grand Test 1', type: 'GRAND_TEST' },
        { id: 'GRAND_TEST_2', name: 'Grand Test 2', type: 'GRAND_TEST' }
      ];
    case 'MAE':
    case 'PIO':
      return [
        { id: 'WEEK_TEST_1', name: 'Week Test 1', type: 'WEEK_TEST' },
        { id: 'WEEK_TEST_2', name: 'Week Test 2', type: 'WEEK_TEST' },
        { id: 'WEEK_TEST_3', name: 'Week Test 3', type: 'WEEK_TEST' },
        { id: 'WEEK_TEST_4', name: 'Week Test 4', type: 'WEEK_TEST' },
        { id: 'WEEK_TEST_5', name: 'Week Test 5', type: 'WEEK_TEST' },
        { id: 'WEEK_TEST_6', name: 'Week Test 6', type: 'WEEK_TEST' },
        { id: 'WEEK_TEST_7', name: 'Week Test 7', type: 'WEEK_TEST' },
        { id: 'WEEK_TEST_8', name: 'Week Test 8', type: 'WEEK_TEST' },
        { id: 'WEEK_TEST_9', name: 'Week Test 9', type: 'WEEK_TEST' },
        { id: 'WEEK_TEST_10', name: 'Week Test 10', type: 'WEEK_TEST' },
        { id: 'WEEK_TEST_11', name: 'Week Test 11', type: 'WEEK_TEST' },
        { id: 'WEEK_TEST_12', name: 'Week Test 12', type: 'WEEK_TEST' },
        { id: 'WEEK_TEST_13', name: 'Week Test 13', type: 'WEEK_TEST' },
        { id: 'WEEK_TEST_14', name: 'Week Test 14', type: 'WEEK_TEST' },
        { id: 'WEEK_TEST_15', name: 'Week Test 15', type: 'WEEK_TEST' },
        { id: 'WEEK_TEST_16', name: 'Week Test 16', type: 'WEEK_TEST' },
        { id: 'WEEK_TEST_17', name: 'Week Test 17', type: 'WEEK_TEST' },
        { id: 'WEEK_TEST_18', name: 'Week Test 18', type: 'WEEK_TEST' },
        { id: 'UNIT_TEST_1', name: 'Unit Test 1', type: 'UNIT_TEST' },
        { id: 'UNIT_TEST_2', name: 'Unit Test 2', type: 'UNIT_TEST' },
        { id: 'UNIT_TEST_3', name: 'Unit Test 3', type: 'UNIT_TEST' },
        { id: 'UNIT_TEST_4', name: 'Unit Test 4', type: 'UNIT_TEST' },
        { id: 'UNIT_TEST_5', name: 'Unit Test 5', type: 'UNIT_TEST' },
        { id: 'GRAND_TEST_1', name: 'Grand Test 1', type: 'GRAND_TEST' },
        { id: 'GRAND_TEST_2', name: 'Grand Test 2', type: 'GRAND_TEST' }
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

// 👇 NEW: Define exam pattern priority order
const EXAM_PRIORITY_ORDER = [
  'WEEK_TEST_1', 'WEEK_TEST_2', 'WEEK_TEST_3', 'WEEK_TEST_4', 'WEEK_TEST_5',
  'WEEK_TEST_6', 'WEEK_TEST_7', 'WEEK_TEST_8', 'WEEK_TEST_9', 'WEEK_TEST_10',
  'WEEK_TEST_11', 'WEEK_TEST_12', 'WEEK_TEST_13', 'WEEK_TEST_14', 'WEEK_TEST_15',
  'WEEK_TEST_16', 'WEEK_TEST_17', 'WEEK_TEST_18',
  'UNIT_TEST_1', 'UNIT_TEST_2', 'UNIT_TEST_3', 'UNIT_TEST_4', 'UNIT_TEST_5',
  'GRAND_TEST_1', 'GRAND_TEST_2',
  'PART_TEST_1', 'PART_TEST_2', 'PART_TEST_3', 'PART_TEST_4', 'PART_TEST_5', 'PART_TEST_6',
];

// Helper to get priority index for sorting
const getExamPriority = (examPattern) => {
  const index = EXAM_PRIORITY_ORDER.indexOf(examPattern);
  return index === -1 ? 999 : index; // Unknown patterns go last
};

export default function ExamsRegistration({ schools = [] }) {
  const [selectedSchool, setSelectedSchool] = useState('');
  const [schoolData, setSchoolData] = useState(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // For exam management
  const [exams, setExams] = useState([]);
  const [showForm, setShowForm] = useState(true);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [examTemplate, setExamTemplate] = useState('');
  const [examPatterns, setExamPatterns] = useState([]);

  // For inline OMR upload per exam
  const [uploading, setUploading] = useState({});
  const [examResults, setExamResults] = useState({}); // key: exam.id → array of results
  const [file, setFile] = useState({}); // key: exam.id → file object
  const [showResults, setShowResults] = useState({}); // key: exam.id → boolean
  const [uploadError, setUploadError] = useState({}); // key: exam.id → error message

  // 👇 NEW: Track current exam for full-page OMR view
  const [currentOMRExam, setCurrentOMRExam] = useState(null);

  // Progress tracking for bulk creation
  const [creatingCount, setCreatingCount] = useState(0);

  // Fetch exams for table
  const fetchExams = async () => {
    try {
      const data = await getExams();
      setExams(data);

      // Initialize states for each exam
      const initialResults = {};
      const initialFiles = {};
      const initialShowResults = {};
      const initialUploadErrors = {};
      data.forEach(exam => {
        initialResults[exam.id] = [];
        initialFiles[exam.id] = null;
        initialShowResults[exam.id] = false;
        initialUploadErrors[exam.id] = '';
      });
      setExamResults(initialResults);
      setFile(initialFiles);
      setShowResults(initialShowResults);
      setUploadError(initialUploadErrors);
    } catch (err) {
      console.error('Failed to fetch exams:', err);
    }
  };

  // Update exam template and patterns when program is selected
  useEffect(() => {
    if (selectedProgram) {
      setExamTemplate(getTemplateByProgram(selectedProgram));
      setExamPatterns(getExamPatternsByProgram(selectedProgram));
    } else {
      setExamTemplate('');
      setExamPatterns([]);
    }
  }, [selectedProgram]);

  // Load school data when school is selected
  useEffect(() => {
    if (selectedSchool) {
      fetchSchoolData();
    } else {
      setSchoolData(null);
      setSelectedClass('');
      setSelectedSection('');
      setSelectedProgram('');
    }
  }, [selectedSchool]);

  // Fetch exams on component mount
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

      // Auto-select first class/section if available
      if (data.classes && data.classes.length > 0) {
        const firstClass = data.classes[0];
        setSelectedClass(firstClass.class);
        setSelectedSection(firstClass.section);
      } else {
        setSelectedClass('');
        setSelectedSection('');
      }
    } catch (err) {
      setError(err.message || 'Failed to load school data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedSchool) {
      setError('Please select a school');
      return;
    }

    if (!selectedClass) {
      setError('Please select a class');
      return;
    }

    if (!selectedSection) {
      setError('Please select a section');
      return;
    }

    if (!selectedProgram) {
      setError('Please select a program');
      return;
    }

    if (!examPatterns || examPatterns.length === 0) {
      setError('No exam patterns generated. Please select a valid program.');
      return;
    }

    if (!examTemplate) {
      setError(`Exam template not defined for program: ${selectedProgram}`);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const createdExams = [];
      const total = examPatterns.length;

      // ✅ STEP 1: Fetch existing exams for this class/section
      const existingExams = await getExams();
      const existingKeys = existingExams
        .filter(exam =>
          exam.school_id === selectedSchool &&
          exam.class === selectedClass &&
          exam.section === selectedSection
        )
        .map(exam => exam.exam_pattern); // 👈 Array like ["PART_TEST_1", "WEEK_TEST_1", ...]

      // ✅ STEP 2: Create one exam per pattern — skip if already exists
      for (let i = 0; i < examPatterns.length; i++) {
        const pattern = examPatterns[i];

        // ✅ Skip if already registered
        if (existingKeys.includes(pattern.id)) {
          console.log(`⏭️ Skipping ${pattern.id} — already exists`);
          createdExams.push({ id: 'skipped', exam_pattern: pattern.id });
          setCreatingCount(i + 1);
          continue;
        }

        const payload = {
          school_id: selectedSchool,
          program: selectedProgram,
          exam_template: examTemplate,
          exam_pattern: pattern.id,
          class: selectedClass,
          section: selectedSection,
          created_at: new Date().toISOString()
        };

        try {
          const response = await createExam(payload);

          if (response && typeof response === 'object' && response.id) {
            createdExams.push(response);
          } else {
            throw new Error('Invalid response: expected exam object with id');
          }
        } catch (err) {
          console.error(`❌ Failed to create exam ${pattern.id}:`, err.message);
          throw new Error(`Failed to create exam: ${pattern.name} (${err.message})`);
        }

        setCreatingCount(i + 1);
      }

      const createdCount = createdExams.filter(exam => exam.id !== 'skipped').length;
      setSuccess(
        `✅ Successfully created ${createdCount} new exams out of ${total} for ${selectedClass}-${selectedSection}!`
      );
      await fetchExams(); // Refresh list to show newly created ones
      setSelectedProgram('');

    } catch (err) {
      console.error('💥 Final error during bulk creation:', err);
      setError(err.message || 'Failed to register exams. Check browser console for details.');
    } finally {
      setLoading(false);
      setCreatingCount(0);
    }
  };

  // Get school name by ID
  const getSchoolName = (schoolId) => {
    const school = schools.find(s => s.school_id === schoolId);
    return school ? school.school_name : schoolId;
  };

  // Handle "Upload OMR" button click — toggle full page view
  const handleOMRClick = (exam) => {
    setCurrentOMRExam(exam); // 👈 Switch to full OMR view
    setShowForm(false);      // 👈 Ensure we're on list mode
    // Reset file and results when opening
    setFile(prev => ({ ...prev, [exam.id]: null }));
    setExamResults(prev => ({ ...prev, [exam.id]: [] }));
    setUploadError(prev => ({ ...prev, [exam.id]: '' }));
  };

  // Handle file change for specific exam — NO VALIDATION
  const handleFileChange = (examId, e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) {
      setFile(prev => ({ ...prev, [examId]: null }));
      setUploadError(prev => ({ ...prev, [examId]: '' }));
      return;
    }

    // Only validate extension
    if (!['.csv', '.xlsx', '.xls'].some(ext => selectedFile.name.toLowerCase().endsWith(ext))) {
      setUploadError(prev => ({ ...prev, [examId]: '❌ Only CSV, XLSX, or XLS files are allowed.' }));
      setFile(prev => ({ ...prev, [examId]: null }));
      return;
    }

    // ✅ No other checks — accept any file content
    setUploadError(prev => ({ ...prev, [examId]: '' }));
    setFile(prev => ({ ...prev, [examId]: selectedFile }));
  };

  // Handle upload for specific exam
  const handleUpload = async (exam) => {
    const examId = exam.id;
    if (!file[examId]) {
      setUploadError(prev => ({ ...prev, [examId]: 'Please select a file.' }));
      return;
    }

    setUploading(prev => ({ ...prev, [examId]: true }));
    setUploadError(prev => ({ ...prev, [examId]: '' }));

    const formData = new FormData();
    formData.append('file', file[examId]);

    try {
      const response = await fetch(`${API_BASE}/api/exams/${examId}/results/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setExamResults(prev => ({ ...prev, [examId]: data.results || [] }));
        setFile(prev => ({ ...prev, [examId]: null }));
        setUploadError(prev => ({ ...prev, [examId]: '' }));
        setSuccess(`✅ Results uploaded successfully for ${exam.exam_pattern.replace('_', ' ')}`);
      } else {
        setUploadError(prev => ({ ...prev, [examId]: data.error || 'Upload failed.' }));
      }
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(prev => ({ ...prev, [examId]: '⚠️ Network error.' }));
    } finally {
      setUploading(prev => ({ ...prev, [examId]: false }));
    }
  };

  // Download PDF for specific exam
  const downloadPDF = async (exam) => {
    const examId = exam.id;
    if (!examResults[examId]?.length) return alert('No data to download');

    import('jspdf').then((jsPDF) => {
      import('jspdf-autotable').then(() => {
        const doc = new jsPDF.default('landscape');

        // Title
        doc.setFontSize(18);
        doc.text(`Exam Results - ${exam.exam_pattern.replace('_', ' ')} (${exam.class} - ${exam.section})`, 14, 22);
        doc.setFontSize(12);
        doc.text(`School: ${exam.school_id} | Program: ${exam.program}`, 14, 30);

        // Table headers — EXACTLY AS REQUESTED
        const headers = [
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
        ];

        // Table rows
        const body = examResults[examId].map(r => [
          r.student_id || '-',
          `${r.first_name || ''} ${r.last_name || ''}`.trim() || '-',
          r.total_questions || 0,
          r.correct_answers || 0,
          r.wrong_answers || 0,
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
        ]);

        doc.autoTable({
          startY: 40,
          head: [headers],
          body,
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

        doc.save(`Exam_Results_${examId}_${new Date().toISOString().split('T')[0]}.pdf`);
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
          Exams Management
        </h2>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setShowForm(true);
              setCurrentOMRExam(null); // 👈 Reset when switching to form
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
              setCurrentOMRExam(null); // 👈 Reset when switching to list
            }}
            style={{
              padding: '8px 16px',
              background: !showForm ? '#1e90ff' : '#f8f9fa',
              color: !showForm ? 'white' : '#1e90ff',
              border: '1px solid #1e90ff',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            📋 Exams List
          </button>
        </div>
      </div>

      {/* 👇 NEW: Full OMR View Header */}
      {currentOMRExam && (
        <div style={{ 
          marginBottom: '20px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <h2 style={{ color: '#1e90ff', margin: 0 }}>
            📄 OMR Upload: {currentOMRExam.exam_pattern.replace('_', ' ')} ({currentOMRExam.class}-{currentOMRExam.section})
          </h2>
          <button
            onClick={() => setCurrentOMRExam(null)}
            style={{
              padding: '8px 16px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← Back to Exams List
          </button>
        </div>
      )}

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

      {/* Show Registration Form */}
      {showForm && (
        <div style={{ 
          padding: '20px', 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          background: '#fff',
          marginBottom: '30px'
        }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#1e90ff' }}>📝 Exams Registration</h3>
          
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
              {/* Class and Section Selection */}
              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
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
                        Class {cls.class}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                    Select Section *
                  </label>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                    required
                  >
                    <option value="">-- Select Section --</option>
                    {schoolData.classes && schoolData.classes
                      .filter(cls => cls.class === selectedClass)
                      .map(cls => (
                        <option key={`${cls.class}-${cls.section}`} value={cls.section}>
                          Section {cls.section}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* 👇 Manual Program Selection */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                  Select Program * 🔧
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
                  {PROGRAM_OPTIONS.map(program => (
                    <option key={program.id} value={program.id}>
                      {program.name} → {getTemplateByProgram(program.id)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Show which exams will be created */}
              {selectedProgram && (
                <div style={{ 
                  padding: '15px', 
                  background: '#e8f5e9', 
                  border: '1px solid #a5d6a7', 
                  borderRadius: '4px', 
                  marginBottom: '20px'
                }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>📚 Exams to be Created</h4>
                  <p style={{ margin: '5px 0', color: '#1b5e20' }}>
                    <strong>{getTemplateByProgram(selectedProgram)}</strong> ({selectedProgram}) will create:
                  </p>
                  <ul style={{ margin: '10px 0', paddingLeft: '20px', color: '#333' }}>
                    {selectedProgram === 'CAT' && (
                      <>
                        <li>6 Part Tests</li>
                        <li>5 Unit Tests</li>
                        <li>2 Grand Tests</li>
                      </>
                    )}
                    {(selectedProgram === 'MAE' || selectedProgram === 'PIO') && (
                      <>
                        <li>18 Week Tests</li>
                        <li>5 Unit Tests</li>
                        <li>2 Grand Tests</li>
                      </>
                    )}
                  </ul>
                  <p style={{ fontSize: '14px', color: '#555', fontStyle: 'italic' }}>
                    ⚠️ Clicking “Register All Exams” will create all these exams at once.
                  </p>
                </div>
              )}

              {/* ✅ Updated Button with Progress Indicator */}
              <button
                type="submit"
                onClick={handleSubmit}
                style={{
                  padding: '12px 24px',
                  background: loading || !selectedProgram ? '#ccc' : '#1e90ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading || !selectedProgram ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  display: 'block',
                  margin: '0 auto'
                }}
                disabled={loading || !selectedProgram}
              >
                {loading ? (
                  creatingCount > 0
                    ? `Creating exams... (${creatingCount}/${examPatterns.length})`
                    : 'Creating exams...'
                ) : (
                  '✅ Register All Exams for This Class'
                )}
              </button>
              
              <p style={{ textAlign: 'center', marginTop: '15px', color: '#666', fontSize: '14px' }}>
                * Each exam will have its own unique ID for OMR upload and tracking.
              </p>
            </>
          )}
        </div>
      )}

      {/* Show Exams List Table — ONLY if not viewing OMR page */}
      {!showForm && !currentOMRExam && (
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
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Exam Name</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>School</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Class</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Program</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {exams.length > 0 ? (
  [...exams] // Create copy to avoid mutating state
    .sort((a, b) => getExamPriority(a.exam_pattern) - getExamPriority(b.exam_pattern))
    .map((exam) => {
      const examPattern = exam.exam_pattern || '';
      let examName;

      if (examPattern.includes('_TEST_')) {
        const parts = examPattern.split('_');
        const base = parts.slice(0, 2).join(' '); // e.g., "WEEK TEST"
        const number = parts[2];                 // e.g., "1", "5", "18"
        examName = `${base} ${number}`;
      } else {
        examName = examPattern.replace('_', ' ');
      }

      const schoolName = getSchoolName(exam.school_id);

      return (
        <React.Fragment key={exam.id}>
          <tr style={{ borderBottom: '1px solid #eee', backgroundColor: 'white' }}>
            <td style={{ padding: '12px' }}>
              {examName}
              <br/>
              <small style={{ color: '#666' }}>
                {exam.exam_template} • {exam.class}-{exam.section}
              </small>
            </td>
            <td style={{ padding: '12px' }}>{schoolName}</td>
            <td style={{ padding: '12px' }}>
              Class {exam.class} - Section {exam.section}
            </td>
            <td style={{ padding: '12px' }}>{exam.exam_template}</td>
            <td style={{ padding: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleOMRClick(exam)}
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
                  📄 OMR Upload
                </button>
              </div>
            </td>
          </tr>

          {/* ❌ REMOVED: Inline upload/results table — now handled in full page view */}
        </React.Fragment>
      );
    })
) : (
  <tr>
    <td colSpan="5" style={{ padding: '20px', textAlign: 'center', fontStyle: 'italic' }}>
      No exams registered yet. Please register exams using the form above.
    </td>
  </tr>
)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 👇 NEW: Full OMR Upload & Results Page */}
      {currentOMRExam && (
        <div style={{ 
          padding: '16px 0', 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          background: '#fff',
          marginTop: '30px',
          marginLeft: '0',
          marginRight: '0'
        }}>
          <div style={{ 
            padding: '16px',  
            background: '#f8f9fa',
            textAlign: 'center',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <h4 style={{ color: '#1e90ff', marginBottom: '20px' }}>
              📤 Upload Excel File for {currentOMRExam.exam_pattern.replace('_', ' ')}
            </h4>
            <p style={{ marginBottom: '20px', color: '#555' }}>
              <strong>Supported formats:</strong> CSV, XLSX, XLS<br/>
              <strong>Just upload the file — no formatting rules.</strong>
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <input 
                type="file" 
                accept=".csv,.xlsx,.xls" 
                onChange={(e) => handleFileChange(currentOMRExam.id, e)} 
                style={{ 
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  width: '100%',
                  maxWidth: '500px',
                  margin: '0 auto',
                  display: 'block'
                }} 
              />
            </div>

            {uploadError[currentOMRExam.id] && (
              <div style={{ 
                padding: '10px', 
                background: '#fff5f5', 
                border: '1px solid #e3342f', 
                color: '#e3342f', 
                borderRadius: '4px',
                marginBottom: '15px',
                textAlign: 'left'
              }}>
                {uploadError[currentOMRExam.id]}
              </div>
            )}

            <button
              onClick={() => handleUpload(currentOMRExam)}
              disabled={!file[currentOMRExam.id] || uploading[currentOMRExam.id]}
              style={{
                padding: '12px 24px',
                background: uploading[currentOMRExam.id] ? '#6c757d' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: uploading[currentOMRExam.id] ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {uploading[currentOMRExam.id] ? (
                <>
                  <span>⏳ Uploading...</span>
                </>
              ) : (
                <>
                  <span>🚀 Upload & Process Results</span>
                </>
              )}
            </button>

            {examResults[currentOMRExam.id]?.length > 0 && (
              <>
                <div style={{ 
                  marginBottom: '20px', 
                  display: 'flex', 
                  justifyContent: 'flex-end' 
                }}>
                  <button
                    onClick={() => downloadPDF(currentOMRExam)}
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
                   border: '1px solid #ddd', 
                   borderRadius: '8px',
                   background: 'white',
                   overflowX: 'auto',  // Keep if needed for very wide screens
                   maxWidth: '100%',
                   margin: '0 auto'
                }}>
                  <table style={{ 
                   width: '100%', 
                   borderCollapse: 'collapse', 
                   fontSize: '14px',
                   tableLayout: 'auto',  // Prevents column stretching
                   wordWrap: 'break-word',
                   whiteSpace: 'normal',
                   margin: 0,
                   padding: 0,
                   minWidth: '100%'
                  }}>
                    <thead>
                      <tr>
                        <th style={tableHeaderStyle}>Student ID</th>
                        <th style={tableHeaderStyle}>Student Name</th>
                        <th style={tableHeaderStyle}>Total Q</th>
                        <th style={tableHeaderStyle}>Correct</th>
                        <th style={tableHeaderStyle}>Wrong </th>
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
                      {examResults[currentOMRExam.id].map((r, index) => (
                        <tr key={index} style={{ 
                          borderBottom: '1px solid #eee',
                          backgroundColor: index % 2 === 0 ? '#fafafa' : 'white'
                        }}>
                          <td style={tableCellStyle}>{r.student_id || '-'}</td>
                          <td style={tableCellStyle}>{`${r.first_name || ''} ${r.last_name || ''}`.trim() || '-'}</td>
                          <td style={tableCellStyle}>{r.total_questions || 0}</td>
                          <td style={tableCellStyle}>{r.correct_answers || 0}</td>
                          <td style={tableCellStyle}>{r.wrong_answers || 0}</td>
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};