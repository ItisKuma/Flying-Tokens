export const BLOOD_SPLATS = [
  { file: "blood_splat_01.png", width: 147, height: 202 },
  { file: "blood_splat_02.png", width: 201, height: 204 },
  { file: "blood_splat_03.png", width: 138, height: 123 },
  { file: "blood_splat_04.png", width: 158, height: 186 },
  { file: "blood_splat_05.png", width: 212, height: 160 },
  { file: "blood_splat_06.png", width: 198, height: 211 },
  { file: "blood_splat_07.png", width: 188, height: 171 },
  { file: "blood_splat_08.png", width: 206, height: 168 },
  { file: "blood_splat_09.png", width: 112, height: 138 },
  { file: "blood_splat_10.png", width: 148, height: 165 },
  { file: "blood_splat_11.png", width: 177, height: 184 },
  { file: "blood_splat_12.png", width: 211, height: 144 },
  { file: "blood_splat_13.png", width: 132, height: 157 },
  { file: "blood_splat_14.png", width: 118, height: 126 },
  { file: "blood_splat_15.png", width: 126, height: 157 },
  { file: "blood_splat_16.png", width: 141, height: 166 },
  { file: "blood_splat_17.png", width: 147, height: 154 },
];

export const BLOOD_SPLAT_IDS = BLOOD_SPLATS.map((splat) => splat.file);

export function getBloodSplatSpec(file) {
  return BLOOD_SPLATS.find((splat) => splat.file === file) ?? BLOOD_SPLATS[0];
}

export function pickRandomBloodSplat() {
  return BLOOD_SPLAT_IDS[Math.floor(Math.random() * BLOOD_SPLAT_IDS.length)];
}
