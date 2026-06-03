import OBR from "@owlbear-rodeo/sdk";
import "./contextMenuPanel.css";
import { isDead, toggleDeadForItems } from "./dead.js";
import {
  MAX_Z_FEET,
  MIN_Z_FEET,
  Z_STEP_FEET,
  getItemLabel,
  getItemZFeet,
  isFlying,
  setFlyingHeight,
  toggleFlyingForItems,
} from "./flying.js";

const state = {
  busy: false,
  items: [],
  selection: [],
};

function getCharacterItems() {
  const selectedIds = new Set(state.selection);
  return state.items.filter(
    (item) =>
      selectedIds.has(item.id) &&
      item?.layer === "CHARACTER" &&
      item?.type === "IMAGE",
  );
}

function getFlyingSelection() {
  return getCharacterItems().filter((item) => isFlying(item));
}

function areAllFlying(items) {
  return items.length > 0 && items.every((item) => isFlying(item));
}

function areAllDead(items) {
  return items.length > 0 && items.every((item) => isDead(item));
}

function getPrimaryLabel(items) {
  if (items.length === 1) {
    return getItemLabel(items[0]);
  }

  return `${items.length} tokens`;
}

function getStatusIcon(statusId, isActive) {
  if (statusId === "flying") {
    return isActive
      ? `
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 12.5h12" />
          <path d="M6.5 15 4 12.5 6.5 10" />
          <path d="M13.5 15 16 12.5 13.5 10" />
        </svg>
      `
      : `
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 15V6" />
          <path d="M6.5 9.5 10 6l3.5 3.5" />
          <path d="M6 14.5c1.1-1.2 2.4-1.8 4-1.8s2.9.6 4 1.8" />
        </svg>
      `;
  }

  return isActive
    ? `
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 4a6 6 0 1 0 5.2 3" />
        <path d="M10 1.8v3.7h3.8" />
      </svg>
    `
    : `
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M7.2 5.2h5.6l2.2 3v4.7l-5 3-5-3V8.2z" />
        <path d="M8.3 9.2h.01" />
        <path d="M11.7 9.2h.01" />
        <path d="M8.8 12.1c.7-.5 1.7-.5 2.4 0" />
      </svg>
    `;
}

function ensureShell() {
  const root = document.getElementById("contextMenuApp");
  if (!root || root.querySelector(".menu-shell")) {
    return;
  }

  root.innerHTML = `
    <div class="menu-shell">
      <div id="menu-content"></div>
    </div>
  `;
}

function renderEmpty(message) {
  const content = document.getElementById("menu-content");
  if (!content) {
    return;
  }

  content.innerHTML = `<p class="menu-empty">${message}</p>`;
}

function render() {
  const content = document.getElementById("menu-content");
  if (!content) {
    return;
  }

  const items = getCharacterItems();
  if (items.length === 0) {
    renderEmpty("Select one or more character tokens to edit status.");
    return;
  }

  const allFlying = areAllFlying(items);
  const allDead = areAllDead(items);
  const showSlider = items.length === 1 && allFlying;
  const sliderValue = showSlider ? getItemZFeet(items[0]) : MIN_Z_FEET;

  content.innerHTML = `
    <div class="menu-header">
      <p class="menu-title">${getPrimaryLabel(items)}</p>
      <span class="menu-count">${items.length}</span>
    </div>
    <div class="menu-buttons">
      <button
        id="menu-flying"
        class="menu-button${allFlying ? " is-active" : ""}"
        type="button"
        ${state.busy ? "disabled" : ""}
        aria-label="${allFlying ? "Land selected tokens" : "Make selected tokens flying"}"
      >
        ${getStatusIcon("flying", allFlying)}
        <span class="menu-button__label">${allFlying ? "Land" : "Fly"}</span>
      </button>
      <button
        id="menu-dead"
        class="menu-button${allDead ? " is-active" : ""}"
        type="button"
        ${state.busy ? "disabled" : ""}
        aria-label="${allDead ? "Revive selected tokens" : "Mark selected tokens dead"}"
      >
        ${getStatusIcon("dead", allDead)}
        <span class="menu-button__label">${allDead ? "Revive" : "Dead"}</span>
      </button>
    </div>
    <div class="menu-slider" ${showSlider ? "" : "hidden"}>
      <div class="menu-slider__header">
        <span>Height</span>
        <span class="menu-slider__value" id="menu-z-value">${sliderValue} ft</span>
      </div>
      <input
        id="menu-z-slider"
        type="range"
        min="${MIN_Z_FEET}"
        max="${MAX_Z_FEET}"
        step="${Z_STEP_FEET}"
        value="${sliderValue}"
        ${state.busy ? "disabled" : ""}
      />
    </div>
  `;
}

async function refreshSelection() {
  try {
    state.selection = (await OBR.player.getSelection()) ?? [];
  } catch {
    state.selection = [];
  }
}

async function refreshItems() {
  try {
    state.items = await OBR.scene.items.getItems();
  } catch {
    state.items = [];
  }
}

async function refreshAll() {
  await refreshSelection();
  await refreshItems();
  render();
}

async function withBusy(action) {
  if (state.busy) {
    return;
  }

  state.busy = true;
  render();

  try {
    await action();
  } finally {
    state.busy = false;
    await refreshAll();
  }
}

ensureShell();

OBR.onReady(() => {
  void refreshAll();

  document.addEventListener("click", (event) => {
    const flyingButton = event.target.closest("#menu-flying");
    if (flyingButton) {
      void withBusy(async () => {
        await toggleFlyingForItems(getCharacterItems());
      });
      return;
    }

    const deadButton = event.target.closest("#menu-dead");
    if (deadButton) {
      void withBusy(async () => {
        await toggleDeadForItems(getCharacterItems());
      });
    }
  });

  document.addEventListener("input", (event) => {
    const slider = event.target.closest("#menu-z-slider");
    const value = document.getElementById("menu-z-value");
    if (!slider || !value) {
      return;
    }

    value.textContent = `${slider.value} ft`;
  });

  document.addEventListener("change", (event) => {
    const slider = event.target.closest("#menu-z-slider");
    if (!slider) {
      return;
    }

    const [item] = getFlyingSelection();
    if (!item) {
      return;
    }

    void withBusy(async () => {
      await setFlyingHeight(item.id, slider.value);
    });
  });

  OBR.player.onChange(() => {
    void refreshSelection().then(render);
  });

  OBR.scene.items.onChange((items) => {
    state.items = items;
    render();
  });
});
