import React, { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { exportCanvas } from "../../utils/posterExport.js";
import {
  buildExamWiseTopStudentsMessage,
  buildTopStudentsMessage,
  downloadTextFile,
} from "../../utils/posterMessage.js";

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

export default function PosterDownloadOptions({
  canvas,
  filename,
  posterData,
  schoolDetail,
  className,
  sectionName,
}) {
  const [format, setFormat] = useState("png");
  const [downloading, setDownloading] = useState(false);
  const [selectedSizeId, setSelectedSizeId] = useState("original");
  const [showMessagePreview, setShowMessagePreview] = useState(false);
  const [messagePreview, setMessagePreview] = useState("");
  const [messageCopied, setMessageCopied] = useState(false);

  const selectedSize = PLATFORM_SIZES.find(
    (size) => size.id === selectedSizeId,
  ) || PLATFORM_SIZES[0];

  const runPosterDownload = async () => {
    if (!canvas || downloading) return;

    setDownloading(true);
    try {
      await exportCanvas(canvas, {
        format,
        filename,
        targetSize:
          selectedSize.id === "original"
            ? null
            : {
                label: selectedSize.label,
                width: selectedSize.width,
                height: selectedSize.height,
              },
      });
    } finally {
      setDownloading(false);
    }
  };

  const buildMessage = () => {
    if (downloading || !posterData) return;

    const resolvedClassName = posterData.className || className || "";
    const resolvedSection = posterData.sectionName || sectionName || "";
    const resolvedSchoolName =
      posterData.school?.name ||
      schoolDetail?.school_name ||
      schoolDetail?.name ||
      "";
    const resolvedSchoolArea =
      schoolDetail?.school_area ||
      schoolDetail?.area ||
      schoolDetail?.schoolArea ||
      schoolDetail?.address ||
      "";

    const messageBuilder = posterData.exam
      ? buildExamWiseTopStudentsMessage
      : buildTopStudentsMessage;

    return messageBuilder({
      className: resolvedClassName,
      section: resolvedSection,
      schoolName: resolvedSchoolName,
      schoolArea: resolvedSchoolArea,
      examName: posterData.exam?.name || posterData.exam?.pattern || "",
      examDate: posterData.exam?.date || "",
    });
  };

  const openMessagePreview = () => {
    const message = buildMessage();
    if (!message) return;
    setMessagePreview(message);
    setMessageCopied(false);
    setShowMessagePreview(true);
  };

  const copyMessage = async () => {
    if (!messagePreview) return;

    try {
      await navigator.clipboard.writeText(messagePreview);
      setMessageCopied(true);
      window.setTimeout(() => setMessageCopied(false), 2000);
    } catch {
      setMessageCopied(false);
    }
  };

  const runMessageDownload = () => {
    if (!messagePreview || downloading) return;

    downloadTextFile(messagePreview, `${filename}_Message.txt`);
    setShowMessagePreview(false);
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
        <label>
          Select Download Size
          <select
            value={selectedSizeId}
            onChange={(e) => setSelectedSizeId(e.target.value)}
            disabled={downloading}
          >
            {PLATFORM_SIZES.map((size) => (
              <option key={size.id} value={size.id}>
                {size.label}
                {size.width && size.height
                  ? ` - ${size.width} x ${size.height}`
                  : " - Use template canvas"}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn-link-primary"
          disabled={!canvas || downloading}
          onClick={runPosterDownload}
        >
          {downloading ? <span className="spinner" /> : <Download size={16} />}
          {downloading ? "Preparing..." : "Download Poster"}
        </button>
        <button
          className="poster-secondary-btn"
          disabled={!posterData || downloading}
          onClick={openMessagePreview}
        >
          <Download size={16} />
          Download Message
        </button>
      </div>

      {showMessagePreview && (
        <div className="poster-modal-backdrop">
          <div className="poster-size-dialog" role="dialog" aria-modal="true">
            <div className="poster-size-dialog__head">
              <div>
                <h3>Message Preview</h3>
                <p>Review the message before downloading it.</p>
              </div>
              <button
                type="button"
                className="poster-copy-btn"
                onClick={copyMessage}
                aria-label="Copy response"
                title="Copy response"
              >
                {messageCopied ? <Check size={15} /> : <Copy size={15} />}
                {messageCopied ? "Copied" : "Copy response"}
              </button>
            </div>
            <pre
              style={{
                maxHeight: "420px",
                overflowY: "auto",
                margin: "0 0 16px",
                padding: "14px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                border: "1px solid #dbe3ef",
                borderRadius: "8px",
                background: "#f8fafc",
                font: "inherit",
                lineHeight: 1.5,
              }}
            >
              {messagePreview}
            </pre>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="poster-secondary-btn"
                onClick={() => setShowMessagePreview(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-link-primary"
                onClick={runMessageDownload}
              >
                <Download size={16} />
                Download Message
              </button>
            </div>
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
