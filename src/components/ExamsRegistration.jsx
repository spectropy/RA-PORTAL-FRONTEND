import React, { useState, useEffect } from 'react';
import { getSchoolById, createExam, getFoundations, getPrograms } from '../api';

export default function ExamsRegistration({ schools = [] }) {
  const [foundations, setFoundations] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selectedFoundation, setSelectedFoundation] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [examName, setExamName] = useState('');
  const [examTemplate, setExamTemplate] = useState('');
  const [examPattern, setExamPattern] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [schoolData, setSchoolData] = useState(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Fetch foundations and programs
    const fetchOptions = async () => {
      try {
        // Try to fetch from API, fallback to mock data if API fails
        try {
          const fetchedFoundations = await getFoundations();
          setFoundations(fetchedFoundations);
        } catch (err) {
          console.warn('Failed to fetch foundations from API, using mock data:', err);
          setFoundations([
            { id: 'cbse', name: 'CBSE' },
            { id: 'icse', name: 'ICSE' },
            { id: 'state-board', name: 'State Board' },
            { id: 'ib', name: 'International Baccalaureate' }
          ]);
        }

        try {
          const fetchedPrograms = await getPrograms();
          setPrograms(fetchedPrograms);
        } catch (err) {
          console.warn('Failed to fetch programs from API, using mock data:', err);
          setPrograms([
            { id: 'regular', name: 'Regular Program' },
            { id: 'advanced', name: 'Advanced Program' },
            { id: 'foundation', name: 'Foundation Program' },
            { id: 'olympiad', name: 'Olympiad Program' }
          ]);
        }
      } catch (err) {
        console.error('Error fetching options:', err);
        setError('Failed to load options');
      }
    };

    fetchOptions();
  }, []);

  useEffect(() => {
    if (selectedSchool) {
      fetchSchoolData();
    }
  }, [selectedSchool]);

  const fetchSchoolData = async () => {
    if (!selectedSchool) return;
    
    setLoading(true);
    setError('');
    try {
      const data = await getSchoolById(selectedSchool);
      setSchoolData(data);
    } catch (err) {
      setError(err.message || 'Failed to load school data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedFoundation) {
      setError('Please select a foundation');
      return;
    }
    
    if (!selectedProgram) {
      setError('Please select a program');
      return;
    }
    
    if (!examName) {
      setError('Please enter exam name');
      return;
    }
    
    if (!examTemplate) {
      setError('Please select exam template');
      return;
    }
    
    if (!selectedSchool) {
      setError('Please select a school');
      return;
    }
    
    if (!selectedClass) {
      setError('Please select a class');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        school_id: selectedSchool,
        foundation: selectedFoundation,
        program: selectedProgram,
        exam_name: examName,
        exam_template: examTemplate,
        exam_pattern: examPattern,
        class: selectedClass,
        created_at: new Date().toISOString()
      };

      await createExam(payload);
      setSuccess('Exam created successfully!');
      
      // Reset form
      setExamName('');
      setExamTemplate('');
      setExamPattern('');
      setSelectedClass('');
    } catch (err) {
      setError(err.message || 'Failed to create exam');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h3 style={{ margin: '0 0 20px 0', color: '#1e90ff' }}>📝 Exams Registration</h3>
      
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

      {/* Foundation and Program Selection */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
            Foundation Selection *
          </label>
          <select
            value={selectedFoundation}
            onChange={(e) => setSelectedFoundation(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
            required
          >
            <option value="">-- Select Foundation --</option>
            {foundations.map(foundation => (
              <option key={foundation.id} value={foundation.id}>{foundation.name}</option>
            ))}
          </select>
        </div>
        
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
            Program Selection *
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
            {programs.map(program => (
              <option key={program.id} value={program.id}>{program.name}</option>
            ))}
          </select>
        </div>
      </div>

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
          {/* Class Selection */}
          <div style={{ marginBottom: '20px' }}>
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
                  Class {cls.class} - Section {cls.section}
                </option>
              ))}
            </select>
          </div>

          {/* Exam Details Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Exam Name *
              </label>
              <input
                type="text"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="Enter exam name"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Exam Template *
              </label>
              <select
                value={examTemplate}
                onChange={(e) => setExamTemplate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                required
              >
                <option value="">-- Select Template --</option>
                <option value="PIONEER_WT">PIONEER_WT</option>
                <option value="PIONEER_UT">PIONEER_UT</option>
                <option value="MONTHLY_TEST">MONTHLY_TEST</option>
                <option value="QUARTERLY_EXAM">QUARTERLY_EXAM</option>
                <option value="HALF_YEARLY">HALF_YEARLY</option>
                <option value="ANNUAL_EXAM">ANNUAL_EXAM</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                Exam Pattern
              </label>
              <textarea
                value={examPattern}
                onChange={(e) => setExamPattern(e.target.value)}
                placeholder="Describe the exam pattern (optional)"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  minHeight: '100px'
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                padding: '10px 20px',
                background: '#1e90ff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Add Exam'}
            </button>
          </form>

          {/* Exam Template Information */}
          <div style={{ 
            marginTop: '30px', 
            padding: '15px', 
            background: '#f8f9fa', 
            border: '1px solid #e9ecef', 
            borderRadius: '8px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#1e90ff' }}>ℹ️ Exam Template Information</h4>
            <ul style={{ margin: '0', padding: '0 0 0 20px', fontSize: '14px' }}>
              <li><strong>PIONEER_WT</strong> - Weekly Test template</li>
              <li><strong>PIONEER_UT</strong> - Unit Test template</li>
              <li><strong>MONTHLY_TEST</strong> - Monthly assessment</li>
              <li><strong>QUARTERLY_EXAM</strong> - Quarterly examination</li>
              <li><strong>HALF_YEARLY</strong> - Half-yearly examination</li>
              <li><strong>ANNUAL_EXAM</strong> - Annual/final examination</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}