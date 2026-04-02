import OBR from "https://unpkg.com/@owlbear-rodeo/sdk?module";

const ID = "simple-flying";

// 🔁 Opdater UI listen
export async function updateFlyingList() {

  // Hent alle items i scenen
  const items = await OBR.scene.items.getItems();

  // Filtrer kun tokens med flying = true
  const flying = items.filter(i => i.metadata?.[ID]?.flying);

  const list = document.getElementById("flying-list");

  // Ryd UI
  list.innerHTML = "";

  // Loop gennem flying tokens
  flying.forEach(token => {

    const meta = token.metadata[ID];

    const li = document.createElement("li");

    // Navn fallback hvis token ikke har navn
    const name = token.name || "Token";

    li.textContent = `${name} (${meta.z} ft)`;

    list.appendChild(li);
  });
}
