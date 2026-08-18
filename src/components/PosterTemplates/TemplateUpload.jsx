import React, { useState } from "react";
import { UploadCloud } from "lucide-react";

export default function TemplateUpload({ onCreate, busy }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }
    if (!file) {
      setError("Upload a PNG, JPG, or SVG poster background.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.onload = () => {
        onCreate({
          name: name.trim(),
          file,
          canvas_width: image.naturalWidth,
          canvas_height: image.naturalHeight,
        });
        URL.revokeObjectURL(objectUrl);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setError("Could not read image dimensions.");
      };
      image.src = objectUrl;
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      setError("Could not read image dimensions.");
    }
  };

  return (
    <form className="poster-upload-panel" onSubmit={handleSubmit}>
      <label>
        Template Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Top Students Gold"
        />
      </label>
      <label className="poster-file-drop">
        <UploadCloud size={22} />
        <strong>{file ? file.name : "Upload poster background"}</strong>
        <span>PNG, JPG, or SVG supported</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,.svg"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>
      {error && <div className="alert-banner alert-banner--error">{error}</div>}
      <button className="btn-link-primary" disabled={busy}>
        Create Template
      </button>
    </form>
  );
}
