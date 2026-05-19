import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import { getBaseScale } from "./flying.js";
import { isDead } from "./dead.js";
import { DEAD_STATUS_ID, NS } from "./statusModel.js";

export const DEAD_VISUAL_NS = `${NS}/dead-visual`;
const DEAD_VISUAL_ID_PREFIX = `${NS}/dead-visual/`;
const DEAD_ANIMATION_DURATION_MS = 480;
const DEAD_SPLAT_SIZE_MULTIPLIER = 4.8;
const BLOOD_GRID = {
  dpi: 150,
  offset: { x: 0, y: 0 },
};
const EXTENSION_ORIGIN = globalThis.location?.origin ?? "";
const BLOOD_SPLAT_IDS = [
  "blood_splat_01.png",
  "blood_splat_04.png",
  "blood_splat_05.png",
  "blood_splat_08.png",
  "blood_splat_09.png",
  "blood_splat_13.png",
  "blood_splat_17.png",
];
let cachedRolePromise = null;
const bloodProfileCache = new Map();

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

async function getBloodProfile(bloodImage) {
  const cacheKey = bloodImage.url;
  if (bloodProfileCache.has(cacheKey)) {
    return bloodProfileCache.get(cacheKey);
  }

  const profilePromise = new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || bloodImage.width;
      canvas.height = image.naturalHeight || bloodImage.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        resolve({
          widthRatio: 1,
          heightRatio: 1,
          centerXRatio: 0.5,
          centerYRatio: 0.5,
        });
        return;
      }

      context.drawImage(image, 0, 0);
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      let alphaTotal = 0;
      let weightedX = 0;
      let weightedY = 0;

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const alpha = data[(y * width + x) * 4 + 3];
          if (alpha <= 8) continue;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          alphaTotal += alpha;
          weightedX += (x + 0.5) * alpha;
          weightedY += (y + 0.5) * alpha;
        }
      }

      if (maxX < minX || maxY < minY) {
        resolve({
          widthRatio: 1,
          heightRatio: 1,
          centerXRatio: 0.5,
          centerYRatio: 0.5,
        });
        return;
      }

      const visibleWidth = maxX - minX + 1;
      const visibleHeight = maxY - minY + 1;
      const visibleCenterX =
        alphaTotal > 0 ? weightedX / alphaTotal : minX + visibleWidth / 2;
      const visibleCenterY =
        alphaTotal > 0 ? weightedY / alphaTotal : minY + visibleHeight / 2;

      resolve({
        widthRatio: visibleWidth / width,
        heightRatio: visibleHeight / height,
        centerXRatio: visibleCenterX / width,
        centerYRatio: visibleCenterY / height,
      });
    };
    image.onerror = () => {
      resolve({
        widthRatio: 1,
        heightRatio: 1,
        centerXRatio: 0.5,
        centerYRatio: 0.5,
      });
    };
    image.src = bloodImage.url;
  });

  bloodProfileCache.set(cacheKey, profilePromise);
  return profilePromise;
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

function getDeadVisualSize(item, bounds, bloodProfile, now = Date.now()) {
  const width = Number(bounds?.width ?? item?.image?.width ?? 100);
  const height = Number(bounds?.height ?? item?.image?.height ?? 100);
  const baseScale = getBaseScale(item);
  const baseWidth = width / Number(baseScale?.x ?? 1);
  const baseHeight = height / Number(baseScale?.y ?? 1);
  const scale = getDeadBoundsScale(item, now);
  const widthRatio = Math.max(0.01, Number(bloodProfile?.widthRatio ?? 1));
  const heightRatio = Math.max(0.01, Number(bloodProfile?.heightRatio ?? 1));

  return {
    width: (baseWidth * scale * DEAD_SPLAT_SIZE_MULTIPLIER) / widthRatio,
    height: (baseHeight * scale * DEAD_SPLAT_SIZE_MULTIPLIER) / heightRatio,
  };
}

function getDeadVisualPosition(item, bounds, size, bloodProfile) {
  const center = bounds?.center ?? item?.position ?? { x: 0, y: 0 };
  const centerXRatio = Number(bloodProfile?.centerXRatio ?? 0.5);
  const centerYRatio = Number(bloodProfile?.centerYRatio ?? 0.5);

  return {
    x: center.x - size.width * centerXRatio,
    y: center.y - size.height * centerYRatio,
  };
}

function getDeadVisualZIndex(item) {
  return Number(item?.zIndex ?? 0) - 0.2;
}

async function buildDeadVisual(item, bounds, now = Date.now()) {
  const bloodImage = getBloodImage(item.id);
  const bloodProfile = await getBloodProfile(bloodImage);
  const size = getDeadVisualSize(item, bounds, bloodProfile, now);

  const visual = buildImage(bloodImage, BLOOD_GRID)
    .id(getDeadVisualId(item.id))
    .name("Dead Status Blood")
    .position(getDeadVisualPosition(item, bounds, size, bloodProfile))
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
    const visual = await buildDeadVisual(item, boundsById.get(item.id), now);
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
