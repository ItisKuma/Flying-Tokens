import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import {
  SCALE_PER_5_FEET,
  Z_STEP_FEET,
  getFlyingItems,
  getItemZFeet,
  isFlying,
} from "./flying.js";
import { getVisualZFeet } from "./floatAnimation.js";
import { NS } from "./statusModel.js";

export const SHADOW_VISUAL_NS = `${NS}/shadow-visual`;
const SHADOW_ID_PREFIX = `${NS}/shadow/`;
const DEFAULT_LIGHT_VECTOR = { x: -0.7, y: -0.7 };
const MAX_LIGHT_DISTANCE = 5;
const LIGHT_CENTER_DEADZONE = 0.35;
const SHADOW_SCALE = 0.98;
const SHADOW_GRID = {
  dpi: 150,
  offset: { x: 0, y: 0 },
};
const SHADOW_IMAGE = {
  url: globalThis.location?.origin
    ? new URL("/shadow.svg", globalThis.location.origin).toString()
    : "/shadow.svg",
  width: 512,
  height: 512,
  mime: "image/svg+xml",
};

let currentLightVector = DEFAULT_LIGHT_VECTOR;
let cachedRolePromise = null;

function getShadowId(itemId) {
  return `${SHADOW_ID_PREFIX}${itemId}`;
}

async function canManageShadows() {
  cachedRolePromise ??= OBR.player.getRole();
  return (await cachedRolePromise) === "GM";
}

function isManagedShadowItem(item) {
  return Boolean(item?.metadata?.[SHADOW_VISUAL_NS]?.shadowFor);
}

function isManagedStatusVisualItem(item) {
  const metadataKeys = Object.keys(item?.metadata ?? {});
  return metadataKeys.some((key) => key.startsWith(`${NS}/`));
}

function clampLightVector(vector) {
  const x = Number(vector?.x ?? 0);
  const y = Number(vector?.y ?? 0);
  const length = Math.hypot(x, y);

  if (!Number.isFinite(length)) {
    return DEFAULT_LIGHT_VECTOR;
  }

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  if (length <= LIGHT_CENTER_DEADZONE) {
    return { x: 0, y: 0 };
  }

  if (length <= MAX_LIGHT_DISTANCE) {
    return { x, y };
  }

  return {
    x: (x / length) * MAX_LIGHT_DISTANCE,
    y: (y / length) * MAX_LIGHT_DISTANCE,
  };
}

export function getLightVector() {
  return currentLightVector;
}

export function setLightVector(vector) {
  currentLightVector = clampLightVector(vector);
}

function getShadowOffset(item) {
  const zFeet = getVisualZFeet(item);
  const normalizedHeight = zFeet / 120;
  const lightVector = currentLightVector;
  const lightDistance = Math.min(
    MAX_LIGHT_DISTANCE,
    Math.hypot(lightVector.x, lightVector.y),
  );
  const directionLength = Math.hypot(lightVector.x, lightVector.y);
  const direction =
    directionLength > 0
      ? { x: lightVector.x / directionLength, y: lightVector.y / directionLength }
      : DEFAULT_LIGHT_VECTOR;
  const baseMagnitudeX = normalizedHeight * 150;
  const baseMagnitudeY = normalizedHeight * 150;
  const shadowDirection = {
    x: -direction.x,
    y: -direction.y,
  };
  const distanceMultiplier = lightDistance;

  return {
    x: baseMagnitudeX * shadowDirection.x * distanceMultiplier,
    y: baseMagnitudeY * shadowDirection.y * distanceMultiplier,
  };
}

function getTokenSize(item, bounds) {
  const width = Number(bounds?.width ?? item?.image?.width ?? item?.shape?.width ?? item?.width ?? 100);
  const height = Number(bounds?.height ?? item?.image?.height ?? item?.shape?.height ?? item?.height ?? 100);
  const zFeet = getItemZFeet(item);
  const flyingTokenScaleMultiplier = 1 + (zFeet / Z_STEP_FEET) * SCALE_PER_5_FEET;
  const baseWidth = width / flyingTokenScaleMultiplier;
  const baseHeight = height / flyingTokenScaleMultiplier;

  return {
    width: baseWidth * SHADOW_SCALE,
    height: baseHeight * SHADOW_SCALE,
  };
}

function getShadowPosition(item, bounds, size) {
  const offset = getShadowOffset(item);
  const center = bounds?.center ?? item.position ?? { x: 0, y: 0 };

  return {
    x: center.x + offset.x,
    y: center.y + offset.y,
  };
}

function getShadowZIndex(owner, allItems) {
  const ownerZFeet = getVisualZFeet(owner);
  const ownerZIndex = Number(owner.zIndex ?? 0);
  const relevantItems = allItems.filter((item) => {
    if (!item || item.id === owner.id) return false;
    if (isManagedStatusVisualItem(item)) return false;

    return !isFlying(item) || getVisualZFeet(item) < ownerZFeet;
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
  const shadow = buildImage(SHADOW_IMAGE, SHADOW_GRID)
    .id(getShadowId(item.id))
    .name("Flying Shadow")
    .position(getShadowPosition(item, bounds, size))
    .scale({ x: size.width / SHADOW_IMAGE.width, y: size.height / SHADOW_IMAGE.height })
    .layer("CHARACTER")
    .locked(true)
    .disableHit(true)
    .disableAutoZIndex(true)
    .metadata({
      [SHADOW_VISUAL_NS]: {
        shadowFor: item.id,
      },
    })
    .build();

  shadow.zIndex = getShadowZIndex(item, allItems);
  return shadow;
}

export async function clearLocalShadows() {
  if (!(await canManageShadows())) return;

  const localItems = await OBR.scene.items.getItems(
    (item) => item?.metadata?.[SHADOW_VISUAL_NS]?.shadowFor,
  );

  if (localItems.length === 0) return;
  await OBR.scene.items.deleteItems(localItems.map((item) => item.id));
}

export async function syncLocalShadows(items) {
  if (!(await canManageShadows())) return;

  const sourceItems = items.filter((item) => !isManagedShadowItem(item));
  const flyingItems = getFlyingItems(sourceItems);
  const localItems = await OBR.scene.items.getItems(
    (item) => item?.metadata?.[SHADOW_VISUAL_NS]?.shadowFor,
  );

  const flyingById = new Map(flyingItems.map((item) => [item.id, item]));
  const desiredShadowIds = new Set(flyingItems.map((item) => getShadowId(item.id)));
  const itemIdsToDelete = localItems
    .filter((localItem) => {
      const ownerId = localItem.metadata?.[SHADOW_VISUAL_NS]?.shadowFor;
      if (!ownerId) return false;
      if (!flyingById.has(ownerId)) return true;
      return !desiredShadowIds.has(localItem.id);
    })
    .map((localItem) => localItem.id);

  if (itemIdsToDelete.length > 0) {
    await OBR.scene.items.deleteItems(itemIdsToDelete);
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
        await OBR.scene.items.deleteItems([existingShadow.id]);
      }
      itemsToAdd.push(shadow);
      continue;
    }

    await OBR.scene.items.updateItems([shadow.id], (items) => {
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
      }
    });
  }

  if (itemsToAdd.length > 0) {
    await OBR.scene.items.addItems(itemsToAdd);
  }
}
