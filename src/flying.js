import OBR from "@owlbear-rodeo/sdk";

export const NS = "simple-flying";
export const MIN_Z_FEET = 5;
export const MAX_Z_FEET = 150;
export const Z_STEP_FEET = 5;
export const DEFAULT_Z_FEET = 5;
export const Z_INDEX_PER_FOOT = 1000000000000;
export const SCALE_PER_5_FEET = 0.05;

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function getFlyingOverlayText(zFeet) {
  return `Flying: ${clampZFeet(zFeet)} ft`;
}

function buildFlyingTextContent(currentText, zFeet) {
  const baseText = cloneJson(currentText) ?? {
    richText: [
      {
        type: "paragraph",
        children: [{ text: "" }],
      },
    ],
    plainText: "",
    style: {
      padding: 8,
      fontFamily: "Roboto",
      fontSize: 24,
      fontWeight: 400,
      textAlign: "CENTER",
      textAlignVertical: "BOTTOM",
      fillColor: "white",
      fillOpacity: 1,
      strokeColor: "white",
      strokeOpacity: 1,
      strokeWidth: 0,
      lineHeight: 1.5,
    },
    type: "PLAIN",
    width: "AUTO",
    height: "AUTO",
  };

  const plainText = getFlyingOverlayText(zFeet);

  return {
    ...baseText,
    plainText,
    richText: [
      {
        type: "paragraph",
        children: [{ text: plainText }],
      },
    ],
    type: "PLAIN",
    style: {
      ...baseText.style,
      textAlign: "CENTER",
      textAlignVertical: "TOP",
      fillColor: "#ffd978",
      fillOpacity: 1,
      strokeColor: "#0f1118",
      strokeOpacity: 0.95,
      strokeWidth: 3,
      fontWeight: 700,
      padding: 6,
    },
  };
}

export function clampZFeet(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_Z_FEET;
  }

  const snappedValue =
    Math.round(numericValue / Z_STEP_FEET) * Z_STEP_FEET;

  return Math.min(MAX_Z_FEET, Math.max(MIN_Z_FEET, snappedValue));
}

export function getFlyingData(item) {
  return item?.metadata?.[NS];
}

export function isFlying(item) {
  return Boolean(getFlyingData(item)?.flying);
}

export function getItemZFeet(item) {
  if (!isFlying(item)) {
    return 0;
  }

  return clampZFeet(getFlyingData(item)?.zFeet ?? DEFAULT_Z_FEET);
}

export function getBaseZIndex(item) {
  if (!isFlying(item)) {
    return Number(item?.zIndex ?? 0);
  }

  return Number(getFlyingData(item)?.baseZIndex ?? item?.zIndex ?? 0);
}

export function getFlyingZIndex(baseZIndex, zFeet) {
  return Number(baseZIndex) + clampZFeet(zFeet) * Z_INDEX_PER_FOOT;
}

export function getBaseScale(item) {
  if (!isFlying(item)) {
    return item?.scale ?? { x: 1, y: 1 };
  }

  return getFlyingData(item)?.baseScale ?? item?.scale ?? { x: 1, y: 1 };
}

export function getFlyingScale(baseScale, zFeet) {
  const steps = clampZFeet(zFeet) / Z_STEP_FEET;
  const multiplier = 1 + steps * SCALE_PER_5_FEET;

  return {
    x: Number(baseScale?.x ?? 1) * multiplier,
    y: Number(baseScale?.y ?? 1) * multiplier,
  };
}

export function getVisualFlyingScale(baseScale, zFeet) {
  const numericZFeet = Math.max(0, Number(zFeet) || 0);
  const multiplier = 1 + (numericZFeet / Z_STEP_FEET) * SCALE_PER_5_FEET;

  return {
    x: Number(baseScale?.x ?? 1) * multiplier,
    y: Number(baseScale?.y ?? 1) * multiplier,
  };
}

export function getItemLabel(item) {
  return item?.name?.trim() || item?.text?.plainText?.trim() || "Unnamed token";
}

export function getFlyingItems(items) {
  return items.filter((item) => isFlying(item));
}

export async function toggleFlyingForItems(items) {
  if (!items || items.length === 0) return;

  for (const item of items) {
    if (!item) continue;

    const data = item.metadata?.[NS];

    // ENABLE FLYING
    if (!data?.flying) {
      await OBR.scene.items.updateItems([item.id], (items) => {
        for (const i of items) {
          if (!i) continue;

          const baseZIndex = Number(i.zIndex ?? 0);
          const baseScale = i.scale ?? { x: 1, y: 1 };

          i.metadata = {
            ...i.metadata,
            [NS]: {
              flying: true,
              zFeet: DEFAULT_Z_FEET,
              baseZIndex,
              baseScale,
              baseText: cloneJson(i.text),
              baseTextItemType: i.textItemType ?? "LABEL",
            },
          };
          i.zIndex = getFlyingZIndex(baseZIndex, DEFAULT_Z_FEET);
          i.scale = getFlyingScale(baseScale, DEFAULT_Z_FEET);
          i.disableAutoZIndex = true;
          i.text = buildFlyingTextContent(i.text, DEFAULT_Z_FEET);
          i.textItemType = "LABEL";
        }
      });
    }

    // DISABLE FLYING
    else {
      await OBR.scene.items.updateItems([item.id], (items) => {
        for (const i of items) {
          if (!i || !i.metadata) continue;

          const baseZIndex = Number(data.baseZIndex ?? i.zIndex ?? 0);
          const baseScale = data.baseScale ?? { x: 1, y: 1 };
          i.zIndex = baseZIndex;
          i.scale = baseScale;
          i.disableAutoZIndex = false;
          i.text = cloneJson(data.baseText) ?? i.text;
          i.textItemType = data.baseTextItemType ?? i.textItemType ?? "LABEL";
          delete i.metadata[NS];
        }
      });
    }
  }

}

export async function toggleFlying() {
  const selection = await OBR.player.getSelection();
  if (!selection || selection.length === 0) return;

  const items = await OBR.scene.items.getItems(selection);
  await toggleFlyingForItems(items);
}

export async function setFlyingHeight(itemId, zFeet) {
  const nextZFeet = clampZFeet(zFeet);

  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const item of items) {
      if (!item || !isFlying(item)) continue;

      const baseZIndex = getBaseZIndex(item);
      const baseScale = getBaseScale(item);

      item.metadata = {
        ...item.metadata,
        [NS]: {
          ...getFlyingData(item),
          flying: true,
          zFeet: nextZFeet,
          baseZIndex,
          baseScale,
        },
      };
      item.zIndex = getFlyingZIndex(baseZIndex, nextZFeet);
      item.scale = getFlyingScale(baseScale, nextZFeet);
      item.disableAutoZIndex = true;
      item.text = buildFlyingTextContent(item.text, nextZFeet);
      item.textItemType = "LABEL";
    }
  });
}

export async function setItemZIndex(itemId, zIndex) {
  const nextZIndex = Number(zIndex);

  if (!Number.isFinite(nextZIndex)) {
    return;
  }

  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const item of items) {
      if (!item) continue;

      if (isFlying(item)) {
        const zFeet = getItemZFeet(item);

        item.metadata = {
          ...item.metadata,
          [NS]: {
            ...getFlyingData(item),
            baseZIndex: nextZIndex,
          },
        };
        item.zIndex = getFlyingZIndex(nextZIndex, zFeet);
        item.scale = getFlyingScale(getBaseScale(item), zFeet);
        item.disableAutoZIndex = true;
        continue;
      }

      item.zIndex = nextZIndex;
      item.disableAutoZIndex = true;
    }
  });
}
