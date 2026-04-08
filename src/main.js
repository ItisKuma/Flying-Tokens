import OBR from "@owlbear-rodeo/sdk";
import {
  DEFAULT_Z_FEET,
  Z_STEP_FEET,
  getBaseScale,
  getFlyingItems,
  getItemLabel,
  getItemZFeet,
  getVisualFlyingScale,
  isFlying,
  setFlyingHeight,
} from "./flying.js";
import {
  getFloatAnimationAmplitude,
  getVisualZFeet,
  isFloatAnimationEnabled,
  setFloatAnimationPaused,
} from "./floatAnimation.js";
import { clearLocalShadows, getLightVector, syncLocalShadows } from "./shadow.js";
import {
  applyRuntimeSettings,
  getRoomSettings,
  subscribeToRoomSettings,
  updateRoomSettings,
} from "./settings.js";

const state = {
  items: [],
  selection: [],
  sceneReady: false,
  isAdjustingZSlider: false,
  pendingZSliderValue: DEFAULT_Z_FEET,
  isAdjustingLight: false,
  pendingLightVector: null,
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

function setStatusMessage(message) {
  const selectedTokenStatus = document.getElementById("selected-token-status");
  if (!selectedTokenStatus) return;
  selectedTokenStatus.textContent = message;
}

function getSelectionIds() {
  return Array.isArray(state.selection) ? state.selection : [];
}

function getSingleSelectedItem() {
  const selectedItems = state.items.filter((item) =>
    getSelectionIds().includes(item.id),
  );

  return selectedItems.length === 1 ? selectedItems[0] : null;
}

function renderSelectedTokenControls() {
  const selectedTokenName = document.getElementById("selected-token-name");
  const selectedTokenStatus = document.getElementById("selected-token-status");
  const zSlider = document.getElementById("z-slider");
  const zValue = document.getElementById("z-value");

  if (!selectedTokenName || !selectedTokenStatus || !zSlider || !zValue) return;

  if (!state.sceneReady) {
    selectedTokenName.textContent = "No scene loaded";
    setStatusMessage("Open a scene in Owlbear to manage flying tokens.");
    zSlider.disabled = true;
    zSlider.value = String(state.pendingZSliderValue);
    zValue.textContent = `${DEFAULT_Z_FEET} ft`;
    return;
  }

  const selectedItems = state.items.filter((item) =>
    getSelectionIds().includes(item.id),
  );

  if (selectedItems.length !== 1) {
    selectedTokenName.textContent = "Select exactly one token";
    setStatusMessage("Use one selected token to edit its flying height.");
    zSlider.disabled = true;
    zSlider.value = String(state.pendingZSliderValue);
    zValue.textContent = `${DEFAULT_Z_FEET} ft`;
    return;
  }

  const [selectedItem] = selectedItems;
  const selectedItemFlying = isFlying(selectedItem);
  const itemZFeet = getItemZFeet(selectedItem);

  selectedTokenName.textContent = getItemLabel(selectedItem);
  setStatusMessage(
    selectedItemFlying
      ? "Flying token selected"
      : "Token is not flying yet",
  );
  zSlider.disabled = !selectedItemFlying;

  const displayedZValue =
    state.isAdjustingZSlider && selectedItemFlying
      ? state.pendingZSliderValue
      : itemZFeet;

  zSlider.value = String(displayedZValue);
  zValue.textContent = `${displayedZValue} ft`;
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
    const row = document.createElement("li");
    row.className = "flying-row";

    const info = document.createElement("div");
    info.className = "flying-row__info";

    const name = document.createElement("span");
    name.className = "flying-row__name";
    name.textContent = getItemLabel(item);

    const height = document.createElement("span");
    height.className = "flying-row__height";
    height.textContent = `${getItemZFeet(item)} ft`;

    info.append(name, height);

    const controls = document.createElement("div");
    controls.className = "flying-row__controls";

    const downButton = document.createElement("button");
    downButton.type = "button";
    downButton.textContent = "-5";
    downButton.dataset.action = "decrease-z";
    downButton.dataset.itemId = item.id;

    const upButton = document.createElement("button");
    upButton.type = "button";
    upButton.textContent = "+5";
    upButton.dataset.action = "increase-z";
    upButton.dataset.itemId = item.id;

    controls.append(downButton, upButton);
    row.append(info, controls);
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
  renderSelectedTokenControls();
  renderFlyingList();
  renderLightDirectionControl();
  renderFloatAnimationControls();
}

async function syncAnimatedTokenScales() {
  if (!state.sceneReady) return;

  const flyingItems = getFlyingItems(state.items);
  if (flyingItems.length === 0) return;

  const scaleById = new Map(
    flyingItems.map((item) => {
      const zFeet = isFloatAnimationEnabled() ? getVisualZFeet(item) : getItemZFeet(item);
      return [item.id, getVisualFlyingScale(getBaseScale(item), zFeet)];
    }),
  );

  try {
    await OBR.scene.items.updateItems([...scaleById.keys()], (items) => {
      for (const item of items) {
        if (!item) continue;

        const nextScale = scaleById.get(item.id);
        if (!nextScale) continue;
        item.scale = nextScale;
      }
    });
  } catch (error) {
    if (error?.error?.name !== "RateLimitHit") {
      console.error("Simple Flying float animation error", error);
    }
  }
}

async function applyFloatAnimationSettings() {
  await syncAnimatedTokenScales();
  await refreshItems();
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

async function updateSelection(selection = null) {
  const nextSelection = selection ?? (await OBR.player.getSelection());
  state.selection = Array.isArray(nextSelection) ? nextSelection : [];
  render();
}

OBR.onReady(() => {
  const zSlider = document.getElementById("z-slider");
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

  if (zSlider) {
    zSlider.addEventListener("pointerdown", () => {
      state.isAdjustingZSlider = true;
    });

    zSlider.addEventListener("input", (event) => {
      state.isAdjustingZSlider = true;
      state.pendingZSliderValue = Number(event.target.value) || DEFAULT_Z_FEET;
      const zValue = document.getElementById("z-value");
      if (!zValue) return;
      zValue.textContent = `${event.target.value} ft`;
    });

    zSlider.addEventListener("change", async (event) => {
      const selectedItems = state.items.filter((item) =>
        getSelectionIds().includes(item.id),
      );

      if (selectedItems.length !== 1 || !isFlying(selectedItems[0])) {
        state.isAdjustingZSlider = false;
        return;
      }

      try {
        await setFlyingHeight(selectedItems[0].id, event.target.value);
        state.pendingZSliderValue = Number(event.target.value) || DEFAULT_Z_FEET;
        await refreshItems();
      } catch (error) {
        const message =
          error?.error?.name === "RateLimitHit"
            ? "Too many updates too quickly. Wait a moment and try again."
            : "Could not update flying height.";

        setStatusMessage(message);
        await refreshItems();
      } finally {
        state.isAdjustingZSlider = false;
      }
    });

    zSlider.addEventListener("pointercancel", () => {
      state.isAdjustingZSlider = false;
    });
  }

  if (list) {
    list.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action][data-item-id]");
      if (!button) return;

      const itemId = button.dataset.itemId;
      const item = state.items.find((candidate) => candidate.id === itemId);

      if (!item || !isFlying(item)) return;

      const delta = button.dataset.action === "increase-z" ? Z_STEP_FEET : -Z_STEP_FEET;
      try {
        await setFlyingHeight(item.id, getItemZFeet(item) + delta);
        await refreshItems();
      } catch (error) {
        const message =
          error?.error?.name === "RateLimitHit"
            ? "Too many updates too quickly. Wait a moment and try again."
            : "Could not update flying height.";

        setStatusMessage(message);
        await refreshItems();
      }
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
      setFloatAnimationPaused(true);
      await updateRoomSettings({
        floatAnimationPaused: true,
        lightDragActive: true,
      });
    });

    lightSun.addEventListener("pointermove", async (event) => {
      if (!isDraggingLight) return;
      await previewLightDirection(event.clientX, event.clientY);
    });

    lightSun.addEventListener("pointerup", async () => {
      isDraggingLight = false;
      state.isAdjustingLight = false;
      setFloatAnimationPaused(false);
      const committedLightVector = state.pendingLightVector;
      state.pendingLightVector = null;
      await updateRoomSettings({
        floatAnimationPaused: false,
        lightDragActive: false,
      });
      if (committedLightVector) {
        await updateRoomSettings({
          lightVector: committedLightVector,
        });
      }
    });

    lightSun.addEventListener("pointercancel", async () => {
      isDraggingLight = false;
      state.isAdjustingLight = false;
      setFloatAnimationPaused(false);
      state.pendingLightVector = null;
      await updateRoomSettings({
        floatAnimationPaused: false,
        lightDragActive: false,
      });
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
      render();
      await applyFloatAnimationSettings();
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
      render();
      await applyFloatAnimationSettings();
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
    await updateSelection();
  });

  OBR.player.onChange((player) => {
    state.selection = Array.isArray(player?.selection) ? player.selection : [];
    render();
  });

  OBR.scene.isReady().then(async (ready) => {
    state.sceneReady = ready;
    const settings = await getRoomSettings();
    applyRuntimeSettings(settings);
    render();

    if (!ready) return;

    await refreshItems();
    await updateSelection();
  });
});
