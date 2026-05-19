export const BLOOD_SPLAT_IDS = [
  "blood_splat_01.png",
  "blood_splat_04.png",
  "blood_splat_05.png",
  "blood_splat_08.png",
  "blood_splat_09.png",
  "blood_splat_13.png",
  "blood_splat_17.png",
];

export function pickRandomBloodSplat() {
  return BLOOD_SPLAT_IDS[Math.floor(Math.random() * BLOOD_SPLAT_IDS.length)];
}
