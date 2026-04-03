import OBR from "@owlbear-rodeo/sdk";

export function createShadow(item) {
  return {
    id: crypto.randomUUID(),

    shape: {
      type: "RECTANGLE",
      width: item.shape.width,
      height: item.shape.height,
    },

    position: {
      x: item.position.x + 40,
      y: item.position.y + 40,
    },

    rotation: item.rotation,

    fill: {
      color: "#000000",
      opacity: 0.5,
    },

    layer: "MAP",

    metadata: {
      "simple-flying-shadow": true,
      attachedTo: item.id,
    },
  };
}

export async function deleteShadow(id) {
  if (!id) return;
  await OBR.scene.items.deleteItems([id]);
}