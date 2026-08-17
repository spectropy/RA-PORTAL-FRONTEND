import * as fabric from "fabric";
import { resolveBinding } from "./posterBindings.js";
import { getLayout } from "./posterLayoutSerializer.js";

async function loadFabricImage(url) {
  if (!url) return null;
  try {
    return await fabric.Image.fromURL(url, { crossOrigin: "anonymous" });
  } catch (e) {
    return null;
  }
}

function createTextObject(element, value) {
  const style = element.style || {};
  const textbox = new fabric.Textbox(String(value || ""), {
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    fontFamily: style.fontFamily || "Inter",
    fontSize: style.fontSize || 32,
    fontWeight: style.fontWeight || 700,
    fontStyle: style.fontStyle || "normal",
    underline: Boolean(style.underline),
    charSpacing: style.letterSpacing || 0,
    lineHeight: style.lineHeight || 1.16,
    fill: style.color || "#0f172a",
    textAlign: style.textAlign || "center",
    backgroundColor: style.backgroundColor || "transparent",
    stroke: style.borderWidth ? style.borderColor || "#000000" : undefined,
    strokeWidth: style.borderWidth || 0,
    padding: style.padding || 8,
    selectable: false,
    evented: false,
  });

  textbox.set({
    posterElementId: element.id,
    binding: element.binding,
    elementType: "text",
    verticalAlign: style.verticalAlign || "middle",
  });

  return textbox;
}

async function createImageObject(element, value) {
  const style = element.style || {};
  const frame = new fabric.Rect({
    left: element.x - element.width / 2,
    top: element.y - element.height / 2,
    width: element.width,
    height: element.height,
    fill: style.backgroundColor || "rgba(251, 0, 0, 1)",
    stroke: style.borderWidth ? style.borderColor || "#000000" : undefined,
    strokeWidth: style.borderWidth || 0,
    rx: style.borderRadius || 0,
    ry: style.borderRadius || 0,
    originX: "left",
    originY: "top",
    selectable: false,
    evented: false,
  });

  frame.set({
    posterElementId: element.id,
    binding: element.binding,
    elementType: "image-frame",
  });

  const objects = [frame];

  const image = await loadFabricImage(value);
  if (image) {
    const padding = style.padding || 0;
    const availableWidth = Math.max(1, element.width - padding * 2);
    const availableHeight = Math.max(1, element.height - padding * 2);
    const fit = style.objectFit || "contain";
    const scale =
      fit === "cover"
        ? Math.max(availableWidth / image.width, availableHeight / image.height)
        : fit === "fill"
          ? null
          : Math.min(
              availableWidth / image.width,
              availableHeight / image.height,
            );

    if (scale == null) {
      image.set({
        left: element.x,
        top: element.y,
        scaleX: availableWidth / image.width,
        scaleY: availableHeight / image.height,
        originX: "center",
        originY: "center",
      });
    } else {
      image.set({
        left: element.x,
        top: element.y,
        scaleX: scale,
        scaleY: scale,
        originX: "center",
        originY: "center",
      });
    }

    image.set({ selectable: false, evented: false });
    objects.push(image);
  }

  return objects;
}

export async function renderPosterToFabricCanvas(canvas, template, posterData) {
  if (!canvas || !template) return null;

  const layout = getLayout(template);
  const width = layout.canvas?.width || template.canvas_width || 1080;
  const height = layout.canvas?.height || template.canvas_height || 1350;

  canvas.clear();
  canvas.setDimensions({ width, height });
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

  const background = await loadFabricImage(
    template.background_url || layout.canvas?.backgroundUrl,
  );
  if (background) {
    background.set({
      selectable: false,
      evented: false,
      originX: "left",
      originY: "top",
    });
    background.scaleToWidth(width);
    background.scaleToHeight(height);
    canvas.backgroundImage = background;
  } else {
    canvas.backgroundColor = "#ffffff";
  }

  for (const element of layout.elements || []) {
    const value = resolveBinding(posterData, element.binding);
    const object =
      element.type === "image"
        ? await createImageObject(element, value)
        : createTextObject(element, value);
    if (Array.isArray(object)) canvas.add(...object);
    else canvas.add(object);
  }

  canvas.renderAll();
  return canvas;
}
