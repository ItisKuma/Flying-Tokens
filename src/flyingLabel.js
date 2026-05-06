import OBR, { buildImage, buildText } from "@owlbear-rodeo/sdk";
import { getFlyingItems, getItemZFeet } from "./flying.js";
import { NS } from "./statusModel.js";

export const LOCAL_FLYING_LABEL_NS = `${NS}-local-flying-label`;
const FLYING_LABEL_ID_PREFIX = `${NS}/flying-label/`;
const FLYING_WING_IMAGE = {
  url: globalThis.location?.origin
    ? new URL("/flying-wing.svg", globalThis.location.origin).toString()
    : "/flying-wing.svg",
  width: 128,
  height: 96,
  mime: "image/svg+xml",
};
const FLYING_WING_GRID = {
  dpi: 150,
  offset: { x: 0, y: 0 },
};
const LABEL_GAP = 28;
const WING_TEXT_GAP = -6;
const LABEL_FONT_SIZE = 60;
const LABEL_CHAR_WIDTH = 24;
const WING_WIDTH = LABEL_FONT_SIZE * 1.5;
const WING_ASPECT_RATIO = FLYING_WING_IMAGE.width / FLYING_WING_IMAGE.height;
const WING_HEIGHT = WING_WIDTH / WING_ASPECT_RATIO;

function getFlyingLabelId(itemId) {
  return `${FLYING_LABEL_ID_PREFIX}${itemId}/text`;
}

function getFlyingWingId(itemId, side) {
  return `${FLYING_LABEL_ID_PREFIX}${itemId}/wing-${side}`;
}

function getFlyingLabelText(item) {
  return `${getItemZFeet(item)}ft`;
}

function getEstimatedLabelWidth(text) {
  return Math.max(58, text.length * LABEL_CHAR_WIDTH);
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

function buildFlyingWing(item, bounds, side) {
  const anchor = getFlyingLabelAnchor(item, bounds);
  const textWidth = getEstimatedLabelWidth(getFlyingLabelText(item));
  const direction = side === "left" ? -1 : 1;
  return buildImage(FLYING_WING_IMAGE, FLYING_WING_GRID)
    .id(getFlyingWingId(item.id, side))
    .name("Flying Wing")
    .position({
      x: anchor.x + direction * (textWidth / 2 + WING_TEXT_GAP + WING_WIDTH / 2),
      y: anchor.y,
    })
    .scale({
      x: (WING_WIDTH / FLYING_WING_IMAGE.width) * direction,
      y: WING_HEIGHT / FLYING_WING_IMAGE.height,
    })
    .attachedTo(item.id)
    .layer("CHARACTER")
    .locked(true)
    .disableHit(true)
    .disableAutoZIndex(true)
    .disableAttachmentBehavior(["SCALE", "ROTATION"])
    .metadata({
      [LOCAL_FLYING_LABEL_NS]: {
        labelFor: item.id,
        role: `wing-${side}`,
      },
    })
    .build();
}

function getDesiredFlyingLabelIds(flyingItems) {
  return new Set(
    flyingItems.flatMap((item) => [
      getFlyingLabelId(item.id),
      getFlyingWingId(item.id, "left"),
      getFlyingWingId(item.id, "right"),
    ]),
  );
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
    const bounds = boundsById.get(item.id);
    const textLabel = buildFlyingTextLabel(item, bounds);
    textLabel.zIndex = Number(item.zIndex ?? 0) + 0.2;

    const wings = [
      buildFlyingWing(item, bounds, "left"),
      buildFlyingWing(item, bounds, "right"),
    ];
    wings[0].zIndex = Number(item.zIndex ?? 0) - 0.2;
    wings[1].zIndex = Number(item.zIndex ?? 0) - 0.2;

    for (const label of [textLabel, ...wings]) {
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

          if (label.type === "TEXT") {
            draftItem.text = label.text;
          } else if (label.type === "IMAGE") {
            draftItem.scale = label.scale;
            draftItem.image = label.image;
            draftItem.grid = label.grid;
          }
        }
      });
    }
  }

  if (itemsToAdd.length > 0) {
    await OBR.scene.local.addItems(itemsToAdd);
  }
}
