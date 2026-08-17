import React, { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import * as fabric from "fabric";
import {
  createPosterTemplate,
  getPosterTemplate,
  updatePosterTemplate,
} from "../../api.js";
import {
  emptyPosterLayout,
  serializeFabricCanvas,
} from "../../utils/posterLayoutSerializer.js";
import ElementProperties from "./ElementProperties.jsx";
import PosterCanvas from "./PosterCanvas.jsx";
import PosterToolbar from "./PosterToolbar.jsx";
import TemplateUpload from "./TemplateUpload.jsx";
import VariablePanel from "./VariablePanel.jsx";

function makeElementId(binding) {
  return `${binding.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}`;
}

function getVisibleInsertPoint(canvas, template, width, height) {
  const viewport = canvas.editorViewportElement;
  const zoom = canvas.getZoom() || 1;
  const transform = canvas.viewportTransform || [zoom, 0, 0, zoom, 0, 0];

  const visibleCenterX = viewport
    ? viewport.scrollLeft + viewport.clientWidth / 2
    : template.canvas_width / 2;
  const visibleCenterY = viewport
    ? viewport.scrollTop + viewport.clientHeight / 2
    : template.canvas_height / 2;

  const canvasX = (visibleCenterX - transform[4]) / zoom;
  const canvasY = (visibleCenterY - transform[5]) / zoom;

  return {
    left: Math.max(
      0,
      Math.min(template.canvas_width - width, Math.round(canvasX - width / 2)),
    ),
    top: Math.max(
      0,
      Math.min(
        template.canvas_height - height,
        Math.round(canvasY - height / 2),
      ),
    ),
  };
}

export default function PosterTemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const [template, setTemplate] = useState(null);
  const [canvas, setCanvas] = useState(null);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("draft");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isNew) return;
    const loadTemplate = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getPosterTemplate(id);
        setTemplate(data);
        setStatus(data.status || "draft");
      } catch (e) {
        setError(e.message || "Failed to load template");
      } finally {
        setLoading(false);
      }
    };
    loadTemplate();
  }, [id, isNew]);

  const handleCreate = async (payload) => {
    setSaving(true);
    try {
      const created = await createPosterTemplate({
        ...payload,
        category: "top_students",
        status: "draft",
        layout_json: emptyPosterLayout(payload),
      });
      navigate(`/admin/poster-templates/${created.id}/edit`, { replace: true });
    } catch (e) {
      setError(e.message || "Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  const addVariable = (variable) => {
    if (!canvas) return;
    const textSize = { width: 520, height: 74 };
    const imageSize = { width: 140, height: 140 };

    if (variable.type === "image") {
      const position = getVisibleInsertPoint(
        canvas,
        template,
        imageSize.width,
        imageSize.height,
      );
      const rect = new fabric.Rect({
        left: position.left,
        top: position.top,
        width: imageSize.width,
        height: imageSize.height,
        fill: "rgba(239,246,255,0.78)",
        stroke: "#2563eb",
        strokeWidth: 2,
        rx: 12,
        ry: 12,
      });
      rect.set({
        posterElementId: makeElementId(variable.binding),
        binding: variable.binding,
        elementType: "image",
        objectFit: "contain",
      });
      canvas.add(rect);
      canvas.setActiveObject(rect);
    } else {
      const position = getVisibleInsertPoint(
        canvas,
        template,
        textSize.width,
        textSize.height,
      );
      const textbox = new fabric.Textbox(variable.sample || variable.label, {
        left: position.left,
        top: position.top,
        width: textSize.width,
        height: textSize.height,
        fontFamily: "Inter",
        fontSize: 34,
        fontWeight: 700,
        fontStyle: "normal",
        underline: false,
        charSpacing: 0,
        lineHeight: 1.16,
        fill: "#0f172a",
        textAlign: "center",
        backgroundColor: "transparent",
        padding: 8,
      });
      textbox.set({
        posterElementId: makeElementId(variable.binding),
        binding: variable.binding,
        elementType: "text",
        verticalAlign: "middle",
      });
      canvas.add(textbox);
      canvas.setActiveObject(textbox);
    }

    canvas.renderAll();
    setSelected(canvas.getActiveObject());
  };

  const updateSelected = (patch) => {
    if (!selected || !canvas) return;
    selected.set(patch);
    selected.setCoords();
    canvas.renderAll();
    setSelected({ ...selected });
  };

  const deleteSelected = () => {
    if (!selected || !canvas) return;
    canvas.remove(selected);
    canvas.discardActiveObject();
    canvas.renderAll();
    setSelected(null);
  };

  const saveTemplate = async () => {
    if (!template || !canvas) return;
    setSaving(true);
    setError("");
    try {
      const layout = serializeFabricCanvas(canvas, template);
      const updated = await updatePosterTemplate(template.id, {
        status,
        layout_json: layout,
        canvas_width: template.canvas_width,
        canvas_height: template.canvas_height,
        background_url: template.background_url,
        thumbnail_url: template.thumbnail_url || template.background_url,
      });
      setTemplate(updated);
    } catch (e) {
      setError(e.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  if (isNew) {
    return (
      <div className="poster-page">
        <button
          className="page-back-nav"
          onClick={() => navigate("/admin/poster-templates")}
        >
          <ArrowLeft size={15} />
          Back to Templates
        </button>
        <TemplateUpload onCreate={handleCreate} busy={saving} />
        {error && (
          <div className="alert-banner alert-banner--error">{error}</div>
        )}
      </div>
    );
  }

  if (loading) return <div className="poster-empty">Loading editor...</div>;
  if (error && !template)
    return <div className="alert-banner alert-banner--error">{error}</div>;

  return (
    <div className="poster-editor-page">
      <button
        className="page-back-nav"
        onClick={() => navigate("/admin/poster-templates")}
      >
        <ArrowLeft size={15} />
        Back to Templates
      </button>
      {error && <div className="alert-banner alert-banner--error">{error}</div>}
      <PosterToolbar
        template={template}
        status={status}
        onStatusChange={setStatus}
        onSave={saveTemplate}
        onDeleteSelected={deleteSelected}
        saving={saving}
      />
      <div className="poster-editor-grid">
        <VariablePanel onAddVariable={addVariable} />
        <PosterCanvas
          key={template.id}
          template={template}
          activeCanvas={canvas}
          onCanvasReady={setCanvas}
          onSelectionChange={setSelected}
        />
        <ElementProperties
          selected={selected}
          onChange={updateSelected}
          onDelete={deleteSelected}
        />
      </div>
    </div>
  );
}
