export const BLOOD_SPLATS = [
  { file: "blood_splat_02.png", width: 295, height: 305, offsetSquaresX: 0, offsetSquaresY: 0 },
  { file: "blood_splat_03.png", width: 308, height: 296, offsetSquaresX: 0.6, offsetSquaresY: -0.6 },
  { file: "blood_splat_04.png", width: 326, height: 289, offsetSquaresX: 0, offsetSquaresY: 0 },
  { file: "blood_splat_05.png", width: 321, height: 280, offsetSquaresX: 0, offsetSquaresY: 0 },
  { file: "blood_splat_06.png", width: 306, height: 303, offsetSquaresX: 0.5, offsetSquaresY: -0.5 },
  { file: "blood_splat_07.png", width: 294, height: 294, offsetSquaresX: 0, offsetSquaresY: 0 },
  { file: "blood_splat_08.png", width: 328, height: 335, offsetSquaresX: 0.7, offsetSquaresY: -0.5 },
  { file: "blood_splat_09.png", width: 294, height: 362, offsetSquaresX: 0, offsetSquaresY: -0.5 },
  { file: "blood_splat_10.png", width: 318, height: 356, offsetSquaresX: 0.85, offsetSquaresY: -0.55 },
  { file: "blood_splat_11.png", width: 315, height: 230, offsetSquaresX: 0.5, offsetSquaresY: -0.2 },
  { file: "blood_splat_13.png", width: 324, height: 280, offsetSquaresX: 0.15, offsetSquaresY: -0.55 },
  { file: "blood_splat_14.png", width: 294, height: 279, offsetSquaresX: 0.3, offsetSquaresY: -0.1 },
];

export const BLOOD_SPLAT_IDS = BLOOD_SPLATS.map((splat) => splat.file);

export function getBloodSplatSpec(file) {
  return BLOOD_SPLATS.find((splat) => splat.file === file) ?? BLOOD_SPLATS[0];
}

export function resolveBloodSplatFile(file) {
  return getBloodSplatSpec(file)?.file ?? BLOOD_SPLAT_IDS[0];
}

export function pickRandomBloodSplat() {
  return BLOOD_SPLAT_IDS[Math.floor(Math.random() * BLOOD_SPLAT_IDS.length)];
}
