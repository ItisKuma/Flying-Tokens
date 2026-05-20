export const BLOOD_SPLATS = [
  { file: "blood_splat_01.png", width: 147, height: 202 },
  { file: "blood_splat_04.png", width: 158, height: 186 },
  { file: "blood_splat_05.png", width: 212, height: 160 },
  { file: "blood_splat_08.png", width: 206, height: 168 },
  { file: "blood_splat_09.png", width: 112, height: 138 },
  { file: "blood_splat_13.png", width: 132, height: 157 },
  { file: "blood_splat_17.png", width: 147, height: 154 },
];

export const BLOOD_SPLAT_IDS = BLOOD_SPLATS.map((splat) => splat.file);

export function getBloodSplatSpec(file) {
  return BLOOD_SPLATS.find((splat) => splat.file === file) ?? BLOOD_SPLATS[0];
}

export function pickRandomBloodSplat() {
  return BLOOD_SPLAT_IDS[Math.floor(Math.random() * BLOOD_SPLAT_IDS.length)];
}
