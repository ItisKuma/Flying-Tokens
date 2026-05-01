import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import { getBaseScale } from "./flying.js";
import { isDead } from "./dead.js";
import { DEAD_STATUS_ID, NS } from "./statusModel.js";

export const DEAD_VISUAL_NS = `${NS}/dead-visual`;
const DEAD_VISUAL_ID_PREFIX = `${NS}/dead-visual/`;
const DEAD_ANIMATION_DURATION_MS = 480;
const DEAD_SPLAT_SIZE_MULTIPLIER = 3;
const DEAD_SPLAT_Y_OFFSET_RATIO = 0.08;
const BLOOD_GRID = {
  dpi: 150,
  offset: { x: 0, y: 0 },
};
const EXTENSION_ORIGIN = globalThis.location?.origin ?? "";
const BLOOD_SPLAT_IDS = [
  "blood_splat_01.png",
  "blood_splat_02.png",
  "blood_splat_03.png",
  "blood_splat_04.png",
  "blood_splat_05.png",
  "blood_splat_06.png",
  "blood_splat_07.png",
  "blood_splat_08.png",
  "blood_splat_09.png",
  "blood_splat_10.png",
  "blood_splat_11.png",
  "blood_splat_12.png",
  "blood_splat_13.png",
  "blood_splat_14.png",
  "blood_splat_15.png",
  "blood_splat_16.png",
  "blood_splat_17.png",
];
let cachedRolePromise = null;

function getDeadVisualId(itemId) {
  return `${DEAD_VISUAL_ID_PREFIX}${itemId}`;
}

async function canManageDeadVisuals() {
  cachedRolePromise ??= OBR.player.getRole();
  return (await cachedRolePromise) === "GM";
}

function isManagedDeadVisual(item) {
  return Boolean(item?.metadata?.[DEAD_VISUAL_NS]?.deadFor);
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
  const url = EXTENSION_ORIGIN
    ? new URL(`/blood-splats/${file}`, EXTENSION_ORIGIN).toString()
    : `/blood-splats/${file}`;

  return {
    url,
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
    width: baseWidth * scale * DEAD_SPLAT_SIZE_MULTIPLIER,
    height: baseHeight * scale * DEAD_SPLAT_SIZE_MULTIPLIER,
  };
}

function getDeadVisualPosition(item, bounds, size) {
  const center = bounds?.center ?? item.position ?? { x: 0, y: 0 };
  const yOffset = size.height * DEAD_SPLAT_Y_OFFSET_RATIO;

  return {
    x: center.x,
    y: center.y + yOffset,
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
      [DEAD_VISUAL_NS]: {
        deadFor: item.id,
      },
    })
    .build();

  visual.zIndex = getDeadVisualZIndex(item);
  return visual;
}

export async function clearLocalDeadVisuals() {
  if (!(await canManageDeadVisuals())) return;

  const localItems = await OBR.scene.items.getItems(
    (item) => item?.metadata?.[DEAD_VISUAL_NS]?.deadFor,
  );

  if (localItems.length === 0) return;
  await OBR.scene.items.deleteItems(localItems.map((item) => item.id));
}

export function hasAnimatingDeadVisuals(items, now = Date.now()) {
  return items.some((item) => isDead(item) && getProgress(item, now) < 1);
}

export async function syncLocalDeadVisuals(items) {
  if (!(await canManageDeadVisuals())) return;

  const sourceItems = items.filter((item) => !isManagedDeadVisual(item));
  const deadItems = sourceItems.filter((item) => isDead(item));
  const localItems = await OBR.scene.items.getItems(
    (item) => item?.metadata?.[DEAD_VISUAL_NS]?.deadFor,
  );

  const deadById = new Map(deadItems.map((item) => [item.id, item]));
  const desiredIds = new Set(deadItems.map((item) => getDeadVisualId(item.id)));

  const idsToDelete = localItems
    .filter((localItem) => {
      const ownerId = localItem.metadata?.[DEAD_VISUAL_NS]?.deadFor;
      if (!ownerId) return false;
      if (!deadById.has(ownerId)) return true;
      return !desiredIds.has(localItem.id);
    })
    .map((localItem) => localItem.id);

  if (idsToDelete.length > 0) {
    await OBR.scene.items.deleteItems(idsToDelete);
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
        await OBR.scene.items.deleteItems([existingVisual.id]);
      }
      itemsToAdd.push(visual);
      continue;
    }

    await OBR.scene.items.updateItems([visual.id], (draftItems) => {
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
    await OBR.scene.items.addItems(itemsToAdd);
  }
}
