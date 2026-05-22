import OBR from "@owlbear-rodeo/sdk";
import { refreshAllAttachedAssets } from "./attachedAssets.js";
import { pickRandomBloodSplat } from "./deadSplats.js";
import { createDeadVisualsForItems } from "./deadVisuals.js";
import { getBaseZIndex, getFlyingZIndex, getItemZFeet, isFlying } from "./flying.js";
import { DEAD_STATUS_ID, getStatusData, removeItemStatusData, setItemStatusData } from "./statusModel.js";
import { getDeadZIndex } from "./zOrder.js";

export function getDeadData(item) {
  return getStatusData(item, DEAD_STATUS_ID);
}

export function isDead(item) {
  return Boolean(getDeadData(item)?.active);
}

export async function toggleDeadForItems(items) {
  if (!items || items.length === 0) return;

  for (const item of items) {
    if (!item) continue;

    const data = getDeadData(item);

    if (!data?.active) {
      const splatFile = pickRandomBloodSplat();

      await OBR.scene.items.updateItems([item.id], (draftItems) => {
        for (const draftItem of draftItems) {
          if (!draftItem) continue;
          const baseZIndex = isFlying(draftItem)
            ? getBaseZIndex(draftItem)
            : Number(draftItem.zIndex ?? 0);

          setItemStatusData(draftItem, DEAD_STATUS_ID, {
            active: true,
            appliedAt: Date.now(),
            splatFile,
            baseZIndex,
          });

          if (isFlying(draftItem)) {
            draftItem.zIndex = getFlyingZIndex(baseZIndex, getItemZFeet(draftItem));
          } else {
            draftItem.zIndex = getDeadZIndex(baseZIndex);
          }

          draftItem.disableAutoZIndex = true;
        }
      });

      const [updatedItem] = await OBR.scene.items.getItems([item.id]);
      if (updatedItem) {
        await createDeadVisualsForItems([updatedItem]);
      }
      continue;
    }

    await OBR.scene.items.updateItems([item.id], (draftItems) => {
      for (const draftItem of draftItems) {
        if (!draftItem) continue;
        const currentData = getDeadData(draftItem);
        const baseZIndex = Number(currentData?.baseZIndex ?? draftItem.zIndex ?? 0);

        if (isFlying(draftItem)) {
          draftItem.zIndex = getFlyingZIndex(getBaseZIndex(draftItem), getItemZFeet(draftItem));
          draftItem.disableAutoZIndex = true;
        } else {
          draftItem.zIndex = baseZIndex;
          draftItem.disableAutoZIndex = false;
        }

        removeItemStatusData(draftItem, DEAD_STATUS_ID);
      }
    });
  }

  await refreshAllAttachedAssets();
}
