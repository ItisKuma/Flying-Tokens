const ID = "simple-flying-v2"
const Z_MIN = 5
const Z_MAX = 60

let selected = null

OBR.onReady(() => {

  // Track selection
  OBR.player.onSelectionChange((items) => {
    selected = items[0] || null
  })

  // Toggle flying
  document.getElementById("toggle").onclick = async () => {
    if (!selected) return

    const [token] = await OBR.scene.items.getItems([selected])
    if (!token) return

    let meta = token.metadata[ID] || {
      flying: false,
      z: Z_MIN,
      shadowId: null,
      base: { x: token.position.x, y: token.position.y }
    }

    if (!meta.flying) {
      meta.flying = true
      meta.z = Z_MIN

      // Create silhouette (clone)
      const shadow = structuredClone(token)
      shadow.id = crypto.randomUUID()
      shadow.name = "Silhouette"
      shadow.opacity = 0.35
      shadow.tint = "#000000"

      shadow.metadata = {
        [ID]: { isShadow: true }
      }

      await OBR.scene.items.addItems([shadow])
      meta.shadowId = shadow.id

    } else {
      meta.flying = false

      if (meta.shadowId) {
        await OBR.scene.items.deleteItems([meta.shadowId])
      }

      meta.shadowId = null
      meta.z = 0
    }

    await OBR.scene.items.updateItems([token.id], items => {
      items[0].metadata[ID] = meta
    })

    updateVisual(token.id)
  }

  // Z slider
  document.getElementById("z").oninput = async (e) => {
    if (!selected) return

    const z = Number(e.target.value)

    await OBR.scene.items.updateItems([selected], items => {
      const t = items[0]
      const meta = t.metadata[ID]
      if (!meta || !meta.flying) return

      meta.z = z
      t.metadata[ID] = meta
    })

    updateVisual(selected)
  }
})


// 🔥 CORE VISUAL LOGIC
async function updateVisual(tokenId) {

  const [token] = await OBR.scene.items.getItems([tokenId])
  if (!token) return

  const meta = token.metadata[ID]
  if (!meta || !meta.flying) return

  const [shadow] = await OBR.scene.items.getItems([meta.shadowId])
  if (!shadow) return

  const t = (meta.z - Z_MIN) / (Z_MAX - Z_MIN)

  // ---- SHADOW (silhouette) ----
  const shadowScale = Math.max(0.4, 1 - t * 0.5)

  // ---- K-TOKEN ----
  const offset = t * 50

  const kScale = 1 + t * 0.2

  await OBR.scene.items.updateItems([token.id, shadow.id], items => {

    const k = items.find(i => i.id === token.id)
    const s = items.find(i => i.id === shadow.id)

    // 🔒 Shadow = grid truth (no movement)
    s.position.x = meta.base.x
    s.position.y = meta.base.y

    s.scale = { x: shadowScale, y: shadowScale }
    s.opacity = Math.max(0.15, 0.35 - t * 0.2)

    // 🧍 K-token (offset + perspective)
    k.position.x = meta.base.x - offset
    k.position.y = meta.base.y + offset

    k.scale = {
      x: kScale,
      y: kScale * 0.9 // oval squash
    }

    k.opacity = 1 - t * 0.15
  })
}
