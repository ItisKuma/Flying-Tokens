import OBR, { buildText } from "@owlbear-rodeo/sdk";
import { getFlyingItems, getItemZFeet } from "./flying.js";
import { approxEqual, canManageSharedVisuals, sameStringArray } from "./sharedVisuals.js";
import { NS } from "./statusModel.js";

export const LOCAL_FLYING_LABEL_NS = `${NS}-local-flying-label`;
const FLYING_LABEL_ID_PREFIX = `${NS}/flying-label/`;
const LABEL_GAP = 28;
const LABEL_FONT_SIZE = 60;

function getFlyingLabelId(itemId) {
  return `${FLYING_LABEL_ID_PREFIX}${itemId}/text`;
}

function getFlyingLabelText(item) {
  return `${getItemZFeet(item)}ft`;
}

function getDisplayedTokenHeight(item, bounds) {
  return Math.abs(
    Number(bounds?.height ?? item?.image?.height ?? item?.shape?.height ?? item?.height ?? 100),
  );
}

function getFlyingLabelAnchor(item, bounds) {
  const center = item?.position ?? bounds?.center ?? { x: 0, y: 0 };
  const height = getDisplayedTokenHeight(item, bounds);
  return {
    x: Number(center.x ?? 0),
    y: Number(center.y ?? 0) - height / 2 - LABEL_GAP,
  };
}

function buildFlyingTextLabel(item, bounds) {
  const text = getFlyingLabelText(item);
  return buildText()
    .id(getFlyingLabelId(item.id))
    .name("Flying Height")
    .position(getFlyingLabelAnchor(item, bounds))
    .plainText(text)
    .textType("PLAIN")
    .width("AUTO")
    .height("AUTO")
    .fontFamily("Roboto")
    .fontSize(LABEL_FONT_SIZE)
    .fontWeight(700)
    .textAlign("CENTER")
    .textAlignVertical("MIDDLE")
    .fillColor("#ffd978")
    .fillOpacity(1)
    .strokeColor("#0f1118")
    .strokeOpacity(0.95)
    .strokeWidth(4)
    .lineHeight(1.1)
    .padding(6)
    .attachedTo(item.id)
    .layer("CHARACTER")
    .locked(true)
    .disableHit(true)
    .disableAutoZIndex(true)
    .disableAttachmentBehavior(["SCALE", "ROTATION"])
    .metadata({
      [LOCAL_FLYING_LABEL_NS]: {
        labelFor: item.id,
        role: "text",
      },
    })
    .build();
}

function isSameFlyingLabel(existingItem, desiredItem) {
  const existingText = existingItem?.text ?? {};
  const desiredText = desiredItem?.text ?? {};
  const existingStyle = existingText.style ?? {};
  const desiredStyle = desiredText.style ?? {};

  return (
    existingItem?.type === desiredItem?.type &&
    approxEqual(existingItem?.position?.x, desiredItem?.position?.x) &&
    approxEqual(existingItem?.position?.y, desiredItem?.position?.y) &&
    approxEqual(existingItem?.zIndex, desiredItem?.zIndex) &&
    existingItem?.layer === desiredItem?.layer &&
    existingItem?.locked === desiredItem?.locked &&
    existingItem?.disableHit === desiredItem?.disableHit &&
    existingItem?.disableAutoZIndex === desiredItem?.disableAutoZIndex &&
    existingItem?.attachedTo === desiredItem?.attachedTo &&
    sameStringArray(existingItem?.disableAttachmentBehavior, desiredItem?.disableAttachmentBehavior) &&
    existingText.plainText === desiredText.plainText &&
    existingText.type === desiredText.type &&
    existingText.width === desiredText.width &&
    existingText.height === desiredText.height &&
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

function getDesiredFlyingLabelIds(flyingItems) {
  return new Set(flyingItems.map((item) => getFlyingLabelId(item.id)));
}

export async function clearLocalFlyingLabels() {
  if (!(await canManageSharedVisuals())) return;

  const localItems = await OBR.scene.items.getItems(
    (item) => item?.metadata?.[LOCAL_FLYING_LABEL_NS]?.labelFor,
  );

  if (localItems.length === 0) return;
  await OBR.scene.items.deleteItems(localItems.map((item) => item.id));
}

export async function syncLocalFlyingLabels(items) {
  if (!(await canManageSharedVisuals())) return;

  const flyingItems = getFlyingItems(items);
  const localItems = await OBR.scene.items.getItems(
    (item) => item?.metadata?.[LOCAL_FLYING_LABEL_NS]?.labelFor,
  );

  const flyingById = new Map(flyingItems.map((item) => [item.id, item]));
  const desiredLabelIds = getDesiredFlyingLabelIds(flyingItems);
  const itemIdsToDelete = localItems
    .filter((localItem) => {
      const ownerId = localItem.metadata?.[LOCAL_FLYING_LABEL_NS]?.labelFor;
      if (!ownerId) return false;
      if (!flyingById.has(ownerId)) return true;
      return !desiredLabelIds.has(localItem.id);
    })
    .map((localItem) => localItem.id);

  if (itemIdsToDelete.length > 0) {
    await OBR.scene.items.deleteItems(itemIdsToDelete);
  }

  const localItemsById = new Map(localItems.map((localItem) => [localItem.id, localItem]));
  const itemsToAdd = [];
  const boundsById = new Map();

  for (const item of flyingItems) {
    try {
      const bounds = await OBR.scene.items.getItemBounds([item.id]);
      boundsById.set(item.id, bounds);
    } catch {
      boundsById.set(item.id, null);
    }
  }

  for (const item of flyingItems) {
    const bounds = boundsById.get(item.id);
    const textLabel = buildFlyingTextLabel(item, bounds);
    textLabel.zIndex = Number(item.zIndex ?? 0) + 0.2;

    const existingLabel = localItemsById.get(textLabel.id);
    if (!existingLabel || existingLabel.type !== textLabel.type) {
      if (existingLabel?.id) {
        await OBR.scene.items.deleteItems([existingLabel.id]);
      }
      itemsToAdd.push(textLabel);
      continue;
    }

    if (isSameFlyingLabel(existingLabel, textLabel)) {
      continue;
    }

    await OBR.scene.items.updateItems([textLabel.id], (draftItems) => {
      for (const draftItem of draftItems) {
        draftItem.position = textLabel.position;
        draftItem.layer = textLabel.layer;
        draftItem.locked = textLabel.locked;
        draftItem.visible = textLabel.visible;
        draftItem.disableHit = textLabel.disableHit;
        draftItem.disableAutoZIndex = textLabel.disableAutoZIndex;
        draftItem.zIndex = textLabel.zIndex;
        draftItem.metadata = textLabel.metadata;
        draftItem.rotation = textLabel.rotation;
        draftItem.attachedTo = textLabel.attachedTo;
        draftItem.disableAttachmentBehavior = textLabel.disableAttachmentBehavior;
        draftItem.text = textLabel.text;
      }
    });
  }

  if (itemsToAdd.length > 0) {
    await OBR.scene.items.addItems(itemsToAdd);
  }
}
