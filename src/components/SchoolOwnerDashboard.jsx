import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';import React, { useState, useEffect } from "react";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (same as your backend)
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || 'https://your-project.supabase.co',
  process.env.REACT_APP_SUPABASE_ANON_KEY || 'your-anon-key'
);

export default function SchoolOwnerDashboard({ onBack }) {
  const [school, setSchool] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filters, setFilters] = useState({ class: '', section: '' });

  // Get school_id from session (set during login)
  const school_id = sessionStorage.getItem('sp_school_id');

  useEffect(() => {
    if (!school_id) {
      alert('No school linked to this session');
      onBack();
      return;
    }

    fetchSchoolData();
    fetchStudents();
  }, [school_id]);

  const fetchSchoolData = async () => {
    const { data, error } = await supabase
      .from('school_list')
      .select('*')
      .eq('school_id', school_id)
      .single();

    if (error) {
      console.error('Failed to load school:', error);
      alert('Could not load school data');
      onBack();
    } else {
      setSchool(data);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', school_id)
      .order('class')
      .order('section')
      .order('roll_no');

    if (error) {
      console.error('Failed to load students:', error);
      alert('Failed to load student list');
    } else {
      setStudents(data || []);
    }
    setLoading(false);
  };

  // Generate Student ID: SCHOOL_ID-GRADE-SECTION-ROLL (e.g., TS2501-11A-01)
  const generateStudentId = (grade, section, roll) => {
    const g = grade.replace('GRADE-', '').padStart(2, '0');
    const r = String(roll).padStart(2, '0');
    return `${school_id}-${g}${section}-${r}`;
  };

  // Handle Excel Upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);

        const newStudents = [];
        const errors = [];

        for (let i = 0; i < json.length; i++) {
          const row = json[i];
          const roll_no = parseInt(row['Roll No'] || row['roll_no'], 10);
          const name = row['Student Name'] || row['name'];
          const cls = row['Class'] || row['class'];
          const section = row['Section'] || row['section'];
          const gender = row['Gender'] || row['gender'] || null;

          if (!roll_no || !name || !cls || !section) {
            errors.push(`Row ${i + 1}: Missing required field(s)`);
            continue;
          }

          // Check for duplicates in current list
          const existing = students.find(s => s.roll_no === roll_no && s.class === cls && s.section === section);
          if (existing) {
            errors.push(`Roll No ${roll_no} in ${cls} ${section} already exists`);
            continue;
          }

          const student_id = generateStudentId(cls, section, roll_no);
          newStudents.push({
            school_id,
            student_id,
            roll_no,
            name,
            class: cls,
            section,
            gender
          });
        }

        if (errors.length > 0) {
          alert('Upload failed:\n' + errors.join('\n'));
          setUploading(false);
          return;
        }

        // Insert to Supabase
        const { error: insertError } = await supabase.from('students').insert(newStudents);

        if (insertError) {
          if (insertError.code === '23505') {
            alert('One or more students already exist (duplicate student_id or roll_no)');
          } else {
            alert('Database error: ' + insertError.message);
          }
        } else {
          alert(`✅ Successfully uploaded ${newStudents.length} students!`);
          fetchStudents(); // Refresh list
        }
      } catch (err) {
        console.error('Upload error:', err);
        alert('❌ Failed to parse Excel file');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Download Sample Template
  const downloadSample = () => {
    const sampleData = [
      { "Roll No": 1, "Student Name": "Rahul Reddy", "Class": "GRADE-11", "Section": "A", "Gender": "Male" },
      { "Roll No": 2, "Student Name": "Priya Sharma", "Class": "GRADE-11", "Section": "A", "Gender": "Female" },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "SPECTROPY_Student_Upload_Template.xlsx");
  };

  // Filter students
  const filteredStudents = students.filter(s => {
    return (filters.class ? s.class === filters.class : true) &&
           (filters.section ? s.section === filters.section : true);
  });

  // Download as Excel
  const downloadAsExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredStudents);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, `${school_id}_Students_List.xlsx`);
  };

  // Download as PDF
  const downloadAsPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${school?.school_name}`, 14, 15);
    doc.setFontSize(12);
    doc.text(`Student List • ${school_id}`, 14, 25);

    if (filteredStudents.length > 0) {
      const tableData = filteredStudents.map(s => [
        s.student_id,
        s.roll_no,
        s.name,
        s.class,
        s.section,
        s.gender || '-'
      ]);
      doc.autoTable({
        head: [['Student ID', 'Roll No', 'Name', 'Class', 'Section', 'Gender']],
        body: tableData,
        startY: 35,
      });
    } else {
      doc.text("No students to display", 14, 35);
    }
    doc.save(`${school_id}_Students_List.pdf`);
  };

  if (!school) return <div>Loading school data...</div>;

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <button onClick={onBack} style={{ marginBottom: 16 }}>&#8592; Back to Login</button>

      <h2>🏫 {school.school_name}</h2>
      <p><strong>SCHOOL_ID:</strong> {school.school_id}</p>
      <p>{school.area || 'N/A'}, {school.district}, {school.state} • {school.academic_year}</p>

      <hr style={{ margin: '20px 0' }} />

      <h3>📥 Upload Students List</h3>
      <p>
        <button onClick={downloadSample} className="btn btn-outline">
          📥 Download Sample Excel Format
        </button>
      </p>
      <p>
        <strong>Student ID Format:</strong>{' '}
        <code>{school.school_id}-11A-01</code> → (SCHOOL_ID + GRADE + SECTION + 2-digit roll)
      </p>
      <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={uploading} />
      {uploading && <p>Uploading students...</p>}

      <div style={{ marginTop: 20 }}>
        <label>Filter: </label>
        <select value={filters.class} onChange={e => setFilters(prev => ({ ...prev, class: e.target.value }))}>
          <option value="">All Classes</option>
          {Array.from(new Set(students.map(s => s.class))).map(cls => (
            <option key={cls} value={cls}>{cls}</option>
          ))}
        </select>
        <select value={filters.section} onChange={e => setFilters(prev => ({ ...prev, section: e.target.value }))} style={{ marginLeft: 10 }}>
          <option value="">All Sections</option>
          {Array.from(new Set(students.map(s => s.section))).map(sec => (
            <option key={sec} value={sec}>{sec}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Loading students...</p>
      ) : (
        <>
          <h3>📊 Student List ({filteredStudents.length})</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
            <thead>
              <tr style={{ background: '#f0f8ff' }}>
                <th style={th}>Student ID</th>
                <th style={th}>Roll No</th>
                <th style={th}>Name</th>
                <th style={th}>Class</th>
                <th style={th}>Section</th>
                <th style={th}>Gender</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s, i) => (
                <tr key={s.id || i}>
                  <td style={td}>{s.student_id}</td>
                  <td style={td}>{s.roll_no}</td>
                  <td style={td}>{s.name}</td>
                  <td style={td}>{s.class}</td>
                  <td style={td}>{s.section}</td>
                  <td style={td}>{s.gender || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 20 }}>
            <button onClick={downloadAsExcel} style={btnStyle}>📥 Download as Excel</button>
            <button onClick={downloadAsPDF} style={{ ...btnStyle, marginLeft: 10 }}>📄 Download as PDF</button>
          </div>
        </>
      )}
    </div>
  );
}

// Styles
const th = { padding: '8px', borderBottom: '1px solid #ddd', textAlign: 'left' };
const td = { padding: '8px', borderBottom: '1px solid #eee' };
const btnStyle = { padding: '8px 12px', border: 'none', background: '#1a56db', color: 'white', borderRadius: 6, cursor: 'pointer' };

// Import at top of file
// import * as XLSX from 'xlsx';
// import jsPDF from 'jspdf';
// import 'jspdf-autotable';