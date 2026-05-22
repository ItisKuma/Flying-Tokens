import OBR from "@owlbear-rodeo/sdk";
import { NS } from "./statusModel.js";

export const SETTINGS_NS = `${NS}/settings`;
export const MIN_BLOODYNESS = 0.5;
export const MAX_BLOODYNESS = 1.25;
export const DEFAULT_BLOODYNESS = 0.95;

export function normalizeBloodyness(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_BLOODYNESS;
  }

  return Math.max(MIN_BLOODYNESS, Math.min(MAX_BLOODYNESS, numericValue));
}

export function getSettingsFromMetadata(metadata) {
  return metadata?.[SETTINGS_NS] ?? {};
}

export function getBloodynessFromMetadata(metadata) {
  return normalizeBloodyness(getSettingsFromMetadata(metadata)?.bloodyness);
}

export async function getSceneBloodyness() {
  const metadata = await OBR.scene.getMetadata();
  return getBloodynessFromMetadata(metadata);
}

export async function setSceneBloodyness(value) {
  await OBR.scene.setMetadata({
    [SETTINGS_NS]: {
      bloodyness: normalizeBloodyness(value),
    },
  });
}
