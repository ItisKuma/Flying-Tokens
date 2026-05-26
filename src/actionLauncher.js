import OBR from "@owlbear-rodeo/sdk";

const TOKEN_STATUS_POPOVER_ID = "token-status-paperless";
const TOKEN_STATUS_POPOVER_WIDTH = 400;
const TOKEN_STATUS_POPOVER_HEIGHT = 600;
const TOKEN_STATUS_ANCHOR_LEFT = 8;
const TOKEN_STATUS_ANCHOR_TOP = 72;

function getTokenStatusUrl() {
  return new URL("/index.html", globalThis.location.href).toString();
}

async function openPaperlessPopover() {
  await OBR.popover.open({
    id: TOKEN_STATUS_POPOVER_ID,
    url: getTokenStatusUrl(),
    width: TOKEN_STATUS_POPOVER_WIDTH,
    height: TOKEN_STATUS_POPOVER_HEIGHT,
    anchorReference: "POSITION",
    anchorPosition: {
      left: TOKEN_STATUS_ANCHOR_LEFT,
      top: TOKEN_STATUS_ANCHOR_TOP,
    },
    anchorOrigin: {
      horizontal: "LEFT",
      vertical: "TOP",
    },
    transformOrigin: {
      horizontal: "LEFT",
      vertical: "TOP",
    },
    hidePaper: true,
    marginThreshold: 8,
  });
}

OBR.onReady(() => {
  Promise.resolve()
    .then(openPaperlessPopover)
    .finally(() => {
      OBR.action.close().catch(() => {});
    });
});
