export function emptyPosterLayout(template) {
  return {
    version: 1,
    category: "top_students",
    canvas: {
      width: template?.canvas_width || template?.canvasWidth || 1080,
      height: template?.canvas_height || template?.canvasHeight || 1350,
      backgroundUrl: template?.background_url || template?.backgroundUrl || "",
    },
    elements: [],
  };
}

export function serializeFabricCanvas(canvas, template) {
  const base = emptyPosterLayout(template);
  const objects = canvas
    .getObjects()
    .filter((object) => object.posterElementId && object.binding);

  return {
    ...base,
    elements: objects.map((object) => {
      const elementType = object.elementType || "text";
      const scaleX = object.scaleX || 1;
      const scaleY = object.scaleY || 1;
      const width = object.width || 0;
      const height = object.height || 0;

      return {
        id: object.posterElementId,
        type: elementType,
        binding: object.binding,
        x: Math.round(object.left || 0),
        y: Math.round(object.top || 0),
        width: Math.round(width * scaleX),
        height: Math.round(height * scaleY),
        style: {
          fontFamily: object.fontFamily || "Inter",
          fontSize: Math.round(object.fontSize || 32),
          fontWeight: object.fontWeight || 700,
          fontStyle: object.fontStyle || "normal",
          underline: Boolean(object.underline),
          color: object.fill || "#0f172a",
          letterSpacing: object.charSpacing || 0,
          lineHeight: object.lineHeight || 1.16,
          textAlign: object.textAlign || "center",
          verticalAlign: object.verticalAlign || "middle",
          borderWidth: object.strokeWidth ?? 0,
          borderColor: object.stroke || "#000000",
          borderRadius: object.borderRadius ?? object.rx ?? 0,
          backgroundColor:
            elementType === "image"
              ? object.fill || "transparent"
              : object.backgroundColor || "transparent",
          padding: object.padding ?? (elementType === "image" ? 0 : 8),
          objectFit: object.objectFit || "contain",
        },
      };
    }),
  };
}

export function getLayout(template) {
  return template?.layout_json || template?.layoutJson || emptyPosterLayout(template);
}
