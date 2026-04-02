import OBR from "https://unpkg.com/@owlbear-rodeo/sdk?module";

const ID = "simple-flying";

// Opret shadow
export async function createShadow(token) {

  const shadow = {
    id: crypto.randomUUID(),
    type: "IMAGE",
    name: "Shadow",
    layer: "MAP",
    locked: true,
    position: token.position,
    scale: token.scale,
    opacity: 0.5,
    tint: "#000000"
  };

  await OBR.scene.items.addItems([shadow]);

  return shadow.id;
}

// Fjern shadow
export async function removeShadow(shadowId) {
  if (!shadowId) return;
  await OBR.scene.items.deleteItems([shadowId]);
}

// Opdater shadow position + scale
export async function updateShadow(tokenId) {

  const [token] = await OBR.scene.items.getItems([tokenId]);
  if (!token) return;

  const meta = token.metadata?.[ID];
  if (!meta?.shadowId) return;

  const scaleFactor = Math.max(0.3, 1 - meta.z / 100);

  await OBR.scene.items.updateItems([meta.shadowId], items => {

    const shadow = items[0];

    shadow.position = token.position;
    shadow.scale = {
      x: token.scale.x * scaleFactor,
      y: token.scale.y * scaleFactor
    };
  });
}
