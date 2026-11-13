// DOM + SVG helpers and charts. No libraries, works offline.
// All text is inserted with textContent: names and table cells are data, never HTML.

let LANG = "ar";
export function setChartLang(lang) { LANG = lang; }
const T = (ar, en) => (LANG === "en" ? en : ar);

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style") el.style.cssText = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}
export function mount(el, ...children) { el.replaceChildren(); append(el, children); return el; }

const NS = "http://www.w3.org/2000/svg";
function s(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) (k === "text" ? (el.textContent = v) : el.setAttribute(k, v));
  return el;
}

// one shared tooltip: value first, label second
export function showTip(evt, title, rows = []) {
  const el = document.getElementById("tooltip");
  mount(el, h("div", { class: "t-title", text: title }),
    rows.filter((r) => r && r[1] != null && r[1] !== "").map(([l, v]) => h("div", { class: "t-row" }, h("span", { text: l }), h("b", { text: v }))));
  el.hidden = false;
  const r = el.getBoundingClientRect(), pad = 14;
  let x = evt.clientX + pad, y = evt.clientY + pad;
  if (x + r.width > innerWidth - 8) x = evt.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = evt.clientY - r.height - pad;
  el.style.left = Math.max(8, x) + "px"; el.style.top = Math.max(8, y) + "px";
}
export function hideTip() { document.getElementById("tooltip").hidden = true; }
function hover(node, title, rows) {
  node.addEventListener("pointermove", (e) => showTip(e, title, rows));
  node.addEventListener("pointerleave", hideTip);
  node.addEventListener("focus", () => { const b = node.getBoundingClientRect(); showTip({ clientX: b.right - 20, clientY: b.top }, title, rows); });
  node.addEventListener("blur", hideTip);
}
function clickable(g, fn) {
  if (!fn) return;
  g.addEventListener("click", fn);
  g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } });
}

export const fmt = (v, d = 1) => (v == null ? "" : String(Number(v.toFixed(d))));
export function fmtRange(r, unit = "", d = 1) {
  if (!r) return null;
  const a = fmt(r[0], d), b = fmt(r[1], d);
  return a === b ? a + unit : `${a}–${b}${unit}`;
}
export function legend(items) {
  return h("div", { class: "legend" }, items.map(([label, color]) => h("span", {}, h("i", { style: `background:${color}` }), label)));
}
function ticks(lo, hi, n = 5) {
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((st) => (hi - lo) / st <= n) || p * 10;
  const out = [];
  for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.999; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

// Oxygen tested per investigation: a range bar per row against Earth (21%) and Moon base (30%) lines.
// Emphasis form: rows that reach the selected environment's O2 window are blue, the rest grey.
export function o2Chart(box, rows, { win, onPick }) {
  const W = Math.max(320, box.clientWidth), left = Math.min(170, W * 0.34), right = 44, top = 48, rowH = 26, bottom = 30;
  const H = top + rows.length * rowH + bottom, x = (v) => left + ((W - left - right) * v) / 100;
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": T("نطاق الأكسجين المختبر لكل تجربة", "Oxygen range tested by each investigation") });
  svg.append(s("rect", { x: x(win[0]), y: top - 4, width: x(Math.min(100, win[1])) - x(win[0]), height: rows.length * rowH + 8, fill: "var(--s1)", opacity: 0.08, rx: 4 }));
  for (const t of [0, 20, 40, 60, 80, 100]) {
    svg.append(s("line", { class: "gridline", x1: x(t), x2: x(t), y1: top - 4, y2: H - bottom + 4 }));
    svg.append(s("text", { class: "tick", x: x(t), y: H - bottom + 20, "text-anchor": "middle", text: t + "%" }));
  }
  [[21, T("هواء الأرض والمحطة 21%", "Earth / ISS air, 21%")], [30, T("القاعدة القمرية ≥30%", "Moon base, ≥30%")]].forEach(([o2, label], i) => {
    svg.append(s("line", { class: "ref", x1: x(o2), x2: x(o2), y1: 16 + i * 16, y2: H - bottom + 4 }));
    svg.append(s("text", { class: "ref-label", x: x(o2) + 5, y: 14 + i * 16, text: label }));
  });
  rows.forEach((d, i) => {
    const y = top + i * rowH + rowH / 2, [a, b] = d.o2_range, inside = d.o2_values.some((v) => v >= win[0] && v <= win[1]);
    const c = inside ? "var(--s1)" : "var(--deemph)";
    const g = s("g", { tabindex: 0, role: "button", "aria-label": `${d.label}: ${fmtRange(d.o2_range, "%")}` });
    g.append(s("rect", { class: "hl", x: 0, y: y - rowH / 2, width: W, height: rowH, rx: 4 }));
    g.append(s("text", { class: "name", x: left - 10, y: y + 4, "text-anchor": "end", text: d.label }));
    if (b - a > 0.6) g.append(s("rect", { x: x(a), y: y - 4, width: Math.max(2, x(b) - x(a)), height: 8, rx: 4, fill: c }));
    g.append(s("circle", { class: "dot", cx: x(a), cy: y, r: 5, fill: c }));
    if (b - a > 0.6) g.append(s("circle", { class: "dot", cx: x(b), cy: y, r: 5, fill: c }));
    g.append(s("text", { x: x(b) + 10, y: y + 4, text: fmt(b, 0) + "%" }));
    g.append(s("rect", { class: "hit", x: 0, y: y - rowH / 2, width: W, height: rowH }));
    hover(g, d.label, [[T("الأكسجين المختبر", "O2 tested"), fmtRange(d.o2_range, "%")], [T("عدد الاختبارات", "Test rows"), String(d.n_tests)], [T("ضمن نطاق البيئة", "In the window"), inside ? T("نعم", "yes") : T("لا", "no")]]);
    clickable(g, onPick && (() => onPick(d)));
    svg.append(g);
  });
  box.replaceChildren(svg);
}

// Ranked horizontal bars, one hue (magnitude, not identity). Square at the baseline, 4px rounded end.
export function barsChart(box, rows, { onPick, tip } = {}) {
  const W = Math.max(300, box.clientWidth), left = Math.min(170, W * 0.36), right = 56, rowH = 24, H = rows.length * rowH + 10;
  const max = Math.max(...rows.map((r) => r.value), 1), x = (v) => ((W - left - right) * v) / max;
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": T("أعمدة مرتبة", "Ranked bars") });
  svg.append(s("line", { class: "axis", x1: left, x2: left, y1: 4, y2: H - 4 }));
  rows.forEach((d, i) => {
    const y = 4 + i * rowH + rowH / 2, w = Math.max(2, x(d.value));
    const g = s("g", { tabindex: 0, role: "button", "aria-label": `${d.label}: ${d.value}` });
    g.append(s("rect", { class: "hl", x: 0, y: y - rowH / 2, width: W, height: rowH, rx: 4 }));
    g.append(s("text", { class: "name", x: left - 10, y: y + 4, "text-anchor": "end", text: d.label }));
    g.append(s("path", { d: `M${left},${y - 6} h${Math.max(0, w - 4)} a4,4 0 0 1 4,4 v4 a4,4 0 0 1 -4,4 h${-Math.max(0, w - 4)} z`, fill: "var(--s1)" }));
    g.append(s("text", { x: left + w + 8, y: y + 4, text: d.value.toLocaleString("en-US") }));
    g.append(s("rect", { class: "hit", x: 0, y: y - rowH / 2, width: W, height: rowH }));
    hover(g, d.label, tip ? tip(d) : [[T("القيمة", "Value"), String(d.value)]]);
    clickable(g, onPick && (() => onPick(d)));
    svg.append(g);
  });
  box.replaceChildren(svg);
}

// Scatter of test rows; identity by fuel with at most three hues + grey "other" (all-pairs safe).
export const GROUP_COLORS = ["var(--s1)", "var(--s2)", "var(--s3)"];
export function scatterChart(box, pts, { xLabel, yLabel, groups, refX }) {
  const W = Math.max(320, box.clientWidth), H = Math.min(420, Math.max(280, W * 0.5)), m = { l: 56, r: 18, t: 14, b: 44 };
  const xt = ticks(Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x)));
  const yt = ticks(Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.y)));
  const X = (v) => m.l + ((W - m.l - m.r) * (v - xt[0])) / (xt[xt.length - 1] - xt[0] || 1);
  const Y = (v) => H - m.b - ((H - m.t - m.b) * (v - yt[0])) / (yt[yt.length - 1] - yt[0] || 1);
  const color = (g) => { const i = groups.indexOf(g); return i >= 0 && i < 3 ? GROUP_COLORS[i] : "var(--deemph)"; };
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": `${yLabel} / ${xLabel}` });
  for (const t of yt) { svg.append(s("line", { class: "gridline", x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t) })); svg.append(s("text", { class: "tick", x: m.l - 8, y: Y(t) + 4, "text-anchor": "end", text: t })); }
  for (const t of xt) svg.append(s("text", { class: "tick", x: X(t), y: H - m.b + 18, "text-anchor": "middle", text: t }));
  svg.append(s("line", { class: "axis", x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b }));
  svg.append(s("text", { x: (m.l + W - m.r) / 2, y: H - 6, "text-anchor": "middle", text: xLabel }));
  svg.append(s("text", { x: 14, y: (m.t + H - m.b) / 2, "text-anchor": "middle", transform: `rotate(-90 14 ${(m.t + H - m.b) / 2})`, text: yLabel }));
  if (refX && refX.value >= xt[0] && refX.value <= xt[xt.length - 1]) {
    svg.append(s("line", { class: "ref", x1: X(refX.value), x2: X(refX.value), y1: m.t, y2: H - m.b }));
    svg.append(s("text", { class: "ref-label", x: X(refX.value) + 5, y: m.t + 10, text: refX.label }));
  }
  const dots = pts.map((p) => { const c = s("circle", { class: "dot", cx: X(p.x), cy: Y(p.y), r: 4.5, fill: color(p.group) }); svg.append(c); return c; });
  const hit = s("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: "transparent" });
  let last = -1;   // nearest-point hover: the pointer only has to be closest
  hit.addEventListener("pointermove", (e) => {
    const b = svg.getBoundingClientRect(), k = W / b.width, px = (e.clientX - b.left) * k, py = (e.clientY - b.top) * k;
    let best = -1, bd = 1600;
    pts.forEach((p, i) => { const d = (X(p.x) - px) ** 2 + (Y(p.y) - py) ** 2; if (d < bd) { bd = d; best = i; } });
    if (last >= 0) dots[last].setAttribute("r", 4.5);
    if (best < 0) { hideTip(); last = -1; return; }
    dots[best].setAttribute("r", 6.5); last = best;
    showTip(e, pts[best].label, [[yLabel, String(pts[best].y)], [xLabel, String(pts[best].x)], [T("الوقود", "Fuel"), pts[best].groupLabel]]);
  });
  hit.addEventListener("pointerleave", () => { hideTip(); if (last >= 0) dots[last].setAttribute("r", 4.5); last = -1; });
  svg.append(hit);
  box.replaceChildren(svg);
}
