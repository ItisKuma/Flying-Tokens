import OBR from "https://unpkg.com/@owlbear-rodeo/sdk?module";
import { createShadow, removeShadow, updateShadow } from "./shadow.js";

const ID = "simple-flying";

function getMeta(item) {
  return item.metadata[ID] ?? {
    flying: false,
    z: 0,
    shadowId: null
  };
}

//  Toggle flying
export async function toggleFlyingState(id) {

  await OBR.scene.items.updateItems([id], async items => {

    const item = items[0];
    const meta = getMeta(item);

    meta.flying = !meta.flying;

    if (meta.flying) {
      meta.shadowId = await createShadow(item);
    } else {
      await removeShadow(meta.shadowId);
      meta.shadowId = null;
      meta.z = 0;
    }

    item.metadata[ID] = meta;
  });
}

//  Set Z
export async function setZ(id, z) {

  await OBR.scene.items.updateItems([id], items => {

    const item = items[0];
    const meta = getMeta(item);

    if (!meta.flying) return;

    meta.z = z;
    item.metadata[ID] = meta;
  });

  // opdater shadow efter ændring
  await updateShadow(id);
}
