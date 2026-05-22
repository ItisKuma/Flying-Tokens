import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import { getDeadData, isDead } from "./dead.js";
import { BLOOD_SPLAT_IDS, getBloodSplatSpec, resolveBloodSplatFile } from "./deadSplats.js";
import { getBloodynessFromMetadata, normalizeBloodyness } from "./settings.js";
import { NS } from "./statusModel.js";

export const DEAD_VISUAL_NS = `${NS}/dead-visual`;
const DEAD_VISUAL_ID_PREFIX = `${NS}/dead-visual/`;
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
  const file = resolveBloodSplatFile(getDeadData(item)?.splatFile ?? BLOOD_SPLAT_IDS[0]);
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
  const file = resolveBloodSplatFile(getDeadData(item)?.splatFile ?? BLOOD_SPLAT_IDS[0]);
  const spec = getBloodSplatSpec(file);
  const squareSize = Number.isFinite(Number(gridDpi)) && Number(gridDpi) > 0 ? Number(gridDpi) : 150;

  return {
    x: center.x + squareSize * Number(spec.offsetSquaresX ?? 0),
    y: center.y + squareSize * Number(spec.offsetSquaresY ?? 0),
  };
}

function getDeadVisualScale(bounds, gridDpi, bloodyness) {
  const squareSize = Number.isFinite(Number(gridDpi)) && Number(gridDpi) > 0 ? Number(gridDpi) : 150;
  const tokenWidthInSquares = Math.max(0, Number(bounds?.width ?? squareSize) / squareSize);
  const tokenHeightInSquares = Math.max(0, Number(bounds?.height ?? squareSize) / squareSize);
  return ((tokenWidthInSquares + tokenHeightInSquares) / 2) * normalizeBloodyness(bloodyness);
}

async function buildDeadVisual(item, bounds, gridDpi, bloodyness) {
  const bloodImage = getBloodImage(item);
  const bloodGrid = {
    dpi: 150,
    offset: { x: bloodImage.width / 2, y: bloodImage.height / 2 },
  };
  const bloodScale = getDeadVisualScale(bounds, gridDpi, bloodyness);

  const visual = buildImage(bloodImage, bloodGrid)
    .id(getDeadVisualId(item))
    .name("Dead Status Blood")
    .position(getDeadVisualPosition(item, bounds, gridDpi))
    .scale({ x: bloodScale, y: bloodScale })
    .layer("MAP")
    .locked(true)
    .disableHit(true)
    .metadata({
      [DEAD_VISUAL_NS]: {
        deadFor: item.id,
      },
    })
    .build();

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

export async function deleteDeadVisualsForSourceIds(sourceIds) {
  if (!(await canManageDeadVisuals())) return;
  if (!sourceIds || sourceIds.length === 0) return;

  const sourceIdSet = new Set(sourceIds);
  const deadVisualItems = await OBR.scene.items.getItems(
    (item) => sourceIdSet.has(item?.metadata?.[DEAD_VISUAL_NS]?.deadFor),
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
  let bloodyness = 0;

  try {
    gridDpi = await OBR.scene.grid.getDpi();
  } catch {
    gridDpi = 150;
  }

  try {
    const metadata = await OBR.scene.getMetadata();
    bloodyness = getBloodynessFromMetadata(metadata);
  } catch {
    bloodyness = 0.95;
  }

  if (bloodyness <= 0.95) {
    return;
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
    const visual = await buildDeadVisual(item, boundsById.get(item.id), gridDpi, bloodyness);
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
