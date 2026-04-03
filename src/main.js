import OBR from "@owlbear-rodeo/sdk";
import { toggleFlying } from "./flying.js";

OBR.onReady(() => {
  const btn = document.getElementById("toggle-flying");
  if (btn) {
    btn.addEventListener("click", toggleFlying);
  }
});