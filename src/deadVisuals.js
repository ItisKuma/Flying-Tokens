import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import { getDeadData, isDead } from "./dead.js";
import { BLOOD_SPLAT_IDS, getBloodSplatSpec } from "./deadSplats.js";
import { NS } from "./statusModel.js";

export const DEAD_VISUAL_NS = `${NS}/dead-visual`;
const DEAD_VISUAL_ID_PREFIX = `${NS}/dead-visual/`;
const DEAD_SPLAT_SCALE = 1.75;
const DEAD_VISUAL_Z_INDEX = 1000000;
const EXTENSION_ORIGIN = globalThis.location?.origin ?? "";
let cachedRolePromise = null;

function getDeadVisualId(item) {
  const appliedAt = Number(getDeadData(item)?.appliedAt ?? Date.now());
  return `${DEAD_VISUAL_ID_PREFIX}${item.id}/${appliedAt}`;
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
  const spec = getBloodSplatSpec(file);
  const url = EXTENSION_ORIGIN
    ? new URL(`/blood-splats/${file}`, EXTENSION_ORIGIN).toString()
    : `/blood-splats/${file}`;

  return {
    url,
    width: spec.width,
    height: spec.height,
    mime: "image/png",
  };
}

function getDeadVisualPosition(item, bounds, gridDpi) {
  const center = bounds?.center ?? item?.position ?? { x: 0, y: 0 };
  const file = getDeadData(item)?.splatFile ?? BLOOD_SPLAT_IDS[0];
  const spec = getBloodSplatSpec(file);
  const squareSize = Number.isFinite(Number(gridDpi)) && Number(gridDpi) > 0 ? Number(gridDpi) : 150;

  return {
    x: center.x + squareSize * Number(spec.offsetSquaresX ?? 0),
    y: center.y + squareSize * Number(spec.offsetSquaresY ?? 0),
  };
}

function getDeadVisualZIndex(item) {
  return DEAD_VISUAL_Z_INDEX;
}

async function buildDeadVisual(item, bounds, gridDpi) {
  const bloodImage = getBloodImage(item);
  const bloodGrid = {
    dpi: 150,
    offset: { x: bloodImage.width / 2, y: bloodImage.height / 2 },
  };

  const visual = buildImage(bloodImage, bloodGrid)
    .id(getDeadVisualId(item))
    .name("Dead Status Blood")
    .position(getDeadVisualPosition(item, bounds, gridDpi))
    .scale({ x: DEAD_SPLAT_SCALE, y: DEAD_SPLAT_SCALE })
    .layer("DRAWING")
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

export async function clearSceneDeadVisuals() {
  if (!(await canManageDeadVisuals())) return;

  const deadVisualItems = await OBR.scene.items.getItems(
    (item) => item?.metadata?.[DEAD_VISUAL_NS]?.deadFor,
  );

  if (deadVisualItems.length === 0) return;
  await OBR.scene.items.deleteItems(deadVisualItems.map((item) => item.id));
}

export async function createDeadVisualsForItems(items) {
  if (!(await canManageDeadVisuals())) return;
  if (!items || items.length === 0) return;

  const deadItems = items.filter((item) => isDead(item) && !isManagedDeadVisual(item));
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
    const visual = await buildDeadVisual(item, boundsById.get(item.id), gridDpi);
    itemsToAdd.push(visual);
  }

  if (itemsToAdd.length > 0) {
    await OBR.scene.items.addItems(itemsToAdd);
  }
}

export async function clearLocalDeadVisuals() {
  await clearSceneDeadVisuals();
}

export function hasAnimatingDeadVisuals() {
  return false;
}

export async function syncLocalDeadVisuals() {}
