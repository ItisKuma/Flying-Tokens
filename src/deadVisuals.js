import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import { getBaseScale } from "./flying.js";
import { getDeadData, isDead } from "./dead.js";
import { BLOOD_SPLAT_IDS } from "./deadSplats.js";
import { DEAD_STATUS_ID, NS } from "./statusModel.js";

export const DEAD_VISUAL_NS = `${NS}/dead-visual`;
const DEAD_VISUAL_ID_PREFIX = `${NS}/dead-visual/`;
const DEAD_SPLAT_SIZE_MULTIPLIER = 4.8;
const BLOOD_IMAGE_WIDTH = 512;
const BLOOD_IMAGE_HEIGHT = 512;
const BLOOD_GRID = {
  dpi: 150,
  offset: { x: BLOOD_IMAGE_WIDTH / 2, y: BLOOD_IMAGE_HEIGHT / 2 },
};
const EXTENSION_ORIGIN = globalThis.location?.origin ?? "";
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
        });
        return;
      }

      context.drawImage(image, 0, 0);
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const alpha = data[(y * width + x) * 4 + 3];
          if (alpha <= 8) continue;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }

      if (maxX < minX || maxY < minY) {
        resolve({
          widthRatio: 1,
          heightRatio: 1,
        });
        return;
      }

      const visibleWidth = maxX - minX + 1;
      const visibleHeight = maxY - minY + 1;

      resolve({
        widthRatio: visibleWidth / width,
        heightRatio: visibleHeight / height,
      });
    };
    image.onerror = () => {
      resolve({
        widthRatio: 1,
        heightRatio: 1,
      });
    };
    image.src = bloodImage.url;
  });

  bloodProfileCache.set(cacheKey, profilePromise);
  return profilePromise;
}

function getDeadVisualSize(item, bounds, bloodProfile) {
  const width = Number(bounds?.width ?? item?.image?.width ?? 100);
  const height = Number(bounds?.height ?? item?.image?.height ?? 100);
  const baseScale = getBaseScale(item);
  const baseWidth = width / Number(baseScale?.x ?? 1);
  const baseHeight = height / Number(baseScale?.y ?? 1);
  const widthRatio = Math.max(0.01, Number(bloodProfile?.widthRatio ?? 1));
  const heightRatio = Math.max(0.01, Number(bloodProfile?.heightRatio ?? 1));

  return {
    width: (baseWidth * DEAD_SPLAT_SIZE_MULTIPLIER) / widthRatio,
    height: (baseHeight * DEAD_SPLAT_SIZE_MULTIPLIER) / heightRatio,
  };
}

function getDeadVisualPosition(item, bounds) {
  const center = bounds?.center ?? item?.position ?? { x: 0, y: 0 };

  return {
    x: center.x,
    y: center.y,
  };
}

function getDeadVisualZIndex(item) {
  return Number(item?.zIndex ?? 0) - 0.2;
}

async function buildDeadVisual(item, bounds) {
  const bloodImage = getBloodImage(item);
  const bloodProfile = await getBloodProfile(bloodImage);
  const size = getDeadVisualSize(item, bounds, bloodProfile);

  const visual = buildImage(bloodImage, BLOOD_GRID)
    .id(getDeadVisualId(item.id))
    .name("Dead Status Blood")
    .position(getDeadVisualPosition(item, bounds))
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
  for (const item of deadItems) {
    try {
      const bounds = await OBR.scene.items.getItemBounds([item.id]);
      boundsById.set(item.id, bounds);
    } catch {
      boundsById.set(item.id, null);
    }
  }

  for (const item of deadItems) {
    const visual = await buildDeadVisual(item, boundsById.get(item.id));
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
