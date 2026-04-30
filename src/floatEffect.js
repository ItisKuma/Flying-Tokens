import OBR, { buildShape } from "@owlbear-rodeo/sdk";
import { getFlyingItems } from "./flying.js";
import { getFloatAnimationAmplitude, getTokenPhaseOffset, isFloatAnimationEnabled } from "./floatAnimation.js";
import { NS } from "./statusModel.js";

export const LOCAL_FLOAT_EFFECT_NS = `${NS}-local-float`;
const FLOAT_EFFECT_ID_PREFIX = `${NS}/float-effect/`;

function getFloatEffectId(itemId) {
  return `${FLOAT_EFFECT_ID_PREFIX}${itemId}`;
}

function getPulseFactor(item, now = performance.now()) {
  const phase = (now / 1000) * 2.4 + getTokenPhaseOffset(item);
  return (Math.sin(phase) + 1) * 0.5;
}

function getRingScale(item, now = performance.now()) {
  const pulse = getPulseFactor(item, now);
  const amplitude = getFloatAnimationAmplitude();
  return 1.02 + pulse * (0.04 + amplitude * 0.01);
}

function getRingStrokeOpacity(item, now = performance.now()) {
  const pulse = getPulseFactor(item, now);
  return 0.18 + pulse * 0.18;
}

function getRingSize(bounds, item, now = performance.now()) {
  const width = Number(bounds?.width ?? item?.image?.width ?? item?.shape?.width ?? item?.width ?? 100);
  const height = Number(bounds?.height ?? item?.image?.height ?? item?.shape?.height ?? item?.height ?? 100);
  const scale = getRingScale(item, now);

  return {
    width: width * scale,
    height: height * scale,
  };
}

function buildLocalFloatEffect(item, bounds, now = performance.now()) {
  const size = getRingSize(bounds, item, now);
  const center = bounds?.center ?? item.position ?? { x: 0, y: 0 };

  return buildShape()
    .id(getFloatEffectId(item.id))
    .name("Float Pulse")
    .shapeType("CIRCLE")
    .width(size.width)
    .height(size.height)
    .position(center)
    .rotation(0)
    .fillOpacity(0)
    .strokeColor("#ffe4a3")
    .strokeOpacity(getRingStrokeOpacity(item, now))
    .strokeWidth(10)
    .layer("ATTACHMENT")
    .locked(true)
    .disableHit(true)
    .disableAutoZIndex(true)
    .metadata({
      [LOCAL_FLOAT_EFFECT_NS]: {
        effectFor: item.id,
      },
    })
    .build();
}

export async function clearLocalFloatEffects() {
  const localItems = await OBR.scene.local.getItems(
    (item) => item?.metadata?.[LOCAL_FLOAT_EFFECT_NS]?.effectFor,
  );

  if (localItems.length === 0) return;
  await OBR.scene.local.deleteItems(localItems.map((item) => item.id));
}

export async function syncLocalFloatEffects(items) {
  const localItems = await OBR.scene.local.getItems(
    (item) => item?.metadata?.[LOCAL_FLOAT_EFFECT_NS]?.effectFor,
  );

  if (!isFloatAnimationEnabled()) {
    if (localItems.length > 0) {
      await OBR.scene.local.deleteItems(localItems.map((item) => item.id));
    }
    return;
  }

  const flyingItems = getFlyingItems(items);
  const flyingById = new Map(flyingItems.map((item) => [item.id, item]));
  const desiredEffectIds = new Set(flyingItems.map((item) => getFloatEffectId(item.id)));

  const itemIdsToDelete = localItems
    .filter((localItem) => {
      const ownerId = localItem.metadata?.[LOCAL_FLOAT_EFFECT_NS]?.effectFor;
      if (!ownerId) return false;
      if (!flyingById.has(ownerId)) return true;
      return !desiredEffectIds.has(localItem.id);
    })
    .map((localItem) => localItem.id);

  if (itemIdsToDelete.length > 0) {
    await OBR.scene.local.deleteItems(itemIdsToDelete);
  }

  const localItemsById = new Map(localItems.map((localItem) => [localItem.id, localItem]));
  const itemsToAdd = [];
  const boundsById = new Map();
  const now = performance.now();

  for (const item of flyingItems) {
    try {
      const bounds = await OBR.scene.items.getItemBounds([item.id]);
      boundsById.set(item.id, bounds);
    } catch {
      boundsById.set(item.id, null);
    }
  }

  for (const item of flyingItems) {
    const effect = buildLocalFloatEffect(item, boundsById.get(item.id), now);
    const existingEffect = localItemsById.get(effect.id);

    if (!existingEffect || existingEffect.type !== effect.type) {
      if (existingEffect?.id) {
        await OBR.scene.local.deleteItems([existingEffect.id]);
      }
      itemsToAdd.push(effect);
      continue;
    }

    await OBR.scene.local.updateItems([effect.id], (items) => {
      for (const localItem of items) {
        localItem.position = effect.position;
        localItem.layer = effect.layer;
        localItem.locked = effect.locked;
        localItem.visible = effect.visible;
        localItem.disableHit = effect.disableHit;
        localItem.disableAutoZIndex = effect.disableAutoZIndex;
        localItem.metadata = effect.metadata;
        localItem.width = effect.width;
        localItem.height = effect.height;
        localItem.rotation = effect.rotation;
        localItem.style = effect.style;
        localItem.shapeType = effect.shapeType;
      }
    });
  }

  if (itemsToAdd.length > 0) {
    await OBR.scene.local.addItems(itemsToAdd);
  }
}
