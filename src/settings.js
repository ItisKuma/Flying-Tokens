import OBR from "@owlbear-rodeo/sdk";
import { NS } from "./statusModel.js";

export const SETTINGS_NS = `${NS}/settings`;
export const DEFAULT_BLOODYNESS = 0;

export function normalizeBloodyness(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_BLOODYNESS;
  }

  if (numericValue <= 0) {
    return 0;
  }

  return Math.max(1, Math.min(2, numericValue));
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
