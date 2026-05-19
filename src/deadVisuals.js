import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import { getBaseScale } from "./flying.js";
import { getDeadData, isDead } from "./dead.js";
import { BLOOD_SPLAT_IDS } from "./deadSplats.js";
import { DEAD_STATUS_ID, NS } from "./statusModel.js";

export const DEAD_VISUAL_NS = `${NS}/dead-visual`;
const DEAD_VISUAL_ID_PREFIX = `${NS}/dead-visual/`;
const DEAD_SPLAT_SIZE_MULTIPLIER = 4.8;
const DEAD_GRID_OFFSET_X = -2;
const DEAD_GRID_OFFSET_Y = 1;
const BLOOD_IMAGE_WIDTH = 512;
const BLOOD_IMAGE_HEIGHT = 512;
const BLOOD_GRID = {
  dpi: 150,
  offset: { x: BLOOD_IMAGE_WIDTH / 2, y: BLOOD_IMAGE_HEIGHT / 2 },
};
const EXTENSION_ORIGIN = globalThis.location?.origin ?? "";
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

function getBloodImage(item) {
  const file = getDeadData(item)?.splatFile ?? BLOOD_SPLAT_IDS[0];
  const url = EXTENSION_ORIGIN
    ? new URL(`/blood-splats/${file}`, EXTENSION_ORIGIN).toString()
    : `/blood-splats/${file}`;

  return {
    url,
    width: BLOOD_IMAGE_WIDTH,
    height: BLOOD_IMAGE_HEIGHT,
    mime: "image/png",
  };
}

function getDeadVisualSize(item, bounds) {
  const width = Number(bounds?.width ?? item?.image?.width ?? 100);
  const height = Number(bounds?.height ?? item?.image?.height ?? 100);
  const baseScale = getBaseScale(item);
  const baseWidth = width / Number(baseScale?.x ?? 1);
  const baseHeight = height / Number(baseScale?.y ?? 1);

  return {
    width: baseWidth * DEAD_SPLAT_SIZE_MULTIPLIER,
    height: baseHeight * DEAD_SPLAT_SIZE_MULTIPLIER,
  };
}

function getDeadVisualPosition(item, bounds, gridDpi) {
  const center = bounds?.center ?? item?.position ?? { x: 0, y: 0 };
  const squareSize = Number.isFinite(Number(gridDpi)) && Number(gridDpi) > 0 ? Number(gridDpi) : 150;

  return {
    x: center.x + squareSize * DEAD_GRID_OFFSET_X,
    y: center.y + squareSize * DEAD_GRID_OFFSET_Y,
  };
}

function getDeadVisualZIndex(item) {
  return Number(item?.zIndex ?? 0) - 0.2;
}

async function buildDeadVisual(item, bounds, gridDpi) {
  const bloodImage = getBloodImage(item);
  const size = getDeadVisualSize(item, bounds);

  const visual = buildImage(bloodImage, BLOOD_GRID)
    .id(getDeadVisualId(item.id))
    .name("Dead Status Blood")
    .position(getDeadVisualPosition(item, bounds, gridDpi))
    .scale({ x: size.width / bloodImage.width, y: size.height / bloodImage.height })
    .layer("CHARACTER")
    .locked(false)
    .disableHit(false)
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

export function hasAnimatingDeadVisuals() {
  return false;
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
  let gridDpi = 150;

  try {
    gridDpi = await OBR.scene.grid.getDpi();
  } catch {
    gridDpi = 150;
  }

  for (const item of deadItems) {
    try {
      const bounds = await OBR.scene.items.getItemBounds([item.id]);
      boundsById.set(item.id, bounds);
    } catch {
      boundsById.set(item.id, null);
    }
  }

  for (const item of deadItems) {
    const existingVisual = localItemsById.get(getDeadVisualId(item.id));
    const visual = await buildDeadVisual(item, boundsById.get(item.id), gridDpi);

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
