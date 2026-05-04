import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import {
  SCALE_PER_5_FEET,
  Z_STEP_FEET,
  getFlyingItems,
  getItemZFeet,
  isFlying,
} from "./flying.js";
import { NS } from "./statusModel.js";

export const LOCAL_SHADOW_NS = `${NS}-local-shadow`;
const SHADOW_ID_PREFIX = `${NS}/shadow/`;
const FIXED_LIGHT_VECTOR = { x: -1, y: -1 };
const SHADOW_GRID = {
  dpi: 150,
  offset: { x: 0, y: 0 },
};

const DEFAULT_SHADOW_SETTINGS = {
  widthScaleAt5Ft: 0.95,
  heightScaleAt5Ft: 0.95,
  scaleLossPer5Ft: 0.01,
  minScale: 0.75,
  offsetStrength: 90,
  offsetZRange: 150,
  yOffsetRatio: 0.02,
  opacity: 0.3,
  softness: 0.55,
};

const SHADOW_IMAGE_SIZE = 512;
let currentShadowSettings = { ...DEFAULT_SHADOW_SETTINGS };
const STATIC_SHADOW_IMAGE = {
  url: globalThis.location?.origin
    ? new URL("/shadow.svg", globalThis.location.origin).toString()
    : "/shadow.svg",
  width: SHADOW_IMAGE_SIZE,
  height: SHADOW_IMAGE_SIZE,
  mime: "image/svg+xml",
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeNumber(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function normalizeShadowSettings(rawSettings) {
  return {
    widthScaleAt5Ft: clamp(normalizeNumber(rawSettings?.widthScaleAt5Ft, DEFAULT_SHADOW_SETTINGS.widthScaleAt5Ft), 0.2, 2),
    heightScaleAt5Ft: clamp(normalizeNumber(rawSettings?.heightScaleAt5Ft, DEFAULT_SHADOW_SETTINGS.heightScaleAt5Ft), 0.2, 2),
    scaleLossPer5Ft: clamp(normalizeNumber(rawSettings?.scaleLossPer5Ft, DEFAULT_SHADOW_SETTINGS.scaleLossPer5Ft), -0.1, 0.1),
    minScale: clamp(normalizeNumber(rawSettings?.minScale, DEFAULT_SHADOW_SETTINGS.minScale), 0.1, 2),
    offsetStrength: clamp(normalizeNumber(rawSettings?.offsetStrength, DEFAULT_SHADOW_SETTINGS.offsetStrength), 0, 300),
    offsetZRange: clamp(normalizeNumber(rawSettings?.offsetZRange, DEFAULT_SHADOW_SETTINGS.offsetZRange), 5, 500),
    yOffsetRatio: clamp(normalizeNumber(rawSettings?.yOffsetRatio, DEFAULT_SHADOW_SETTINGS.yOffsetRatio), -0.5, 0.5),
    opacity: clamp(normalizeNumber(rawSettings?.opacity, DEFAULT_SHADOW_SETTINGS.opacity), 0, 1),
    softness: clamp(normalizeNumber(rawSettings?.softness, DEFAULT_SHADOW_SETTINGS.softness), 0, 1),
  };
}

export function getShadowSettings() {
  return { ...currentShadowSettings };
}

export function applyShadowSettings(settings) {
  currentShadowSettings = normalizeShadowSettings(settings);
  return getShadowSettings();
}

function getShadowId(itemId) {
  return `${SHADOW_ID_PREFIX}${itemId}`;
}

function getShadowOffset(item) {
  const settings = currentShadowSettings;
  const zFeet = getItemZFeet(item);
  const normalizedHeight = zFeet / settings.offsetZRange;
  const directionLength = Math.hypot(FIXED_LIGHT_VECTOR.x, FIXED_LIGHT_VECTOR.y);
  const direction = {
    x: FIXED_LIGHT_VECTOR.x / directionLength,
    y: FIXED_LIGHT_VECTOR.y / directionLength,
  };
  const baseMagnitudeX = normalizedHeight * settings.offsetStrength;
  const baseMagnitudeY = normalizedHeight * settings.offsetStrength;
  const shadowDirection = {
    x: -direction.x,
    y: -direction.y,
  };

  return {
    x: baseMagnitudeX * shadowDirection.x,
    y: baseMagnitudeY * shadowDirection.y,
  };
}

function getShadowScale(zFeet) {
  const settings = currentShadowSettings;
  const stepsAboveBase = Math.max(0, (zFeet - Z_STEP_FEET) / Z_STEP_FEET);
  return Math.max(
    settings.minScale,
    1 - (1 - settings.widthScaleAt5Ft) - stepsAboveBase * settings.scaleLossPer5Ft,
  );
}

function getTokenSize(item, bounds) {
  const settings = currentShadowSettings;
  const width = Number(bounds?.width ?? item?.image?.width ?? item?.shape?.width ?? item?.width ?? 100);
  const height = Number(bounds?.height ?? item?.image?.height ?? item?.shape?.height ?? item?.height ?? 100);
  const zFeet = getItemZFeet(item);
  const flyingTokenScaleMultiplier = 1 + (zFeet / Z_STEP_FEET) * SCALE_PER_5_FEET;
  const baseWidth = Math.abs(width / flyingTokenScaleMultiplier);
  const baseHeight = Math.abs(height / flyingTokenScaleMultiplier);
  const widthScale = getShadowScale(zFeet);
  const heightScale = Math.max(
    settings.minScale,
    settings.heightScaleAt5Ft - Math.max(0, (zFeet - Z_STEP_FEET) / Z_STEP_FEET) * settings.scaleLossPer5Ft,
  );

  return {
    width: baseWidth * widthScale,
    height: baseHeight * heightScale,
  };
}

function getShadowPosition(item, bounds, size) {
  const settings = currentShadowSettings;
  const center = item?.position ?? bounds?.center ?? { x: 0, y: 0 };
  const offset = getShadowOffset(item);
  return {
    x: Number(center.x ?? 0) + offset.x,
    y: Number(center.y ?? 0) + offset.y + size.height * settings.yOffsetRatio,
  };
}

function getShadowZIndex(owner, allItems) {
  const ownerZFeet = getItemZFeet(owner);
  const ownerZIndex = Number(owner.zIndex ?? 0);
  const relevantItems = allItems.filter((item) => {
    if (!item || item.id === owner.id) return false;
    if (item?.metadata?.[LOCAL_SHADOW_NS]?.shadowFor) return false;

    return !isFlying(item) || getItemZFeet(item) < ownerZFeet;
  });

  if (relevantItems.length === 0) {
    return ownerZIndex - 0.1;
  }

  const highestRelevantZIndex = Math.max(
    ...relevantItems.map((item) => Number(item.zIndex ?? 0)),
  );

  return Math.min(ownerZIndex - 0.1, highestRelevantZIndex + 0.1);
}

function buildLocalShadow(item, allItems, bounds) {
  const size = getTokenSize(item, bounds);
  const shadow = buildImage(STATIC_SHADOW_IMAGE, SHADOW_GRID)
    .id(getShadowId(item.id))
    .name("Flying Shadow")
    .position(getShadowPosition(item, bounds, size))
    .scale({ x: size.width / STATIC_SHADOW_IMAGE.width, y: size.height / STATIC_SHADOW_IMAGE.height })
    .attachedTo(item.id)
    .layer("CHARACTER")
    .locked(true)
    .disableHit(true)
    .disableAutoZIndex(true)
    .disableAttachmentBehavior(["SCALE", "ROTATION"])
    .metadata({
      [LOCAL_SHADOW_NS]: {
        shadowFor: item.id,
      },
    })
    .build();

  shadow.zIndex = getShadowZIndex(item, allItems);
  return shadow;
}

export async function clearLocalShadows() {
  const localItems = await OBR.scene.local.getItems(
    (item) => item?.metadata?.[LOCAL_SHADOW_NS]?.shadowFor,
  );

  if (localItems.length === 0) return;
  await OBR.scene.local.deleteItems(localItems.map((item) => item.id));
}

export async function syncLocalShadows(items) {
  const flyingItems = getFlyingItems(items);
  const localItems = await OBR.scene.local.getItems(
    (item) => item?.metadata?.[LOCAL_SHADOW_NS]?.shadowFor,
  );

  const flyingById = new Map(flyingItems.map((item) => [item.id, item]));
  const desiredShadowIds = new Set(flyingItems.map((item) => getShadowId(item.id)));
  const itemIdsToDelete = localItems
    .filter((localItem) => {
      const ownerId = localItem.metadata?.[LOCAL_SHADOW_NS]?.shadowFor;
      if (!ownerId) return false;
      if (!flyingById.has(ownerId)) return true;
      return !desiredShadowIds.has(localItem.id);
    })
    .map((localItem) => localItem.id);

  if (itemIdsToDelete.length > 0) {
    await OBR.scene.local.deleteItems(itemIdsToDelete);
  }

  const localItemsById = new Map(localItems.map((localItem) => [localItem.id, localItem]));
  const itemsToAdd = [];
  const boundsById = new Map();

  for (const item of flyingItems) {
    try {
      const bounds = await OBR.scene.items.getItemBounds([item.id]);
      boundsById.set(item.id, bounds);
    } catch (error) {
      boundsById.set(item.id, null);
    }
  }

  for (const item of flyingItems) {
    const shadow = buildLocalShadow(item, items, boundsById.get(item.id));
    const existingShadow = localItemsById.get(shadow.id);

    if (!existingShadow || existingShadow.type !== shadow.type) {
      if (existingShadow?.id) {
        await OBR.scene.local.deleteItems([existingShadow.id]);
      }
      itemsToAdd.push(shadow);
      continue;
    }

    await OBR.scene.local.updateItems([shadow.id], (items) => {
      for (const localItem of items) {
        localItem.position = shadow.position;
        localItem.layer = shadow.layer;
        localItem.locked = shadow.locked;
        localItem.visible = shadow.visible;
        localItem.disableHit = shadow.disableHit;
        localItem.disableAutoZIndex = shadow.disableAutoZIndex;
        localItem.zIndex = shadow.zIndex;
        localItem.metadata = shadow.metadata;
        localItem.rotation = shadow.rotation;
        localItem.scale = shadow.scale;
        localItem.image = shadow.image;
        localItem.grid = shadow.grid;
        localItem.attachedTo = shadow.attachedTo;
        localItem.disableAttachmentBehavior = shadow.disableAttachmentBehavior;
      }
    });
  }

  if (itemsToAdd.length > 0) {
    await OBR.scene.local.addItems(itemsToAdd);
  }
}
