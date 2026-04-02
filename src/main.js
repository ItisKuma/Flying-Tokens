import OBR from "@owlbear-rodeo/sdk";
import { toggleFlyingState, setZ } from "./flying.js";
import { rebuildFlyingList } from "./list.js";

OBR.onReady(() => {

  document.getElementById("toggle").onclick = async () => {
    const selection = await OBR.player.getSelection();
    const id = selection[0];
    if (!id) return;

    await toggleFlyingState(id);
  };

  document.getElementById("z").oninput = async (e) => {
    const selection = await OBR.player.getSelection();
    const id = selection[0];
    if (!id) return;

    await setZ(id, Number(e.target.value));
  };

  OBR.scene.items.onChange(rebuildFlyingList);

  rebuildFlyingList();
});