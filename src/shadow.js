import OBR, { buildShape } from "@owlbear-rodeo/sdk";
import {
  SCALE_PER_5_FEET,
  Z_STEP_FEET,
  getFlyingItems,
  getItemZFeet,
  isFlying,
  NS,
} from "./flying.js";
import { getVisualZFeet } from "./floatAnimation.js";

export const LOCAL_SHADOW_NS = `${NS}-local`;
const SHADOW_ID_PREFIX = `${NS}/shadow/`;
const DEFAULT_LIGHT_VECTOR = { x: -0.7, y: -0.7 };
const MAX_LIGHT_DISTANCE = 5;

let currentLightVector = DEFAULT_LIGHT_VECTOR;

function getShadowId(itemId) {
  return `${SHADOW_ID_PREFIX}${itemId}`;
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
  const baseMagnitudeX = 12 + normalizedHeight * 150;
  const baseMagnitudeY = 10 + normalizedHeight * 150;
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
  const zFeet = getVisualZFeet(item);
  const steps = zFeet / 5;
  const flyingTokenScaleMultiplier = 1 + (zFeet / Z_STEP_FEET) * SCALE_PER_5_FEET;
  const baseWidth = width / flyingTokenScaleMultiplier;
  const baseHeight = height / flyingTokenScaleMultiplier;
  const scaleMultiplier = Math.max(0.1, 1 - steps * 0.01);

  return {
    width: baseWidth * scaleMultiplier,
    height: baseHeight * scaleMultiplier,
  };
}

function getShadowPosition(item, bounds) {
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
    if (item?.metadata?.[LOCAL_SHADOW_NS]?.shadowFor) return false;

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
  const shadow = buildShape()
    .id(getShadowId(item.id))
    .name("Flying Shadow")
    .shapeType("CIRCLE")
    .width(size.width)
    .height(size.height)
    .position(getShadowPosition(item, bounds))
    .rotation(0)
    .fillColor("#000000")
    .fillOpacity(0.32)
    .strokeOpacity(0)
    .layer("CHARACTER")
    .locked(true)
    .disableHit(true)
    .disableAutoZIndex(true)
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
  const itemIdsToDelete = localItems
    .filter((localItem) => {
      const ownerId = localItem.metadata?.[LOCAL_SHADOW_NS]?.shadowFor;

      if (!ownerId) return false;
      return !flyingById.has(ownerId);
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

    if (!existingShadow) {
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
        localItem.width = shadow.width;
        localItem.height = shadow.height;
        localItem.style = shadow.style;
        localItem.shapeType = shadow.shapeType;
        localItem.rotation = shadow.rotation;
      }
    });
  }

  if (itemsToAdd.length > 0) {
    await OBR.scene.local.addItems(itemsToAdd);
  }
}
