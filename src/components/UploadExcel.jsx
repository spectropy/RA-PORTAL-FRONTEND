import React, { useState } from 'react'

export default function UploadExcel({ onUpload }) {
  const [file, setFile] = useState(null)
  const [msg, setMsg] = useState('')

  async function handleUpload() {
    if (!file) return alert('Choose an Excel file (.xlsx, .xls)')
    setMsg('Uploading...')
    try {
      const res = await onUpload(file)
      setMsg(`Uploaded. Inserted: ${res.inserted}, Skipped: ${res.skipped}`)
    } catch (e) {
      setMsg(`Failed: ${e.message}`)
    }
  }

  return (
    <div>
      <h3 style={{margin:'0 0 8px'}}>Bulk Upload from Excel</h3>
      <input type='file' accept='.xlsx,.xls' onChange={e=>setFile(e.target.files?.[0] || null)} />
      <button style={{marginLeft:8}} onClick={handleUpload}>Upload</button>
      {msg ? <p style={{marginTop:8}}>{msg}</p> : null}
      <p style={{fontSize:12, color:'#555', marginTop:8}}>
        Expected headers (case-insensitive): <code>School Name</code>, <code>State</code>, <code>Academic Year</code>, optional: <code>Area</code>, <code>District</code>, <code>School Code</code>.
      </p>
    </div>
  )
}
