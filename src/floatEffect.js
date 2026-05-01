import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import { getFlyingItems } from "./flying.js";
import {
  FLOAT_ANIMATION_CYCLE_MS,
  getFloatAnimationAmplitude,
  getTokenPhaseOffset,
  isFloatAnimationEnabled,
} from "./floatAnimation.js";
import { NS } from "./statusModel.js";

export const FLOAT_VISUAL_NS = `${NS}/float-visual`;
const LEGACY_LOCAL_FLOAT_EFFECT_NS = `${NS}-local-float`;
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

let cachedRolePromise = null;

function getFloatVisualId(itemId) {
  return `${FLOAT_VISUAL_ID_PREFIX}${itemId}`;
}

async function canManageFloatVisuals() {
  cachedRolePromise ??= OBR.player.getRole();
  return (await cachedRolePromise) === "GM";
}

function isManagedFloatVisual(item) {
  return Boolean(item?.metadata?.[FLOAT_VISUAL_NS]?.effectFor);
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
  const width = Number(bounds?.width ?? item?.image?.width ?? item?.shape?.width ?? item?.width ?? 100);
  const height = Number(bounds?.height ?? item?.image?.height ?? item?.shape?.height ?? item?.height ?? 100);
  const scale = getAuraScale(item, now);

  return {
    width: width * scale,
    height: height * scale,
  };
}

function buildFloatVisual(item, bounds, now = performance.now()) {
  const size = getAuraSize(bounds, item, now);
  const center = bounds?.center ?? item.position ?? { x: 0, y: 0 };

  return buildImage(FLOAT_AURA_IMAGE, FLOAT_AURA_GRID)
    .id(getFloatVisualId(item.id))
    .name("Flying Aura")
    .position(center)
    .scale({ x: size.width / FLOAT_AURA_IMAGE.width, y: size.height / FLOAT_AURA_IMAGE.height })
    .layer("CHARACTER")
    .locked(true)
    .disableHit(true)
    .disableAutoZIndex(true)
    .metadata({
      [FLOAT_VISUAL_NS]: {
        effectFor: item.id,
      },
    })
    .build();
}

export async function clearLocalFloatEffects() {
  const legacyLocalItems = await OBR.scene.local.getItems(
    (item) => item?.metadata?.[LEGACY_LOCAL_FLOAT_EFFECT_NS]?.effectFor,
  );

  if (legacyLocalItems.length > 0) {
    await OBR.scene.local.deleteItems(legacyLocalItems.map((item) => item.id));
  }
}

export async function syncLocalFloatEffects(items) {
  await clearLocalFloatEffects();

  if (!(await canManageFloatVisuals())) return;

  const sceneItems = await OBR.scene.items.getItems(
    (item) => item?.metadata?.[FLOAT_VISUAL_NS]?.effectFor,
  );

  if (!isFloatAnimationEnabled()) {
    if (sceneItems.length > 0) {
      await OBR.scene.items.deleteItems(sceneItems.map((item) => item.id));
    }
    return;
  }

  const sourceItems = items.filter((item) => !isManagedFloatVisual(item));
  const flyingItems = getFlyingItems(sourceItems);
  const flyingById = new Map(flyingItems.map((item) => [item.id, item]));
  const desiredEffectIds = new Set(flyingItems.map((item) => getFloatVisualId(item.id)));

  const itemIdsToDelete = sceneItems
    .filter((sceneItem) => {
      const ownerId = sceneItem.metadata?.[FLOAT_VISUAL_NS]?.effectFor;
      if (!ownerId) return false;
      if (!flyingById.has(ownerId)) return true;
      return !desiredEffectIds.has(sceneItem.id);
    })
    .map((sceneItem) => sceneItem.id);

  if (itemIdsToDelete.length > 0) {
    await OBR.scene.items.deleteItems(itemIdsToDelete);
  }

  const sceneItemsById = new Map(sceneItems.map((sceneItem) => [sceneItem.id, sceneItem]));
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

    effect.zIndex = Number(item.zIndex ?? 0) - 0.05;

    if (!existingEffect || existingEffect.type !== effect.type) {
      if (existingEffect?.id) {
        await OBR.scene.items.deleteItems([existingEffect.id]);
      }
      itemsToAdd.push(effect);
      continue;
    }

    await OBR.scene.items.updateItems([effect.id], (draftItems) => {
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
      }
    });
  }

  if (itemsToAdd.length > 0) {
    await OBR.scene.items.addItems(itemsToAdd);
  }
}
