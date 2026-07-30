import React, { useState } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function ReportButtons({ rows }) {
  const [exporting, setExporting] = useState(null); // 'csv' or 'pdf'

  const hasData = rows?.length > 0;
  const now = new Date().toLocaleString('en-IN');

  // === CSV Export ===
  const downloadCSV = () => {
    if (!hasData) return alert('No data available to export.');
    setExporting('csv');

    setTimeout(() => {
      try {
        const headers = [
          'SCHOOL_ID',
          'SCHOOL_NAME',
          'AREA',
          'DISTRICT',
          'STATE',
          'ACADEMIC_YEAR',
          'CLASSES_COUNT',
          'TEACHERS_COUNT',
          'EXPORTED_AT',
        ];

        const keyMap = {
          'SCHOOL_ID': 'school_id',
          'SCHOOL_NAME': 'school_name',
          'AREA': 'area',
          'DISTRICT': 'district',
          'STATE': 'state',
          'ACADEMIC_YEAR': 'academic_year',
          'CLASSES_COUNT': (r) => {
            if (Array.isArray(r.classes)) return r.classes.length;
            return r.classes_count || 0;
          },
          'TEACHERS_COUNT': (r) => {
            if (Array.isArray(r.teachers)) return r.teachers.length;
            return r.teachers_count || 0;
          },
        };

        const csvRows = rows.map((r) =>
          headers
            .map((h) => {
              let val;
              if (h === 'EXPORTED_AT') {
                val = now;
              } else {
                const key = keyMap[h];
                val = typeof key === 'function' ? key(r) : r[key] ?? '';
              }
              const str = String(val).replace(/"/g, '""');
              return /[",\n]/.test(str) ? `"${str}"` : str;
            })
            .join(',')
        );

        const csvContent = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SCHOOL_REPORT_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        alert('Failed to generate CSV: ' + err.message);
      } finally {
        setExporting(null);
      }
    }, 100); // Small delay to allow UI update
  };

  // === PDF Export ===
  const downloadPDF = () => {
    if (!hasData) return alert('No data available to export.');
    setExporting('pdf');

    setTimeout(() => {
      try {
        const doc = new jsPDF({
          unit: 'pt',
          format: 'a4',
          orientation: 'landscape',
        });

        const pageWidth = doc.internal.pageSize.getWidth();

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        const title = 'SCHOOL LIST REPORT';
        const titleX = (pageWidth - doc.getTextWidth(title)) / 2;
        doc.text(title, titleX, 40);

        // Subtitle
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        const subtitle = 'Enrolled Schools - SPECTROPY';
        const subX = (pageWidth - doc.getTextWidth(subtitle)) / 2;
        doc.text(subtitle, subX, 60);

        // Metadata
        doc.setFontSize(10);
        doc.setTextColor(100);
        const totalTeachers = rows.reduce((sum, r) => {
          if (Array.isArray(r.teachers)) return sum + r.teachers.length;
          return sum + (r.teachers_count || 0);
        }, 0);

        const totalClasses = rows.reduce((sum, r) => {
          if (Array.isArray(r.classes)) return sum + r.classes.length;
          return sum + (r.classes_count || 0);
        }, 0);

        const metaText = [
          `Generated on: ${now}`,
          `Total Schools: ${rows.length}`,
          `Total Teachers: ${totalTeachers}`,
          `Total Classes: ${totalClasses}`,
        ];
        metaText.forEach((text, i) => {
          doc.text(text, 40, 80 + i * 15);
        });

        // Table Headers
        const headers = [
          'SCHOOL_ID',
          'SCHOOL_NAME',
          'AREA',
          'DISTRICT',
          'STATE',
          'ACADEMIC_YEAR',
          'CLASSES',
          'TEACHERS',
        ];

        // Key mapping with fallbacks
        const keyMap = {
          'SCHOOL_ID': 'school_id',
          'SCHOOL_NAME': 'school_name',
          'AREA': 'area',
          'DISTRICT': 'district',
          'STATE': 'state',
          'ACADEMIC_YEAR': 'academic_year',
          'CLASSES': (r) => {
            if (Array.isArray(r.classes)) return r.classes.length;
            return r.classes_count || 0;
          },
          'TEACHERS': (r) => {
            if (Array.isArray(r.teachers)) return r.teachers.length;
            return r.teachers_count || 0;
          },
        };

        const body = rows.map((r) =>
          headers.map((h) => {
            const key = keyMap[h];
            return typeof key === 'function' ? key(r) : r[key] ?? '';
          })
        );

        doc.autoTable({
          startY: 80 + metaText.length * 15 + 20,
          head: [headers],
          body,
          theme: 'striped',
          styles: {
            fontSize: 9,
            cellPadding: 6,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: [30, 70, 140],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [245, 248, 255],
          },
          margin: { left: 40, right: 40 },
        });

        doc.save(`SCHOOL_REPORT_${new Date().toISOString().split('T')[0]}.pdf`);
      } catch (err) {
        console.error('PDF generation error:', err);
        alert('Failed to generate PDF. Please try again.');
      } finally {
        setExporting(null);
      }
    }, 100);
  };

  return (
    <div className="report-buttons-wrap">
      <div className="report-buttons-row">
        {/* PDF Button */}
        <button
          className={`btn-report btn-report--pdf ${!hasData || exporting ? 'disabled' : ''}`}
          onClick={downloadPDF}
          disabled={!hasData || exporting}
          aria-label={exporting === 'pdf' ? 'Generating PDF...' : 'Download PDF report'}
          title="Download school list as PDF"
        >
          {exporting === 'pdf' ? '🔄 Generating...' : '📄 PDF Report'}
        </button>

        {/* CSV Button */}
        <button
          className={`btn-report btn-report--csv ${!hasData || exporting ? 'disabled' : ''}`}
          onClick={downloadCSV}
          disabled={!hasData || exporting}
          aria-label={exporting === 'csv' ? 'Generating CSV...' : 'Download CSV report'}
          title="Download school list as CSV"
        >
          {exporting === 'csv' ? '🔄 Exporting...' : '📊 CSV Export'}
        </button>
      </div>

      {/* Info Tooltip */}
      <div className="report-last-updated">
        {hasData ? `Last updated: ${now}` : 'No data to export'}
      </div>
    </div>
  );
}