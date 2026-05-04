import OBR from "@owlbear-rodeo/sdk";
import {
  clearLocalDeadVisuals,
  hasAnimatingDeadVisuals,
  syncLocalDeadVisuals,
} from "./deadVisuals.js";
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
  await syncLocalFloatEffects(state.items);
  await syncLocalShadows(state.items);
}

async function runAnimationTick() {
  if (!state.sceneReady) {
    return;
  }

  const shouldAnimateDead = hasAnimatingDeadVisuals(state.items);
  const shouldAnimateFloat = isFloatAnimationEnabled();

  if (!shouldAnimateDead && !shouldAnimateFloat) {
    return;
  }

  if (shouldAnimateDead) {
    await syncLocalDeadVisuals(state.items);
  }

  if (shouldAnimateFloat) {
    await syncLocalFloatEffects(state.items);
    await syncLocalShadows(state.items);
  }
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
    applyRuntimeSettings(settings);

    if (!state.sceneReady) {
      return;
    }

    Promise.resolve()
      .then(async () => {
        await syncLocalDeadVisuals(state.items);
        await syncLocalFloatEffects(state.items);
        await syncLocalShadows(state.items);
      });
  });

  setupContextMenu();

  OBR.scene.items.onChange((items) => {
    if (!state.sceneReady) return;
    state.items = items;
    Promise.resolve()
      .then(async () => {
        await syncLocalDeadVisuals(state.items);
        await syncLocalFloatEffects(state.items);
        await syncLocalShadows(state.items);
      });
  });

  OBR.scene.onReadyChange(async (ready) => {
    state.sceneReady = ready;

    if (!ready) {
      state.items = [];
      stopAnimationLoop();
      clearLocalFloatEffects();
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
      clearLocalFloatEffects();
      return;
    }

    const settings = await getRoomSettings();
    applyRuntimeSettings(settings);
    await clearLocalFloatEffects();
    await refreshItems();
    startAnimationLoop();
  });
});
