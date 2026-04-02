import OBR from "https://unpkg.com/@owlbear-rodeo/sdk?module";

export async function createShadow(token) {
  const shadow = structuredClone(token);
  shadow.id = crypto.randomUUID();

  shadow.opacity = 0.3;
  shadow.tint = "#000000";

  await OBR.scene.items.addItems([shadow]);

  return shadow.id;
}

export async function removeShadow(id) {
  if (!id) return;
  await OBR.scene.items.deleteItems([id]);
}
