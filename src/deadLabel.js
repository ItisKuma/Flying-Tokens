import OBR, { buildText } from "@owlbear-rodeo/sdk";
import { isDead } from "./dead.js";
import { approxEqual, canManageSharedVisuals, sameStringArray } from "./sharedVisuals.js";
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

function getRandomDeadLabelRotation() {
  return -30 + Math.random() * DEAD_LABEL_ROTATION_RANGE;
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
    .rotation(getRandomDeadLabelRotation())
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

function isSameDeadLabel(existingItem, desiredItem) {
  const existingText = existingItem?.text ?? {};
  const desiredText = desiredItem?.text ?? {};
  const existingStyle = existingText.style ?? {};
  const desiredStyle = desiredText.style ?? {};

  return (
    existingItem?.type === desiredItem?.type &&
    approxEqual(existingItem?.position?.x, desiredItem?.position?.x) &&
    approxEqual(existingItem?.position?.y, desiredItem?.position?.y) &&
    approxEqual(existingItem?.width, desiredItem?.width) &&
    approxEqual(existingItem?.height, desiredItem?.height) &&
    approxEqual(existingItem?.zIndex, desiredItem?.zIndex) &&
    existingItem?.layer === desiredItem?.layer &&
    existingItem?.locked === desiredItem?.locked &&
    existingItem?.disableHit === desiredItem?.disableHit &&
    existingItem?.disableAutoZIndex === desiredItem?.disableAutoZIndex &&
    existingItem?.attachedTo === desiredItem?.attachedTo &&
    sameStringArray(existingItem?.disableAttachmentBehavior, desiredItem?.disableAttachmentBehavior) &&
    existingText.plainText === desiredText.plainText &&
    existingText.richText === desiredText.richText &&
    existingText.type === desiredText.type &&
    approxEqual(existingText.padding, desiredText.padding) &&
    approxEqual(existingText.lineHeight, desiredText.lineHeight) &&
    existingStyle.fontFamily === desiredStyle.fontFamily &&
    approxEqual(existingStyle.fontSize, desiredStyle.fontSize) &&
    existingStyle.fontWeight === desiredStyle.fontWeight &&
    existingStyle.textAlign === desiredStyle.textAlign &&
    existingStyle.textAlignVertical === desiredStyle.textAlignVertical &&
    existingStyle.fillColor === desiredStyle.fillColor &&
    approxEqual(existingStyle.fillOpacity, desiredStyle.fillOpacity) &&
    existingStyle.strokeColor === desiredStyle.strokeColor &&
    approxEqual(existingStyle.strokeOpacity, desiredStyle.strokeOpacity) &&
    approxEqual(existingStyle.strokeWidth, desiredStyle.strokeWidth)
  );
}

export async function clearLocalDeadLabels() {
  if (!(await canManageSharedVisuals())) return;

  const localItems = await OBR.scene.items.getItems(
    (item) => item?.metadata?.[LOCAL_DEAD_LABEL_NS]?.labelFor,
  );

  if (localItems.length === 0) return;
  await OBR.scene.items.deleteItems(localItems.map((item) => item.id));
}

export async function deleteLocalDeadLabelsForSourceIds(sourceIds) {
  if (!(await canManageSharedVisuals())) return;

  const ids = Array.from(new Set((sourceIds ?? []).filter(Boolean)));
  if (ids.length === 0) return;

  const sourceIdSet = new Set(ids);
  const localItems = await OBR.scene.items.getItems(
    (item) => sourceIdSet.has(item?.metadata?.[LOCAL_DEAD_LABEL_NS]?.labelFor),
  );

  if (localItems.length === 0) return;
  await OBR.scene.items.deleteItems(localItems.map((item) => item.id));
}

export async function upsertLocalDeadLabelsForItems(items) {
  if (!(await canManageSharedVisuals())) return;

  const relevantItems = (items ?? []).filter(Boolean);
  const relevantIds = new Set(relevantItems.map((item) => item.id));
  if (relevantIds.size === 0) return;

  const deadItems = relevantItems.filter((item) => isDead(item));
  const deadIds = new Set(deadItems.map((item) => item.id));
  const localItems = await OBR.scene.items.getItems(
    (item) => relevantIds.has(item?.metadata?.[LOCAL_DEAD_LABEL_NS]?.labelFor),
  );

  const itemIdsToDelete = localItems
    .filter((localItem) => {
      const ownerId = localItem.metadata?.[LOCAL_DEAD_LABEL_NS]?.labelFor;
      return ownerId && !deadIds.has(ownerId);
    })
    .map((localItem) => localItem.id);

  if (itemIdsToDelete.length > 0) {
    await OBR.scene.items.deleteItems(itemIdsToDelete);
  }

  if (deadItems.length === 0) return;

  let gridDpi = 150;
  try {
    gridDpi = await OBR.scene.grid.getDpi();
  } catch {
    gridDpi = 150;
  }

  const localItemsById = new Map(localItems.map((item) => [item.id, item]));
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
        await OBR.scene.items.deleteItems([existingLabel.id]);
      }
      itemsToAdd.push(label);
      continue;
    }

    if (isSameDeadLabel(existingLabel, label)) {
      continue;
    }

    await OBR.scene.items.updateItems([label.id], (draftItems) => {
      for (const draftItem of draftItems) {
        draftItem.position = label.position;
        draftItem.layer = label.layer;
        draftItem.locked = label.locked;
        draftItem.visible = label.visible;
        draftItem.disableHit = label.disableHit;
        draftItem.disableAutoZIndex = label.disableAutoZIndex;
        draftItem.zIndex = label.zIndex;
        draftItem.metadata = label.metadata;
        draftItem.attachedTo = label.attachedTo;
        draftItem.disableAttachmentBehavior = label.disableAttachmentBehavior;
        draftItem.text = label.text;
      }
    });
  }

  if (itemsToAdd.length > 0) {
    await OBR.scene.items.addItems(itemsToAdd);
  }
}

export async function createLocalDeadLabelsForItems(items) {
  await upsertLocalDeadLabelsForItems(items);
}
