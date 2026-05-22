import OBR, { buildText } from "@owlbear-rodeo/sdk";
import { getDeadData, isDead } from "./dead.js";
import { NS } from "./statusModel.js";

export const LOCAL_DEAD_LABEL_NS = `${NS}-local-dead-label`;
const DEAD_LABEL_ID_PREFIX = `${NS}/dead-label/`;
const DEAD_LABEL_TEXT = "Dead!";
const DEAD_LABEL_BASE_FONT_SIZE = 50;
const DEAD_LABEL_FILL = "#ff4d4d";
const DEAD_LABEL_STROKE = "#000000";
const DEAD_LABEL_STROKE_WIDTH = 5;
const DEAD_LABEL_ROTATION_RANGE = 60;
const DEAD_LABEL_PADDING = 4;
const DEAD_LABEL_WIDTH_FACTOR = 4.6;
const DEAD_LABEL_HEIGHT_FACTOR = 1.35;

function getDeadLabelId(itemId) {
  return `${DEAD_LABEL_ID_PREFIX}${itemId}/text`;
}

function hashString(value) {
  let hash = 0;
  const source = String(value ?? "");
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}

function getDeadLabelRotation(item) {
  const deadData = getDeadData(item);
  const seed = `${item?.id ?? ""}:${deadData?.appliedAt ?? 0}`;
  const normalized = hashString(seed) / 0xffffffff;
  return -30 + normalized * DEAD_LABEL_ROTATION_RANGE;
}

function getDeadLabelFontSize(item, bounds, gridDpi) {
  const squareSize = Number.isFinite(Number(gridDpi)) && Number(gridDpi) > 0 ? Number(gridDpi) : 150;
  const widthInSquares = Math.max(0.5, Number(bounds?.width ?? squareSize) / squareSize);
  const heightInSquares = Math.max(0.5, Number(bounds?.height ?? squareSize) / squareSize);
  const averageSquares = (widthInSquares + heightInSquares) / 2;
  return DEAD_LABEL_BASE_FONT_SIZE * averageSquares;
}

function getDeadLabelBox(fontSize) {
  return {
    width: Math.max(fontSize, fontSize * DEAD_LABEL_WIDTH_FACTOR),
    height: Math.max(fontSize, fontSize * DEAD_LABEL_HEIGHT_FACTOR),
  };
}

function buildDeadTextLabel(item, bounds, gridDpi) {
  const center = item?.position ?? bounds?.center ?? { x: 0, y: 0 };
  const fontSize = getDeadLabelFontSize(item, bounds, gridDpi);
  const box = getDeadLabelBox(fontSize);

  return buildText()
    .id(getDeadLabelId(item.id))
    .name("Dead Status Label")
    .position({
      x: Number(center.x ?? 0) - box.width / 2,
      y: Number(center.y ?? 0) - box.height / 2,
    })
    .plainText(DEAD_LABEL_TEXT)
    .textType("PLAIN")
    .width(box.width)
    .height(box.height)
    .fontFamily("fantasy")
    .fontSize(fontSize)
    .fontWeight(700)
    .textAlign("CENTER")
    .textAlignVertical("MIDDLE")
    .fillColor(DEAD_LABEL_FILL)
    .fillOpacity(1)
    .strokeColor(DEAD_LABEL_STROKE)
    .strokeOpacity(1)
    .strokeWidth(DEAD_LABEL_STROKE_WIDTH)
    .lineHeight(1)
    .padding(DEAD_LABEL_PADDING)
    .rotation(getDeadLabelRotation(item))
    .attachedTo(item.id)
    .layer("CHARACTER")
    .locked(true)
    .disableHit(true)
    .disableAutoZIndex(true)
    .disableAttachmentBehavior(["SCALE", "ROTATION"])
    .metadata({
      [LOCAL_DEAD_LABEL_NS]: {
        labelFor: item.id,
      },
    })
    .build();
}

export async function clearLocalDeadLabels() {
  const localItems = await OBR.scene.local.getItems(
    (item) => item?.metadata?.[LOCAL_DEAD_LABEL_NS]?.labelFor,
  );

  if (localItems.length === 0) return;
  await OBR.scene.local.deleteItems(localItems.map((item) => item.id));
}

export async function syncLocalDeadLabels(items) {
  const deadItems = items.filter((item) => isDead(item));
  const localItems = await OBR.scene.local.getItems(
    (item) => item?.metadata?.[LOCAL_DEAD_LABEL_NS]?.labelFor,
  );

  let gridDpi = 150;
  try {
    gridDpi = await OBR.scene.grid.getDpi();
  } catch {
    gridDpi = 150;
  }

  const deadById = new Map(deadItems.map((item) => [item.id, item]));
  const desiredIds = new Set(deadItems.map((item) => getDeadLabelId(item.id)));
  const localItemsById = new Map(localItems.map((item) => [item.id, item]));

  const itemIdsToDelete = localItems
    .filter((localItem) => {
      const ownerId = localItem.metadata?.[LOCAL_DEAD_LABEL_NS]?.labelFor;
      if (!ownerId) return false;
      if (!deadById.has(ownerId)) return true;
      return !desiredIds.has(localItem.id);
    })
    .map((localItem) => localItem.id);

  if (itemIdsToDelete.length > 0) {
    await OBR.scene.local.deleteItems(itemIdsToDelete);
  }

  const boundsById = new Map();
  for (const item of deadItems) {
    try {
      const bounds = await OBR.scene.items.getItemBounds([item.id]);
      boundsById.set(item.id, bounds);
    } catch {
      boundsById.set(item.id, null);
    }
  }

  const itemsToAdd = [];
  for (const item of deadItems) {
    const label = buildDeadTextLabel(item, boundsById.get(item.id), gridDpi);
    label.zIndex = Number(item.zIndex ?? 0) + 0.3;

    const existingLabel = localItemsById.get(label.id);
    if (!existingLabel || existingLabel.type !== label.type) {
      if (existingLabel?.id) {
        await OBR.scene.local.deleteItems([existingLabel.id]);
      }
      itemsToAdd.push(label);
      continue;
    }

    await OBR.scene.local.updateItems([label.id], (draftItems) => {
      for (const draftItem of draftItems) {
        draftItem.position = label.position;
        draftItem.layer = label.layer;
        draftItem.locked = label.locked;
        draftItem.visible = label.visible;
        draftItem.disableHit = label.disableHit;
        draftItem.disableAutoZIndex = label.disableAutoZIndex;
        draftItem.zIndex = label.zIndex;
        draftItem.metadata = label.metadata;
        draftItem.rotation = label.rotation;
        draftItem.attachedTo = label.attachedTo;
        draftItem.disableAttachmentBehavior = label.disableAttachmentBehavior;
        draftItem.text = label.text;
      }
    });
  }

  if (itemsToAdd.length > 0) {
    await OBR.scene.local.addItems(itemsToAdd);
  }
}
