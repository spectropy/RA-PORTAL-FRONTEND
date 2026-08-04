// src/ExamRegistration.jsx
import React, { useState, useEffect } from 'react';
import OMRUploadView from './OMRUploadView'; // 👈 Adjust path as needed
import { deleteExamDataset, getExamDatasetResults, getExamDatasets } from '../api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const SUPPORTED_PROGRAMS = new Set([
  'SPHS', 'MAESTRO', 'GHS', 'SFS', 'KTS', 'VIJAYA', 'PHS',
  'KPS', 'SPR', 'FF', 'CAT', 'SPARK', 'MANAIR_MAESTRO'
]);

const COMMON_EXAM_PATTERNS = [
  ...Array.from({ length: 15 }, (_, index) => ({
    id: `PART_TEST_${index + 1}`,
    name: `Part Test ${index + 1}`,
    type: 'PART_TEST'
  })),
  ...Array.from({ length: 3 }, (_, index) => ({
    id: `UNIT_TEST_${index + 1}`,
    name: `Unit Test ${index + 1}`,
    type: 'UNIT_TEST'
  })),
  ...Array.from({ length: 2 }, (_, index) => ({
    id: `GRAND_TEST_${index + 1}`,
    name: `Grand Test ${index + 1}`,
    type: 'GRAND_TEST'
  }))
];

const getExamPatternsByProgram = (program) =>
  SUPPORTED_PROGRAMS.has(program) ? COMMON_EXAM_PATTERNS : [];

export default function ExamRegistration({ schools = [] }) {
  const [selectedSchool, setSelectedSchool] = useState('');
  const [schoolData, setSchoolData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [examForm, setExamForm] = useState({
    examPattern: '',
    examDate: '',
    examName: '',
    classSection: '',
    max_marks_physics: '',
    max_marks_maths: '',
    max_marks_biology: '',
    max_marks_chemistry: ''
  });

  // File upload state (for OMRUploadView)
  const [file, setFile] = useState({});
  const [uploading, setUploading] = useState({});
  const [uploadError, setUploadError] = useState({});
  const [examResults, setExamResults] = useState({});
  const [currentOMRExam, setCurrentOMRExam] = useState(null);
  const [examDatasets, setExamDatasets] = useState([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [activeTab, setActiveTab] = useState('registration');

  // Fetch school data when selected
  useEffect(() => {
    if (!selectedSchool) {
      setSchoolData(null);
      setExamForm(prev => ({ ...prev, examPattern: '', classSection: '' }));
      return;
    }

    const fetchSchool = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/api/schools/${selectedSchool}`);
        if (!res.ok) throw new Error('Failed to load school');
        const data = await res.json();
        setSchoolData(data); // data = { school, classes, teachers }
      } catch (err) {
        setError(err.message);
        setSchoolData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSchool();
  }, [selectedSchool]);

  useEffect(() => {
    if (!selectedSchool) {
      setExamDatasets([]);
      setSelectedDataset(null);
      return;
    }

    let cancelled = false;
    const loadDatasets = async () => {
      setDatasetsLoading(true);
      try {
        const datasets = await getExamDatasets(selectedSchool);
        if (!cancelled) setExamDatasets(datasets);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load existing exams');
      } finally {
        if (!cancelled) setDatasetsLoading(false);
      }
    };

    loadDatasets();
    return () => { cancelled = true; };
  }, [selectedSchool, examResults]);

  // Reset form when school changes
  useEffect(() => {
    setExamForm({
      examPattern: '',
      examDate: '',
      classSection: ''
    });
    setCurrentOMRExam(null);
    setSelectedDataset(null);
  }, [selectedSchool]);

  // Handle form change
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setExamForm(prev => ({ ...prev, [name]: value }));
  };
 // Get exam options based on school's programs
const getExamOptions = () => {
  if (!schoolData?.classes?.length) return [];

  const availablePrograms = [...new Set(
    schoolData.classes
      .map(cls => cls.program?.toUpperCase())
      .filter(program => program && SUPPORTED_PROGRAMS.has(program))
  )];

  if (availablePrograms.length === 0) return [];

  // Generate exams for all available programs
  let allExams = [];
  availablePrograms.forEach(programCode => {
    getExamPatternsByProgram(programCode).forEach(exam => {
      allExams.push({
        id: `${selectedSchool}_${programCode}_${exam.id}`,
        exam_pattern: exam.id,
        display_name: `${programCode} - ${exam.name}`,
        program: programCode,
        school_id: selectedSchool,
        type: exam.type
      });
    });
  });

  return allExams;
};
// Handle form submission
const handleSubmit = (e) => {
  e.preventDefault();

  if (!examForm.examPattern || !examForm.examDate || !examForm.classSection) {
    alert('Please fill all fields.');
    return;
  }

  const examOptions = getExamOptions();
  const selectedExam = examOptions.find(exam => exam.id === examForm.examPattern);

  if (!selectedExam) {
    alert('Invalid exam selected.');
    return;
  }
  // ✅ Split by LAST dash to handle formats like "GRADE-6-A" or "6-A"
  const classSection = examForm.classSection;
  const lastDashIndex = classSection.lastIndexOf('-');

  if (lastDashIndex <= 0 || lastDashIndex === classSection.length - 1) {
    alert('Invalid Class-Section format. Expected format: "CLASS-SECTION" (e.g., "GRADE-6-A" or "6-A")');
    return;
  }

  const examClass = classSection.substring(0, lastDashIndex).trim(); // e.g., "GRADE-6"
  const examSection = classSection.substring(lastDashIndex + 1).trim(); // e.g., "A"

  console.log('Final class:', examClass); // 👈 Must be "GRADE-6"
  console.log('Final section:', examSection); // 👈 Must be "A"

  if (!examClass || !examSection) {
    alert('Class or Section cannot be empty.');
    return;
  }

  // ✅ Generate a temporary ID (not stored in DB)
  const tempExamId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // ✅ Set currentOMRExam with temp ID and all exam context
  setCurrentOMRExam({
    ...selectedExam,
    id: tempExamId, // 👈 Temporary ID for React state only
    date: examForm.examDate,
    exam_name: examForm.examName || selectedExam.display_name,
    class_section: examForm.classSection,
    school_name: schoolData?.school?.school_name || 'Unknown School',
    program: selectedExam.program,
    area: schoolData?.school?.area || 'N/A',
    school_id: schoolData?.school?.school_id || selectedSchool,
    max_marks_physics: examForm.max_marks_physics || 50,
    max_marks_maths: examForm.max_marks_maths || 50,
    max_marks_chemistry: examForm.max_marks_chemistry || 50,
    max_marks_biology: examForm.max_marks_biology || 50
  });

  // Optional: Show success message
  alert('Exam configured successfully! Proceeding to OMR upload.');
};

  const handleViewDataset = async dataset => {
    setError('');
    try {
      const results = await getExamDatasetResults(selectedSchool, dataset);
      setExamResults(previous => ({ ...previous, [dataset.key]: results }));
      setSelectedDataset(dataset);
    } catch (err) {
      setError(err.message || 'Failed to load exam results');
    }
  };

  const handleDeleteDataset = async dataset => {
    const label = `${dataset.program} ${dataset.exam_pattern}, ${dataset.class}-${dataset.section}, ${dataset.exam_date}`;
    if (!window.confirm(`Delete the complete exam dataset for ${label}? This cannot be undone.`)) return;

    setError('');
    try {
      const result = await deleteExamDataset(selectedSchool, dataset);
      if (!result.analyticsRecalculated) {
        setError('Exam deleted, but one or more analytics recalculations need attention.');
      }
      setExamDatasets(previous => previous.filter(item => item.key !== dataset.key));
      setExamResults(previous => {
        const next = { ...previous };
        delete next[dataset.key];
        return next;
      });
      if (selectedDataset?.key === dataset.key) setSelectedDataset(null);
    } catch (err) {
      setError(err.message || 'Failed to delete exam data');
    }
  };
  // PDF download handler (dummy — replace with your logic)
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
          'Total Max Marks',
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
          'All India Rank'
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

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ color: '#1e90ff', marginBottom: '30px' }}>📝 Exam Registration</h2>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '26px' }}>
        {[
          { id: 'registration', label: 'Registration' },
          { id: 'view', label: 'View Exams' }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'view') setSelectedDataset(null);
              }}
              style={{
                padding: '11px 18px',
                background: isActive ? '#1e90ff' : '#fff',
                color: isActive ? '#fff' : '#1e90ff',
                border: '1px solid #1e90ff',
                borderRadius: '5px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{
          padding: '10px',
          background: '#fff5f5',
          border: '1px solid #e3342f',
          color: '#e3342f',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {/* School Selection */}
      <div style={{ marginBottom: '30px' }}>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
          Select School *
        </label>
        <select
          value={selectedSchool}
          onChange={(e) => setSelectedSchool(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '16px'
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

      {/* Auto-filled school info */}
      {schoolData && (
        <div style={{
          background: '#f8f9fa',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '30px',
          border: '1px solid #e9ecef'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>🏫 School Information</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div><strong>School Name:</strong> {schoolData.school?.school_name || '—'}</div>
            <div>
              <strong>Program(s):</strong> {schoolData.classes && schoolData.classes.length > 0
                ? [...new Set(schoolData.classes.map(c => c.program).filter(Boolean))].join(', ')
                : '—'}
            </div>
            <div><strong>Area:</strong> {schoolData.school?.area || '—'}</div>
            <div><strong>Total Classes:</strong> {schoolData.classes?.length || 0}</div>
          </div>
        </div>
      )}

      {loading && <p>Loading school data...</p>}

      {schoolData && activeTab === 'registration' && (
  <form onSubmit={handleSubmit} style={{ background: '#fff', padding: '25px', borderRadius: '8px', border: '1px solid #ddd' }}>
    <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>📋 Register New Exam</h3>

    {/* Exam Pattern */}
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
        Select Exam *
      </label>
      <select
        name="examPattern"
        value={examForm.examPattern}
        onChange={handleFormChange}
        style={{
          width: '100%',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '16px'
        }}
        required
      >
        <option value="">-- Select Exam --</option>
        {getExamOptions().map(exam => (
          <option key={exam.id} value={exam.id}>
            {exam.display_name}
          </option>
        ))}
      </select>
    </div>

    {/* Exam Date */}
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
        Exam Date *
      </label>
      <input
        type="date"
        name="examDate"
        value={examForm.examDate}
        onChange={handleFormChange}
        style={{
          width: '100%',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '16px'
        }}
        required
      />
    </div>

    {/* Class-Section */}
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
        Class-Section *
      </label>
      <select
        name="classSection"
        value={examForm.classSection}
        onChange={handleFormChange}
        style={{
          width: '100%',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '16px'
        }}
        required
      >
        <option value="">-- Select Class-Section --</option>
        {schoolData.classes?.map(cls => (
          <option key={`${cls.class}-${cls.section}`} value={`${cls.class}-${cls.section}`}>
            {cls.class} - {cls.section}
          </option>
        ))}
      </select>
    </div>

    {/* Max Marks for Subjects (only shown if exam is selected) */}
{examForm.examPattern && (
  <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '6px', border: '1px solid #eee' }}>
    <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>📚 Max Marks per Subject</h4>
    {['Physics', 'Maths', 'Biology', 'Chemistry'].map(subject => {
      const fieldName = `max_marks_${subject.toLowerCase()}`;
      return (
        <div key={subject} style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
            {subject} (Max Marks)
          </label>
          <input
            type="number"
            name={fieldName}
            value={examForm[fieldName] || ''}
            onChange={handleFormChange}
            min="0"
            step="1"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '15px'
            }}
            required
          />
        </div>
      );
    })}
  </div>
)}

    {/* Submit Button */}
    <button
      type="submit"
      style={{
        padding: '12px 30px',
        background: '#28a745',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'block',
        margin: '0 auto'
      }}
    >
      🚀 Register & Upload OMR
    </button>
  </form>
)}
      {/* OMR Upload View (shown after submit) */}
      {activeTab === 'registration' && currentOMRExam && (
        <OMRUploadView
          currentOMRExam={currentOMRExam}
          file={file}
          setFile={setFile}
          uploading={uploading}
          setUploading={setUploading}
          uploadError={uploadError}
          setUploadError={setUploadError}
          examResults={examResults}
          setExamResults={setExamResults}
          setCurrentOMRExam={setCurrentOMRExam}
          downloadPDF={downloadPDF}
        />
      )}

      {activeTab === 'view' && selectedSchool && (
        <div style={{ marginTop: '30px', background: '#fff', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
          {!selectedDataset && (
            <>
              <h3 style={{ marginTop: 0 }}>Existing Exams</h3>
              {datasetsLoading ? (
                <p>Loading existing exams...</p>
              ) : examDatasets.length === 0 ? (
                <p style={{ color: '#666' }}>No uploaded exams found for this school.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        {['Exam', 'Program', 'Class-Section', 'Exam Date', 'Students', 'Actions'].map(header => (
                          <th key={header} style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {examDatasets.map(dataset => (
                        <tr key={dataset.key}>
                          <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{dataset.exam_pattern.replaceAll('_', ' ')}</td>
                          <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{dataset.program}</td>
                          <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{dataset.class}-{dataset.section}</td>
                          <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{dataset.exam_date}</td>
                          <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{dataset.student_count}</td>
                          <td style={{ padding: '10px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => handleViewDataset(dataset)}
                              style={{ marginRight: '8px', padding: '7px 12px', color: '#fff', background: '#1e90ff', border: 0, borderRadius: '4px', cursor: 'pointer' }}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDataset(dataset)}
                              style={{ padding: '7px 12px', color: '#fff', background: '#dc3545', border: 0, borderRadius: '4px', cursor: 'pointer' }}
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
            </>
          )}

          {selectedDataset && examResults[selectedDataset.key] && (
            <div style={{ marginTop: '24px', overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>{selectedDataset.program} — {selectedDataset.exam_pattern} Results</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedDataset(null)}
                    style={{ padding: '7px 12px', color: '#fff', background: '#1e90ff', border: 0, borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    ← Back to Existing Exams
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPDF({ ...selectedDataset, id: selectedDataset.key })}
                    style={{ padding: '7px 12px', color: '#fff', background: '#1e90ff', border: 0, borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Download PDF
                  </button>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    {[
                      'Student ID',
                      'Student Name',
                      'Total Max Marks',
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
                      'All India Rank'
                    ].map(header => (
                      <th key={header} style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {examResults[selectedDataset.key].map(result => (
                    <tr key={result.id || result.student_id}>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{result.student_id}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{`${result.first_name || ''} ${result.last_name || ''}`.trim() || '-'}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{result.total_questions ?? 0}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{result.correct_answers ?? 0}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{result.wrong_answers ?? 0}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{result.unattempted ?? 0}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{result.physics_marks ?? 0}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{result.chemistry_marks ?? 0}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{result.maths_marks ?? 0}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{result.biology_marks ?? 0}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{result.total_marks ?? 0}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{result.percentage ?? 0}%</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{result.class_rank || '-'}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{result.school_rank || '-'}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{result.all_schools_rank || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
