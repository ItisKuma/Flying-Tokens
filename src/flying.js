<<<<<<< HEAD
import OBR from "@owlbear-rodeo/sdk";
=======
import OBR from "https://unpkg.com/@owlbear-rodeo/sdk?module";
>>>>>>> 663484910b30287bb66b34542176094f2176fa07
import { createShadow, removeShadow, updateShadow } from "./shadow.js";

const ID = "simple-flying";

function getMeta(item) {
  return item.metadata[ID] ?? {
    flying: false,
    z: 0,
    shadowId: null
  };
}

<<<<<<< HEAD
export async function toggleFlyingState(id) {
=======
//  Toggle flying
export async function toggleFlyingState(id) {

>>>>>>> 663484910b30287bb66b34542176094f2176fa07
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

<<<<<<< HEAD
export async function setZ(id, z) {
=======
//  Set Z
export async function setZ(id, z) {

>>>>>>> 663484910b30287bb66b34542176094f2176fa07
  await OBR.scene.items.updateItems([id], items => {

    const item = items[0];
    const meta = getMeta(item);

    if (!meta.flying) return;

    meta.z = z;
    item.metadata[ID] = meta;
  });

<<<<<<< HEAD
  await updateShadow(id);
}
=======
  // opdater shadow efter ændring
  await updateShadow(id);
}
>>>>>>> 663484910b30287bb66b34542176094f2176fa07
