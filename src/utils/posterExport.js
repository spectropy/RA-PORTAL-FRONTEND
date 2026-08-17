import jsPDF from "jspdf";

export function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportCanvas(canvas, { format = "png", filename = "poster" }) {
  if (!canvas) return;
  const isFabricCanvas = typeof canvas.toDataURL === "function" && canvas.lowerCanvasEl;
  const width = isFabricCanvas ? canvas.getWidth() : canvas.width;
  const height = isFabricCanvas ? canvas.getHeight() : canvas.height;

  if (format === "pdf") {
    const dataUrl = isFabricCanvas
      ? canvas.toDataURL({ format: "png", multiplier: 1 })
      : canvas.toDataURL("image/png");
    const orientation = width >= height ? "landscape" : "portrait";
    const doc = new jsPDF({
      orientation,
      unit: "px",
      format: [width, height],
    });
    doc.addImage(dataUrl, "PNG", 0, 0, width, height);
    doc.save(`${filename}.pdf`);
    return;
  }

  const dataUrl = isFabricCanvas
    ? canvas.toDataURL({
        format: format === "jpg" ? "jpeg" : "png",
        quality: format === "jpg" ? 0.92 : 1,
        multiplier: 1,
      })
    : canvas.toDataURL(
        format === "jpg" ? "image/jpeg" : "image/png",
        format === "jpg" ? 0.92 : undefined,
      );
  downloadDataUrl(dataUrl, `${filename}.${format}`);
}
