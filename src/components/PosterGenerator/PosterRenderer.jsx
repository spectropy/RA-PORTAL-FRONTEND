import React, { useEffect, useRef } from "react";
import * as fabric from "fabric";
import { renderPosterToFabricCanvas } from "../../utils/posterFabricRenderer.js";

export default function PosterRenderer({ template, posterData, onCanvasReady }) {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !template) return undefined;

    const fabricCanvas = new fabric.StaticCanvas(canvasRef.current, {
      renderOnAddRemove: false,
    });
    fabricCanvasRef.current = fabricCanvas;
    let cancelled = false;

    renderPosterToFabricCanvas(fabricCanvas, template, posterData)
      .then(() => {
        if (!cancelled && fabricCanvasRef.current === fabricCanvas) {
          onCanvasReady?.(fabricCanvas);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to render poster:", error);
        onCanvasReady?.(null);
      });

    return () => {
      cancelled = true;
      onCanvasReady?.(null);
      fabricCanvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [template?.id, JSON.stringify(posterData)]);

  return (
    <div className="poster-preview-frame">
      <canvas ref={canvasRef} />
    </div>
  );
}
