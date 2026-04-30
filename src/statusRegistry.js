import { DEAD_STATUS_ID, FLYING_STATUS_ID } from "./statusModel.js";

export const STATUS_DEFINITIONS = {
  [FLYING_STATUS_ID]: {
    id: FLYING_STATUS_ID,
    label: "Flying",
    kind: "advanced",
  },
  [DEAD_STATUS_ID]: {
    id: DEAD_STATUS_ID,
    label: "Dead",
    kind: "simple",
  },
};

export function getStatusDefinition(statusId) {
  return STATUS_DEFINITIONS[statusId] ?? null;
}

export function getRegisteredStatusDefinitions() {
  return Object.values(STATUS_DEFINITIONS);
}
