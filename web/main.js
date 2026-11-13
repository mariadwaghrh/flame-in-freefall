// Entry point: loads the core app, then each feature module registers its view.
import { init } from "./app.js?v=1";
import "./moon.js?v=1";
import "./data.js?v=1";
import { loadSummaries } from "./ask.js?v=1";

init([loadSummaries]).catch((e) => {
  document.getElementById("view-overview").textContent = "Could not load the knowledge base: " + e.message;
});
