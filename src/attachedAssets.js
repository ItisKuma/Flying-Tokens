import OBR from "@owlbear-rodeo/sdk";

export async function refreshAllAttachedAssets() {
  let items = [];

  try {
    items = await OBR.scene.items.getItems();
  } catch {
    return;
  }

  const [
    { upsertLocalDeadLabelsForItems },
    { syncLocalFlyingLabels },
    { syncLocalShadows },
  ] = await Promise.all([
    import("./deadLabel.js"),
    import("./flyingLabel.js"),
    import("./shadow.js"),
  ]);

  await upsertLocalDeadLabelsForItems(items);
  await syncLocalFlyingLabels(items);
  await syncLocalShadows(items);
}
