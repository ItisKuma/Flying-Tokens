import OBR from "https://unpkg.com/@owlbear-rodeo/sdk?module";

// Opret shadow (clone af token)
export async function createShadow(token) {

  const shadow = structuredClone(token);

  shadow.id = crypto.randomUUID();

  // Gør den mørk og transparent
  shadow.opacity = 0.3;
  shadow.tint = "#000000";

  await OBR.scene.items.addItems([shadow]);

  return shadow.id;
}


// Fjern shadow
export async function removeShadow(id) {
  if (!id) return;
  await OBR.scene.items.deleteItems([id]);
}
