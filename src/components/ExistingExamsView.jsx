import React, { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const examParams = (exam) => new URLSearchParams({
  program: exam.program,
  exam_pattern: exam.exam_pattern,
  class: exam.class,
  section: exam.section,
  exam_date: exam.exam_date
});

const readResponse = async (response, fallbackMessage) => {
  const contentType = response.headers.get('content-type');
  const data = contentType?.includes('application/json')
    ? await response.json()
    : { message: await response.text() };

  if (!response.ok) {
    throw new Error(data.error || data.message || fallbackMessage);
  }
  return data;
};

const labelExam = (value) => String(value || 'N/A').replaceAll('_', ' ');

export default function ExistingExamsView({ schoolId }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedExam, setSelectedExam] = useState(null);
  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null);

  useEffect(() => {
    if (!schoolId) {
      setExams([]);
      setSelectedExam(null);
      setResults([]);
      return;
    }

    let cancelled = false;
    const loadExams = async () => {
      setLoading(true);
      setError('');
      setSuccess('');
      setSelectedExam(null);
      setResults([]);

      try {
        const response = await fetch(
          `${API_BASE}/api/schools/${encodeURIComponent(schoolId)}/exam-datasets`
        );
        const data = await readResponse(response, 'Failed to load existing exams');
        if (!cancelled) setExams(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load existing exams');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadExams();
    return () => { cancelled = true; };
  }, [schoolId]);

  const handleView = async (exam) => {
    setLoadingResults(true);
    setError('');
    setSuccess('');

    try {
      const params = examParams(exam);
      const response = await fetch(
        `${API_BASE}/api/schools/${encodeURIComponent(schoolId)}/exam-datasets/results?${params}`
      );
      const data = await readResponse(response, 'Failed to load exam results');
      setSelectedExam(exam);
      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load exam results');
    } finally {
      setLoadingResults(false);
    }
  };

  const handleDelete = async (exam) => {
    if (deletingKey) return;

    const confirmation = window.prompt(
      `Delete ${labelExam(exam.exam_pattern)} for ${exam.class}-${exam.section} ` +
      `on ${exam.exam_date}? ${exam.student_count} student result(s) will be deleted. ` +
      'Type DELETE EXAM to continue.'
    );
    if (confirmation !== 'DELETE EXAM') return;

    setDeletingKey(exam.key);
    setError('');
    setSuccess('');

    try {
      const params = examParams(exam);
      const response = await fetch(
        `${API_BASE}/api/schools/${encodeURIComponent(schoolId)}/exam-datasets?${params}`,
        { method: 'DELETE' }
      );
      const data = await readResponse(response, 'Failed to delete exam data');

      setExams(current => current.filter(item => item.key !== exam.key));
      if (selectedExam?.key === exam.key) {
        setSelectedExam(null);
        setResults([]);
      }
      setSuccess(`${labelExam(exam.exam_pattern)} and ${data.deletedCount} result(s) deleted successfully.`);
    } catch (err) {
      setError(err.message || 'Failed to delete exam data');
    } finally {
      setDeletingKey(null);
    }
  };

  const headerCell = {
    padding: '10px',
    textAlign: 'left',
    borderBottom: '2px solid #d1d5db',
    background: '#f1f5f9',
    whiteSpace: 'nowrap'
  };
  const cell = { padding: '10px', borderBottom: '1px solid #e5e7eb' };

  if (!schoolId) {
    return <p style={{ color: '#64748b' }}>Select a school to view its existing exams.</p>;
  }

  if (selectedExam) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: '0 0 5px', color: '#1e90ff' }}>{labelExam(selectedExam.exam_pattern)}</h3>
            <span style={{ color: '#475569' }}>
              {selectedExam.program} · {selectedExam.class}-{selectedExam.section} · {selectedExam.exam_date}
            </span>
          </div>
          <button
            type="button"
            onClick={() => { setSelectedExam(null); setResults([]); }}
            style={{ padding: '8px 14px', border: '1px solid #94a3b8', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
          >
            Back to Exams
          </button>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '1100px' }}>
            <thead>
              <tr>
                {['Student ID', 'Student Name', 'Correct', 'Wrong', 'Unattempted', 'Physics', 'Chemistry', 'Maths', 'Biology', 'Total', '%', 'Class Rank', 'School Rank', 'All India Rank'].map(title => (
                  <th key={title} style={headerCell}>{title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map(result => (
                <tr key={result.id || result.student_id}>
                  <td style={cell}>{result.student_id || '-'}</td>
                  <td style={cell}>{`${result.first_name || ''} ${result.last_name || ''}`.trim() || '-'}</td>
                  <td style={cell}>{result.correct_answers ?? 0}</td>
                  <td style={cell}>{result.wrong_answers ?? 0}</td>
                  <td style={cell}>{result.unattempted ?? 0}</td>
                  <td style={cell}>{result.physics_marks ?? 0}</td>
                  <td style={cell}>{result.chemistry_marks ?? 0}</td>
                  <td style={cell}>{result.maths_marks ?? 0}</td>
                  <td style={cell}>{result.biology_marks ?? 0}</td>
                  <td style={cell}>{result.total_marks ?? 0}</td>
                  <td style={cell}>{result.percentage ?? 0}%</td>
                  <td style={cell}>{result.class_rank || '-'}</td>
                  <td style={cell}>{result.school_rank || '-'}</td>
                  <td style={cell}>{result.all_schools_rank || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ margin: '0 0 16px', color: '#333' }}>Existing Exams</h3>

      {error && <div style={{ padding: '10px', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '15px' }}>{error}</div>}
      {success && <div style={{ padding: '10px', color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', marginBottom: '15px' }}>{success}</div>}

      {loading ? (
        <p>Loading existing exams...</p>
      ) : exams.length === 0 ? (
        <p style={{ color: '#64748b', fontStyle: 'italic' }}>No exams have been uploaded for this school.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '760px' }}>
            <thead>
              <tr>
                {['Exam', 'Program', 'Class-Section', 'Exam Date', 'Students', 'Actions'].map(title => (
                  <th key={title} style={headerCell}>{title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exams.map(exam => (
                <tr key={exam.key}>
                  <td style={cell}>{labelExam(exam.exam_pattern)}</td>
                  <td style={cell}>{exam.program}</td>
                  <td style={cell}>{exam.class}-{exam.section}</td>
                  <td style={cell}>{exam.exam_date || '-'}</td>
                  <td style={cell}>{exam.student_count}</td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      onClick={() => handleView(exam)}
                      disabled={loadingResults || Boolean(deletingKey)}
                      style={{ padding: '6px 12px', color: 'white', background: '#1e90ff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}
                    >
                      {loadingResults ? 'Loading...' : 'View'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(exam)}
                      disabled={Boolean(deletingKey) || loadingResults}
                      style={{ padding: '6px 12px', color: 'white', background: deletingKey === exam.key ? '#9ca3af' : '#dc3545', border: 'none', borderRadius: '4px', cursor: deletingKey || loadingResults ? 'not-allowed' : 'pointer' }}
                    >
                      {deletingKey === exam.key ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
