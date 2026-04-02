import OBR from "https://unpkg.com/@owlbear-rodeo/sdk?module";
import { normalize } from "./utils.js";

const ID = "simple-flying-v2";
const Z_MIN = 5;
const Z_MAX = 60;

export async function toggleFlying(token) {

  let meta = token.metadata[ID] || {
    flying: false,
    z: Z_MIN,
    shadowId: null,
    base: { ...token.position }
  };

  if (!meta.flying) {
    meta.flying = true;
  } else {
    meta.flying = false;
  }

  return meta;
}

export async function updateVisual(token) {
  const meta = token.metadata[ID];
  if (!meta?.flying) return;

  const [shadow] = await OBR.scene.items.getItems([meta.shadowId]);
  if (!shadow) return;

  const t = normalize(meta.z, Z_MIN, Z_MAX);

  await OBR.scene.items.updateItems([token.id, shadow.id], items => {

    const k = items.find(i => i.id === token.id);
    const s = items.find(i => i.id === shadow.id);

    // shadow
    s.position = { ...meta.base };

    const sScale = Math.max(0.4, 1 - t * 0.5);
    s.scale = { x: sScale, y: sScale };
    s.opacity = 0.3 - t * 0.2;

    // token
    const offset = t * 50;

    k.position.x = meta.base.x - offset;
    k.position.y = meta.base.y + offset;

    const kScale = 1 + t * 0.2;

    k.scale = {
      x: kScale,
      y: kScale * 0.9
    };
  });
}
