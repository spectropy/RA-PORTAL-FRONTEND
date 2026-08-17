import React from "react";
import PosterRenderer from "./PosterRenderer.jsx";

export default function PosterPreview({ template, posterData, onCanvasReady }) {
  if (!template) {
    return (
      <div className="poster-preview-frame poster-preview-frame--empty">
        Select a template to preview the poster.
      </div>
    );
  }

  if (!posterData?.students?.length) {
    return (
      <div className="poster-preview-frame poster-preview-frame--empty">
        Select a school, class, and section with student results.
      </div>
    );
  }

  return (
    <PosterRenderer
      template={template}
      posterData={posterData}
      onCanvasReady={onCanvasReady}
    />
  );
}

