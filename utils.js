// Normalize value between min and max (returns 0 -> 1)
export function normalize(z, min, max) {
  return (z - min) / (max - min);
}
