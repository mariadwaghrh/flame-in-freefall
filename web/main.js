// Entry point: loads the core app, then each feature module registers its view.
import { init } from "./app.js?v=1";

init().catch((e) => {
  document.getElementById("view-overview").textContent = "Could not load the knowledge base: " + e.message;
});
