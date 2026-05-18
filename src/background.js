import OBR from "@owlbear-rodeo/sdk";
import {
  hasAnimatingDeadVisuals,
  syncLocalDeadVisuals,
} from "./deadVisuals.js";
import { clearLocalFlyingLabels, syncLocalFlyingLabels } from "./flyingLabel.js";
import { clearLocalShadows, syncLocalShadows } from "./shadow.js";

const DEAD_ANIMATION_TICK_MS = 120;

const state = {
  items: [],
  sceneReady: false,
};

let animationIntervalId = 0;
let syncInFlight = false;
let syncQueued = false;

async function syncRuntimeVisuals(items = state.items) {
  await syncLocalDeadVisuals(items);
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

async function runDeadAnimationTick() {
  if (!state.sceneReady) {
    return;
  }

  if (!hasAnimatingDeadVisuals(state.items)) {
    return;
  }

  await syncLocalDeadVisuals(state.items);
}

function stopAnimationLoop() {
  if (!animationIntervalId) {
    return;
  }

  window.clearInterval(animationIntervalId);
  animationIntervalId = 0;
}

function startAnimationLoop() {
  stopAnimationLoop();
  animationIntervalId = window.setInterval(() => {
    runDeadAnimationTick();
  }, DEAD_ANIMATION_TICK_MS);
}

OBR.onReady(() => {
  OBR.scene.items.onChange((items) => {
    if (!state.sceneReady) return;
    scheduleRuntimeSync(items);
  });

  OBR.scene.onReadyChange(async (ready) => {
    state.sceneReady = ready;

    if (!ready) {
      state.items = [];
      stopAnimationLoop();
      await clearLocalFlyingLabels();
      await clearLocalShadows();
      return;
    }

    await refreshItems();
    startAnimationLoop();
  });

  OBR.scene.isReady().then(async (ready) => {
    state.sceneReady = ready;

    if (!ready) {
      await clearLocalFlyingLabels();
      await clearLocalShadows();
      return;
    }

    await refreshItems();
    startAnimationLoop();
  });
});
