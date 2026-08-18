import React, { useState } from "react";
import { Download } from "lucide-react";
import { exportCanvas } from "../../utils/posterExport.js";

const PLATFORM_SIZES = [
  { id: "original", label: "Original Size", width: null, height: null },
  { id: "instagram-square", label: "Instagram Square", width: 1080, height: 1080 },
  { id: "instagram-portrait", label: "Instagram Portrait", width: 1080, height: 1350 },
  { id: "instagram-story", label: "Instagram Story", width: 1080, height: 1920 },
  { id: "facebook-post", label: "Facebook Post", width: 1200, height: 630 },
  { id: "linkedin-post", label: "LinkedIn Post", width: 1200, height: 627 },
  { id: "linkedin-square", label: "LinkedIn Square", width: 1080, height: 1080 },
  { id: "whatsapp-status", label: "WhatsApp Status", width: 1080, height: 1920 },
];

export default function PosterDownloadOptions({ canvas, filename }) {
  const [format, setFormat] = useState("png");
  const [downloading, setDownloading] = useState(false);
  const [showSizePicker, setShowSizePicker] = useState(false);

  const runDownload = async (size) => {
    if (!canvas || downloading) return;

    setShowSizePicker(false);
    setDownloading(true);
    try {
      await exportCanvas(canvas, {
        format,
        filename,
        targetSize:
          size?.id === "original"
            ? null
            : {
                label: size.label,
                width: size.width,
                height: size.height,
              },
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleDownload = () => {
    if (!canvas || downloading) return;

    if (format === "pdf") {
      runDownload(PLATFORM_SIZES[0]);
      return;
    }

    setShowSizePicker(true);
  };

  return (
    <>
      <div className="poster-download-panel">
        <label>
          Format
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            disabled={downloading}
          >
            <option value="png">PNG - Recommended</option>
            <option value="jpg">JPG</option>
            <option value="pdf">PDF</option>
          </select>
        </label>
        <button
          className="btn-link-primary"
          disabled={!canvas || downloading}
          onClick={handleDownload}
        >
          {downloading ? <span className="spinner" /> : <Download size={16} />}
          {downloading ? "Preparing..." : "Download Poster"}
        </button>
      </div>

      {showSizePicker && (
        <div className="poster-modal-backdrop">
          <div className="poster-size-dialog">
            <div className="poster-size-dialog__head">
              <h3>Select Download Size</h3>
              <p>The poster will be contained inside the selected frame with white space if needed.</p>
            </div>
            <div className="poster-size-options">
              {PLATFORM_SIZES.map((size) => (
                <button
                  type="button"
                  key={size.id}
                  onClick={() => runDownload(size)}
                >
                  <strong>{size.label}</strong>
                  <span>
                    {size.width && size.height
                      ? `${size.width} x ${size.height}`
                      : "Use template canvas"}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="poster-secondary-btn"
              onClick={() => setShowSizePicker(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {downloading && (
        <div className="poster-download-overlay" role="status" aria-live="polite">
          <div className="poster-download-dialog">
            <span className="poster-download-spinner" />
            <strong>Preparing poster</strong>
            <p>Please wait while the poster file is being generated.</p>
          </div>
        </div>
      )}
    </>
  );
}
