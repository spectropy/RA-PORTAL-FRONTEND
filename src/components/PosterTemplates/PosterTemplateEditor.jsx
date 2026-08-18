import React, { useCallback, useEffect, useRef, useState } from "react";
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
  const [, refreshProperties] = useState(0);
  const canvasRef = useRef(null);
  const historyRef = useRef([]);
  const restoringHistoryRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);

  const makeCanvasSnapshot = useCallback((fabricCanvas) => {
    return JSON.stringify(
      fabricCanvas.toDatalessJSON([
        "posterElementId",
        "binding",
        "elementType",
        "verticalAlign",
        "objectFit",
      ]),
    );
  }, []);

  const pushHistory = useCallback(
    (fabricCanvas = canvasRef.current) => {
      if (!fabricCanvas || restoringHistoryRef.current) return;

      const snapshot = makeCanvasSnapshot(fabricCanvas);
      const history = historyRef.current;
      if (history[history.length - 1] === snapshot) return;

      history.push(snapshot);
      if (history.length > 50) history.shift();
      setCanUndo(history.length > 1);
    },
    [makeCanvasSnapshot],
  );

  const handleCanvasReady = useCallback(
    (fabricCanvas) => {
      canvasRef.current = fabricCanvas;
      setCanvas(fabricCanvas);
      setSelected(null);
      historyRef.current = [];

      if (fabricCanvas) {
        pushHistory(fabricCanvas);
      } else {
        setCanUndo(false);
      }
    },
    [pushHistory],
  );

  const undoLastChange = useCallback(async () => {
    const fabricCanvas = canvasRef.current;
    if (!fabricCanvas || historyRef.current.length <= 1) return;

    restoringHistoryRef.current = true;
    historyRef.current.pop();
    const previousSnapshot = historyRef.current[historyRef.current.length - 1];

    await Promise.resolve(fabricCanvas.loadFromJSON(previousSnapshot));
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
    setSelected(null);
    setCanUndo(historyRef.current.length > 1);
    restoringHistoryRef.current = false;
  }, []);

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
        background_url: "",
        thumbnail_url: null,
        layout_json: emptyPosterLayout(payload),
      }, { remoteOnly: true });
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
        stroke: undefined,
        strokeWidth: 0,
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
    pushHistory(canvas);
  };

  const updateSelected = (patch) => {
    if (!selected || !canvas) return;
    selected.set(patch);
    selected.setCoords();
    canvas.renderAll();
    setSelected(selected);
    refreshProperties((version) => version + 1);
    pushHistory(canvas);
  };

  const deleteSelected = useCallback(() => {
    if (!selected || !canvas) return;
    canvas.remove(selected);
    canvas.discardActiveObject();
    canvas.renderAll();
    setSelected(null);
    pushHistory(canvas);
  }, [canvas, pushHistory, selected]);

  useEffect(() => {
    const isEditableTarget = (target) => {
      const tagName = target?.tagName?.toLowerCase();
      return (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target?.isContentEditable
      );
    };

    const handleKeyDown = (event) => {
      if (isEditableTarget(event.target)) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoLastChange();
        return;
      }

      if (!selected || !canvas || selected.isEditing) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
        return;
      }

      const moveByKey = {
        ArrowLeft: { left: -1, top: 0 },
        ArrowRight: { left: 1, top: 0 },
        ArrowUp: { left: 0, top: -1 },
        ArrowDown: { left: 0, top: 1 },
      }[event.key];

      if (!moveByKey) return;

      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      selected.set({
        left: Math.round((selected.left || 0) + moveByKey.left * step),
        top: Math.round((selected.top || 0) + moveByKey.top * step),
      });
      selected.setCoords();
      canvas.renderAll();
      setSelected(selected);
      refreshProperties((version) => version + 1);
      pushHistory(canvas);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canvas, deleteSelected, pushHistory, selected, undoLastChange]);

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
        onUndo={undoLastChange}
        canUndo={canUndo}
        saving={saving}
      />
      <div className="poster-editor-grid">
        <VariablePanel onAddVariable={addVariable} />
        <PosterCanvas
          key={template.id}
          template={template}
          activeCanvas={canvas}
          onCanvasReady={handleCanvasReady}
          onSelectionChange={setSelected}
          onCanvasChanged={pushHistory}
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
