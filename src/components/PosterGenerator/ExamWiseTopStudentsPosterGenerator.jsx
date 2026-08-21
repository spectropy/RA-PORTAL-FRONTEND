import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getExamWiseTopStudentsPosterData, getPosterTemplates, getSchoolById } from "../../api.js";
import { buildPosterData } from "../../utils/posterBindings.js";
import PosterDownloadOptions from "./PosterDownloadOptions.jsx";
import PosterPreview from "./PosterPreview.jsx";
import TemplateSelector from "./TemplateSelector.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const isExamWiseTemplate = (template) =>
  String(template.description || "").includes("poster_type:exam_wise") ||
  /exam/i.test(template.name || "");

export default function ExamWiseTopStudentsPosterGenerator({ mode = "admin", schools = [], school }) {
  const [searchParams] = useSearchParams();
  const [selectedSchoolId, setSelectedSchoolId] = useState(mode === "school" ? school?.school_id || "" : searchParams.get("school_id") || "");
  const [schoolDetail, setSchoolDetail] = useState(school || null);
  const [classValue, setClassValue] = useState(searchParams.get("class") || "");
  const [sectionValue, setSectionValue] = useState(searchParams.get("section") || "");
  const [examKey, setExamKey] = useState(() => {
    const examPattern = searchParams.get("exam_pattern") || "";
    const examDate = searchParams.get("exam_date") || "";
    return examPattern ? `${examPattern}|${examDate}` : "";
  });
  const [examRows, setExamRows] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [posterData, setPosterData] = useState(null);
  const [previewCanvas, setPreviewCanvas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getPosterTemplates({ category: "top_students", status: "active" }).then((rows) => {
      const examWiseRows = rows.filter(isExamWiseTemplate);
      setTemplates(examWiseRows);
      setSelectedTemplateId((current) => current || examWiseRows[0]?.id || "");
    }).catch((e) => setError(e.message || "Failed to load poster templates"));
  }, []);

  useEffect(() => {
    if (mode === "school" && school) {
      setSchoolDetail(school);
      setSelectedSchoolId(school.school_id);
      return;
    }
    if (!selectedSchoolId) {
      setSchoolDetail(null);
      setExamRows([]);
      return;
    }
    getSchoolById(selectedSchoolId)
      .then((data) => setSchoolDetail({ ...(data.school || {}), classes: data.classes || [] }))
      .catch(() => setSchoolDetail(schools.find((row) => row.school_id === selectedSchoolId) || null));
  }, [mode, school, selectedSchoolId, schools]);

  useEffect(() => {
    if (!selectedSchoolId) return;
    const query = new URLSearchParams({ school_id: selectedSchoolId });
    if (classValue) query.set("class", classValue);
    if (sectionValue) query.set("section", sectionValue);
    fetch(`${API_BASE}/api/exams?${query}`)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load exams");
        return response.json();
      })
      .then((rows) => setExamRows(Array.isArray(rows) ? rows : []))
      .catch((e) => setError(e.message || "Failed to load exams"));
  }, [selectedSchoolId, classValue, sectionValue]);

  const classOptions = useMemo(() => [...new Set((schoolDetail?.classes || []).map((row) => row.class).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })), [schoolDetail]);
  const sectionOptions = useMemo(() => [...new Set((schoolDetail?.classes || []).filter((row) => !classValue || row.class === classValue).map((row) => row.section).filter(Boolean))].sort(), [schoolDetail, classValue]);
  const examOptions = useMemo(() => {
    const unique = new Map();
    examRows.forEach((row) => {
      if (!row.exam_pattern) return;
      const key = `${row.exam_pattern}|${row.exam_date || ""}`;
      if (!unique.has(key)) unique.set(key, { key, exam_pattern: row.exam_pattern, exam_date: row.exam_date || "", label: row.exam_date ? `${row.exam_pattern} - ${row.exam_date}` : row.exam_pattern });
    });
    return [...unique.values()];
  }, [examRows]);
  const selectedExam = examOptions.find((exam) => exam.key === examKey);

  useEffect(() => {
    if (!selectedSchoolId || !classValue || !sectionValue || !selectedExam) {
      setPosterData(null);
      return;
    }
    setLoading(true);
    setError("");
    getExamWiseTopStudentsPosterData({ school_id: selectedSchoolId, class: classValue, section: sectionValue, exam_pattern: selectedExam.exam_pattern, exam_date: selectedExam.exam_date, limit: 5 })
      .then((data) => setPosterData({ ...buildPosterData(data), exam: data.exam || { name: "" } }))
      .catch((e) => { setPosterData(null); setError(e.message || "Failed to load exam-wise top students"); })
      .finally(() => setLoading(false));
  }, [selectedSchoolId, classValue, sectionValue, selectedExam]);

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const filename = `Top_Students_Exam_Wise_${selectedSchoolId || "School"}_${classValue || "Class"}_${sectionValue || "Section"}_${selectedExam?.exam_pattern || "Exam"}`.replace(/[^a-z0-9_-]+/gi, "_");

  return (
    <div className="poster-page poster-generator-page">
      <div className="poster-generator-grid">
        <section className="poster-control-panel">
          {mode === "admin" && <label>School<select value={selectedSchoolId} onChange={(e) => { setSelectedSchoolId(e.target.value); setClassValue(""); setSectionValue(""); setExamKey(""); }}><option value="">Choose a school</option>{schools.map((row) => <option key={row.school_id} value={row.school_id}>{row.school_name} ({row.school_id})</option>)}</select></label>}
          <label>Class<select value={classValue} onChange={(e) => { setClassValue(e.target.value); setSectionValue(""); setExamKey(""); }}><option value="">Choose a class</option>{classOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Section<select value={sectionValue} onChange={(e) => { setSectionValue(e.target.value); setExamKey(""); }}><option value="">Choose a section</option>{sectionOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Exam<select value={examKey} onChange={(e) => setExamKey(e.target.value)} disabled={!classValue || !sectionValue}><option value="">Choose an exam</option>{examOptions.map((exam) => <option key={exam.key} value={exam.key}>{exam.label}</option>)}</select></label>
          <TemplateSelector templates={templates} selectedId={selectedTemplateId} onSelect={setSelectedTemplateId} />
          <PosterDownloadOptions canvas={previewCanvas} filename={filename} posterData={posterData} schoolDetail={schoolDetail} className={classValue} sectionName={sectionValue} />
        </section>
        <section>
          {error && <div className="alert-banner alert-banner--error">{error}</div>}
          {loading && <div className="poster-empty poster-empty--compact">Loading exam-wise results...</div>}
          <PosterPreview template={selectedTemplate} posterData={posterData} onCanvasReady={setPreviewCanvas} />
        </section>
      </div>
    </div>
  );
}
