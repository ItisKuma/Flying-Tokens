import OBR from "@owlbear-rodeo/sdk";

let cachedRolePromise = null;

export async function canManageSharedVisuals() {
  cachedRolePromise ??= OBR.player.getRole();
  return (await cachedRolePromise) === "GM";
}

export function clearSharedVisualRoleCache() {
  cachedRolePromise = null;
}

export function approxEqual(a, b, epsilon = 0.01) {
  return Math.abs(Number(a ?? 0) - Number(b ?? 0)) <= epsilon;
}

export function sameStringArray(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}
