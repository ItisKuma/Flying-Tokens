export const DEAD_Z_INDEX_DELTA = 1000000000000000;

export function getDeadZIndex(baseZIndex) {
  return Number(baseZIndex ?? 0) - DEAD_Z_INDEX_DELTA;
}
