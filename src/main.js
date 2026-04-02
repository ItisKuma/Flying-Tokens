<<<<<<< HEAD
import OBR from "@owlbear-rodeo/sdk";
import { toggleFlyingState, setZ } from "./flying.js";
import { rebuildFlyingList } from "./list.js";

OBR.onReady(() => {

  document.getElementById("toggle").onclick = async () => {
=======
import OBR from "https://unpkg.com/@owlbear-rodeo/sdk?module";

import { toggleFlyingState, setZ } from "./flying.js";
import { rebuildFlyingList } from "./list.js";

const ID = "simple-flying";

OBR.onReady(() => {

  //  Toggle Flying
  document.getElementById("toggle").onclick = async () => {

>>>>>>> 663484910b30287bb66b34542176094f2176fa07
    const selection = await OBR.player.getSelection();
    const id = selection[0];
    if (!id) return;

    await toggleFlyingState(id);
  };

<<<<<<< HEAD
  document.getElementById("z").oninput = async (e) => {
=======
  //  Z slider
  document.getElementById("z").oninput = async (e) => {

>>>>>>> 663484910b30287bb66b34542176094f2176fa07
    const selection = await OBR.player.getSelection();
    const id = selection[0];
    if (!id) return;

<<<<<<< HEAD
    await setZ(id, Number(e.target.value));
  };

  OBR.scene.items.onChange(rebuildFlyingList);

  rebuildFlyingList();
});
=======
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
>>>>>>> 663484910b30287bb66b34542176094f2176fa07
