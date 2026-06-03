import OBR from "@owlbear-rodeo/sdk";

const STATUS_CONTEXT_MENU_ID = "token-status/context-menu";
const STATUS_CONTEXT_MENU_HEIGHT = 136;

function getContextMenuUrl() {
  return new URL("/context-menu.html", globalThis.location.href).toString();
}

export function setupContextMenu() {
  OBR.contextMenu.create({
    id: STATUS_CONTEXT_MENU_ID,
    icons: [
      {
        icon: "/icon.png",
        label: "Token Status",
        filter: {
          every: [{ key: "layer", value: "CHARACTER" }],
        },
      },
    ],
    embed: {
      url: getContextMenuUrl(),
      height: STATUS_CONTEXT_MENU_HEIGHT,
    },
    async onClick() {},
  });
}
