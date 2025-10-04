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

  // 🔄 NEW: Fetch exam results when currentOMRExam changes
  useEffect(() => {
    if (!currentOMRExam?.id) return;

    const fetchExamResults = async () => {
      setResultsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/exams/${currentOMRExam.id}/results`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to load exam results`);
        }

        const results = await response.json();
        setExamResults(prev => ({
          ...prev,
          [currentOMRExam.id]: results
        }));
      } catch (err) {
        console.error("Error fetching exam results:", err);
        setError("Failed to load results: " + err.message);
      } finally {
        setResultsLoading(false);
      }
    };

    fetchExamResults();
  }, [currentOMRExam?.id]);

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
        { label: 'Batch Wise', key: 'batch' },
        { label: 'Subject Wise', key: 'subject' },
        { label: 'Teacher Wise', key: 'teacher' },
        { label: 'Exam Wise', key: 'exam' },
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

// 🖥️ Render Batch Wise View — FIXED COLUMN TABLE
const renderBatchWise = () => {
  const batchData = getBatchWiseData();

  // 🧮 Compute Grade-wise Subject Averages
  const gradeSubjectMap = {
    Physics: {},
    Chemistry: {},
    Maths: {},
    Biology: {}
  };

  classAverages.forEach(row => {
    const cls = row.class;
    if (!gradeSubjectMap.Physics[cls]) {
      gradeSubjectMap.Physics[cls] = { total: 0, count: 0 };
      gradeSubjectMap.Chemistry[cls] = { total: 0, count: 0 };
      gradeSubjectMap.Maths[cls] = { total: 0, count: 0 };
      gradeSubjectMap.Biology[cls] = { total: 0, count: 0 };
    }

    if (row.physics_average != null) {
      gradeSubjectMap.Physics[cls].total += row.physics_average;
      gradeSubjectMap.Physics[cls].count++;
    }
    if (row.chemistry_average != null) {
      gradeSubjectMap.Chemistry[cls].total += row.chemistry_average;
      gradeSubjectMap.Chemistry[cls].count++;
    }
    if (row.maths_average != null) {
      gradeSubjectMap.Maths[cls].total += row.maths_average;
      gradeSubjectMap.Maths[cls].count++;
    }
    if (row.biology_average != null) {
      gradeSubjectMap.Biology[cls].total += row.biology_average;
      gradeSubjectMap.Biology[cls].count++;
    }
  });

  // Final grade averages per subject
  const allGrades = [...new Set(classAverages.map(r => r.class))].sort((a, b) => parseInt(a) - parseInt(b));

  const gradeAverages = {};
  allGrades.forEach(cls => {
    gradeAverages[cls] = {
      Physics: gradeSubjectMap.Physics[cls]?.count > 0 ? 
        (gradeSubjectMap.Physics[cls].total / gradeSubjectMap.Physics[cls].count).toFixed(2) : '—',
      Chemistry: gradeSubjectMap.Chemistry[cls]?.count > 0 ? 
        (gradeSubjectMap.Chemistry[cls].total / gradeSubjectMap.Chemistry[cls].count).toFixed(2) : '—',
      Maths: gradeSubjectMap.Maths[cls]?.count > 0 ? 
        (gradeSubjectMap.Maths[cls].total / gradeSubjectMap.Maths[cls].count).toFixed(2) : '—',
      Biology: gradeSubjectMap.Biology[cls]?.count > 0 ? 
        (gradeSubjectMap.Biology[cls].total / gradeSubjectMap.Biology[cls].count).toFixed(2) : '—',
    };
  });

  // School-wide averages
  const schoolSubjectTotals = {
    Physics: { total: 0, count: 0 },
    Chemistry: { total: 0, count: 0 },
    Maths: { total: 0, count: 0 },
    Biology: { total: 0, count: 0 }
  };

  classAverages.forEach(row => {
    if (row.physics_average != null) {
      schoolSubjectTotals.Physics.total += row.physics_average;
      schoolSubjectTotals.Physics.count++;
    }
    if (row.chemistry_average != null) {
      schoolSubjectTotals.Chemistry.total += row.chemistry_average;
      schoolSubjectTotals.Chemistry.count++;
    }
    if (row.maths_average != null) {
      schoolSubjectTotals.Maths.total += row.maths_average;
      schoolSubjectTotals.Maths.count++;
    }
    if (row.biology_average != null) {
      schoolSubjectTotals.Biology.total += row.biology_average;
      schoolSubjectTotals.Biology.count++;
    }
  });

  const schoolAverages = {
    Physics: schoolSubjectTotals.Physics.count > 0 ? 
      (schoolSubjectTotals.Physics.total / schoolSubjectTotals.Physics.count).toFixed(2) : '—',
    Chemistry: schoolSubjectTotals.Chemistry.count > 0 ? 
      (schoolSubjectTotals.Chemistry.total / schoolSubjectTotals.Chemistry.count).toFixed(2) : '—',
    Maths: schoolSubjectTotals.Maths.count > 0 ? 
      (schoolSubjectTotals.Maths.total / schoolSubjectTotals.Maths.count).toFixed(2) : '—',
    Biology: schoolSubjectTotals.Biology.count > 0 ? 
      (schoolSubjectTotals.Biology.total / schoolSubjectTotals.Biology.count).toFixed(2) : '—',
  };

  // Grade Total Average
  const gradeTotalAverages = {};
  allGrades.forEach(cls => {
    const values = [
      parseFloat(gradeAverages[cls].Physics),
      parseFloat(gradeAverages[cls].Chemistry),
      parseFloat(gradeAverages[cls].Maths),
      parseFloat(gradeAverages[cls].Biology)
    ].filter(val => !isNaN(val));

    gradeTotalAverages[cls] = values.length > 0 ? 
      (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : '—';
  });

  // School Total Average
  const schoolTotalValues = [
    parseFloat(schoolAverages.Physics),
    parseFloat(schoolAverages.Chemistry),
    parseFloat(schoolAverages.Maths),
    parseFloat(schoolAverages.Biology)
  ].filter(val => !isNaN(val));

  const schoolTotalAverage = schoolTotalValues.length > 0 ? 
    (schoolTotalValues.reduce((a, b) => a + b, 0) / schoolTotalValues.length).toFixed(2) : '—';

  // ✅ Fixed Column Styles
  const colWidth = {
    grade: '150px',
    physics: '120px',
    chemistry: '120px',
    maths: '120px',
    biology: '120px',
    total: '120px'
  };

  const thStyle = {
    padding: '12px 8px',
    background: '#f1f5f9',
    borderBottom: '2px solid #d3d8e6',
    fontWeight: '600',
    color: '#1e293b',
    whiteSpace: 'nowrap',
    fontSize: '14px',
    textAlign: 'center'
  };

  const tdStyle = {
    padding: '12px 8px',
    borderBottom: '1px solid #eee',
    color: '#333',
    whiteSpace: 'nowrap',
    fontSize: '14px',
    textAlign: 'center'
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2>📊 Batch Wise Performance</h2>
        <button onClick={() => setView('overview')} style={backButton}>← Back to Overview</button>
      </div>

      {/* 👇 Compact Subject Grade Table — FIXED COLUMNS */}
      <div style={{
        marginBottom: '40px',
        padding: '24px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '12px'
      }}>
        <h3 style={{ color: '#1e293b', textAlign: 'center', marginBottom: '20px' }}>
          📊 Subject Average by Grade
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            ...dataTable,
            tableLayout: 'fixed',
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px',
            textAlign: 'center',
            margin: '0 auto'
          }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: colWidth.grade }}>Grade</th>
                <th style={{ ...thStyle, width: colWidth.physics }}>Physics</th>
                <th style={{ ...thStyle, width: colWidth.chemistry }}>Chemistry</th>
                <th style={{ ...thStyle, width: colWidth.maths }}>Maths</th>
                <th style={{ ...thStyle, width: colWidth.biology }}>Biology</th>
                <th style={{ ...thStyle, width: colWidth.total }}>Total Avg</th>
              </tr>
            </thead>
            <tbody>
              {allGrades.map(cls => (
                <tr key={cls}>
                  <td style={{ ...tdStyle, width: colWidth.grade, fontWeight: 'bold' }}>Grade {cls}</td>
                  <td style={{ ...tdStyle, width: colWidth.physics }}>{gradeAverages[cls].Physics}%</td>
                  <td style={{ ...tdStyle, width: colWidth.chemistry }}>{gradeAverages[cls].Chemistry}%</td>
                  <td style={{ ...tdStyle, width: colWidth.maths }}>{gradeAverages[cls].Maths}%</td>
                  <td style={{ ...tdStyle, width: colWidth.biology }}>{gradeAverages[cls].Biology}%</td>
                  <td style={{ ...tdStyle, width: colWidth.total, fontWeight: 'bold' }}>{gradeTotalAverages[cls]}%</td>
                </tr>
              ))}
              <tr style={{ background: '#f1f5f9', fontWeight: 'bold', fontSize: '15px' }}>
                <td style={{ ...tdStyle, width: colWidth.grade }}>School Average</td>
                <td style={{ ...tdStyle, width: colWidth.physics }}>{schoolAverages.Physics}%</td>
                <td style={{ ...tdStyle, width: colWidth.chemistry }}>{schoolAverages.Chemistry}%</td>
                <td style={{ ...tdStyle, width: colWidth.maths }}>{schoolAverages.Maths}%</td>
                <td style={{ ...tdStyle, width: colWidth.biology }}>{schoolAverages.Biology}%</td>
                <td style={{ ...tdStyle, width: colWidth.total }}>{schoolTotalAverage}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 👇 Batch Summary Table */}
      <div>
        <h3 style={{ color: '#1e293b', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
          📋 Batch Summary (Drill Down)
        </h3>
        {batchData.length > 0 ? (
          <table style={dataTable}>
            <thead>
              <tr>
                <th>Class</th>
                <th>Section</th>
                <th>Physics </th>
                <th>Chemistry </th>
                <th>Maths </th>
                <th>Biology </th>
                <th>Total %</th>
                <th>School Rank</th>
                <th>Global Rank</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {batchData.map((batch, i) => (
                <tr key={i}>
                  <td>{batch.class}</td>
                  <td>{batch.section}</td>
                  <td>{batch.physics}</td>
                  <td>{batch.chemistry}</td>
                  <td>{batch.maths}</td>
                  <td>{batch.biology}</td>
                  <td>{batch.total.toFixed(2)}</td>
                  <td>-</td>
                  <td>-</td>
                  <td>
                    <button
                      onClick={() => handleViewClassSection(batch.class, batch.section)}
                      style={{
                        padding: '4px 8px',
                        background: '#0ea5e9',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      View Class-Section
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No batch data available.</p>
        )}
      </div>
    </div>
  );
};

  // 🖥️ Render Class-Section View — ENHANCED WITH TEACHER NAMES
const renderClassSectionView = () => {
  const exams = getClassSectionExams();

  if (exams.length === 0) {
    return (
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2>📊 Performance for {selectedClassSection.class} - {selectedClassSection.section}</h2>
          <button onClick={goBack} style={backButton}>← Back to Batch</button>
        </div>
        <p>No exam data for this batch.</p>
      </div>
    );
  }

  // 🔍 1. Find Best Performed Exam
  const bestExam = exams.reduce((prev, current) => 
    (current.total_percentage > prev.total_percentage) ? current : prev
  );

  // 📊 2. Calculate Cumulative Subject Averages
  const subjectTotals = exams.reduce((acc, exam) => {
    acc.Physics += exam.physics_average || 0;
    acc.Chemistry += exam.chemistry_average || 0;
    acc.Maths += exam.maths_average || 0;
    acc.Biology += exam.biology_average || 0;
    acc.count += 1;
    return acc;
  }, { Physics: 0, Chemistry: 0, Maths: 0, Biology: 0, count: 0 });

  const cumulativeAverages = {
    Physics: subjectTotals.Physics / subjectTotals.count,
    Chemistry: subjectTotals.Chemistry / subjectTotals.count,
    Maths: subjectTotals.Maths / subjectTotals.count,
    Biology: subjectTotals.Biology / subjectTotals.count
  };

  // 👩‍🏫 3. Map Subjects to Teacher Names
  const teacherMap = {};
  const subjects = ['Physics', 'Chemistry', 'Maths', 'Biology'];

  subjects.forEach(subject => {
    // Find teacher teaching this subject in this class + group
    const teacher = school.teachers?.find(t => 
      t.class === selectedClassSection.class &&
      t.section === selectedClassSection.section && // group, e.g., "PCM"
      t.subject_specialization?.toLowerCase() === subject.toLowerCase()
    );

    teacherMap[subject] = teacher?.teacher_name || 'Not Assigned';
  });

  // 🎯 4. Determine Strength & Weak Subjects
  const subjectsArray = Object.entries(cumulativeAverages).sort((a, b) => b[1] - a[1]);
  const strengthSubject = subjectsArray[0]; // Highest
  const weakSubject = subjectsArray[subjectsArray.length - 1]; // Lowest

  // 📊 Bar Chart Component with Teacher Names
  const BarChart = ({ data, maxBarWidth = 120 }) => {
    const maxValue = Math.max(...Object.values(data));
    return (
      <div style={{ marginTop: '16px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h4 style={{ margin: '0 0 16px 0', color: '#1e293b', fontWeight: 600 }}>Cumulative Subject Averages</h4>
        {Object.entries(data).map(([subject, avg], idx) => {
          const percentage = avg;
          const barWidth = (percentage / maxValue) * maxBarWidth;
          const teacherName = teacherMap[subject] || 'N/A';

          return (
            <div key={idx} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 500, color: '#334155' }}>
                <span>
                  {subject} <span style={{ fontWeight: 400, color: '#64748b', fontSize: '13px' }}>({teacherName})</span>
                </span>
                <span>{percentage.toFixed(2)}%</span>
              </div>
              <div style={{
                width: '100%',
                backgroundColor: '#e2e8f0',
                borderRadius: '4px',
                marginTop: '4px',
                height: '16px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${barWidth}px`,
                  maxWidth: '100%',
                  height: '100%',
                  background: subject === strengthSubject[0] ? '#10b981' : 
                             subject === weakSubject[0] ? '#ef4444' : '#3b82f6',
                  borderRadius: '4px',
                  transition: 'width 0.6s ease'
                }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2>📊 Performance for {selectedClassSection.class} - {selectedClassSection.section}</h2>
        <button onClick={goBack} style={backButton}>← Back to Batch</button>
      </div>

      {/* 🚀 PERFORMANCE METRICS DASHBOARD */}
      <div style={{
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '30px',
        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.1)'
      }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#065f46', fontSize: '18px', fontWeight: 600 }}>
          📈 Performance Snapshot
        </h3>

        {/* Best Exam */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '24px',
          marginBottom: '24px'
        }}>
          <div style={{
            flex: '1 1 300px',
            background: '#dbeafe',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #bfdbfe'
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#1d4ed8', fontWeight: 600 }}>🏆 Best Performed Exam</h4>
            <p style={{ margin: '4px 0', fontSize: '16px' }}><strong>Pattern:</strong> {bestExam.exam_pattern}</p>
            <p style={{ margin: '4px 0', fontSize: '16px' }}><strong>Score:</strong> {bestExam.total_percentage.toFixed(2)}%</p>
            <p style={{ margin: '4px 0', fontSize: '16px' }}><strong>School Rank:</strong> -</p>
            <p style={{ margin: '4px 0', fontSize: '16px' }}><strong>Global Rank:</strong> -</p>
          </div>

          {/* Strength & Weak */}
          <div style={{
            flex: '1 1 300px',
            display: 'flex',
            gap: '16px'
          }}>
            <div style={{
              flex: 1,
              background: '#dcfce7',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #bbf7d0'
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#059669', fontWeight: 600 }}>💪 Strength Subject</h4>
              <p style={{ margin: '8px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#059669' }}>
                {strengthSubject[0]} <span style={{ fontWeight: 400, fontSize: '14px', color: '#059669' }}>({teacherMap[strengthSubject[0]]})</span>
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>{strengthSubject[1].toFixed(2)}%</p>
            </div>
            <div style={{
              flex: 1,
              background: '#fee2e2',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #fecaca'
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#dc2626', fontWeight: 600 }}>⚠️ Weak Subject</h4>
              <p style={{ margin: '8px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#dc2626' }}>
                {weakSubject[0]} <span style={{ fontWeight: 400, fontSize: '14px', color: '#dc2626' }}>({teacherMap[weakSubject[0]]})</span>
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>{weakSubject[1].toFixed(2)}%</p>
            </div>
          </div>
        </div>

        {/* Bar Chart with Teacher Names */}
        <BarChart data={cumulativeAverages} />
      </div>

      {/* 📋 EXAM TABLE — Existing Logic */}
      <div style={{ overflowX: 'auto' }}>
        <table style={dataTable}>
          <thead>
            <tr>
              <th>Exam Pattern</th>
              <th>Physics </th>
              <th>Chemistry </th>
              <th>Maths </th>
              <th>Biology </th>
              <th>Total </th>
              <th>School Rank</th>
              <th>Global Rank</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {exams.map((exam, i) => (
              <tr key={i}>
                <td>{exam.exam_pattern}</td>
                <td>{exam.physics_average.toFixed(2)}</td>
                <td>{exam.chemistry_average.toFixed(2)}</td>
                <td>{exam.maths_average.toFixed(2)}</td>
                <td>{exam.biology_average.toFixed(2)}</td>
                <td>{exam.total_percentage.toFixed(2)}</td>
                <td>-</td>
                <td>-</td>
                <td>
                  <button
                    onClick={() => handleViewClassSectionExam(exam)}
                    style={{
                      padding: '4px 8px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    View Exam
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
  // 🖥️ Render Class-Section-Exam View (Results ONLY — NO UPLOAD)
  const renderClassSectionExamView = () => {
    if (!currentOMRExam) return null;

    const results = examResults[currentOMRExam.id] || [];

    return (
      <div style={{ marginTop: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2>📄 {selectedClassSection.class}-{selectedClassSection.section} | {currentOMRExam.exam_pattern}</h2>
          <button onClick={goBack} style={backButton}>← Back to Performance</button>
        </div>

        {resultsLoading ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            fontSize: '16px',
            color: '#6b7280'
          }}>
            🔄 Loading exam results...
          </div>
        ) : results.length > 0 ? (
          <>
            <div style={{ 
              marginBottom: '20px', 
              display: 'flex', 
              justifyContent: 'flex-end' 
            }}>
              <button
                onClick={() => {
                  if (!results.length) return alert('No data to download');
                  const doc = new jsPDF.default('landscape');

                  doc.setFontSize(18);
                  doc.text(`Exam Results - ${currentOMRExam.exam_pattern.replace('_', ' ')} (${currentOMRExam.class} - ${currentOMRExam.section})`, 14, 22);
                  doc.setFontSize(12);
                  doc.text(`School: ${currentOMRExam.school_id} | Program: ${currentOMRExam.program}`, 14, 30);

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

                  doc.save(`Exam_Results_${currentOMRExam.id}_${new Date().toISOString().split('T')[0]}.pdf`);
                }}
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
              overflowX: 'auto',
              maxWidth: '100%',
              margin: '0 auto'
            }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                fontSize: '14px',
                tableLayout: 'auto',
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
                  {results.map((r, index) => (
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
        ) : (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '1px dashed #cbd5e1',
            color: '#64748b',
            fontSize: '16px'
          }}>
            📭 No results uploaded yet for this exam.
          </div>
        )}
      </div>
    );
  };

  // 🖼️ Render Based on View State
  const renderContent = () => {
    switch (view) {
      case 'batch':
        return renderBatchWise();
      case 'class-section':
        return renderClassSectionView();
      case 'class-section-exam':
        return renderClassSectionExamView();
      case 'subject':
        return <div style={card}><h2>📚 Subject Wise (Coming Soon)</h2></div>;
      case 'teacher':
        return <div style={card}><h2>🧑‍🏫 Teacher Wise (Coming Soon)</h2></div>;
      case 'exam':
        return <div style={card}><h2>📝 Exam Wise (Coming Soon)</h2></div>;
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
  fontSize: '13px',
  color: '#1e293b'
};