<<<<<<< HEAD
import OBR from "@owlbear-rodeo/sdk";
=======
import OBR from "https://unpkg.com/@owlbear-rodeo/sdk?module";
>>>>>>> 663484910b30287bb66b34542176094f2176fa07

const ID = "simple-flying";

export async function rebuildFlyingList() {

  const container = document.getElementById("list");
<<<<<<< HEAD
  if (!container) return;

=======
>>>>>>> 663484910b30287bb66b34542176094f2176fa07
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
<<<<<<< HEAD
}
=======
}
>>>>>>> 663484910b30287bb66b34542176094f2176fa07
