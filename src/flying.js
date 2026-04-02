import OBR from "https://unpkg.com/@owlbear-rodeo/sdk?module";
import { normalize } from "./utils.js";

const ID = "simple-flying";

// Minimum højde (under dette flyver man ikke)
const Z_MIN = 5;

// Max højde (UI range)
const Z_MAX = 60;


//  Toggle flying state
export function toggleFlying(token) {

  let meta = token.metadata[ID] || {
    flying: false,
    z: Z_MIN,
    shadowId: null,

    // Base position = hvor token står på jorden
    base: { ...token.position }
  };

  // Skift true/false
  meta.flying = !meta.flying;

  return meta;
}


//  Opdater hvordan token ser ud
export async function updateVisual(token) {

  const meta = token.metadata[ID];
  if (!meta?.flying) return;

  // Hent shadow
  const [shadow] = await OBR.scene.items.getItems([meta.shadowId]);
  if (!shadow) return;

  // Konverter Z til 0 → 1
  const t = normalize(meta.z, Z_MIN, Z_MAX);

  await OBR.scene.items.updateItems([token.id, shadow.id], items => {

    const k = items.find(i => i.id === token.id); // K-token
    const s = items.find(i => i.id === shadow.id); // Shadow

    //  SHADOW
    // Shadow bliver på jorden (base position)
    s.position = { ...meta.base };

    // Shadow bliver mindre jo højere man flyver
    const sScale = Math.max(0.4, 1 - t * 0.5);
    s.scale = { x: sScale, y: sScale };

    // Shadow bliver mere gennemsigtig
    s.opacity = 0.3 - t * 0.2;


    // 🧍 TOKEN (det der flyver)
    const offset = t * 50;

    // Flyt diagonalt (illusion af højde)
    k.position.x = meta.base.x - offset;
    k.position.y = meta.base.y + offset;

    // Gør token større jo højere det er
    const kScale = 1 + t * 0.2;

    k.scale = {
      x: kScale,
      y: kScale * 0.9 // lidt oval (perspektiv)
    };
  });
}
