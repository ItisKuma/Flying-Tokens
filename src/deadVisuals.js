import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import { getBaseScale } from "./flying.js";
import { isDead } from "./dead.js";
import { DEAD_STATUS_ID, NS } from "./statusModel.js";

export const LOCAL_DEAD_NS = `${NS}-local-dead`;
const DEAD_VISUAL_ID_PREFIX = `${NS}/dead-visual/`;
const DEAD_ANIMATION_DURATION_MS = 480;
const BLOOD_GRID = {
  dpi: 150,
  offset: { x: 0, y: 0 },
};
const BLOOD_SPLAT_IDS = [
  "blood-splat-01.png",
  "blood-splat-02.png",
  "blood-splat-03.png",
  "blood-splat-04.png",
  "blood-splat-05.png",
  "blood-splat-06.png",
  "blood-splat-07.png",
  "blood-splat-08.png",
  "blood-splat-09.png",
  "blood-splat-10.png",
  "blood-splat-11.png",
  "blood-splat-12.png",
  "blood-splat-13.png",
  "blood-splat-14.png",
  "blood-splat-15.png",
  "blood-splat-16.png",
  "blood-splat-17.png",
  "blood-splat-18.png",
];

function getDeadVisualId(itemId) {
  return `${DEAD_VISUAL_ID_PREFIX}${itemId}`;
}

function getDeterministicSplatFile(itemId) {
  const id = String(itemId ?? "");
  let hash = 0;

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }

  return BLOOD_SPLAT_IDS[hash % BLOOD_SPLAT_IDS.length];
}

function getBloodImage(itemId) {
  const file = getDeterministicSplatFile(itemId);

  return {
    url: `/blood-splats/${file}`,
    width: 512,
    height: 512,
    mime: "image/png",
  };
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function getProgress(item, now = Date.now()) {
  const appliedAt = Number(item?.metadata?.[NS]?.statuses?.[DEAD_STATUS_ID]?.appliedAt ?? now);
  const elapsed = Math.max(0, now - appliedAt);
  return Math.min(1, elapsed / DEAD_ANIMATION_DURATION_MS);
}

function getDeadBoundsScale(item, now = Date.now()) {
  const progress = easeOutCubic(getProgress(item, now));
  return 0.5 + progress * 0.5;
}

function getDeadVisualSize(item, bounds, now = Date.now()) {
  const width = Number(bounds?.width ?? item?.image?.width ?? 100);
  const height = Number(bounds?.height ?? item?.image?.height ?? 100);
  const baseScale = getBaseScale(item);
  const baseWidth = width / Number(baseScale?.x ?? 1);
  const baseHeight = height / Number(baseScale?.y ?? 1);
  const scale = getDeadBoundsScale(item, now);

  return {
    width: baseWidth * scale,
    height: baseHeight * scale,
  };
}

function getDeadVisualPosition(item, bounds, size) {
  const center = bounds?.center ?? item.position ?? { x: 0, y: 0 };

  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
  };
}

function getDeadVisualZIndex(item) {
  return Number(item?.zIndex ?? 0) - 0.2;
}

function buildDeadVisual(item, bounds, now = Date.now()) {
  const size = getDeadVisualSize(item, bounds, now);
  const bloodImage = getBloodImage(item.id);

  const visual = buildImage(bloodImage, BLOOD_GRID)
    .id(getDeadVisualId(item.id))
    .name("Dead Status Blood")
    .position(getDeadVisualPosition(item, bounds, size))
    .scale({ x: size.width / bloodImage.width, y: size.height / bloodImage.height })
    .layer("CHARACTER")
    .locked(true)
    .disableHit(true)
    .disableAutoZIndex(true)
    .metadata({
      [LOCAL_DEAD_NS]: {
        deadFor: item.id,
      },
    })
    .build();

  visual.zIndex = getDeadVisualZIndex(item);
  return visual;
}

export async function clearLocalDeadVisuals() {
  const localItems = await OBR.scene.local.getItems(
    (item) => item?.metadata?.[LOCAL_DEAD_NS]?.deadFor,
  );

  if (localItems.length === 0) return;
  await OBR.scene.local.deleteItems(localItems.map((item) => item.id));
}

export async function syncLocalDeadVisuals(items) {
  const deadItems = items.filter((item) => isDead(item));
  const localItems = await OBR.scene.local.getItems(
    (item) => item?.metadata?.[LOCAL_DEAD_NS]?.deadFor,
  );

  const deadById = new Map(deadItems.map((item) => [item.id, item]));
  const desiredIds = new Set(deadItems.map((item) => getDeadVisualId(item.id)));

  const idsToDelete = localItems
    .filter((localItem) => {
      const ownerId = localItem.metadata?.[LOCAL_DEAD_NS]?.deadFor;
      if (!ownerId) return false;
      if (!deadById.has(ownerId)) return true;
      return !desiredIds.has(localItem.id);
    })
    .map((localItem) => localItem.id);

  if (idsToDelete.length > 0) {
    await OBR.scene.local.deleteItems(idsToDelete);
  }

  const localItemsById = new Map(localItems.map((localItem) => [localItem.id, localItem]));
  const itemsToAdd = [];
  const boundsById = new Map();
  const now = Date.now();

  for (const item of deadItems) {
    try {
      const bounds = await OBR.scene.items.getItemBounds([item.id]);
      boundsById.set(item.id, bounds);
    } catch {
      boundsById.set(item.id, null);
    }
  }

  for (const item of deadItems) {
    const visual = buildDeadVisual(item, boundsById.get(item.id), now);
    const existingVisual = localItemsById.get(visual.id);

    if (!existingVisual || existingVisual.type !== visual.type) {
      if (existingVisual?.id) {
        await OBR.scene.local.deleteItems([existingVisual.id]);
      }
      itemsToAdd.push(visual);
      continue;
    }

    await OBR.scene.local.updateItems([visual.id], (draftItems) => {
      for (const draftItem of draftItems) {
        draftItem.position = visual.position;
        draftItem.scale = visual.scale;
        draftItem.layer = visual.layer;
        draftItem.locked = visual.locked;
        draftItem.visible = visual.visible;
        draftItem.disableHit = visual.disableHit;
        draftItem.disableAutoZIndex = visual.disableAutoZIndex;
        draftItem.zIndex = visual.zIndex;
        draftItem.metadata = visual.metadata;
      }
    });
  }

  if (itemsToAdd.length > 0) {
    await OBR.scene.local.addItems(itemsToAdd);
  }
}
