import OBR from "@owlbear-rodeo/sdk";
import { syncLocalDeadVisuals } from "./deadVisuals.js";
import {
  Z_STEP_FEET,
  getFlyingItems,
  getItemLabel,
  getItemZFeet,
  isFlying,
  setFlyingHeight,
} from "./flying.js";
import { syncLocalShadows } from "./shadow.js";
import {
  applyRuntimeShadowSettings,
  getRoomShadowSettings,
  subscribeToRoomShadowSettings,
  updateRoomShadowSettings,
} from "./shadowSettings.js";

const state = {
  items: [],
  sceneReady: false,
};

const SHADOW_CONTROL_DEFINITIONS = [
  { key: "widthScaleAt5Ft", label: "Width Scale @ 5 ft", min: 0.2, max: 2, step: 0.01 },
  { key: "heightScaleAt5Ft", label: "Height Scale @ 5 ft", min: 0.2, max: 2, step: 0.01 },
  { key: "scaleLossPer5Ft", label: "Scale Loss / 5 ft", min: -0.1, max: 0.1, step: 0.001 },
  { key: "minScale", label: "Minimum Scale", min: 0.1, max: 2, step: 0.01 },
  { key: "offsetStrength", label: "Offset Strength", min: 0, max: 300, step: 1 },
  { key: "offsetZRange", label: "Offset Z Range", min: 5, max: 500, step: 1 },
  { key: "yOffsetRatio", label: "Vertical Offset", min: -0.5, max: 0.5, step: 0.01 },
  { key: "opacity", label: "Opacity", min: 0, max: 1, step: 0.01 },
  { key: "softness", label: "Blur / Softness", min: 0, max: 1, step: 0.01 },
];

function renderFlyingList() {
  const list = document.getElementById("flying-list");
  const emptyState = document.getElementById("flying-empty");

  if (!list || !emptyState) return;

  if (!state.sceneReady) {
    list.innerHTML = "";
    emptyState.hidden = false;
    emptyState.textContent = "Open a scene to see active token statuses.";
    return;
  }

  const flyingItems = getFlyingItems(state.items);

  list.innerHTML = "";
  emptyState.hidden = flyingItems.length > 0;
  emptyState.textContent = "No active token statuses in this scene.";

  for (const item of flyingItems) {
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

    sliderWrap.append(slider);

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

    row.append(info, controls, sliderWrap);
    list.append(row);
  }
}

function render() {
  renderShadowControls();
  renderFlyingList();
}

function formatShadowValue(definition, value) {
  const numericValue = Number(value);
  if (definition.step < 0.01) {
    return numericValue.toFixed(3);
  }
  if (definition.step < 0.1) {
    return numericValue.toFixed(2);
  }
  return numericValue.toFixed(0);
}

function renderShadowControls() {
  const list = document.getElementById("shadow-controls");
  if (!list) return;

  const settings = applyRuntimeShadowSettings();
  list.innerHTML = "";

  for (const definition of SHADOW_CONTROL_DEFINITIONS) {
    const row = document.createElement("label");
    row.className = "shadow-control";

    const header = document.createElement("div");
    header.className = "shadow-control__header";

    const name = document.createElement("span");
    name.textContent = definition.label;

    const value = document.createElement("span");
    value.className = "shadow-control__value";
    value.textContent = formatShadowValue(definition, settings[definition.key]);

    const slider = document.createElement("input");
    slider.className = "ui-slider";
    slider.type = "range";
    slider.min = String(definition.min);
    slider.max = String(definition.max);
    slider.step = String(definition.step);
    slider.value = String(settings[definition.key]);
    slider.dataset.shadowKey = definition.key;

    header.append(name, value);
    row.append(header, slider);
    list.append(row);
  }
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

  await syncLocalDeadVisuals(state.items);
  await syncLocalShadows(state.items);
  render();
}

OBR.onReady(() => {
  const list = document.getElementById("flying-list");
  const shadowControls = document.getElementById("shadow-controls");

  subscribeToRoomShadowSettings((settings) => {
    applyRuntimeShadowSettings(settings);

    if (state.sceneReady) {
      Promise.resolve()
        .then(async () => {
          await syncLocalShadows(state.items);
        })
        .then(render);
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

  if (shadowControls) {
    shadowControls.addEventListener("input", async (event) => {
      const slider = event.target.closest("input[data-shadow-key]");
      if (!slider) return;

      applyRuntimeShadowSettings({
        ...applyRuntimeShadowSettings(),
        [slider.dataset.shadowKey]: slider.value,
      });

      if (state.sceneReady) {
        await syncLocalShadows(state.items);
      }
      render();
    });

    shadowControls.addEventListener("change", async (event) => {
      const slider = event.target.closest("input[data-shadow-key]");
      if (!slider) return;

      await updateRoomShadowSettings({
        [slider.dataset.shadowKey]: slider.value,
      });
      await refreshItems();
    });
  }

  OBR.scene.items.onChange((items) => {
    if (!state.sceneReady) return;
    state.items = items;
    Promise.resolve()
      .then(async () => {
        await syncLocalDeadVisuals(state.items);
        await syncLocalShadows(state.items);
      })
      .then(render);
  });

  OBR.scene.onReadyChange(async (ready) => {
    state.sceneReady = ready;

    if (!ready) {
      state.items = [];
      render();
      return;
    }

    await refreshItems();
  });

  OBR.scene.isReady().then(async (ready) => {
    state.sceneReady = ready;
    const shadowSettings = await getRoomShadowSettings();
    applyRuntimeShadowSettings(shadowSettings);
    render();

    if (!ready) return;

    await refreshItems();
  });
});
