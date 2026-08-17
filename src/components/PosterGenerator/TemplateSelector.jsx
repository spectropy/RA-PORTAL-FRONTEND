import React from "react";

export default function TemplateSelector({ templates, selectedId, onSelect }) {
  if (!templates.length) {
    return (
      <div className="poster-empty poster-empty--compact">
        No active poster templates available.
      </div>
    );
  }

  return (
    <div className="poster-template-strip">
      {templates.map((template) => (
        <button
          type="button"
          key={template.id}
          className={selectedId === template.id ? "is-selected" : ""}
          onClick={() => onSelect(template.id)}
        >
          <span>
            {template.thumbnail_url || template.background_url ? (
              <img
                src={template.thumbnail_url || template.background_url}
                alt={template.name}
              />
            ) : (
              "Preview"
            )}
          </span>
          <strong>{template.name}</strong>
        </button>
      ))}
    </div>
  );
}

