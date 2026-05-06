import OBR, { buildShape } from "@owlbear-rodeo/sdk";
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
const FIXED_LIGHT_VECTOR = { x: 0, y: -1 };
const SHADOW_LAYER_DEFS = [
  { key: "outer", zOffset: -0.11, opacityFactor: 0.42, spreadBase: 0, spreadSoftness: 0 },
  { key: "core", zOffset: -0.1, opacityFactor: 1, spreadBase: -0.0526315789, spreadSoftness: 0 },
];

const DEFAULT_SHADOW_SETTINGS = {
  widthScaleAt5Ft: 0.95,
  heightScaleAt5Ft: 0.95,
  scaleLossPer5Ft: 0.005,
  minScale: 0.38,
  offsetStrength: 500,
  offsetZRange: 200,
  yOffsetRatio: 0.19,
  opacity: 0.5,
  softness: 0.1,
};

let currentShadowSettings = { ...DEFAULT_SHADOW_SETTINGS };
const imageProfileCache = new Map();

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

export function applyShadowSettings(settings = currentShadowSettings) {
  currentShadowSettings = normalizeShadowSettings(settings);
  return getShadowSettings();
}

function getFallbackImageProfile() {
  return {
    widthRatio: 1,
    heightRatio: 1,
    centerOffsetXRatio: 0,
    centerOffsetYRatio: 0,
  };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image profile for ${url}`));
    image.src = url;
  });
}

async function getVisibleImageProfile(item) {
  const imageUrl = item?.image?.url;
  if (!imageUrl) {
    return getFallbackImageProfile();
  }

  const cacheKey = `${imageUrl}|${item?.image?.width ?? 0}|${item?.image?.height ?? 0}`;
  if (imageProfileCache.has(cacheKey)) {
    return imageProfileCache.get(cacheKey);
  }

  const profilePromise = (async () => {
    try {
      const image = await loadImage(imageUrl);
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context || canvas.width === 0 || canvas.height === 0) {
        return getFallbackImageProfile();
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha <= 8) continue;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }

      if (maxX < minX || maxY < minY) {
        return getFallbackImageProfile();
      }

      const visibleWidth = maxX - minX + 1;
      const visibleHeight = maxY - minY + 1;
      const visibleCenterX = minX + visibleWidth / 2;
      const visibleCenterY = minY + visibleHeight / 2;

      return {
        widthRatio: visibleWidth / canvas.width,
        heightRatio: visibleHeight / canvas.height,
        centerOffsetXRatio: visibleCenterX / canvas.width - 0.5,
        centerOffsetYRatio: visibleCenterY / canvas.height - 0.5,
      };
    } catch {
      return getFallbackImageProfile();
    }
  })();

  imageProfileCache.set(cacheKey, profilePromise);
  return profilePromise;
}

function getShadowId(itemId, layerKey) {
  return `${SHADOW_ID_PREFIX}${itemId}/${layerKey}`;
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

function getScaleAtHeight(zFeet, baseScaleAt5Ft) {
  const settings = currentShadowSettings;
  const stepsAboveBase = Math.max(0, (zFeet - Z_STEP_FEET) / Z_STEP_FEET);
  return Math.max(
    settings.minScale,
    baseScaleAt5Ft - stepsAboveBase * settings.scaleLossPer5Ft,
  );
}

function getTokenVisualMetrics(item, profile) {
  const fullDisplayWidth = Math.abs(
    Number(item?.image?.width ?? item?.shape?.width ?? item?.width ?? 100) *
      Number(item?.scale?.x ?? 1),
  );
  const fullDisplayHeight = Math.abs(
    Number(item?.image?.height ?? item?.shape?.height ?? item?.height ?? 100) *
      Number(item?.scale?.y ?? 1),
  );
  const center = item?.position ?? { x: 0, y: 0 };

  return {
    fullDisplayWidth,
    fullDisplayHeight,
    visibleDisplayWidth: fullDisplayWidth * profile.widthRatio,
    visibleDisplayHeight: fullDisplayHeight * profile.heightRatio,
    visibleCenterX: Number(center.x ?? 0) + fullDisplayWidth * profile.centerOffsetXRatio,
    visibleCenterY: Number(center.y ?? 0) + fullDisplayHeight * profile.centerOffsetYRatio,
  };
}

function getTokenSize(item, profile) {
  const settings = currentShadowSettings;
  const metrics = getTokenVisualMetrics(item, profile);
  const zFeet = getItemZFeet(item);
  const flyingTokenScaleMultiplier = 1 + (zFeet / Z_STEP_FEET) * SCALE_PER_5_FEET;
  const baseWidth = Math.abs(metrics.visibleDisplayWidth / flyingTokenScaleMultiplier);
  const baseHeight = Math.abs(metrics.visibleDisplayHeight / flyingTokenScaleMultiplier);
  const widthScale = getScaleAtHeight(zFeet, settings.widthScaleAt5Ft);
  const heightScale = getScaleAtHeight(zFeet, settings.heightScaleAt5Ft);

  return {
    width: baseWidth * widthScale,
    height: baseHeight * heightScale,
  };
}

function roundToNearestGridSquare(value, gridDpi) {
  const numericValue = Number(value);
  const numericGridDpi = Number(gridDpi);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return value;
  }

  if (!Number.isFinite(numericGridDpi) || numericGridDpi <= 0) {
    return numericValue;
  }

  return Math.max(numericGridDpi, Math.round(numericValue / numericGridDpi) * numericGridDpi);
}

function getShadowPosition(item, profile, size) {
  const settings = currentShadowSettings;
  const metrics = getTokenVisualMetrics(item, profile);
  const offset = getShadowOffset(item);
  return {
    x: metrics.visibleCenterX + offset.x,
    y: metrics.visibleCenterY + offset.y + size.height * settings.yOffsetRatio,
  };
}

function getLayerSpread(layerDef, softness) {
  return 1 + layerDef.spreadBase + softness * layerDef.spreadSoftness;
}

function getShadowZIndex(owner, allItems, layerDef) {
  const ownerZFeet = getItemZFeet(owner);
  const ownerZIndex = Number(owner.zIndex ?? 0);
  const relevantItems = allItems.filter((item) => {
    if (!item || item.id === owner.id) return false;
    if (item?.metadata?.[LOCAL_SHADOW_NS]?.shadowFor) return false;

    return !isFlying(item) || getItemZFeet(item) < ownerZFeet;
  });

  if (relevantItems.length === 0) {
    return ownerZIndex + layerDef.zOffset;
  }

  const highestRelevantZIndex = Math.max(
    ...relevantItems.map((item) => Number(item.zIndex ?? 0)),
  );

  return Math.min(ownerZIndex + layerDef.zOffset, highestRelevantZIndex + 0.1);
}

function buildLocalShadowLayers(item, allItems, profile, gridDpi) {
  const settings = currentShadowSettings;
  const rawSize = getTokenSize(item, profile);
  const size = {
    width: roundToNearestGridSquare(rawSize.width, gridDpi),
    height: roundToNearestGridSquare(rawSize.height, gridDpi),
  };
  const position = getShadowPosition(item, profile, size);

  return SHADOW_LAYER_DEFS.map((layerDef) => {
    const spread = getLayerSpread(layerDef, settings.softness);
    const layer = buildShape()
      .id(getShadowId(item.id, layerDef.key))
      .name("Flying Shadow")
      .shapeType("CIRCLE")
      .position(position)
      .width(size.width * spread)
      .height(size.height * spread)
      .fillColor("#000000")
      .fillOpacity(settings.opacity * layerDef.opacityFactor)
      .strokeColor("#000000")
      .strokeOpacity(0)
      .strokeWidth(0)
      .attachedTo(item.id)
      .layer("CHARACTER")
      .locked(true)
      .disableHit(true)
      .disableAutoZIndex(true)
      .disableAttachmentBehavior(["SCALE", "ROTATION"])
      .metadata({
        [LOCAL_SHADOW_NS]: {
          shadowFor: item.id,
          layerKey: layerDef.key,
        },
      })
      .build();

    layer.zIndex = getShadowZIndex(item, allItems, layerDef);
    return layer;
  });
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
  let gridDpi = 0;

  try {
    gridDpi = await OBR.scene.grid.getDpi();
  } catch {
    gridDpi = 0;
  }

  const flyingById = new Map(flyingItems.map((item) => [item.id, item]));
  const desiredShadowIds = new Set(
    flyingItems.flatMap((item) =>
      SHADOW_LAYER_DEFS.map((layerDef) => getShadowId(item.id, layerDef.key)),
    ),
  );

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
  const profileById = new Map();

  for (const item of flyingItems) {
    profileById.set(item.id, await getVisibleImageProfile(item));
  }

  for (const item of flyingItems) {
    const shadowLayers = buildLocalShadowLayers(item, items, profileById.get(item.id), gridDpi);

    for (const shadow of shadowLayers) {
      const existingShadow = localItemsById.get(shadow.id);

      if (!existingShadow || existingShadow.type !== shadow.type) {
        if (existingShadow?.id) {
          await OBR.scene.local.deleteItems([existingShadow.id]);
        }
        itemsToAdd.push(shadow);
        continue;
      }

      await OBR.scene.local.updateItems([shadow.id], (draftItems) => {
        for (const draftItem of draftItems) {
          draftItem.position = shadow.position;
          draftItem.layer = shadow.layer;
          draftItem.locked = shadow.locked;
          draftItem.visible = shadow.visible;
          draftItem.disableHit = shadow.disableHit;
          draftItem.disableAutoZIndex = shadow.disableAutoZIndex;
          draftItem.zIndex = shadow.zIndex;
          draftItem.metadata = shadow.metadata;
          draftItem.rotation = shadow.rotation;
          draftItem.attachedTo = shadow.attachedTo;
          draftItem.disableAttachmentBehavior = shadow.disableAttachmentBehavior;
          draftItem.width = shadow.width;
          draftItem.height = shadow.height;
          draftItem.shapeType = shadow.shapeType;
          draftItem.style = shadow.style;
        }
      });
    }
  }

  if (itemsToAdd.length > 0) {
    await OBR.scene.local.addItems(itemsToAdd);
  }
}
