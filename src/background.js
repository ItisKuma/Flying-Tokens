import OBR from "@owlbear-rodeo/sdk";
import { isFloatAnimationEnabled } from "./floatAnimation.js";
import { setupContextMenu } from "./contextMenu.js";
import { clearLocalFloatEffects, syncLocalFloatEffects } from "./floatEffect.js";
import { clearLocalShadows, syncLocalShadows } from "./shadow.js";
import {
  applyRuntimeSettings,
  getRoomSettings,
  subscribeToRoomSettings,
} from "./settings.js";

const FLOAT_ANIMATION_TICK_MS = 120;

const state = {
  items: [],
  sceneReady: false,
  lightDragActive: false,
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

  if (state.lightDragActive) {
    return;
  }

  await syncLocalFloatEffects(state.items);
  await syncLocalShadows(state.items);
}

async function runAnimationTick() {
  if (!state.sceneReady || !isFloatAnimationEnabled()) {
    return;
  }

  if (state.lightDragActive) {
    return;
  }

  await syncLocalFloatEffects(state.items);
  await syncLocalShadows(state.items);
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
    runAnimationTick();
  }, FLOAT_ANIMATION_TICK_MS);
}

OBR.onReady(() => {
  subscribeToRoomSettings((settings) => {
    state.lightDragActive = Boolean(settings?.lightDragActive);
    applyRuntimeSettings(settings);

    if (!state.sceneReady) {
      return;
    }

    if (state.lightDragActive) {
      return;
    }

    syncLocalFloatEffects(state.items);
    syncLocalShadows(state.items);
  });

  setupContextMenu();

  OBR.scene.items.onChange((items) => {
    if (!state.sceneReady) return;
    state.items = items;
    if (state.lightDragActive) return;
    syncLocalFloatEffects(state.items);
    syncLocalShadows(state.items);
  });

  OBR.scene.onReadyChange(async (ready) => {
    state.sceneReady = ready;

    if (!ready) {
      state.items = [];
      stopAnimationLoop();
      clearLocalFloatEffects();
      clearLocalShadows();
      return;
    }

    const settings = await getRoomSettings();
    applyRuntimeSettings(settings);
    await refreshItems();
    startAnimationLoop();
  });

  OBR.scene.isReady().then(async (ready) => {
    state.sceneReady = ready;

    if (!ready) {
      return;
    }

    const settings = await getRoomSettings();
    applyRuntimeSettings(settings);
    await refreshItems();
    startAnimationLoop();
  });
});
