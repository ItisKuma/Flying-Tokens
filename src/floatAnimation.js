import { getItemZFeet, isFlying } from "./flying.js";

export const MIN_FLOAT_ANIMATION_AMPLITUDE = 1;
export const MAX_FLOAT_ANIMATION_AMPLITUDE = 10;
export const DEFAULT_FLOAT_ANIMATION_AMPLITUDE = 5;

const FLOAT_ANIMATION_CYCLE_MS = 3200;

let floatAnimationEnabled = false;
let floatAnimationAmplitude = DEFAULT_FLOAT_ANIMATION_AMPLITUDE;
let floatAnimationPaused = false;

function getTokenPhaseOffset(item) {
  const id = String(item?.id ?? "");
  let hash = 0;

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }

  return (hash / 0xffffffff) * Math.PI * 2;
}

export function isFloatAnimationEnabled() {
  return floatAnimationEnabled;
}

export function setFloatAnimationEnabled(enabled) {
  floatAnimationEnabled = Boolean(enabled);
}

export function setFloatAnimationPaused(paused) {
  floatAnimationPaused = Boolean(paused);
}

export function getFloatAnimationAmplitude() {
  return floatAnimationAmplitude;
}

export function setFloatAnimationAmplitude(amplitude) {
  const numericAmplitude = Number(amplitude);

  if (!Number.isFinite(numericAmplitude)) {
    floatAnimationAmplitude = DEFAULT_FLOAT_ANIMATION_AMPLITUDE;
    return;
  }

  floatAnimationAmplitude = Math.min(
    MAX_FLOAT_ANIMATION_AMPLITUDE,
    Math.max(MIN_FLOAT_ANIMATION_AMPLITUDE, numericAmplitude),
  );
}

export function getFloatAnimationOffsetFeet(item, now = performance.now()) {
  if (!floatAnimationEnabled || floatAnimationPaused) {
    return 0;
  }

  const phase =
    ((now % FLOAT_ANIMATION_CYCLE_MS) / FLOAT_ANIMATION_CYCLE_MS) * Math.PI * 2 +
    getTokenPhaseOffset(item);

  return Math.sin(phase) * floatAnimationAmplitude;
}

export function getVisualZFeet(item, now = performance.now()) {
  if (!isFlying(item)) {
    return 0;
  }

  return Math.max(0, getItemZFeet(item) + getFloatAnimationOffsetFeet(item, now));
}
