import React, { useEffect, useState } from "react";
import { ImagePlus, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  deletePosterTemplate,
  duplicatePosterTemplate,
  getPosterTemplates,
} from "../../api.js";
import PosterTemplateCard from "./PosterTemplateCard.jsx";

export default function PosterTemplateList() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const handleDuplicate = async (id) => {
    await duplicatePosterTemplate(id);
    await loadTemplates();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this poster template?")) return;
    await deletePosterTemplate(id);
    await loadTemplates();
  };

  return (
    <div className="poster-page">
      <div className="poster-page-toolbar">
        <div>
          <h2>Poster Templates</h2>
          <p>Create reusable layouts for top-student announcements.</p>
        </div>
        <div className="poster-toolbar-actions">
          <button className="poster-secondary-btn" onClick={loadTemplates}>
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            className="btn-link-primary"
            onClick={() => navigate("/admin/poster-templates/new")}
          >
            <ImagePlus size={16} />
            Upload Poster Template
          </button>
        </div>
      </div>

      {error && <div className="alert-banner alert-banner--error">{error}</div>}
      {loading && <div className="poster-empty">Loading poster templates...</div>}

      {!loading && templates.length === 0 && (
        <div className="poster-empty">
          <strong>No poster templates yet.</strong>
          <span>Upload a background image to create the first template.</span>
        </div>
      )}

      {!loading && templates.length > 0 && (
        <div className="poster-card-grid">
          {templates.map((template) => (
            <PosterTemplateCard
              key={template.id}
              template={template}
              onEdit={() => navigate(`/admin/poster-templates/${template.id}/edit`)}
              onDuplicate={() => handleDuplicate(template.id)}
              onDelete={() => handleDelete(template.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

