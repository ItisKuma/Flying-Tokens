import OBR from "@owlbear-rodeo/sdk";
import { isDead, toggleDeadForItems } from "./dead.js";
import { DEAD_VISUAL_NS } from "./deadVisuals.js";
import {
  DEFAULT_Z_FEET,
  getItemLabel,
  getItemZFeet,
  isFlying,
  setFlyingHeight,
  toggleFlyingForItems,
} from "./flying.js";
import { getRegisteredStatusDefinitions } from "./statusRegistry.js";

const state = {
  items: [],
  sceneReady: false,
  selectedIds: [],
  lastSelectedCharacterId: null,
  busyItemIds: new Set(),
};

function isSceneCharacterToken(item) {
  if (!item || item.layer !== "CHARACTER" || item.type !== "IMAGE") {
    return false;
  }

  if (item?.metadata?.[DEAD_VISUAL_NS]?.deadFor) {
    return false;
  }

  const name = getItemLabel(item);
  if (!name || name.startsWith(".")) {
    return false;
  }

  return true;
}

function getCharacterItems() {
  return state.items
    .filter(isSceneCharacterToken)
    .sort((left, right) => getItemLabel(left).localeCompare(getItemLabel(right)));
}

function getSelectedCharacterItems() {
  const selectedIdSet = new Set(state.selectedIds);
  const selectedItems = getCharacterItems().filter((item) => selectedIdSet.has(item.id));

  if (selectedItems.length > 0) {
    return selectedItems;
  }

  if (!state.lastSelectedCharacterId) {
    return [];
  }

  const lastSelectedItem = getCharacterItems().find(
    (item) => item.id === state.lastSelectedCharacterId,
  );

  return lastSelectedItem ? [lastSelectedItem] : [];
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
  const isBusy = state.busyItemIds.has(item.id);

  if (statusId === "flying") {
    return {
      action: "toggle-status",
      statusId,
      label: isFlying(item) ? "Land" : "Flying",
      active: isFlying(item),
      disabled: isBusy,
    };
  }

  if (statusId === "dead") {
    return {
      action: "toggle-status",
      statusId,
      label: isDead(item) ? "Revive" : "Dead",
      active: isDead(item),
      disabled: isBusy,
    };
  }

  return {
    action: "toggle-status",
    statusId,
    label: statusId,
    active: false,
    disabled: isBusy,
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
    button.disabled = Boolean(config.disabled);
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
  slider.disabled = state.busyItemIds.has(item.id);

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
  renderSelectedTab();
  renderSceneTab();
}

function setItemBusy(itemId, isBusy) {
  const nextBusyIds = new Set(state.busyItemIds);

  if (isBusy) {
    nextBusyIds.add(itemId);
  } else {
    nextBusyIds.delete(itemId);
  }

  state.busyItemIds = nextBusyIds;
}

function mergeItemsIntoState(updatedItems) {
  if (!updatedItems || updatedItems.length === 0) {
    return;
  }

  const updatedById = new Map(updatedItems.map((item) => [item.id, item]));
  state.items = state.items.map((item) => updatedById.get(item.id) ?? item);
}

function applyOptimisticStatusToggle(itemId, statusId) {
  state.items = state.items.map((item) => {
    if (item.id !== itemId) {
      return item;
    }

    const nextItem = structuredClone(item);
    nextItem.metadata ??= {};
    nextItem.metadata["token-status"] ??= { statuses: {} };
    nextItem.metadata["token-status"].statuses ??= {};

    if (statusId === "dead") {
      if (isDead(nextItem)) {
        delete nextItem.metadata["token-status"].statuses.dead;
      } else {
        nextItem.metadata["token-status"].statuses.dead = {
          active: true,
          appliedAt: Date.now(),
        };
      }
    }

    if (statusId === "flying") {
      if (isFlying(nextItem)) {
        delete nextItem.metadata["token-status"].statuses.flying;
      } else {
        nextItem.metadata["token-status"].statuses.flying = {
          active: true,
          zFeet: DEFAULT_Z_FEET,
        };
      }
    }

    if (Object.keys(nextItem.metadata["token-status"].statuses).length === 0) {
      delete nextItem.metadata["token-status"];
    }

    return nextItem;
  });
}

function applyOptimisticZChange(itemId, zFeet) {
  state.items = state.items.map((item) => {
    if (item.id !== itemId || !isFlying(item)) {
      return item;
    }

    const nextItem = structuredClone(item);
    nextItem.metadata ??= {};
    nextItem.metadata["token-status"] ??= { statuses: {} };
    nextItem.metadata["token-status"].statuses ??= {};
    nextItem.metadata["token-status"].statuses.flying = {
      ...nextItem.metadata["token-status"].statuses.flying,
      active: true,
      zFeet: Number(zFeet),
    };
    return nextItem;
  });
}

async function refreshSelection() {
  try {
    state.selectedIds = (await OBR.player.getSelection()) ?? [];
  } catch {
    state.selectedIds = [];
  }

  const selectedIdSet = new Set(state.selectedIds);
  const currentSelectedCharacter = getCharacterItems().find((item) =>
    selectedIdSet.has(item.id),
  );

  if (currentSelectedCharacter) {
    state.lastSelectedCharacterId = currentSelectedCharacter.id;
  }

  if (
    state.lastSelectedCharacterId &&
    !state.items.some((item) => item.id === state.lastSelectedCharacterId)
  ) {
    state.lastSelectedCharacterId = null;
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
    const statusButton = event.target.closest("button[data-action='toggle-status'][data-item-id][data-status-id]");
    if (!statusButton) return;

    const item = state.items.find((candidate) => candidate.id === statusButton.dataset.itemId);
    if (!item) return;

    if (state.busyItemIds.has(item.id)) {
      return;
    }

    setItemBusy(item.id, true);
    applyOptimisticStatusToggle(item.id, statusButton.dataset.statusId);
    render();

    try {
      await toggleStatus(item, statusButton.dataset.statusId);
      mergeItemsIntoState(await OBR.scene.items.getItems([item.id]));
      await refreshSelection();
    } finally {
      setItemBusy(item.id, false);
      render();
    }
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

    if (state.busyItemIds.has(item.id)) {
      return;
    }

    setItemBusy(item.id, true);
    applyOptimisticZChange(item.id, slider.value);
    render();

    try {
      await setFlyingHeight(item.id, slider.value);
      mergeItemsIntoState(await OBR.scene.items.getItems([item.id]));
    } finally {
      setItemBusy(item.id, false);
      render();
    }
  });

  OBR.player.onChange(() => {
    Promise.resolve().then(refreshSelection);
  });

  OBR.scene.items.onChange((items) => {
    if (!state.sceneReady) return;
    state.items = items;
    if (
      state.lastSelectedCharacterId &&
      !state.items.some((item) => item.id === state.lastSelectedCharacterId)
    ) {
      state.lastSelectedCharacterId = null;
    }
    render();
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
