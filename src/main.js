import OBR from "@owlbear-rodeo/sdk";
import { isDead, toggleDeadForItems } from "./dead.js";
import { syncLocalDeadVisuals } from "./deadVisuals.js";
import { syncLocalFlyingLabels } from "./flyingLabel.js";
import {
  getItemLabel,
  getItemZFeet,
  isFlying,
  setFlyingHeight,
  toggleFlyingForItems,
} from "./flying.js";
import { syncLocalShadows } from "./shadow.js";
import { getRegisteredStatusDefinitions } from "./statusRegistry.js";

const TAB_SELECTED = "selected";
const TAB_SCENE = "scene";

const state = {
  items: [],
  sceneReady: false,
  selectedIds: [],
  activeTab: TAB_SCENE,
};

function getCharacterItems() {
  return state.items
    .filter((item) => item?.layer === "CHARACTER")
    .sort((left, right) => getItemLabel(left).localeCompare(getItemLabel(right)));
}

function getSelectedCharacterItems() {
  if (state.selectedIds.length === 0) {
    return [];
  }

  const selectedIdSet = new Set(state.selectedIds);
  return getCharacterItems().filter((item) => selectedIdSet.has(item.id));
}

function getStatusSummary(item) {
  const parts = [];

  if (isFlying(item)) {
    parts.push(`Flying ${getItemZFeet(item)} ft`);
  }

  if (isDead(item)) {
    parts.push("Dead");
  }

  if (parts.length === 0) {
    return "No active status";
  }

  return parts.join(" · ");
}

function getStatusButtonConfig(item, statusId) {
  if (statusId === "flying") {
    return {
      action: "toggle-status",
      statusId,
      label: isFlying(item) ? "Land" : "Flying",
      active: isFlying(item),
    };
  }

  if (statusId === "dead") {
    return {
      action: "toggle-status",
      statusId,
      label: isDead(item) ? "Revive" : "Dead",
      active: isDead(item),
    };
  }

  return {
    action: "toggle-status",
    statusId,
    label: statusId,
    active: false,
  };
}

function createStatusButtons(item) {
  const wrap = document.createElement("div");
  wrap.className = "token-row__statuses";

  for (const definition of getRegisteredStatusDefinitions()) {
    const config = getStatusButtonConfig(item, definition.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `status-button${config.active ? " is-active" : ""}`;
    button.textContent = config.label;
    button.dataset.action = config.action;
    button.dataset.itemId = item.id;
    button.dataset.statusId = config.statusId;
    wrap.append(button);
  }

  return wrap;
}

function createZSlider(item) {
  const wrap = document.createElement("div");
  wrap.className = "token-row__slider";

  const value = document.createElement("div");
  value.className = "token-row__slider-value";
  value.textContent = `${getItemZFeet(item)} ft`;

  const slider = document.createElement("input");
  slider.className = "ui-slider";
  slider.type = "range";
  slider.min = "5";
  slider.max = "150";
  slider.step = "5";
  slider.value = String(getItemZFeet(item));
  slider.dataset.action = "set-z";
  slider.dataset.itemId = item.id;

  wrap.append(value, slider);
  return wrap;
}

function createTokenRow(item) {
  const row = document.createElement("li");
  row.className = "token-row";

  const header = document.createElement("div");
  header.className = "token-row__header";

  const name = document.createElement("div");
  name.className = "token-row__name";
  name.textContent = getItemLabel(item);

  const summary = document.createElement("div");
  summary.className = "token-row__summary";
  summary.textContent = getStatusSummary(item);

  header.append(name, summary);
  row.append(header, createStatusButtons(item));

  if (isFlying(item)) {
    row.append(createZSlider(item));
  }

  return row;
}

function renderTabButtons() {
  const buttons = document.querySelectorAll("[data-tab-target]");
  for (const button of buttons) {
    const isActive = button.dataset.tabTarget === state.activeTab;
    button.classList.toggle("is-active", isActive);
  }

  const selectedPanel = document.getElementById("tab-panel-selected");
  const scenePanel = document.getElementById("tab-panel-scene");

  if (selectedPanel) {
    selectedPanel.hidden = state.activeTab !== TAB_SELECTED;
  }
  if (scenePanel) {
    scenePanel.hidden = state.activeTab !== TAB_SCENE;
  }
}

function renderSelectedTab() {
  const list = document.getElementById("selected-token-list");
  const empty = document.getElementById("selected-token-empty");
  if (!list || !empty) return;

  list.innerHTML = "";

  if (!state.sceneReady) {
    empty.hidden = false;
    empty.textContent = "Open a scene to inspect the selected token.";
    return;
  }

  const selectedItems = getSelectedCharacterItems();

  if (selectedItems.length === 0) {
    empty.hidden = false;
    empty.textContent = "Select a character token in the scene.";
    return;
  }

  empty.hidden = true;
  for (const item of selectedItems) {
    list.append(createTokenRow(item));
  }
}

function renderSceneTab() {
  const list = document.getElementById("scene-token-list");
  const empty = document.getElementById("scene-token-empty");
  if (!list || !empty) return;

  list.innerHTML = "";

  if (!state.sceneReady) {
    empty.hidden = false;
    empty.textContent = "Open a scene to see character tokens.";
    return;
  }

  const characterItems = getCharacterItems();

  if (characterItems.length === 0) {
    empty.hidden = false;
    empty.textContent = "No character tokens in this scene.";
    return;
  }

  empty.hidden = true;
  for (const item of characterItems) {
    list.append(createTokenRow(item));
  }
}

function render() {
  renderTabButtons();
  renderSelectedTab();
  renderSceneTab();
}

async function refreshSelection() {
  try {
    state.selectedIds = (await OBR.player.getSelection()) ?? [];
  } catch {
    state.selectedIds = [];
  }

  render();
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
  await syncLocalFlyingLabels(state.items);
  await syncLocalShadows(state.items);
  render();
}

async function toggleStatus(item, statusId) {
  if (statusId === "flying") {
    await toggleFlyingForItems([item]);
    return;
  }

  if (statusId === "dead") {
    await toggleDeadForItems([item]);
  }
}

OBR.onReady(() => {
  document.addEventListener("click", async (event) => {
    const tabButton = event.target.closest("[data-tab-target]");
    if (tabButton) {
      state.activeTab = tabButton.dataset.tabTarget;
      render();
      return;
    }

    const statusButton = event.target.closest("button[data-action='toggle-status'][data-item-id][data-status-id]");
    if (!statusButton) return;

    const item = state.items.find((candidate) => candidate.id === statusButton.dataset.itemId);
    if (!item) return;

    await toggleStatus(item, statusButton.dataset.statusId);
    await refreshItems();
    await refreshSelection();
  });

  document.addEventListener("input", (event) => {
    const slider = event.target.closest("input[data-action='set-z'][data-item-id]");
    if (!slider) return;

    const wrap = slider.closest(".token-row__slider");
    const value = wrap?.querySelector(".token-row__slider-value");
    if (value) {
      value.textContent = `${slider.value} ft`;
    }
  });

  document.addEventListener("change", async (event) => {
    const slider = event.target.closest("input[data-action='set-z'][data-item-id]");
    if (!slider) return;

    const item = state.items.find((candidate) => candidate.id === slider.dataset.itemId);
    if (!item || !isFlying(item)) {
      await refreshItems();
      return;
    }

    await setFlyingHeight(item.id, slider.value);
    await refreshItems();
  });

  OBR.player.onChange(() => {
    Promise.resolve().then(refreshSelection);
  });

  OBR.scene.items.onChange((items) => {
    if (!state.sceneReady) return;
    state.items = items;
    Promise.resolve()
      .then(async () => {
        await syncLocalDeadVisuals(state.items);
        await syncLocalFlyingLabels(state.items);
        await syncLocalShadows(state.items);
      })
      .then(render);
  });

  OBR.scene.onReadyChange(async (ready) => {
    state.sceneReady = ready;

    if (!ready) {
      state.items = [];
      state.selectedIds = [];
      render();
      return;
    }

    await refreshSelection();
    await refreshItems();
  });

  OBR.scene.isReady().then(async (ready) => {
    state.sceneReady = ready;
    await refreshSelection();
    render();

    if (!ready) return;
    await refreshItems();
  });
});
