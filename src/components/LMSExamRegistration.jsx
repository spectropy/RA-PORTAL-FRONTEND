// src/components/LMSExamRegistration.jsx
import React, { useState } from "react";
import * as XLSX from "xlsx";

export default function LMSExamRegistration() {
  const [files, setFiles] = useState({
    scoresReport: null, // REQUIRED
    notAttemptedStudents: null, // optional
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleFileChange = (key, e) => {
    const file = e.target.files[0];
    if (file) {
      setFiles((prev) => ({ ...prev, [key]: file }));
      setError("");
      setSuccess("");
    }
  };

  const processAndDownload = async () => {
  setLoading(true);
  setError("");
  setSuccess("");

  try {
    if (!files.scoresReport) {
      throw new Error("Please upload the Scores Report file.");
    }

    // === 1. Read Scores Report ===
    const scoresArrayBuffer = await readFileAsArrayBuffer(files.scoresReport);
    const scoresWB = XLSX.read(scoresArrayBuffer, { type: "array" });
    const scoresSheet = scoresWB.Sheets[scoresWB.SheetNames[0]];
    const scoresData = XLSX.utils.sheet_to_json(scoresSheet, { header: 1 });

    if (scoresData.length < 2) {
      throw new Error("Scores Report is empty or missing data.");
    }

    const headers = scoresData[0].map(h => (h || "").toString().trim());
    const rows = scoresData.slice(1);

    // Map attempted students
    const attemptedStudents = rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] !== undefined ? row[i] : "";
      });

      const studentId = (obj["Username"] || "").toString().trim();
      if (!studentId) return null; // Skip if no ID

      return {
        student_id: studentId,
        student_name: ((obj["First Name"] || "") + " " + (obj["Last Name"] || "")).trim() || obj["Name"] || "Unknown",
        physics: parseFloat(obj["PHYSICS Score"]) || 0,
        chemistry: parseFloat(obj["CHEMISTRY Score"]) || 0,
        maths: parseFloat(obj["MATHS Score"]) || 0,
        biology: parseFloat(obj["BIOLOGY Score"]) || 0, // Not in LMS? Set to 0
        correct: parseFloat(obj["No. Of Correct Answers"]) || 0, // LMS doesn't provide this → infer or leave 0
        wrong: parseFloat(obj["No. Of incorrect Answers"]) || 0,
        unattempted: parseFloat(obj["No. Of unanswered Questions"]) || 0,
      };
    }).filter(Boolean);

    // === 2. Read Not Attempted (if any) ===
    let notAttempted = [];
    if (files.notAttemptedStudents) {
      const notAttArrayBuffer = await readFileAsArrayBuffer(files.notAttemptedStudents);
      const notAttWB = XLSX.read(notAttArrayBuffer, { type: "array" });
      const notAttSheet = notAttWB.Sheets[notAttWB.SheetNames[0]];
      const notAttData = XLSX.utils.sheet_to_json(notAttSheet, { header: 1 });

      if (notAttData.length >= 2) {
        const notAttHeaders = notAttData[0].map(h => (h || "").toString().trim());
        const notAttRows = notAttData.slice(1);

        notAttempted = notAttRows.map(row => {
          const obj = {};
          notAttHeaders.forEach((h, i) => {
            obj[h] = row[i] !== undefined ? row[i] : "";
          });

          const studentId = (obj["Username"] || "").toString().trim();
          if (!studentId) return null;

          return {
            student_id: studentId,
            student_name: obj["Full Name"] || "Unknown",
            physics: 0,
            chemistry: 0,
            maths: 0,
            biology: 0,
            correct: 0,
            wrong: 0,
            unattempted: 0,
          };
        }).filter(Boolean);
      }
    }

    const allStudents = [...attemptedStudents, ...notAttempted];

    // === 3. Build Full Header (61+ columns as per your spec) ===
    const fullHeaders = [
      "Exam", "Exam Set", "Roll No", "Name", "Total Marks", "Grade", "Rank",
      "Correct Answers", "Incorrect Answers", "Not attempted",
      "PHYSICS -Single Correct", "PHYSICS -Single Correct _Correct Answers", "PHYSICS -Single Correct _Incorrect Answers", "PHYSICS -Single Correct _Not attempted", "PHYSICS", "PHYSICS _Correct Answers", "PHYSICS _Incorrect Answers", "PHYSICS _Not attempted",
      "CHEMISTRY -Single Correct", "CHEMISTRY -Single Correct_Correct Answers", "CHEMISTRY -Single Correct_Incorrect Answers", "CHEMISTRY -Single Correct_Not attempted", "CHEMISTRY", "CHEMISTRY _Correct Answers", "CHEMISTRY _Incorrect Answers", "CHEMISTRY _Not attempted",
      "MATHS-Single Correct", "MATHS-Single Correct_Correct Answers", "MATHS-Single Correct_Incorrect Answers", "MATHS-Single Correct_Not attempted", "MATHS", "MATHS_Correct Answers", "MATHS_Incorrect Answers", "MATHS_Not attempted",
      "BIOLOGY -Single Correct", "BIOLOGY -Single Correct_Correct Answers", "BIOLOGY -Single Correct_Incorrect Answers", "BIOLOGY -Single Correct_Not attempted", "BIOLOGY", "BIOLOGY _Correct Answers", "BIOLOGY _Incorrect Answers", "BIOLOGY _Not attempted",
      // Q1 to Q60: Options, Key, Marks (3 per question → 180 columns)
      ...Array.from({ length: 60 }, (_, i) => [
        `Q ${i + 1} Options`,
        `Q ${i + 1} Key`,
        `Q ${i + 1} Marks`
      ]).flat()
    ];

    // === 4. Build Rows with ONLY required columns filled ===
    const outputRows = allStudents.map(student => {
      const row = new Array(fullHeaders.length).fill(""); // Start with empty strings

      // Map only the 9 required fields to correct column indices (0-based)
      row[2] = student.student_id;              // Roll No
      row[3] = student.student_name;            // Name
      row[7] = student.correct;                 // Correct Answers
      row[8] = student.wrong;                   // Incorrect Answers
      row[9] = student.unattempted;             // Not attempted
      row[10] = student.physics;                // PHYSICS -Single Correct
      row[18] = student.chemistry;              // CHEMISTRY -Single Correct
      row[26] = student.maths;                  // MATHS-Single Correct
      row[34] = student.biology;                // BIOLOGY -Single Correct

      // Set numeric fields that should be 0 (not "")
      [4, 7, 8, 9, 10, 18, 26, 34].forEach(idx => {
        if (row[idx] === "") row[idx] = 0;
      });

      return row;
    });

    // === 5. Create worksheet with full header and data ===
    const columnIndices = Array.from({ length: fullHeaders.length }, (_, i) => i);
    const wsData = [
      columnIndices,     // ← First row: 0, 1, 2, 3, ... (makes backend happy)
      fullHeaders,       // ← Second row: "Exam", "Exam Set", "Roll No", ...
      ...outputRows      // ← Rest: student data
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OMR Upload");

    // === 6. Download ===
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "OMR_Upload_Format.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccess("✅ OMR-compatible Excel file downloaded successfully!");
  } catch (err) {
    setError(err.message || "An error occurred during processing.");
  } finally {
    setLoading(false);
  }
};

  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  return (
    <div style={{ padding: 16, fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ margin: "0 0 16px 0", fontSize: 20 }}>📚 LMS Exam Converter → OMR Format</h2>
      <p style={{ marginBottom: 20, color: "#555" }}>
        Upload the <strong>Scores Report</strong> (required) and optionally the <strong>Not Attempted Students</strong> list.
        This will generate an Excel file matching your OMR upload format.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px", marginBottom: "20px" }}>
        <div>
          <label style={{ fontWeight: "bold", display: "block", marginBottom: "8px" }}>
            📊 Scores Report (Required) – CSV/Excel
          </label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFileChange("scoresReport", e)}
            style={{
              padding: "8px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              width: "100%",
            }}
          />
        </div>
        <div>
          <label style={{ fontWeight: "bold", display: "block", marginBottom: "8px" }}>
            🚫 Not Attempted Students (Optional) – CSV/Excel
          </label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFileChange("notAttemptedStudents", e)}
            style={{
              padding: "8px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              width: "100%",
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: "20px", textAlign: "center" }}>
        <button
          onClick={processAndDownload}
          disabled={loading}
          style={{
            padding: "10px 20px",
            backgroundColor: loading ? "#ccc" : "#1e90ff",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "16px",
            fontWeight: "bold",
          }}
        >
          {loading ? "Processing..." : "📥 Generate OMR Excel File"}
        </button>
      </div>

      {error && <p style={{ color: "crimson", marginTop: "16px" }}>{error}</p>}
      {success && <p style={{ color: "green", marginTop: "16px" }}>{success}</p>}
    </div>
  );
}