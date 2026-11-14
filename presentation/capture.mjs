// Capture screenshots of the running site for slides (node presentation/capture.mjs).
// Drives headless Edge over the DevTools protocol; needs the site running on http://localhost:8001 and Node 22+.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const EDGE = process.env.BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = process.env.SITE || "http://localhost:8001";
const LANG = process.env.LANG_SHOTS || "en";                     // LANG_SHOTS=ar for Arabic screenshots
const OUT = join(dirname(fileURLToPath(import.meta.url)), "assets", LANG === "en" ? "" : LANG);
const PORT = 9333, W = 1600, H = 900;
const SHOTS = [                                  // [file name, url, wait ms, optional script to run first]
  ["scene-1-flame", "/?lang=en&scene=flame#story", 9000],
  ["scene-2-apollo", "/?lang=en&scene=apollo#story", 3000],
  ["scene-3-mir", "/?lang=en&scene=mir#story", 3000],
  ["scene-4-moon", "/?lang=en&scene=moon#story", 3500],
  ["scene-5-data", "/?lang=en&scene=data#story", 5000],
  ["scene-6-gap", "/?lang=en&scene=gap#story", 3500],
  ["scene-7-how", "/?lang=en&scene=how#story", 4500],
  ["scene-8-proof", "/?lang=en&scene=proof#story", 3500],
  ["scene-9-honest", "/?lang=en&scene=honest#story", 3500],
  ["scene-10-next", "/?lang=en&scene=next#story", 3500],
  ["page-moon", "/?lang=en#moon", 3500],
  ["page-equipment", "/?lang=en#equipment", 3500],
  ["page-investigations", "/?lang=en#investigations", 3500],
  ["page-data", "/?lang=en#data", 4500],
  ["page-ask", "/?lang=en#ask", 3500, "document.querySelector('.eval') && (document.querySelector('.eval').open = true)"],
  ["page-overview", "/?lang=en#overview", 3500],
  ["page-home", "/?lang=en#home", 3500],
  ["page-moon-plan", "/?lang=en#moon", 3500, "document.querySelector('.next-card').scrollIntoView({ block: 'start' })"],
  ["page-moon-card", "/?lang=en#moon", 3500, "document.querySelector('.o2-card').scrollIntoView({ block: 'center' })"],
  ["page-ask-answer", "/?lang=en#ask", 3500, "(async () => { document.querySelectorAll('#view-ask .chip.btn')[2].click(); })()"],
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), "trustflame-capture")}`,
  `--window-size=${W},${H}`, "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required", "about:blank"], { stdio: "ignore" });
try {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page"); } catch { /* not up yet */ }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (m) => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } });
  const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  for (const [name, path, wait, script] of SHOTS) {
    await send("Page.navigate", { url: "about:blank" });
    await send("Page.navigate", { url: BASE + path.replace("lang=en", "lang=" + LANG) });
    await sleep(wait);
    if (script) { await send("Runtime.evaluate", { expression: script }); await sleep(500); }
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(OUT, name + ".png"), Buffer.from(data, "base64"));
    console.log("saved", name + ".png");
  }
  ws.close();
} finally {
  edge.kill();
}
