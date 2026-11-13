import { init } from "./app.js?v=1";
import "./moon.js?v=1";
import "./data.js?v=1";
import { loadSummaries } from "./ask.js?v=1";
import { loadApplications } from "./equipment.js?v=1";
init([loadSummaries, loadApplications]).catch((e) => { document.getElementById("view-overview").textContent = "Could not load the knowledge base: " + e.message; });
