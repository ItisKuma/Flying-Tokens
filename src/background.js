import OBR from "@owlbear-rodeo/sdk";
import {
  getBaseScale,
  getFlyingItems,
  getItemZFeet,
  getVisualFlyingScale,
} from "./flying.js";
import { getVisualZFeet, isFloatAnimationEnabled } from "./floatAnimation.js";
import { setupContextMenu } from "./contextMenu.js";
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
let animationSyncInFlight = false;

async function syncAnimatedTokenScales() {
  if (!state.sceneReady || animationSyncInFlight) {
    return;
  }

  const flyingItems = getFlyingItems(state.items);
  if (flyingItems.length === 0) {
    return;
  }

  const scaleById = new Map(
    flyingItems.map((item) => {
      const zFeet = isFloatAnimationEnabled() ? getVisualZFeet(item) : getItemZFeet(item);
      return [item.id, getVisualFlyingScale(getBaseScale(item), zFeet)];
    }),
  );

  animationSyncInFlight = true;

  try {
    await OBR.scene.items.updateItems([...scaleById.keys()], (items) => {
      for (const item of items) {
        if (!item) continue;

        const nextScale = scaleById.get(item.id);
        if (!nextScale) continue;

        const currentScaleX = Number(item.scale?.x ?? 1);
        const currentScaleY = Number(item.scale?.y ?? 1);
        const deltaX = Math.abs(currentScaleX - nextScale.x);
        const deltaY = Math.abs(currentScaleY - nextScale.y);

        if (deltaX < 0.001 && deltaY < 0.001) {
          continue;
        }

        item.scale = nextScale;
      }
    });
  } catch (error) {
    if (error?.error?.name !== "RateLimitHit") {
      console.error("Simple Flying background animation error", error);
    }
  } finally {
    animationSyncInFlight = false;
  }
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

  if (state.lightDragActive) {
    return;
  }

  await syncLocalShadows(state.items);
}

async function runAnimationTick() {
  if (!state.sceneReady || !isFloatAnimationEnabled()) {
    return;
  }

  await syncAnimatedTokenScales();

  if (state.lightDragActive) {
    return;
  }

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

    syncLocalShadows(state.items);
  });

  setupContextMenu();

  OBR.scene.items.onChange((items) => {
    if (!state.sceneReady) return;
    state.items = items;
    if (state.lightDragActive) return;
    syncLocalShadows(state.items);
  });

  OBR.scene.onReadyChange(async (ready) => {
    state.sceneReady = ready;

    if (!ready) {
      state.items = [];
      stopAnimationLoop();
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
