// src/components/OMRUploadView.jsx
import React from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const OMRUploadView = ({
  currentOMRExam,
  file,
  setFile,
  uploading,
  setUploading,
  uploadError,
  setUploadError,
  examResults,
  setExamResults,
  setCurrentOMRExam,
  downloadPDF
}) => {
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
        alert(`✅ Results uploaded successfully for ${exam.exam_pattern.replace('_', ' ')}`);
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

  if (!currentOMRExam) return null;

  return (
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
  );
};

export default OMRUploadView;