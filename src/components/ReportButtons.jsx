import React from 'react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function ReportButtons({ rows }) {
  function downloadCSV() {
    if (!rows?.length) return alert('No data')
    const headers = ["SCHOOL_ID","SCHOOL_CODE","SCHOOL_NAME","AREA","DIST","STATE","ACADEMIC_YEAR","EXCEL_R","PDF_R"]
    const csv = [headers.join(',')].concat(
      rows.map(r => headers.map(h => {
        const val = r[toKey(h)] ?? ''
        const v = (''+val).replace(/"/g,'""')
        return /[",\n]/.test(v) ? `"${v}"` : v
      }).join(','))
    ).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'SCHOOL_LIST_REPORT.csv'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  function toKey(h) {
    const map = {
      'SCHOOL_ID': 'school_id', 'SCHOOL_CODE': 'school_code', 'SCHOOL_NAME':'school_name',
      'AREA':'area', 'DIST':'district', 'STATE':'state', 'ACADEMIC_YEAR':'academic_year',
      'EXCEL_R':'excel_r', 'PDF_R':'pdf_r'
    }
    return map[h]
  }

  function downloadPDF() {
    if (!rows?.length) return alert('No data')
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    doc.setFont('helvetica','bold'); doc.setFontSize(16)
    doc.text('SCHOOL LIST REPORT', 40, 40)
    doc.setFont('helvetica','normal'); doc.setFontSize(11)
    doc.text('As of now the following schools are enrolled with SPECTROPY', 40, 62)

    const headers = ["SCHOOL_ID","SCHOOL_CODE","SCHOOL_NAME","AREA","DIST","STATE","ACADEMIC_YEAR","EXCEL_R","PDF_R"]
    const body = rows.map(r => headers.map(h => (r[toKey(h)] ?? '')))

    doc.autoTable({
      startY: 80,
      head: [headers],
      body,
      styles: { fontSize: 9, cellPadding: 6, lineWidth: 0.2 },
      headStyles: { fillColor: [30, 50, 120], textColor: 255 },
      alternateRowStyles: { fillColor: [240, 244, 255] },
      margin: { left: 40, right: 40 }
    })
    doc.save('SCHOOL_LIST_REPORT.pdf')
  }

  return (
    <div style={{display:'flex', gap:8}}>
      <button onClick={downloadPDF}>⬇️ PDF</button>
      <button onClick={downloadCSV}>⬇️ CSV</button>
    </div>
  )
}
