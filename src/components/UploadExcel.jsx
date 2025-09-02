import React, { useState } from 'react';

export default function UploadExcel({ onUpload }) {
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0] || null;

    if (selectedFile) {
      const validTypes = [
        'application/vnd.ms-excel', // .xls
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      ];
      if (!validTypes.includes(selectedFile.type)) {
        setMsg('⚠️ Please upload a valid Excel file (.xls or .xlsx)');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setMsg(`Selected: ${selectedFile.name}`);
    } else {
      setFile(null);
      setMsg('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMsg('⚠️ Please select an Excel file.');
      return;
    }

    setIsUploading(true);
    setMsg('Uploading...');
    try {
      const result = await onUpload(file);
      setMsg(
        `✅ Success: Inserted ${result.inserted || 0}, Skipped ${result.skipped || 0}`
      );
    } catch (error) {
      console.error('Upload failed:', error);
      setMsg(`❌ Failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ marginTop: '16px' }}>
      <h3 style={{ margin: '0 0 8px' }}>Bulk Upload from Excel</h3>

      {/* File Input */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="file"
          id="excel-upload"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          disabled={isUploading}
          style={{ padding: '6px 0' }}
        />

        <button
          onClick={handleUpload}
          disabled={!file || isUploading}
          style={{
            padding: '6px 12px',
            backgroundColor: !file || isUploading ? '#ccc' : '#1a56db',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: !file || isUploading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
          }}
        >
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>

      {/* Status Message */}
      {msg ? (
        <p
          style={{
            marginTop: '8px',
            padding: '8px',
            borderRadius: '6px',
            backgroundColor: msg.startsWith('✅')
              ? '#d4edda'
              : msg.startsWith('❌') || msg.startsWith('⚠️')
              ? '#f8d7da'
              : '#e2e3e5',
            color: msg.startsWith('❌') || msg.startsWith('⚠️') ? '#721c24' : '#155724',
            fontSize: '14px',
            border: '1px solid #ddd',
            display: 'inline-block',
          }}
        >
          {msg}
        </p>
      ) : null}

      {/* Instructions */}
      <p style={{ fontSize: '12px', color: '#555', marginTop: '12px', lineHeight: 1.5 }}>
        <strong>Expected headers</strong> (case-insensitive):{' '}
        <code style={{ background: '#f0f0f0', padding: '2px 4px', borderRadius: 4 }}>
          School Name
        </code>
        ,{' '}
        <code style={{ background: '#f0f0f0', padding: '2px 4px', borderRadius: 4 }}>
          State
        </code>
        ,{' '}
        <code style={{ background: '#f0f0f0', padding: '2px 4px', borderRadius: 4 }}>
          Academic Year
        </code>
        . Optional: <code>Area</code>, <code>District</code>, <code>School Code</code>.
        <br />
        <em>Make sure SCHOOL_ID is auto-generated or provided correctly if required.</em>
      </p>
    </div>
  );
}