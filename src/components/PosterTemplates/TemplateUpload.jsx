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
      setError("Upload a PNG or JPG poster background.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        onCreate({
          name: name.trim(),
          background_url: reader.result,
          thumbnail_url: reader.result,
          canvas_width: image.naturalWidth,
          canvas_height: image.naturalHeight,
        });
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
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
        <span>PNG or JPG recommended</span>
        <input
          type="file"
          accept="image/png,image/jpeg"
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

