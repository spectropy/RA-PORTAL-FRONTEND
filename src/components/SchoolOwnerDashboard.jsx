// SchoolOwnerDashboard.jsx
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import React, { useState, useEffect } from "react";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'
);

export default function SchoolOwnerDashboard({ onBack }) {
  const [school, setSchool] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filters, setFilters] = useState({ class: '', section: '' });

  const school_id = sessionStorage.getItem('sp_school_id');

  useEffect(() => {
    if (!school_id) {
      alert('No session found. Please log in again.');
      onBack();
      return;
    }

    const loadData = async () => {
      await fetchSchoolData();
      await fetchStudents();
    };

    loadData();
  }, [school_id]);

  const fetchSchoolData = async () => {
    try {
      const { data, error } = await supabase
        .from('school_list')
        .select('*')
        .eq('school_id', school_id)
        .single();

      if (error) throw error;
      setSchool(data);
    } catch (err) {
      console.error('Error fetching school:', err);
      alert('School not found. Redirecting...');
      onBack();
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('school_id', school_id)
        .order('class')
        .order('section')
        .order('roll_no');

      if (error) throw error;
      setStudents(data || []);
    } catch (err) {
      console.error('Error fetching students:', err);
      alert('Failed to load student list.');
    } finally {
      setLoading(false);
    }
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
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const newStudents = [];
        const errors = [];

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const roll_no = parseInt(row['Roll No'] || row['roll_no'], 10);
          const name = row['Student Name'] || row['name'];
          const cls = (row['Class'] || row['class']).toString().trim();
          const section = (row['Section'] || row['section']).toString().trim();
          const gender = String(row['Gender'] || row['gender'] || '').trim() || null;

          if (!roll_no || !name || !cls || !section) {
            errors.push(`Row ${i + 1}: Missing required field(s)`);
            continue;
          }

          const exists = students.some(s => s.roll_no === roll_no && s.class === cls && s.section === section);
          if (exists) {
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
            gender,
          });
        }

        if (errors.length > 0) {
          alert('Upload failed:\n' + errors.join('\n'));
          return;
        }

        const { error: insertError } = await supabase.from('students').insert(newStudents);

        if (insertError?.code === '23505') {
          alert('One or more students already exist (duplicate student_id)');
        } else if (insertError) {
          alert('Database error: ' + insertError.message);
        } else {
          alert(`✅ Uploaded ${newStudents.length} students!`);
          fetchStudents(); // Refresh
        }
      } catch (err) {
        console.error('Upload error:', err);
        alert('❌ Failed to parse Excel file.');
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
    XLSX.utils.book_append_sheet(wb, ws, "Student Data");
    XLSX.writeFile(wb, "SPECTROPY_Student_Upload_Template.xlsx");
  };

  // Filters
  const filteredStudents = students.filter(s => {
    return (filters.class ? s.class === filters.class : true) &&
           (filters.section ? s.section === filters.section : true);
  });

  // Export to Excel
  const downloadAsExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredStudents);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, `${school?.school_name?.replace(/\s+/g, '_') || school_id}_Students_List.xlsx`);
  };

  // Export to PDF
  const downloadAsPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`${school?.school_name}`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Student List • ${school_id}`, 14, 30);

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
        startY: 40,
        theme: 'striped',
        headStyles: { fillColor: [26, 86, 219] }
      });
    } else {
      doc.text("No students to display", 14, 40);
    }
    doc.save(`${school?.school_name?.replace(/\s+/g, '_') || school_id}_Students_List.pdf`);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('sp_school_id');
    onBack();
  };

  if (!school) return <div style={styles.container}>Loading school...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={handleLogout} style={styles.backButton}>← Logout</button>
        <h2 style={styles.title}>🏫 {school.school_name}</h2>
        <p><strong>SCHOOL_ID:</strong> {school.school_id}</p>
        <p>{school.area || 'N/A'}, {school.district}, {school.state} • {school.academic_year}</p>
      </div>

      <hr style={styles.divider} />

      <section style={styles.section}>
        <h3 style={styles.heading}>📥 Upload Students</h3>
        <button onClick={downloadSample} style={styles.buttonOutline}>📥 Download Sample Format</button>
        <p style={styles.note}>
          <strong>Student ID:</strong> <code style={styles.code}>{school.school_id}-11A-01</code>
        </p>
        <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={uploading} />
        {uploading && <p style={styles.uploading}>Uploading...</p>}
      </section>

      <hr style={styles.divider} />

      <div style={styles.filterContainer}>
        <label style={styles.label}>Filter: </label>
        <select value={filters.class} onChange={e => setFilters(p => ({ ...p, class: e.target.value }))} style={styles.select}>
          <option value="">All Classes</option>
          {Array.from(new Set(students.map(s => s.class))).sort().map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={filters.section} onChange={e => setFilters(p => ({ ...p, section: e.target.value }))} style={{ ...styles.select, marginLeft: 10 }}>
          <option value="">All Sections</option>
          {Array.from(new Set(students.map(s => s.section))).sort().map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Loading students...</p>
      ) : (
        <>
          <h3 style={styles.heading}>📊 Student List ({filteredStudents.length})</h3>
          {filteredStudents.length === 0 ? (
            <p>No students match filters.</p>
          ) : (
            <table style={styles.table}>
              <thead><tr style={styles.tableHeader}>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Roll</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Class</th>
                <th style={styles.th}>Section</th>
                <th style={styles.th}>Gender</th>
              </tr></thead>
              <tbody>
                {filteredStudents.map(s => (
                  <tr key={s.id} style={styles.tableRow}>
                    <td style={styles.td}>{s.student_id}</td>
                    <td style={styles.td}>{s.roll_no}</td>
                    <td style={styles.td}>{s.name}</td>
                    <td style={styles.td}>{s.class}</td>
                    <td style={styles.td}>{s.section}</td>
                    <td style={styles.td}>{s.gender || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={styles.actions}>
            <button onClick={downloadAsExcel} style={styles.button}>📥 Excel</button>
            <button onClick={downloadAsPDF} style={{ ...styles.button, marginLeft: 12 }}>📄 PDF</button>
          </div>
        </>
      )}
    </div>
  );
}

// === Styles ===
const styles = {
  container: { padding: '20px', fontFamily: 'Arial', maxWidth: '1100px', margin: '0 auto' },
  header: { marginBottom: '20px' },
  backButton: { padding: '8px 16px', border: '1px solid #4682b4', background: 'white', color: '#4682b4', borderRadius: 6, cursor: 'pointer' },
  title: { margin: '0 0 8px 0', color: '#1e90ff', fontSize: '24px' },
  divider: { margin: '20px 0', borderColor: '#ddd' },
  section: { marginBottom: '20px' },
  heading: { margin: '0 0 12px 0', color: '#1e3d59', fontSize: '18px' },
  buttonOutline: { padding: '8px 12px', border: '1px solid #1e90ff', background: 'transparent', color: '#1e90ff', borderRadius: 6, cursor: 'pointer' },
  note: { fontSize: '13px', color: '#555', margin: '8px 0' },
  code: { backgroundColor: '#eee', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' },
  filterContainer: { marginBottom: '20px' },
  label: { marginRight: '8px', fontSize: '14px', fontWeight: '600' },
  select: { padding: '6px 8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '6px' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '10px', background: 'white', boxShadow: '0 1px 5px rgba(0,0,0,0.1)' },
  tableHeader: { backgroundColor: '#f0f8ff' },
  th: { textAlign: 'left', padding: '10px', borderBottom: '2px solid #ddd', color: '#1e3d59' },
  td: { padding: '10px', borderBottom: '1px solid #eee' },
  actions: { marginTop: '20px', display: 'flex' },
  button: { padding: '10px 16px', border: 'none', background: '#1a56db', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' },
};