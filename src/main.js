import OBR from "https://unpkg.com/@owlbear-rodeo/sdk?module";

import { initSelection, selectedId } from "./state.js";
import { createShadow, removeShadow } from "./shadow.js";
import { toggleFlying, updateVisual } from "./flying.js";

const ID = "simple-flying";

// Wait for Owlbear to be ready
OBR.onReady(() => {

  // Start tracking selected token
  initSelection();

  // Toggle flying button
  document.getElementById("toggle").onclick = async () => {

    if (!selectedId) return;

    const [token] = await OBR.scene.items.getItems([selectedId]);
    if (!token) return;

    let meta = toggleFlying(token);

    if (meta.flying) {
      // Create shadow
      meta.shadowId = await createShadow(token);
    } else {
      // Remove shadow
      await removeShadow(meta.shadowId);
      meta.shadowId = null;
    }

    // Save metadata
    await OBR.scene.items.updateItems([token.id], items => {
      items[0].metadata[ID] = meta;
    });

    updateVisual(token);
  };

  // Height slider
  document.getElementById("z").oninput = async (e) => {

    if (!selectedId) return;

    const z = Number(e.target.value);

    await OBR.scene.items.updateItems([selectedId], items => {

      const t = items[0];
      const meta = t.metadata[ID];

      if (!meta?.flying) return;

      meta.z = z;
      t.metadata[ID] = meta;
    });

    const [token] = await OBR.scene.items.getItems([selectedId]);
    updateVisual(token);
  };
});
