import OBR from "@owlbear-rodeo/sdk";
import { createShadow, deleteShadow } from "./shadow.js";

const NS = "simple-flying";

export async function toggleFlying() {
  const selection = await OBR.player.getSelection();
  if (!selection || selection.length === 0) return;

  const items = await OBR.scene.items.getItems(selection);
  if (!items || items.length === 0) return;

  const shadowsToCreate = [];

  for (const item of items) {
    if (!item) continue;

    const data = item.metadata?.[NS];

    // ENABLE FLYING
    if (!data?.flying) {
      const shadow = createShadow(item);

      if (!shadow) continue;

      shadowsToCreate.push(shadow);

      await OBR.scene.items.updateItems([item.id], (items) => {
        for (const i of items) {
          if (!i) continue;

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

    // DISABLE FLYING
    else {
      const shadowId = data.shadowId;

      if (shadowId) {
        await deleteShadow(shadowId);
      }

      await OBR.scene.items.updateItems([item.id], (items) => {
        for (const i of items) {
          if (!i || !i.metadata) continue;

          delete i.metadata[NS];
        }
      });
    }
  }

  // opret alle shadows samlet (samme pattern som emanation)
  if (shadowsToCreate.length > 0) {
    await OBR.scene.items.addItems(shadowsToCreate);
  }
}