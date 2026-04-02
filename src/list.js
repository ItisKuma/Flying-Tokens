import OBR from "https://unpkg.com/@owlbear-rodeo/sdk?module";

const ID = "simple-flying";

export async function rebuildFlyingList() {

  const container = document.getElementById("list");
  container.innerHTML = "";

  const items = await OBR.scene.items.getItems();

  const flying = items.filter(i =>
    i.metadata?.[ID]?.flying
  );

  flying.forEach(item => {

    const meta = item.metadata[ID];

    const div = document.createElement("div");
    div.textContent = `${item.name} — ${meta.z} ft`;

    container.appendChild(div);
  });
}
