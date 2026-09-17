import React, { useState } from "react";
import * as XLSX from "xlsx";

const QUESTION_TAG_FIELDS = [
  { key: "chapter", label: "Chapter", aliases: ["Chapter"] },
  { key: "topic", label: "Topic", aliases: ["Topic"] },
  { key: "subtopic", label: "Subtopic", aliases: ["Subtopic", "Sub Topic"] },
  {
    key: "bloomsSkill",
    label: "Blooms Skill",
    aliases: ["Blooms Skill", "Bloom's Skill", "Bloom Skill"],
  },
  {
    key: "difficultyLevel",
    label: "Difficulty Level",
    aliases: ["Difficulty Level", "Difficulty"],
  },
];

export default function OfflineOMRTagConverter() {
  const [files, setFiles] = useState({
    omrFile: null,
    tagFile: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleFileChange = (key, event) => {
    setFiles((prev) => ({ ...prev, [key]: event.target.files[0] || null }));
    setError("");
    setSuccess("");
  };

  const processAndDownload = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!files.omrFile) {
        throw new Error("Please upload the OMR file.");
      }
      if (!files.tagFile) {
        throw new Error("Please upload the Question Tags / Exam Analysis file.");
      }

      const [omrWorkbook, tagsByQuestion] = await Promise.all([
        readWorkbook(files.omrFile),
        readQuestionTags(files.tagFile),
      ]);
      const firstSheetName = omrWorkbook.SheetNames[0];
      const firstSheetRows = sheetToRows(omrWorkbook.Sheets[firstSheetName]);
      const convertedRows = addTagsToOmrRows(firstSheetRows, tagsByQuestion);

      omrWorkbook.Sheets[firstSheetName] = XLSX.utils.aoa_to_sheet(convertedRows);

      const excelBuffer = XLSX.write(omrWorkbook, {
        bookType: "xlsx",
        type: "array",
      });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "OMR_Upload_Format_With_Tags.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess("OMR file with question tags downloaded successfully.");
    } catch (err) {
      setError(err.message || "An error occurred during processing.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ margin: "0 0 16px 0", fontSize: 20 }}>
        OMR Format with Bloom's Taxonomy
      </h2>
      <p style={{ marginBottom: 20, color: "#555", lineHeight: 1.5 }}>
        Upload an existing OMR file and its Question Tags / Exam Analysis file
        to add question metadata columns.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 20,
          marginBottom: 20,
        }}
      >
        <FileInput
          label="OMR File (Required) - CSV/Excel"
          onChange={(event) => handleFileChange("omrFile", event)}
        />
        <FileInput
          label="Question Tags / Exam Analysis (Required) - CSV/Excel"
          onChange={(event) => handleFileChange("tagFile", event)}
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
          {loading ? "Processing..." : "Generate Tagged OMR File"}
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

function addTagsToOmrRows(rows, tagsByQuestion) {
  if (rows.length < 2) {
    throw new Error("OMR file is empty or missing headers.");
  }

  const headerRowIndex = findOmrHeaderRowIndex(rows);
  if (headerRowIndex === -1) {
    throw new Error(
      'OMR file must contain question columns like "Q 1 Options", "Q 1 Key", and "Q 1 Marks".',
    );
  }

  const headers = rows[headerRowIndex].map((header) => cleanText(header));
  const questions = findOmrQuestionNumbers(headers);
  if (questions.length === 0) {
    throw new Error("No question columns were found in the OMR file.");
  }

  const missingTagQuestion = questions.find(
    (questionNumber) => !tagsByQuestion.has(questionNumber),
  );
  if (missingTagQuestion) {
    throw new Error(`Question tag data missing for Q${missingTagQuestion}.`);
  }

  const existingTagColumnIndexes = new Set();
  const existingTagColumnByQuestion = new Map();
  questions.forEach((questionNumber) => {
    const indexesByField = new Map();
    QUESTION_TAG_FIELDS.forEach((field) => {
      const index = findHeaderIndex(headers, `Q ${questionNumber} ${field.label}`);
      if (index !== -1) {
        indexesByField.set(field.key, index);
        existingTagColumnIndexes.add(index);
      }
    });
    existingTagColumnByQuestion.set(questionNumber, indexesByField);
  });

  const newRows = rows.map(() => []);
  headers.forEach((header, columnIndex) => {
    if (existingTagColumnIndexes.has(columnIndex)) return;

    copyColumn(rows, newRows, columnIndex);

    const marksQuestionNumber = getMarksQuestionNumber(header);
    if (!marksQuestionNumber) return;

    QUESTION_TAG_FIELDS.forEach((field) => {
      const existingIndex =
        existingTagColumnByQuestion.get(marksQuestionNumber)?.get(field.key) ??
        -1;

      if (existingIndex !== -1) {
        copyColumn(rows, newRows, existingIndex);
      } else {
        appendBlankColumn(rows, newRows);
      }

      const targetColumnIndex = newRows[headerRowIndex].length - 1;
      fillTagColumn(
        newRows,
        headerRowIndex,
        targetColumnIndex,
        `Q ${marksQuestionNumber} ${field.label}`,
        tagsByQuestion.get(marksQuestionNumber)?.[field.key] || "",
      );
    });
  });

  if (headerRowIndex > 0 && isColumnIndexRow(rows[headerRowIndex - 1])) {
    newRows[headerRowIndex - 1] = Array.from(
      { length: newRows[headerRowIndex].length },
      (_, index) => index,
    );
  }

  return newRows;
}

function copyColumn(sourceRows, targetRows, columnIndex) {
  sourceRows.forEach((row, rowIndex) => {
    targetRows[rowIndex].push(row[columnIndex] ?? "");
  });
}

function appendBlankColumn(sourceRows, targetRows) {
  sourceRows.forEach((_, rowIndex) => {
    targetRows[rowIndex].push("");
  });
}

function fillTagColumn(rows, headerRowIndex, columnIndex, header, value) {
  rows[headerRowIndex][columnIndex] = header;
  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    rows[rowIndex][columnIndex] = value;
  }
}

function findOmrHeaderRowIndex(rows) {
  return rows.findIndex((row) => {
    const normalizedHeaders = row.map(normalizeHeader);
    return (
      normalizedHeaders.includes("Q 1 OPTIONS") &&
      normalizedHeaders.includes("Q 1 KEY") &&
      normalizedHeaders.includes("Q 1 MARKS")
    );
  });
}

function findOmrQuestionNumbers(headers) {
  const questions = headers
    .map(getMarksQuestionNumber)
    .filter(Boolean)
    .sort((left, right) => left - right);
  return [...new Set(questions)];
}

function getMarksQuestionNumber(header) {
  const match = normalizeHeader(header).match(/^Q\s+(\d+)\s+MARKS$/);
  return match ? Number(match[1]) : null;
}

function findHeaderIndex(headers, targetHeader) {
  const normalizedTarget = normalizeHeader(targetHeader);
  return headers.findIndex((header) => normalizeHeader(header) === normalizedTarget);
}

function isColumnIndexRow(row) {
  return row.every((cell, index) => cleanText(cell) === String(index));
}

function readQuestionTags(file) {
  return readWorkbook(file).then((workbook) => {
    const questionAnalysisSheetName = workbook.SheetNames.find((sheetName) =>
      normalizeHeader(sheetName).includes("QUESTION ANALYSIS"),
    );

    if (!questionAnalysisSheetName) {
      throw new Error(
        'Question Tags / Exam Analysis file must contain a "Question Analysis" sheet.',
      );
    }

    const rows = sheetToRows(workbook.Sheets[questionAnalysisSheetName]);
    const { headers, dataRows } = findQuestionTagRows(rows);
    validateQuestionTagHeaders(headers);

    const tagsByQuestion = new Map();
    dataRows.forEach((row) => {
      const object = rowToObject(headers, row);
      const questionNumber = toNumber(
        getByHeaderAliases(object, ["Q.No.", "Q.No", "Q No", "Question No"]),
      );

      if (!questionNumber) return;

      tagsByQuestion.set(questionNumber, {
        chapter: cleanText(getByHeaderAliases(object, ["Chapter"])),
        topic: cleanText(getByHeaderAliases(object, ["Topic"])),
        subtopic: cleanText(getByHeaderAliases(object, ["Subtopic", "Sub Topic"])),
        bloomsSkill: cleanText(
          getByHeaderAliases(object, [
            "Blooms Skill",
            "Bloom's Skill",
            "Bloom Skill",
          ]),
        ),
        difficultyLevel: cleanText(
          getByHeaderAliases(object, ["Difficulty Level", "Difficulty"]),
        ),
      });
    });

    if (tagsByQuestion.size === 0) {
      throw new Error("Question Tags / Exam Analysis file has no question tag rows.");
    }

    return tagsByQuestion;
  });
}

function findQuestionTagRows(rows) {
  const headerIndex = rows.findIndex((row) => {
    const normalizedHeaders = row.map(normalizeHeader);
    return (
      normalizedHeaders.includes("Q NO") &&
      normalizedHeaders.includes("CHAPTER") &&
      normalizedHeaders.includes("TOPIC")
    );
  });

  if (headerIndex === -1) {
    return { headers: [], dataRows: [] };
  }

  return {
    headers: rows[headerIndex].map((header) => cleanText(header)),
    dataRows: rows.slice(headerIndex + 1).filter(rowHasData),
  };
}

function validateQuestionTagHeaders(headers) {
  const requiredGroups = [
    ["Q.No.", "Q.No", "Q No", "Question No"],
    ["Chapter"],
    ["Topic"],
    ["Subtopic", "Sub Topic"],
    ["Blooms Skill", "Bloom's Skill", "Bloom Skill"],
    ["Difficulty Level", "Difficulty"],
  ];
  const missingColumns = requiredGroups
    .filter((aliases) => !hasHeaderAlias(headers, aliases))
    .map((aliases) => aliases[0]);

  if (missingColumns.length > 0) {
    throw new Error(
      `Question Tags / Exam Analysis file is missing column(s): ${missingColumns.join(
        ", ",
      )}.`,
    );
  }
}

function readWorkbook(file) {
  return readFileAsArrayBuffer(file).then((arrayBuffer) =>
    XLSX.read(arrayBuffer, { type: "array" }),
  );
}

function sheetToRows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
}

function rowToObject(headers, row) {
  return headers.reduce((object, header, index) => {
    object[header] = row[index] !== undefined ? row[index] : "";
    return object;
  }, {});
}

function hasHeaderAlias(headers, aliases) {
  const normalizedHeaders = headers.map(normalizeHeader);
  return aliases.some((alias) => normalizedHeaders.includes(normalizeHeader(alias)));
}

function getByHeaderAliases(row, aliases) {
  const normalizedAliases = aliases.map(normalizeHeader);
  const key = Object.keys(row).find((header) =>
    normalizedAliases.includes(normalizeHeader(header)),
  );
  return key ? row[key] : "";
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanText(value) {
  return (value ?? "").toString().trim();
}

function normalizeHeader(value) {
  return cleanText(value)
    .replace(/[._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function rowHasData(row) {
  return row.some((cell) => cleanText(cell) !== "");
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
