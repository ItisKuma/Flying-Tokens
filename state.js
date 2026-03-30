import OBR from "https://unpkg.com/@owlbear-rodeo/sdk?module";

// Stores currently selected token id
export let selectedId = null;

// Listen for selection changes in Owlbear
export function initSelection() {
  OBR.player.onSelectionChange((items) => {
    selectedId = items[0]?.id || null;
  });
}
