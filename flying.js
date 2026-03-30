import OBR from "https://unpkg.com/@owlbear-rodeo/sdk?module";
import { normalize } from "./utils.js";

const ID = "simple-flying";

// Min / max height
const Z_MIN = 5;
const Z_MAX = 60;

// Toggle flying state
export function toggleFlying(token) {
  let meta = token.metadata[ID] || {
    flying: false,
    z: Z_MIN,
    shadowId: null,
    base: { ...token.position }
  };

  meta.flying = !meta.flying;

  return meta;
}

// Update visuals (position, scale, shadow)
export async function updateVisual(token) {

  const meta = token.metadata[ID];
  if (!meta?.flying) return;

  const [shadow] = await OBR.scene.items.getItems([meta.shadowId]);
  if (!shadow) return;

  // Normalize height
  const t = normalize(meta.z, Z_MIN, Z_MAX);

  await OBR.scene.items.updateItems([token.id, shadow.id], items => {

    const k = items.find(i => i.id === token.id);
    const s = items.find(i => i.id === shadow.id);

    // Shadow stays on ground (true position)
    s.position = { ...meta.base };

    // Shadow gets smaller as height increases
    const sScale = Math.max(0.4, 1 - t * 0.5);
    s.scale = { x: sScale, y: sScale };

    s.opacity = 0.3 - t * 0.2;

    // Token moves diagonally (down + left)
    const offset = t * 50;

    k.position.x = meta.base.x - offset;
    k.position.y = meta.base.y + offset;

    // Token grows slightly
    const kScale = 1 + t * 0.2;

    k.scale = {
      x: kScale,
      y: kScale * 0.9 // slight oval effect
    };
  });
}
