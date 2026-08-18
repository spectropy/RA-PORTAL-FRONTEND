import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getPosterTemplates,
  getSchoolById,
  getTopStudentsPosterData,
} from "../../api.js";
import {
  buildPosterData,
  normalizeTopStudentsResponse,
} from "../../utils/posterBindings.js";
import PosterDownloadOptions from "./PosterDownloadOptions.jsx";
import PosterPreview from "./PosterPreview.jsx";
import TemplateSelector from "./TemplateSelector.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function calculateTopStudents(exams, school, className, sectionName) {
  const grouped = {};
  exams.forEach((exam) => {
    const score = parseFloat(exam.percentage ?? exam.totalgrade_per_avg);
    if (!exam.student_id || Number.isNaN(score)) return;
    const name =
      [exam.first_name, exam.last_name].filter(Boolean).join(" ") ||
      exam.name ||
      "Anonymous";
    if (!grouped[exam.student_id]) {
      grouped[exam.student_id] = {
        student_id: exam.student_id,
        name,
        scores: [],
      };
    }
    grouped[exam.student_id].scores.push(score);
  });

  const students = Object.values(grouped)
    .map((student) => {
      const avg =
        student.scores.reduce((sum, value) => sum + value, 0) /
        student.scores.length;
      return {
        ...student,
        cumulative_percentage: Number(avg.toFixed(2)),
      };
    })
    .sort((a, b) => b.cumulative_percentage - a.cumulative_percentage)
    .slice(0, 5)
    .map((student, index) => ({ ...student, rank: index + 1 }));

  return buildPosterData({ school, className, sectionName, students });
}

export default function TopStudentsPosterGenerator({
  mode = "admin",
  schools = [],
  school,
}) {
  const [searchParams] = useSearchParams();
  const [selectedSchoolId, setSelectedSchoolId] = useState(
    mode === "school"
      ? school?.school_id || ""
      : searchParams.get("school_id") || "",
  );
  const [schoolDetail, setSchoolDetail] = useState(school || null);
  const [classValue, setClassValue] = useState(searchParams.get("class") || "");
  const [sectionValue, setSectionValue] = useState(
    searchParams.get("section") || "",
  );
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [posterData, setPosterData] = useState(null);
  const [previewCanvas, setPreviewCanvas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getPosterTemplates({ category: "top_students", status: "active" }).then(
      (rows) => {
        setTemplates(rows);
        setSelectedTemplateId((current) => current || rows[0]?.id || "");
      },
    );
  }, []);

  useEffect(() => {
    if (mode === "school" && school) {
      setSchoolDetail(school);
      setSelectedSchoolId(school.school_id);
      return;
    }
    if (!selectedSchoolId) {
      setSchoolDetail(null);
      return;
    }
    getSchoolById(selectedSchoolId)
      .then((data) => {
        setSchoolDetail({
          ...(data.school || {}),
          classes: data.classes || [],
        });
      })
      .catch(() => {
        const fallback = schools.find(
          (row) => row.school_id === selectedSchoolId,
        );
        setSchoolDetail(fallback || null);
      });
  }, [selectedSchoolId, school, mode]);

  const classOptions = useMemo(() => {
    const rows = schoolDetail?.classes || [];
    return [...new Set(rows.map((row) => row.class).filter(Boolean))].sort(
      (a, b) =>
        String(a).localeCompare(String(b), undefined, { numeric: true }),
    );
  }, [schoolDetail]);

  const sectionOptions = useMemo(() => {
    const rows = schoolDetail?.classes || [];
    return [
      ...new Set(
        rows
          .filter((row) => !classValue || row.class === classValue)
          .map((row) => row.section)
          .filter(Boolean),
      ),
    ].sort();
  }, [schoolDetail, classValue]);

  useEffect(() => {
    if (!selectedSchoolId || !classValue || !sectionValue) {
      setPosterData(null);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getTopStudentsPosterData({
          school_id: selectedSchoolId,
          class: classValue,
          section: sectionValue,
          limit: 5,
        });
        setPosterData(normalizeTopStudentsResponse(data));
      } catch (e) {
        try {
          const query = new URLSearchParams({
            school_id: selectedSchoolId,
            class: classValue,
            section: sectionValue,
          }).toString();
          const res = await fetch(`${API_BASE}/api/exams?${query}`);
          if (!res.ok) throw new Error("Failed to load exams");
          const exams = await res.json();
          setPosterData(
            calculateTopStudents(exams, schoolDetail, classValue, sectionValue),
          );
        } catch (fallbackError) {
          setError(fallbackError.message || "Failed to load top students");
          setPosterData(null);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedSchoolId, classValue, sectionValue, schoolDetail]);

  const selectedTemplate = templates.find(
    (template) => template.id === selectedTemplateId,
  );
  const filename = `Top_Students_${selectedSchoolId || "School"}_${classValue || "Class"}_${sectionValue || "Section"}`;

  return (
    <div className="poster-page poster-generator-page">
      <div className="poster-page-toolbar">
        <div>
          <h2>Top Students Poster</h2>
          <p>Generate social-ready posters from the existing top 5 results.</p>
        </div>
      </div>

      <div className="poster-generator-grid">
        <section className="poster-control-panel">
          {mode === "admin" && (
            <label>
              School
              <select
                value={selectedSchoolId}
                onChange={(e) => {
                  setSelectedSchoolId(e.target.value);
                  setClassValue("");
                  setSectionValue("");
                }}
              >
                <option value="">Choose a school</option>
                {schools.map((row) => (
                  <option key={row.school_id} value={row.school_id}>
                    {row.school_name} ({row.school_id})
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Class
            <select
              value={classValue}
              onChange={(e) => setClassValue(e.target.value)}
            >
              <option value="">Choose a class</option>
              {classOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
              {classValue && !classOptions.includes(classValue) && (
                <option value={classValue}>Class {classValue}</option>
              )}
            </select>
          </label>
          <label>
            Section
            <select
              value={sectionValue}
              onChange={(e) => setSectionValue(e.target.value)}
            >
              <option value="">Choose a section</option>
              {sectionOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
              {sectionValue && !sectionOptions.includes(sectionValue) && (
                <option value={sectionValue}>{sectionValue}</option>
              )}
            </select>
          </label>
          <TemplateSelector
            templates={templates}
            selectedId={selectedTemplateId}
            onSelect={setSelectedTemplateId}
          />
          <PosterDownloadOptions canvas={previewCanvas} filename={filename} />
        </section>

        <section>
          {error && (
            <div className="alert-banner alert-banner--error">{error}</div>
          )}
          {loading && (
            <div className="poster-empty poster-empty--compact">
              Loading top students...
            </div>
          )}
          <PosterPreview
            template={selectedTemplate}
            posterData={posterData}
            onCanvasReady={setPreviewCanvas}
          />
        </section>
      </div>
    </div>
  );
}
