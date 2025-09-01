import React from 'react'

export default function SchoolTable({ rows }) {
  if (!rows?.length) return <p>No schools yet.</p>
  return (
    <div style={{overflow:'auto', border: '1px solid #e2e8f0', borderRadius: 12}}>
      <table style={{width:'100%', borderCollapse:'collapse'}}>
        <thead>
          <tr style={{background:'#f7fafc'}}>
            <th style={th}>SCHOOL_ID</th>
            <th style={th}>SCHOOL_CODE</th>
            <th style={th}>SCHOOL_NAME</th>
            <th style={th}>AREA</th>
            <th style={th}>DIST</th>
            <th style={th}>STATE</th>
            <th style={th}>ACADEMIC_YEAR</th>
            <th style={th}>EXCEL_R</th>
            <th style={th}>PDF_R</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.school_id}>
              <td style={td}>{r.school_id}</td>
              <td style={td}>{r.school_code}</td>
              <td style={td}>{r.school_name}</td>
              <td style={td}>{r.area || ''}</td>
              <td style={td}>{r.district || ''}</td>
              <td style={td}>{r.state}</td>
              <td style={td}>{r.academic_year}</td>
              <td style={td}>{r.excel_r || ''}</td>
              <td style={td}>{r.pdf_r || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const th = { padding: '10px 12px', textAlign:'left', borderBottom:'1px solid #e2e8f0', fontSize:13 }
const td = { padding: '8px 12px', borderBottom:'1px solid #edf2f7', fontSize:14 }
