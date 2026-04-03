import OBR from "https://unpkg.com/@owlbear-rodeo/sdk@latest";
import { toggleFlying } from "./flying.js";

OBR.onReady(() => {
  const btn = document.getElementById("toggle-flying");
  if (btn) {
    btn.addEventListener("click", toggleFlying);
  }
});