import OBR from "@owlbear-rodeo/sdk";
import { toggleDeadForItems, isDead } from "./dead.js";
import { isFlying, toggleFlyingForItems } from "./flying.js";
import { NS } from "./statusModel.js";

const FLYING_CONTEXT_MENU_ID = "token-status/flying-context-menu";
const DEAD_CONTEXT_MENU_ID = "token-status/dead-context-menu";

export function setupContextMenu() {
  OBR.contextMenu.create({
    id: FLYING_CONTEXT_MENU_ID,
    icons: [
      {
        icon: "/fly.svg",
        label: "Fly",
        filter: {
          every: [
            { key: "layer", value: "CHARACTER" },
            {
              key: ["metadata", NS, "statuses", "flying", "active"],
              value: true,
              operator: "!=",
            },
          ],
        },
      },
      {
        icon: "/land.svg",
        label: "Land",
        filter: {
          every: [
            { key: "layer", value: "CHARACTER" },
            { key: ["metadata", NS, "statuses", "flying", "active"], value: true },
          ],
        },
      },
    ],
    async onClick(context) {
      const characterItems = context.items.filter(
        (item) => item?.layer === "CHARACTER",
      );

      if (characterItems.length === 0) return;

      const shouldFly = characterItems.every((item) => !isFlying(item));
      const targetItems = characterItems.filter((item) =>
        shouldFly ? !isFlying(item) : isFlying(item),
      );

      try {
        await toggleFlyingForItems(targetItems);
      } catch (error) {
        const details =
          error?.error?.message ??
          error?.message ??
          "Token Status failed to update this token.";

        console.error("Token Status context menu error", error);
        await OBR.notification.show(details, "ERROR");
      }
    },
  });

  OBR.contextMenu.create({
    id: DEAD_CONTEXT_MENU_ID,
    icons: [
      {
        icon: "/dead.svg",
        label: "Dead",
        filter: {
          every: [
            { key: "layer", value: "CHARACTER" },
            {
              key: ["metadata", NS, "statuses", "dead", "active"],
              value: true,
              operator: "!=",
            },
          ],
        },
      },
      {
        icon: "/revive.svg",
        label: "Revive",
        filter: {
          every: [
            { key: "layer", value: "CHARACTER" },
            { key: ["metadata", NS, "statuses", "dead", "active"], value: true },
          ],
        },
      },
    ],
    async onClick(context) {
      const characterItems = context.items.filter(
        (item) => item?.layer === "CHARACTER",
      );

      if (characterItems.length === 0) return;

      const shouldMarkDead = characterItems.every((item) => !isDead(item));
      const targetItems = characterItems.filter((item) =>
        shouldMarkDead ? !isDead(item) : isDead(item),
      );

      try {
        await toggleDeadForItems(targetItems);
      } catch (error) {
        const details =
          error?.error?.message ??
          error?.message ??
          "Token Status failed to update this token.";

        console.error("Token Status dead menu error", error);
        await OBR.notification.show(details, "ERROR");
      }
    },
  });
}
