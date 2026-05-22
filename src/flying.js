import OBR from "@owlbear-rodeo/sdk";
import { refreshAllAttachedAssets } from "./attachedAssets.js";
import {
  DEAD_STATUS_ID,
  FLYING_STATUS_ID,
  NS,
  getStatusData,
  removeItemStatusData,
  setItemStatusData,
} from "./statusModel.js";
import { getDeadZIndex } from "./zOrder.js";

export const MIN_Z_FEET = 5;
export const MAX_Z_FEET = 150;
export const Z_STEP_FEET = 5;
export const DEFAULT_Z_FEET = 5;
export const Z_INDEX_PER_FOOT = 1000000000000;
export const SCALE_PER_5_FEET = 0.05;

export function clampZFeet(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_Z_FEET;
  }

  const snappedValue =
    Math.round(numericValue / Z_STEP_FEET) * Z_STEP_FEET;

  return Math.min(MAX_Z_FEET, Math.max(MIN_Z_FEET, snappedValue));
}

export function getFlyingData(item) {
  return getStatusData(item, FLYING_STATUS_ID);
}

export function isFlying(item) {
  return Boolean(getFlyingData(item)?.active);
}

export function getItemZFeet(item) {
  if (!isFlying(item)) {
    return 0;
  }

  return clampZFeet(getFlyingData(item)?.zFeet ?? DEFAULT_Z_FEET);
}

export function getBaseZIndex(item) {
  if (!isFlying(item)) {
    return Number(item?.zIndex ?? 0);
  }

  return Number(getFlyingData(item)?.baseZIndex ?? item?.zIndex ?? 0);
}

export function getFlyingZIndex(baseZIndex, zFeet) {
  return Number(baseZIndex) + clampZFeet(zFeet) * Z_INDEX_PER_FOOT;
}

export function getBaseScale(item) {
  if (!isFlying(item)) {
    return item?.scale ?? { x: 1, y: 1 };
  }

  return getFlyingData(item)?.baseScale ?? item?.scale ?? { x: 1, y: 1 };
}

export function getFlyingScale(baseScale, zFeet) {
  const steps = clampZFeet(zFeet) / Z_STEP_FEET;
  const multiplier = 1 + steps * SCALE_PER_5_FEET;

  return {
    x: Number(baseScale?.x ?? 1) * multiplier,
    y: Number(baseScale?.y ?? 1) * multiplier,
  };
}

export function getVisualFlyingScale(baseScale, zFeet) {
  const numericZFeet = Math.max(0, Number(zFeet) || 0);
  const multiplier = 1 + (numericZFeet / Z_STEP_FEET) * SCALE_PER_5_FEET;

  return {
    x: Number(baseScale?.x ?? 1) * multiplier,
    y: Number(baseScale?.y ?? 1) * multiplier,
  };
}

export function getItemLabel(item) {
  return item?.name?.trim() || item?.text?.plainText?.trim() || "Unnamed token";
}

export function getFlyingItems(items) {
  return items.filter((item) => isFlying(item));
}

export async function toggleFlyingForItems(items) {
  if (!items || items.length === 0) return;

  for (const item of items) {
    if (!item) continue;

    const data = getFlyingData(item);

    // ENABLE FLYING
    if (!data?.active) {
      await OBR.scene.items.updateItems([item.id], (items) => {
        for (const i of items) {
          if (!i) continue;

          const deadData = getStatusData(i, DEAD_STATUS_ID);
          const baseZIndex = deadData?.active
            ? Number(deadData.baseZIndex ?? i.zIndex ?? 0)
            : Number(i.zIndex ?? 0);
          const baseScale = i.scale ?? { x: 1, y: 1 };

          setItemStatusData(i, FLYING_STATUS_ID, {
            active: true,
            zFeet: DEFAULT_Z_FEET,
            baseZIndex,
            baseScale,
          });
          i.zIndex = getFlyingZIndex(baseZIndex, DEFAULT_Z_FEET);
          i.scale = getFlyingScale(baseScale, DEFAULT_Z_FEET);
          i.disableAutoZIndex = true;
        }
      });
    }

    // DISABLE FLYING
    else {
      await OBR.scene.items.updateItems([item.id], (items) => {
        for (const i of items) {
          if (!i) continue;

          const currentData = getFlyingData(i);
          if (!currentData) continue;
          const deadData = getStatusData(i, DEAD_STATUS_ID);

          const baseZIndex = Number(currentData.baseZIndex ?? i.zIndex ?? 0);
          const baseScale = currentData.baseScale ?? { x: 1, y: 1 };

          if (deadData?.active) {
            i.zIndex = getDeadZIndex(Number(deadData.baseZIndex ?? baseZIndex));
            i.disableAutoZIndex = true;
          } else {
            i.zIndex = baseZIndex;
            i.disableAutoZIndex = false;
          }

          i.scale = baseScale;
          removeItemStatusData(i, FLYING_STATUS_ID);
        }
      });
    }
  }

  await refreshAllAttachedAssets();
}

export async function toggleFlying() {
  const selection = await OBR.player.getSelection();
  if (!selection || selection.length === 0) return;

  const items = await OBR.scene.items.getItems(selection);
  await toggleFlyingForItems(items);
}

export async function setFlyingHeight(itemId, zFeet) {
  const nextZFeet = clampZFeet(zFeet);

  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const item of items) {
      if (!item || !isFlying(item)) continue;

      const baseZIndex = getBaseZIndex(item);
      const baseScale = getBaseScale(item);

      setItemStatusData(item, FLYING_STATUS_ID, {
        ...getFlyingData(item),
        active: true,
        zFeet: nextZFeet,
        baseZIndex,
        baseScale,
      });
      item.zIndex = getFlyingZIndex(baseZIndex, nextZFeet);
      item.scale = getFlyingScale(baseScale, nextZFeet);
      item.disableAutoZIndex = true;
    }
  });

  await refreshAllAttachedAssets();
}

export async function setItemZIndex(itemId, zIndex) {
  const nextZIndex = Number(zIndex);

  if (!Number.isFinite(nextZIndex)) {
    return;
  }

  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const item of items) {
      if (!item) continue;

      if (isFlying(item)) {
        const zFeet = getItemZFeet(item);

        setItemStatusData(item, FLYING_STATUS_ID, {
          ...getFlyingData(item),
          baseZIndex: nextZIndex,
        });
        item.zIndex = getFlyingZIndex(nextZIndex, zFeet);
        item.scale = getFlyingScale(getBaseScale(item), zFeet);
        item.disableAutoZIndex = true;
        continue;
      }

      item.zIndex = nextZIndex;
      item.disableAutoZIndex = true;
    }
  });

  await refreshAllAttachedAssets();
}
