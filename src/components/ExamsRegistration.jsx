// src/ExamRegistration.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  ArrowLeft,
  Atom,
  Beaker,
  BookOpen,
  Calculator,
  CalendarDays,
  CheckCircle2,
  CloudUpload,
  FileSpreadsheet,
  FolderOpen,
  Leaf,
  Lock,
  MapPin,
  Plus,
  Search,
  School,
  Trash2,
  UploadCloud,
  UsersRound,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

// Exam patterns by program
const getExamPatternsByProgram = (program) => {
  switch (program) {
    case "CAT":
    case "FF":
      return [
        { id: "PART_TEST_1", name: "Part Test 1", type: "PART_TEST" },
        { id: "PART_TEST_2", name: "Part Test 2", type: "PART_TEST" },
        { id: "PART_TEST_3", name: "Part Test 3", type: "PART_TEST" },
        { id: "PART_TEST_4", name: "Part Test 4", type: "PART_TEST" },
        { id: "PART_TEST_5", name: "Part Test 5", type: "PART_TEST" },
        { id: "PART_TEST_6", name: "Part Test 6", type: "PART_TEST" },
        { id: "PART_TEST_7", name: "Part Test 7", type: "PART_TEST" },
        { id: "PART_TEST_8", name: "Part Test 8", type: "PART_TEST" },
        { id: "PART_TEST_9", name: "Part Test 9", type: "PART_TEST" },
        { id: "UNIT_TEST_1", name: "Unit Test 1", type: "UNIT_TEST" },
        { id: "UNIT_TEST_2", name: "Unit Test 2", type: "UNIT_TEST" },
        { id: "UNIT_TEST_3", name: "Unit Test 3", type: "UNIT_TEST" },
        { id: "GRAND_TEST_1", name: "Grand Test 1", type: "GRAND_TEST" },
        { id: "GRAND_TEST_2", name: "Grand Test 2", type: "GRAND_TEST" },
      ];
    case "MAE":
    case "PIO":
      return [
        { id: "WEEK_TEST_1", name: "Week Test 1", type: "WEEK_TEST" },
        { id: "WEEK_TEST_2", name: "Week Test 2", type: "WEEK_TEST" },
        { id: "WEEK_TEST_3", name: "Week Test 3", type: "WEEK_TEST" },
        { id: "WEEK_TEST_4", name: "Week Test 4", type: "WEEK_TEST" },
        { id: "WEEK_TEST_5", name: "Week Test 5", type: "WEEK_TEST" },
        { id: "WEEK_TEST_6", name: "Week Test 6", type: "WEEK_TEST" },
        { id: "WEEK_TEST_7", name: "Week Test 7", type: "WEEK_TEST" },
        { id: "WEEK_TEST_8", name: "Week Test 8", type: "WEEK_TEST" },
        { id: "WEEK_TEST_9", name: "Week Test 9", type: "WEEK_TEST" },
        { id: "WEEK_TEST_10", name: "Week Test 10", type: "WEEK_TEST" },
        { id: "WEEK_TEST_11", name: "Week Test 11", type: "WEEK_TEST" },
        { id: "WEEK_TEST_12", name: "Week Test 12", type: "WEEK_TEST" },
        { id: "WEEK_TEST_13", name: "Week Test 13", type: "WEEK_TEST" },
        { id: "WEEK_TEST_14", name: "Week Test 14", type: "WEEK_TEST" },
        { id: "WEEK_TEST_15", name: "Week Test 15", type: "WEEK_TEST" },
        { id: "WEEK_TEST_16", name: "Week Test 16", type: "WEEK_TEST" },
        { id: "WEEK_TEST_17", name: "Week Test 17", type: "WEEK_TEST" },
        { id: "WEEK_TEST_18", name: "Week Test 18", type: "WEEK_TEST" },
        { id: "UNIT_TEST_1", name: "Unit Test 1", type: "UNIT_TEST" },
        { id: "UNIT_TEST_2", name: "Unit Test 2", type: "UNIT_TEST" },
        { id: "UNIT_TEST_3", name: "Unit Test 3", type: "UNIT_TEST" },
        { id: "UNIT_TEST_4", name: "Unit Test 4", type: "UNIT_TEST" },
        { id: "UNIT_TEST_5", name: "Unit Test 5", type: "UNIT_TEST" },
        { id: "GRAND_TEST_1", name: "Grand Test 1", type: "GRAND_TEST" },
        { id: "GRAND_TEST_2", name: "Grand Test 2", type: "GRAND_TEST" },
      ];
    case "NGHS_MAE":
      return [
        { id: "CDF_1", name: "CDF 1", type: "CDF" },
        { id: "CDF_2", name: "CDF 2", type: "CDF" },
        { id: "CDF_3", name: "CDF 3", type: "CDF" },
        { id: "CDF_4", name: "CDF 4", type: "CDF" },
        { id: "CDF_5", name: "CDF 5", type: "CDF" },
        { id: "CDF_6", name: "CDF 6", type: "CDF" },
        { id: "CDF_7", name: "CDF 7", type: "CDF" },
        { id: "CDF_8", name: "CDF 8", type: "CDF" },
        { id: "CDF_9", name: "CDF 9", type: "CDF" },
        { id: "CDF_10", name: "CDF 10", type: "CDF" },
        { id: "CDF_11", name: "CDF 11", type: "CDF" },
        { id: "CDF_12", name: "CDF 12", type: "CDF" },
        { id: "CDF_13", name: "CDF 13", type: "CDF" },
        { id: "CDF_14", name: "CDF 14", type: "CDF" },
        { id: "CDF_15", name: "CDF 15", type: "CDF" },
        { id: "CDF_16", name: "CDF 16", type: "CDF" },
        { id: "CDF_17", name: "CDF 17", type: "CDF" },
        { id: "CDF_18", name: "CDF 18", type: "CDF" },
        { id: "JEE_1_L1", name: "JEE 1_L1", type: "JEE_L1" },
        { id: "JEE_2_L1", name: "JEE 2_L1", type: "JEE_L1" },
        { id: "JEE_3_L1", name: "JEE 3_L1", type: "JEE_L1" },
        { id: "JEE_4_L1", name: "JEE 4_L1", type: "JEE_L1" },
        { id: "JEE_5_L1", name: "JEE 5_L1", type: "JEE_L1" },
        { id: "JEE_6_L1", name: "JEE 6_L1", type: "JEE_L1" },
        { id: "JEE_7_L1", name: "JEE 7_L1", type: "JEE_L1" },
        { id: "JEE_8_L1", name: "JEE 8_L1", type: "JEE_L1" },
        { id: "JEE_9_L1", name: "JEE 9_L1", type: "JEE_L1" },
        { id: "JEE_10_L1", name: "JEE 10_L1", type: "JEE_L1" },
        { id: "JEE_11_L1", name: "JEE 11_L1", type: "JEE_L1" },
        { id: "JEE_12_L1", name: "JEE 12_L1", type: "JEE_L1" },
        { id: "JEE_13_L1", name: "JEE 13_L1", type: "JEE_L1" },
        { id: "JEE_14_L1", name: "JEE 14_L1", type: "JEE_L1" },
        { id: "JEE_15_L1", name: "JEE 15_L1", type: "JEE_L1" },
        { id: "JEE_16_L1", name: "JEE 16_L1", type: "JEE_L1" },
        { id: "JEE_17_L1", name: "JEE 17_L1", type: "JEE_L1" },
        { id: "JEE_18_L1", name: "JEE 18_L1", type: "JEE_L1" },
        { id: "JEE_1_L2", name: "JEE 1_L2", type: "JEE_L2" },
        { id: "JEE_2_L2", name: "JEE 2_L2", type: "JEE_L2" },
        { id: "JEE_3_L2", name: "JEE 3_L2", type: "JEE_L2" },
        { id: "JEE_4_L2", name: "JEE 4_L2", type: "JEE_L2" },
        { id: "JEE_5_L2", name: "JEE 5_L2", type: "JEE_L2" },
        { id: "JEE_6_L2", name: "JEE 6_L2", type: "JEE_L2" },
        { id: "JEE_7_L2", name: "JEE 7_L2", type: "JEE_L2" },
        { id: "JEE_8_L2", name: "JEE 8_L2", type: "JEE_L2" },
        { id: "JEE_9_L2", name: "JEE 9_L2", type: "JEE_L2" },
        { id: "JEE_10_L2", name: "JEE 10_L2", type: "JEE_L2" },
        { id: "JEE_11_L2", name: "JEE 11_L2", type: "JEE_L2" },
        { id: "JEE_12_L2", name: "JEE 12_L2", type: "JEE_L2" },
        { id: "JEE_13_L2", name: "JEE 13_L2", type: "JEE_L2" },
        { id: "JEE_14_L2", name: "JEE 14_L2", type: "JEE_L2" },
        { id: "JEE_15_L2", name: "JEE 15_L2", type: "JEE_L2" },
        { id: "JEE_16_L2", name: "JEE 16_L2", type: "JEE_L2" },
        { id: "JEE_17_L2", name: "JEE 17_L2", type: "JEE_L2" },
        { id: "JEE_18_L2", name: "JEE 18_L2", type: "JEE_L2" },
      ];
    default:
      return [];
  }
};

const PROGRAM_NAMES = {
  MAE: "MAESTRO",
  PIO: "PIONEER",
  CAT: "CATALYST",
  FF: "FUTURE FOUNDATION",
  NGHS_MAE: "NGHS MAESTRO",
};

const formatExamName = (examPattern = "") =>
  examPattern
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export default function ExamRegistration({ schools = [], mode = "list" }) {
  const navigate = useNavigate();
  const [selectedSchool, setSelectedSchool] = useState("");
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolData, setSchoolData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [datasets, setDatasets] = useState([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [datasetsError, setDatasetsError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [examResults, setExamResults] = useState([]);
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeDataset, setActiveDataset] = useState(null);
  const [datasetResults, setDatasetResults] = useState([]);
  const [datasetResultsLoading, setDatasetResultsLoading] = useState(false);
  const [datasetResultsError, setDatasetResultsError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const [examForm, setExamForm] = useState({
    examPattern: "",
    examDate: "",
    classSection: "",
    max_marks_physics: "",
    max_marks_maths: "",
    max_marks_biology: "",
    max_marks_chemistry: "",
  });

  useEffect(() => {
    if (!selectedSchool) {
      setSchoolData(null);
      setDatasets([]);
      return;
    }

    const fetchSchool = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/schools/${selectedSchool}`);
        if (!res.ok) throw new Error("Failed to load school");
        const data = await res.json();
        setSchoolData(data); // data = { school, classes, teachers }
      } catch (err) {
        setError(err.message);
        setSchoolData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSchool();
  }, [selectedSchool]);

  useEffect(() => {
    setExamForm({
      examPattern: "",
      examDate: "",
      classSection: "",
      max_marks_physics: "",
      max_marks_maths: "",
      max_marks_biology: "",
      max_marks_chemistry: "",
    });
    setSelectedFile(null);
    setUploadError("");
    setExamResults([]);
  }, [selectedSchool]);

  useEffect(() => {
    if (!selectedSchool || mode !== "list") return;
    fetchDatasets();
  }, [selectedSchool, mode]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const fetchDatasets = async () => {
    if (!selectedSchool) return;
    setDatasetsLoading(true);
    setDatasetsError("");
    try {
      const res = await fetch(
        `${API_BASE}/api/schools/${selectedSchool}/exam-datasets`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load exams");
      setDatasets(data || []);
    } catch (err) {
      setDatasets([]);
      setDatasetsError(err.message || "Failed to load exams");
    } finally {
      setDatasetsLoading(false);
    }
  };

  const filteredSchools = useMemo(() => {
    const query = schoolSearch.trim().toLowerCase();
    if (!query) return schools;
    return schools.filter((school) =>
      `${school.school_name || ""} ${school.school_id || ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [schoolSearch, schools]);

  const selectedSchoolLabel = useMemo(() => {
    const school = schools.find((item) => item.school_id === selectedSchool);
    return school ? `${school.school_name} (${school.school_id})` : "";
  }, [schools, selectedSchool]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setExamForm((prev) => ({ ...prev, [name]: value }));
  };

  const getExamOptions = () => {
    if (!schoolData?.classes?.length) return [];

    const availablePrograms = [
      ...new Set(
        schoolData.classes
          .map((cls) => cls.program?.toUpperCase())
          .filter(Boolean),
      ),
    ];

    if (availablePrograms.length === 0) return [];

    let allExams = [];
    availablePrograms.forEach((programCode) => {
      const exams = getExamPatternsByProgram(programCode);

      exams.forEach((exam) => {
        const programDisplayName = PROGRAM_NAMES[programCode] || programCode;

        allExams.push({
          id: `${selectedSchool}_${programCode}_${exam.id}`,
          exam_pattern: exam.id,
          display_name: `${programDisplayName} - ${exam.name}`,
          program: programCode,
          school_id: selectedSchool,
          type: exam.type,
        });
      });
    });

    return allExams;
  };

  const examOptions = getExamOptions();

  const handleSchoolSearchChange = (e) => {
    const value = e.target.value;
    setSchoolSearch(value);
    setSchoolDropdownOpen(true);
    if (!value.trim()) setSelectedSchool("");
  };

  const selectSchool = (school) => {
    setSelectedSchool(school.school_id);
    setSchoolSearch(`${school.school_name} (${school.school_id})`);
    setSchoolDropdownOpen(false);
  };

  const clearSchoolSelection = () => {
    setSelectedSchool("");
    setSchoolSearch("");
    setSchoolDropdownOpen(false);
  };

  const getClassSectionParts = () => {
    const lastDashIndex = examForm.classSection.lastIndexOf("-");
    if (
      lastDashIndex <= 0 ||
      lastDashIndex === examForm.classSection.length - 1
    ) {
      return null;
    }

    return {
      examClass: examForm.classSection.substring(0, lastDashIndex).trim(),
      examSection: examForm.classSection.substring(lastDashIndex + 1).trim(),
    };
  };

  const processSelectedFile = (file) => {
    setUploadError("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (
      ![".csv", ".xlsx", ".xls"].some((ext) =>
        file.name.toLowerCase().endsWith(ext),
      )
    ) {
      setSelectedFile(null);
      setUploadError("Only CSV, XLSX, or XLS files are allowed.");
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (e) => {
    processSelectedFile(e.target.files?.[0] || null);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    processSelectedFile(e.dataTransfer.files?.[0] || null);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setUploadError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploadError("");
    setExamResults([]);

    if (
      !selectedSchool ||
      !examForm.examPattern ||
      !examForm.examDate ||
      !examForm.classSection
    ) {
      setUploadError("Please fill all required exam fields.");
      return;
    }

    const selectedExam = examOptions.find(
      (exam) => exam.id === examForm.examPattern,
    );

    if (!selectedExam) {
      setUploadError("Invalid exam selected.");
      return;
    }

    const classSectionParts = getClassSectionParts();
    if (!classSectionParts) {
      setUploadError('Invalid Class-Section format. Expected "CLASS-SECTION".');
      return;
    }

    if (!selectedFile) {
      setUploadError("Please select an OMR result file.");
      return;
    }

    const tempExamId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("school_id", selectedSchool);
    formData.append("program", selectedExam.program);
    formData.append("exam_pattern", selectedExam.exam_pattern);
    formData.append("class", classSectionParts.examClass);
    formData.append("section", classSectionParts.examSection);
    formData.append("exam_date", examForm.examDate);
    formData.append("max_marks_physics", examForm.max_marks_physics || 50);
    formData.append("max_marks_maths", examForm.max_marks_maths || 50);
    formData.append("max_marks_chemistry", examForm.max_marks_chemistry || 50);
    formData.append("max_marks_biology", examForm.max_marks_biology || 50);

    setUploading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/exams/${tempExamId}/results/upload`,
        {
          method: "POST",
          body: formData,
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          response.status === 409
            ? "This exam has already been uploaded. Duplicate registration is not allowed."
            : data.error || "Upload failed.",
        );
      }

      setExamResults(data.results || []);
      setSelectedFile(null);
    } catch (err) {
      setUploadError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const buildDatasetQuery = (exam) =>
    new URLSearchParams({
      program: exam.program || "",
      exam_pattern: exam.exam_pattern || "",
      class: exam.class || "",
      section: exam.section || "",
      exam_date: exam.exam_date || "",
    }).toString();

  const confirmDeleteExam = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/schools/${deleteTarget.school_id}/exam-datasets?${buildDatasetQuery(deleteTarget)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete exam");

      setToast({ type: "success", msg: "Exam deleted successfully." });
      setDeleteTarget(null);
      await fetchDatasets();
    } catch (err) {
      setToast({ type: "error", msg: err.message || "Failed to delete exam." });
    } finally {
      setDeleting(false);
    }
  };

  const openDataset = async (exam) => {
    setActiveDataset(exam);
    setDatasetResults([]);
    setDatasetResultsError("");
    setDatasetResultsLoading(true);

    try {
      const res = await fetch(
        `${API_BASE}/api/schools/${exam.school_id}/exam-datasets/results?${buildDatasetQuery(exam)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load exam results");
      setDatasetResults(data || []);
    } catch (err) {
      setDatasetResults([]);
      setDatasetResultsError(err.message || "Failed to load exam results");
    } finally {
      setDatasetResultsLoading(false);
    }
  };

  const closeDataset = () => {
    setActiveDataset(null);
    setDatasetResults([]);
    setDatasetResultsError("");
  };

  const downloadPDF = async () => {
    if (!examResults.length) return alert("No data to download");

    import("jspdf").then((jsPDF) => {
      import("jspdf-autotable").then(() => {
        const doc = new jsPDF.default("landscape");
        const selectedExam = examOptions.find(
          (exam) => exam.id === examForm.examPattern,
        );
        const classSectionParts = getClassSectionParts();

        doc.setFontSize(18);
        doc.text(
          `Exam Results - ${selectedExam?.display_name || "OMR Exam"}`,
          14,
          22,
        );
        doc.setFontSize(12);
        doc.text(
          `School: ${selectedSchool} | Class: ${classSectionParts?.examClass || "-"} | Section: ${classSectionParts?.examSection || "-"}`,
          14,
          30,
        );

        const headers = [
          "Student ID",
          "Student Name",
          "Total Max Marks",
          "Correct",
          "Wrong",
          "Unattempted",
          "Physics",
          "Chemistry",
          "Maths",
          "Biology",
          "Total Marks",
          "Percentage",
          "Class Rank",
          "School Rank",
          "All India Rank",
        ];

        const body = examResults.map((r) => [
          r.student_id || "-",
          `${r.first_name || ""} ${r.last_name || ""}`.trim() || "-",
          r.total_questions || 0,
          r.correct_answers || 0,
          r.wrong_answers || 0,
          r.unattempted || 0,
          r.physics_marks || 0,
          r.chemistry_marks || 0,
          r.maths_marks || 0,
          r.biology_marks || 0,
          r.total_marks || 0,
          `${r.percentage || 0}%`,
          r.class_rank || "-",
          r.school_rank || "-",
          r.all_schools_rank || "-",
        ]);

        doc.autoTable({
          startY: 40,
          head: [headers],
          body,
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [30, 144, 255], fontSize: 9 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          didDrawPage: (data) => {
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(
              `Generated on: ${new Date().toLocaleString()}`,
              data.settings.margin.left,
              doc.internal.pageSize.height - 10,
            );
          },
        });

        doc.save(
          `Exam_Results_${selectedSchool}_${new Date().toISOString().split("T")[0]}.pdf`,
        );
      });
    });
  };

  const downloadDatasetPDF = async () => {
    if (!datasetResults.length || !activeDataset) {
      alert("No data available to export.");
      return;
    }

    import("jspdf").then((jsPDF) => {
      import("jspdf-autotable").then(() => {
        const doc = new jsPDF.default({
          unit: "pt",
          format: "a4",
          orientation: "landscape",
        });
        const pageWidth = doc.internal.pageSize.getWidth();
        const title = "OMR EXAM RESULT REPORT";

        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text(title, (pageWidth - doc.getTextWidth(title)) / 2, 40);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100);
        [
          `School: ${activeDataset.school_id}`,
          `Exam: ${formatExamName(activeDataset.exam_pattern)}`,
          `Program: ${PROGRAM_NAMES[activeDataset.program] || activeDataset.program}`,
          `Class: ${activeDataset.class} | Section: ${activeDataset.section}`,
          `Exam Date: ${activeDataset.exam_date || "-"}`,
          `Students: ${datasetResults.length}`,
        ].forEach((line, index) => doc.text(line, 40, 75 + index * 14));

        const headers = [
          "Student ID",
          "Student Name",
          "Total Max Marks",
          "Correct",
          "Wrong",
          "Unattempted",
          "Physics",
          "Chemistry",
          "Maths",
          "Biology",
          "Total Marks",
          "Percentage",
          "Class Rank",
          "School Rank",
          "All India Rank",
        ];

        const body = datasetResults.map((r) => [
          r.student_id || "-",
          `${r.first_name || ""} ${r.last_name || ""}`.trim() || "-",
          r.total_questions || 0,
          r.correct_answers || 0,
          r.wrong_answers || 0,
          r.unattempted || 0,
          r.physics_marks || 0,
          r.chemistry_marks || 0,
          r.maths_marks || 0,
          r.biology_marks || 0,
          r.total_marks || 0,
          `${r.percentage || 0}%`,
          r.class_rank || "-",
          r.school_rank || "-",
          r.all_schools_rank || "-",
        ]);

        doc.autoTable({
          startY: 175,
          head: [headers],
          body,
          theme: "striped",
          styles: {
            fontSize: 8,
            cellPadding: 5,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: [30, 70, 140],
            textColor: [255, 255, 255],
            fontStyle: "bold",
          },
          alternateRowStyles: {
            fillColor: [245, 248, 255],
          },
          margin: { left: 40, right: 40 },
        });

        doc.save(
          `OMR_EXAM_${activeDataset.school_id}_${activeDataset.exam_pattern}_${new Date().toISOString().split("T")[0]}.pdf`,
        );
      });
    });
  };

  const renderSchoolSearch = () => (
    <div className="omr-school-select">
      <div className="omr-search-input-wrap">
        <Search size={18} />
        <input
          id="omr-school-search"
          value={schoolSearch || selectedSchoolLabel}
          onChange={handleSchoolSearchChange}
          onFocus={() => setSchoolDropdownOpen(true)}
          onBlur={() =>
            window.setTimeout(() => setSchoolDropdownOpen(false), 120)
          }
          placeholder="Type school name or ID"
          autoComplete="off"
        />
        {(schoolSearch || selectedSchool) && (
          <button
            className="table-search-clear"
            type="button"
            onClick={clearSchoolSelection}
            aria-label="Clear school selection"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {schoolDropdownOpen && (
        <div className="omr-school-dropdown">
          {filteredSchools.slice(0, 12).map((school) => (
            <button
              key={school.school_id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSchool(school)}
            >
              <strong>{school.school_name}</strong>
              <span>{school.school_id}</span>
            </button>
          ))}
          {filteredSchools.length === 0 && (
            <div className="omr-school-dropdown-empty">No schools found</div>
          )}
        </div>
      )}
    </div>
  );

  if (mode === "new") {
    return (
      <div className="omr-page omr-page--upload">
        <div className="page-header omr-page-header">
          <div className="page-header-left">
            <h1 className="page-header-title">Register & Upload Exam</h1>
            <p className="page-header-subtitle">
              Submit exam details and the OMR result file in one step.
            </p>
          </div>
          <button
            className="omr-secondary-btn"
            onClick={() => navigate("/admin/exams")}
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>

        <div className="table-toolbar omr-toolbar">{renderSchoolSearch()}</div>

        <div className="page-content">
          {error && (
            <div className="alert-banner alert-banner--error">{error}</div>
          )}
          {loading && (
            <div className="alert-banner alert-banner--info">
              Loading school data...
            </div>
          )}

          {schoolData && (
            <form className="omr-upload-layout" onSubmit={handleSubmit}>
              <div className="omr-selected-school-card">
                <div className="omr-school-visual">
                  <div className="omr-school-icon">
                    <School size={38} />
                  </div>
                </div>
                <div className="omr-school-main">
                  <span className="omr-kicker">Selected School</span>
                  <h2>
                    {schoolData.school?.school_name || "-"}
                    <CheckCircle2 size={18} />
                  </h2>
                  <p>School Code: {selectedSchool}</p>
                  <div className="omr-program-pills">
                    <span>Programs:</span>
                    {[
                      ...new Set(
                        schoolData.classes
                          ?.map((c) => c.program)
                          .filter(Boolean),
                      ),
                    ].map((program) => (
                      <strong key={program}>{program}</strong>
                    ))}
                  </div>
                </div>
                <div className="omr-school-stat">
                  <div className="omr-stat-icon">
                    <UsersRound size={20} />
                  </div>
                  <span>Total Classes</span>
                  <strong>{schoolData.classes?.length || 0}</strong>
                </div>
                <div className="omr-school-meta">
                  <div>
                    <span className="omr-meta-icon">
                      <MapPin size={17} />
                    </span>
                    <span className="omr-meta-copy">
                      <span>Location</span>
                      <strong>
                        {[schoolData.school?.state, schoolData.school?.district]
                          .filter(Boolean)
                          .join(", ") || "-"}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              <section className="omr-upload-panel omr-upload-exam-card">
                <h3 className="omr-panel-title">
                  <CalendarDays size={16} />
                  <span>A. Exam Details</span>
                </h3>
                <div className="form-grid-3">
                  <label className="form-field">
                    <span className="form-label">Select Exam</span>
                    <select
                      className="form-input"
                      name="examPattern"
                      value={examForm.examPattern}
                      onChange={handleFormChange}
                      required
                    >
                      <option value="">-- Select Exam --</option>
                      {examOptions.map((exam) => (
                        <option key={exam.id} value={exam.id}>
                          {exam.display_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="form-field">
                    <span className="form-label">Exam Date</span>
                    <input
                      className="form-input"
                      type="date"
                      name="examDate"
                      value={examForm.examDate}
                      onChange={handleFormChange}
                      required
                    />
                  </label>

                  <label className="form-field">
                    <span className="form-label">Class-Section</span>
                    <select
                      className="form-input"
                      name="classSection"
                      value={examForm.classSection}
                      onChange={handleFormChange}
                      required
                    >
                      <option value="">-- Select Class-Section --</option>
                      {schoolData.classes?.map((cls) => (
                        <option
                          key={`${cls.class}-${cls.section}`}
                          value={`${cls.class}-${cls.section}`}
                        >
                          {cls.class} - {cls.section}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="omr-upload-panel omr-upload-marks-card">
                <h3 className="omr-panel-title">
                  <BookOpen size={16} />
                  <span>B. Subject Max Marks</span>
                </h3>
                <div className="omr-upload-marks-grid">
                  {[
                    ["Physics", Atom],
                    ["Maths", Calculator],
                    ["Biology", Leaf],
                    ["Chemistry", Beaker],
                  ].map(([subject, Icon]) => {
                    const fieldName = `max_marks_${subject.toLowerCase()}`;
                    return (
                      <label
                        className="form-field omr-subject-field"
                        key={subject}
                      >
                        <div className="omr-subject-label">
                          <span className="omr-subject-icon">
                            <Icon size={15} />
                          </span>
                          <span className="form-label">{subject}</span>
                        </div>
                        <input
                          className="form-input"
                          type="number"
                          name={fieldName}
                          value={examForm[fieldName] || ""}
                          onChange={handleFormChange}
                          min="0"
                          step="1"
                          placeholder="e.g., 100"
                          required
                        />
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="omr-upload-panel omr-upload-file-card">
                <h3 className="omr-panel-title">
                  <UploadCloud size={16} />
                  <span>C. Upload OMR Result File</span>
                </h3>
                <div
                  className={`omr-file-drop${dragActive ? " omr-file-drop--active" : ""}${selectedFile ? " omr-file-drop--selected" : ""}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleFileDrop}
                >
                  <input
                    id="omr-result-file"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                  />
                  {selectedFile ? (
                    <FileSpreadsheet size={34} />
                  ) : (
                    <CloudUpload size={34} />
                  )}
                  <div className="omr-file-copy">
                    <strong>
                      {selectedFile
                        ? selectedFile.name
                        : "Drag & drop your OMR result file here"}
                    </strong>
                    <span>
                      {selectedFile ? "File selected" : "or click to browse"}
                    </span>
                  </div>
                  <label htmlFor="omr-result-file">
                    <FolderOpen size={18} />
                    Choose File
                  </label>
                  <small>Accepted formats: .csv, .xls, .xlsx</small>
                  {selectedFile && (
                    <button
                      type="button"
                      className="omr-file-clear"
                      onClick={clearSelectedFile}
                    >
                      Clear file
                    </button>
                  )}
                </div>
              </section>

              {uploadError && (
                <div className="alert-banner alert-banner--error">
                  {uploadError}
                </div>
              )}

              <section className="omr-upload-panel omr-upload-actions">
                <p>
                  Review the details above and upload the OMR result file to
                  register the exam.
                </p>
                <button
                  className="btn-link-primary"
                  type="submit"
                  disabled={uploading}
                >
                  <UploadCloud size={18} />
                  {uploading ? "Uploading..." : "Register & Upload"}
                </button>
                <small>
                  <Lock size={13} />
                  Your data is secure and encrypted.
                </small>
              </section>
            </form>
          )}

          {examResults.length > 0 && (
            <ResultsTable results={examResults} onDownload={downloadPDF} />
          )}
        </div>
      </div>
    );
  }

  if (activeDataset) {
    return (
      <div className="omr-page">
        <div className="page-header omr-page-header">
          <div className="page-header-left">
            <h1 className="page-header-title">
              {formatExamName(activeDataset.exam_pattern)}
            </h1>
            <p className="page-header-subtitle">
              {PROGRAM_NAMES[activeDataset.program] || activeDataset.program} -
              Class {activeDataset.class} - Section {activeDataset.section} -{" "}
              {activeDataset.exam_date || "No date"}
            </p>
          </div>
          <div className="page-header-actions">
            <button
              className="page-back-nav omr-back-inline"
              onClick={closeDataset}
            >
              <ArrowLeft size={16} />
              Back to Exams
            </button>
          </div>
        </div>

        <div className="table-toolbar">
          <span className="results-count-label" style={{ marginLeft: 0 }}>
            {datasetResultsLoading
              ? "Loading student results..."
              : `Showing ${datasetResults.length} student${datasetResults.length === 1 ? "" : "s"}`}
          </span>
          <div className="toolbar-export-slot">
            <div className="report-buttons-wrap">
              <div className="report-buttons-row">
                <button
                  className={`btn-report btn-report--pdf ${!datasetResults.length ? "disabled" : ""}`}
                  onClick={downloadDatasetPDF}
                  disabled={!datasetResults.length}
                  title="Download exam results as PDF"
                >
                  PDF Report
                </button>
              </div>
            </div>
          </div>
        </div>

        {datasetResultsError && (
          <div
            className="alert-banner alert-banner--error"
            style={{ margin: "16px 32px" }}
          >
            {datasetResultsError}
          </div>
        )}

        {datasetResults.length > 0 && <ResultsTable results={datasetResults} />}
      </div>
    );
  }

  return (
    <div className="omr-page">
      <div className="page-header omr-page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">OMR Exams</h1>
          <p className="page-header-subtitle">
            Select a school to view uploaded OMR exam datasets.
          </p>
        </div>
      </div>

      {toast && (
        <div
          className={`alert-banner alert-banner--${toast.type}`}
          style={{ margin: "0" }}
        >
          <span className="alert-banner-icon">
            {toast.type === "success" ? "OK" : "!"}
          </span>
          <span>{toast.msg}</span>
        </div>
      )}

      <div className="table-toolbar omr-toolbar">
        {renderSchoolSearch()}
        <span className="results-count-label">
          {selectedSchool
            ? `Showing ${datasets.length} uploaded exam${datasets.length === 1 ? "" : "s"}`
            : "Select a school"}
        </span>
      </div>

      <div className="omr-section-header">
        <div>
          <h3>Existing Exams</h3>
          <span>
            {selectedSchool
              ? `${datasets.length} exam${datasets.length === 1 ? "" : "s"} found`
              : "Select a school"}
          </span>
        </div>
        <button
          className="btn-link-primary"
          onClick={() => navigate("/admin/exams/new")}
        >
          <Plus size={18} />
          Register & Upload Exam
        </button>
      </div>

      {datasetsLoading && (
        <div className="omr-alert">Loading existing exams...</div>
      )}
      {datasetsError && (
        <div className="omr-alert omr-alert-error">{datasetsError}</div>
      )}

      {!selectedSchool && (
        <div className="omr-empty-state">
          Choose a school to load existing OMR exams.
        </div>
      )}

      {selectedSchool &&
        !datasetsLoading &&
        !datasetsError &&
        datasets.length === 0 && (
          <div className="omr-empty-state">
            No uploaded exams found for this school.
          </div>
        )}

      {datasets.length > 0 && (
        <div className="data-table-outer omr-data-table-outer">
          <table className="data-table omr-data-table omr-exams-table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Program</th>
                <th>Class</th>
                <th>Section</th>
                <th>Date</th>
                <th>Students</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((exam) => (
                <tr key={exam.key} onClick={() => openDataset(exam)}>
                  <td data-label="Exam">{formatExamName(exam.exam_pattern)}</td>
                  <td data-label="Program">
                    {PROGRAM_NAMES[exam.program] || exam.program}
                  </td>
                  <td data-label="Class">{exam.class}</td>
                  <td data-label="Section">{exam.section}</td>
                  <td data-label="Date">{exam.exam_date || "-"}</td>
                  <td data-label="Students">{exam.student_count || 0}</td>
                  <td data-label="Actions" className="text-center">
                    <button
                      className="btn-icon-delete"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget(exam);
                      }}
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">Delete</div>
            <h3 className="modal-title">Delete OMR Exam</h3>
            <p className="modal-body">
              Are you sure you want to delete{" "}
              <span className="modal-school-id">
                {formatExamName(deleteTarget.exam_pattern)}
              </span>
              ?
            </p>
            <div className="modal-warning-note">
              This removes all uploaded result rows for this exam dataset.
            </div>
            <div className="modal-actions">
              <button
                className="btn-modal-cancel"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                className="btn-modal-delete"
                disabled={deleting}
                onClick={confirmDeleteExam}
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultsTable({ results, onDownload }) {
  return (
    <div className="omr-results">
      <div className="omr-section-header">
        <div>
          <h3>Uploaded Results</h3>
          <span>{results.length} student rows processed</span>
        </div>
        {onDownload && (
          <div className="report-buttons-wrap">
            <div className="report-buttons-row">
              <button
                className={`btn-report btn-report--pdf ${!results.length ? "disabled" : ""}`}
                onClick={onDownload}
                disabled={!results.length}
                title="Download exam results as PDF"
              >
                PDF Report
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="data-table-outer omr-data-table-outer">
        <table className="data-table omr-data-table">
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Name</th>
              <th>Total Max Marks</th>
              <th>Correct</th>
              <th>Wrong</th>
              <th>Unattempted</th>
              <th>Physics</th>
              <th>Chemistry</th>
              <th>Maths</th>
              <th>Biology</th>
              <th>Total</th>
              <th>%</th>
              <th>Class Rank</th>
              <th>School Rank</th>
              <th>All India</th>
            </tr>
          </thead>
          <tbody>
            {[...results]
              .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
              .map((row, index) => (
                <tr key={`${row.student_id || "row"}-${index}`}>
                  <td data-label="Student ID">{row.student_id || "-"}</td>
                  <td data-label="Name">
                    {`${row.first_name || ""} ${row.last_name || ""}`.trim() ||
                      "-"}
                  </td>
                  <td data-label="Total Max Marks">
                    {row.total_questions || 0}
                  </td>
                  <td data-label="Correct">{row.correct_answers || 0}</td>
                  <td data-label="Wrong">{row.wrong_answers || 0}</td>
                  <td data-label="Unattempted">{row.unattempted || 0}</td>
                  <td data-label="Physics">{row.physics_marks || 0}</td>
                  <td data-label="Chemistry">{row.chemistry_marks || 0}</td>
                  <td data-label="Maths">{row.maths_marks || 0}</td>
                  <td data-label="Biology">{row.biology_marks || 0}</td>
                  <td data-label="Total">{row.total_marks || 0}</td>
                  <td data-label="%">
                    {row.percentage != null ? `${row.percentage}%` : "0%"}
                  </td>
                  <td data-label="Class Rank">{row.class_rank || "-"}</td>
                  <td data-label="School Rank">{row.school_rank || "-"}</td>
                  <td data-label="All India">{row.all_schools_rank || "-"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
