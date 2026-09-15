// src/components/LMSExamRegistration.jsx
import React, { useState } from "react";
import * as XLSX from "xlsx";
 
const SUBJECT_DEFAULTS = {
  PHYSICS: { questionCount: 15, correctMark: 4, wrongMark: -1 },
  CHEMISTRY: { questionCount: 15, correctMark: 4, wrongMark: -1 },
  MATHS: { questionCount: 15, correctMark: 4, wrongMark: -1 },
  BIOLOGY: { questionCount: 15, correctMark: 4, wrongMark: -1 },
};
 
const GROUP_SUBJECTS = {
  PCMB: ["PHYSICS", "CHEMISTRY", "MATHS", "BIOLOGY"],
  PCM: ["PHYSICS", "CHEMISTRY", "MATHS"],
  PCB: ["PHYSICS", "CHEMISTRY", "BIOLOGY"],
};
 
const createSubjectsForGroup = (group) =>
  GROUP_SUBJECTS[group].map((subject, index) => ({
    section: `S${index + 1}`,
    subject,
    ...SUBJECT_DEFAULTS[subject],
  }));
 
const DEFAULT_SUBJECTS = createSubjectsForGroup("PCMB");
 
const normalizeAnswer = (value) => (value || "").toString().trim().toUpperCase();
const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
 
export default function LMSExamRegistration() {
  const [files, setFiles] = useState({
    scoresReport: null,
    absentStudents: null,
  });
  const [subjectGroup, setSubjectGroup] = useState("PCMB");
  const [subjects, setSubjects] = useState(DEFAULT_SUBJECTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
 
  const handleFileChange = (key, e) => {
    const file = e.target.files[0] || null;
    setFiles((prev) => ({ ...prev, [key]: file }));
    setError("");
    setSuccess("");
  };
 
  const handleSubjectChange = (index, field, value) => {
    setSubjects((prev) =>
      prev.map((subject, subjectIndex) =>
        subjectIndex === index ? { ...subject, [field]: value } : subject,
      ),
    );
  };
 
  const handleGroupChange = (event) => {
    const nextGroup = event.target.value;
    setSubjectGroup(nextGroup);
    setSubjects(createSubjectsForGroup(nextGroup));
    setError("");
    setSuccess("");
  };
 
  const processAndDownload = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
 
    try {
      if (!files.scoresReport) {
        throw new Error("Please upload the Attempts Report file.");
      }
 
      const subjectConfig = subjects.map((subject) => ({
        section: subject.section,
        subject: subject.subject.trim().toUpperCase(),
        questionCount: toNumber(subject.questionCount),
        correctMark: toNumber(subject.correctMark),
        wrongMark: toNumber(subject.wrongMark),
      }));
 
      if (subjectConfig.some((subject) => !subject.subject)) {
        throw new Error("Please enter all subject names.");
      }
 
      if (subjectConfig.some((subject) => subject.questionCount <= 0)) {
        throw new Error("Question count must be greater than 0 for every subject.");
      }
 
      const attemptsSheetRows = await readFirstSheet(files.scoresReport);
      if (attemptsSheetRows.length < 2) {
        throw new Error("Attempts Report is empty or missing data.");
      }
 
      const headers = attemptsSheetRows[0].map((header) =>
        (header || "").toString().trim(),
      );
      const dataRows = attemptsSheetRows.slice(1);
      const objects = dataRows.map((row) => rowToObject(headers, row));
      const answerKeyRow = objects.find(
        (row) => normalizeAnswer(row.Username) === "CORRECT ANSWERS",
      );
 
      if (!answerKeyRow) {
        throw new Error(
          'Answer key row not found. The Attempts Report must contain a row with Username as "Correct Answers".',
        );
      }
 
      const questionPlan = buildQuestionPlan(subjectConfig);
      const missingColumns = questionPlan
        .map((question) => question.inputColumn)
        .filter((column) => !headers.includes(column));
 
      if (missingColumns.length > 0) {
        throw new Error(
          `Attempts Report is missing question columns: ${missingColumns
            .slice(0, 8)
            .join(", ")}${missingColumns.length > 8 ? "..." : ""}`,
        );
      }
 
      const attemptedRows = objects
        .filter((row) => normalizeAnswer(row.Username) !== "CORRECT ANSWERS")
        .map((row) => buildAttemptedStudent(row, answerKeyRow, questionPlan))
        .filter(Boolean);
 
      const attemptedRollNumbers = new Set(
        attemptedRows.map((row) => row.rollNo.toString().trim()),
      );
 
      let absentRows = [];
      if (files.absentStudents) {
        const absentSheetRows = await readFirstSheet(files.absentStudents);
        if (absentSheetRows.length >= 2) {
          const absentHeaders = absentSheetRows[0].map((header) =>
            (header || "").toString().trim(),
          );
          absentRows = absentSheetRows
            .slice(1)
            .map((row) => rowToObject(absentHeaders, row))
            .map((row) => buildAbsentStudent(row, answerKeyRow, questionPlan))
            .filter(
              (row) =>
                row && !attemptedRollNumbers.has(row.rollNo.toString().trim()),
            );
        }
      }
 
      const fullHeaders = buildOutputHeaders(subjectConfig, questionPlan.length);
      const outputRows = [...attemptedRows, ...absentRows].map((student) =>
        buildOutputRow(student, subjectConfig, questionPlan),
      );
 
      const columnIndices = Array.from(
        { length: fullHeaders.length },
        (_, index) => index,
      );
      const ws = XLSX.utils.aoa_to_sheet([
        columnIndices,
        fullHeaders,
        ...outputRows,
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "OMR Upload");
 
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "OMR_Upload_Format.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
 
      setSuccess("OMR-compatible Excel file downloaded successfully.");
    } catch (err) {
      setError(err.message || "An error occurred during processing.");
    } finally {
      setLoading(false);
    }
  };
 
  return (
    <div style={{ padding: 16, fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ margin: "0 0 16px 0", fontSize: 20 }}>
        LMS Exam Converter to OMR Format
      </h2>
      <p style={{ marginBottom: 20, color: "#555", lineHeight: 1.5 }}>
        Select the subject group, configure the subjects, and then upload the
        Attempts Report. The absent list is optional.
      </p>
 
      <div style={{ marginBottom: 20 }}>
        <label
          htmlFor="subject-group"
          style={{
            fontWeight: "bold",
            display: "block",
            marginBottom: 8,
          }}
        >
          Subject Group (Required)
        </label>
        <select
          id="subject-group"
          value={subjectGroup}
          onChange={handleGroupChange}
          style={{ ...inputStyle, maxWidth: 320 }}
        >
          <option value="PCMB">PCMB - Physics, Chemistry, Maths, Biology</option>
          <option value="PCM">PCM - Physics, Chemistry, Maths</option>
          <option value="PCB">PCB - Physics, Chemistry, Biology</option>
        </select>
      </div>
 
      <div
        style={{
          border: "1px solid #d7dce5",
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
          background: "#fff",
        }}
      >
        <h3 style={{ margin: "0 0 14px 0", fontSize: 16 }}>
          Subject and Marks Configuration ({subjectGroup})
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "80px minmax(160px, 1fr) 130px 120px 120px",
            gap: 12,
            alignItems: "center",
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          <span>Section</span>
          <span>Subject</span>
          <span>Questions</span>
          <span>Correct Mark</span>
          <span>Wrong Mark</span>
        </div>
        {subjects.map((subject, index) => (
          <div
            key={subject.section}
            style={{
              display: "grid",
              gridTemplateColumns:
                "80px minmax(160px, 1fr) 130px 120px 120px",
              gap: 12,
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <strong>{subject.section}</strong>
            <input
              value={subject.subject}
              onChange={(e) =>
                handleSubjectChange(index, "subject", e.target.value)
              }
              style={inputStyle}
            />
            <input
              type="number"
              min="1"
              value={subject.questionCount}
              onChange={(e) =>
                handleSubjectChange(index, "questionCount", e.target.value)
              }
              style={inputStyle}
            />
            <input
              type="number"
              value={subject.correctMark}
              onChange={(e) =>
                handleSubjectChange(index, "correctMark", e.target.value)
              }
              style={inputStyle}
            />
            <input
              type="number"
              value={subject.wrongMark}
              onChange={(e) =>
                handleSubjectChange(index, "wrongMark", e.target.value)
              }
              style={inputStyle}
            />
          </div>
        ))}
      </div>
 
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 20,
          marginBottom: 20,
        }}
      >
        <FileInput
          label="Attempts Report with Answers (Required) - CSV/Excel"
          onChange={(e) => handleFileChange("scoresReport", e)}
        />
        <FileInput
          label="Absent / Not Attempted Student List (Optional) - CSV/Excel"
          onChange={(e) => handleFileChange("absentStudents", e)}
        />
      </div>
 
      <div style={{ marginTop: 20, textAlign: "center" }}>
        <button
          onClick={processAndDownload}
          disabled={loading}
          style={{
            padding: "10px 20px",
            backgroundColor: loading ? "#9aa4b2" : "#1e90ff",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 16,
            fontWeight: "bold",
          }}
        >
          {loading ? "Processing..." : "Generate OMR Excel File"}
        </button>
      </div>
 
      {error && <p style={{ color: "crimson", marginTop: 16 }}>{error}</p>}
      {success && <p style={{ color: "green", marginTop: 16 }}>{success}</p>}
    </div>
  );
}
 
function FileInput({ label, onChange }) {
  return (
    <div>
      <label
        style={{
          fontWeight: "bold",
          display: "block",
          marginBottom: 8,
        }}
      >
        {label}
      </label>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={onChange}
        style={{
          padding: 8,
          border: "1px solid #ccc",
          borderRadius: 4,
          width: "100%",
        }}
      />
    </div>
  );
}
 
function buildQuestionPlan(subjectConfig) {
  let outputQuestionNumber = 1;
  return subjectConfig.flatMap((subject) =>
    Array.from({ length: subject.questionCount }, (_, index) => ({
      section: subject.section,
      subject: subject.subject,
      subjectQuestionNumber: index + 1,
      outputQuestionNumber: outputQuestionNumber++,
      inputColumn: `${subject.section}Q${index + 1}`,
      correctMark: subject.correctMark,
      wrongMark: subject.wrongMark,
    })),
  );
}
 
function buildAttemptedStudent(row, answerKeyRow, questionPlan) {
  const rollNo = (row.Username || "").toString().trim();
  if (!rollNo) return null;
 
  const name =
    (row.Name || "").toString().trim() ||
    `${row["First Name"] || ""} ${row["Last Name"] || ""}`.trim() ||
    "Unknown";
 
  const subjectStats = {};
  const questionResults = questionPlan.map((question) => {
    const response = normalizeAnswer(row[question.inputColumn]);
    const key = normalizeAnswer(answerKeyRow[question.inputColumn]);
    let status = "notAttempted";
    let marks = 0;
 
    if (response) {
      if (response === key) {
        status = "correct";
        marks = question.correctMark;
      } else {
        status = "incorrect";
        marks = question.wrongMark;
      }
    }
 
    if (!subjectStats[question.subject]) {
      subjectStats[question.subject] = {
        marks: 0,
        correct: 0,
        incorrect: 0,
        notAttempted: 0,
      };
    }
 
    subjectStats[question.subject].marks += marks;
    subjectStats[question.subject][status] += 1;
 
    return {
      options: response,
      key,
      marks,
      status,
    };
  });
 
  return {
    rollNo,
    name,
    subjectStats,
    questionResults,
  };
}
 
function buildAbsentStudent(row, answerKeyRow, questionPlan) {
  const rollNo = (row.Username || row["Roll No"] || "").toString().trim();
  if (!rollNo) return null;
 
  const name =
    (row["Full Name"] || row.Name || "").toString().trim() || "Unknown";
 
  const subjectStats = {};
  questionPlan.forEach((question) => {
    if (!subjectStats[question.subject]) {
      subjectStats[question.subject] = {
        marks: 0,
        correct: 0,
        incorrect: 0,
        notAttempted: 0,
      };
    }
  });
 
  return {
    rollNo,
    name,
    subjectStats,
    questionResults: questionPlan.map((question) => ({
      options: "",
      key: normalizeAnswer(answerKeyRow[question.inputColumn]),
      marks: 0,
      status: "absent",
    })),
  };
}
 
function buildOutputHeaders(subjectConfig, totalQuestions) {
  return [
    "Roll No",
    "Name",
    "Total Marks",
    "Grade",
    "Rank",
    "Correct Answers",
    "Incorrect Answers",
    "Not attempted",
    ...subjectConfig.flatMap((subject) => [
      subject.subject,
      `${subject.subject} _Correct Answers`,
      `${subject.subject} _Incorrect Answers`,
      `${subject.subject} _Not attempted`,
    ]),
    ...Array.from({ length: totalQuestions }, (_, index) => [
      `Q ${index + 1} Options`,
      `Q ${index + 1} Key`,
      `Q ${index + 1} Marks`,
    ]).flat(),
  ];
}
 
function buildOutputRow(student, subjectConfig, questionPlan) {
  const totals = calculateTotals(student.subjectStats);
 
  return [
    student.rollNo,
    student.name,
    totals.marks,
    "",
    "",
    totals.correct,
    totals.incorrect,
    totals.notAttempted,
    ...subjectConfig.flatMap((subject) => {
      const stats = student.subjectStats[subject.subject] || {
        marks: 0,
        correct: 0,
        incorrect: 0,
        notAttempted: 0,
      };
      return [stats.marks, stats.correct, stats.incorrect, stats.notAttempted];
    }),
    ...questionPlan.flatMap((_, index) => {
      const result = student.questionResults[index];
      return [result.options, result.key, result.marks];
    }),
  ];
}
 
function calculateTotals(subjectStats) {
  return Object.values(subjectStats).reduce(
    (total, stats) => ({
      marks: total.marks + stats.marks,
      correct: total.correct + stats.correct,
      incorrect: total.incorrect + stats.incorrect,
      notAttempted: total.notAttempted + stats.notAttempted,
    }),
    { marks: 0, correct: 0, incorrect: 0, notAttempted: 0 },
  );
}
 
function rowToObject(headers, row) {
  return headers.reduce((object, header, index) => {
    object[header] = row[index] !== undefined ? row[index] : "";
    return object;
  }, {});
}
 
function readFirstSheet(file) {
  return readFileAsArrayBuffer(file).then((arrayBuffer) => {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  });
}
 
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
 
const inputStyle = {
  padding: 8,
  border: "1px solid #c7ccd6",
  borderRadius: 4,
  width: "100%",
  boxSizing: "border-box",
};
 