import OBR, { buildShape } from "@owlbear-rodeo/sdk";

export function createShadow(item) {
  const width = item.shape?.width ?? item.width ?? 100;
  const height = item.shape?.height ?? item.height ?? 100;

  return buildShape({
    id: crypto.randomUUID(),

    shape: {
      type: "RECTANGLE",
      width,
      height,
    },

    position: {
      x: (item.position?.x ?? 0) + 40,
      y: (item.position?.y ?? 0) + 40,
    },

    rotation: item.rotation ?? 0,

    fillColor: "#000000",
    fillOpacity: 0.5,

    layer: "MAP",

    metadata: {
      "simple-flying-shadow": true,
      attachedTo: item.id,
    },
  });
}

export async function deleteShadow(id) {
  if (!id) return;
  await OBR.scene.items.deleteItems([id]);
}