import React, { useState } from "react";
import { Download } from "lucide-react";
import { exportCanvas } from "../../utils/posterExport.js";

export default function PosterDownloadOptions({ canvas, filename }) {
  const [format, setFormat] = useState("png");

  return (
    <div className="poster-download-panel">
      <label>
        Format
        <select value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="png">PNG - Recommended</option>
          <option value="jpg">JPG</option>
          <option value="pdf">PDF</option>
        </select>
      </label>
      <button
        className="btn-link-primary"
        disabled={!canvas}
        onClick={() => exportCanvas(canvas, { format, filename })}
      >
        <Download size={16} />
        Download Poster
      </button>
    </div>
  );
}

