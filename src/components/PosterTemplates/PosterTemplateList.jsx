import React, { useEffect, useState } from "react";
import { ImagePlus, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  deletePosterTemplate,
  duplicatePosterTemplate,
  getPosterTemplates,
  permanentlyDeletePosterTemplate,
} from "../../api.js";
import PosterTemplateCard from "./PosterTemplateCard.jsx";

export default function PosterTemplateList({ templateMode = "cumulative" }) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadTemplates = async () => {
    setLoading(true);
    setError("");
    try {
      setTemplates(await getPosterTemplates({ category: "top_students" }));
    } catch (e) {
      setError(e.message || "Failed to load poster templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const isExamWiseTemplate = (template) =>
    String(template.description || "").includes("poster_type:exam_wise") ||
    /exam/i.test(template.name || "");

  const visibleTemplates = templates.filter((template) =>
    templateMode === "exam_wise"
      ? isExamWiseTemplate(template)
      : !isExamWiseTemplate(template),
  );

  const handleDuplicate = async (id) => {
    await duplicatePosterTemplate(id);
    await loadTemplates();
  };

  const handleArchiveDelete = async () => {
    if (!deleteTarget) return;
    await deletePosterTemplate(deleteTarget.id);
    setDeleteTarget(null);
    await loadTemplates();
  };

  const handlePermanentDelete = async () => {
    if (!deleteTarget) return;
    await permanentlyDeletePosterTemplate(deleteTarget.id);
    setDeleteTarget(null);
    await loadTemplates();
  };

  return (
    <div className="poster-page">
      <div className="poster-page-toolbar poster-template-subtoolbar">
        <div>
          <strong>{templateMode === "exam_wise" ? "Exam-wise Percentage Templates" : "Cumulative Percentage Templates"}</strong>
          <p>{templateMode === "exam_wise" ? "Use exam name and individual exam percentages." : "Use cumulative student performance percentages."}</p>
        </div>
        <div className="poster-toolbar-actions">
          <button className="poster-secondary-btn" onClick={loadTemplates}>
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            className="btn-link-primary"
            onClick={() => navigate(`/admin/poster-templates/new?type=${templateMode}`)}
          >
            <ImagePlus size={16} />
            Create Template
          </button>
        </div>
      </div>

      {error && <div className="alert-banner alert-banner--error">{error}</div>}
      {loading && <div className="poster-empty">Loading poster templates...</div>}

      {!loading && visibleTemplates.length === 0 && (
        <div className="poster-empty">
          <strong>No {templateMode === "exam_wise" ? "exam-wise" : "cumulative"} templates yet.</strong>
          <span>Upload a background image to create the first template.</span>
        </div>
      )}

      {!loading && visibleTemplates.length > 0 && (
        <div className="poster-card-grid">
          {visibleTemplates.map((template) => (
            <PosterTemplateCard
              key={template.id}
              template={template}
              onEdit={() => navigate(`/admin/poster-templates/${template.id}/edit`)}
              onDuplicate={() => handleDuplicate(template.id)}
              onDelete={() => setDeleteTarget(template)}
            />
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="poster-modal-backdrop" role="presentation">
          <div className="poster-delete-dialog" role="dialog" aria-modal="true">
            <h3>Delete Poster Template</h3>
            <p>
              Choose how to delete <strong>{deleteTarget.name || "this template"}</strong>.
            </p>
            <div className="poster-delete-dialog__actions">
              <button type="button" className="poster-secondary-btn" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="poster-secondary-btn" onClick={handleArchiveDelete}>
                Delete
              </button>
              <button type="button" className="poster-danger-btn" onClick={handlePermanentDelete}>
                Permanent Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
