import OBR, { buildImageUpload } from "@owlbear-rodeo/sdk";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { NS, isFlying } from "./flying.js";

const GIF_CACHE_KEY = `${NS}/gif-cache`;
const FRAME_COUNT = 10;
const FRAME_DELAY_MS = 70;
const SCALE_AMPLITUDE = 0.08;

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sanitizeName(value) {
  return String(value ?? "token")
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 48);
}

function getGifPrototypeData(item) {
  return item?.metadata?.[NS]?.gifPrototype ?? null;
}

function getGifCacheFromMetadata(metadata) {
  return metadata?.[GIF_CACHE_KEY] ?? {};
}

async function getGifCache() {
  const metadata = await OBR.room.getMetadata();
  return getGifCacheFromMetadata(metadata);
}

async function setGifCacheEntry(originalUrl, entry) {
  if (!originalUrl) return;

  const cache = await getGifCache();

  await OBR.room.setMetadata({
    [GIF_CACHE_KEY]: {
      ...cache,
      [originalUrl]: cloneJson(entry),
    },
  });
}

async function loadImageBitmap(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const blob = await response.blob();
  return createImageBitmap(blob);
}

function drawPulseFrame(context, bitmap, width, height, scale) {
  context.clearRect(0, 0, width, height);

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const drawX = (width - scaledWidth) / 2;
  const drawY = (height - scaledHeight) / 2;

  context.drawImage(bitmap, drawX, drawY, scaledWidth, scaledHeight);
}

function encodeGifFromBitmap(bitmap) {
  const width = bitmap.width;
  const height = bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas 2D context unavailable");
  }

  const gif = GIFEncoder();

  for (let index = 0; index < FRAME_COUNT; index += 1) {
    const phase = (index / FRAME_COUNT) * Math.PI * 2;
    const scale = 1 + Math.sin(phase) * SCALE_AMPLITUDE;
    drawPulseFrame(context, bitmap, width, height, scale);

    const frame = context.getImageData(0, 0, width, height);
    const palette = quantize(frame.data, 256, {
      format: "rgba4444",
      oneBitAlpha: true,
      clearAlpha: false,
    });
    const indexed = applyPalette(frame.data, palette, "rgba4444");
    const transparentIndex = palette.findIndex((color) => color[3] === 0);

    gif.writeFrame(indexed, width, height, {
      palette,
      delay: FRAME_DELAY_MS,
      repeat: 0,
      transparent: transparentIndex >= 0,
      transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
    });
  }

  gif.finish();

  return new Blob([gif.bytesView()], { type: "image/gif" });
}

function buildUploadName(item) {
  return `Simple Flying ${sanitizeName(item?.name || "Token")} ${Date.now()}`;
}

function getOriginalImageKey(item) {
  const prototypeData = getGifPrototypeData(item);
  return prototypeData?.originalImage?.url ?? item?.image?.url ?? null;
}

async function applyPrototypeAssetToToken(itemId, asset, itemSnapshot) {
  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const item of items) {
      if (!item?.metadata?.[NS] || !item?.image) continue;

      const currentData = item.metadata[NS];
      const currentPrototype = currentData.gifPrototype;
      const originalImage = currentPrototype?.originalImage ?? cloneJson(itemSnapshot.image);
      const originalGrid = currentPrototype?.originalGrid ?? cloneJson(itemSnapshot.grid);

      item.image = cloneJson(asset.image);
      item.grid = cloneJson(asset.grid);
      item.metadata = {
        ...item.metadata,
        [NS]: {
          ...currentData,
          gifPrototype: {
            active: true,
            originalImage,
            originalGrid,
            assetImage: cloneJson(asset.image),
            assetGrid: cloneJson(asset.grid),
            assetName: asset.name ?? null,
          },
        },
      };
    }
  });
}

async function applyCachedGifPrototypeToToken(item, cachedAsset) {
  if (!item?.id || !cachedAsset?.image?.url) {
    return false;
  }

  if (!isFlying(item)) {
    return false;
  }

  if (hasActiveGifPrototype(item)) {
    return false;
  }

  await applyPrototypeAssetToToken(item.id, cachedAsset, item);
  return true;
}

export function hasActiveGifPrototype(item) {
  return Boolean(getGifPrototypeData(item)?.active);
}

export async function restoreGifPrototype(itemId) {
  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const item of items) {
      if (!item?.metadata?.[NS]) continue;

      const currentData = item.metadata[NS];
      const currentPrototype = currentData.gifPrototype;

      if (!currentPrototype?.originalImage) continue;

      item.image = cloneJson(currentPrototype.originalImage);
      item.grid = cloneJson(currentPrototype.originalGrid);

      const nextData = { ...currentData };
      delete nextData.gifPrototype;

      item.metadata = {
        ...item.metadata,
        [NS]: nextData,
      };
    }
  });
}

export async function restoreGifPrototypeFromItem(item) {
  if (!item?.id || !getGifPrototypeData(item)?.active) {
    return false;
  }

  await restoreGifPrototype(item.id);
  return true;
}

export async function syncGifPrototypes(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return;
  }

  const cache = await getGifCache();

  for (const item of items) {
    if (!item?.id) continue;

    if (isFlying(item)) {
      const originalUrl = getOriginalImageKey(item);
      const cachedAsset = cache[originalUrl];

      if (cachedAsset?.image?.url) {
        await applyCachedGifPrototypeToToken(item, cachedAsset);
      }
      continue;
    }

    if (hasActiveGifPrototype(item)) {
      await restoreGifPrototypeFromItem(item);
    }
  }
}

export async function ensureGifPrototype(item) {
  if (!item?.id || !item?.image?.url) {
    throw new Error("Selected token does not have an image");
  }

  const originalUrl = getOriginalImageKey(item);
  const cache = await getGifCache();
  const cachedAsset = cache[originalUrl];

  if (cachedAsset?.image?.url) {
    await applyPrototypeAssetToToken(item.id, cachedAsset, item);
    return { reused: true };
  }

  const bitmap = await loadImageBitmap(item.image.url);
  const gifBlob = encodeGifFromBitmap(bitmap);
  const uploadName = buildUploadName(item);
  const upload = buildImageUpload(gifBlob)
    .name(uploadName)
    .grid(cloneJson(item.grid))
    .build();

  await OBR.assets.uploadImages([upload], "CHARACTER");

  const downloads = await OBR.assets.downloadImages(false, uploadName, "CHARACTER");
  const selectedAsset = downloads?.[0];

  if (!selectedAsset?.image?.url) {
    return { cancelled: true };
  }

  const cacheEntry = {
    image: cloneJson(selectedAsset.image),
    grid: cloneJson(selectedAsset.grid),
    name: selectedAsset.name ?? uploadName,
  };

  await setGifCacheEntry(originalUrl, cacheEntry);
  await applyPrototypeAssetToToken(item.id, cacheEntry, item);

  return { reused: false };
}
