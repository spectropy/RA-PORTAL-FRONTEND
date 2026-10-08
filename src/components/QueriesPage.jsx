// src/components/QueriesPage.jsx
import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { getPrograms } from "../api.js"; // Keep this if you still need initial program list
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

export default function QueriesPage({ activeQueryType = "school" }) {
  const [programs, setPrograms] = useState([]);
  const [examPatterns, setExamPatterns] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [schools, setSchools] = useState([]);
  const [classSections, setClassSections] = useState([]);
  const [schoolListClasses, setSchoolListClasses] = useState([]);

  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedExamPattern, setSelectedExamPattern] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedClassSection, setSelectedClassSection] = useState("");

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [schoolView, setSchoolView] = useState("dashboard");
  const [schoolListRows, setSchoolListRows] = useState([]);
  const [schoolListLoading, setSchoolListLoading] = useState(false);
  const [schoolListError, setSchoolListError] = useState("");
  const [teacherView, setTeacherView] = useState("dashboard");
  const [teacherListRows, setTeacherListRows] = useState([]);
  const [teacherListLoading, setTeacherListLoading] = useState(false);
  const [teacherListError, setTeacherListError] = useState("");
  const [studentView, setStudentView] = useState("dashboard");
  const [studentListRows, setStudentListRows] = useState([]);
  const [studentListLoading, setStudentListLoading] = useState(false);
  const [studentListError, setStudentListError] = useState("");

  // Load programs on mount (assuming /api/programs returns list of program IDs)
  useEffect(() => {
    getPrograms()
      .then((data) => setPrograms(data.map((p) => p.id)))
      .catch((err) => setError("Failed to load programs"));
  }, []);

  // 🔁 Unified data fetch: exam patterns, schools, and stats in one call
  useEffect(() => {
    if (!["school", "teacher", "student"].includes(activeQueryType)) {
      return;
    }
    if (activeQueryType === "teacher" && teacherView === "list") {
      return;
    }
    if (activeQueryType === "student" && studentView === "list") {
      return;
    }
    if (activeQueryType === "school" && schoolView === "list") {
      return;
    }

    if (!selectedProgram && !["school", "teacher", "student"].includes(activeQueryType)) {
      setExamPatterns([]);
      setSubjects([]);
      setSchools([]);
      setClassSections([]);
      setStats(null);
      return;
    }

    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (selectedProgram) params.append("program", selectedProgram);
    if (activeQueryType === "school" && selectedExamPattern) {
      params.append("exam_pattern", selectedExamPattern);
    }
    if (activeQueryType === "teacher" && selectedSubject) {
      params.append("subject", selectedSubject);
    }
    if (selectedSchool) params.append("school", selectedSchool);
    if (activeQueryType === "student" && selectedClassSection) {
      params.append("class", selectedClassSection);
    }

    // ✅ Use async IIFE inside useEffect
    (async () => {
      try {
        const endpoint =
          activeQueryType === "teacher"
            ? "teachers"
            : activeQueryType === "student"
              ? "students"
              : "dashboard";
        const res = await fetch(`${API_BASE}/api/queries/${endpoint}?${params}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json(); // This will fail if response is HTML
        console.log("📥 API Response received:", data);
        setExamPatterns(data.examPatterns || []);
        setSubjects(data.subjects || []);
        setSchools(data.schools || []);
        setClassSections(data.classes || data.classSections || []);
        setStats(
          activeQueryType === "teacher"
            ? data.teachers || []
            : activeQueryType === "student"
              ? data.students || []
              : data.stats,
        );
      } catch (err) {
        console.error("Fetch error:", err);
        setError(err.message || "Failed to load dashboard data");
        setExamPatterns([]);
        setSubjects([]);
        setSchools([]);
        setClassSections([]);
        setStats(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [
    activeQueryType,
    schoolView,
    teacherView,
    studentView,
    selectedProgram,
    selectedExamPattern,
    selectedSubject,
    selectedSchool,
    selectedClassSection,
  ]);

  // ✅ Reset school when exam pattern changes
  useEffect(() => {
    if (activeQueryType === "school") {
      setSelectedSchool("");
    }
  }, [activeQueryType, selectedExamPattern]);

  useEffect(() => {
    if (activeQueryType === "teacher" && teacherView === "dashboard") return;
  }, [activeQueryType, teacherView, selectedSubject]);

  useEffect(() => {
    setSelectedClassSection("");
  }, [selectedSchool, activeQueryType]);

  useEffect(() => {
    if (activeQueryType !== "school") {
      setSchoolView("dashboard");
    }
    if (activeQueryType !== "teacher") {
      setTeacherView("dashboard");
    }
    if (activeQueryType !== "student") {
      setStudentView("dashboard");
    }
  }, [activeQueryType]);

  useEffect(() => {
    const isListView =
      (activeQueryType === "school" && schoolView === "list") ||
      (activeQueryType === "teacher" && teacherView === "list") ||
      (activeQueryType === "student" && studentView === "list");

    if (!isListView) return;

    const filterType =
      activeQueryType === "school"
        ? "schools"
        : activeQueryType === "teacher"
          ? "teachers"
          : "students";

    (async () => {
      try {
        const data = await fetchJson(
          `${API_BASE}/api/queries/${filterType}/filters`,
        );

        if (data.programs?.length) {
          setPrograms((currentPrograms) => {
            const merged = new Set([...currentPrograms, ...data.programs]);
            return [...merged].sort();
          });
        }

        setSchools(data.schools || []);
        setExamPatterns(data.exams || []);

        if (activeQueryType === "school") {
          setSchoolListClasses(data.classes || []);
        } else {
          setClassSections(data.classes || data.classSections || []);
        }

        if (activeQueryType === "teacher") {
          setSubjects(data.subjects || []);
        }
      } catch (err) {
        console.error("Performance filters fetch error:", err);
      }
    })();
  }, [activeQueryType, schoolView, teacherView, studentView]);

  useEffect(() => {
    if (activeQueryType !== "school" || schoolView !== "list") return;

    const params = new URLSearchParams();
    if (selectedProgram) params.append("program", selectedProgram);
    if (selectedSchool) params.append("school", selectedSchool);
    if (selectedClassSection) params.append("class", selectedClassSection);
    if (selectedExamPattern) params.append("exam", selectedExamPattern);

    setSchoolListLoading(true);
    setSchoolListError("");

    (async () => {
      try {
        const data = await fetchJson(
          `${API_BASE}/api/queries/schools/list?${params}`,
        );
        if (!selectedProgram && data.programs?.length) {
          setPrograms((currentPrograms) => {
            const merged = new Set([...currentPrograms, ...data.programs]);
            return [...merged].sort();
          });
        }
        if (data.schools) setSchools(data.schools);
        if (data.classes) setSchoolListClasses(data.classes);
        if (data.exams) setExamPatterns(data.exams);
        setSchoolListRows(data.schoolsPerformance || []);
      } catch (err) {
        console.error("School list fetch error:", err);
        setSchoolListError(err.message || "Failed to load school list");
        setSchoolListRows([]);
      } finally {
        setSchoolListLoading(false);
      }
    })();
  }, [
    activeQueryType,
    schoolView,
    selectedProgram,
    selectedSchool,
    selectedClassSection,
    selectedExamPattern,
  ]);

  const resetSchoolListFilters = () => {
    setSelectedProgram("");
    setSelectedSchool("");
    setSelectedClassSection("");
    setSelectedExamPattern("");
  };

  useEffect(() => {
    if (activeQueryType !== "teacher" || teacherView !== "list") return;

    const params = new URLSearchParams();
    if (selectedProgram) params.append("program", selectedProgram);
    if (selectedSchool) params.append("school", selectedSchool);
    if (selectedClassSection) params.append("class", selectedClassSection);
    if (selectedExamPattern) params.append("exam", selectedExamPattern);
    if (selectedSubject) params.append("subject", selectedSubject);

    setTeacherListLoading(true);
    setTeacherListError("");

    (async () => {
      try {
        const data = await fetchJson(
          `${API_BASE}/api/queries/teachers/list?${params}`,
        );
        if (!selectedProgram && data.programs?.length) {
          setPrograms((currentPrograms) => {
            const merged = new Set([...currentPrograms, ...data.programs]);
            return [...merged].sort();
          });
        }
        setSchools(data.schools || []);
        setClassSections(data.classes || data.classSections || []);
        setExamPatterns(data.exams || []);
        setSubjects(data.subjects || []);
        setTeacherListRows(data.teachers || []);
      } catch (err) {
        console.error("Teacher list fetch error:", err);
        setTeacherListError(err.message || "Failed to load teacher list");
        setTeacherListRows([]);
      } finally {
        setTeacherListLoading(false);
      }
    })();
  }, [
    activeQueryType,
    teacherView,
    selectedProgram,
    selectedSchool,
    selectedClassSection,
    selectedExamPattern,
    selectedSubject,
  ]);

  const resetTeacherListFilters = () => {
    setSelectedProgram("");
    setSelectedSchool("");
    setSelectedClassSection("");
    setSelectedExamPattern("");
    setSelectedSubject("");
  };

  useEffect(() => {
    if (activeQueryType !== "student" || studentView !== "list") return;

    const params = new URLSearchParams();
    if (selectedProgram) params.append("program", selectedProgram);
    if (selectedSchool) params.append("school", selectedSchool);
    if (selectedClassSection) params.append("class", selectedClassSection);
    if (selectedExamPattern) params.append("exam", selectedExamPattern);

    setStudentListLoading(true);
    setStudentListError("");

    (async () => {
      try {
        const data = await fetchJson(
          `${API_BASE}/api/queries/students/list?${params}`,
        );
        if (!selectedProgram && data.programs?.length) {
          setPrograms((currentPrograms) => {
            const merged = new Set([...currentPrograms, ...data.programs]);
            return [...merged].sort();
          });
        }
        setSchools(data.schools || []);
        setClassSections(data.classes || data.classSections || []);
        setExamPatterns(data.exams || []);
        setStudentListRows(data.students || []);
      } catch (err) {
        console.error("Student list fetch error:", err);
        setStudentListError(err.message || "Failed to load student list");
        setStudentListRows([]);
      } finally {
        setStudentListLoading(false);
      }
    })();
  }, [
    activeQueryType,
    studentView,
    selectedProgram,
    selectedSchool,
    selectedClassSection,
    selectedExamPattern,
  ]);

  const resetStudentListFilters = () => {
    setSelectedProgram("");
    setSelectedSchool("");
    setSelectedClassSection("");
    setSelectedExamPattern("");
  };

  const exportTeacherListExcel = () => {
    if (!teacherListRows.length) {
      alert("No teacher list data available to export.");
      return;
    }

    const rows = teacherListRows.map((row, index) => ({
      "S.No": index + 1,
      "Teacher ID / Code": row.teacher_code || "-",
      "Teacher Name": row.teacher_name || "-",
      Program: row.program || "-",
      School: row.school || "-",
      "School Name": row.school_name || "-",
      Class: row.class || "-",
      Subject: row.subject || "-",
      Exam: row.exam || "-",
      "Total Students": row.total_students ?? "-",
      "Average %":
        row.average_percent === null || row.average_percent === undefined
          ? "-"
          : `${row.average_percent}%`,
      "All India Rank": row.all_india_rank ?? "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Teacher Queries");
    XLSX.writeFile(workbook, "teacher_queries_report.xlsx");
  };

  const exportStudentListExcel = () => {
    if (!studentListRows.length) {
      alert("No student list data available to export.");
      return;
    }

    const rows = studentListRows.map((row, index) => ({
      "S.No": index + 1,
      "Student ID / Roll No": row.student_code || "-",
      "Student Name": row.student_name || "-",
      Program: row.program || "-",
      School: row.school || "-",
      "School Name": row.school_name || "-",
      Class: row.class || "-",
      Exam: row.exam || "-",
      "Percentage %":
        row.percentage === null || row.percentage === undefined
          ? "-"
          : `${row.percentage}%`,
      "Class Rank": row.class_rank ?? "-",
      "School Rank": row.school_rank ?? "-",
      "All India Rank": row.all_india_rank ?? "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Student Performance");
    XLSX.writeFile(workbook, "student_performance_report.xlsx");
  };

  const exportSchoolListExcel = () => {
    if (!schoolListRows.length) {
      alert("No school list data available to export.");
      return;
    }

    const rows = schoolListRows.map((row, index) => ({
      "S.No": index + 1,
      Program: row.program || "-",
      School: row.school || "-",
      "School Name": row.school_name || "-",
      Class: row.class || "-",
      Exam: row.exam || "-",
      "Total Students": row.total_students ?? "-",
      "Average %":
        row.average_percent === null || row.average_percent === undefined
          ? "-"
          : `${row.average_percent}%`,
      "School Rank": row.school_rank ?? "-",
      "All India Rank": row.all_india_rank ?? "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "School Performance");
    XLSX.writeFile(workbook, "school_performance_report.xlsx");
  };

  const hasTeacherListFilters = Boolean(
    selectedProgram ||
      selectedSchool ||
      selectedClassSection ||
      selectedExamPattern ||
      selectedSubject,
  );

  const hasStudentDashboardFilters = Boolean(
    selectedProgram || selectedSchool || selectedClassSection,
  );

  const hasSchoolDashboardFilters = Boolean(
    selectedProgram || selectedSchool || selectedExamPattern,
  );

  const hasStudentListFilters = Boolean(
    selectedProgram || selectedSchool || selectedClassSection || selectedExamPattern,
  );

  const hasSchoolListFilters = Boolean(
    selectedProgram || selectedSchool || selectedClassSection || selectedExamPattern,
  );

  return (
    <div>
      {["school", "teacher", "student"].includes(activeQueryType) ? (
        <>
          <div style={dashboardTitleRowStyle}>
            <h2 style={{ margin: 0, fontSize: "20px" }}>
              {activeQueryType === "teacher"
                ? "Teacher Queries Dashboard"
                : activeQueryType === "student"
                  ? "Student Queries Dashboard"
                  : "School Queries Dashboard"}
            </h2>

            {activeQueryType === "school" && (
              <div style={teacherHeaderActionsStyle}>
                {schoolView === "list" && (
                  <>
                    <button
                      type="button"
                      onClick={resetSchoolListFilters}
                      style={secondaryButtonStyle}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={exportSchoolListExcel}
                      disabled={!schoolListRows.length}
                      style={{
                        ...successButtonStyle,
                        opacity: schoolListRows.length ? 1 : 0.6,
                        cursor: schoolListRows.length ? "pointer" : "not-allowed",
                      }}
                    >
                      Export Excel
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setSchoolView((view) =>
                      view === "list" ? "dashboard" : "list",
                    )
                  }
                  style={primaryButtonStyle}
                >
                  {schoolView === "list" ? "Dashboard" : "Performance List"}
                </button>
              </div>
            )}
            {activeQueryType === "teacher" && (
              <div style={teacherHeaderActionsStyle}>
                {teacherView === "list" && (
                  <>
                    <button
                      type="button"
                      onClick={resetTeacherListFilters}
                      style={secondaryButtonStyle}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={exportTeacherListExcel}
                      disabled={!teacherListRows.length}
                      style={{
                        ...successButtonStyle,
                        opacity: teacherListRows.length ? 1 : 0.6,
                        cursor: teacherListRows.length ? "pointer" : "not-allowed",
                      }}
                    >
                      Export Excel
                    </button>
                  </>
                )}
              <button
                type="button"
                onClick={() =>
                  setTeacherView((view) =>
                    view === "list" ? "dashboard" : "list",
                  )
                }
                style={primaryButtonStyle}
              >
                {teacherView === "list" ? "Dashboard" : "Performance List"}
              </button>
              </div>
            )}
            {activeQueryType === "student" && (
              <div style={teacherHeaderActionsStyle}>
                {studentView === "list" && (
                  <>
                    <button
                      type="button"
                      onClick={resetStudentListFilters}
                      style={secondaryButtonStyle}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={exportStudentListExcel}
                      disabled={!studentListRows.length}
                      style={{
                        ...successButtonStyle,
                        opacity: studentListRows.length ? 1 : 0.6,
                        cursor: studentListRows.length ? "pointer" : "not-allowed",
                      }}
                    >
                      Export Excel
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setStudentView((view) =>
                      view === "list" ? "dashboard" : "list",
                    )
                  }
                  style={primaryButtonStyle}
                >
                  {studentView === "list" ? "Dashboard" : "Performance List"}
                </button>
              </div>
            )}
          </div>

          {activeQueryType === "school" && schoolView === "list" ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "16px",
                  marginBottom: "18px",
                }}
              >
                <FilterSelect
                  label="Program:"
                  value={selectedProgram}
                  onChange={setSelectedProgram}
                  placeholder="— Select Program —"
                  options={programs}
                />
                <FilterSelect
                  label="School:"
                  value={selectedSchool}
                  onChange={setSelectedSchool}
                  placeholder="— All Schools —"
                  options={schools}
                />
                <FilterSelect
                  label="Class:"
                  value={selectedClassSection}
                  onChange={setSelectedClassSection}
                  placeholder="— All Classes —"
                  options={schoolListClasses}
                />
                <FilterSelect
                  label="Exam:"
                  value={selectedExamPattern}
                  onChange={setSelectedExamPattern}
                  placeholder="— All Exams —"
                  options={examPatterns}
                />
              </div>

              {schoolListError && (
                <p style={{ color: "crimson", marginBottom: "12px" }}>
                  {schoolListError}
                </p>
              )}
              {schoolListLoading && <p>Loading school list...</p>}

              {!schoolListLoading && (
                <div style={wideTableScrollStyle}>
                  <table style={studentPerformanceTableStyle}>
                    <thead>
                      <tr>
                        {schoolListColumns.map((column) => (
                          <th key={column} style={getSchoolPerformanceCellStyle(column, true)}>
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {schoolListRows.length > 0 ? (
                        schoolListRows.map((row, index) => (
                          <tr
                            key={`${row.program}-${row.school}-${row.class}-${row.exam}-${index}`}
                          >
                            <td style={getSchoolPerformanceCellStyle("S.No")}>{index + 1}</td>
                            <td style={getSchoolPerformanceCellStyle("Program")}>{row.program || "-"}</td>
                            <td style={getSchoolPerformanceCellStyle("School")}>{row.school || "-"}</td>
                            <td style={getSchoolPerformanceCellStyle("School Name")}>{row.school_name || "-"}</td>
                            <td style={getSchoolPerformanceCellStyle("Class")}>{row.class || "-"}</td>
                            <td style={getSchoolPerformanceCellStyle("Exam")}>{row.exam || "-"}</td>
                            <td style={getSchoolPerformanceCellStyle("Total Students")}>{row.total_students ?? "-"}</td>
                            <td style={getSchoolPerformanceCellStyle("Average %")}>
                              {row.average_percent === null ||
                              row.average_percent === undefined
                                ? "-"
                                : `${row.average_percent}%`}
                            </td>
                            <td style={getSchoolPerformanceCellStyle("School Rank")}>{row.school_rank ?? "-"}</td>
                            <td style={getSchoolPerformanceCellStyle("All India Rank")}>{row.all_india_rank ?? "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td style={cellStyle} colSpan={9}>
                            {hasSchoolListFilters
                              ? "No matching school performance data found."
                              : "No school performance data available."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : activeQueryType === "teacher" && teacherView === "list" ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "16px",
                  marginBottom: "18px",
                }}
              >
                <FilterSelect
                  label="Program:"
                  value={selectedProgram}
                  onChange={setSelectedProgram}
                  placeholder="— Select Program —"
                  options={programs}
                />
                <FilterSelect
                  label="School:"
                  value={selectedSchool}
                  onChange={setSelectedSchool}
                  placeholder="— All Schools —"
                  options={schools}
                />
                <FilterSelect
                  label="Class:"
                  value={selectedClassSection}
                  onChange={setSelectedClassSection}
                  placeholder="— All Classes —"
                  options={classSections}
                />
                <FilterSelect
                  label="Exam:"
                  value={selectedExamPattern}
                  onChange={setSelectedExamPattern}
                  placeholder="— All Exams —"
                  options={examPatterns}
                />
                <FilterSelect
                  label="Subject:"
                  value={selectedSubject}
                  onChange={setSelectedSubject}
                  placeholder="— All Subjects —"
                  options={subjects}
                />
              </div>

              {teacherListError && (
                <p style={{ color: "crimson", marginBottom: "12px" }}>
                  {teacherListError}
                </p>
              )}
              {teacherListLoading && <p>Loading teacher list...</p>}

              {!teacherListLoading && (
                <div style={wideTableScrollStyle}>
                  <table
                    style={studentPerformanceTableStyle}
                  >
                    <thead>
                      <tr>
                        {teacherListColumns.map((column) => (
                          <th
                            key={column}
                            style={getTeacherPerformanceCellStyle(column, true)}
                          >
                            {column === "All India Rank" ? (
                              <>
                                All India
                                <br />
                                Rank
                              </>
                            ) : (
                              column
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {teacherListRows.length > 0 ? (
                        teacherListRows.map((row, index) => (
                          <tr
                            key={`${row.teacher_code}-${row.school}-${row.class_section}-${row.subject}-${row.exam}-${index}`}
                          >
                            <td style={getTeacherPerformanceCellStyle("S.No")}>{index + 1}</td>
                            <td style={getTeacherPerformanceCellStyle("Teacher ID / Code")}>{row.teacher_code || "-"}</td>
                            <td style={getTeacherPerformanceCellStyle("Teacher Name")}>{row.teacher_name || "-"}</td>
                            <td style={getTeacherPerformanceCellStyle("Program")}>{row.program || "-"}</td>
                            <td style={getTeacherPerformanceCellStyle("School")}>{row.school || "-"}</td>
                            <td style={getTeacherPerformanceCellStyle("School Name")}>{row.school_name || "-"}</td>
                            <td style={getTeacherPerformanceCellStyle("Class")}>{row.class || "-"}</td>
                            <td style={getTeacherPerformanceCellStyle("Subject")}>{row.subject || "-"}</td>
                            <td style={getTeacherPerformanceCellStyle("Exam")}>{row.exam || "-"}</td>
                            <td style={getTeacherPerformanceCellStyle("Total Students")}>
                              {row.total_students ?? "-"}
                            </td>
                            <td style={getTeacherPerformanceCellStyle("Average %")}>
                              {row.average_percent === null ||
                              row.average_percent === undefined
                                ? "-"
                                : `${row.average_percent}%`}
                            </td>
                            <td style={getTeacherPerformanceCellStyle("All India Rank")}>
                              {row.all_india_rank ?? "-"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td style={cellStyle} colSpan={12}>
                            {hasTeacherListFilters
                              ? "No matching teacher performance data found."
                              : "No teacher performance data available."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : activeQueryType === "student" && studentView === "list" ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "16px",
                  marginBottom: "18px",
                }}
              >
                <FilterSelect
                  label="Program:"
                  value={selectedProgram}
                  onChange={setSelectedProgram}
                  placeholder="— Select Program —"
                  options={programs}
                />
                <FilterSelect
                  label="School:"
                  value={selectedSchool}
                  onChange={setSelectedSchool}
                  placeholder="— All Schools —"
                  options={schools}
                />
                <FilterSelect
                  label="Class:"
                  value={selectedClassSection}
                  onChange={setSelectedClassSection}
                  placeholder="— All Classes —"
                  options={classSections}
                />
                <FilterSelect
                  label="Exam:"
                  value={selectedExamPattern}
                  onChange={setSelectedExamPattern}
                  placeholder="— All Exams —"
                  options={examPatterns}
                />
              </div>

              {studentListError && (
                <p style={{ color: "crimson", marginBottom: "12px" }}>
                  {studentListError}
                </p>
              )}
              {studentListLoading && <p>Loading student list...</p>}

              {!studentListLoading && (
                <div style={wideTableScrollStyle}>
                  <table
                    style={studentPerformanceTableStyle}
                  >
                    <thead>
                      <tr>
                        {studentListColumns.map((column) => (
                          <th
                            key={column}
                            style={getStudentPerformanceCellStyle(column, true)}
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {studentListRows.length > 0 ? (
                        studentListRows.map((row, index) => (
                          <tr
                            key={`${row.student_code}-${row.school}-${row.class_section}-${row.exam}-${index}`}
                          >
                            <td style={getStudentPerformanceCellStyle("S.No")}>{index + 1}</td>
                            <td style={getStudentPerformanceCellStyle("Student ID / Roll No")}>{row.student_code || "-"}</td>
                            <td style={getStudentPerformanceCellStyle("Student Name")}>
                              <span style={studentNameClampStyle}>
                                {row.student_name || "-"}
                              </span>
                            </td>
                            <td style={getStudentPerformanceCellStyle("Program")}>{row.program || "-"}</td>
                            <td style={getStudentPerformanceCellStyle("School")}>{row.school || "-"}</td>
                            <td style={getStudentPerformanceCellStyle("School Name")}>{row.school_name || "-"}</td>
                            <td style={getStudentPerformanceCellStyle("Class")}>{row.class || "-"}</td>
                            <td style={getStudentPerformanceCellStyle("Exam")}>{row.exam || "-"}</td>
                            <td style={getStudentPerformanceCellStyle("Percentage %")}>
                              {row.percentage === null ||
                              row.percentage === undefined
                                ? "-"
                                : `${row.percentage}%`}
                            </td>
                            <td style={getStudentPerformanceCellStyle("Class Rank")}>{row.class_rank ?? "-"}</td>
                            <td style={getStudentPerformanceCellStyle("School Rank")}>{row.school_rank ?? "-"}</td>
                            <td style={getStudentPerformanceCellStyle("All India Rank")}>{row.all_india_rank ?? "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td style={cellStyle} colSpan={12}>
                            {hasStudentListFilters
                              ? "No matching student performance data found."
                              : "No student performance data available."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <>

      {/* Program Selector */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "4px",
              fontWeight: "bold",
            }}
          >
            Program:
          </label>
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              minWidth: "180px",
            }}
          >
            <option value="">— Select Program —</option>
            {programs.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Exams Selector */}
        {activeQueryType === "school" && examPatterns.length > 0 && (
          <>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold",
              }}
            >
              School:
            </label>
            <select
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                minWidth: "180px",
              }}
            >
              <option value="">— All Schools —</option>
              {schools.map((school) => (
                <option key={school} value={school}>
                  {school}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold",
              }}
            >
              Exams:
            </label>
            <select
              value={selectedExamPattern}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedExamPattern(value);
                // Optional: clear school when switching to "All Exams"
                if (value === "") setSelectedSchool("");
              }}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                minWidth: "180px",
              }}
            >
              <option value="">— All Exams —</option>
              {examPatterns.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          </>
        )}

        {/* Subject Selector */}
        {activeQueryType === "teacher" && (
          <>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold",
              }}
            >
              School:
            </label>
            <select
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                minWidth: "180px",
              }}
            >
              <option value="">— All Schools —</option>
              {schools.map((school) => (
                <option key={school} value={school}>
                  {school}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold",
              }}
            >
              Subject:
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedSubject(value);
                if (value === "") setSelectedSchool("");
              }}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                minWidth: "180px",
              }}
            >
              <option value="">— All Subjects —</option>
              {subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>
          </>
        )}

        {/* Class Selector */}
        {activeQueryType === "student" && (
          <>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold",
              }}
            >
              School:
            </label>
            <select
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                minWidth: "180px",
              }}
            >
              <option value="">— All Schools —</option>
              {schools.map((school) => (
                <option key={school} value={school}>
                  {school}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold",
              }}
            >
              Class:
            </label>
            <select
              value={selectedClassSection}
              onChange={(e) => setSelectedClassSection(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                minWidth: "180px",
              }}
            >
              <option value="">— All Classes —</option>
              {classSections.map((classSection) => (
                <option key={classSection} value={classSection}>
                  {classSection}
                </option>
              ))}
            </select>
          </div>
          </>
        )}
      </div>

      {/* School Selector */}
      {schools.length > 0 && !["school", "teacher", "student"].includes(activeQueryType) && (
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "4px",
              fontWeight: "bold",
            }}
          >
            School:
          </label>
          <select
            value={selectedSchool}
            onChange={(e) => setSelectedSchool(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              minWidth: "180px",
            }}
          >
            <option value="">— All Schools —</option>
            {schools.map((school) => (
              <option key={school} value={school}>
                {school}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error & Loading */}
      {error && (
        <p style={{ color: "crimson", marginBottom: "12px" }}>{error}</p>
      )}
      {loading && <p>Loading statistics...</p>}

      {/* Stats Table */}
      {activeQueryType === "school" && stats && !loading && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
            }}
          >
            <thead>
              <tr>
                <th style={headerStyle}>Exams</th>
                <th style={headerStyle}>Schools</th>
                <th style={headerStyle}>Classes</th>
                <th style={headerStyle}>Students</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(stats) ? (
                stats.length > 0 ? (
                stats.map((row, i) => (
                  <tr key={i}>
                    <td style={cellStyle}>{row.examPattern}</td>
                    <td style={cellStyle}>{row.schoolCount}</td>
                    <td style={cellStyle}>{row.classCount}</td>
                    <td style={cellStyle}>{row.studentCount}</td>
                  </tr>
                ))
                ) : (
                  <tr>
                    <td style={cellStyle} colSpan={4}>
                      {hasSchoolDashboardFilters
                        ? "No matching school query data found."
                        : "No school query data available."}
                    </td>
                  </tr>
                )
              ) : (
                <tr>
                  <td style={cellStyle}>{stats.examPattern || "— Total —"}</td>
                  <td style={cellStyle}>{stats.schoolCount}</td>
                  <td style={cellStyle}>{stats.classCount}</td>
                  <td style={cellStyle}>{stats.studentCount}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {activeQueryType === "teacher" && Array.isArray(stats) && !loading && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
            }}
          >
            <thead>
              <tr>
                <th style={headerStyle}>Subject</th>
                <th style={headerStyle}>Schools</th>
                <th style={headerStyle}>Teachers</th>
                <th style={headerStyle}>Classes</th>
                <th style={headerStyle}>Students</th>
              </tr>
            </thead>
            <tbody>
              {stats.length > 0 ? (
                stats.map((row, i) => (
                  <tr key={`${row.subject}-${i}`}>
                    <td style={cellStyle}>{row.subject}</td>
                    <td style={cellStyle}>{row.schoolCount}</td>
                    <td style={cellStyle}>{row.teacherCount}</td>
                    <td style={cellStyle}>{row.classCount}</td>
                    <td style={cellStyle}>{row.studentCount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={cellStyle} colSpan={5}>
                    No teacher query data found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {activeQueryType === "student" && Array.isArray(stats) && !loading && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
            }}
          >
            <thead>
              <tr>
                <th style={headerStyle}>Class</th>
                <th style={headerStyle}>Schools</th>
                <th style={headerStyle}>Students</th>
                <th style={headerStyle}>Exams</th>
              </tr>
            </thead>
            <tbody>
              {stats.length > 0 ? (
                stats.map((row, i) => (
                  <tr key={`${row.class || row.classSection}-${i}`}>
                    <td style={cellStyle}>{row.class || row.classSection}</td>
                    <td style={cellStyle}>{row.schoolCount}</td>
                    <td style={cellStyle}>{row.studentCount}</td>
                    <td style={cellStyle}>{row.examCount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={cellStyle} colSpan={4}>
                    {hasStudentDashboardFilters
                      ? "No matching student query data found."
                      : "No student query data available."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
            </>
          )}
        </>
      ) : (
        <div style={placeholderStyle}>
          <h2 style={{ margin: "0 0 8px", fontSize: "20px" }}>
            {activeQueryType === "teacher"
              ? "Teacher Queries"
              : "Student Queries"}
          </h2>
          <p style={{ margin: 0, color: "#64748b" }}>
            This section will be configured next.
          </p>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, placeholder, options }) {
  return (
    <div>
      <label
        style={{
          display: "block",
          marginBottom: "4px",
          fontWeight: "bold",
        }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={selectStyle}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

const teacherListColumns = [
  "S.No",
  "Teacher ID / Code",
  "Teacher Name",
  "Program",
  "School",
  "School Name",
  "Class",
  "Subject",
  "Exam",
  "Total Students",
  "Average %",
  "All India Rank",
];

const studentListColumns = [
  "S.No",
  "Student ID / Roll No",
  "Student Name",
  "Program",
  "School",
  "School Name",
  "Class",
  "Exam",
  "Percentage %",
  "Class Rank",
  "School Rank",
  "All India Rank",
];

const schoolListColumns = [
  "S.No",
  "Program",
  "School",
  "School Name",
  "Class",
  "Exam",
  "Total Students",
  "Average %",
  "School Rank",
  "All India Rank",
];

function getTeacherPerformanceCellStyle(column, isHeader = false) {
  const base = isHeader
    ? {
        ...headerStyle,
        padding: "8px 9px",
        fontSize: "12px",
        lineHeight: 1.25,
        whiteSpace: "normal",
      }
    : {
        ...cellStyle,
        padding: "8px 9px",
        fontSize: "12px",
        lineHeight: 1.25,
        verticalAlign: "top",
        wordBreak: "break-word",
      };

  if (column === "S.No") return { ...base, width: "44px", minWidth: "44px" };
  if (column === "Teacher ID / Code") return { ...base, width: "92px", minWidth: "92px" };
  if (column === "Teacher Name") return { ...base, width: "130px", minWidth: "130px" };
  if (column === "Program") return { ...base, width: "70px", minWidth: "70px", whiteSpace: "nowrap" };
  if (column === "School") return { ...base, width: "80px", minWidth: "80px" };
  if (column === "School Name") return { ...base, width: "185px", minWidth: "185px", maxWidth: "185px" };
  if (column === "Class") return { ...base, width: "76px", minWidth: "76px" };
  if (column === "Subject") return { ...base, width: "78px", minWidth: "78px" };
  if (column === "Exam") return { ...base, width: "96px", minWidth: "96px", whiteSpace: "nowrap" };
  if (column === "Total Students") return { ...base, width: "88px", minWidth: "88px" };
  if (column === "Average %") return { ...base, width: "82px", minWidth: "82px", whiteSpace: "nowrap" };
  if (column === "All India Rank") return { ...base, width: "112px", minWidth: "112px", paddingRight: "18px" };

  return base;
}

function getSchoolPerformanceCellStyle(column, isHeader = false) {
  const base = isHeader
    ? {
        ...headerStyle,
        padding: "8px 10px",
        fontSize: "12px",
        lineHeight: 1.25,
        whiteSpace: "normal",
      }
    : {
        ...cellStyle,
        padding: "8px 10px",
        fontSize: "12px",
        lineHeight: 1.25,
        verticalAlign: "middle",
        wordBreak: "break-word",
      };

  if (column === "S.No") return { ...base, width: "52px" };
  if (column === "School Name") return { ...base, width: "160px" };
  if (["School Rank", "All India Rank", "Total Students"].includes(column)) {
    return { ...base, width: "90px" };
  }
  return base;
}

function getStudentPerformanceCellStyle(column, isHeader = false) {
  const base = isHeader
    ? {
        ...headerStyle,
        padding: "8px 10px",
        fontSize: "12px",
        lineHeight: 1.25,
        whiteSpace: "normal",
      }
    : {
        ...cellStyle,
        padding: "8px 10px",
        fontSize: "12px",
        lineHeight: 1.25,
        verticalAlign: "top",
        wordBreak: "break-word",
      };

  if (column === "S.No") return { ...base, width: "44px", minWidth: "44px" };
  if (column === "Student ID / Roll No") return { ...base, width: "82px", minWidth: "82px" };
  if (column === "Student Name") {
    return {
      ...base,
      width: "150px",
      minWidth: "150px",
      maxWidth: "150px",
      paddingLeft: "8px",
      whiteSpace: "normal",
      overflow: "hidden",
      wordBreak: "break-word",
    };
  }
  if (column === "Program") return { ...base, width: "88px", minWidth: "88px", whiteSpace: "nowrap" };
  if (column === "School") return { ...base, width: "76px", minWidth: "76px" };
  if (column === "School Name") return { ...base, width: "170px", minWidth: "170px", maxWidth: "170px" };
  if (column === "Class") return { ...base, width: "80px", minWidth: "80px" };
  if (column === "Exam") return { ...base, width: "105px", minWidth: "105px", whiteSpace: "nowrap" };
  if (column === "Percentage %") return { ...base, width: "86px", minWidth: "86px", whiteSpace: "nowrap" };
  if (["Class Rank", "School Rank", "All India Rank"].includes(column)) {
    return { ...base, width: "78px", minWidth: "78px" };
  }

  return base;
}

const studentNameClampStyle = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  whiteSpace: "normal",
  wordBreak: "break-word",
};

const dashboardTitleRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  marginBottom: "20px",
  flexWrap: "wrap",
};

const teacherHeaderActionsStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "12px",
  flexWrap: "wrap",
};

const placeholderStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  background: "#fff",
  padding: "24px",
};

const headerStyle = {
  backgroundColor: "#f8fafc",
  padding: "10px 12px",
  textAlign: "left",
  borderBottom: "2px solid #cbd5e1",
  fontWeight: "600",
};

const cellStyle = {
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
};

const wideTableScrollStyle = {
  overflow: "visible",
  maxHeight: "none",
  paddingBottom: 0,
};

const studentPerformanceTableStyle = {
  width: "100%",
  tableLayout: "fixed",
  borderCollapse: "collapse",
  fontSize: "12px",
};

const selectStyle = {
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #ccc",
  minWidth: "180px",
  width: "100%",
};

const primaryButtonStyle = {
  padding: "9px 18px",
  borderRadius: "8px",
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: "700",
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "9px 18px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: "700",
  cursor: "pointer",
};

const successButtonStyle = {
  padding: "9px 18px",
  borderRadius: "8px",
  border: "1px solid #16a34a",
  background: "#16a34a",
  color: "#ffffff",
  fontWeight: "700",
  cursor: "pointer",
};
