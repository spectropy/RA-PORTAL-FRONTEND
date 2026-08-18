import React, { useEffect, useRef } from "react";
import * as fabric from "fabric";
import { getLayout } from "../../utils/posterLayoutSerializer.js";
import { getVariableByBinding } from "../../config/posterVariables.js";

async function loadImage(url) {
  if (!url) return null;
  return fabric.Image.fromURL(url, { crossOrigin: "anonymous" });
}

export default function PosterCanvas({
  template,
  activeCanvas,
  onCanvasReady,
  onSelectionChange,
  onCanvasChanged,
}) {
  const canvasEl = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!canvasEl.current || !template) return;

    const layout = getLayout(template);
    const canvas = new fabric.Canvas(canvasEl.current, {
      width: template.canvas_width,
      height: template.canvas_height,
      preserveObjectStacking: true,
      selection: true,
    });
    canvas.editorViewportElement = wrapRef.current;
    let isPanning = false;
    let lastPanX = 0;
    let lastPanY = 0;

    const handleWheelZoom = (opt) => {
      const event = opt.e;
      if (!event.ctrlKey) return;

      let zoom = canvas.getZoom();
      zoom *= 0.999 ** event.deltaY;
      zoom = Math.min(Math.max(zoom, 0.25), 4);
      canvas.zoomToPoint(new fabric.Point(event.offsetX, event.offsetY), zoom);
      event.preventDefault();
      event.stopPropagation();
    };

    const handleMouseDown = (opt) => {
      const event = opt.e;
      if (!event.ctrlKey) return;

      isPanning = true;
      lastPanX = event.clientX;
      lastPanY = event.clientY;
      canvas.selection = false;
      canvas.defaultCursor = "grabbing";
      canvas.hoverCursor = "grabbing";
      canvas.discardActiveObject();
      canvas.renderAll();
      event.preventDefault();
      event.stopPropagation();
    };

    const handleMouseMove = (opt) => {
      if (!isPanning) return;

      const event = opt.e;
      const viewportTransform = canvas.viewportTransform;
      viewportTransform[4] += event.clientX - lastPanX;
      viewportTransform[5] += event.clientY - lastPanY;
      canvas.requestRenderAll();
      lastPanX = event.clientX;
      lastPanY = event.clientY;
      event.preventDefault();
      event.stopPropagation();
    };

    const stopPanning = () => {
      if (!isPanning) return;
      isPanning = false;
      canvas.selection = true;
      canvas.defaultCursor = "default";
      canvas.hoverCursor = "move";
      canvas.setViewportTransform(canvas.viewportTransform);
    };

    const load = async () => {
      const bg = await loadImage(template.background_url);
      if (bg) {
        bg.set({
          selectable: false,
          evented: false,
          originX: "left",
          originY: "top",
        });
        bg.scaleToWidth(template.canvas_width);
        bg.scaleToHeight(template.canvas_height);
        canvas.backgroundImage = bg;
      }

      for (const element of layout.elements || []) {
        const variable = getVariableByBinding(element.binding);
        if (element.type === "image") {
          const rect = new fabric.Rect({
            left: element.x,
            top: element.y,
            width: element.width,
            height: element.height,
            fill:
              element.style?.backgroundColor === undefined
                ? "rgba(239,246,255,0.72)"
                : element.style.backgroundColor,
            stroke:
              (element.style?.borderWidth ?? 0) > 0
                ? element.style?.borderColor || "#000000"
                : undefined,
            strokeWidth: element.style?.borderWidth ?? 0,
            rx: element.style?.borderRadius ?? 8,
            ry: element.style?.borderRadius ?? 8,
          });
          rect.set({
            posterElementId: element.id,
            binding: element.binding,
            elementType: "image",
            objectFit: element.style?.objectFit || "contain",
          });
          canvas.add(rect);
        } else {
          const textbox = new fabric.Textbox(
            variable?.sample || element.binding,
            {
              left: element.x,
              top: element.y,
              width: element.width,
              height: element.height,
              fontFamily: element.style?.fontFamily || "Inter",
              fontSize: element.style?.fontSize || 32,
              fontWeight: element.style?.fontWeight || 700,
              fontStyle: element.style?.fontStyle || "normal",
              underline: Boolean(element.style?.underline),
              charSpacing: element.style?.letterSpacing || 0,
              lineHeight: element.style?.lineHeight || 1.16,
              fill: element.style?.color || "#0f172a",
              textAlign: element.style?.textAlign || "center",
              backgroundColor: element.style?.backgroundColor || "transparent",
              stroke: element.style?.borderColor || undefined,
              strokeWidth: element.style?.borderWidth || 0,
              padding: element.style?.padding || 8,
            },
          );
          textbox.set({
            posterElementId: element.id,
            binding: element.binding,
            elementType: "text",
            verticalAlign: element.style?.verticalAlign || "middle",
          });
          canvas.add(textbox);
        }
      }

      canvas.renderAll();
      onCanvasReady(canvas);
    };

    const selectionHandler = () =>
      onSelectionChange(canvas.getActiveObject() || null);
    const changeHandler = () => onCanvasChanged?.(canvas);
    canvas.on("selection:created", selectionHandler);
    canvas.on("selection:updated", selectionHandler);
    canvas.on("selection:cleared", () => onSelectionChange(null));
    canvas.on("object:modified", selectionHandler);
    canvas.on("object:modified", changeHandler);
    canvas.on("object:added", changeHandler);
    canvas.on("object:removed", changeHandler);
    canvas.on("object:moving", selectionHandler);
    canvas.on("object:scaling", selectionHandler);
    canvas.on("mouse:wheel", handleWheelZoom);
    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", stopPanning);

    load();

    return () => {
      canvas.off("mouse:wheel", handleWheelZoom);
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", stopPanning);
      canvas.off("object:modified", changeHandler);
      canvas.off("object:added", changeHandler);
      canvas.off("object:removed", changeHandler);
      if (activeCanvas === canvas) onCanvasReady(null);
      canvas.dispose();
    };
  }, [template?.id]);

  return (
    <div className="poster-canvas-wrap" ref={wrapRef}>
      <canvas ref={canvasEl} />
    </div>
  );
}
