import OBR from "https://unpkg.com/@owlbear-rodeo/sdk?module";

import { toggleFlyingState, setZ } from "./flying.js";
import { rebuildFlyingList } from "./list.js";

const ID = "simple-flying";

OBR.onReady(() => {

  //  Toggle Flying
  document.getElementById("toggle").onclick = async () => {

    const selection = await OBR.player.getSelection();
    const id = selection[0];
    if (!id) return;

    await toggleFlyingState(id);
  };

  //  Z slider
  document.getElementById("z").oninput = async (e) => {

    const selection = await OBR.player.getSelection();
    const id = selection[0];
    if (!id) return;

    const z = Number(e.target.value);
    await setZ(id, z);
  };

  //  Global sync (det her er nøglen)
  OBR.scene.items.onChange(async () => {
    await rebuildFlyingList();
  });

  // Initial load
  rebuildFlyingList();
});
