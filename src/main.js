import OBR from "@owlbear-rodeo/sdk";
import {
  Z_STEP_FEET,
  getFlyingItems,
  getItemLabel,
  getItemZFeet,
  isFlying,
  setFlyingHeight,
} from "./flying.js";
import { getFloatAnimationAmplitude, isFloatAnimationEnabled } from "./floatAnimation.js";
import { ensureGifPrototype, hasActiveGifPrototype, restoreGifPrototype } from "./gifPrototype.js";
import { clearLocalShadows, getLightVector, syncLocalShadows } from "./shadow.js";
import {
  applyRuntimeSettings,
  getRoomSettings,
  subscribeToRoomSettings,
  updateRoomSettings,
} from "./settings.js";

const state = {
  items: [],
  sceneReady: false,
  isAdjustingLight: false,
  pendingLightVector: null,
  busyGifItemIds: new Set(),
};

function getEffectiveSettings(settings) {
  if (!state.isAdjustingLight || !state.pendingLightVector) {
    return settings;
  }

  return {
    ...settings,
    lightVector: state.pendingLightVector,
  };
}

function renderFlyingList() {
  const list = document.getElementById("flying-list");
  const emptyState = document.getElementById("flying-empty");

  if (!list || !emptyState) return;

  if (!state.sceneReady) {
    list.innerHTML = "";
    emptyState.hidden = false;
    emptyState.textContent = "Open a scene to see flying tokens.";
    return;
  }

  const flyingItems = getFlyingItems(state.items);

  list.innerHTML = "";
  emptyState.hidden = flyingItems.length > 0;
  emptyState.textContent = "No flying tokens in this scene.";

  for (const item of flyingItems) {
    const isBusy = state.busyGifItemIds.has(item.id);
    const row = document.createElement("li");
    row.className = "flying-row";

    const info = document.createElement("div");
    info.className = "flying-row__info";

    const top = document.createElement("div");
    top.className = "flying-row__top";

    const name = document.createElement("span");
    name.className = "flying-row__name";
    name.textContent = getItemLabel(item);

    const height = document.createElement("span");
    height.className = "flying-row__height";
    height.textContent = `${getItemZFeet(item)} ft`;

    top.append(name, height);
    info.append(top);

    const sliderWrap = document.createElement("div");
    sliderWrap.className = "flying-row__slider";

    const slider = document.createElement("input");
    slider.className = "ui-slider";
    slider.type = "range";
    slider.min = "5";
    slider.max = "150";
    slider.step = "5";
    slider.value = String(getItemZFeet(item));
    slider.dataset.action = "set-z";
    slider.dataset.itemId = item.id;
    slider.disabled = isBusy;

    sliderWrap.append(slider);

    const controls = document.createElement("div");
    controls.className = "flying-row__controls";

    const downButton = document.createElement("button");
    downButton.type = "button";
    downButton.textContent = "-5";
    downButton.dataset.action = "decrease-z";
    downButton.dataset.itemId = item.id;
    downButton.disabled = isBusy;

    const upButton = document.createElement("button");
    upButton.type = "button";
    upButton.textContent = "+5";
    upButton.dataset.action = "increase-z";
    upButton.dataset.itemId = item.id;
    upButton.disabled = isBusy;

    const gifButton = document.createElement("button");
    gifButton.type = "button";
    gifButton.className = "flying-row__secondary-action";
    gifButton.textContent = isBusy ? "Working..." : "GIF";
    gifButton.dataset.action = "make-gif";
    gifButton.dataset.itemId = item.id;
    gifButton.disabled = isBusy;

    controls.append(downButton, upButton, gifButton);

    if (hasActiveGifPrototype(item)) {
      const restoreButton = document.createElement("button");
      restoreButton.type = "button";
      restoreButton.className = "flying-row__secondary-action";
      restoreButton.textContent = isBusy ? "Working..." : "Restore";
      restoreButton.dataset.action = "restore-gif";
      restoreButton.dataset.itemId = item.id;
      restoreButton.disabled = isBusy;
      controls.append(restoreButton);
    }

    row.append(info, controls, sliderWrap);
    list.append(row);
  }
}

function renderLightDirectionControl() {
  const sun = document.getElementById("light-sun");
  const centerIcon = document.getElementById("light-center-icon");
  if (!sun) return;

  const vector =
    state.isAdjustingLight && state.pendingLightVector
      ? state.pendingLightVector
      : getLightVector();
  const normalizedDistance = Math.min(1, Math.hypot(vector.x, vector.y) / 5);
  const directionLength = Math.hypot(vector.x, vector.y);
  const directionX = directionLength > 0 ? vector.x / directionLength : 0;
  const directionY = directionLength > 0 ? vector.y / directionLength : 0;
  const travelPercent = normalizedDistance * 44;

  sun.style.left = `${50 + directionX * travelPercent}%`;
  sun.style.top = `${50 + directionY * travelPercent}%`;

  if (centerIcon) {
    centerIcon.innerHTML = `
      <svg viewBox="0 0 32 40" width="22" height="30" aria-hidden="true">
        <circle cx="16" cy="6.5" r="4.5" fill="#e7ebff"/>
        <path d="M16 11.5v11.5M16 15.5l-6 6M16 15.5l6 6M16 23l-5 10M16 23l5 10" stroke="#e7ebff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg>
    `;
  }
}

function renderFloatAnimationControls() {
  const toggle = document.getElementById("float-animation-toggle");
  const amplitudeSlider = document.getElementById("float-animation-amplitude");
  const amplitudeValue = document.getElementById("float-animation-amplitude-value");

  if (!toggle || !amplitudeSlider || !amplitudeValue) return;

  const enabled = isFloatAnimationEnabled();
  const amplitude = getFloatAnimationAmplitude();

  toggle.checked = enabled;
  amplitudeSlider.value = String(amplitude);
  amplitudeSlider.disabled = !enabled;
  amplitudeValue.textContent = `${amplitude} ft`;
}

function render() {
  renderFlyingList();
  renderLightDirectionControl();
  renderFloatAnimationControls();
}

async function refreshItems() {
  if (!state.sceneReady) {
    state.items = [];
    render();
    return;
  }

  try {
    state.items = await OBR.scene.items.getItems();
  } catch (error) {
    if (error?.error?.name === "MissingDataError") {
      state.sceneReady = false;
      state.items = [];
      render();
      return;
    }

    throw error;
  }

  await syncLocalShadows(state.items);
  render();
}

OBR.onReady(() => {
  const lightDirection = document.getElementById("light-direction");
  const lightSun = document.getElementById("light-sun");
  const floatAnimationToggle = document.getElementById("float-animation-toggle");
  const floatAnimationAmplitude = document.getElementById("float-animation-amplitude");
  const list = document.getElementById("flying-list");

  subscribeToRoomSettings((settings) => {
    applyRuntimeSettings(getEffectiveSettings(settings));

    if (state.sceneReady) {
      syncLocalShadows(state.items).then(render);
      return;
    }

    render();
  });

  if (list) {
    list.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action][data-item-id]");
      if (!button) return;

      const itemId = button.dataset.itemId;
      const item = state.items.find((candidate) => candidate.id === itemId);

      if (!item || !isFlying(item)) return;

      if (button.dataset.action === "make-gif" || button.dataset.action === "restore-gif") {
        state.busyGifItemIds.add(itemId);
        render();

        try {
          if (button.dataset.action === "make-gif") {
            await ensureGifPrototype(item);
          } else {
            await restoreGifPrototype(itemId);
          }
        } catch (error) {
          console.error("Simple Flying GIF prototype error", error);
        } finally {
          state.busyGifItemIds.delete(itemId);
        }

        await refreshItems();
        return;
      }

      const delta = button.dataset.action === "increase-z" ? Z_STEP_FEET : -Z_STEP_FEET;
      await setFlyingHeight(item.id, getItemZFeet(item) + delta);
      await refreshItems();
    });

    list.addEventListener("input", (event) => {
      const slider = event.target.closest("input[data-action='set-z'][data-item-id]");
      if (!slider) return;

      const row = slider.closest(".flying-row");
      const height = row?.querySelector(".flying-row__height");
      if (!height) return;
      height.textContent = `${slider.value} ft`;
    });

    list.addEventListener("change", async (event) => {
      const slider = event.target.closest("input[data-action='set-z'][data-item-id]");
      if (!slider) return;

      const itemId = slider.dataset.itemId;
      const item = state.items.find((candidate) => candidate.id === itemId);

      if (!item || !isFlying(item)) {
        await refreshItems();
        return;
      }

      await setFlyingHeight(item.id, slider.value);
      await refreshItems();
    });
  }

  if (lightDirection && lightSun) {
    let isDraggingLight = false;

    const getDraggedLightVector = (clientX, clientY) => {
      const padRect = lightDirection.getBoundingClientRect();
      const centerX = padRect.left + padRect.width / 2;
      const centerY = padRect.top + padRect.height / 2;
      const radius = Math.min(padRect.width, padRect.height) * 0.44;
      const deltaX = ((clientX - centerX) / radius) * 5;
      const deltaY = ((clientY - centerY) / radius) * 5;

      return { x: deltaX, y: deltaY };
    };

    const previewLightDirection = async (clientX, clientY) => {
      state.pendingLightVector = getDraggedLightVector(clientX, clientY);
      applyRuntimeSettings({
        lightVector: state.pendingLightVector,
      });

      if (state.sceneReady) {
        await syncLocalShadows(state.items);
      }

      render();
    };

    lightSun.addEventListener("pointerdown", async (event) => {
      isDraggingLight = true;
      state.isAdjustingLight = true;
      lightSun.setPointerCapture(event.pointerId);
      await previewLightDirection(event.clientX, event.clientY);
      await updateRoomSettings({ lightDragActive: true });
    });

    lightSun.addEventListener("pointermove", async (event) => {
      if (!isDraggingLight) return;
      await previewLightDirection(event.clientX, event.clientY);
    });

    lightSun.addEventListener("pointerup", async () => {
      isDraggingLight = false;
      state.isAdjustingLight = false;
      const committedLightVector = state.pendingLightVector;
      state.pendingLightVector = null;
      await updateRoomSettings({ lightDragActive: false });
      if (committedLightVector) {
        await updateRoomSettings({
          lightVector: committedLightVector,
        });
      }
    });

    lightSun.addEventListener("pointercancel", async () => {
      isDraggingLight = false;
      state.isAdjustingLight = false;
      state.pendingLightVector = null;
      await updateRoomSettings({ lightDragActive: false });
      const settings = await getRoomSettings();
      applyRuntimeSettings(getEffectiveSettings(settings));
      if (state.sceneReady) {
        await syncLocalShadows(state.items);
      }
      render();
    });
  }

  if (floatAnimationToggle) {
    floatAnimationToggle.addEventListener("change", async (event) => {
      await updateRoomSettings({
        floatAnimationEnabled: event.target.checked,
      });
      await refreshItems();
    });
  }

  if (floatAnimationAmplitude) {
    floatAnimationAmplitude.addEventListener("input", (event) => {
      applyRuntimeSettings({
        floatAnimationAmplitude: event.target.value,
      });
      render();
    });

    floatAnimationAmplitude.addEventListener("change", async (event) => {
      await updateRoomSettings({
        floatAnimationAmplitude: event.target.value,
      });
      await refreshItems();
    });
  }

  OBR.scene.items.onChange((items) => {
    if (!state.sceneReady) return;
    state.items = items;
    syncLocalShadows(state.items).then(render);
  });

  OBR.scene.onReadyChange(async (ready) => {
    state.sceneReady = ready;

    if (!ready) {
      state.items = [];
      clearLocalShadows();
      render();
      return;
    }

    await refreshItems();
  });

  OBR.scene.isReady().then(async (ready) => {
    state.sceneReady = ready;
    const settings = await getRoomSettings();
    applyRuntimeSettings(settings);
    render();

    if (!ready) return;

    await refreshItems();
  });
});
