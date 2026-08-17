export function fitCanvasSize(width, height, maxWidth = 760, maxHeight = 640) {
  if (!width || !height) return { width: 360, height: 450, scale: 1 };
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    scale,
  };
}

export function scaleElement(element, scaleX, scaleY) {
  return {
    ...element,
    x: element.x * scaleX,
    y: element.y * scaleY,
    width: element.width * scaleX,
    height: element.height * scaleY,
    style: {
      ...(element.style || {}),
      fontSize: element.style?.fontSize
        ? element.style.fontSize * Math.min(scaleX, scaleY)
        : element.style?.fontSize,
    },
  };
}

