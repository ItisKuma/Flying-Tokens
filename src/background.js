import OBR from "@owlbear-rodeo/sdk";
import { setupContextMenu } from "./contextMenu.js";
import { clearLocalDeadLabels, createLocalDeadLabelsForItems, deleteLocalDeadLabelsForSourceIds } from "./deadLabel.js";
import { isDead } from "./dead.js";
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

  await createLocalDeadLabelsForItems(state.items);
  await syncRuntimeVisuals(state.items);
}

OBR.onReady(() => {
  setupContextMenu();

  OBR.scene.items.onChange((items) => {
    if (!state.sceneReady) return;

    const nextItemIds = new Set(items.map((item) => item.id));
    const removedSourceIds = state.items
      .filter((item) => !nextItemIds.has(item.id))
      .map((item) => item.id);
    const previousItemsById = new Map(state.items.map((item) => [item.id, item]));
    const becameDeadItems = [];
    const revivedSourceIds = [];

    for (const item of items) {
      const previousItem = previousItemsById.get(item.id);
      const wasDead = previousItem ? isDead(previousItem) : false;
      const nowDead = isDead(item);

      if (!wasDead && nowDead) {
        becameDeadItems.push(item);
        continue;
      }

      if (wasDead && !nowDead) {
        revivedSourceIds.push(item.id);
      }
    }

    if (removedSourceIds.length > 0) {
      Promise.resolve().then(async () => {
        await deleteDeadVisualsForSourceIds(removedSourceIds);
        await deleteLocalDeadLabelsForSourceIds(removedSourceIds);
      });
    }

    if (becameDeadItems.length > 0) {
      Promise.resolve().then(() => createLocalDeadLabelsForItems(becameDeadItems));
    }

    if (revivedSourceIds.length > 0) {
      Promise.resolve().then(() => deleteLocalDeadLabelsForSourceIds(revivedSourceIds));
    }

    scheduleRuntimeSync(items);
  });

  OBR.scene.onReadyChange(async (ready) => {
    state.sceneReady = ready;

    if (!ready) {
      state.items = [];
      return;
    }

    await refreshItems();
  });

  OBR.scene.isReady().then(async (ready) => {
    state.sceneReady = ready;

    if (!ready) {
      return;
    }

    await refreshItems();
  });
});
