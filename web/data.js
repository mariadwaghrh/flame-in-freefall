// Test data explorer: every PSI experimental table, plotted and downloadable with normalised columns.
// Serves the challenge goal "extract data that supports predictive modelling of flammability".
import { h, mount, scatterChart, legend, GROUP_COLORS } from "./charts.js?v=1";
import { state, L, AR, RENDER, api, fuel, short, num, ltr, openDrawer } from "./app.js?v=1";

const st = { acc: "PSI-69", table: 0, x: null, y: null, q: "" };
const cache = {};
const NORM = { o2_pct: ["الأكسجين (%)", "O2 (%)"], pressure_atm: ["الضغط (atm)", "Pressure (atm)"], flow_cms: ["التدفق (سم/ث)", "Flow (cm/s)"],
  co2_pct: ["CO2 مخفّف (%)", "CO2 diluent (%)"], he_pct: ["هيليوم مخفّف (%)", "He diluent (%)"] };
const nl = (k) => NORM[k][AR() ? 0 : 1];
const isNum = (v) => /^-?\d+(\.\d+)?$/.test(v);

async function render() {
  const root = document.getElementById("view-data");
  const withTables = state.catalog.filter((i) => i.tables.length);
  if (!cache[st.acc]) { mount(root, h("div", { class: "card empty", text: L("جاري تحميل الجدول…", "Loading table…") })); cache[st.acc] = await api(`/api/tables/${st.acc}`); }
  const tabs = cache[st.acc], t = tabs[Math.min(st.table, tabs.length - 1)], inv = state.byAcc[st.acc];
  const normKeys = Object.keys(NORM).filter((k) => t.norm.some((r) => r[k] != null));
  const hasFuel = t.norm.some((r) => r.fuel), hasOutcome = t.outcome_columns.length > 0;
  const axes = normKeys.map((k) => ({ id: "n:" + k, label: nl(k), get: (i) => t.norm[i][k] }));
  t.headers.forEach((hd, ci) => {
    const vals = t.rows.map((r) => r[ci]).filter(Boolean), nums = vals.filter(isNum);
    if (vals.length >= 5 && nums.length / vals.length >= 0.7 && new Set(nums).size >= 5 && !/test|day|date|gmt|sample|frames|number|identifier/i.test(hd))
      axes.push({ id: "c:" + ci, label: hd, get: (i) => (isNum(t.rows[i][ci]) ? Number(t.rows[i][ci]) : null) });
  });
  if (!axes.find((a) => a.id === st.x)) st.x = axes[0] && axes[0].id;
  if (!axes.find((a) => a.id === st.y) || st.y === st.x) st.y = (axes.find((a) => a.id !== st.x) || {}).id;
  const ax = axes.find((a) => a.id === st.x), ay = axes.find((a) => a.id === st.y);
  const q = st.q.toLowerCase();
  const idx = t.rows.map((_, i) => i).filter((i) => !q || (t.rows[i].join(" ") + " " + (t.norm[i].fuel || "") + " " + fuel(t.norm[i].fuel || "")).toLowerCase().includes(q));
  const groups = t.fuels.map((f) => f[0]), chartBox = h("div", { class: "chart" });
  const sel = (label, value, options, onchange) => h("label", { class: "field" }, h("span", { text: label }),
    h("select", { onchange: (e) => onchange(e.target.value) }, options.map(([v, text]) => h("option", { value: v, text, selected: String(v) === String(value) }))));
  const search = h("input", { type: "search", value: st.q, placeholder: L("methanol، Extinction…", "methanol, Extinction…"), "aria-label": L("تصفية الصفوف", "Filter rows") });
  search.addEventListener("change", () => { st.q = search.value; render(); });

  const download = () => {
    const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const head = [...t.headers, ...(hasFuel ? ["fuel_normalized"] : []), ...normKeys, ...(hasOutcome ? ["outcome"] : [])];
    const lines = idx.map((i) => [...t.rows[i], ...(hasFuel ? [t.norm[i].fuel || ""] : []), ...normKeys.map((k) => t.norm[i][k] ?? ""),
      ...(hasOutcome ? [Object.entries(t.norm[i].outcome || {}).map(([k, v]) => `${k}=${v}`).join("; ")] : [])].map(esc).join(","));
    const url = URL.createObjectURL(new Blob(["﻿" + head.map(esc).join(",") + "\n" + lines.join("\n")], { type: "text/csv" }));
    const a = h("a", { href: url, download: `${st.acc}_${t.label.replace(/\W+/g, "_")}_normalized.csv` });
    document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  const shown = idx.slice(0, 300);
  mount(root,
    h("div", { class: "inv-filters" },
      sel(L("التجربة", "Investigation"), st.acc, withTables.map((i) => [i.acc, `${short(i)} (${i.tables.reduce((n, x) => n + x.n_rows, 0)})`]), (v) => { st.acc = v; st.table = 0; st.x = st.y = null; st.q = ""; render(); }),
      tabs.length > 1 && sel(L("الجدول", "Table"), st.table, tabs.map((x, i) => [i, x.label]), (v) => { st.table = Number(v); st.x = st.y = null; render(); }),
      h("label", { class: "field" }, h("span", { text: L("تصفية الصفوف", "Filter rows") }), search),
      h("div", { class: "count" }, h("button", { class: "btn small", text: L(`تنزيل ${idx.length} صفاً CSV`, `Download ${idx.length} rows as CSV`), onclick: download }))),
    h("div", { class: "card" },
      h("div", { class: "card-head" }, h("div", {}, h("h3", {}, short(inv), ": ", ltr(t.label)),
        h("div", { class: "sub", text: L(`${t.n_rows} صفاً من جدول ناسا (ترخيص CC0). الأعمدة الملوّنة قيم موحّدة أضافها الموقع للنمذجة.`, `${t.n_rows} rows from NASA's table (CC0). Shaded columns are normalised values added for modelling.`) })),
        h("button", { class: "btn small", text: L("تفاصيل التجربة", "Investigation details"), onclick: () => openDrawer(st.acc) })),
      t.notes.map((n) => h("div", { class: "warn", style: "margin-bottom:8px", text: L("ملاحظة عن البيانات: ", "Data note: ") + n })),
      ax && ay ? [h("div", { class: "inv-filters", style: "margin-bottom:8px" },
          sel(L("المحور الأفقي", "Horizontal axis"), st.x, axes.map((a) => [a.id, a.label]), (v) => { st.x = v; render(); }),
          sel(L("المحور العمودي", "Vertical axis"), st.y, axes.map((a) => [a.id, a.label]), (v) => { st.y = v; render(); })),
        hasFuel && groups.length > 1 && legend([...groups.slice(0, 3).map((g, i) => [fuel(g), GROUP_COLORS[i]]), ...(groups.length > 3 ? [[L("وقود آخر", "Other fuels"), "var(--deemph)"]] : [])]),
        chartBox] : h("div", { class: "sub", text: L("أقل من عمودين رقميين في هذا الجدول، فلا يوجد ما يُرسم.", "Fewer than two numeric columns, so there is nothing to plot.") })),
    h("div", { class: "card" },
      h("div", { class: "sub", style: "margin-bottom:8px", text: L(`يُعرض ${shown.length} من ${idx.length}.`, `Showing ${shown.length} of ${idx.length}.`) }),
      h("div", { class: "table-wrap" }, h("table", { class: "data" },
        h("thead", {}, h("tr", {}, hasFuel && h("th", { class: "norm", text: L("الوقود (موحّد)", "Fuel (normalised)") }), normKeys.map((k) => h("th", { class: "norm", text: nl(k) })),
          hasOutcome && h("th", { class: "norm", text: L("النتيجة", "Outcome") }), t.headers.map((x) => h("th", { text: x })))),
        h("tbody", {}, shown.map((i) => h("tr", {}, hasFuel && h("td", { class: "norm", text: fuel(t.norm[i].fuel || "") }),
          normKeys.map((k) => h("td", { class: "norm", text: t.norm[i][k] ?? "" })),
          hasOutcome && h("td", { class: "norm", text: Object.values(t.norm[i].outcome || {}).join(" · ") }),
          t.rows[i].map((v) => h("td", { text: v })))))))),
  );
  if (ax && ay) {
    const pts = idx.map((i) => ({ x: ax.get(i), y: ay.get(i), group: t.norm[i].fuel || "n/a", groupLabel: fuel(t.norm[i].fuel || "n/a"), label: t.rows[i].slice(0, 2).filter(Boolean).join(" · ") })).filter((p) => p.x != null && p.y != null);
    if (pts.length) scatterChart(chartBox, pts, { xLabel: ax.label, yLabel: ay.label, groups, refX: st.x === "n:o2_pct" ? { value: 30, label: L("القاعدة القمرية ≥30%", "Moon base ≥30%") } : null });
  }
}
RENDER.data = render;
export function openData(acc) { st.acc = acc; st.table = 0; st.x = st.y = null; st.q = ""; }
