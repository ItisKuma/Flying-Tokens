import OBR, { buildText } from "@owlbear-rodeo/sdk";
import { getFlyingItems, getItemZFeet } from "./flying.js";
import { NS } from "./statusModel.js";

export const LOCAL_FLYING_LABEL_NS = `${NS}-local-flying-label`;
const FLYING_LABEL_ID_PREFIX = `${NS}/flying-label/`;
const LABEL_GAP = 18;

function getFlyingLabelId(itemId) {
  return `${FLYING_LABEL_ID_PREFIX}${itemId}`;
}

function getFlyingLabelText(item) {
  const zFeet = getItemZFeet(item);
  return `🪽 ${zFeet} ft. 🪽`;
}

function getDisplayedTokenHeight(item, bounds) {
  return Math.abs(
    Number(bounds?.height ?? item?.image?.height ?? item?.shape?.height ?? item?.height ?? 100),
  );
}

function getFlyingLabelPosition(item, bounds) {
  const center = item?.position ?? bounds?.center ?? { x: 0, y: 0 };
  const height = getDisplayedTokenHeight(item, bounds);
  return {
    x: Number(center.x ?? 0),
    y: Number(center.y ?? 0) - height / 2 - LABEL_GAP,
  };
}

function buildFlyingLabel(item, bounds) {
  return buildText()
    .id(getFlyingLabelId(item.id))
    .name("Flying Height")
    .position(getFlyingLabelPosition(item, bounds))
    .plainText(getFlyingLabelText(item))
    .textType("PLAIN")
    .width("AUTO")
    .height("AUTO")
    .fontFamily("Roboto")
    .fontSize(28)
    .fontWeight(700)
    .textAlign("CENTER")
    .textAlignVertical("MIDDLE")
    .fillColor("#ffd978")
    .fillOpacity(1)
    .strokeColor("#0f1118")
    .strokeOpacity(0.95)
    .strokeWidth(3)
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
      },
    })
    .build();
}

export async function clearLocalFlyingLabels() {
  const localItems = await OBR.scene.local.getItems(
    (item) => item?.metadata?.[LOCAL_FLYING_LABEL_NS]?.labelFor,
  );

  if (localItems.length === 0) return;
  await OBR.scene.local.deleteItems(localItems.map((item) => item.id));
}

export async function syncLocalFlyingLabels(items) {
  const flyingItems = getFlyingItems(items);
  const localItems = await OBR.scene.local.getItems(
    (item) => item?.metadata?.[LOCAL_FLYING_LABEL_NS]?.labelFor,
  );

  const flyingById = new Map(flyingItems.map((item) => [item.id, item]));
  const desiredLabelIds = new Set(flyingItems.map((item) => getFlyingLabelId(item.id)));
  const itemIdsToDelete = localItems
    .filter((localItem) => {
      const ownerId = localItem.metadata?.[LOCAL_FLYING_LABEL_NS]?.labelFor;
      if (!ownerId) return false;
      if (!flyingById.has(ownerId)) return true;
      return !desiredLabelIds.has(localItem.id);
    })
    .map((localItem) => localItem.id);

  if (itemIdsToDelete.length > 0) {
    await OBR.scene.local.deleteItems(itemIdsToDelete);
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
    const label = buildFlyingLabel(item, boundsById.get(item.id));
    label.zIndex = Number(item.zIndex ?? 0) + 0.2;

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
        draftItem.text = label.text;
        draftItem.attachedTo = label.attachedTo;
        draftItem.disableAttachmentBehavior = label.disableAttachmentBehavior;
      }
    });
  }

  if (itemsToAdd.length > 0) {
    await OBR.scene.local.addItems(itemsToAdd);
  }
}
