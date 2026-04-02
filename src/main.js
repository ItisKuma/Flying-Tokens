import OBR from "https://unpkg.com/@owlbear-rodeo/sdk?module";

import { initSelection, selectedId } from "./state.js";
import { createShadow, removeShadow } from "./shadow.js";
import { toggleFlying, updateVisual } from "./flying.js";
import { updateFlyingList } from "./list.js";

const ID = "simple-flying";

// Kører når Owlbear er klar
OBR.onReady(() => {

  // Starter listener der holder styr på valgt token
  initSelection();

  // 🔘 BUTTON: Toggle Flying
  document.getElementById("toggle").onclick = async () => {

    // Hvis intet token er valgt → stop
    if (!selectedId) return;

    // Hent token fra scenen
    const [token] = await OBR.scene.items.getItems([selectedId]);
    if (!token) return;

    // Skift flying state
    let meta = toggleFlying(token);

    if (meta.flying) {
      // Opret shadow hvis vi starter flying
      meta.shadowId = await createShadow(token);
    } else {
      // Fjern shadow hvis vi stopper flying
      await removeShadow(meta.shadowId);
      meta.shadowId = null;
    }

    // Gem metadata på token
    await OBR.scene.items.updateItems([token.id], items => {
      items[0].metadata[ID] = meta;
    });

    // Opdater visuals (position + scale)
    updateVisual(token);
    updateFlyingList();
  };

  // 🎚️ SLIDER: Z (højde)
  document.getElementById("z").oninput = async (e) => {

    if (!selectedId) return;

    const z = Number(e.target.value);

    // Opdater Z i metadata
    await OBR.scene.items.updateItems([selectedId], items => {

      const t = items[0];
      const meta = t.metadata[ID];

      // Hvis ikke flying → gør ingenting
      if (!meta?.flying) return;

      meta.z = z;
      t.metadata[ID] = meta;
    });

    // Hent token igen og opdater visuals
    const [token] = await OBR.scene.items.getItems([selectedId]);
    updateVisual(token);
    updateFlyingList();
  };
  // 🔄 Opdater listen når scene ændrer sig
  OBR.scene.items.onChange(() => {
  updateFlyingList();
});
});
