import React from "react";

const FONT_WEIGHTS = [400, 500, 600, 700, 800];
const FONT_FAMILIES = [
  "Inter",
  "Arial",
  "Georgia",
  "Times New Roman",
  "Verdana",
  "Trebuchet MS",
  "Courier New",
  "Poppins",
  "Montserrat",
];
const IMAGE_FIT_OPTIONS = ["contain", "cover", "fill"];

function colorInputValue(value, fallback = "#ffffff") {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;
}

export default function ElementProperties({ selected, onChange, onDelete }) {
  if (!selected) {
    return (
      <aside className="poster-side-panel">
        <h3>Properties</h3>
        <div className="poster-empty poster-empty--compact">
          Select an element on the canvas.
        </div>
      </aside>
    );
  }

  const isText = selected.type === "textbox" || selected.elementType === "text";
  const isImageContainer = selected.elementType === "image";
  const selectedWidth = Math.round(
    selected.getScaledWidth?.() || selected.width || 0,
  );
  const selectedHeight = Math.round(
    selected.getScaledHeight?.() || selected.height || 0,
  );
  const maxBorderRadius = Math.floor(Math.min(selectedWidth, selectedHeight) / 2);
  const borderRadius = Math.round(selected.rx ?? selected.ry ?? 0);
  const imageFill = selected.fill || "transparent";

  return (
    <aside className="poster-side-panel">
      <h3>Properties</h3>
      <div className="poster-props-grid">
        <label>
          X
          <input
            type="number"
            value={Math.round(selected.left || 0)}
            onChange={(e) => onChange({ left: Number(e.target.value) })}
          />
        </label>
        <label>
          Y
          <input
            type="number"
            value={Math.round(selected.top || 0)}
            onChange={(e) => onChange({ top: Number(e.target.value) })}
          />
        </label>
        <label>
          Width
          <input
            type="number"
            value={selectedWidth}
            onChange={(e) => onChange({ width: Number(e.target.value), scaleX: 1 })}
          />
        </label>
        <label>
          Height
          <input
            type="number"
            value={selectedHeight}
            onChange={(e) => onChange({ height: Number(e.target.value), scaleY: 1 })}
          />
        </label>

        {isText && (
          <>
            <label className="poster-prop-wide">
              Font Family
              <select
                value={selected.fontFamily || "Inter"}
                onChange={(e) => onChange({ fontFamily: e.target.value })}
              >
                {FONT_FAMILIES.map((family) => (
                  <option key={family} value={family}>
                    {family}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Font Size
              <input
                type="number"
                value={selected.fontSize || 32}
                onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
              />
            </label>
            <label>
              Weight
              <select
                value={selected.fontWeight || 700}
                onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}
              >
                {FONT_WEIGHTS.map((weight) => (
                  <option key={weight} value={weight}>
                    {weight}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Style
              <select
                value={selected.fontStyle || "normal"}
                onChange={(e) => onChange({ fontStyle: e.target.value })}
              >
                <option value="normal">Normal</option>
                <option value="italic">Italic</option>
              </select>
            </label>
            <label>
              Underline
              <select
                value={selected.underline ? "yes" : "no"}
                onChange={(e) => onChange({ underline: e.target.value === "yes" })}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
            <label>
              Color
              <input
                type="color"
                value={selected.fill || "#0f172a"}
                onChange={(e) => onChange({ fill: e.target.value })}
              />
            </label>
            <label>
              Align
              <select
                value={selected.textAlign || "center"}
                onChange={(e) => onChange({ textAlign: e.target.value })}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
            <label>
              Line Height
              <input
                type="number"
                min="0.8"
                max="3"
                step="0.05"
                value={selected.lineHeight || 1.16}
                onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
              />
            </label>
            <label>
              Letter Space
              <input
                type="number"
                value={selected.charSpacing || 0}
                onChange={(e) => onChange({ charSpacing: Number(e.target.value) })}
              />
            </label>
          </>
        )}

        <label>
          Border
          <input
            type="number"
            min="0"
            value={selected.strokeWidth ?? 0}
            onChange={(e) => {
              const strokeWidth = Number(e.target.value);
              onChange({
                strokeWidth,
                stroke: strokeWidth > 0 ? selected.stroke || "#000000" : undefined,
              });
            }}
          />
        </label>
        <label>
          Border Color
          <input
            type="color"
            value={selected.stroke || "#000000"}
            onChange={(e) => onChange({ stroke: e.target.value })}
          />
        </label>
        {isImageContainer && (
          <>
            <label className="poster-prop-wide">
              Image Fit
              <select
                value={selected.objectFit || "contain"}
                onChange={(e) => onChange({ objectFit: e.target.value })}
              >
                {IMAGE_FIT_OPTIONS.map((fit) => (
                  <option key={fit} value={fit}>
                    {fit}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fill
              <input
                type="color"
                value={colorInputValue(imageFill)}
                onChange={(e) => onChange({ fill: e.target.value })}
              />
            </label>
            <label>
              Transparent
              <select
                value={imageFill === "transparent" ? "yes" : "no"}
                onChange={(e) =>
                  onChange({
                    fill: e.target.value === "yes" ? "transparent" : "#ffffff",
                  })
                }
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
            <label className="poster-prop-wide">
              Border Radius
              <input
                type="range"
                min="0"
                max={maxBorderRadius}
                value={Math.min(borderRadius, maxBorderRadius)}
                onChange={(e) => {
                  const radius = Number(e.target.value);
                  onChange({ rx: radius, ry: radius, borderRadius: radius });
                }}
              />
            </label>
          </>
        )}
      </div>
      <button className="poster-danger-btn" type="button" onClick={onDelete}>
        Delete Element
      </button>
    </aside>
  );
}
