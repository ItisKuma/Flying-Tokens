import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import { getFlyingItems } from "./flying.js";
import {
  FLOAT_ANIMATION_CYCLE_MS,
  getFloatAnimationAmplitude,
  getTokenPhaseOffset,
  isFloatAnimationEnabled,
} from "./floatAnimation.js";
import { NS } from "./statusModel.js";

export const LOCAL_FLOAT_EFFECT_NS = `${NS}-local-float`;
const FLOAT_VISUAL_ID_PREFIX = `${NS}/float-visual/`;
const FLOAT_AURA_GRID = {
  dpi: 150,
  offset: { x: 0, y: 0 },
};
const FLOAT_AURA_IMAGE = {
  url: globalThis.location?.origin
    ? new URL("/flying-aura.svg", globalThis.location.origin).toString()
    : "/flying-aura.svg",
  width: 512,
  height: 512,
  mime: "image/svg+xml",
};

function getFloatVisualId(itemId) {
  return `${FLOAT_VISUAL_ID_PREFIX}${itemId}`;
}

function getPulseFactor(item, now = performance.now()) {
  const phase =
    ((now % FLOAT_ANIMATION_CYCLE_MS) / FLOAT_ANIMATION_CYCLE_MS) * Math.PI * 2 +
    getTokenPhaseOffset(item);
  return (Math.sin(phase) + 1) * 0.5;
}

function getAuraScale(item, now = performance.now()) {
  const pulse = getPulseFactor(item, now);
  const amplitude = getFloatAnimationAmplitude();
  return 1.06 + pulse * (0.04 + amplitude * 0.008);
}

function getAuraSize(bounds, item, now = performance.now()) {
  const width = Number(item?.image?.width ?? item?.shape?.width ?? item?.width ?? bounds?.width ?? 100);
  const height = Number(item?.image?.height ?? item?.shape?.height ?? item?.height ?? bounds?.height ?? 100);
  const scaleX = Number(item?.scale?.x ?? 1);
  const scaleY = Number(item?.scale?.y ?? 1);
  const scale = getAuraScale(item, now);

  return {
    width: width * scaleX * scale,
    height: height * scaleY * scale,
  };
}

function getAuraWorldPosition(item, bounds) {
  const center = item?.position ?? bounds?.center ?? { x: 0, y: 0 };
  return {
    x: Number(center.x ?? 0),
    y: Number(center.y ?? 0),
  };
}

function buildFloatVisual(item, bounds, now = performance.now()) {
  const size = getAuraSize(bounds, item, now);

  return buildImage(FLOAT_AURA_IMAGE, FLOAT_AURA_GRID)
    .id(getFloatVisualId(item.id))
    .name("Flying Aura")
    .position(getAuraWorldPosition(item, bounds))
    .scale({ x: size.width / FLOAT_AURA_IMAGE.width, y: size.height / FLOAT_AURA_IMAGE.height })
    .attachedTo(item.id)
    .layer("CHARACTER")
    .locked(true)
    .disableHit(true)
    .disableAutoZIndex(true)
    .disableAttachmentBehavior(["SCALE", "ROTATION"])
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

  if (localItems.length > 0) {
    await OBR.scene.local.deleteItems(localItems.map((item) => item.id));
  }
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
  const desiredEffectIds = new Set(flyingItems.map((item) => getFloatVisualId(item.id)));

  const itemIdsToDelete = localItems
    .filter((sceneItem) => {
      const ownerId = sceneItem.metadata?.[LOCAL_FLOAT_EFFECT_NS]?.effectFor;
      if (!ownerId) return false;
      if (!flyingById.has(ownerId)) return true;
      return !desiredEffectIds.has(sceneItem.id);
    })
    .map((sceneItem) => sceneItem.id);

  if (itemIdsToDelete.length > 0) {
    await OBR.scene.local.deleteItems(itemIdsToDelete);
  }

  const sceneItemsById = new Map(localItems.map((sceneItem) => [sceneItem.id, sceneItem]));
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
    const effect = buildFloatVisual(item, boundsById.get(item.id), now);
    const existingEffect = sceneItemsById.get(effect.id);

    effect.zIndex = Number(item.zIndex ?? 0) + 0.05;

    if (!existingEffect || existingEffect.type !== effect.type) {
      if (existingEffect?.id) {
        await OBR.scene.local.deleteItems([existingEffect.id]);
      }
      itemsToAdd.push(effect);
      continue;
    }

    await OBR.scene.local.updateItems([effect.id], (draftItems) => {
      for (const draftItem of draftItems) {
        draftItem.position = effect.position;
        draftItem.layer = effect.layer;
        draftItem.locked = effect.locked;
        draftItem.visible = effect.visible;
        draftItem.disableHit = effect.disableHit;
        draftItem.disableAutoZIndex = effect.disableAutoZIndex;
        draftItem.metadata = effect.metadata;
        draftItem.rotation = effect.rotation;
        draftItem.scale = effect.scale;
        draftItem.image = effect.image;
        draftItem.grid = effect.grid;
        draftItem.zIndex = effect.zIndex;
        draftItem.attachedTo = effect.attachedTo;
        draftItem.disableAttachmentBehavior = effect.disableAttachmentBehavior;
      }
    });
  }

  if (itemsToAdd.length > 0) {
    await OBR.scene.local.addItems(itemsToAdd);
  }
}
