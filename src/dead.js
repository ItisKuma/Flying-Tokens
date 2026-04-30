import OBR from "@owlbear-rodeo/sdk";
import { DEAD_STATUS_ID, getStatusData, removeItemStatusData, setItemStatusData } from "./statusModel.js";

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
      await OBR.scene.items.updateItems([item.id], (draftItems) => {
        for (const draftItem of draftItems) {
          if (!draftItem) continue;

          setItemStatusData(draftItem, DEAD_STATUS_ID, {
            active: true,
            appliedAt: Date.now(),
          });
        }
      });
      continue;
    }

    await OBR.scene.items.updateItems([item.id], (draftItems) => {
      for (const draftItem of draftItems) {
        if (!draftItem) continue;
        removeItemStatusData(draftItem, DEAD_STATUS_ID);
      }
    });
  }
}
