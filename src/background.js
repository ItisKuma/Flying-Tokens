import OBR from "@owlbear-rodeo/sdk";
import {
  hasAnimatingDeadVisuals,
  syncLocalDeadVisuals,
} from "./deadVisuals.js";
import { setupContextMenu } from "./contextMenu.js";
import { clearLocalShadows, syncLocalShadows } from "./shadow.js";

const DEAD_ANIMATION_TICK_MS = 120;

const state = {
  items: [],
  sceneReady: false,
};

let animationIntervalId = 0;

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

  await syncLocalDeadVisuals(state.items);
  await syncLocalShadows(state.items);
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
  setupContextMenu();

  OBR.scene.items.onChange((items) => {
    if (!state.sceneReady) return;
    state.items = items;
    Promise.resolve().then(async () => {
      await syncLocalDeadVisuals(state.items);
      await syncLocalShadows(state.items);
    });
  });

  OBR.scene.onReadyChange(async (ready) => {
    state.sceneReady = ready;

    if (!ready) {
      state.items = [];
      stopAnimationLoop();
      await clearLocalShadows();
      return;
    }

    await refreshItems();
    startAnimationLoop();
  });

  OBR.scene.isReady().then(async (ready) => {
    state.sceneReady = ready;

    if (!ready) {
      await clearLocalShadows();
      return;
    }

    await refreshItems();
    startAnimationLoop();
  });
});
