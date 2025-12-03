// src/components/SchoolOwnerDashboard.jsx
import React, { useState, useEffect } from "react";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import StudentDashboard from './StudentDashboard'; // adjust path as needed
import TeacherDashboard from './TeacherDashboard';
import certificateTemplate from '../assets/certificate.png';
import spectropyLogoUrl from '../assets/logo.png';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';


export default function SchoolOwnerDashboard({ onBack }) {
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [classAverages, setClassAverages] = useState([]);
  const [subjectSummaries, setSubjectSummaries] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [classExamData, setClassExamData] = useState({}); // key: "class|section"
  const [examLoading, setExamLoading] = useState(false);
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
  const [allClassExams, setAllClassExams] = useState([]);
  const [studentIdInput, setStudentIdInput] = useState('');
  const [studentIdInputError, setStudentIdInputError] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [teacherIdInput, setTeacherIdInput] = useState('');
  const [teacherIdInputError, setTeacherIdInputError] = useState('');


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
    
    // ✅ Pass the data directly
    await loadLatestExamMetrics(schoolWithRelations);
    
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

 const loadLatestExamMetrics = async (schoolData) => {
  // Use schoolData instead of the state variable `school`
  if (!Array.isArray(schoolData.classes) || schoolData.classes.length === 0) return;

  setExamLoading(true);
  const metrics = {};

  try {
    await Promise.all(
      schoolData.classes.map(async (cls) => {
        const params = new URLSearchParams({
          school_id: schoolId,
          class: cls.class,
          section: cls.section
        });
        const res = await fetch(`${API_BASE}/api/exams?${params}`);
        const exams = await res.json();
        if (Array.isArray(exams) && exams.length > 0) {
          const latest = exams.reduce((prev, current) => {
            const prevDate = prev.exam_date ? new Date(prev.exam_date) : new Date(0);
            const currDate = current.exam_date ? new Date(current.exam_date) : new Date(0);
            return currDate > prevDate ? current : prev;
          });
          metrics[`${cls.class}|${cls.section}`] = {
            phygrade_per_avg: latest.phygrade_per_avg,
            mathgrade_per_avg: latest.mathgrade_per_avg,
            chemgrade_per_avg: latest.chemgrade_per_avg,
            biograde_per_avg: latest.biograde_per_avg,
            totalgrade_per_avg: latest.totalgrade_per_avg,
            all_india_rank: latest.all_india_rank
          };
        }
      })
    );
    setClassExamData(metrics);
  } catch (err) {
    console.error("Failed to load exam metrics:", err);
    setError("Failed to load performance data");
  } finally {
    setExamLoading(false);
  }
};

const getActiveSubjects = (group) => {
  const base = ['Physics', 'Chemistry'];
  if (!group) return [...base, 'Maths', 'Biology']; // default: show all
  const upper = group.toUpperCase();
  if (upper === 'PCM') {
    return [...base, 'Maths']; // Show Physics, Chemistry, Maths
  }
  if (upper === 'PCB') {
    return [...base, 'Biology']; // Show Physics, Chemistry, Biology
  }
  if (upper === 'PCMB') {
    return [...base, 'Maths', 'Biology']; // Show all four
  }
  // fallback: if group is something else, show all
  return [...base, 'Maths', 'Biology'];
};

   const subjectFieldMap = {
  Physics: 'phygrade_per_avg',
  Maths: 'mathgrade_per_avg',
  Chemistry: 'chemgrade_per_avg',
  Biology: 'biograde_per_avg'
};

const getGroupByClassSection = (classValue, sectionValue) => {
  if (!school?.classes) return null;
  const cls = school.classes.find(c =>
    c.class === classValue && c.section === sectionValue
  );
  return cls?.group || null;
};

const computeOverallAnalysis = () => {
  if (!classExamData || Object.keys(classExamData).length === 0) {
    return null;
  }

  const subjects = ['phygrade_per_avg', 'mathgrade_per_avg', 'chemgrade_per_avg', 'biograde_per_avg'];
  const subjectNames = {
    phygrade_per_avg: 'Physics',
    mathgrade_per_avg: 'Maths',
    chemgrade_per_avg: 'Chemistry',
    biograde_per_avg: 'Biology'
  };

  const totals = { phygrade_per_avg: 0, mathgrade_per_avg: 0, chemgrade_per_avg: 0, biograde_per_avg: 0 };
  const counts = { phygrade_per_avg: 0, mathgrade_per_avg: 0, chemgrade_per_avg: 0, biograde_per_avg: 0 };

  // Iterate over each class's exam data
  Object.values(classExamData).forEach(exam => {
    subjects.forEach(sub => {
      const val = exam[sub];
      if (val != null && val !== '' && !isNaN(parseFloat(val))) {
        const num = parseFloat(val);
        totals[sub] += num;
        counts[sub] += 1;
      }
    });
  });

  // Compute averages per subject (only if count > 0)
  const averages = {};
  let hasAnyData = false;

  subjects.forEach(sub => {
    if (counts[sub] > 0) {
      averages[subjectNames[sub]] = (totals[sub] / counts[sub]).toFixed(2);
      hasAnyData = true;
    } else {
      averages[subjectNames[sub]] = null; // or '-' if you prefer
    }
  });

  if (!hasAnyData) return null;

  // Find best subject among those with valid averages
  let bestSubject = null;
  let bestAvg = -Infinity;

  for (const [subName, avg] of Object.entries(averages)) {
    if (avg !== null) {
      const numAvg = parseFloat(avg);
      if (numAvg > bestAvg) {
        bestAvg = numAvg;
        bestSubject = subName;
      }
    }
  }

  // Optionally replace nulls with '-' for display
  const displayAverages = {};
  for (const [sub, avg] of Object.entries(averages)) {
    displayAverages[sub] = avg !== null ? avg : '-';
  }

  return {
    bestSubject: bestSubject || 'N/A',
    subjectAverages: displayAverages
  };
};

  if (loading) return <p>Loading school data...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  if (!school) return <p>No school data available.</p>;

// ✅ Reusable student report PDF generator (returns Blob)
const generateStudentReportPDF = (studentData, schoolData, examResults) => {
  return new Promise((resolve, reject) => {
    try {
      if (!studentData || !schoolData || !Array.isArray(examResults) || examResults.length === 0) {
        throw new Error('Missing required data');
      }

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 14;
      let y = 20;

      // 🔹 Helper: Get subject percentage
      const getSubjectPct = (marks, max) => {
        if (!max || max <= 0) return 0;
        return ((marks || 0) / max) * 100;
      };

      // ======================
      // 🎨 THEME COLORS
      // ======================
      const BLUE = [30, 80, 150];
      const LIGHT_BLUE = [230, 240, 255];
      const WHITE = [255, 255, 255];

      // ======================
      // 🏫 HEADER (Blue Theme)
      // ======================
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(...BLUE);
      doc.setTextColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.text(schoolData.school_name || "School Name", 15, 15);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Area: ${schoolData.area || 'N/A'}`, 15, 22);
      doc.text(`Powered BY SPECTROPY`, 240, 15);
      y = 30;

      // ======================
      // 🧑‍🎓 STUDENT INFO BOXES
      // ======================
      const boxX = 12;
      const boxY = y;
      const boxW = 50;
      const boxH = 22;
      const gap = 1;

      const subjKeys = [
        { key: 'physics', label: 'Physics' },
        { key: 'chemistry', label: 'Chemistry' },
        { key: 'maths', label: 'Mathematics' },
        { key: 'biology', label: 'Biology' }
      ];

      const avgMap = {};
      for (const subj of subjKeys) {
        const marksKey = `${subj.key}_marks`;
        const maxKey = `max_marks_${subj.key}`;
        const totalPct = examResults.reduce((sum, r) => {
          return sum + getSubjectPct(r[marksKey], r[maxKey]);
        }, 0);
        avgMap[subj.key] = examResults.length ? totalPct / examResults.length : 0;
      }

      const sortedSubj = Object.entries(avgMap)
        .sort(([, a], [, b]) => b - a)
        .map(([key, pct]) => ({ key, pct }));

      const strength = sortedSubj[0]?.key || '—';
      const weak = sortedSubj[sortedSubj.length - 1]?.key || '—';

      // Box 1: Name
      doc.setFillColor(...WHITE);
      doc.setTextColor(0, 0, 0);
      doc.rect(boxX, boxY, boxW, boxH, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text("Student Name", boxX + 3, boxY + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(studentData.name || "—", boxX + 3, boxY + 14);

      // Box 2: Roll No
      doc.setFillColor(...WHITE);
      doc.setTextColor(0, 0, 0);
      doc.rect(boxX + boxW + gap, boxY, boxW, boxH, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text("Roll No", boxX + boxW + gap + 1, boxY + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(String(studentData.roll_no || "—"), boxX + boxW + gap + 1, boxY + 14);

      // Box 3: Class
      doc.setFillColor(...WHITE);
      doc.setTextColor(0, 0, 0);
      doc.rect(boxX + 2 * (boxW + gap), boxY, boxW, boxH, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text("Class Section", boxX + 2 * (boxW + gap) + 1, boxY + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(`${studentData.class}-${studentData.section}`, boxX + 2 * (boxW + gap) + 1, boxY + 14);

      // Box 4: Best Performance
      doc.setFillColor(...WHITE);
      doc.setTextColor(0, 0, 0);
      const bestExam = examResults.reduce((best, curr) =>
        (curr.percentage || 0) > (best.percentage || 0) ? curr : best, {});
      doc.rect(boxX + 3 * (boxW + gap), boxY, boxW, boxH, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text("Best Performed Exam %", boxX + 3 * (boxW + gap) + 1, boxY + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(`${(bestExam.percentage || 0).toFixed(1)}%`, boxX + 3 * (boxW + gap) + 1, boxY + 14);

      // Box 5: Strength Subject
      doc.setFillColor(...WHITE);
      doc.setTextColor(0, 0, 0);
      doc.rect(boxX + 4 * (boxW + gap), boxY, boxW, boxH, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text("Strength Subject", boxX + 4 * (boxW + gap) + 1, boxY + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(strength.charAt(0).toUpperCase() + strength.slice(1), boxX + 4 * (boxW + gap) + 1, boxY + 14);

      // Box 6: Weak Subject
      doc.setFillColor(...WHITE);
      doc.setTextColor(0, 0, 0);
      doc.rect(boxX + 5 * (boxW + gap), boxY, boxW, boxH, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text("Weak Subject", boxX + 5 * (boxW + gap) + 1, boxY + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(weak.charAt(0).toUpperCase() + weak.slice(1), boxX + 5 * (boxW + gap) + 1, boxY + 14);

      y = boxY + boxH + 10;

      // ======================
      // 📊 CUMULATIVE SUBJECT AVERAGES
      // ======================
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text("Cumulative Performance", 15, y);
      y += 8;

      const graphX = 15;
      const graphY = y;
      const graphW = 35;
      const graphH = 25;
      const graphGap = 8;

      subjKeys.forEach((subj, i) => {
        const x = graphX + i * (graphW + graphGap);
        doc.setFillColor(...LIGHT_BLUE);
        doc.rect(x, graphY, graphW, graphH, 'F');
        doc.setFillColor(...WHITE);
        doc.rect(x + 1, graphY + 1, graphW - 2, graphH - 2, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(subj.label, x + 5, graphY + 8);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.text(`${avgMap[subj.key].toFixed(1)}%`, x + 5, graphY + 18);
      });

      y = doc.lastAutoTable.finalY + 10;

      // ======================
      // ✍️ SIGNATURES
      // ======================
     const sigY = pageHeight - 30;
     doc.setFontSize(11);
     doc.setFont('helvetica', 'italic');

     // Signature lines with light blue background
     doc.setFillColor(...LIGHT_BLUE);

     doc.text("Remarks: ___________", 20, sigY - 48);

     doc.setTextColor(0, 0, 0);
     doc.text("Parent/Guardian", 20, sigY);
     doc.text("School Principal", 130, sigY);
     doc.text("Organization Head", 240, sigY);

     doc.text("Date: ___________", 20, sigY + 8);
     doc.text("Date: ___________", 130, sigY + 8);
     doc.text("Date: ___________", 240, sigY + 8);

      y = graphY + graphH + 15;
      doc.addPage();

      // ======================
      // 📋 EXAM RESULTS TABLE
      // ======================
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text("Exam Results", 15, y - 85);
      y += 10;

      const tableData = examResults.map(r => {
      const pPct = getSubjectPct(r.physics_marks, r.max_marks_physics);
      const cPct = getSubjectPct(r.chemistry_marks, r.max_marks_chemistry);
      const mPct = getSubjectPct(r.maths_marks, r.max_marks_maths);
      const bPct = getSubjectPct(r.biology_marks, r.max_marks_biology);

      return [
        r.date || "—",
        r.exam.replace(/_/g, ' ') || "—",
        String(Math.round(r.correct_answers || 0)),
        String(Math.round(r.wrong_answers || 0)),
        String(Math.round(r.unattempted || 0)),
       `${(r.physics_marks || 0).toFixed(0)} (${pPct.toFixed(0)}%)`,
       `${(r.chemistry_marks || 0).toFixed(0)} (${cPct.toFixed(0)}%)`,
       `${(r.maths_marks || 0).toFixed(0)} (${mPct.toFixed(0)}%)`,
       `${(r.biology_marks || 0).toFixed(0)} (${bPct.toFixed(0)}%)`,
        (r.total || 0).toFixed(0),
       `${(r.percentage || 0).toFixed(1)}%`,
        r.class_rank ?? "—",          // Class Rank
        r.school_rank ?? "—",         // School Rank
        r.all_schools_rank ?? "—"     // All Schools Rank
      ];
    });

doc.autoTable({
  head: [
    [
      "Date",
      "Exam",
      "correct",
      "wrong",
      "unattempted",
      "Physics",
      "Chemistry",
      "Maths",
      "Biology",
      "Total",
      "%",
      "Class\nRank",
      "School\nRank",
      "All India\nRank"
    ]
  ],
  body: tableData,
  startY: y - 85,
  theme: 'grid',
  styles: {
    fontSize: 10,
    cellPadding: 2,
    fontStyle: 'bold',
    fillColor: WHITE,
    textColor: 0,
  },
  headStyles: {
    fillColor: BLUE,
    textColor: 255,
    fontStyle: 'bold',
    fontSize: 9,
    halign: 'center'
  },
  columnStyles: {
    0: { cellWidth: 22 }, // Date
    1: { cellWidth: 32 }, // Exam
    2: { cellWidth: 15}, //correct
    3: { cellWidth: 15},//wrong
    4: { cellWidth: 15},//unattempted 
    5: { cellWidth: 26 }, // Physics
    6: { cellWidth: 26 }, // Chemistry
    7: { cellWidth: 26 }, // Maths
    8: { cellWidth: 26 }, // Biology
    9: { cellWidth: 15 }, // Total
    10: { cellWidth: 15 }, // %
    11: { cellWidth: 15 }, // Class Rank
    12: { cellWidth: 15 }, // School Rank
    13: { cellWidth: 15 } // All Schools Rank
  },
  margin: { left: 9, right: 9 },
  tableWidth: 'wrap'
});

      // ✅ Return blob directly
      resolve(doc.output('blob'));
    } catch (err) {
      reject(err);
    }
  });
}; 

const handleDownloadAllGradesReport = async () => {
  if (!school) {
    alert('School data not loaded.');
    return;
  }

  setExamLoading(true);
  const zip = new JSZip();

  try {
    // ✅ Fetch ALL exam records for the school (contains student info)
    const params = new URLSearchParams({ school_id: schoolId });
    const res = await fetch(`${API_BASE}/api/exams?${params}`);
    const allExamRecords = await res.json();

    if (!Array.isArray(allExamRecords) || allExamRecords.length === 0) {
      alert('No exam records found for the school.');
      return;
    }

    // ✅ Deduplicate students by student_id
    const studentMap = {};
    for (const record of allExamRecords) {
      if (record.student_id && !studentMap[record.student_id]) {
        studentMap[record.student_id] = {
          student_id: record.student_id,
          first_name: record.first_name || '',
          last_name: record.last_name || '',
          class: record.class || '',
          section: record.section || ''
        };
      }
    }

    const uniqueStudents = Object.values(studentMap);
    console.log('✅ Found', uniqueStudents.length, 'unique students');

    let generatedCount = 0;

    // ✅ Generate report for each student
    for (const student of uniqueStudents) {
      try {
        // Fetch this student's full exam history
        const studentRes = await fetch(`${API_BASE}/api/exams/results?student_id=${student.student_id}`);
        const examResults = await studentRes.json();

        if (!Array.isArray(examResults) || examResults.length === 0) {
          console.warn(`⚠️ No exam results for student ${student.student_id}`);
          continue;
        }

        const studentData = {
          name: `${student.first_name} ${student.last_name}`.trim() || 'Unknown',
          roll_no: student.student_id,
          class: student.class,
          section: student.section
        };

        const pdfBlob = await generateStudentReportPDF(studentData, school, examResults);

        const safeName = studentData.name.replace(/[^a-z0-9]/gi, '_');
        const folder = `${student.class}_${student.section}`;
        const filename = `${folder}/${safeName}_Report.pdf`;

        zip.file(filename, pdfBlob);
        generatedCount++;
      } catch (err) {
        console.error(`Failed to generate report for ${student.student_id}:`, err);
      }
    }

    if (generatedCount === 0) {
      alert('No reports could be generated.');
      return;
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, `All_Student_Reports_${school.school_id}.zip`);

  } catch (err) {
    console.error('💥 ZIP generation failed:', err);
    alert('Failed to generate ZIP. Check console for details.');
  } finally {
    setExamLoading(false);
  }
};

  // 🖼️ Render School Header
  const renderSchoolHeader = () => (
    <div style={{
      textAlign: 'center',
      padding: '32px 20px',
      background: '#f8fafc',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      marginBottom: '30px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
    }}>
      <img
        src={school.logo_url || '/default-school-logo.png'}
        alt="School Logo"
        style={{ height: '120px', marginBottom: '20px', borderRadius: '10px' }}
        onError={(e) => { e.target.src = '/placeholder-logo.png'; }}
      />
      <h1 style={{ color: '#080808ff', margin: '0 0 8px 0' }}>
        {school.school_name || 'Unknown School'} {school.school_id || 'id is not set'}
      </h1>
      <p style={{ margin: '4px 0', color: '#374151' }}>
        {school.area || 'Area Not Set'}, {school.district || 'distict is not set'}, {school.state ||'state is not set'}, {school.academic_year || 'academic year not set'}
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
        { label: 'Batch(Exam Wise)', key: 'exam' },
        { label: 'Teacher Wise', key: 'teacher' },
        { label: 'Student Wise', key: 'student' },
        { label: 'Download All Grades Report', key: 'download-all-grades' }
      ].map(btn => (
        <button
          key={btn.key}
          onClick={() => {
         if (btn.key === 'download-all-grades') {
           handleDownloadAllGradesReport(); // direct call
          } else {
           setView(btn.key);
          }
          }}
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

const renderTeachersTable = () => {
  if (!school || !Array.isArray(school.teachers) || school.teachers.length === 0) {
    return (
      <div style={card}>
        <h2>👨‍🏫 Teachers ({0})</h2>
        <p>No teachers assigned yet.</p>
      </div>
    );
  }

  // Group assignments by (teacher, subject)
  const teacherSubjectMap = {};

  school.teachers.forEach(teacher => {
    if (Array.isArray(teacher.teacher_assignments)) {
      teacher.teacher_assignments.forEach(assignment => {
        const key = `${teacher.name}|${assignment.subject}`;
        if (!teacherSubjectMap[key]) {
          teacherSubjectMap[key] = {
            name: teacher.name,
            subject: assignment.subject,
            classSections: []
          };
        }
        teacherSubjectMap[key].classSections.push(`${assignment.class}-${assignment.section}`);
      });
    }
  });

  // Convert to array for rendering
  const groupedRows = Object.values(teacherSubjectMap);

  return (
    <div style={card}>
      <h2>👨‍🏫 Teachers ({school.teachers.length})</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={dataTable}>
          <thead>
            <tr>
              <th>Teacher Name</th>
              <th>Subject</th>
              <th>Allotment (Class-Section)</th>
            </tr>
          </thead>
          <tbody>
            {groupedRows.map((row, i) => (
              <tr key={i}>
                <td>{row.name}</td>
                <td>{row.subject}</td>
                <td>{row.classSections.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

 const renderIITBatches = () => {
  const analysis = computeOverallAnalysis();
  const totalStrength = Array.isArray(school.classes)
    ? school.classes.reduce((sum, c) => sum + (c.num_students || 0), 0)
    : 0;

  // ✅ Determine global active subjects across all classes
  const globalActiveSubjects = new Set();
school.classes.forEach(cls => {
  getActiveSubjects(cls.group).forEach(sub => globalActiveSubjects.add(sub)); // 👈 FIXED
});
const globalActive = Array.from(globalActiveSubjects);

  // 📥 Download Performance Analysis + Batches Table as Single A4 PDF
  const downloadIITAnalysisPDF = () => {
    if (!school || !Array.isArray(school.classes) || school.classes.length === 0) {
      alert('No data to export');
      return;
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width;
    let y = 15;

    // ===== HEADER BANNER =====
    doc.setFillColor(37, 79, 162);
    doc.rect(0, 0, pageWidth, 25, 'F');
    if (school?.logo_url) {
  try {
    // Adjust size and position: 20x20, centered vertically in 25pt height
    doc.addImage(school.logo_url, 'PNG', 8, 2.5, 20, 20);
  } catch (e) {
    console.warn('Failed to load school logo:', e);
  }
}
    doc.setFontSize(14);
    doc.setFont('bold');
    doc.setTextColor(255, 255, 255);
    doc.text(school.school_name || 'Unknown School', 30, 10);
    doc.setFontSize(12);
    doc.setFont('bold');
    doc.text(`Area: ${school.area || 'Not Set'}`, 30, 18);

    // --- Spectropy Logo (right) ---
try {     
  doc.addImage(spectropyLogoUrl, doc.internal.pageSize.width - 30, 2, 15, 15);
} catch (e) {
  console.warn('Failed to load Spectropy logo, falling back to text:', e);
}
    doc.setFontSize(10);
    doc.setFont('italic');
    doc.text('Powered BY SPECTROPY', pageWidth - 50, 22);

    y = 35;

    // ===== TITLE =====
    doc.setFontSize(16);
    doc.setFont('bold');
    doc.setTextColor(30, 41, 59);
    doc.text('IIT Foundation School Performance Report', pageWidth / 2, y, { align: 'center' });
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 60, 30);
    y += 12;

    // ===== PERFORMANCE ANALYSIS (Aligned with computeOverallAnalysis) =====
    const subjects = ['phygrade_per_avg', 'mathgrade_per_avg', 'chemgrade_per_avg', 'biograde_per_avg'];
    const subjectNames = {
      phygrade_per_avg: 'Physics',
      mathgrade_per_avg: 'Maths',
      chemgrade_per_avg: 'Chemistry',
      biograde_per_avg: 'Biology'
    };

    const totals = { phygrade_per_avg: 0, mathgrade_per_avg: 0, chemgrade_per_avg: 0, biograde_per_avg: 0 };
    const counts = { phygrade_per_avg: 0, mathgrade_per_avg: 0, chemgrade_per_avg: 0, biograde_per_avg: 0 };

    school.classes.forEach(cls => {
      const key = `${cls.class}|${cls.section}`;
      const exam = classExamData[key] || {};
      subjects.forEach(sub => {
        const val = exam[sub];
        if (val != null && val !== '' && !isNaN(parseFloat(val))) {
          totals[sub] += parseFloat(val);
          counts[sub] += 1;
        }
      });
    });

    const displayAverages = {};
    let hasAnyData = false;
    subjects.forEach(sub => {
      if (counts[sub] > 0) {
        displayAverages[subjectNames[sub]] = (totals[sub] / counts[sub]).toFixed(2);
        hasAnyData = true;
      } else {
        displayAverages[subjectNames[sub]] = '-';
      }
    });

    let bestSubject = 'Physics';
    if (hasAnyData) {
      let bestAvg = -Infinity;
      for (const [name, avg] of Object.entries(displayAverages)) {
        if (avg !== '-') {
          const num = parseFloat(avg);
          if (num > bestAvg) {
            bestAvg = num;
            bestSubject = name;
          }
        }
      }
    }

    y += 12;

    // ===== SUBJECT AVERAGES CARDS =====
    doc.setFont('bold');
    doc.setFontSize(14);
    doc.text('Subject Averages (%):', 14, y);
    y += 8;

    const colWidth = (pageWidth - 28) / globalActive.length;
    globalActive.forEach((subName, i) => {
      const x = 14 + i * colWidth;
      const avg = displayAverages[subName] || '-';
      doc.setFillColor(255, 255, 255);
      doc.rect(x, y, colWidth - 4, 24, 'F');
      doc.setDrawColor(220, 220, 220);
      doc.rect(x, y, colWidth - 4, 24, 'S');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(subName, x + colWidth / 2 - 2, y + 6, { align: 'center' });
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`${avg}%`, x + colWidth / 2 - 2, y + 14, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Avg %', x + colWidth / 2 - 2, y + 20, { align: 'center' });
    });
    y += 30;

    // ===== IIT BATCHES TABLE — Dynamic Columns =====
    doc.setFontSize(14);
    doc.setFont('bold');
    doc.setTextColor(0, 0, 0);
    doc.text('IIT Foundation Batches', 14, y);
    y += 8;

    // Build header dynamically
    const tableColumn = [
  'Class', 'Section', 'Foundation', 'Program', 'Group', 'Students',
  ...globalActive.map(sub => `${sub} %`), // globalActive is computed correctly above
  'Total %'
];

    const tableRows = school.classes.map(cls => {
      const activeSubs = getActiveSubjects(cls.group);
      const key = `${cls.class}|${cls.section}`;
      const exam = classExamData[key] || {};
      return [
  cls.class || '-',
  cls.section || '-',
  cls.foundation || '-',
  cls.program || '-',
  cls.group || '-', // 👈 This is now used for filtering
  cls.num_students || 0,
  ...globalActive.map(sub => {
    if (!activeSubs.includes(sub)) return ''; // 👈 Hide column if subject not active for this row
    const field = subjectFieldMap[sub];
    return exam[field] ? parseFloat(exam[field]).toFixed(2) : '-';
  }),
  exam.totalgrade_per_avg ? parseFloat(exam.totalgrade_per_avg).toFixed(2) : '-'
];
    });

    // Total row
    tableRows.push([
      '', '', '', '', 'Total Strength:', totalStrength,
      ...Array(globalActive.length).fill(''),
      ''
    ]);

    // Column widths: adjust based on active subjects
    const baseWidths = { 0: 22, 1: 22, 2: 28, 3: 28, 4: 22, 5: 22 };
    const subjectWidth = 24;
    const totalWidth = 22;
    const columnStyles = { ...baseWidths };
    for (let i = 0; i < globalActive.length; i++) {
      columnStyles[6 + i] = { cellWidth: subjectWidth };
    }
    columnStyles[6 + globalActive.length] = { cellWidth: totalWidth };

    doc.autoTable({
      startY: y,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 2, halign: 'center' },
      headStyles: { 
        fillColor: [37, 79, 162], 
        textColor: [255, 255, 255], 
        fontSize: 8 
      },
      columnStyles,
      didParseCell: (data) => {
        if (data.row.index === tableRows.length - 1 && data.column.index < 4) {
          data.cell.styles.fontStyle = 'normal';
          data.cell.styles.fillColor = [241, 245, 249];
        }
        if (data.row.index === tableRows.length - 1 && data.column.index === 4) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
      }
    });

    doc.save(`IIT_Foundation_Analysis_${school.school_id || 'school'}.pdf`);
  };

  return (
    <div style={card}>
      <button
        onClick={downloadIITAnalysisPDF}
        disabled={examLoading}
        style={{
          padding: '8px 16px',
          background: examLoading ? '#94a3b8' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: examLoading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        {examLoading ? '⏳ Loading...' : '📄 Download PDF'}
      </button>

      {/* ===== PERFORMANCE ANALYSIS SECTION ===== */}
      {analysis && (
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          background: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#1e293b', textAlign: 'center' }}>
            📊 Performance Analysis
          </h3>
          <div style={{ marginBottom: '16px', textAlign: 'center' }}>
            <strong>🏆 Best Subject:</strong> {analysis.bestSubject}
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            {Object.entries(analysis.subjectAverages)
              .filter(([subject]) => globalActive.includes(subject))
              .map(([subject, avg]) => (
                <div
                  key={subject}
                  style={{
                    width: '120px',
                    padding: '14px',
                    background: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    textAlign: 'center',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>{subject}</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>
                    {avg}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Avg %</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ===== IIT FOUNDATION BATCHES TABLE ===== */}
      <h2>📚 IIT Foundation Batches ({Array.isArray(school.classes) ? school.classes.length : 0})</h2>
      {examLoading ? (
        <p>Loading performance data...</p>
      ) : Array.isArray(school.classes) && school.classes.length > 0 ? (
        <div style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          width: '100%',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          WebkitOverflowScrolling: 'touch'
        }}>
          <table style={{
            ...dataTable,
            minWidth: '800px',
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr>
                <th>Class</th>
                <th>Section</th>
                <th>Foundation</th>
                <th>Program</th>
                <th>Group</th>
                <th>Students</th>
                {globalActive.map(sub => <th key={sub}>{sub} %</th>)}
                <th>Total %</th>
              </tr>
            </thead>
            <tbody>
              {school.classes.map((c, i) => {
                const activeSubs = getActiveSubjects(c.group);
                const key = `${c.class}|${c.section}`;
                const exam = classExamData[key] || {};
                return (
                  <tr key={i}>
                    <td>{c.class || '-'}</td>
                    <td>{c.section || '-'}</td>
                    <td>{c.foundation || '-'}</td>
                    <td>{c.program || '-'}</td>
                    <td>{c.group || '-'}</td>
                    <td>{c.num_students || 0}</td>
                    {globalActive.map(sub => {
                      if (!activeSubs.includes(sub)) return <td key={sub}></td>;
                      const field = subjectFieldMap[sub];
                      return <td key={sub}>
                        {exam[field] ? parseFloat(exam[field]).toFixed(2) : '-'}
                      </td>;
                    })}
                    <td>{exam.totalgrade_per_avg ? parseFloat(exam.totalgrade_per_avg).toFixed(2) : '-'}</td>
                  </tr>
                );
              })}
              <tr style={{ background: '#f1f5f9', fontWeight: 'bold' }}>
                <td colSpan="5" style={{ textAlign: 'right' }}>Total Strength:</td>
                <td>{totalStrength}</td>
                <td colSpan={globalActive.length + 1}></td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p>No batches added yet.</p>
      )}
    </div>
  );
};

const renderExamWiseView = () => {
  const classSections = Array.isArray(school.classes)
    ? school.classes.map(c => ({ class: c.class, section: c.section }))
    : [];
  // ✅ DEFINE subjectKeyMap HERE — at the top of the function
  const subjectKeyMap = {
    Physics: 'phy_exam_per_average',
    Chemistry: 'chem_exam_per_average',
    Maths: 'math_exam_per_average',
    Biology: 'bioexam_per_average'
  };

  const handleSelectClassSection = async (cls, sec) => {
    setExamWiseClassSection({ class: cls, section: sec });
    setExamWiseLoading(true);
    try {
      const params = new URLSearchParams({ school_id: schoolId, class: cls, section: sec });
      const res = await fetch(`${API_BASE}/api/exams?${params}`);
      const allExams = await res.json();
      const seen = new Set();
      const deduplicatedExams = allExams.filter(exam => {
        const key = `${exam.exam_pattern}|${exam.exam_date || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      deduplicatedExams.sort((a, b) => {
        const numA = parseInt(a.exam_pattern?.replace(/[^0-9]/g, ''), 10) || 0;
        const numB = parseInt(b.exam_pattern?.replace(/[^0-9]/g, ''), 10) || 0;
        return numA - numB;
      });
      setExamWiseExams(deduplicatedExams);
      setAllClassExams(allExams);
    } catch (err) {
      setError("Failed to load exams: " + err.message);
      setExamWiseExams([]);
      setAllClassExams([]);
    } finally {
      setExamWiseLoading(false);
    }
  };

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
      setCurrentOMRExam({ ...exam, id: examKey, key: examKey });
      setView('examwise-results');
    } catch (err) {
      setError("Failed to load results: " + err.message);
    } finally {
      setResultsLoading(false);
    }
  };

  const activeSubs = examWiseClassSection
  ? getActiveSubjects(getGroupByClassSection(examWiseClassSection.class, examWiseClassSection.section))
  : ['Physics', 'Chemistry', 'Maths', 'Biology'];

  const computeAnalysis = (exams) => {
  if (!Array.isArray(exams) || exams.length === 0) return null;
  const subjects = [
    { key: 'phy_exam_per_average', name: 'Physics' },
    { key: 'chem_exam_per_average', name: 'Chemistry' },
    { key: 'math_exam_per_average', name: 'Maths' },
    { key: 'bioexam_per_average', name: 'Biology' }
  ];
  // Filter subjects based on activeSubs
  const filteredSubjects = subjects.filter(sub => activeSubs.includes(sub.name));
  const subjectAverages = {};
  const subjectTopExams = {};
  filteredSubjects.forEach(sub => {
    let total = 0;
    let count = 0;
    let topExam = null;
    let topValue = -1;
    exams.forEach(exam => {
      const valStr = exam[sub.key];
      if (valStr !== undefined && valStr !== null && valStr !== '') {
        const val = parseFloat(valStr);
        if (!isNaN(val)) {
          total += val;
          count++;
          if (val > topValue) {
            topValue = val;
            topExam = exam;
          }
        }
      }
    });
    subjectAverages[sub.name] = count > 0 ? (total / count).toFixed(2) : '—';
    subjectTopExams[sub.name] = topExam ? topExam.exam_pattern : '—';
  });
  let bestSubject = null;
  let bestAvg = -1;
  for (const [name, avg] of Object.entries(subjectAverages)) {
    if (avg !== '—') {
      const numAvg = parseFloat(avg);
      if (numAvg > bestAvg) {
        bestAvg = numAvg;
        bestSubject = name;
      }
    }
  }
  return { bestSubject, subjectAverages, subjectTopExams };
};

  const analysis = examWiseExams.length > 0 ? computeAnalysis(examWiseExams) : null;

  const computeTopStudents = (exams) => {
    if (!Array.isArray(exams) || exams.length === 0) return [];
    const studentMap = new Map();
    exams.forEach(exam => {
      if (!exam.student_id || exam.cumulative_percentage == null) return;
      if (studentMap.has(exam.student_id)) return;
      const name = [exam.first_name, exam.last_name].filter(Boolean).join(' ') || 'Anonymous';
      const cumPct = parseFloat(exam.cumulative_percentage);
      if (!isNaN(cumPct)) {
        studentMap.set(exam.student_id, { id: exam.student_id, name, cumulative_percentage: cumPct });
      }
    });
    return Array.from(studentMap.values())
      .sort((a, b) => b.cumulative_percentage - a.cumulative_percentage)
      .slice(0, 5)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  };

  const topStudents = allClassExams.length > 0 ? computeTopStudents(allClassExams) : [];
  
  const handleGenerateCertificates = async () => {
  if (!topStudents.length || !examWiseClassSection) return;

  const examType = activeSubs.includes('Biology')
    ? "NEET FOUNDATION EXAMS"
    : "IIT FOUNDATION EXAMS";

  const grade = examWiseClassSection.class;

  for (const [index, student] of topStudents.entries()) {
    await generateCertificateFromImage(student, index + 1, examType, grade);
  }
};

  const handleDownloadAnalysisPDF = () => {
    if (!examWiseClassSection || !analysis) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const { class: cls, section: sec } = examWiseClassSection;
    let y = 10;
    
    // ===== HEADER BANNER =====
    doc.setFillColor(37, 79, 162);
    doc.rect(0, 0, doc.internal.pageSize.width, 25, 'F');
    // --- School Logo (left) ---
if (school?.logo_url) {
  try {
    // Adjust size and position: 20x20, centered vertically in 25pt height
    doc.addImage(school.logo_url, 'PNG', 8, 2.5, 20, 20);
  } catch (e) {
    console.warn('Failed to load school logo:', e);
  }
}
    doc.setFontSize(14);
    doc.setFont('bold');
    doc.setTextColor(255, 255, 255);
    doc.text(school.school_name || 'Unknown School', 30, 10);
    doc.setFontSize(12);
    doc.setFont('bold');
    doc.text(`Area: ${school.area || 'Not Set'}`, 30, 18);
    
    // --- Spectropy Logo (right) ---
try {     
  doc.addImage(spectropyLogoUrl, doc.internal.pageSize.width - 30, 2, 15, 15);
} catch (e) {
  console.warn('Failed to load Spectropy logo, falling back to text:', e);
}

    doc.setFontSize(10);
    doc.setFont('italic');
    doc.text('Powered BY SPECTROPY', doc.internal.pageSize.width - 50, 22);

    y = 35;

    // ===== PERFORMANCE ANALYSIS TITLE =====
    const pageWidth = doc.internal.pageSize.width;
    doc.setFontSize(16);
    doc.setFont('bold');
    doc.setTextColor(0, 0, 0);
    doc.text('IIT Foundation Batch-Wise Performace Report', pageWidth / 2, y, { align: 'center' });
    doc.setFont('bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${cls}-${sec}`, 14, 40);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 60, 30);
    y += 10;

    // ===== BEST SUBJECT =====
    doc.setFontSize(12);
    doc.setFont('bold');
    doc.text('Best Subject: ' + (analysis.bestSubject || '—'), pageWidth / 2, y, { align: 'center' });
    y += 12;

    // ===== SUBJECT AVERAGES (%) — DYNAMIC =====
    doc.setFont('bold');
    doc.text('Subject Averages (%):', 14, y);
    y += 8;

    const colWidth = (pageWidth - 28) / activeSubs.length;
    activeSubs.forEach((subject, i) => {
      const x = 14 + i * colWidth;
      const avg = analysis.subjectAverages[subject] || '—';
      doc.setFillColor(255, 255, 255);
      doc.rect(x, y, colWidth - 4, 24, 'F');
      doc.setDrawColor(220, 220, 220);
      doc.rect(x, y, colWidth - 4, 24, 'S');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(subject, x + colWidth / 2 - 2, y + 6, { align: 'center' });
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`${avg}%`, x + colWidth / 2 - 2, y + 14, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Avg %', x + colWidth / 2 - 2, y + 20, { align: 'center' });
    });
    y += 40;

    // ===== SUBJECT-WISE TOP EXAM =====
    doc.setFont('bold');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text('Subject-wise Top Exam:', 14, y);
    y += 8;

    const examPatterns = activeSubs.map(s => analysis.subjectTopExams[s] || '—');
    const avgPercents = activeSubs.map(s => `${analysis.subjectAverages[s] || '—'}%`);

    doc.autoTable({
      startY: y,
      head: [activeSubs],
      body: [examPatterns, avgPercents],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 5, halign: 'center', textColor: [30, 41, 59] },
      headStyles: { fillColor: [37, 79, 162], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: activeSubs.reduce((acc, _, i) => ({ ...acc, [i]: { cellWidth: colWidth - 6 } }), {})
    });
    y = doc.lastAutoTable.finalY + 8;

    // ===== EXAM TABLE — DYNAMIC COLUMNS =====
    doc.addPage();
    y = 35;
    doc.setFont('bold');
    doc.setFontSize(12);
    doc.text('Exam Results Table', 14, y);
    y += 8;

    const tableColumn = [
  'Program', 'Exam Date', 'Exam Pattern',
  ...activeSubs.map(s => `${s} %`),
  'Total %', 'School Rank', 'All India Rank'
];

    const subjectKeyMap = {
      Physics: 'phy_exam_per_average',
      Chemistry: 'chem_exam_per_average',
      Maths: 'math_exam_per_average',
      Biology: 'bioexam_per_average'
    };

    const tableRows = examWiseExams.map(exam => [
  exam.program || '-',
  exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : '-',
  exam.exam_pattern || '-',
  ...activeSubs.map(s => exam[subjectKeyMap[s]] ? parseFloat(exam[subjectKeyMap[s]]).toFixed(2) : '-'), // 👈 Only show active subjects
  exam.total_exam_per_avg ? parseFloat(exam.total_exam_per_avg).toFixed(2) : '-',
  exam.school_grade_rank ?? '-',
  exam.all_schools_grade_rank ?? '-'
]);

    const baseColWidths = { 0: 25, 1: 25, 2: 35, 3: activeSubs.length + 3 };
    const subjectColWidth = 30;
    const rankColWidth = 23;
    const columnStyles = {
      0: { cellWidth: 25 },
      1: { cellWidth: 25 },
      2: { cellWidth: 35 },
      ...activeSubs.reduce((acc, _, i) => ({ ...acc, [3 + i]: { cellWidth: subjectColWidth } }), {}),
      [3 + activeSubs.length]: { cellWidth: 23 },
      [4 + activeSubs.length]: { cellWidth: rankColWidth },
      [5 + activeSubs.length]: { cellWidth: rankColWidth }
    };

    doc.autoTable({
      startY: y,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, halign: 'center' },
      headStyles: { fillColor: [37, 79, 162], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles
    });

    doc.save(`Performance_Analysis_${cls}-${sec}.pdf`);
  };

  const generateCertificateFromImage = async (student, rank, examType, grade) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const w = doc.internal.pageSize.width; // 297mm
  const h = doc.internal.pageSize.height; // 210mm

  // ===== LOAD BASE IMAGE =====
  try {
    // ✅ Use the imported asset directly
    doc.addImage(certificateTemplate, 'SVG', 0, 0, w, h);
  } catch (err) {
    console.error('Failed to add certificate template:', err);
    alert('Failed to load certificate template. Check file format and path.',certificateTemplate);

    return;
  }

  // ===== ADD SCHOOL LOGOS (TOP LEFT & RIGHT) =====
  if (school?.logo_url) {
    try {
      doc.addImage(school.logo_url, 'PNG', 17, 19, 26, 26); // top left
      doc.addImage(school.logo_url, 'PNG', 255, 19, 26, 26); // top right
    } catch (e) {
      console.warn('Failed to add school logo:', e);
    }
  }
 
  // ===== ADD STUDENT NAME =====
  doc.setFontSize(35);
  doc.setFont('Times New Roman','bold');
  doc.setTextColor(255, 180, 0); // gold
  doc.text(student.name.toUpperCase(), w / 2, 95, { align: 'center' }); // Adjust Y based on template

  // ===== ADD GRADE =====
  doc.setFontSize(20);
  doc.setFont('Times New Roman', 'bold');
  doc.text(`${grade}`, w / 2 - 2 , 110, { align: 'center' });

  
  doc.setFontSize(20);
  doc.setFont('Times New Roman', 'bold');
   doc.setTextColor(255, 255, 255); // gold
  doc.text(examType, w / 2, 145, { align: 'center' });


  // ===== ADD RANK INSIDE MEDAL =====
  doc.setFontSize(50);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(rank.toString(), w / 2, 170, { align: 'center' }); // Adjust Y for medal center

  // ===== ADD DATE =====
  doc.setFontSize(20);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(new Date().toLocaleDateString(), 50, 178);
  //doc.setLineWidth(0.2);
  //doc.line(30, 182, 70, 182);
  //doc.setFontSize(6);
  //doc.text('DATE', 45, 185);

  // ===== SAVE =====
  const safeName = student.name.replace(/[^a-z0-9\s]/gi, '_').replace(/\s+/g, '_');
  doc.save(`Certificate_${safeName}_Rank${rank}.pdf`);
};

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2>📝 Exam Wise Results</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleDownloadAnalysisPDF} style={{
            padding: '8px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            📊 Download Analysis PDF
          </button>
          <button 
  onClick={handleGenerateCertificates} 
  style={{
    padding: '8px',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500'
  }}
  disabled={!topStudents.length || !examWiseClassSection}
>
  🏆 Generate Certificates
</button>
          <button onClick={() => setView('overview')} style={backButton}>← Back to Overview</button>
        </div>
      </div>
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Select Class - Section:</label>
        <select onChange={(e) => {
          const [cls, sec] = e.target.value.split('|');
          if (cls && sec) handleSelectClassSection(cls, sec);
        }} style={{
          padding: '10px',
          fontSize: '16px',
          borderRadius: '6px',
          border: '1px solid #cbd5e1',
          minWidth: '250px'
        }}>
          <option value="">-- Choose Class - Section --</option>
          {classSections.map((cs, i) => (
            <option key={i} value={`${cs.class}|${cs.section}`}>{cs.class} - {cs.section}</option>
          ))}
        </select>
      </div>
      {examWiseClassSection && (
        <>
          <h3 style={{ marginBottom: '16px', color: '#1e293b' }}>
            Exams for {examWiseClassSection.class} - {examWiseClassSection.section}
          </h3>
          {examWiseExams.length > 0 && analysis && (
            <div style={{
              marginBottom: '24px',
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#1e293b', textAlign: 'center' }}>📊 Performance Analysis</h3>
              <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                <strong>🏆 Best Subject:</strong> {analysis.bestSubject || '—'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '16px', marginTop: '12px' }}>
  {Object.entries(analysis.subjectAverages)
    .filter(([subject]) => activeSubs.includes(subject))
    .map(([subject, avg]) => (
      <div key={subject} style={{
        width: '140px',
        padding: '16px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        textAlign: 'center',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>{subject}</div>
        <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>{avg}%</div>
        <div style={{ fontSize: '12px', color: '#64748b' }}>Avg %</div>
      </div>
    ))}
</div>
              <div style={{ overflowX: 'auto' }}>
  <strong>🎯 Subject-wise Top Exam:</strong>
  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
    <thead>
      <tr style={{ background: '#e2e8f0' }}>
        {activeSubs.map(s => <th key={s} style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{s}</th>)}
      </tr>
      <tr style={{ background: '#f8fafc' }}>
        {activeSubs.map(s => <th key={s} style={{ padding: '4px', fontSize: '12px', border: '1px solid #cbd5e1' }}>Exam Pattern Avg %</th>)}
      </tr>
    </thead>
    <tbody>
      <tr>
        {activeSubs.map(s => (
          <td key={s} style={{ padding: '8px', border: '1px solid #cbd5e1' }}>
            {analysis.subjectTopExams[s]}<br/>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{analysis.subjectAverages[s]}%</span>
          </td>
        ))}
      </tr>
    </tbody>
  </table>
</div>
              {topStudents.length > 0 && (
                <div style={{ marginTop: '24px', overflowX: 'auto' }}>
                  <h4 style={{ marginBottom: '12px', color: '#1e293b' }}>🏆 Top 5 Students (Cumulative Performance)</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ background: '#e2e8f0' }}>
                        <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>Rank</th>
                        <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>Student ID</th>
                        <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>Name</th>
                        <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>Cumulative %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topStudents.map(student => (
                        <tr key={student.id} style={{ background: '#f8fafc' }}>
                          <td style={{ padding: '10px', border: '1px solid #cbd5e1', fontWeight: '600' }}>{student.rank}</td>
                          <td style={{ padding: '10px', border: '1px solid #cbd5e1' }}>{student.id}</td>
                          <td style={{ padding: '10px', border: '1px solid #cbd5e1' }}>{student.name}</td>
                          <td style={{ padding: '10px', border: '1px solid #cbd5e1' }}>{student.cumulative_percentage.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            {examWiseLoading ? <p>Loading exams...</p> : examWiseExams.length > 0 ? (
              <table style={dataTable}>
                <thead>
                  <tr>
                    <th>Program</th>
                    <th>Exam Date</th>
                    <th>Exam Pattern</th>
                    {activeSubs.map(s => <th key={s}>{s} Exam %</th>)}
                    <th>Total Exam %</th>
                    <th>School Rank</th>
                    <th>All India Rank</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {examWiseExams
                    .slice()
                    .sort((a, b) => {
                      const dateA = a.exam_date ? new Date(a.exam_date) : null;
                      const dateB = b.exam_date ? new Date(b.exam_date) : null;
                      if (!dateA && !dateB) return 0;
                      if (!dateA) return 1;
                      if (!dateB) return -1;
                      return dateA - dateB;
                    })
                    .map((exam, i) => (
                      <tr key={i}>
                        <td>{exam.program || '-'}</td>
                        <td>{exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : '-'}</td>
                        <td>{exam.exam_pattern || '-'}</td>
                        {activeSubs.map(s => (
                          <td key={s}>{exam[subjectKeyMap[s]] ? parseFloat(exam[subjectKeyMap[s]]).toFixed(2) : '-'}</td>
                        ))}
                        <td>{exam.total_exam_per_avg ? parseFloat(exam.total_exam_per_avg).toFixed(2) : '-'}</td>
                        <td>{exam.school_grade_rank ?? '-'}</td>
                        <td>{exam.all_schools_grade_rank ?? '-'}</td>
                        <td>
                          <button onClick={() => handleViewExamResult(exam)} style={{
                            padding: '6px 12px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px'
                          }}>
                            View Exam Result
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : <p>No exams found for this class-section.</p>}
          </div>
        </>
      )}
    </div>
  );
};

const renderExamWiseResultsView = () => {
  if (!currentOMRExam) {
    setView('exam');
    return null;
  }
  const results = examResults[currentOMRExam.id] || [];

  const totalStudents = results.length;
  const subjectSums = { physics: 0, chemistry: 0, maths: 0, biology: 0 };
  results.forEach(r => {
    subjectSums.physics += r.physics_marks || 0;
    subjectSums.chemistry += r.chemistry_marks || 0;
    subjectSums.maths += r.maths_marks || 0;
    subjectSums.biology += r.biology_marks || 0;
  });

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

  // ✅ Apply program-based filtering
  const activeSubs = getActiveSubjects(
  getGroupByClassSection(currentOMRExam.class, currentOMRExam.section)
);
  const filteredSubjectAverages = {};
activeSubs.forEach(sub => {
  const key = sub.toLowerCase();
  filteredSubjectAverages[key] = subjectAverages[key];
});

  const getTopStudents = (subjectKey) => {
    return [...results]
      .sort((a, b) => (b[subjectKey] || 0) - (a[subjectKey] || 0))
      .slice(0, 5)
      .map((r, idx) => ({
        rank: idx + 1,
        name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || '-',
        marks: r[subjectKey] || 0
      }));
  };

  const physicsToppers = getTopStudents('physics_marks');
  const chemistryToppers = getTopStudents('chemistry_marks');
  const mathsToppers = getTopStudents('maths_marks');
  const biologyToppers = getTopStudents('biology_marks');

  const topperRows = Array.from({ length: 5 }, (_, i) => ({
    rank: i + 1,
    physics: physicsToppers[i] || { name: '-', marks: 0 },
    chemistry: chemistryToppers[i] || { name: '-', marks: 0 },
    maths: mathsToppers[i] || { name: '-', marks: 0 },
    biology: biologyToppers[i] || { name: '-', marks: 0 }
  }));

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
    gradeCounts[range.label] = { physics: 0, chemistry: 0, maths: 0, biology: 0 };
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
        <button onClick={() => setView('exam')} style={backButton}>← Back to Exams</button>
      </div>

      <div style={{ marginTop: '40px' }}>
        <div style={{ marginBottom: '30px', padding: '20px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', textAlign: 'center' }}>📊 Subject Averages (%)</h3>
           <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
  {activeSubs.map(sub => {
    const key = sub.toLowerCase();
    return (
      <div key={sub} style={{
        textAlign: 'center',
        padding: '12px',
        minWidth: '120px',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'capitalize' }}>{sub}</div>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>{filteredSubjectAverages[key]}%</div>
        <div style={{ fontSize: '12px', color: '#64748b' }}>Avg %</div>
      </div>
    );
  })}
</div>
        </div>

        <div style={{ marginBottom: '30px', padding: '20px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: '0', color: '#065f46', textAlign: 'center' }}>🏆 Subject-wise Toppers (Top 5)</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', border: '1px solid #d1fae5' }}>
            <thead>
  <tr>
    <th style={{ ...tableHeaderStyle, background: '#ecfdf5', width: '50px' }}>Rank</th>
    {activeSubs.map(sub => (
      <React.Fragment key={sub}>
        <th style={{ ...tableHeaderStyle, background: '#ecfdf5', width: '100px' }}>{sub}</th>
        <th style={{ ...tableHeaderStyle, background: '#ecfdf5', width: '60px' }}>Marks</th>
      </React.Fragment>
    ))}
  </tr>
</thead>
           <tbody>
  {topperRows.map((row, i) => (
    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fafafa' : 'white' }}>
      <td style={tableCellStyle}>{row.rank}</td>
      {activeSubs.map(sub => {
        const key = sub.toLowerCase();
        const topper = row[key] || { name: '-', marks: 0 };
        return (
          <React.Fragment key={sub}>
            <td style={tableCellStyle}>{topper.name}</td>
            <td style={tableCellStyle}>{topper.marks}</td>
          </React.Fragment>
        );
      })}
    </tr>
  ))}
</tbody>
          </table>
        </div>

        <div style={{ padding: '20px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#b45309', textAlign: 'center' }}>📈 Grade-wise Distribution (Per Subject)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
  <tr>
    <th style={{ ...tableHeaderStyle, background: '#fef3c7' }}>Percentage Range</th>
    {activeSubs.map(sub => <th key={sub} style={{ ...tableHeaderStyle, background: '#fef3c7' }}>{sub}</th>)}
  </tr>
</thead>
              <tbody>
  {gradeRanges.map(range => (
    <tr key={range.label} style={{ backgroundColor: 'white' }}>
      <td style={{ ...tableCellStyle, background: '#fff9c4', fontWeight: '500' }}>{range.label}</td>
      {activeSubs.map(sub => {
        const key = sub.toLowerCase();
        return <td key={sub} style={tableCellStyle}>{gradeCounts[range.label][key]}</td>;
      })}
    </tr>
  ))}
</tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ===== DOWNLOAD ANALYSIS PDF BUTTON ===== */}
      <button
  onClick={() => {
    if (!results.length) return alert('No data to analyze');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 14;
    let yPos = 20;

    // ===== HEADER =====
    doc.setFillColor(30, 85, 160);
    doc.rect(0, 0, pageWidth, 20, 'F');
     // --- School Logo (left) ---
if (school?.logo_url) {
  try {
    // Adjust size and position: 20x20, centered vertically in 25pt height
    doc.addImage(school.logo_url, 'PNG', 8, 2.5, 15, 15);
  } catch (e) {
    console.warn('Failed to load school logo:', e);
  }
}
    doc.setFontSize(14);
    doc.setFont('bold');
    doc.setTextColor(255, 255, 255);
    doc.text(school.school_name || 'Unknown School', 30, 10);
    doc.setFontSize(10);
    doc.setFont('bold');
    doc.text(`Area: ${school.area || 'Not Set'}`, 30, 16);

     // --- Spectropy Logo (right) ---
try {     
  doc.addImage(spectropyLogoUrl, doc.internal.pageSize.width - 30, 2, 10, 10);
} catch (e) {
  console.warn('Failed to load Spectropy logo, falling back to text:', e);
}
    doc.setFont('bold');
    doc.text('Powered BY SPECTROPY', pageWidth - 15, 16, { align: 'right' });
    yPos += 6;

    // ===== TITLE =====
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.setFont('bold');
    doc.text(`IIT Foundation Exam Analysis Report`, margin + 40, yPos);
    yPos += 9;
    doc.setFontSize(12);
    doc.text(`${currentOMRExam.class}-${currentOMRExam.section}`, margin, yPos);
    yPos += 6;
    doc.text(`${currentOMRExam.exam_pattern}`, margin + 145, yPos - 6);
    yPos += 6;
    doc.text(`DATE: ${currentOMRExam.exam_date}`, margin + 145, yPos - 6);
    yPos += 6;
    doc.setFontSize(6);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin + 160, yPos - 30);
    yPos += 10;

    // ===== 1. SUBJECT AVERAGES + OVERALL TOPPERS (SIDE BY SIDE) =====
    doc.setFontSize(14);
    doc.text('Subject Averages (%)', margin, yPos);
    yPos += 6;

    // Subject Averages Table (DYNAMIC)
    const avgTableData = activeSubs.map(sub => {
  const key = sub.toLowerCase();
  return [sub, `${filteredSubjectAverages[key] || '0.00'}%`];
});

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

    // Overall Toppers (Top 5) — Placed beside Subject Averages
    doc.setFontSize(14);
    doc.text('Overall Toppers (Top 5)', margin + 90, yPos-6); // Offset X

    const overallToppers = [...results]
      .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
      .slice(0, 5)
      .map((r, i) => [
        i + 1,
        `${r.first_name || ''} ${r.last_name || ''}`.trim() || '-',
        `${r.percentage || 0}%`
      ]);

    doc.autoTable({
      startY: yPos,
      head: [['Rank', 'Name', 'Percentage']],
      body: overallToppers,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [34, 197, 94] },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 40 },
        2: { cellWidth: 25 }
      },
      margin: { left: margin + 90 }
    });

    const topperTableEndY = doc.lastAutoTable.finalY;
    yPos = Math.max(avgTableEndY, topperTableEndY) + 12;

    // ===== 2. GRADE DISTRIBUTION (DYNAMIC) =====
    doc.setFontSize(14);
    doc.text('Performance Distribution', margin, yPos);
    yPos += 6;

   const gradeTableData = gradeRanges.map(range => [
  range.label,
  ...activeSubs.map(s => {
    const key = s.toLowerCase();
    const marks = gradeCounts[range.label][key];
    return `${marks || 0}`;
  })
]);

    doc.autoTable({
      startY: yPos,
      head: [['Range(%)', ...activeSubs]],
      body: gradeTableData,
      theme: 'grid',
      styles: { fontSize: 12, halign: 'center' },
      headStyles: { fillColor: [65, 105, 225] },
      columnStyles: { 0: { cellWidth: 25 } }
    });
    yPos = doc.lastAutoTable.finalY + 12;

    // ===== 3. SUBJECT-WISE TOPPERS (DYNAMIC MERGED TABLE) =====
    doc.setFontSize(14);
    doc.text('Subject-wise Toppers (Top 5)', margin, yPos);
    yPos += 6;

    const topperTableData = Array.from({ length: 5 }, (_, i) => {
  const row = [i + 1];
  activeSubs.forEach(sub => {
    const key = sub.toLowerCase();
    const topper = topperRows[i][key] || { name: '-', marks: 0 };
    row.push(topper.name, topper.marks);
  });
  return row;
});

    const topperHeaders = ['Rank'];
    activeSubs.forEach(sub => {
      topperHeaders.push(`${sub}\nName`, 'Marks');
    });

    const totalCols = 1 + activeSubs.length * 2;
    const colWidth = (pageWidth - 28) / totalCols;
    const columnStyles = {};
    for (let i = 0; i < totalCols; i++) {
      columnStyles[i] = { cellWidth: colWidth };
    }

    doc.autoTable({
      startY: yPos,
      head: [topperHeaders],
      body: topperTableData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [34, 197, 94], fontSize: 9 },
      columnStyles
    });

    // ===== SAVE =====
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

      {/* ===== STUDENT RESULTS TABLE ===== */}
      {resultsLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', fontSize: '16px', color: '#6b7280' }}>🔄 Loading exam results...</div>
      ) : results.length > 0 ? (
        <>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => {
              const doc = new jsPDF('landscape');
              const pageWidth = doc.internal.pageSize.width;
              const margin = 14;
              let yPos = 20;

              // Header
              doc.setFillColor(30, 85, 160);
              doc.rect(0, 0, pageWidth, 20, 'F');
              // --- School Logo (left) ---
if (school?.logo_url) {
  try {
    // Adjust size and position: 20x20, centered vertically in 25pt height
    doc.addImage(school.logo_url, 'PNG', 8, 2.5, 15, 15);
  } catch (e) {
    console.warn('Failed to load school logo:', e);
  }
}
             
              doc.setFontSize(14);
              doc.setFont('bold');
              doc.setTextColor(255, 255, 255);
              doc.text(school.school_name || 'Unknown School', 30, 10);
              doc.setFontSize(10);
              doc.setFont('bold');
              doc.text(`Area: ${school.area || 'Not Set'}`, 30, 16);             
    // --- Spectropy Logo (right) ---
try {     
  doc.addImage(spectropyLogoUrl, doc.internal.pageSize.width - 30, 2, 10, 10);
} catch (e) {
  console.warn('Failed to load Spectropy logo, falling back to text:', e);
}
              doc.setFont('italic');
              doc.text('Powered BY SPECTROPY', pageWidth - 15, 16, { align: 'right' });
              yPos += 6;

              // Title
              doc.setFontSize(18);
              doc.setFont('bold');
              doc.setTextColor(0, 0, 0);
              doc.text(`IIT Foundation Exam Result`, margin + 100, yPos);
              yPos += 9;
              doc.setFontSize(14);
              doc.setFont('bold');
              doc.setTextColor(0, 0, 0);
              doc.text(`${currentOMRExam.class}-${currentOMRExam.section} `, margin, yPos);
              doc.text(`${currentOMRExam.exam_pattern} | DATE:${currentOMRExam.exam_date}`, margin + 200, yPos - 6);
              doc.setFontSize(6);
              doc.text(`Generated: ${new Date().toLocaleString()}`, margin + 230, yPos - 12);

              // Headers — DYNAMIC
              const headers = [
                'Student ID', 'Name', 'Total Max Marks', 'Correct', 'Wrong', 'Unattempted',
                ...activeSubs,
                'Total Marks', '%', 'Class Rank', 'School Rank', 'All India Rank'
              ];

              const sortedResults = [...results].sort((a, b) => b.percentage - a.percentage);
              const body = sortedResults.map(r => [
                r.student_id || '-',
                `${r.first_name || ''} ${r.last_name || ''}`.trim() || '-',
                r.total_questions || 0,
                r.correct_answers || 0,
                r.wrong_answers || 0,
                r.unattempted || 0,
                ...activeSubs.map(sub => r[`${sub.toLowerCase()}_marks`] || 0),
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
                styles: { fontSize: 8, halign: 'center', textColor: [0, 0, 0] },
                headStyles: { fillColor: [65, 105, 255], textColor: [255, 255, 255] },
                columnStyles: {
                  11: { fontStyle: 'bold' }
                }
              });
              doc.save(`Exam_Results_${currentOMRExam.id}.pdf`);
            }} style={{
              padding: '10px 20px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}>
              📥 Download Student Results PDF
            </button>
          </div>
          <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Student ID</th>
                  <th style={tableHeaderStyle}>Name</th>
                  <th style={tableHeaderStyle}>Total Max Marks</th>
                  <th style={tableHeaderStyle}>Correct</th>
                  <th style={tableHeaderStyle}>Wrong</th>
                  <th style={tableHeaderStyle}>Unattempted</th>
                  {activeSubs.map(sub => <th key={sub} style={tableHeaderStyle}>{sub}</th>)}
                  <th style={tableHeaderStyle}>Total Marks</th>
                  <th style={tableHeaderStyle}>%</th>
                  <th style={tableHeaderStyle}>Class Rank</th>
                  <th style={tableHeaderStyle}>School Rank</th>
                  <th style={tableHeaderStyle}>All India Rank</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const sortedResults = [...results].sort((a, b) => b.percentage - a.percentage);
                  return sortedResults.map((r, i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fafafa' : 'white' }}>
                      <td style={tableCellStyle}>{r.student_id || '-'}</td>
                      <td style={tableCellStyle}>{`${r.first_name || ''} ${r.last_name || ''}`.trim() || '-'}</td>
                      <td style={tableCellStyle}>{r.total_questions || 0}</td>
                      <td style={tableCellStyle}>{r.correct_answers || 0}</td>
                      <td style={tableCellStyle}>{r.wrong_answers || 0}</td>
                      <td style={tableCellStyle}>{r.unattempted || 0}</td>
                      {activeSubs.map(sub => (
                        <td key={sub} style={tableCellStyle}>{r[`${sub.toLowerCase()}_marks`] || 0}</td>
                      ))}
                      <td style={tableCellStyle}>{r.total_marks || 0}</td>
                      <td style={tableCellStyle}>{r.percentage || 0}%</td>
                      <td style={tableCellStyle}>{r.class_rank || '-'}</td>
                      <td style={tableCellStyle}>{r.school_rank || '-'}</td>
                      <td style={tableCellStyle}>{r.all_schools_rank || '-'}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>📭 No results available.</div>
      )}
    </div>
  );
};

const renderStudentWiseView = () => {
  const handleViewStudent = () => {
    const id = studentIdInput.trim();
    if (!id) {
      setStudentIdInputError('Please enter a valid Student ID.');
      return;
    }
    setStudentIdInputError('');
    setSelectedStudentId(id);
    setView('student'); // ✅ Now safe — `setView` comes from parent scope
  };
  console.log("📌 Rendering student view? view =", view, "selectedStudentId =", selectedStudentId);
  if (view === 'student' && selectedStudentId && selectedStudentId.trim() !== '') {
  return (
  <StudentDashboard
    studentId={selectedStudentId.trim()}
    onBack={() => {
      setView('overview');
      setStudentIdInput('');
      setStudentIdInputError('');
      setSelectedStudentId('');
    }}
  />
);
} 
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>🎓 Student Wise Performance</h2>
        <button
        onClick={() => {
        setView('overview');
        setStudentIdInput('');
        setStudentIdInputError('');
        setSelectedStudentId('');
        }}
        style={backButton}
        >
        ← Back to Overview
       </button>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
        <p style={{ marginBottom: '16px', color: '#475569' }}>
          Enter a Student ID to view their detailed performance dashboard.
        </p>

        <input
          type="text"
          value={studentIdInput}
          onChange={(e) => {
            setStudentIdInput(e.target.value);
            if (studentIdInputError) setStudentIdInputError('');
          }}
          placeholder="Enter Student ID (e.g., 12345)"
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            marginBottom: '12px'
          }}
        />

        {studentIdInputError && (
          <p style={{ color: 'red', marginBottom: '12px' }}>{studentIdInputError}</p>
        )}

        <button
          onClick={handleViewStudent}
          style={{
            padding: '10px 24px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500',
            width: '100%'
          }}
        >
          🔍 View Student Dashboard
        </button>
      </div>
    </div>
  );
};

const renderTeacherWiseView = () => {
  const handleViewTeacher = () => {
    const id = teacherIdInput.trim();
    if (!id) {
      setTeacherIdInputError('Please enter a valid Teacher ID.');
      return;
    }
    setTeacherIdInputError('');
    setSelectedTeacherId(id);
    setView('teacher');
  };

  // ✅ ADD THIS: Render TeacherDashboard inline when view is 'teacher-dashboard'
  if (view === 'teacher' && selectedTeacherId && selectedTeacherId.trim() !== '') {
    return (
  <TeacherDashboard
    teacherId={selectedTeacherId.trim()}
    onBack={() => {
      setView('overview');
      setTeacherIdInput('');
      setTeacherIdInputError('');
      setSelectedTeacherId('');
    }}
  />
);
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>👨‍🏫 Teacher Wise Performance</h2>
        <button
        onClick={() => {
        setView('overview');
        setTeacherIdInput('');
        setTeacherIdInputError('');
        setSelectedTeacherId('');
        }}
        style={backButton}
        >
        ← Back to Overview
      </button>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
        <p style={{ marginBottom: '16px', color: '#475569' }}>
          Enter a Teacher ID to view their detailed performance dashboard.
        </p>

        <input
          type="text"
          value={teacherIdInput}
          onChange={(e) => {
            setTeacherIdInput(e.target.value);
            if (teacherIdInputError) setTeacherIdInputError('');
          }}
          placeholder="Enter Teacher ID (e.g., TS251101)"
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            marginBottom: '12px'
          }}
        />

        {teacherIdInputError && (
          <p style={{ color: 'red', marginBottom: '12px' }}>{teacherIdInputError}</p>
        )}

        <button
          onClick={handleViewTeacher}
          style={{
            padding: '10px 24px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500',
            width: '100%'
          }}
        >
          🔍 View Teacher Dashboard
        </button>
      </div>
    </div>
  );
};

  // 🖼️ Render Based on View State
  const renderContent = () => {
    switch (view) {
      case 'teacher':
      return renderTeacherWiseView();
      case 'exam':
        return renderExamWiseView();
      case 'examwise-results':
        return renderExamWiseResultsView();
      case 'student':
        return renderStudentWiseView(); 
      default:
        return (
          <>
            {renderSchoolHeader()}

            {renderMetricButtons()}

            {renderIITBatches()}

            {renderTeachersTable()}
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
  padding: '8px',
  background: '#6b7280',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '12px'
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