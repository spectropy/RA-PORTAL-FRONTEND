// src/components/SchoolOwnerDashboard.jsx
import React, { useState, useEffect } from "react";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function SchoolOwnerDashboard({ onBack }) {
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [classAverages, setClassAverages] = useState([]);
  const [subjectSummaries, setSubjectSummaries] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  
  // 🔄 Navigation State
  const [view, setView] = useState('overview'); // 'overview', 'batch', 'class-section', 'class-section-exam'
  const [selectedClassSection, setSelectedClassSection] = useState(null); // { class, section }
  const [selectedExam, setSelectedExam] = useState(null); // { id, exam_pattern, class, section, school_id, program }

  // For OMR Results (view only — no upload)
  const [examResults, setExamResults] = useState({});
  const [currentOMRExam, setCurrentOMRExam] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false); // 👈 New loading state

  // 📝 Exam Wise View State (isolated from batch flow)
  const [examWiseClassSection, setExamWiseClassSection] = useState(null);
  const [examWiseExams, setExamWiseExams] = useState([]);
  const [examWiseLoading, setExamWiseLoading] = useState(false);

  const schoolId = sessionStorage.getItem("sp_school_id");

  // 📥 Fetch School + Analytics
  useEffect(() => {
    if (!schoolId) {
      setError("No school ID found. Please log in again.");
      setLoading(false);
      return;
    }

    const fetchSchoolAndAnalytics = async () => {
      try {
        const schoolRes = await fetch(`${API_BASE}/api/schools/${schoolId}`);
        if (!schoolRes.ok) throw new Error("School not found");
        const schoolData = await schoolRes.json();

        const schoolWithRelations = {
          ...schoolData.school,
          classes: schoolData.classes || [],
          teachers: schoolData.teachers || []
        };

        setSchool(schoolWithRelations);

        setAnalyticsLoading(true);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setAnalyticsLoading(false);
      }
    };

    fetchSchoolAndAnalytics();
  }, [schoolId]);

  // 📄 PDF Download Handler
  const downloadPDF = (type, data, title) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    if (type === 'class-averages' && data.length > 0) {
      doc.autoTable({
        startY: 40,
        head: [['Class', 'Group', 'Exam Pattern', 'Physics', 'Chemistry', 'Maths', 'Biology', 'Total %']],
        body: data.map(row => [
          row.class || '-',
          row.group || '-',
          row.exam_pattern || '-',
          (row.physics_average ?? 0).toFixed(2),
          (row.chemistry_average ?? 0).toFixed(2),
          (row.maths_average ?? 0).toFixed(2),
          (row.biology_average ?? 0).toFixed(2),
          (row.total_percentage ?? 0).toFixed(2)
        ])
      });
    } else if (type === 'subject-summaries' && data.length > 0) {
      doc.autoTable({
        startY: 40,
        head: [['Class', 'Subject', 'Exam Pattern', 'Avg %', 'Teachers']],
        body: data.map(row => [
          row.class || '-',
          row.subject || '-',
          row.exam_pattern || '-',
          (row.total_percentage ?? 0).toFixed(2),
          Array.isArray(row.teachers_assigned_names) ? row.teachers_assigned_names.join(', ') : '-'
        ])
      });
    }

    doc.save(`${type}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // 🔍 Navigate to Class-Section View
  const handleViewClassSection = (cls, sec) => {
    setSelectedClassSection({ class: cls, section: sec });
    setView('class-section');
  };

  // 🔍 Navigate to Class-Section-Exam View
  const handleViewClassSectionExam = async (exam) => {
  if (!selectedClassSection || !schoolId) {
    setError("Missing class, section, or school ID");
    return;
  }

  try {
    // 👇 STEP 0: Look up REAL section from school.classes using class + group
    // selectedClassSection.section currently holds "PCM" (which is GROUP)
    const matchingClasses = school.classes.filter(c => 
      c.class === selectedClassSection.class && 
      c.group === selectedClassSection.section  // 👈 because "section" here is actually GROUP
    );

    if (matchingClasses.length === 0) {
      throw new Error(`No class found for ${selectedClassSection.class} - ${selectedClassSection.section}`);
    }

    // 👇 Use the first matching section (or handle multiple if needed)
    const realSection = matchingClasses[0].section;

    console.log('🔍 Searching for exam with:', {
      school_id: schoolId,
      exam_pattern: exam.exam_pattern,
      class: selectedClassSection.class,
      section: realSection  // 👈 Use REAL section like "A", "B", "C"
    });

    // 👇 STEP 1: Fetch real exam ID from exams table
    const queryParams = new URLSearchParams({
      school_id: schoolId,
      exam_pattern: exam.exam_pattern,
      class: selectedClassSection.class,
      section: realSection  // 👈 FIXED: use real section
    });

    const response = await fetch(`${API_BASE}/api/exams?${queryParams}`);
    if (!response.ok) throw new Error("Failed to find exam");

    const exams = await response.json();
    if (exams.length === 0) {
      console.warn("❌ No exams found. Available exams in DB for this class-section:", {
        school_id: schoolId,
        class: selectedClassSection.class,
        section: realSection
      });

      // 👇 Fetch ALL exams for this class-section to debug
      const fallbackQuery = new URLSearchParams({
        school_id: schoolId,
        class: selectedClassSection.class,
        section: realSection
      });
      const allExamsRes = await fetch(`${API_BASE}/api/exams?${fallbackQuery}`);
      const allExams = await allExamsRes.json();
      console.log("📋 All exams for this class-section:", allExams.map(e => e.exam_pattern));

      throw new Error(`No exam found for pattern: ${exam.exam_pattern}`);
    }

    const realExam = exams[0];

    // 👇 STEP 2: Create exam object with REAL id
    const examWithRealId = {
      ...exam,
      id: realExam.id,
      class: selectedClassSection.class,
      section: realSection,  // 👈 Use real section
      school_id: schoolId,
      program: realExam.program,
      exam_template: realExam.exam_template
    };

    setSelectedExam(examWithRealId);
    setView('class-section-exam');
    setCurrentOMRExam(examWithRealId);

    // 👇 STEP 3: Fetch results immediately
    setResultsLoading(true);
    const resultsRes = await fetch(`${API_BASE}/api/exams/${realExam.id}/results`);
    if (!resultsRes.ok) throw new Error("Failed to load exam results");

    const results = await resultsRes.json();
    setExamResults(prev => ({
      ...prev,
      [realExam.id]: results
    }));
    setResultsLoading(false);

  } catch (err) {
    setError("Failed to load exam: " + err.message);
    console.error("💥 Exam loading error:", err);
    setResultsLoading(false);
  }
};
  // 🔄 Reset View — FIXED NAVIGATION
  const goBack = () => {
    if (view === 'class-section-exam') {
      setView('class-section');
      setSelectedExam(null);
      setCurrentOMRExam(null);
    } else if (view === 'class-section') {
      setView('batch'); // 👈 Go back to batch view (not overview)
    } else if (view === 'batch') {
      setView('overview'); // 👈 Then to overview
      setSelectedClassSection(null);
    }
  };

  // 📊 Get Batch-wise Aggregates (from classAverages)
  const getBatchWiseData = () => {
    const map = new Map();

    classAverages.forEach(row => {
      const key = `${row.class}-${row.group}`;
      if (!map.has(key)) {
        map.set(key, {
          class: row.class,
          section: row.group,
          physics: [],
          chemistry: [],
          maths: [],
          biology: []
        });
      }
      const batch = map.get(key);
      batch.physics.push(row.physics_average);
      batch.chemistry.push(row.chemistry_average);
      batch.maths.push(row.maths_average);
      batch.biology.push(row.biology_average);
    });

    return Array.from(map.values()).map(batch => ({
      ...batch,
      physics: (batch.physics.reduce((a,b) => a+b, 0) / batch.physics.length).toFixed(2),
      chemistry: (batch.chemistry.reduce((a,b) => a+b, 0) / batch.chemistry.length).toFixed(2),
      maths: (batch.maths.reduce((a,b) => a+b, 0) / batch.maths.length).toFixed(2),
      biology: (batch.biology.reduce((a,b) => a+b, 0) / batch.biology.length).toFixed(2),
      total: (
        parseFloat(batch.physics) +
        parseFloat(batch.chemistry) +
        parseFloat(batch.maths) +
        parseFloat(batch.biology)
      ) / 4
    }));
  };

  // 📊 Get Exam-wise Data for Selected Class-Section
  const getClassSectionExams = () => {
    if (!selectedClassSection) return [];
    return classAverages.filter(row =>
      row.class === selectedClassSection.class &&
      row.group === selectedClassSection.section
    );
  };

  if (loading) return <p>Loading school data...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  if (!school) return <p>No school data available.</p>;

  // 🖼️ Render School Header
  const renderSchoolHeader = () => (
    <div style={{
      textAlign: 'center',
      padding: '30px 20px',
      background: '#f0f9ff',
      borderRadius: '12px',
      marginBottom: '30px',
      border: '1px solid #bae6fd'
    }}>
      <img
        src={school.logo_url || '/default-school-logo.png'}
        alt="School Logo"
        style={{ height: '80px', marginBottom: '16px', borderRadius: '8px' }}
        onError={(e) => { e.target.src = '/placeholder-logo.png'; }}
      />
      <h1 style={{ color: '#0891b2', margin: '0 0 8px 0' }}>
        {school.school_name || 'Unknown School'}
      </h1>
      <p style={{ margin: '4px 0', color: '#374151' }}>
        {school.area || 'Area Not Set'}
      </p>
      <p style={{ fontSize: '18px', fontWeight: '500', color: '#065f46' }}>
        👋 Dear Correspondent, Welcome to your School RA Portal
      </p>
    </div>
  );

  // 📊 Render Performance Metric Buttons — Centered Heading, Clean & Professional
const renderMetricButtons = () => (
  <div style={{
    textAlign: 'center',
    padding: '32px 20px',
    background: '#f8fafc',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    marginBottom: '30px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  }}>
    {/* Centered Heading */}
    <h3 style={{
      margin: '0 0 24px 0',
      color: '#1e293b',
      fontWeight: 600,
      fontSize: '18px',
      letterSpacing: '0.5px'
    }}>
      Performance Metrics
    </h3>

    {/* Button Container */}
    <div style={{
      display: 'flex',
      gap: '16px',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      {[
        { label: 'Subject Wise', key: 'subject' },
        { label: 'Teacher Wise', key: 'teacher' },
        { label: 'Batch(Exam Wise)', key: 'exam' },
        { label: 'Student Wise', key: 'student' }
      ].map(btn => (
        <button
          key={btn.key}
          onClick={() => setView(btn.key)}
          style={{
            padding: '12px 24px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '14px',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
            minWidth: '130px'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#2563eb';
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#3b82f6';
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
          }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  </div>
);

  // 📚 Render IIT Foundation Batches Table
  const renderIITBatches = () => {
    const totalStrength = Array.isArray(school.classes)
      ? school.classes.reduce((sum, c) => sum + (c.num_students || 0), 0)
      : 0;

    return (
      <div style={card}>
        <h2>📚 IIT Foundation Batches ({Array.isArray(school.classes) ? school.classes.length : 0})</h2>
        {Array.isArray(school.classes) && school.classes.length > 0 ? (
          <>
            <table style={dataTable}>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Foundation</th>
                  <th>Program</th>
                  <th>Group</th>
                  <th>Students</th>
                </tr>
              </thead>
              <tbody>
                {school.classes.map((c, i) => (
                  <tr key={i}>
                    <td>{c.class || '-'}</td>
                    <td>{c.section || '-'}</td>
                    <td>{c.foundation || '-'}</td>
                    <td>{c.program || '-'}</td>
                    <td>{c.group || '-'}</td>
                    <td>{c.num_students || 0}</td>
                  </tr>
                ))}
                <tr style={{ background: '#f1f5f9', fontWeight: 'bold' }}>
                  <td colSpan="5" style={{ textAlign: 'right' }}>Total Strength:</td>
                  <td>{totalStrength}</td>
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <p>No batches added yet.</p>
        )}
      </div>
    );
  };

  const renderExamWiseView = () => {
  // Get unique class-section pairs from school.classes
  const classSections = Array.isArray(school.classes)
    ? school.classes.map(c => ({ class: c.class, section: c.section }))
    : [];

  // Handle class-section selection
  const handleSelectClassSection = async (cls, sec) => {
    setExamWiseClassSection({ class: cls, section: sec });
    setExamWiseLoading(true);
    try {
      const params = new URLSearchParams({
        school_id: schoolId,
        class: cls,
        section: sec
      });
      const res = await fetch(`${API_BASE}/api/exams?${params}`);
      const exams = await res.json();

      // Deduplicate by exam_pattern + exam_date
      const seen = new Set();
      const uniqueExams = exams.filter(exam => {
        const key = `${exam.exam_pattern}|${exam.exam_date || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setExamWiseExams(uniqueExams);
    } catch (err) {
      setError("Failed to load exams: " + err.message);
      setExamWiseExams([]);
    } finally {
      setExamWiseLoading(false);
    }
  };

  // Handle "View Exam Result"
  const handleViewExamResult = async (exam) => {
  setResultsLoading(true);
  try {
    const params = new URLSearchParams({
      school_id: schoolId,
      class: exam.class,
      section: exam.section,
      exam_pattern: exam.exam_pattern,
      exam_date: exam.exam_date || ''
    });
    const res = await fetch(`${API_BASE}/api/exams?${params}`);
    const results = await res.json();

    const examKey = `examwise_${exam.class}_${exam.section}_${exam.exam_pattern}_${exam.exam_date || 'latest'}`;
    setExamResults(prev => ({ ...prev, [examKey]: results }));
    setCurrentOMRExam({
      ...exam,
      id: examKey,
      key: examKey
    });
    setView('examwise-results'); // ✅ ADD THIS LINE
  } catch (err) {
    setError("Failed to load results: " + err.message);
  } finally {
    setResultsLoading(false);
  }
};
  // Main Exam Wise view
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2>📝 Exam Wise Results</h2>
        <button onClick={() => setView('overview')} style={backButton}>← Back to Overview</button>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
          Select Class - Section:
        </label>
        <select
          onChange={(e) => {
            const [cls, sec] = e.target.value.split('|');
            if (cls && sec) handleSelectClassSection(cls, sec);
          }}
          style={{
            padding: '10px',
            fontSize: '16px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            minWidth: '250px'
          }}
        >
          <option value="">-- Choose Class - Section --</option>
          {classSections.map((cs, i) => (
            <option key={i} value={`${cs.class}|${cs.section}`}>
              {cs.class} - {cs.section}
            </option>
          ))}
        </select>
      </div>

      {examWiseClassSection && (
        <>
          <h3 style={{ marginBottom: '16px', color: '#1e293b' }}>
            Exams for {examWiseClassSection.class} - {examWiseClassSection.section}
          </h3>
          {examWiseLoading ? (
            <p>Loading exams...</p>
          ) : examWiseExams.length > 0 ? (
            <table style={dataTable}>
              <thead>
                <tr>
                  <th>Program</th>
                  <th>Exam Date</th>
                  <th>Exam Pattern</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {examWiseExams.map((exam, i) => (
                  <tr key={i}>
                    <td>{exam.program || '-'}</td>
                    <td>{exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : '-'}</td>
                    <td>{exam.exam_pattern || '-'}</td>
                    <td>
                      <button
                        onClick={() => handleViewExamResult(exam)}
                        style={{
                          padding: '6px 12px',
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        View Exam Result
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No exams found for this class-section.</p>
          )}
        </>
      )}
    </div>
  );
};

const renderExamWiseResultsView = () => {
  if (!currentOMRExam) {
    setView('exam'); // fallback
    return null;
  }

  const results = examResults[currentOMRExam.id] || [];

  // ===== 1. SUBJECT AVERAGES (as PERCENTAGES) =====
  const totalStudents = results.length;
  const subjectSums = { physics: 0, chemistry: 0, maths: 0, biology: 0 };
  results.forEach(r => {
    subjectSums.physics += r.physics_marks || 0;
    subjectSums.chemistry += r.chemistry_marks || 0;
    subjectSums.maths += r.maths_marks || 0;
    subjectSums.biology += r.biology_marks || 0;
  });

  // 🔢 Calculate percentages using max_marks from currentOMRExam or default 50
  const maxPhysics = parseInt(currentOMRExam.max_marks_physics) || 50;
  const maxChemistry = parseInt(currentOMRExam.max_marks_chemistry) || 50;
  const maxMaths = parseInt(currentOMRExam.max_marks_maths) || 50;
  const maxBiology = parseInt(currentOMRExam.max_marks_biology) || 50;

  const subjectAverages = {
    physics: totalStudents > 0 ? ((subjectSums.physics / totalStudents) / maxPhysics * 100).toFixed(2) : '0.00',
    chemistry: totalStudents > 0 ? ((subjectSums.chemistry / totalStudents) / maxChemistry * 100).toFixed(2) : '0.00',
    maths: totalStudents > 0 ? ((subjectSums.maths / totalStudents) / maxMaths * 100).toFixed(2) : '0.00',
    biology: totalStudents > 0 ? ((subjectSums.biology / totalStudents) / maxBiology * 100).toFixed(2) : '0.00'
  };

  // ===== 2. SUBJECT-WISE TOPPERS — SINGLE MERGED TABLE =====
  const getTopStudents = (subjectKey) => {
    return [...results]
      .sort((a, b) => (b[subjectKey] || 0) - (a[subjectKey] || 0))
      .slice(0, 5)
      .map((r, idx) => ({
        rank: idx + 1,
        name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || '-',
        marks: r[subjectKey] || 0,
        percentage: maxMarks => maxMarks > 0 ? parseFloat(((r[subjectKey] || 0) / maxMarks * 100).toFixed(2)) : 0
      }));
  };

  const physicsToppers = getTopStudents('physics_marks');
  const chemistryToppers = getTopStudents('chemistry_marks');
  const mathsToppers = getTopStudents('maths_marks');
  const biologyToppers = getTopStudents('biology_marks');

  // Build merged rows (rank 1 to 5)
  const topperRows = Array.from({ length: 5 }, (_, i) => ({
    rank: i + 1,
    physics: physicsToppers[i] || { name: '-', marks: 0, percentage: () => 0 },
    chemistry: chemistryToppers[i] || { name: '-', marks: 0, percentage: () => 0 },
    maths: mathsToppers[i] || { name: '-', marks: 0, percentage: () => 0 },
    biology: biologyToppers[i] || { name: '-', marks: 0, percentage: () => 0 }
  }));

  // ===== 3. GRADE-WISE DISTRIBUTION =====
  const gradeRanges = [
    { label: '91-100', min: 91, max: 100 },
    { label: '81-90', min: 81, max: 90 },
    { label: '71-80', min: 71, max: 80 },
    { label: '61-70', min: 61, max: 70 },
    { label: '51-60', min: 51, max: 60 },
    { label: '41-50', min: 41, max: 50 },
    { label: '0-40', min: 0, max: 40 }
  ];

  const gradeCounts = {};
  gradeRanges.forEach(range => {
    gradeCounts[range.label] = {
      physics: 0,
      chemistry: 0,
      maths: 0,
      biology: 0
    };
  });

  results.forEach(r => {
    const subjects = [
      { key: 'physics_marks', name: 'physics', max: maxPhysics },
      { key: 'chemistry_marks', name: 'chemistry', max: maxChemistry },
      { key: 'maths_marks', name: 'maths', max: maxMaths },
      { key: 'biology_marks', name: 'biology', max: maxBiology }
    ];
    subjects.forEach(sub => {
      const marks = r[sub.key] || 0;
      const percentage = sub.max > 0 ? (marks / sub.max) * 100 : 0;

      for (const range of gradeRanges) {
        if (percentage >= range.min && percentage <= range.max) {
          gradeCounts[range.label][sub.name]++;
          break;
        }
      }
    });
  });

  return (
    <div style={{ marginTop: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2>📄 {currentOMRExam.class}-{currentOMRExam.section} | {currentOMRExam.exam_pattern}</h2>
        <button
          onClick={() => setView('exam')}
          style={backButton}
        >
          ← Back to Exams
        </button>
      </div>

      {/* === ANALYSIS SECTION === */}
      <div style={{ marginTop: '40px' }}>

        {/* 1. Subject Averages (Percentages) */}
        <div style={{ marginBottom: '30px', padding: '20px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', textAlign: 'center' }}>📊 Subject Averages (%)</h3>
          <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
            {Object.entries(subjectAverages).map(([subject, avg]) => (
              <div key={subject} style={{
                textAlign: 'center',
                padding: '12px',
                minWidth: '120px',
                background: '#fff',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'capitalize' }}>{subject}</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>{avg}%</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Avg %</div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Subject-wise Toppers — SINGLE TABLE */}
        <div style={{ marginBottom: '30px', padding: '20px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: '0', color: '#065f46', textAlign: 'center' }}>🏆 Subject-wise Toppers (Top 5)</h3>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', border: '1px solid #d1fae5' }}>
            <thead>
              <tr>
                <th style={{ ...tableHeaderStyle, background: '#ecfdf5', width: '50px' }}>Rank</th>
                <th style={{ ...tableHeaderStyle, background: '#ecfdf5', width: '100px' }}>Physics</th>
                <th style={{ ...tableHeaderStyle, background: '#ecfdf5', width: '60px' }}>Marks</th>
                <th style={{ ...tableHeaderStyle, background: '#ecfdf5', width: '100px' }}>Chemistry</th>
                <th style={{ ...tableHeaderStyle, background: '#ecfdf5', width: '60px' }}>Marks</th>
                <th style={{ ...tableHeaderStyle, background: '#ecfdf5', width: '100px' }}>Maths</th>
                <th style={{ ...tableHeaderStyle, background: '#ecfdf5', width: '60px' }}>Marks</th>
                <th style={{ ...tableHeaderStyle, background: '#ecfdf5', width: '100px' }}>Biology</th>
                <th style={{ ...tableHeaderStyle, background: '#ecfdf5', width: '60px' }}>Marks</th>
              </tr>
            </thead>
            <tbody>
              {topperRows.map((row, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fafafa' : 'white' }}>
                  <td style={tableCellStyle}>{row.rank}</td>
                  <td style={tableCellStyle}>{row.physics.name}</td>
                  <td style={tableCellStyle}>{row.physics.marks}</td>
                  <td style={tableCellStyle}>{row.chemistry.name}</td>
                  <td style={tableCellStyle}>{row.chemistry.marks}</td>
                  <td style={tableCellStyle}>{row.maths.name}</td>
                  <td style={tableCellStyle}>{row.maths.marks}</td>
                  <td style={tableCellStyle}>{row.biology.name}</td>
                  <td style={tableCellStyle}>{row.biology.marks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 3. Grade-wise Distribution */}
        <div style={{ padding: '20px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#b45309', textAlign: 'center' }}>📈 Grade-wise Distribution (Per Subject)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ ...tableHeaderStyle, background: '#fef3c7' }}>Percentage Range</th>
                  <th style={{ ...tableHeaderStyle, background: '#fef3c7' }}>Physics</th>
                  <th style={{ ...tableHeaderStyle, background: '#fef3c7' }}>Chemistry</th>
                  <th style={{ ...tableHeaderStyle, background: '#fef3c7' }}>Maths</th>
                  <th style={{ ...tableHeaderStyle, background: '#fef3c7' }}>Biology</th>
                </tr>
              </thead>
              <tbody>
                {gradeRanges.map(range => (
                  <tr key={range.label} style={{ backgroundColor: 'white' }}>
                    <td style={{ ...tableCellStyle, background: '#fff9c4', fontWeight: '500' }}>{range.label}</td>
                    <td style={tableCellStyle}>{gradeCounts[range.label].physics}</td>
                    <td style={tableCellStyle}>{gradeCounts[range.label].chemistry}</td>
                    <td style={tableCellStyle}>{gradeCounts[range.label].maths}</td>
                    <td style={tableCellStyle}>{gradeCounts[range.label].biology}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
       
       <button
  onClick={() => {
    if (!results.length) return alert('No data to analyze');

    const doc = new jsPDF(); // A4 Portrait
    const pageWidth = doc.internal.pageSize.width;
    const margin = 14;
    let yPos = 20;
    
    // === BLUE HEADER BANNER (as per Fig 2) ===
    doc.setFillColor(30, 85, 160); // Deep Blue #1e55a0
    doc.rect(0, 0, pageWidth, 20, 'F'); // Full-width rectangle

    // School Name (Left)
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255); // White text
    doc.text(school.school_name || 'Unknown School', 14, 12);

    // Area (Below school name)
    doc.setFontSize(10);
    doc.text(`Area: ${school.area || 'Not Set'}`, 14, 18);

    // Powered BY SPECTROPY (Right)
    doc.setFontSize(10);
    doc.text('Powered BY SPECTROPY', pageWidth - 20, 15, { align: 'right' });
    yPos += 8;

    // === Title ===
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0); // Black text
    doc.text(`Exam Analysis Report`, margin + 60, yPos );
    yPos += 6;
    doc.setFontSize(10);
    doc.text(`${currentOMRExam.class}-${currentOMRExam.section} | ${currentOMRExam.exam_pattern}`, margin + 60, yPos);
    yPos += 6;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin + 60, yPos);
    yPos += 8;

    // === 1. Subject Averages (as Percentages) + Overall Toppers (Top 5) — SIDE BY SIDE ===
    doc.setFontSize(14);
    doc.text('Subject Averages (%)', margin, yPos);
    yPos += 6;

    // Subject Averages Table
    const avgTableData = Object.entries(subjectAverages).map(([subject, avg]) => [
      subject.charAt(0).toUpperCase() + subject.slice(1),
      `${avg}%`
    ]);

    doc.autoTable({
      startY: yPos,
      head: [['Subject', 'Average %']],
      body: avgTableData,
      theme: 'grid',
      styles: { fontSize: 11 },
      headStyles: { fillColor: [65, 105, 225] },
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 30 } }
    });
    const avgTableEndY = doc.lastAutoTable.finalY;

    // Overall Toppers (Top 5) Table — Placed beside Subject Averages
    doc.setFontSize(14);
    doc.text('Overall Toppers (Top 5)', margin + 90, yPos - 6); // 👈 Offset X to place beside
    yPos += 6;

    // Sort results by percentage (descending)
    const overallToppers = [...results]
      .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
      .slice(0, 5)
      .map((r, i) => [
        i + 1,
        `${r.first_name || ''} ${r.last_name || ''}`.trim() || '-',
        `${r.percentage || 0}%`
      ]);

    doc.autoTable({
      startY: yPos - 8,
      head: [['Rank', 'Name', 'Percentage']],
      body: overallToppers,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [34, 197, 94], fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 40 },
        2: { cellWidth: 25 }
      },
      margin: { left: margin + 90 }
    });

    // Get height of both tables for correct positioning
    const topperTableEndY = doc.lastAutoTable.finalY;
    yPos = Math.max(avgTableEndY, topperTableEndY) + 12;

    // === 2. Subject-wise Toppers (Top 5) — MERGED TABLE ===
    doc.setFontSize(14);
    doc.text('Subject-wise Toppers (Top 5)', margin, yPos);
    yPos += 6;

    // Build merged table rows
    const topperRows = Array.from({ length: 5 }, (_, i) => {
      const p = physicsToppers[i] || { name: '-', marks: 0 };
      const c = chemistryToppers[i] || { name: '-', marks: 0 };
      const m = mathsToppers[i] || { name: '-', marks: 0 };
      const b = biologyToppers[i] || { name: '-', marks: 0 };
      return [i + 1, p.name, p.marks, c.name, c.marks, m.name, m.marks, b.name, b.marks];
    });

    doc.autoTable({
      startY: yPos,
      head: [
        ['Rank', 'Physics\nName', 'Marks', 'Chemistry\nName', 'Marks', 'Maths\nName', 'Marks', 'Biology\nName', 'Marks']
      ],
      body: topperRows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [34, 197, 94], fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 25 }, 2: { cellWidth: 15 },
        3: { cellWidth: 25 }, 4: { cellWidth: 15 },
        5: { cellWidth: 25 }, 6: { cellWidth: 15 },
        7: { cellWidth: 25 }, 8: { cellWidth: 15 }
      }
    });
    yPos = doc.lastAutoTable.finalY + 12;

    // === 3. Grade-wise Distribution ===
    doc.setFontSize(14);
    doc.text('Performace Distribution', margin, yPos);
    yPos += 6;

    const gradeTableData = gradeRanges.map(range => [
      range.label,
      gradeCounts[range.label].physics,
      gradeCounts[range.label].chemistry,
      gradeCounts[range.label].maths,
      gradeCounts[range.label].biology
    ]);

    doc.autoTable({
      startY: yPos,
      head: [['Range(%)', 'Physics', 'Chemistry', 'Maths', 'Biology']],
      body: gradeTableData,
      theme: 'grid',
      styles: { fontSize: 12 ,halign: 'center'},
      headStyles: { fillColor: [65, 105, 225] },
      columnStyles: { 0: { cellWidth: 25 } }
    });

    // === Save ===
    doc.save(`Exam_Analysis_${currentOMRExam.id}.pdf`);
  }}
  style={{
    padding: '8px 16px',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500'
  }}
>
  📥 Download Analysis PDF
</button>
      {/* === STUDENT RESULTS TABLE === */}
      {resultsLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', fontSize: '16px', color: '#6b7280' }}>
          🔄 Loading exam results...
        </div>
      ) : results.length > 0 ? (
        <>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                const doc = new jsPDF('landscape');
                doc.setFontSize(18);
                doc.text(`Exam Results - ${currentOMRExam.exam_pattern}`, 14, 22);
                doc.setFontSize(12);
                doc.text(`Class: ${currentOMRExam.class} - ${currentOMRExam.section}`, 14, 30);
                const headers = [
                  'Student ID', 'Name', 'Total Q', 'Correct', 'Wrong', 'Unattempted',
                  'Physics', 'Chemistry', 'Maths', 'Biology', 'Total Marks', '%',
                  'Class Rank', 'School Rank', 'All Schools Rank'
                ];
                const body = results.map(r => [
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
                  styles: { fontSize: 8 },
                  headStyles: { fillColor: [30, 144, 255] }
                });
                doc.save(`Exam_Results_${currentOMRExam.id}.pdf`);
              }}
              style={{
                padding: '10px 20px',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              📥 Download Student Results PDF
            </button>
          </div>
          <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Student ID</th>
                  <th style={tableHeaderStyle}>Name</th>
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
                {results.map((r, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fafafa' : 'white' }}>
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
      ) : (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
          📭 No results available.
        </div>
      )}
    </div>
  );
};

  // 🖼️ Render Based on View State
  const renderContent = () => {
    switch (view) {
      case 'subject':
        return <div style={card}><h2>📚 Subject Wise (Coming Soon)</h2></div>;
      case 'teacher':
        return <div style={card}><h2>🧑‍🏫 Teacher Wise (Coming Soon)</h2></div>;
      case 'exam':
        return renderExamWiseView();
      case 'examwise-results':
        return renderExamWiseResultsView();
      case 'student':
        return <div style={card}><h2>🎓 Student Wise (Coming Soon)</h2></div>;
      default:
        return (
          <>
            {renderSchoolHeader()}
            <div style={card}>
              <h2>📌 School Details</h2>
              <table style={infoTable}>
                <tbody>
                  <tr><td><strong>School Name:</strong></td><td>{school.school_name || '-'}</td></tr>
                  <tr><td><strong>School ID:</strong></td><td>{school.school_id || '-'}</td></tr>
                  <tr><td><strong>Area:</strong></td><td>{school.area || '-'}</td></tr>
                  <tr><td><strong>District:</strong></td><td>{school.district || '-'}</td></tr>
                  <tr><td><strong>State:</strong></td><td>{school.state || '-'}</td></tr>
                  <tr><td><strong>Academic Year:</strong></td><td>{school.academic_year || '-'}</td></tr>
                </tbody>
              </table>
            </div>

            {renderIITBatches()}

            {renderMetricButtons()}
          </>
        );
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '24px auto', padding: 16 }}>
      {/* 👇 Logout / Back to Login Button — Always visible */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: '20px'
      }}>
        <button
          onClick={() => {
            sessionStorage.clear(); // Clear session
            if (onBack) onBack();   // Trigger parent logout if needed
            window.location.href = '/'; // Redirect to login
          }}
          style={{
            padding: '8px 16px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = '#dc2626'}
          onMouseLeave={(e) => e.target.style.background = '#ef4444'}
        >
          🔐 Logout / Back to Login
        </button>
      </div>

      {renderContent()}
    </div>
  );
}

// ✅ Styles
const card = {
  border: "1px solid #d3d8e6",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  background: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
};

const infoTable = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: 8,
};

const tableCell = {
  padding: '8px',
  borderBottom: '1px solid #ddd',
  color: '#333',
  textAlign: 'left',
};

Object.assign(infoTable, {
  td: tableCell,
  th: { ...tableCell, fontWeight: 'bold', background: '#f7f9fc' }
});

const dataTable = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: 8,
};

Object.assign(dataTable, {
  th: {
    padding: '10px',
    textAlign: 'left',
    background: '#f1f5f9',
    borderBottom: '2px solid #ddd',
    fontWeight: '600',
    color: '#1e293b'
  },
  td: {
    padding: '8px',
    borderBottom: '1px solid #eee',
    color: '#333'
  }
});

const backButton = {
  padding: '6px 12px',
  background: '#6b7280',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '14px'
};

// For Results Table
const tableHeaderStyle = {
  padding: '12px 8px',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  fontWeight: '600',
  textAlign: 'center',
  fontSize: '13px',
  color: '#334155'
};

const tableCellStyle = {
  padding: '10px 8px',
  border: '1px solid #e2e8f0',
  textAlign: 'center',
  fontSize: '18px',
  font: 'bold',
  color: '#1e293b'
};