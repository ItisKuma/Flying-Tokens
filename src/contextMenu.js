import OBR from "@owlbear-rodeo/sdk";
import { isFlying, toggleFlyingForItems } from "./flying.js";

const CONTEXT_MENU_ID = "simple-flying/context-menu";

export function setupContextMenu() {
  OBR.contextMenu.create({
    id: CONTEXT_MENU_ID,
    icons: [
      {
        icon: "/fly.svg",
        label: "Fly",
        filter: {
          every: [
            { key: "layer", value: "CHARACTER" },
            {
              key: ["metadata", "simple-flying", "flying"],
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
            { key: ["metadata", "simple-flying", "flying"], value: true },
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
          "Simple Flying failed to update this token.";

        console.error("Simple Flying context menu error", error);
        await OBR.notification.show(details, "ERROR");
      }
    },
  });
}
