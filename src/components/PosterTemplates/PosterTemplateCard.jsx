import React from "react";
import { Copy, Edit3, Trash2 } from "lucide-react";

export default function PosterTemplateCard({
  template,
  onEdit,
  onDuplicate,
  onDelete,
}) {
  const status = template.status || "draft";
  const created = template.created_at
    ? new Date(template.created_at).toLocaleDateString()
    : "-";

  return (
    <article className="poster-card">
      <div className="poster-card__thumb">
        {template.thumbnail_url || template.background_url ? (
          <img
            src={template.thumbnail_url || template.background_url}
            alt={template.name}
          />
        ) : (
          <span>No Preview</span>
        )}
      </div>
      <div className="poster-card__body">
        <div className="poster-card__top">
          <h3>{template.name || "Untitled Template"}</h3>
          <span className={`poster-status poster-status--${status}`}>
            {status}
          </span>
        </div>
        <div className="poster-card__meta">
          <span>
            {template.canvas_width || 0} x {template.canvas_height || 0}
          </span>
          <span>{created}</span>
        </div>
        <div className="poster-card__actions">
          <button type="button" onClick={onEdit} title="Edit template">
            <Edit3 size={15} />
            Edit
          </button>
          <button type="button" onClick={onDuplicate} title="Duplicate template">
            <Copy size={15} />
            Duplicate
          </button>
          <button
            type="button"
            className="poster-card__delete"
            onClick={onDelete}
            title="Delete template"
          >
            <Trash2 size={15} />
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

