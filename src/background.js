import OBR from "@owlbear-rodeo/sdk";
import { clearLocalDeadLabels, createLocalDeadLabelsForItems, deleteLocalDeadLabelsForSourceIds } from "./deadLabel.js";
import { isDead } from "./dead.js";
import { deleteDeadVisualsForSourceIds } from "./deadVisuals.js";
import { clearLocalFlyingLabels, syncLocalFlyingLabels } from "./flyingLabel.js";
import { clearLocalShadows, syncLocalShadows } from "./shadow.js";

const TOKEN_STATUS_POPOVER_ID = "token-status-paperless";
const TOKEN_STATUS_POPOVER_WIDTH = 400;
const TOKEN_STATUS_POPOVER_HEIGHT = 600;
const TOKEN_STATUS_ANCHOR_LEFT = 8;
const TOKEN_STATUS_ANCHOR_TOP = 72;

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

function getTokenStatusUrl() {
  return new URL("/index.html", globalThis.location.href).toString();
}

async function openTokenStatusPopover() {
  await OBR.popover.open({
    id: TOKEN_STATUS_POPOVER_ID,
    url: getTokenStatusUrl(),
    width: TOKEN_STATUS_POPOVER_WIDTH,
    height: TOKEN_STATUS_POPOVER_HEIGHT,
    anchorReference: "POSITION",
    anchorPosition: {
      left: TOKEN_STATUS_ANCHOR_LEFT,
      top: TOKEN_STATUS_ANCHOR_TOP,
    },
    anchorOrigin: {
      horizontal: "LEFT",
      vertical: "TOP",
    },
    transformOrigin: {
      horizontal: "LEFT",
      vertical: "TOP",
    },
    hidePaper: true,
    marginThreshold: 8,
  });
}

OBR.onReady(() => {
  OBR.action.onOpenChange((isOpen) => {
    if (!isOpen) {
      return;
    }

    Promise.resolve()
      .then(openTokenStatusPopover)
      .finally(() => {
        OBR.action.close().catch(() => {});
      });
  });

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
