import React from "react";
import { Save, Trash2, Undo2 } from "lucide-react";

export default function PosterToolbar({
  template,
  status,
  onStatusChange,
  onSave,
  onDeleteSelected,
  onUndo,
  canUndo,
  saving,
}) {
  return (
    <div className="poster-editor-toolbar">
      <div>
        <strong>{template?.name || "Poster Template"}</strong>
        <span>
          {template?.canvas_width} x {template?.canvas_height}
        </span>
      </div>
      <div className="poster-toolbar-actions">
        <select value={status} onChange={(e) => onStatusChange(e.target.value)}>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <button
          className="poster-secondary-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo last canvas change"
        >
          <Undo2 size={15} />
          Undo
        </button>
        <button className="poster-secondary-btn" onClick={onDeleteSelected}>
          <Trash2 size={15} />
          Delete Selected
        </button>
        <button className="btn-link-primary" onClick={onSave} disabled={saving}>
          <Save size={15} />
          {saving ? "Saving..." : "Save Template"}
        </button>
      </div>
    </div>
  );
}
