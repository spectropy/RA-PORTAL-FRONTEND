// src/ExamRegistration.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  ArrowLeft,
  Atom,
  Beaker,
  BookOpen,
  Calculator,
  CalendarDays,
  ChevronDown,
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
import spectropyLogo from "../assets/logo.png";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const SUPPORTED_PROGRAMS = new Set([
  "SPHS",
  "MAESTRO",
  "GHS",
  "SFS",
  "KTS",
  "VIJAYA",
  "PHS",
  "KPS",
  "SPR",
  "FF",
  "CAT",
  "SPARK",
  "MANAIR_MAESTRO",
]);

const COMMON_EXAM_PATTERNS = [
  ...Array.from({ length: 15 }, (_, index) => ({
    id: `PART_TEST_${index + 1}`,
    name: `Part Test ${index + 1}`,
    type: "PART_TEST",
  })),
  ...Array.from({ length: 3 }, (_, index) => ({
    id: `UNIT_TEST_${index + 1}`,
    name: `Unit Test ${index + 1}`,
    type: "UNIT_TEST",
  })),
  ...Array.from({ length: 2 }, (_, index) => ({
    id: `GRAND_TEST_${index + 1}`,
    name: `Grand Test ${index + 1}`,
    type: "GRAND_TEST",
  })),
];

const getExamPatternsByProgram = (program) =>
  SUPPORTED_PROGRAMS.has(program) ? COMMON_EXAM_PATTERNS : [];

const PROGRAM_NAMES = Object.fromEntries(
  [...SUPPORTED_PROGRAMS].map((program) => [program, program]),
);

const formatExamName = (examPattern = "") =>
  examPattern
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const normalizeExamPattern = (value = "") =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

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
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false);
  const [examDropdownOpen, setExamDropdownOpen] = useState(false);
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
          .filter(
            (program) => program && SUPPORTED_PROGRAMS.has(program),
          ),
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

  const filteredExamOptions = useMemo(() => {
    const query = examForm.examPattern.trim().toLowerCase();
    if (!query) return examOptions;
    return examOptions.filter((exam) =>
      exam.display_name.toLowerCase().includes(query),
    );
  }, [examForm.examPattern, examOptions]);

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

  const selectExamOption = (exam) => {
    setExamForm((prev) => ({ ...prev, examPattern: exam.display_name }));
    setExamDropdownOpen(false);
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
    setDatasetResults([]);
    setDatasetResultsError("");

    if (
      !selectedSchool ||
      !examForm.examPattern ||
      !examForm.examDate ||
      !examForm.classSection
    ) {
      setUploadError("Please fill all required exam fields.");
      return;
    }

    const classSectionParts = getClassSectionParts();
    if (!classSectionParts) {
      setUploadError('Invalid Class-Section format. Expected "CLASS-SECTION".');
      return;
    }

    const selectedExamOption = examOptions.find(
      (exam) =>
        exam.id === examForm.examPattern ||
        exam.display_name === examForm.examPattern,
    );

    const selectedClass = schoolData?.classes?.find(
      (cls) =>
        String(cls.class || "").trim() === classSectionParts.examClass &&
        String(cls.section || "").trim() === classSectionParts.examSection,
    );

    const customExamPattern = normalizeExamPattern(examForm.examPattern);

    if (!selectedExamOption && !customExamPattern) {
      setUploadError("Please enter a valid exam name.");
      return;
    }

    const selectedExam =
      selectedExamOption || {
        id: customExamPattern,
        exam_pattern: customExamPattern,
        display_name: examForm.examPattern.trim(),
        program: selectedClass?.program?.toUpperCase() || "",
        school_id: selectedSchool,
        type: "CUSTOM",
      };

    if (!selectedExam.program) {
      setUploadError("Unable to identify the program for this class-section.");
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

      const uploadedDataset = {
        key: [
          selectedSchool,
          selectedExam.program,
          selectedExam.exam_pattern,
          classSectionParts.examClass,
          classSectionParts.examSection,
          examForm.examDate,
        ].join("|"),
        school_id: selectedSchool,
        program: selectedExam.program,
        exam_pattern: selectedExam.exam_pattern,
        class: classSectionParts.examClass,
        section: classSectionParts.examSection,
        exam_date: examForm.examDate,
        student_count: data.results?.length || 0,
      };

      setDatasetResults(data.results || []);
      setActiveDataset(uploadedDataset);
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
    if (mode === "new") {
      navigate("/admin/exams");
      return;
    }

    setActiveDataset(null);
    setDatasetResults([]);
    setDatasetResultsError("");
  };

  const downloadDatasetPDF = async () => {
    if (
      !Array.isArray(datasetResults) ||
      datasetResults.length === 0 ||
      !activeDataset
    ) {
      alert("No data available to export.");
      return;
    }

    try {
      const [jsPDFModule, autoTableModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const JsPDF = jsPDFModule.jsPDF || jsPDFModule.default;
      const autoTable = autoTableModule.autoTable || autoTableModule.default;

      if (!JsPDF || typeof autoTable !== "function") {
        throw new Error("jsPDF or jspdf-autotable could not be loaded.");
      }

      const doc = new JsPDF({
        unit: "pt",
        format: "a4",
        orientation: "landscape",
        compress: true,
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      /*
       * Small side margins allow the table to use almost
       * the complete A4 landscape width.
       */
      const marginX = 18;
      const contentWidth = pageWidth - marginX * 2;

      const COLORS = {
        navy: [23, 54, 93],
        royalBlue: [31, 94, 184],
        paleBlue: [243, 247, 253],
        softBlue: [232, 240, 250],
        border: [204, 216, 230],
        text: [31, 41, 55],
        muted: [100, 116, 139],
        white: [255, 255, 255],
        green: [21, 128, 61],
        amber: [180, 105, 0],
        red: [185, 28, 28],
        lightGrey: [220, 228, 238],
      };

      const HEADER_LAYOUT = {
        titleBandY: 80,
        titleBandHeight: 38,

        metadataY: 128,
        metadataHeight: 44,

        summaryY: 182,
        summaryHeight: 42,

        tableStartY: 236,
      };

      /* ============================================================
       VALUE HELPERS
    ============================================================ */

      const safeText = (value, fallback = "-") => {
        if (
          value === null ||
          value === undefined ||
          String(value).trim() === ""
        ) {
          return fallback;
        }

        return String(value).trim();
      };

      const toNumber = (value, fallback = 0) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
      };

      const hasNumericValue = (value) =>
        value !== null &&
        value !== undefined &&
        value !== "" &&
        Number.isFinite(Number(value));

      const formatNumber = (value, maximumDecimals = 2) =>
        toNumber(value).toLocaleString("en-IN", {
          minimumFractionDigits: 0,
          maximumFractionDigits: maximumDecimals,
        });

      const formatPercentage = (value) => `${formatNumber(value, 2)}%`;

      const sanitizeFilename = (value, fallback = "REPORT") => {
        const cleaned = safeText(value, fallback)
          .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
          .replace(/\s+/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");

        return cleaned || fallback;
      };

      const uniqueParts = (values) => [
        ...new Set(values.map((value) => safeText(value, "")).filter(Boolean)),
      ];

      const formatDate = (value) => {
        if (!value || value === "-") return "-";

        let date;

        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          const [year, month, day] = value.split("-").map(Number);

          date = new Date(year, month - 1, day);
        } else {
          date = new Date(value);
        }

        if (Number.isNaN(date.getTime())) {
          return safeText(value);
        }

        return date.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      };

      const fitFontSize = ({
        text,
        maxWidth,
        startSize,
        minSize = 6,
        fontStyle = "normal",
      }) => {
        let fontSize = startSize;

        doc.setFont("helvetica", fontStyle);
        doc.setFontSize(fontSize);

        while (
          fontSize > minSize &&
          doc.getTextWidth(String(text)) > maxWidth
        ) {
          fontSize -= 0.5;
          doc.setFontSize(fontSize);
        }

        return fontSize;
      };

      /* ============================================================
       IMAGE HELPERS
    ============================================================ */

      const convertImageToDataUrl = async (source) => {
        if (!source) return null;

        if (typeof source !== "string") {
          return source;
        }

        if (source.startsWith("data:image/")) {
          return source;
        }

        try {
          const response = await fetch(source, {
            mode: "cors",
            credentials: "omit",
          });

          if (!response.ok) {
            throw new Error(
              `Image request failed with status ${response.status}`,
            );
          }

          const blob = await response.blob();

          return await new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.warn("PDF image could not be loaded:", source, error);

          return null;
        }
      };

      const getImageFormat = (source) => {
        if (typeof source === "string" && /^data:image\/jpe?g/i.test(source)) {
          return "JPEG";
        }

        if (typeof source === "string" && /^data:image\/webp/i.test(source)) {
          return "WEBP";
        }

        return "PNG";
      };

      const addPdfImage = (source, x, y, width, height) => {
        if (!source) return false;

        try {
          doc.addImage(
            source,
            getImageFormat(source),
            x,
            y,
            width,
            height,
            undefined,
            "FAST",
          );

          return true;
        } catch (error) {
          console.warn("Failed to add PDF image:", error);
          return false;
        }
      };

      /* ============================================================
       SCHOOL AND EXAM INFORMATION
    ============================================================ */

      const datasetSchool = schoolData?.school || schoolData || {};

      const datasetSchoolName =
        datasetSchool.school_name ||
        datasetSchool.schoolName ||
        datasetSchool.name ||
        activeDataset.school_name ||
        activeDataset.schoolName ||
        activeDataset.school_id ||
        "School";

      const datasetSchoolId =
        datasetSchool.school_id ||
        datasetSchool.schoolId ||
        datasetSchool.id ||
        activeDataset.school_id ||
        "SCHOOL";

      const datasetSchoolLogo =
        datasetSchool.logo_url ||
        datasetSchool.logoUrl ||
        datasetSchool.logo ||
        null;

      const affiliation =
        datasetSchool.affiliation ||
        datasetSchool.affiliation_number ||
        datasetSchool.affiliationNumber ||
        "";

      const academicYear =
        datasetSchool.academic_year ||
        datasetSchool.academicYear ||
        activeDataset.academic_year ||
        activeDataset.academicYear ||
        "-";

      const schoolAddress = uniqueParts([
        datasetSchool.address,
        datasetSchool.area,
        datasetSchool.city,
        datasetSchool.district,
        datasetSchool.state,
        datasetSchool.pincode,
      ]).join(", ");

      const examName =
        typeof formatExamName === "function"
          ? formatExamName(activeDataset.exam_pattern)
          : safeText(
              activeDataset.exam_name || activeDataset.exam_pattern,
              "OMR Examination",
            );

      const programName =
        PROGRAM_NAMES?.[activeDataset.program] ||
        activeDataset.program_name ||
        activeDataset.program ||
        "-";

      const examClass = activeDataset.class || activeDataset.exam_class || "-";

      const examSection =
        activeDataset.section || activeDataset.exam_section || "-";

      const examDate = formatDate(activeDataset.exam_date);

      const currentDate = new Date();

      const fileDate = [
        currentDate.getFullYear(),
        String(currentDate.getMonth() + 1).padStart(2, "0"),
        String(currentDate.getDate()).padStart(2, "0"),
      ].join("-");

      const generatedOn = currentDate.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const safeSchoolId = sanitizeFilename(datasetSchoolId, "SCHOOL");

      const safeExamPattern = sanitizeFilename(
        activeDataset.exam_pattern,
        "OMR",
      );

      const safeClass = sanitizeFilename(examClass, "CLASS");

      const reportId = sanitizeFilename(
        `OMR-${safeSchoolId}-${safeExamPattern}-${fileDate}`,
      );

      const [schoolLogoData, spectropyLogoData] = await Promise.all([
        convertImageToDataUrl(datasetSchoolLogo),
        convertImageToDataUrl(spectropyLogo),
      ]);

      const uppercaseSchoolName = safeText(
        datasetSchoolName,
        "SCHOOL",
      ).toUpperCase();

      /* ============================================================
       RESULT CALCULATIONS
    ============================================================ */

      const calculateAverage = (key) => {
        if (!datasetResults.length) return 0;

        return (
          datasetResults.reduce(
            (sum, result) => sum + toNumber(result[key]),
            0,
          ) / datasetResults.length
        );
      };

      const percentages = datasetResults.map((result) =>
        toNumber(result.percentage),
      );

      const totalMarksValues = datasetResults.map((result) =>
        toNumber(result.total_marks),
      );

      const averagePercentage =
        percentages.length > 0
          ? percentages.reduce((sum, value) => sum + value, 0) /
            percentages.length
          : 0;

      const highestPercentage =
        percentages.length > 0 ? Math.max(...percentages) : 0;

      const averageTotalMarks =
        totalMarksValues.length > 0
          ? totalMarksValues.reduce((sum, value) => sum + value, 0) /
            totalMarksValues.length
          : 0;

      const highestTotalMarks =
        totalMarksValues.length > 0 ? Math.max(...totalMarksValues) : 0;

      const averageCorrect = calculateAverage("correct_answers");

      const averageWrong = calculateAverage("wrong_answers");

      const averageUnattempted = calculateAverage("unattempted");

      const resolveMaximumMarks = (result) => {
        const directMaximum =
          result.total_max_marks ??
          result.maximum_marks ??
          result.max_marks ??
          activeDataset.total_max_marks ??
          activeDataset.maximum_marks ??
          activeDataset.max_marks;

        if (hasNumericValue(directMaximum)) {
          return toNumber(directMaximum);
        }

        const totalQuestions =
          result.total_questions ?? activeDataset.total_questions;

        const marksPerQuestion =
          result.marks_per_question ??
          result.positive_marks ??
          activeDataset.marks_per_question ??
          activeDataset.positive_marks;

        if (
          hasNumericValue(totalQuestions) &&
          hasNumericValue(marksPerQuestion)
        ) {
          return toNumber(totalQuestions) * toNumber(marksPerQuestion);
        }

        /*
         * Compatibility fallback for your current dataset.
         * Ideally the backend should provide total_max_marks.
         */
        return toNumber(totalQuestions);
      };

      const maximumMarksValues = datasetResults.map(resolveMaximumMarks);

      const reportMaximumMarks =
        maximumMarksValues.length > 0 ? Math.max(...maximumMarksValues) : 0;

      const getBestRank = (key) => {
        const ranks = datasetResults
          .map((result) => Number(result[key]))
          .filter((rank) => Number.isFinite(rank) && rank > 0);

        return ranks.length ? Math.min(...ranks) : null;
      };

      const bestClassRank = getBestRank("class_rank");

      const bestSchoolRank = getBestRank("school_rank");

      const bestAllIndiaRank = getBestRank("all_schools_rank");

      const displayBestRank = (rank) => (Number.isFinite(rank) ? rank : "-");

      doc.setProperties({
        title: `OMR Exam Result Report - ${datasetSchoolName}`,
        subject: `${examName} result report`,
        author: "SPECTROPY",
        creator: "SPECTROPY Academic Reporting",
        keywords: "school, examination, OMR, results, academic report",
      });

      /* ============================================================
       HEADER HELPERS
    ============================================================ */

      const drawLogoPlaceholder = (x, y, size, label) => {
        doc.setFillColor(...COLORS.paleBlue);
        doc.setDrawColor(...COLORS.border);
        doc.setLineWidth(0.7);

        doc.roundedRect(x, y, size, size, 6, 6, "FD");

        const initials = safeText(label, "S")
          .split(/\s+/)
          .map((word) => word.charAt(0))
          .join("")
          .slice(0, 2)
          .toUpperCase();

        doc.setFont("helvetica", "bold");
        doc.setFontSize(initials.length > 1 ? 12 : 16);
        doc.setTextColor(...COLORS.navy);

        doc.text(initials || "S", x + size / 2, y + size / 2 + 5, {
          align: "center",
        });
      };

      const drawSummaryCard = (
        x,
        y,
        width,
        label,
        value,
        valueColor = COLORS.navy,
      ) => {
        doc.setFillColor(...COLORS.white);
        doc.setDrawColor(...COLORS.border);
        doc.setLineWidth(0.6);

        doc.roundedRect(x, y, width, HEADER_LAYOUT.summaryHeight, 5, 5, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
        doc.setTextColor(...COLORS.muted);

        doc.text(label, x + 10, y + 13);

        const valueText = safeText(value, "0");

        const valueFontSize = fitFontSize({
          text: valueText,
          maxWidth: width - 20,
          startSize: 13,
          minSize: 7,
          fontStyle: "bold",
        });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(valueFontSize);
        doc.setTextColor(...valueColor);

        doc.text(valueText, x + 10, y + 31);
      };

      /* ============================================================
       POWERED BY SPECTROPY BRANDING
    ============================================================ */

      const drawPoweredBySpectropy = ({ compact = false } = {}) => {
        if (compact) {
          const blockWidth = 108;
          const blockRight = pageWidth - marginX;
          const blockLeft = blockRight - blockWidth;
          const logoSize = 17;

          const logoAdded = addPdfImage(
            spectropyLogoData,
            blockLeft,
            16,
            logoSize,
            logoSize,
          );

          if (!logoAdded) {
            doc.setFillColor(...COLORS.navy);

            doc.circle(
              blockLeft + logoSize / 2,
              16 + logoSize / 2,
              logoSize / 2,
              "F",
            );

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6);
            doc.setTextColor(...COLORS.white);

            doc.text("S", blockLeft + logoSize / 2, 27, {
              align: "center",
            });
          }

          const textX = blockLeft + logoSize + 7;

          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.4);
          doc.setTextColor(...COLORS.muted);

          doc.text("POWERED BY", textX, 21);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.2);
          doc.setTextColor(...COLORS.navy);

          doc.text("SPECTROPY", textX, 32);

          return;
        }

        const blockWidth = 122;
        const blockHeight = 44;
        const blockRight = pageWidth - marginX;
        const blockLeft = blockRight - blockWidth;
        const blockTop = 17;

        /*
         * Visual separator between school identity
         * and Spectropy branding.
         */
        doc.setDrawColor(...COLORS.border);
        doc.setLineWidth(0.6);

        doc.line(
          blockLeft - 12,
          blockTop + 2,
          blockLeft - 12,
          blockTop + blockHeight - 2,
        );

        const logoSize = 27;

        const logoAdded = addPdfImage(
          spectropyLogoData,
          blockLeft,
          blockTop + 8,
          logoSize,
          logoSize,
        );

        if (!logoAdded) {
          doc.setFillColor(...COLORS.navy);

          doc.circle(
            blockLeft + logoSize / 2,
            blockTop + 8 + logoSize / 2,
            logoSize / 2,
            "F",
          );

          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(...COLORS.white);

          doc.text("S", blockLeft + logoSize / 2, blockTop + 25, {
            align: "center",
          });
        }

        const textX = blockLeft + logoSize + 9;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);
        doc.setTextColor(...COLORS.muted);

        doc.text("POWERED BY", textX, blockTop + 15);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.navy);

        doc.text("SPECTROPY", textX, blockTop + 31);
      };

      /* ============================================================
       FIRST PAGE HEADER
    ============================================================ */

      const drawFirstPageHeader = () => {
        /*
         * Top navy accent
         */
        doc.setFillColor(...COLORS.navy);
        doc.rect(0, 0, pageWidth, 6, "F");

        /*
         * School logo container
         */
        const logoX = marginX;
        const logoY = 14;
        const logoContainerSize = 50;
        const logoImageSize = 40;

        doc.setFillColor(...COLORS.white);
        doc.setDrawColor(...COLORS.border);
        doc.setLineWidth(0.7);

        doc.roundedRect(
          logoX,
          logoY,
          logoContainerSize,
          logoContainerSize,
          6,
          6,
          "FD",
        );

        const schoolLogoAdded = addPdfImage(
          schoolLogoData,
          logoX + 5,
          logoY + 5,
          logoImageSize,
          logoImageSize,
        );

        if (!schoolLogoAdded) {
          drawLogoPlaceholder(
            logoX,
            logoY,
            logoContainerSize,
            datasetSchoolName,
          );
        }

        /*
         * Equal space is reserved on both sides,
         * keeping the school heading centred on the page.
         */
        const sideReservedWidth = 138;

        const schoolHeadingWidth =
          pageWidth - (marginX + sideReservedWidth) * 2;

        let schoolNameFontSize = 16.5;
        let schoolNameLines = [];

        do {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(schoolNameFontSize);

          schoolNameLines = doc.splitTextToSize(
            uppercaseSchoolName,
            schoolHeadingWidth,
          );

          if (schoolNameLines.length > 2) {
            schoolNameFontSize -= 0.5;
          }
        } while (schoolNameLines.length > 2 && schoolNameFontSize > 9);

        const schoolNameY = schoolNameLines.length === 1 ? 31 : 23;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(schoolNameFontSize);
        doc.setTextColor(...COLORS.navy);

        doc.text(schoolNameLines, pageWidth / 2, schoolNameY, {
          align: "center",
          lineHeightFactor: 1.05,
        });

        const addressY = schoolNameLines.length === 1 ? 47 : 51;

        if (schoolAddress) {
          const addressFontSize = fitFontSize({
            text: schoolAddress,
            maxWidth: schoolHeadingWidth,
            startSize: 7.6,
            minSize: 5.8,
            fontStyle: "normal",
          });

          doc.setFont("helvetica", "normal");
          doc.setFontSize(addressFontSize);
          doc.setTextColor(...COLORS.muted);

          doc.text(schoolAddress, pageWidth / 2, addressY, {
            align: "center",
          });
        }

        const institutionDetails = [
          affiliation ? `Affiliation: ${affiliation}` : "",

          academicYear !== "-" ? `Academic Year: ${academicYear}` : "",
        ]
          .filter(Boolean)
          .join("   |   ");

        if (institutionDetails) {
          const institutionY = schoolAddress
            ? addressY + 13
            : schoolNameLines.length === 1
              ? 51
              : 58;

          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.7);
          doc.setTextColor(...COLORS.muted);

          doc.text(institutionDetails, pageWidth / 2, institutionY, {
            align: "center",
          });
        }

        /*
         * Platform branding block
         */
        drawPoweredBySpectropy();

        /*
         * Report title band
         */
        doc.setFillColor(...COLORS.navy);

        doc.rect(
          0,
          HEADER_LAYOUT.titleBandY,
          pageWidth,
          HEADER_LAYOUT.titleBandHeight,
          "F",
        );

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14.5);
        doc.setTextColor(...COLORS.white);

        doc.text(
          "OMR EXAM RESULT REPORT",
          pageWidth / 2,
          HEADER_LAYOUT.titleBandY + 17,
          {
            align: "center",
          },
        );

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.8);
        doc.setTextColor(220, 230, 244);

        doc.text(examName, pageWidth / 2, HEADER_LAYOUT.titleBandY + 31, {
          align: "center",
        });

        /*
         * Examination metadata
         */
        const metaY = HEADER_LAYOUT.metadataY;
        const metaHeight = HEADER_LAYOUT.metadataHeight;

        doc.setFillColor(...COLORS.paleBlue);
        doc.setDrawColor(...COLORS.border);
        doc.setLineWidth(0.6);

        doc.roundedRect(marginX, metaY, contentWidth, metaHeight, 5, 5, "FD");

        const metadata = [
          {
            label: "EXAMINATION",
            value: examName,
          },
          {
            label: "PROGRAM",
            value: programName,
          },
          {
            label: "CLASS / SECTION",
            value: `${examClass} / ${examSection}`,
          },
          {
            label: "EXAM DATE",
            value: examDate,
          },
          {
            label: "MAXIMUM MARKS",
            value:
              reportMaximumMarks > 0 ? formatNumber(reportMaximumMarks) : "-",
          },
        ];

        const metaWidth = contentWidth / metadata.length;

        metadata.forEach((item, index) => {
          const x = marginX + index * metaWidth;

          if (index > 0) {
            doc.setDrawColor(...COLORS.border);

            doc.line(x, metaY + 7, x, metaY + metaHeight - 7);
          }

          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.1);
          doc.setTextColor(...COLORS.muted);

          doc.text(item.label, x + 10, metaY + 14);

          const value = safeText(item.value);

          const valueFontSize = fitFontSize({
            text: value,
            maxWidth: metaWidth - 20,
            startSize: 8.8,
            minSize: 6,
            fontStyle: "bold",
          });

          doc.setFont("helvetica", "bold");
          doc.setFontSize(valueFontSize);
          doc.setTextColor(...COLORS.navy);

          doc.text(value, x + 10, metaY + 32);
        });

        /*
         * Performance summary cards
         */
        const summaryY = HEADER_LAYOUT.summaryY;
        const cardGap = 8;

        const cardWidth = (contentWidth - cardGap * 3) / 4;

        drawSummaryCard(
          marginX,
          summaryY,
          cardWidth,
          "TOTAL STUDENTS",
          datasetResults.length,
        );

        drawSummaryCard(
          marginX + cardWidth + cardGap,
          summaryY,
          cardWidth,
          "AVERAGE PERCENTAGE",
          formatPercentage(averagePercentage),
        );

        drawSummaryCard(
          marginX + (cardWidth + cardGap) * 2,
          summaryY,
          cardWidth,
          "HIGHEST PERCENTAGE",
          formatPercentage(highestPercentage),
          COLORS.green,
        );

        drawSummaryCard(
          marginX + (cardWidth + cardGap) * 3,
          summaryY,
          cardWidth,
          "HIGHEST TOTAL MARKS",
          formatNumber(highestTotalMarks),
        );
      };

      /* ============================================================
       CONTINUATION PAGE HEADER
    ============================================================ */

      const drawAdditionalPageHeader = () => {
        doc.setFillColor(...COLORS.navy);
        doc.rect(0, 0, pageWidth, 5, "F");

        /*
         * School identity on the left
         */
        const schoolNameWidth = 250;

        const schoolNameFontSize = fitFontSize({
          text: uppercaseSchoolName,
          maxWidth: schoolNameWidth,
          startSize: 9.5,
          minSize: 6.5,
          fontStyle: "bold",
        });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(schoolNameFontSize);
        doc.setTextColor(...COLORS.navy);

        doc.text(uppercaseSchoolName, marginX, 23);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...COLORS.muted);

        doc.text(
          `${examName}  |  Class ${examClass} / ${examSection}`,
          marginX,
          37,
        );

        /*
         * Report title remains in the true page centre
         */
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.2);
        doc.setTextColor(...COLORS.navy);

        doc.text("OMR EXAM RESULT REPORT", pageWidth / 2, 27, {
          align: "center",
        });

        /*
         * Compact platform branding
         */
        drawPoweredBySpectropy({
          compact: true,
        });

        doc.setDrawColor(...COLORS.border);
        doc.setLineWidth(0.5);

        doc.line(marginX, 49, pageWidth - marginX, 49);
      };

      /* ============================================================
       TABLE HEADERS AND DATA
    ============================================================ */

      const headers = [
        "Student ID",
        "Student Name",
        "Max Marks",
        "Correct",
        "Wrong",
        "Unattempted",
        "Physics",
        "Chemistry",
        "Maths",
        "Biology",
        "Total",
        "Percentage",
        "Class Rank",
        "School Rank",
        "All India Rank",
      ];

      const groupedHeaders = [
        [
          {
            content: "STUDENT DETAILS",
            colSpan: 2,
            styles: {
              fillColor: COLORS.royalBlue,
              textColor: COLORS.white,
              halign: "center",
              fontStyle: "bold",
            },
          },
          {
            content: "QUESTION ANALYSIS",
            colSpan: 4,
            styles: {
              fillColor: COLORS.royalBlue,
              textColor: COLORS.white,
              halign: "center",
              fontStyle: "bold",
            },
          },
          {
            content: "SUBJECT-WISE MARKS",
            colSpan: 4,
            styles: {
              fillColor: COLORS.royalBlue,
              textColor: COLORS.white,
              halign: "center",
              fontStyle: "bold",
            },
          },
          {
            content: "OVERALL PERFORMANCE",
            colSpan: 2,
            styles: {
              fillColor: COLORS.royalBlue,
              textColor: COLORS.white,
              halign: "center",
              fontStyle: "bold",
            },
          },
          {
            content: "RANKINGS",
            colSpan: 3,
            styles: {
              fillColor: COLORS.royalBlue,
              textColor: COLORS.white,
              halign: "center",
              fontStyle: "bold",
            },
          },
        ],
        headers,
      ];

      const body = datasetResults.map((result) => {
        const studentName = [result.first_name, result.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();

        return [
          safeText(result.student_id),
          safeText(studentName),
          formatNumber(resolveMaximumMarks(result)),
          formatNumber(result.correct_answers),
          formatNumber(result.wrong_answers),
          formatNumber(result.unattempted),
          formatNumber(result.physics_marks),
          formatNumber(result.chemistry_marks),
          formatNumber(result.maths_marks),
          formatNumber(result.biology_marks),
          formatNumber(result.total_marks),
          formatPercentage(result.percentage),
          safeText(result.class_rank),
          safeText(result.school_rank),
          safeText(result.all_schools_rank),
        ];
      });

      /* ============================================================
       TABLE SUMMARY FOOTER
    ============================================================ */

      const summaryFooter = [
        [
          {
            content: `STUDENTS\n${datasetResults.length}`,
            colSpan: 2,
            styles: {
              halign: "center",
            },
          },
          {
            content: `AVG. CORRECT\n${formatNumber(averageCorrect, 1)}`,
            colSpan: 2,
            styles: {
              halign: "center",
            },
          },
          {
            content:
              `AVG. WRONG / UNATTEMPTED\n` +
              `${formatNumber(averageWrong, 1)} / ` +
              `${formatNumber(averageUnattempted, 1)}`,
            colSpan: 2,
            styles: {
              halign: "center",
            },
          },
          {
            content:
              `AVERAGE TOTAL MARKS\n` + `${formatNumber(averageTotalMarks, 2)}`,
            colSpan: 4,
            styles: {
              halign: "center",
            },
          },
          {
            content: `HIGHEST\n${formatNumber(highestTotalMarks)}`,
            styles: {
              halign: "center",
            },
          },
          {
            content: `AVG. %\n${formatPercentage(averagePercentage)}`,
            styles: {
              halign: "center",
            },
          },
          {
            content:
              `BEST RANKS\n` +
              `C: ${displayBestRank(bestClassRank)} | ` +
              `S: ${displayBestRank(bestSchoolRank)} | ` +
              `AIR: ${displayBestRank(bestAllIndiaRank)}`,
            colSpan: 3,
            styles: {
              halign: "center",
            },
          },
        ],
      ];

      /* ============================================================
       FULL-WIDTH COLUMN CALCULATION
    ============================================================ */

      /*
       * Relative weights are converted into exact widths.
       * Their total always equals contentWidth.
       */
      const columnWeights = [
        1.05, // Student ID
        2.25, // Student Name
        1.15, // Max Marks
        0.9, // Correct
        0.9, // Wrong
        1.15, // Unattempted
        1, // Physics
        1.2, // Chemistry
        1, // Maths
        1, // Biology
        1.15, // Total
        1.25, // Percentage
        1, // Class Rank
        1, // School Rank
        1.1, // AIR
      ];

      const totalColumnWeight = columnWeights.reduce(
        (sum, weight) => sum + weight,
        0,
      );

      const fullWidthColumnStyles = Object.fromEntries(
        columnWeights.map((weight, index) => [
          index,
          {
            cellWidth: (weight / totalColumnWeight) * contentWidth,

            halign: index === 1 ? "left" : "center",
          },
        ]),
      );

      /* ============================================================
       FULL-WIDTH RESULTS TABLE
    ============================================================ */

      autoTable(doc, {
        startY: HEADER_LAYOUT.tableStartY,

        head: groupedHeaders,
        body,
        foot: summaryFooter,

        theme: "grid",
        tableWidth: contentWidth,

        margin: {
          top: 62,
          right: marginX,
          bottom: 42,
          left: marginX,
        },

        styles: {
          font: "helvetica",
          fontSize: 7.1,
          textColor: COLORS.text,

          cellPadding: {
            top: 4.5,
            right: 3,
            bottom: 4.5,
            left: 3,
          },

          lineColor: COLORS.border,
          lineWidth: 0.35,

          valign: "middle",
          halign: "center",

          overflow: "linebreak",
          minCellHeight: 25,
        },

        headStyles: {
          fillColor: COLORS.navy,
          textColor: COLORS.white,
          fontStyle: "bold",
          fontSize: 6.8,
          halign: "center",
          valign: "middle",
          minCellHeight: 27,
          lineColor: COLORS.white,
          lineWidth: 0.2,
        },

        footStyles: {
          fillColor: COLORS.navy,
          textColor: COLORS.white,
          fontStyle: "bold",
          fontSize: 6.5,
          valign: "middle",
          minCellHeight: 34,
          lineColor: COLORS.white,
          lineWidth: 0.2,
        },

        alternateRowStyles: {
          fillColor: COLORS.paleBlue,
        },

        columnStyles: fullWidthColumnStyles,

        showHead: "everyPage",
        showFoot: "lastPage",
        rowPageBreak: "avoid",
        horizontalPageBreak: false,

        didParseCell: (data) => {
          if (data.section !== "body") return;

          const columnIndex = data.column.index;

          /*
           * Student name
           */
          if (columnIndex === 1) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = COLORS.navy;
            data.cell.styles.halign = "left";
          }

          /*
           * Correct answers
           */
          if (columnIndex === 3) {
            data.cell.styles.textColor = COLORS.green;
            data.cell.styles.fontStyle = "bold";
          }

          /*
           * Wrong answers
           */
          if (columnIndex === 4) {
            const wrongAnswers = Number(data.cell.raw);

            if (Number.isFinite(wrongAnswers) && wrongAnswers > 0) {
              data.cell.styles.textColor = COLORS.red;
            }
          }

          /*
           * Unattempted questions
           */
          if (columnIndex === 5) {
            const unattempted = Number(data.cell.raw);

            if (Number.isFinite(unattempted) && unattempted > 0) {
              data.cell.styles.textColor = COLORS.amber;
            }
          }

          /*
           * Subject marks
           */
          if ([6, 7, 8, 9].includes(columnIndex)) {
            data.cell.styles.fontStyle = "bold";
          }

          /*
           * Total marks
           */
          if (columnIndex === 10) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = COLORS.softBlue;
            data.cell.styles.textColor = COLORS.navy;
          }

          /*
           * Percentage
           */
          if (columnIndex === 11) {
            const percentage = Number(
              String(data.cell.raw || "")
                .replace("%", "")
                .trim(),
            );

            data.cell.styles.fontStyle = "bold";

            /*
             * Extra bottom padding makes room
             * for the percentage progress bar.
             */
            data.cell.styles.cellPadding = {
              top: 4,
              right: 3,
              bottom: 9,
              left: 3,
            };

            if (Number.isFinite(percentage)) {
              if (percentage >= 75) {
                data.cell.styles.textColor = COLORS.green;
              } else if (percentage >= 40) {
                data.cell.styles.textColor = COLORS.amber;
              } else {
                data.cell.styles.textColor = COLORS.red;
              }
            }
          }

          /*
           * Rank columns
           */
          if ([12, 13, 14].includes(columnIndex)) {
            data.cell.styles.fontStyle = "bold";

            const rank = Number(data.cell.raw);

            if (Number.isFinite(rank) && rank >= 1 && rank <= 3) {
              data.cell.styles.fillColor = COLORS.softBlue;

              data.cell.styles.textColor = COLORS.royalBlue;
            }
          }
        },

        didDrawCell: (data) => {
          /*
           * Percentage progress bar
           */
          if (data.section === "body" && data.column.index === 11) {
            const percentage = Number(
              String(data.cell.raw || "")
                .replace("%", "")
                .trim(),
            );

            if (!Number.isFinite(percentage)) return;

            const normalizedPercentage = Math.max(0, Math.min(100, percentage));

            const trackX = data.cell.x + 4;

            const trackY = data.cell.y + data.cell.height - 6;

            const trackWidth = data.cell.width - 8;

            const trackHeight = 2.5;

            doc.setFillColor(...COLORS.lightGrey);

            doc.roundedRect(trackX, trackY, trackWidth, trackHeight, 1, 1, "F");

            if (percentage >= 75) {
              doc.setFillColor(...COLORS.green);
            } else if (percentage >= 40) {
              doc.setFillColor(...COLORS.amber);
            } else {
              doc.setFillColor(...COLORS.red);
            }

            const progressWidth = trackWidth * (normalizedPercentage / 100);

            if (progressWidth > 0) {
              doc.roundedRect(
                trackX,
                trackY,
                progressWidth,
                trackHeight,
                1,
                1,
                "F",
              );
            }
          }

          /*
           * Top-three rank badge
           */
          if (
            data.section === "body" &&
            [12, 13, 14].includes(data.column.index)
          ) {
            const rank = Number(data.cell.raw);

            if (Number.isFinite(rank) && rank >= 1 && rank <= 3) {
              const badgeX = data.cell.x + data.cell.width - 8;

              const badgeY = data.cell.y + 8;

              doc.setFillColor(...COLORS.royalBlue);

              doc.circle(badgeX, badgeY, 5, "F");

              doc.setFont("helvetica", "bold");
              doc.setFontSize(5.5);
              doc.setTextColor(...COLORS.white);

              doc.text(String(rank), badgeX, badgeY + 2, {
                align: "center",
              });
            }
          }
        },

        willDrawPage: (data) => {
          if (data.pageNumber === 1) {
            drawFirstPageHeader();
          } else {
            drawAdditionalPageHeader();
          }
        },
      });

      /* ============================================================
       FOOTER ON EVERY PAGE
    ============================================================ */

      const totalPages = doc.getNumberOfPages();

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        doc.setPage(pageNumber);

        const footerY = pageHeight - 18;

        doc.setDrawColor(...COLORS.border);
        doc.setLineWidth(0.5);

        doc.line(marginX, footerY - 10, pageWidth - marginX, footerY - 10);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.7);
        doc.setTextColor(...COLORS.muted);

        doc.text(`Report ID: ${reportId}`, marginX, footerY);

        doc.text(`Generated on ${generatedOn}`, pageWidth / 2, footerY, {
          align: "center",
        });

        doc.text(
          `Page ${pageNumber} of ${totalPages}`,
          pageWidth - marginX,
          footerY,
          {
            align: "right",
          },
        );
      }

      /* ============================================================
       SAVE PDF
    ============================================================ */

      doc.save(
        `OMR_RESULT_${safeSchoolId}_${safeClass}_${safeExamPattern}_${fileDate}.pdf`,
      );
    } catch (error) {
      console.error("Dataset PDF generation error:", error);

      alert("Failed to generate the examination report. Please try again.");
    }
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

  if (mode === "new" && !activeDataset) {
    return (
      <div className="omr-page omr-page--upload">
        <div className="page-header omr-page-header">
          <div className="page-header-left">
            <h1 className="page-header-title">Register & Upload Exam</h1>
            <p className="page-header-subtitle">
              Submit exam details and the OMR result file in one step.
            </p>
          </div>
          <div className="omr-upload-header-search">{renderSchoolSearch()}</div>
        </div>

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
                    <div className="omr-exam-combo">
                      <input
                        className="form-input"
                        name="examPattern"
                        value={examForm.examPattern}
                        onChange={(event) => {
                          handleFormChange(event);
                          setExamDropdownOpen(true);
                        }}
                        onFocus={() => setExamDropdownOpen(true)}
                        onBlur={() =>
                          setTimeout(() => setExamDropdownOpen(false), 120)
                        }
                        placeholder="Select or type exam name"
                        autoComplete="off"
                        required
                      />
                      <button
                        type="button"
                        className="omr-exam-combo-toggle"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() =>
                          setExamDropdownOpen((isOpen) => !isOpen)
                        }
                        aria-label="Show exam options"
                      >
                        <ChevronDown size={16} />
                      </button>
                      {examDropdownOpen && (
                        <div className="omr-exam-dropdown">
                          {filteredExamOptions.length > 0 ? (
                            filteredExamOptions.map((exam) => (
                              <button
                                type="button"
                                key={exam.id}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => selectExamOption(exam)}
                              >
                                {exam.display_name}
                              </button>
                            ))
                          ) : (
                            <div className="omr-exam-dropdown-empty">
                              Use typed exam name
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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
                <button
                  className="omr-secondary-btn"
                  type="button"
                  onClick={() => navigate("/admin/exams")}
                >
                  Cancel
                </button>
                <button
                  className="btn-link-primary"
                  type="submit"
                  disabled={uploading}
                >
                  <UploadCloud size={18} />
                  {uploading ? "Uploading..." : "Register & Upload"}
                </button>
              </section>
            </form>
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

        {datasetResultsError && (
          <div
            className="alert-banner alert-banner--error"
            style={{ margin: "16px 32px" }}
          >
            {datasetResultsError}
          </div>
        )}

        {datasetResultsLoading && (
          <div className="alert-banner alert-banner--info">
            Loading student results...
          </div>
        )}

        {datasetResults.length > 0 && (
          <ResultsTable
            results={datasetResults}
            onDownload={downloadDatasetPDF}
          />
        )}
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
        <button
          className="btn-link-primary omr-toolbar-register-btn"
          onClick={() => navigate("/admin/exams/new")}
        >
          <Plus size={16} />
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
        <>
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
                    <td data-label="Exam">
                      {formatExamName(exam.exam_pattern)}
                    </td>
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

          <div className="omr-exam-cards-mobile">
            {datasets.map((exam) => (
              <article
                className="omr-exam-card-mobile"
                key={exam.key}
                onClick={() => openDataset(exam)}
              >
                <div className="omr-exam-card-mobile__top">
                  <div>
                    <h3>{formatExamName(exam.exam_pattern)}</h3>
                    <p>{PROGRAM_NAMES[exam.program] || exam.program}</p>
                  </div>
                  <span>{exam.student_count || 0} Students</span>
                </div>

                <div className="omr-exam-card-mobile__meta">
                  <span>
                    <strong>Class</strong>
                    {exam.class || "-"}
                  </span>
                  <span>
                    <strong>Section</strong>
                    {exam.section || "-"}
                  </span>
                  <span>
                    <strong>Date</strong>
                    {exam.exam_date || "-"}
                  </span>
                </div>

                <div className="omr-exam-card-mobile__actions">
                  <button
                    className="btn-link-primary"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openDataset(exam);
                    }}
                  >
                    View Results
                  </button>
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
                </div>
              </article>
            ))}
          </div>
        </>
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
  const [searchTerm, setSearchTerm] = useState("");
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleResults = [...results]
    .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
    .filter((row) => {
      if (!normalizedSearch) return true;
      return [
        row.student_id,
        row.first_name,
        row.last_name,
        row.total_marks,
        row.percentage,
        row.class_rank,
        row.school_rank,
        row.all_schools_rank,
      ]
        .filter((value) => value != null)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });

  return (
    <div className="omr-results">
      <div className="table-toolbar omr-results-toolbar">
        <div className="table-search-wrap omr-results-search">
          <Search size={16} />
          <input
            className="table-search-input"
            type="text"
            placeholder="Search student ID, name, rank..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          {searchTerm && (
            <button
              className="table-search-clear"
              type="button"
              onClick={() => setSearchTerm("")}
              aria-label="Clear result search"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <span className="omr-results-count">
          Showing {visibleResults.length} of {results.length} students
        </span>
        {onDownload && (
          <button
            className={`btn-report btn-report--pdf omr-results-pdf ${!results.length ? "disabled" : ""}`}
            onClick={onDownload}
            disabled={!results.length}
            title="Download exam results as PDF"
          >
            PDF Report
          </button>
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
            {visibleResults.map((row, index) => (
              <tr key={`${row.student_id || "row"}-${index}`}>
                <td data-label="Student ID">{row.student_id || "-"}</td>
                <td data-label="Name">
                  {`${row.first_name || ""} ${row.last_name || ""}`.trim() ||
                    "-"}
                </td>
                <td data-label="Total Max Marks">{row.total_questions || 0}</td>
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
            {visibleResults.length === 0 && (
              <tr>
                <td colSpan={15}>
                  <div className="table-empty-state">
                    <h3 className="table-empty-title">No results found</h3>
                    <p className="table-empty-body">
                      Try adjusting your search query.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
