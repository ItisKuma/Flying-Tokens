import OBR from "https://unpkg.com/@owlbear-rodeo/sdk@latest/dist/index.mjs";
import { createShadow, deleteShadow } from "./shadow.js";

const NS = "simple-flying";

export async function toggleFlying() {
  const selection = await OBR.player.getSelection();
  if (!selection || selection.length === 0) return;

  const items = await OBR.scene.items.getItems(selection);

  const shadowsToCreate = [];

  for (const item of items) {
    const data = item.metadata?.[NS];

    // enable flying
    if (!data?.flying) {
      const shadow = createShadow(item);
      shadowsToCreate.push(shadow);

      await OBR.scene.items.updateItems([item.id], (items) => {
        for (const i of items) {
          i.metadata = {
            ...i.metadata,
            [NS]: {
              flying: true,
              shadowId: shadow.id,
            },
          };
        }
      });
    }

    // disable flying
    else {
      const shadowId = data.shadowId;

      if (shadowId) {
        await deleteShadow(shadowId);
      }

      await OBR.scene.items.updateItems([item.id], (items) => {
        for (const i of items) {
          if (i.metadata && i.metadata[NS]) {
            delete i.metadata[NS];
          }
        }
      });
    }
  }

  if (shadowsToCreate.length > 0) {
    await OBR.scene.items.addItems(shadowsToCreate);
  }
}