// src/ExamRegistration.jsx
import React, { useState, useEffect } from 'react';
import OMRUploadView from './OMRUploadView'; // 👈 Adjust path as needed

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Exam patterns by program
const getExamPatternsByProgram = (program) => {
  switch (program) {
    case 'CAT':
    case 'FUTURE FOUNDATION':
      return [
        { id: 'PART_TEST_1', name: 'Part Test 1', type: 'PART_TEST' },
        { id: 'PART_TEST_2', name: 'Part Test 2', type: 'PART_TEST' },
        { id: 'PART_TEST_3', name: 'Part Test 3', type: 'PART_TEST' },
        { id: 'PART_TEST_4', name: 'Part Test 4', type: 'PART_TEST' },
        { id: 'PART_TEST_5', name: 'Part Test 5', type: 'PART_TEST' },
        { id: 'PART_TEST_6', name: 'Part Test 6', type: 'PART_TEST' },
        { id: 'PART_TEST_7', name: 'Part Test 7', type: 'PART_TEST' },
        { id: 'PART_TEST_8', name: 'Part Test 8', type: 'PART_TEST' },
        { id: 'UNIT_TEST_1', name: 'Unit Test 1', type: 'UNIT_TEST' },
        { id: 'UNIT_TEST_2', name: 'Unit Test 2', type: 'UNIT_TEST' },
        { id: 'UNIT_TEST_3', name: 'Unit Test 3', type: 'UNIT_TEST' },
        { id: 'GRAND_TEST_1', name: 'Grand Test 1', type: 'GRAND_TEST' },
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
    case 'NGHS_MAESTRO':
        return [
        { id: 'CDF_1', name: 'CDF 1', type: 'CDF' },
        { id: 'CDF_2', name: 'CDF 2', type: 'CDF' },
        { id: 'CDF_3', name: 'CDF 3', type: 'CDF' },
        { id: 'CDF_4', name: 'CDF 4', type: 'CDF' },
        { id: 'CDF_5', name: 'CDF 5', type: 'CDF' },
        { id: 'CDF_6', name: 'CDF 6', type: 'CDF' },
        { id: 'CDF_7', name: 'CDF 7', type: 'CDF' },
        { id: 'CDF_8', name: 'CDF 8', type: 'CDF' },
        { id: 'CDF_9', name: 'CDF 9', type: 'CDF' },
        { id: 'CDF_10', name: 'CDF 10', type: 'CDF' },
        { id: 'CDF_11', name: 'CDF 11', type: 'CDF' },
        { id: 'CDF_12', name: 'CDF 12', type: 'CDF' },
        { id: 'CDF_13', name: 'CDF 13', type: 'CDF' },
        { id: 'CDF_14', name: 'CDF 14', type: 'CDF' },
        { id: 'CDF_15', name: 'CDF 15', type: 'CDF' },
        { id: 'CDF_16', name: 'CDF 16', type: 'CDF' },
        { id: 'CDF_17', name: 'CDF 17', type: 'CDF' },
        { id: 'CDF_18', name: 'CDF 18', type: 'CDF' },
        { id: 'JEE_1', name: 'JEE 1', type: 'JEE' },
        { id: 'JEE_2', name: 'JEE 2', type: 'JEE' },
        { id: 'JEE_3', name: 'JEE 3', type: 'JEE' },
        { id: 'JEE_4', name: 'JEE 4', type: 'JEE' },
        { id: 'JEE_5', name: 'JEE 5', type: 'JEE' },
        { id: 'JEE_6', name: 'JEE 6', type: 'JEE' },
        { id: 'JEE_7', name: 'JEE 7', type: 'JEE' },
        { id: 'JEE_8', name: 'JEE 8', type: 'JEE' },
        { id: 'JEE_9', name: 'JEE 9', type: 'JEE' },
        { id: 'JEE_10', name: 'JEE 10', type: 'JEE' },
        { id: 'JEE_11', name: 'JEE 11', type: 'JEE' },
        { id: 'JEE_12', name: 'JEE 12', type: 'JEE' },
        { id: 'JEE_13', name: 'JEE 13', type: 'JEE' },
        { id: 'JEE_14', name: 'JEE 14', type: 'JEE' },
        { id: 'JEE_15', name: 'JEE 15', type: 'JEE' },
        { id: 'JEE_16', name: 'JEE 16', type: 'JEE' },
        { id: 'JEE_17', name: 'JEE 17', type: 'JEE' },
        { id: 'JEE_18', name: 'JEE 18', type: 'JEE' }
      ];
    default:
      return [];
  }
};

// Helper to generate exam label
const getExamLabel = (exam) => `${exam.type} ${exam.index}`;

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

  // Reset form when school changes
  useEffect(() => {
    setExamForm({
      examPattern: '',
      examDate: '',
      classSection: ''
    });
    setCurrentOMRExam(null);
  }, [selectedSchool]);

  // Handle form change
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setExamForm(prev => ({ ...prev, [name]: value }));
  };
 // Get exam options based on school's programs
const getExamOptions = () => {
  if (!schoolData?.classes?.length) return [];

  // Get unique, valid program codes from classes (e.g., 'MAE', 'CAT', 'PIO')
  const availablePrograms = [...new Set(
    schoolData.classes
      .map(cls => cls.program?.toUpperCase()) // e.g., 'MAE', 'CAT'
      .filter(Boolean)
  )];

  if (availablePrograms.length === 0) return [];

  // Generate exams for all available programs
  let allExams = [];
  availablePrograms.forEach(programCode => {
    const exams = getExamPatternsByProgram(programCode); // 👈 uses your new function

    exams.forEach((exam, idx) => {
      // Map program code to display name for user-friendliness
      const programDisplayName = {
        'MAE': 'MAESTRO',
        'PIO': 'PIONEER',
        'CAT': 'CATALYST'
      }[programCode] || programCode;

      allExams.push({
        id: `${schoolData.school_id}_${programCode}_${exam.id}`, // unique ID
        exam_pattern: exam.id, // e.g., 'WEEK_TEST_1'
        display_name: `${programDisplayName} - ${exam.name}`, // e.g., "MAESTRO - Week Test 1"
        program: programCode, // e.g., 'MAE'
        school_id: schoolData.school_id,
        type: exam.type // optional: if you need type later
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

      {schoolData && (
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
      {currentOMRExam && (
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
    </div>
  );
}