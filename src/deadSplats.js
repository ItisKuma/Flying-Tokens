export const BLOOD_SPLATS = [
  { file: "blood_splat_01.png", width: 272, height: 258, offsetSquaresX: 0, offsetSquaresY: 0 },
  { file: "blood_splat_02.png", width: 311, height: 296, offsetSquaresX: 0, offsetSquaresY: 0 },
  { file: "blood_splat_03.png", width: 304, height: 279, offsetSquaresX: 0, offsetSquaresY: 0 },
  { file: "blood_splat_04.png", width: 272, height: 279, offsetSquaresX: 0, offsetSquaresY: 0 },
  { file: "blood_splat_05.png", width: 302, height: 250, offsetSquaresX: 0, offsetSquaresY: 0 },
  { file: "blood_splat_06.png", width: 295, height: 258, offsetSquaresX: 0.5, offsetSquaresY: -0.5 },
  { file: "blood_splat_07.png", width: 313, height: 287, offsetSquaresX: 0, offsetSquaresY: 0 },
  { file: "blood_splat_08.png", width: 297, height: 256, offsetSquaresX: 0, offsetSquaresY: 0 },
  { file: "blood_splat_09.png", width: 289, height: 252, offsetSquaresX: 0, offsetSquaresY: -0.5 },
  { file: "blood_splat_10.png", width: 313, height: 282, offsetSquaresX: 0.85, offsetSquaresY: -0.55 },
  { file: "blood_splat_11.png", width: 310, height: 268, offsetSquaresX: 1, offsetSquaresY: -0.2 },
  { file: "blood_splat_12.png", width: 290, height: 238, offsetSquaresX: 0.05, offsetSquaresY: 0.1 },
  { file: "blood_splat_13.png", width: 294, height: 274, offsetSquaresX: 0.15, offsetSquaresY: -0.55 },
  { file: "blood_splat_14.png", width: 288, height: 282, offsetSquaresX: 0.3, offsetSquaresY: -0.1 },
  { file: "blood_splat_15.png", width: 313, height: 275, offsetSquaresX: 0, offsetSquaresY: 0 },
  { file: "blood_splat_16.png", width: 289, height: 276, offsetSquaresX: 0, offsetSquaresY: 0 },
];

export const BLOOD_SPLAT_IDS = BLOOD_SPLATS.map((splat) => splat.file);

export function getBloodSplatSpec(file) {
  return BLOOD_SPLATS.find((splat) => splat.file === file) ?? BLOOD_SPLATS[0];
}

export function pickRandomBloodSplat() {
  return BLOOD_SPLAT_IDS[Math.floor(Math.random() * BLOOD_SPLAT_IDS.length)];
}
