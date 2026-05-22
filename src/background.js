import OBR from "@owlbear-rodeo/sdk";
import { clearLocalDeadLabels, syncLocalDeadLabels } from "./deadLabel.js";
import { deleteDeadVisualsForSourceIds } from "./deadVisuals.js";
import { clearLocalFlyingLabels, syncLocalFlyingLabels } from "./flyingLabel.js";
import { clearLocalShadows, syncLocalShadows } from "./shadow.js";

const state = {
  items: [],
  sceneReady: false,
};

let syncInFlight = false;
let syncQueued = false;

async function syncRuntimeVisuals(items = state.items) {
  await syncLocalDeadLabels(items);
  await syncLocalFlyingLabels(items);
  await syncLocalShadows(items);
}

function scheduleRuntimeSync(items = state.items) {
  state.items = items;

  if (!state.sceneReady) {
    return;
  }

  if (syncInFlight) {
    syncQueued = true;
    return;
  }

  syncInFlight = true;
  Promise.resolve()
    .then(async () => {
      await syncRuntimeVisuals(state.items);
    })
    .finally(() => {
      syncInFlight = false;
      if (!syncQueued) {
        return;
      }

      syncQueued = false;
      scheduleRuntimeSync(state.items);
    });
}

async function refreshItems() {
  if (!state.sceneReady) {
    state.items = [];
    return;
  }

  try {
    state.items = await OBR.scene.items.getItems();
  } catch (error) {
    if (error?.error?.name === "MissingDataError") {
      state.sceneReady = false;
      state.items = [];
      return;
    }

    throw error;
  }

  await syncRuntimeVisuals(state.items);
}

OBR.onReady(() => {
  OBR.scene.items.onChange((items) => {
    if (!state.sceneReady) return;

    const nextItemIds = new Set(items.map((item) => item.id));
    const removedSourceIds = state.items
      .filter((item) => !nextItemIds.has(item.id))
      .map((item) => item.id);

    if (removedSourceIds.length > 0) {
      Promise.resolve().then(() => deleteDeadVisualsForSourceIds(removedSourceIds));
    }

    scheduleRuntimeSync(items);
  });

  OBR.scene.onReadyChange(async (ready) => {
    state.sceneReady = ready;

    if (!ready) {
      state.items = [];
      await clearLocalDeadLabels();
      await clearLocalFlyingLabels();
      await clearLocalShadows();
      return;
    }

    await refreshItems();
  });

  OBR.scene.isReady().then(async (ready) => {
    state.sceneReady = ready;

    if (!ready) {
      await clearLocalDeadLabels();
      await clearLocalFlyingLabels();
      await clearLocalShadows();
      return;
    }

    await refreshItems();
  });
});
