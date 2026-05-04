import OBR from "@owlbear-rodeo/sdk";
import { NS } from "./statusModel.js";
import {
  applyShadowSettings,
  getShadowSettings,
  normalizeShadowSettings,
} from "./shadow.js";

export const SHADOW_SETTINGS_KEY = `${NS}/shadow-settings`;

export async function getRoomShadowSettings() {
  const metadata = await OBR.room.getMetadata();
  return normalizeShadowSettings(metadata?.[SHADOW_SETTINGS_KEY]);
}

export async function updateRoomShadowSettings(partialSettings) {
  const currentSettings = await getRoomShadowSettings();
  const nextSettings = normalizeShadowSettings({
    ...currentSettings,
    ...partialSettings,
  });

  await OBR.room.setMetadata({
    [SHADOW_SETTINGS_KEY]: nextSettings,
  });
}

export function subscribeToRoomShadowSettings(callback) {
  return OBR.room.onMetadataChange((metadata) => {
    callback(normalizeShadowSettings(metadata?.[SHADOW_SETTINGS_KEY]));
  });
}

export function applyRuntimeShadowSettings(settings) {
  const normalizedSettings = normalizeShadowSettings(settings ?? getShadowSettings());
  applyShadowSettings(normalizedSettings);
  return normalizedSettings;
}
