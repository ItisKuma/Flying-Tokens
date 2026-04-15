import OBR, { buildEffect } from "@owlbear-rodeo/sdk";
import { getFlyingItems, NS } from "./flying.js";
import { getFloatAnimationAmplitude, isFloatAnimationEnabled, getTokenPhaseOffset } from "./floatAnimation.js";

export const LOCAL_FLOAT_EFFECT_NS = `${NS}-local-float`;
const FLOAT_EFFECT_ID_PREFIX = `${NS}/float-effect/`;

const FLOAT_EFFECT_SKSL = `
uniform vec2 size;
uniform float time;
uniform float amplitude;
uniform float phase;

half4 main(float2 coord) {
  vec2 center = size * 0.5;
  vec2 safeCenter = max(center, vec2(1.0));
  float pulse = sin(time * 2.4 + phase) * amplitude;
  float radius = 0.74 + pulse;
  vec2 p = (coord - center) / safeCenter;
  float dist = length(p);

  float outerGlow = 1.0 - smoothstep(radius, radius + 0.14, dist);
  float innerCut = 1.0 - smoothstep(max(0.0, radius - 0.12), radius - 0.02, dist);
  float ring = clamp(outerGlow - innerCut, 0.0, 1.0);

  return half4(1.0, 0.92, 0.62, ring * 0.16);
}
`;

function getFloatEffectId(itemId) {
  return `${FLOAT_EFFECT_ID_PREFIX}${itemId}`;
}

function getPulseAmplitude() {
  const amplitudeFeet = getFloatAnimationAmplitude();
  return 0.01 + amplitudeFeet * 0.006;
}

function buildLocalFloatEffect(item) {
  return buildEffect()
    .id(getFloatEffectId(item.id))
    .name("Float Pulse")
    .effectType("ATTACHMENT")
    .attachedTo(item.id)
    .layer("POST_PROCESS")
    .locked(true)
    .disableHit(true)
    .sksl(FLOAT_EFFECT_SKSL)
    .uniforms([
      { name: "amplitude", value: getPulseAmplitude() },
      { name: "phase", value: getTokenPhaseOffset(item) },
    ])
    .metadata({
      [LOCAL_FLOAT_EFFECT_NS]: {
        effectFor: item.id,
      },
    })
    .build();
}

export async function clearLocalFloatEffects() {
  const localItems = await OBR.scene.local.getItems(
    (item) => item?.metadata?.[LOCAL_FLOAT_EFFECT_NS]?.effectFor,
  );

  if (localItems.length === 0) return;
  await OBR.scene.local.deleteItems(localItems.map((item) => item.id));
}

export async function syncLocalFloatEffects(items) {
  const localItems = await OBR.scene.local.getItems(
    (item) => item?.metadata?.[LOCAL_FLOAT_EFFECT_NS]?.effectFor,
  );

  if (!isFloatAnimationEnabled()) {
    if (localItems.length > 0) {
      await OBR.scene.local.deleteItems(localItems.map((item) => item.id));
    }
    return;
  }

  const flyingItems = getFlyingItems(items);
  const flyingById = new Map(flyingItems.map((item) => [item.id, item]));
  const desiredEffectIds = new Set(flyingItems.map((item) => getFloatEffectId(item.id)));

  const itemIdsToDelete = localItems
    .filter((localItem) => {
      const ownerId = localItem.metadata?.[LOCAL_FLOAT_EFFECT_NS]?.effectFor;
      if (!ownerId) return false;
      if (!flyingById.has(ownerId)) return true;
      return !desiredEffectIds.has(localItem.id);
    })
    .map((localItem) => localItem.id);

  if (itemIdsToDelete.length > 0) {
    await OBR.scene.local.deleteItems(itemIdsToDelete);
  }

  const localItemsById = new Map(localItems.map((localItem) => [localItem.id, localItem]));
  const itemsToAdd = [];

  for (const item of flyingItems) {
    const effect = buildLocalFloatEffect(item);
    const existingEffect = localItemsById.get(effect.id);

    if (!existingEffect || existingEffect.type !== effect.type) {
      if (existingEffect?.id) {
        await OBR.scene.local.deleteItems([existingEffect.id]);
      }
      itemsToAdd.push(effect);
      continue;
    }

    await OBR.scene.local.updateItems([effect.id], (items) => {
      for (const localItem of items) {
        localItem.layer = effect.layer;
        localItem.locked = effect.locked;
        localItem.visible = effect.visible;
        localItem.disableHit = effect.disableHit;
        localItem.metadata = effect.metadata;
        localItem.sksl = effect.sksl;
        localItem.uniforms = effect.uniforms;
        localItem.effectType = effect.effectType;
        localItem.blendMode = effect.blendMode;
        localItem.attachedTo = effect.attachedTo;
      }
    });
  }

  if (itemsToAdd.length > 0) {
    await OBR.scene.local.addItems(itemsToAdd);
  }
}
