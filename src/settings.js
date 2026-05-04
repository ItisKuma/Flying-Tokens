import OBR from "@owlbear-rodeo/sdk";
import { LEGACY_NS, NS } from "./statusModel.js";
import {
  DEFAULT_FLOAT_ANIMATION_AMPLITUDE,
  setFloatAnimationAmplitude,
  setFloatAnimationEnabled,
} from "./floatAnimation.js";

export const SETTINGS_KEY = `${NS}/settings`;
const LEGACY_SETTINGS_KEY = `${LEGACY_NS}/settings`;

const DEFAULT_SETTINGS = {
  floatAnimationEnabled: false,
  floatAnimationAmplitude: DEFAULT_FLOAT_ANIMATION_AMPLITUDE,
};

export function normalizeSettings(rawSettings) {
  return {
    floatAnimationEnabled: Boolean(
      rawSettings?.floatAnimationEnabled ?? DEFAULT_SETTINGS.floatAnimationEnabled,
    ),
    floatAnimationAmplitude: Number(
      rawSettings?.floatAnimationAmplitude ?? DEFAULT_SETTINGS.floatAnimationAmplitude,
    ),
  };
}

export function getSettingsFromMetadata(metadata) {
  return normalizeSettings(metadata?.[SETTINGS_KEY] ?? metadata?.[LEGACY_SETTINGS_KEY]);
}

export async function getRoomSettings() {
  const metadata = await OBR.room.getMetadata();
  return getSettingsFromMetadata(metadata);
}

export async function updateRoomSettings(partialSettings) {
  const currentSettings = await getRoomSettings();
  const nextSettings = normalizeSettings({
    ...currentSettings,
    ...partialSettings,
  });

  await OBR.room.setMetadata({
    [SETTINGS_KEY]: nextSettings,
  });
}

export function subscribeToRoomSettings(callback) {
  return OBR.room.onMetadataChange((metadata) => {
    callback(getSettingsFromMetadata(metadata));
  });
}

export function applyRuntimeSettings(settings) {
  const normalizedSettings = normalizeSettings(settings);
  setFloatAnimationEnabled(normalizedSettings.floatAnimationEnabled);
  setFloatAnimationAmplitude(normalizedSettings.floatAnimationAmplitude);
  return normalizedSettings;
}
