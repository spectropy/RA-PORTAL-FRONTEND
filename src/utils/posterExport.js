import jsPDF from "jspdf";

export function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

async function frameDataUrl(dataUrl, sourceWidth, sourceHeight, targetSize, format) {
  if (!targetSize?.width || !targetSize?.height) return dataUrl;

  const image = await loadImageFromDataUrl(dataUrl);
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = targetSize.width;
  outputCanvas.height = targetSize.height;

  const context = outputCanvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

  const scale = Math.min(
    outputCanvas.width / sourceWidth,
    outputCanvas.height / sourceHeight,
  );
  const drawWidth = Math.round(sourceWidth * scale);
  const drawHeight = Math.round(sourceHeight * scale);
  const drawX = Math.round((outputCanvas.width - drawWidth) / 2);
  const drawY = Math.round((outputCanvas.height - drawHeight) / 2);

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  return outputCanvas.toDataURL(
    format === "jpg" ? "image/jpeg" : "image/png",
    format === "jpg" ? 0.92 : undefined,
  );
}

export async function exportCanvas(
  canvas,
  { format = "png", filename = "poster", targetSize = null } = {},
) {
  if (!canvas) return;
  await waitForPaint();

  const isFabricCanvas =
    typeof canvas.toDataURL === "function" && canvas.lowerCanvasEl;
  if (isFabricCanvas && typeof canvas.renderAll === "function") {
    // Capture the fully rendered Fabric canvas. Do not use a large Fabric
    // multiplier here; Fabric 7 can export a blank/transparent bitmap when
    // background images and clip paths are scaled during toDataURL().
    canvas.renderAll();
  }
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
  const finalDataUrl = await frameDataUrl(dataUrl, width, height, targetSize, format);
  const suffix = targetSize?.label
    ? `_${targetSize.label.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "")}`
    : "";
  downloadDataUrl(finalDataUrl, `${filename}${suffix}.${format}`);
}
