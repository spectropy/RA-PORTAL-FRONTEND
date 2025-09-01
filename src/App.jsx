import React, { useEffect, useState } from 'react'
import { getSchools, createSchool, uploadExcel } from './api.js'
import SchoolForm from './components/SchoolForm.jsx'
import UploadExcel from './components/UploadExcel.jsx'
import SchoolTable from './components/SchoolTable.jsx'
import ReportButtons from './components/ReportButtons.jsx'

const box = {
  maxWidth: 1100, margin: '24px auto', padding: 16,
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial'
}

const h1 = { margin: '0 0 12px', fontSize: 24 }
const card = { border: '1px solid #d3d8e6', borderRadius: 12, padding: 16, marginBottom: 16, background:'#fff' }

export default function App() {
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const rows = await getSchools()
      setSchools(rows)
    } catch (e) {
      setError(e.message || 'Failed to load schools')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  async function onAddSchool(payload) {
    setError('')
    try {
      await createSchool(payload)
      await refresh()
    } catch (e) {
      setError(e.message || 'Failed to create school')
    }
  }

  async function onUpload(file) {
    setError('')
    try {
      const res = await uploadExcel(file)
      await refresh()
      return res
    } catch (e) {
      setError(e.message || 'Upload failed')
      throw e
    }
  }

  return (
    <div style={box}>
      <h1 style={h1}>🎓 SPECTROPY — School Registration & Report</h1>

      <div style={card}>
        <SchoolForm onSubmit={onAddSchool} />
      </div>

      <div style={card}>
        <UploadExcel onUpload={onUpload} />
      </div>

      <div style={card}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8}}>
          <h2 style={{margin:0, fontSize:18}}>School List</h2>
          <ReportButtons rows={schools} />
        </div>
        {loading ? <p>Loading...</p> : <SchoolTable rows={schools} />}
        {error ? <p style={{color:'crimson'}}>{error}</p> : null}
      </div>
    </div>
  )
}
