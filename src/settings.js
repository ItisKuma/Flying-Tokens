import OBR from "@owlbear-rodeo/sdk";
import { NS } from "./flying.js";
import {
  DEFAULT_FLOAT_ANIMATION_AMPLITUDE,
  setFloatAnimationAmplitude,
  setFloatAnimationEnabled,
} from "./floatAnimation.js";
import { setLightVector } from "./shadow.js";

export const SETTINGS_KEY = `${NS}/settings`;

const DEFAULT_SETTINGS = {
  lightVector: { x: -0.7, y: -0.7 },
  floatAnimationEnabled: false,
  floatAnimationAmplitude: DEFAULT_FLOAT_ANIMATION_AMPLITUDE,
  lightDragActive: false,
};

export function normalizeSettings(rawSettings) {
  return {
    lightVector: {
      x: Number(rawSettings?.lightVector?.x ?? DEFAULT_SETTINGS.lightVector.x),
      y: Number(rawSettings?.lightVector?.y ?? DEFAULT_SETTINGS.lightVector.y),
    },
    floatAnimationEnabled: Boolean(
      rawSettings?.floatAnimationEnabled ?? DEFAULT_SETTINGS.floatAnimationEnabled,
    ),
    floatAnimationAmplitude: Number(
      rawSettings?.floatAnimationAmplitude ?? DEFAULT_SETTINGS.floatAnimationAmplitude,
    ),
    lightDragActive: Boolean(
      rawSettings?.lightDragActive ?? DEFAULT_SETTINGS.lightDragActive,
    ),
  };
}

export function getSettingsFromMetadata(metadata) {
  return normalizeSettings(metadata?.[SETTINGS_KEY]);
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
  setLightVector(normalizedSettings.lightVector);
  setFloatAnimationEnabled(normalizedSettings.floatAnimationEnabled);
  setFloatAnimationAmplitude(normalizedSettings.floatAnimationAmplitude);
  return normalizedSettings;
}
