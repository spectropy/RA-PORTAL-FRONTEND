import React, { useState } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import spectropyLogo from "../assets/logo.png";

export default function ReportButtons({ rows }) {
  const [exporting, setExporting] = useState(null); // 'csv' or 'pdf'

  const hasData = rows?.length > 0;
  const now = new Date().toLocaleString("en-IN");

  // === CSV Export ===
  const downloadCSV = () => {
    if (!hasData) return alert("No data available to export.");
    setExporting("csv");

    setTimeout(() => {
      try {
        const headers = [
          "SCHOOL_ID",
          "SCHOOL_NAME",
          "AREA",
          "DISTRICT",
          "STATE",
          "ACADEMIC_YEAR",
          "CLASSES_COUNT",
          "TEACHERS_COUNT",
          "EXPORTED_AT",
        ];

        const keyMap = {
          SCHOOL_ID: "school_id",
          SCHOOL_NAME: "school_name",
          AREA: "area",
          DISTRICT: "district",
          STATE: "state",
          ACADEMIC_YEAR: "academic_year",
          CLASSES_COUNT: (r) => {
            if (Array.isArray(r.classes)) return r.classes.length;
            return r.classes_count || 0;
          },
          TEACHERS_COUNT: (r) => {
            if (Array.isArray(r.teachers)) return r.teachers.length;
            return r.teachers_count || 0;
          },
        };

        const csvRows = rows.map((r) =>
          headers
            .map((h) => {
              let val;
              if (h === "EXPORTED_AT") {
                val = now;
              } else {
                const key = keyMap[h];
                val = typeof key === "function" ? key(r) : (r[key] ?? "");
              }
              const str = String(val).replace(/"/g, '""');
              return /[",\n]/.test(str) ? `"${str}"` : str;
            })
            .join(","),
        );

        const csvContent = [headers.join(","), ...csvRows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `SCHOOL_REPORT_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        alert("Failed to generate CSV: " + err.message);
      } finally {
        setExporting(null);
      }
    }, 100); // Small delay to allow UI update
  };

  // === PDF Export ===
  const downloadPDF = () => {
    if (!hasData || !Array.isArray(rows) || rows.length === 0) {
      alert("No data available to export.");
      return;
    }

    setExporting("pdf");

    setTimeout(() => {
      try {
        const doc = new jsPDF({
          unit: "pt",
          format: "a4",
          orientation: "landscape",
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const marginX = 30;
        const contentWidth = pageWidth - marginX * 2;

        const COLORS = {
          navy: [23, 54, 93],
          blue: [30, 70, 140],
          lightBlue: [245, 248, 255],
          border: [210, 220, 232],
          text: [31, 41, 55],
          muted: [100, 116, 139],
          white: [255, 255, 255],
        };

        /* ------------------------------ Helpers ------------------------------ */

        const safeValue = (value, fallback = "") => {
          if (value === null || value === undefined || Number.isNaN(value)) {
            return fallback;
          }

          return String(value).trim();
        };

        const getCount = (row, arrayKey, countKey) => {
          if (Array.isArray(row?.[arrayKey])) {
            return row[arrayKey].length;
          }

          const count = Number(row?.[countKey]);
          return Number.isFinite(count) ? count : 0;
        };

        const totalTeachers = rows.reduce(
          (sum, row) => sum + getCount(row, "teachers", "teachers_count"),
          0,
        );

        const totalClasses = rows.reduce(
          (sum, row) => sum + getCount(row, "classes", "classes_count"),
          0,
        );

        const currentDate = new Date();

        const generatedOn =
          typeof now === "string" && now.trim()
            ? now.trim()
            : currentDate.toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

        const fileDate = [
          currentDate.getFullYear(),
          String(currentDate.getMonth() + 1).padStart(2, "0"),
          String(currentDate.getDate()).padStart(2, "0"),
        ].join("-");

        const generatedDate = currentDate.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });

        const drawSummaryCard = (x, y, width, label, value) => {
          doc.setFillColor(...COLORS.white);
          doc.setDrawColor(...COLORS.border);
          doc.setLineWidth(0.7);
          doc.roundedRect(x, y, width, 42, 5, 5, "FD");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(...COLORS.muted);
          doc.text(label, x + 11, y + 14);

          let valueText = safeValue(value, "0");
          let fontSize = label === "GENERATED ON" ? 10 : 15;

          doc.setFont("helvetica", "bold");
          doc.setTextColor(...COLORS.navy);
          doc.setFontSize(fontSize);

          while (fontSize > 7 && doc.getTextWidth(valueText) > width - 22) {
            fontSize -= 0.5;
            doc.setFontSize(fontSize);
          }

          doc.text(valueText, x + 11, y + 32);
        };

        const drawFirstPageHeader = () => {
          /* Main header */
          doc.setFillColor(...COLORS.navy);
          doc.rect(0, 0, pageWidth, 72, "F");

          /* Spectropy logo */
          doc.setFillColor(...COLORS.white);
          doc.roundedRect(marginX, 13, 46, 46, 6, 6, "F");
          try {
            doc.addImage(spectropyLogo, "PNG", marginX + 6, 19, 34, 34);
          } catch (e) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(15);
            doc.setTextColor(...COLORS.navy);
            doc.text("S", marginX + 23, 42, {
              align: "center",
            });
          }

          /* Title */
          doc.setFont("helvetica", "bold");
          doc.setFontSize(20);
          doc.setTextColor(...COLORS.white);
          doc.text("SCHOOL LIST REPORT", pageWidth / 2, 31, {
            align: "center",
          });

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(220, 230, 244);
          doc.text(
            "Enrolled Schools and Institutional Overview",
            pageWidth / 2,
            49,
            { align: "center" },
          );

          /* Summary cards */
          const cardGap = 10;
          const cardWidth = (contentWidth - cardGap * 3) / 4;
          const cardY = 84;

          drawSummaryCard(
            marginX,
            cardY,
            cardWidth,
            "TOTAL SCHOOLS",
            rows.length,
          );

          drawSummaryCard(
            marginX + cardWidth + cardGap,
            cardY,
            cardWidth,
            "TOTAL TEACHERS",
            totalTeachers,
          );

          drawSummaryCard(
            marginX + (cardWidth + cardGap) * 2,
            cardY,
            cardWidth,
            "TOTAL CLASSES",
            totalClasses,
          );

          drawSummaryCard(
            marginX + (cardWidth + cardGap) * 3,
            cardY,
            cardWidth,
            "GENERATED ON",
            generatedOn,
          );
        };

        const drawAdditionalPageHeader = () => {
          doc.setFillColor(...COLORS.navy);
          doc.rect(0, 0, pageWidth, 42, "F");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          doc.setTextColor(...COLORS.white);
          doc.text("SCHOOL LIST REPORT", marginX, 26);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text("SPECTROPY", pageWidth - marginX, 26, {
            align: "right",
          });
        };

        drawFirstPageHeader();

        /* ---------------------------- Table Data ---------------------------- */

        const headers = [
          "S.NO.",
          "SCHOOL ID",
          "SCHOOL NAME",
          "AREA",
          "DISTRICT",
          "STATE",
          "ACADEMIC YEAR",
          "CLASSES",
          "TEACHERS",
        ];

        const body = rows.map((row, index) => [
          index + 1,

          safeValue(row.school_id ?? row.schoolId ?? row.id),

          safeValue(
            row.school_name ?? row.schoolName ?? row.name,
          ).toUpperCase(),

          safeValue(row.area ?? row.locality ?? row.city),

          safeValue(row.district),

          safeValue(row.state),

          safeValue(row.academic_year ?? row.academicYear),

          getCount(row, "classes", "classes_count"),

          getCount(row, "teachers", "teachers_count"),
        ]);

        /* ---------------------------- Result Table -------------------------- */

        doc.autoTable({
          startY: 140,

          head: [headers],
          body,

          theme: "grid",
          tableWidth: contentWidth,

          margin: {
            top: 58,
            right: marginX,
            bottom: 38,
            left: marginX,
          },

          styles: {
            font: "helvetica",
            fontSize: 8.2,
            textColor: COLORS.text,
            cellPadding: {
              top: 5,
              right: 5,
              bottom: 5,
              left: 5,
            },
            lineColor: COLORS.border,
            lineWidth: 0.45,
            valign: "middle",
            overflow: "linebreak",
            minCellHeight: 23,
          },

          headStyles: {
            fillColor: COLORS.navy,
            textColor: COLORS.white,
            fontStyle: "bold",
            fontSize: 8,
            halign: "center",
            valign: "middle",
            minCellHeight: 28,
          },

          alternateRowStyles: {
            fillColor: COLORS.lightBlue,
          },

          columnStyles: {
            0: {
              cellWidth: 36,
              halign: "center",
            },
            1: {
              cellWidth: 70,
              halign: "center",
            },
            2: {
              cellWidth: 190,
              halign: "left",
            },
            3: {
              cellWidth: 100,
              halign: "left",
            },
            4: {
              cellWidth: 90,
              halign: "left",
            },
            5: {
              cellWidth: 85,
              halign: "left",
            },
            6: {
              cellWidth: 95,
              halign: "center",
            },
            7: {
              cellWidth: 55,
              halign: "center",
            },
            8: {
              cellWidth: 60,
              halign: "center",
            },
          },

          rowPageBreak: "avoid",
          showHead: "everyPage",

          didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 2) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.textColor = COLORS.navy;
            }
          },

          willDrawPage: (data) => {
            if (data.pageNumber > 1) {
              drawAdditionalPageHeader();
            }
          },
        });

        /* ------------------------------- Footer ----------------------------- */

        const totalPages = doc.getNumberOfPages();

        for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
          doc.setPage(pageNumber);

          const footerY = pageHeight - 21;

          doc.setDrawColor(...COLORS.border);
          doc.setLineWidth(0.6);
          doc.line(marginX, footerY - 10, pageWidth - marginX, footerY - 10);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(...COLORS.muted);

          doc.text("Confidential - For official use only", marginX, footerY);

          doc.text(`Generated: ${generatedDate}`, pageWidth / 2, footerY, {
            align: "center",
          });

          doc.text(
            `Page ${pageNumber} of ${totalPages}`,
            pageWidth - marginX,
            footerY,
            { align: "right" },
          );
        }

        doc.save(`SCHOOL_REPORT_${fileDate}.pdf`);
      } catch (err) {
        console.error("PDF generation error:", err);
        alert("Failed to generate PDF. Please try again.");
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
          className={`btn-report btn-report--pdf ${!hasData || exporting ? "disabled" : ""}`}
          onClick={downloadPDF}
          disabled={!hasData || exporting}
          aria-label={
            exporting === "pdf" ? "Generating PDF..." : "Download PDF report"
          }
          title="Download school list as PDF"
        >
          {exporting === "pdf" ? " Generating..." : " PDF Report"}
        </button>

        {/* CSV Button */}
        <button
          className={`btn-report btn-report--csv ${!hasData || exporting ? "disabled" : ""}`}
          onClick={downloadCSV}
          disabled={!hasData || exporting}
          aria-label={
            exporting === "csv" ? "Generating CSV..." : "Download CSV report"
          }
          title="Download school list as CSV"
        >
          {exporting === "csv" ? " Exporting..." : " CSV Export"}
        </button>
      </div>

      {/* Info Tooltip */}
      <div className="report-last-updated">
        {hasData ? `Last updated: ${now}` : "No data to export"}
      </div>
    </div>
  );
}
