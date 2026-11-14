import { h, mount, showTip, hideTip, fmt, fmtRange, legend, o2Chart, barsChart, setChartLang } from "./charts.js?v=1";

// ======================================================================
// TrustFlame front end. Bilingual: L(ar, en) returns the text for the current language.
// NASA's own text (objectives, table columns, evidence) is English and shown left-to-right.
// ======================================================================
const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
export const state = {
  lang: ["ar", "en"].includes(qs.get("lang")) ? qs.get("lang") : localStorage.getItem("lang") || "ar",
  meta: null, catalog: [], byAcc: {}, materials: [], view: "home", scenario: "lunar_base",
  static: false, status: null,                          // static = no Python server behind the page (set in init)
  filters: { q: "", pillar: "", phase: "", tier: "", kind: "" },
};
export const L = (ar, en) => (state.lang === "en" ? en : ar);
export const AR = () => state.lang === "ar";

const CHROME = {
  brand_sub: ["لهب في السقوط الحر · تحدي ناسا Space Apps 2026", "Flame in Freefall · NASA Space Apps Challenge 2026"],
  tab_overview: ["نظرة عامة", "Overview"], tab_investigations: ["التجارب", "Investigations"], tab_moon: ["جاهزية القمر", "Moon readiness"],
  tab_story: ["القصة", "Story"], tab_home: ["الرئيسية", "Home"],
  tab_equipment: ["المعدّات", "Equipment"], tab_data: ["البيانات", "Data"], tab_ask: ["اسأل", "Ask"],
  scenario_label: ["بيئة الطاقم", "Crew environment"],
};
const PART_COLORS = { directness: "var(--s1)", semantic: "var(--s2)", conditions: "var(--s3)", data: "var(--s4)" };
const PARTS = { directness: ["الصلة المباشرة (40)", "Directness (40)"], semantic: ["التطابق في المعنى (30)", "Semantic match (30)"],
  conditions: ["ظروف الاختبار (20)", "Test conditions (20)"], data: ["غنى البيانات (10)", "Data richness (10)"] };
const TIERS = { direct: ["صلة مباشرة", "direct relevance"], related: ["صلة مرتبطة", "related"], indirect: ["صلة غير مباشرة", "indirect"] };
const PHASES = { solid: ["وقود صلب", "solid fuel"], liquid: ["وقود سائل", "liquid fuel"], gas: ["وقود غازي", "gaseous fuel"], aerosol: ["هباء جوي", "aerosol"] };
const pick = (pair) => (pair ? pair[AR() ? 0 : 1] : "");
const FUEL_AR = {
  "PMMA (acrylic)": "PMMA (أكريليك)", "SIBAL cotton-fiberglass fabric": "قماش SIBAL (قطن وألياف زجاجية)", "Silicone": "سيليكون", "Teflon": "تفلون",
  "Pyrell foam": "رغوة Pyrell", "Lamp wick": "فتيل مصباح", "Cotton / cellulose": "قطن / سليلوز", "Wax (candle)": "شمع", "Dibutyl phthalate": "ثنائي بوتيل الفثالات",
  "Methanol": "ميثانول", "Ethanol": "إيثانول", "Propanol": "بروبانول", "Glycerol": "غليسرول", "Iso-octane": "أيزو-أوكتان", "n-Octane": "أوكتان",
  "n-Heptane": "هبتان", "n-Dodecane / iso-dodecane blend": "خليط دوديكان", "n-Dodecane": "دوديكان", "n-Decane": "ديكان", "Ethylene": "إيثيلين",
  "Methane": "ميثان", "Propylene": "بروبيلين", "Propane": "بروبان", "n-Butane": "بيوتان", "Ethane": "إيثان", "n-Pentane": "بنتان",
  "Hydrogen": "هيدروجين", "Arizona road dust (aerosol)": "غبار طرق أريزونا",
};
export const fuel = (f) => (AR() ? f.split(" + ").map((x) => FUEL_AR[x] || x).join(" + ") : f);
const MEAS_AR = {
  "Video / still imaging": "تصوير فيديو وصور", "Radiometry (flame radiation)": "قياس إشعاع اللهب", "Thin-filament pyrometry": "قياس الحرارة بالخيوط الرفيعة",
  "Thermocouples": "مزدوجات حرارية", "PLIF laser diagnostics": "تشخيص بالليزر (PLIF)", "Chemiluminescence": "التألق الكيميائي",
  "Soot / smoke-point measurements": "قياسات السخام ونقطة الدخان", "Gas composition (O2 / CO2 / CO)": "تركيب الغازات (O2 / CO2 / CO)",
  "Aerosol particle instruments": "أجهزة عدّ جسيمات الهباء", "TEM particle sampling": "عيّنات بالمجهر الإلكتروني", "Ion current": "تيار الأيونات",
  "Burning rate": "معدل الاحتراق", "Flame spread rate": "معدل انتشار اللهب", "Extinction / flammability limits": "حدود الانطفاء والاشتعال",
  "Heat flux": "التدفق الحراري", "Mass loss rate": "معدل فقدان الكتلة", "Flame lift-off / stability": "انفصال اللهب واستقراره",
};
const meas = (m) => (AR() ? MEAS_AR[m] || m : m);
const PLATFORM_AR = { "International Space Station (ISS)": "محطة الفضاء الدولية (ISS)", "Cygnus Spacecraft": "مركبة الشحن Cygnus", "Not Applicable": "لا ينطبق" };
const TYPE_AR = { "Microgravity Investigation": "تجربة في الجاذبية الصغرى", "Ground Investigation": "دراسة أرضية" };
function noteText(n) {
  if (!AR()) return n;
  if (/auto-fill/.test(n)) return "في ملف PSI أخطاء تعبئة تلقائية في عمود الوقود (CH4 صارت CH5 وCH6...). قُرئت كميثان وإيثيلين، الوقودين المذكورين في أهداف التجربة.";
  if (/shape/.test(n)) return `${(n.match(/\d+/) || [""])[0]} صفاً تصف العينة بشكلها فقط (قضيب، كرة، غشاء). جُمعت مع PMMA، المادة المذكورة في الصفوف المجاورة ومنشورات BASS.`;
  if (/subscripts/.test(n)) return "فقدت عناوين الأعمدة أرقامها السفلية: 'O' و'N' و'CO' تعني O2 وN2 وCO2 (خففت FLEX الجو بثاني أكسيد الكربون والهيليوم).";
  return n;
}

// ---------- helpers ----------
export async function api(path, opts) {
  path = path.replace(/^\//, "");                       // relative, so the site also works under a sub-path
  if (state.static) {                                   // public copy without the Python server: read the exported JSON files
    if (opts && opts.method === "POST") throw new Error(L("هذه النسخة العامة تعمل بلا نموذج محلي. شغّل المشروع على حاسوبك (الخطوات في README).", "This public copy runs without the local model. Run the project on your computer (steps in the README)."));
    path = path.split("?")[0] + ".json";
  }
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}
export const ltr = (text) => h("span", { class: "ltr", dir: "ltr", text });
export const num = (v) => (v == null ? "" : Number(v).toLocaleString("en-US"));
export const short = (inv) => (AR() && inv.short_ar) || inv.short;
export const title = (inv) => (AR() ? inv.ar_title : inv.title);
const desc = (inv) => (AR() ? inv.ar : (inv.objective || "").replace(/\s+/g, " ").slice(0, 320).replace(/\s\S*$/, "…"));
const scenario = () => state.meta.scenarios.find((s) => s.id === state.scenario);
const sc = () => scenario()[state.lang];
const score = (inv) => inv.scores[state.scenario];
const ranked = (list = state.catalog) => [...list].sort((a, b) => score(b).total - score(a).total);
export const pillarName = (p) => state.meta.pillars[p][state.lang].split(":")[0];
const nameStyle = () => `text-align:${AR() ? "right" : "left"}`;

function conditionsText(inv) {
  const [lo, hi] = scenario().o2, inside = score(inv).o2_inside, top = Math.min(100, hi);
  let s = !inv.o2_values.length ? L("لا يوجد عمود أكسجين في جدول PSI", "no O2 column in the PSI table")
    : inside ? L(`${inside} حالة اختبار ضمن نطاق ${lo}–${top}% أكسجين`, `${inside} test conditions inside the ${lo}–${top}% O2 window`)
    : L(`الأكسجين المختبر (${fmtRange(inv.o2_range, "%")}) خارج نطاق هذه البيئة`, `O2 tested (${fmtRange(inv.o2_range, "%")}) is outside this window`);
  return s + (inv.flow_range ? L("، وفيها بيانات تدفق", "; has flow data") : "");
}
function scoreBar(inv, withNum = true) {
  const s = score(inv);
  const el = h("div", { class: "score" },
    h("div", { class: "seg", role: "img", "aria-label": L(`الدرجة ${fmt(s.total, 0)} من 100`, `Score ${fmt(s.total, 0)} of 100`) },
      Object.entries(s.parts).map(([k, v]) => h("i", { style: `width:${v}%;background:${PART_COLORS[k]}` }))),
    withNum && h("div", { class: "score-num", text: fmt(s.total, 0) }));
  el.addEventListener("pointermove", (e) => showTip(e, `${short(inv)}: ${fmt(s.total, 0)} / 100`,
    [...Object.entries(s.parts).map(([k, v]) => [pick(PARTS[k]), fmt(v, 1)]), [L("الظروف", "Conditions"), conditionsText(inv)]]));
  el.addEventListener("pointerleave", hideTip);
  return el;
}
const scoreLegend = () => legend(Object.keys(PARTS).map((k) => [pick(PARTS[k]), PART_COLORS[k]]));
function chips(inv) {
  return h("div", { class: "chips" },
    h("span", { class: `chip tier ${inv.tier}`, text: pick(TIERS[inv.tier]) }),
    inv.pillars.map((p) => h("span", { class: "chip", text: pillarName(p) })),
    inv.phase.map((p) => h("span", { class: "chip", text: pick(PHASES[p]) })),
    h("span", { class: "chip", text: inv.kind === "ground" ? L("دراسة أرضية", "ground study") : L("تجربة في الفضاء", "flight experiment") }));
}
const kpi = (label, value, hint) => h("div", { class: "kpi" }, h("div", { class: "label", text: label }), h("div", { class: "value", text: value }), h("div", { class: "hint", text: hint }));

// ---------- overview ----------
function renderOverview() {
  const root = $("view-overview"), st = state.meta.stats, cat = state.catalog;
  const withO2 = cat.filter((i) => i.o2_range).sort((a, b) => b.o2_range[1] - a.o2_range[1]);
  const high = withO2.filter((i) => i.o2_range[1] >= 30);
  const solids = state.materials.filter((m) => m.phase === "solid" && m.o2_max != null);
  const solidMax = Math.max(...solids.map((m) => m.o2_max));
  const highPhases = [...new Set(high.flatMap((i) => i.phase))];
  const o2Box = h("div", { class: "chart" }), testsBox = h("div", { class: "chart" });
  mount(root,
    h("div", { class: "hero" },
      h("div", { class: "kicker", text: L("تحدي ناسا Space Apps 2026 · لهب في السقوط الحر", "NASA Space Apps Challenge 2026 · Flame in Freefall") }),
      h("h1", { text: L("ماذا تقول بيانات ناسا عن الحرائق في الفضاء؟", "What does NASA's data say about fire in space?") }),
      h("p", { text: L(`${st.investigations} تجربة احتراق من قاعدة بيانات ناسا (PSI)، مرتّبة حسب بيئة الطاقم، مع مساعد يجيب من مصادر ناسا فقط ويتحقق من كل جملة قبل عرضها.`,
        `${st.investigations} combustion investigations from NASA's PSI database, ranked for a crew environment, with an assistant that answers only from NASA sources and checks every sentence before showing it.`) }),
      h("div", { class: "cta" },
        h("button", { class: "btn primary big", text: L("+ اسأل الأرشيف", "+ Ask the archive"), onclick: () => go("ask") }),
        h("button", { class: "btn ghost big", text: L("جاهزية القمر", "Moon readiness"), onclick: () => go("moon") })),
      h("div", { class: "credit", dir: "ltr", text: "Photo: BASS-II flame test aboard the ISS, NASA PSI (PSI-25)" })),
    h("div", { class: "kpis" },
      kpi(L("التجارب", "Investigations"), st.investigations, L(`${st.flight} في الفضاء، ${st.ground} أرضية`, `${st.flight} flight, ${st.ground} ground`)),
      kpi(L("صفوف الاختبارات", "Test rows"), num(st.test_rows), L("وقود، أكسجين، تدفق، ضغط", "fuel, oxygen, flow, pressure")),
      kpi(L("المنشورات العلمية", "Publications"), num(st.publications), L("مرتبطة بسجلات PSI", "linked from PSI records")),
      kpi(L("الأرشيف الموصوف", "Archive described"), `${st.archive_tib} TiB`, L(`${num(st.archive_files)} ملف: فيديو وصور وحساسات`, `${num(st.archive_files)} files: video, images, sensors`)),
      kpi(L("مقاطع الأدلة", "Evidence passages"), num(st.passages), L(`من PSI ومن ${st.resources} موارد للتحدي`, `from PSI and ${st.resources} challenge resources`))),
    h("div", { class: "insights" },
      h("div", { class: "insight gap" }, h("div", { class: "tag", text: L("فجوة في البيانات", "Data gap") }),
        h("div", { class: "big", text: L(`لم تُختبر أي عيّنة صلبة حقيقية فوق ${fmt(solidMax, 1)}% أكسجين`, `No real solid sample was tested above ${fmt(solidMax, 1)}% oxygen`) }),
        h("p", { text: L("القاعدة القمرية متوقعة عند 30% أكسجين أو أكثر. لا يوجد في جداول PSI أي صف اختبار لقماش أو بلاستيك عند هذه النسبة. أقرب ما وصلت إليه ناسا تجربة BRE: حارقات غاز تقلّد احتراق المواد الصلبة، حتى 34% أكسجين بضغط 8.2 psi. لكنها ليست عيّنات صلبة حقيقية.", "A Moon base is expected at 30% oxygen or more. No PSI test row burns a fabric or plastic at that level. The closest NASA came is BRE: gas burners that emulate burning solids, up to 34% oxygen at 8.2 psi. They are not real solid samples.") }),
        h("button", { class: "linklike", text: L("افتح جاهزية القمر", "Open Moon readiness"), onclick: () => go("moon") })),
      h("div", { class: "insight" }, h("div", { class: "tag", text: L("التغطية", "Coverage") }),
        h("div", { class: "big", text: L(`${high.length} تجارب وصلت إلى 30% أكسجين أو أكثر`, `${high.length} investigations reach 30% oxygen or more`) }),
        h("p", { text: `${high.map(short).join(L("، ", ", "))}. ${highPhases.includes("solid") ? "" : L("كلها تحرق غازاً أو سائلاً، ولا واحدة منها تحرق مادة صلبة.", "All burn a gas or a liquid; none burns a solid.")}` })),
      h("div", { class: "insight gap" }, h("div", { class: "tag", text: L("فجوة في البيانات", "Data gap") }),
        h("div", { class: "big", text: L("لا توجد اختبارات جاذبية جزئية في PSI بعد", "No partial-gravity tests in PSI yet") }),
        h("p", { text: L("حاكت E-FIELD Flames الجاذبية الجزئية بمجال كهربائي. وحتى تصل تجارب LUCI وFM2، تبقى نتائج الجاذبية الصغرى ونتائج الأرض هي الحدّين اللذين يقع بينهما ما يحدث على القمر والمريخ.", "E-FIELD Flames mimicked partial gravity with an electric field. Until LUCI and FM2 arrive, microgravity and normal-gravity results bound the Moon and Mars.") }))),
    h("div", { class: "grid-2" },
      h("div", { class: "card" },
        h("div", { class: "card-head" }, h("div", {}, h("h3", { text: L("الأكسجين الذي اختبرته كل تجربة", "Oxygen tested by each investigation") }),
          h("div", { class: "sub", text: L(`من جداول PSI. المنطقة المظللة: ${sc().name} (${sc().atmosphere}).`, `From the PSI tables. Shaded: ${sc().name} (${sc().atmosphere}).`) }))),
        legend([[L("فيها اختبارات ضمن النطاق", "Has tests in the window"), "var(--s1)"], [L("خارج النطاق", "Outside the window"), "var(--deemph)"]]), o2Box),
      h("div", { class: "card" },
        h("div", { class: "card-head" }, h("div", {}, h("h3", { text: L(`الأكثر صلة: ${sc().name}`, `Most relevant: ${sc().name}`) }),
          h("div", { class: "sub", text: L("درجة من 100 يمكن رؤية طريقة حسابها. مرّر الفأرة على الشريط لرؤية تفاصيلها.", "A 100-point score you can inspect. Hover a bar for its breakdown.") })),
          h("button", { class: "btn small", text: L("عرض الكل", "See all"), onclick: () => go("investigations") })),
        ranked().slice(0, 6).map((inv, i) => h("div", { class: "rank-row", tabindex: 0, role: "button", onclick: () => openDrawer(inv.acc), onkeydown: (e) => e.key === "Enter" && openDrawer(inv.acc) },
          h("div", { class: "rank-n", text: i + 1 }),
          h("div", { style: "min-width:0" }, h("div", { class: "rank-name", text: short(inv) }), h("div", { class: "rank-title", text: title(inv) })),
          scoreBar(inv))),
        h("div", { style: "margin-top:10px" }, scoreLegend()))),
    h("div", { class: "grid-even" },
      h("div", { class: "card" }, h("div", { class: "card-head" }, h("div", {}, h("h3", { text: L("التجارب حسب محاور السلامة", "Investigations by fire-safety pillar") }),
        h("div", { class: "sub", text: L("استراتيجية ناسا: الوقاية والكشف والإخماد.", "NASA's strategy: prevention, detection, suppression.") }))),
        Object.keys(state.meta.pillars).map((p) => {
          const n = state.catalog.filter((i) => i.pillars.includes(p)).length;
          return h("div", { class: "meter-row" },
            h("button", { class: "linklike", text: pillarName(p), onclick: () => { state.filters.pillar = p; go("investigations"); } }),
            h("div", { class: "meter" }, h("i", { style: `width:${(100 * n) / state.catalog.length}%` })), h("div", { class: "meter-val", text: n }));
        })),
      h("div", { class: "card" }, h("div", { class: "card-head" }, h("div", {}, h("h3", { text: L("عدد الاختبارات في كل تجربة", "Test rows per investigation") }),
        h("div", { class: "sub", text: L("البيانات المتاحة للنمذجة التنبؤية.", "The data available for predictive modelling.") }))), testsBox)),
  );
  o2Chart(o2Box, withO2.map((d) => ({ ...d, label: short(d) })), { win: scenario().o2, onPick: (d) => openDrawer(d.acc) });
  barsChart(testsBox, state.catalog.filter((i) => i.n_tests).sort((a, b) => b.n_tests - a.n_tests).slice(0, 12).map((i) => ({ label: short(i), value: i.n_tests, inv: i })),
    { onPick: (d) => openDrawer(d.inv.acc), tip: (d) => [[L("عدد الاختبارات", "Test rows"), num(d.value)], [L("الوقود", "Fuels"), d.inv.fuels.slice(0, 3).map((f) => fuel(f[0])).join(", ")], [L("الأكسجين", "O2"), fmtRange(d.inv.o2_range, "%")]] });
}

// ---------- investigations ----------
function renderInvestigations() {
  const root = $("view-investigations"), f = state.filters, q = f.q.toLowerCase();
  const sel = (label, key, opts) => h("label", { class: "field" }, h("span", { text: label }),
    h("select", { onchange: (e) => { f[key] = e.target.value; renderInvestigations(); } },
      h("option", { value: "", text: L("الكل", "All") }), opts.map(([v, t]) => h("option", { value: v, text: t, selected: f[key] === v }))));
  const list = ranked().filter((i) => (!f.pillar || i.pillars.includes(f.pillar)) && (!f.phase || i.phase.includes(f.phase)) && (!f.tier || i.tier === f.tier) && (!f.kind || i.kind === f.kind)
    && (!q || [i.short, i.title, i.ar_title, i.ar, i.keywords.join(" "), i.fuels.map((x) => x[0] + " " + fuel(x[0])).join(" ")].join(" ").toLowerCase().includes(q)));
  const search = h("input", { type: "search", value: f.q, placeholder: L("PMMA، سخام، قطيرات…", "PMMA, soot, droplet…"), "aria-label": L("بحث", "Search") });
  search.addEventListener("input", () => { f.q = search.value; renderInvestigations(); const n = root.querySelector("input[type=search]"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
  mount(root,
    h("div", { class: "inv-filters" }, h("label", { class: "field" }, h("span", { text: L("بحث", "Search") }), search),
      sel(L("محور السلامة", "Pillar"), "pillar", Object.keys(state.meta.pillars).map((p) => [p, pillarName(p)])),
      sel(L("حالة الوقود", "Fuel phase"), "phase", Object.keys(PHASES).map((p) => [p, pick(PHASES[p])])),
      sel(L("درجة الصلة", "Relevance"), "tier", Object.keys(TIERS).map((t) => [t, pick(TIERS[t])])),
      sel(L("النوع", "Type"), "kind", [["flight", L("في الفضاء", "Flight")], ["ground", L("أرضية", "Ground")]]),
      h("div", { class: "count", text: L(`${list.length} من ${state.catalog.length}، مرتبة حسب: ${sc().name}`, `${list.length} of ${state.catalog.length}, ranked for: ${sc().name}`) })),
    scoreLegend(),
    list.length ? list.map((inv, n) => h("article", { class: "card inv-card", tabindex: 0, role: "button", onclick: () => openDrawer(inv.acc), onkeydown: (e) => e.key === "Enter" && openDrawer(inv.acc) },
      h("div", { class: "n", text: n + 1 }),
      h("div", { style: "min-width:0" }, h("h3", { text: short(inv) }), h("div", { class: "title" }, title(inv), " · ", ltr(inv.acc)), chips(inv),
        h("div", { class: "facts" },
          inv.n_tests > 0 && h("span", {}, h("b", { text: num(inv.n_tests) }), L(" صفاً من الاختبارات", " test rows")),
          inv.o2_range && h("span", {}, L("الأكسجين ", "O2 "), h("b", { dir: "ltr", text: fmtRange(inv.o2_range, "%") })),
          inv.flow_range && h("span", {}, L("التدفق ", "flow "), h("b", { dir: "ltr", text: fmtRange(inv.flow_range, " cm/s") })),
          inv.pressure_range && h("span", {}, L("الضغط ", "pressure "), h("b", { dir: "ltr", text: fmtRange(inv.pressure_range, " atm", 2) })),
          inv.fuels.length > 0 && h("span", {}, L("الوقود ", "fuels "), h("b", { text: inv.fuels.slice(0, 3).map((x) => fuel(x[0])).join(L("، ", ", ")) + (inv.fuels.length > 3 ? ` +${inv.fuels.length - 3}` : "") }))),
        h("div", { class: "sum", text: desc(inv) })),
      h("div", { class: "inv-side" }, h("div", { class: "total" }, fmt(score(inv).total, 0), h("small", { text: " / 100" })), scoreBar(inv, false), h("div", { class: "why", text: conditionsText(inv) }))))
      : h("div", { class: "card empty", text: L("لا توجد تجربة تطابق هذه الفلاتر.", "No investigation matches these filters.") }));
}

// ---------- details drawer ----------
export const drawerExtras = [];   // later steps add sections here (media, equipment, AI summary)
export function openDrawer(acc) {
  const inv = state.byAcc[acc], d = $("drawer"), s = score(inv);
  const row = (k, v) => (v ? [h("dt", { text: k }), h("dd", {}, v)] : []);
  const prose = (t, text) => text && text.length > 20 && h("details", {}, h("summary", { text: t }), h("div", { class: "prose ltr", dir: "ltr", text }));
  const fam = state.meta.families[inv.family];
  mount(d,
    h("button", { class: "btn small close", text: L("إغلاق ✕", "Close ✕"), onclick: closeDrawer }),
    h("div", {}, h("h2", { text: title(inv) }), h("div", { style: "color:var(--text-2)" }, ltr(`${inv.short} · ${inv.acc}`))),
    chips(inv),
    h("p", { class: "lead", text: desc(inv) }),
    h("div", { style: "display:flex;gap:8px;flex-wrap:wrap" },
      h("a", { class: "btn small", href: inv.psi_url, target: "_blank", rel: "noopener", text: L("افتح في PSI", "Open in PSI") }),
      inv.doi && h("a", { class: "btn small", href: `https://doi.org/${inv.doi}`, target: "_blank", rel: "noopener", text: "DOI" })),
    drawerExtras.map((fn) => fn(inv)),
    h("section", {}, h("h4", { text: L(`الصلة بـ${sc().name}: ${fmt(s.total, 0)} من 100`, `Relevance for ${sc().name}: ${fmt(s.total, 0)} / 100`) }), scoreBar(inv, false), scoreLegend(),
      h("dl", { class: "kv" }, Object.entries(s.parts).flatMap(([k, v]) => row(pick(PARTS[k]), `${fmt(v, 1)}`)), row(L("سبب درجة الظروف", "Why (conditions)"), conditionsText(inv))),
      (AR() ? inv.notes_ar : inv.notes_en).length > 0 && h("ul", { class: "plain" }, (AR() ? inv.notes_ar : inv.notes_en).map((n) => h("li", { text: n + L(" (من نص التحدي)", " (challenge statement)") })))),
    h("section", {}, h("h4", { text: L("ظروف الاختبار", "Test conditions") }),
      h("dl", { class: "kv" },
        row(L("الوقود والعينات", "Fuels / samples"), inv.fuels.length ? inv.fuels.map(([f, n]) => `${fuel(f)} (${n})`).join(L("، ", ", ")) : null),
        row(L("الأكسجين", "Oxygen"), inv.o2_range && ltr(fmtRange(inv.o2_range, "% by volume"))),
        row(L("سرعة التدفق", "Flow velocity"), inv.flow_range && ltr(fmtRange(inv.flow_range, " cm/s"))),
        row(L("الضغط", "Pressure"), inv.pressure_range && ltr(fmtRange(inv.pressure_range, " atm", 2))),
        row(L("عدد الاختبارات", "Test rows"), inv.n_tests ? num(inv.n_tests) : null),
        row(L("القياسات المذكورة", "Measurements"), inv.measurements.map(meas).join(L("، ", ", "))),
        row(L("الأجهزة", "Hardware"), inv.hardware && ltr(inv.hardware)),
        row(L("عائلة الأجهزة", "Hardware family"), h("span", {}, ltr(inv.family), fam ? h("div", { class: "sub", text: fam[state.lang] }) : null)),
        row(L("المنصة", "Platform"), inv.platform && (AR() ? PLATFORM_AR[inv.platform] || inv.platform : inv.platform)),
        row(L("نوع الدراسة", "Study type"), AR() ? TYPE_AR[inv.project_type] || inv.project_type : inv.project_type),
        row(L("السنوات", "Years"), inv.start ? `${inv.start}–${inv.end || ""}` : null),
        row(L("أرشيف ناسا", "NASA archive"), L(`${num(inv.archive.files)} ملف، ${num(inv.archive_gb)} GB`, `${num(inv.archive.files)} files, ${num(inv.archive_gb)} GB`)),
        row(L("أنواع الملفات", "File types"), Object.keys(inv.archive.by_type).length ? ltr(Object.entries(inv.archive.by_type).slice(0, 5).map(([t, n]) => `${n} ${t}`).join(" | ")) : null),
        row(L("تجارب مرتبطة", "Related"), inv.related.length ? h("span", {}, inv.related.filter((r) => state.byAcc[r]).map((r, i) => [i ? ", " : "", h("button", { class: "linklike", text: short(state.byAcc[r]), onclick: () => openDrawer(r) })])) : null)),
      inv.tables.flatMap((t) => t.notes).map((n) => h("div", { class: "warn", text: L("ملاحظة عن البيانات: ", "Data note: ") + noteText(n) }))),
    h("section", {}, h("h4", { text: L("النص الأصلي من ناسا (بالإنجليزية)", "Original NASA text") }),
      prose("Objectives", inv.objective), prose("Approach", inv.approach), prose("Hypothesis", inv.hypothesis), prose("Research impacts", inv.impacts),
      inv.publications.length > 0 && h("details", {}, h("summary", { text: L(`المنشورات (${inv.publications.length})`, `Publications (${inv.publications.length})`) }),
        h("ul", { class: "plain ltr", dir: "ltr" }, inv.publications.map((p) => h("li", {}, p.doi ? h("a", { href: `https://doi.org/${p.doi}`, target: "_blank", rel: "noopener", text: p.title }) : p.title))))),
  );
  d.hidden = false; $("scrim").hidden = false; d.scrollTop = 0; d.querySelector(".close").focus();
}
export function closeDrawer() { $("drawer").hidden = true; $("scrim").hidden = true; hideTip(); }

// ---------- views added by later steps ----------
export const RENDER = { overview: renderOverview, investigations: renderInvestigations };
const PLACEHOLDER = (v) => () => mount($("view-" + v), h("div", { class: "card empty", text: L("قيد البناء خلال الهاكاثون…", "Being built during the hackathon…") }));
for (const v of ["home", "story", "moon", "equipment", "data", "ask"]) RENDER[v] = PLACEHOLDER(v);
const HIDE_FILTERS = new Set(["home", "story", "ask", "data", "equipment", "moon"]);

export function go(view) {
  state.view = view;
  document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.view === view));
  document.querySelectorAll("main > .view").forEach((v) => { v.hidden = v.id !== "view-" + view; });
  $("filters").hidden = HIDE_FILTERS.has(view);
  RENDER[view]();
  history.replaceState(null, "", location.pathname + location.search + "#" + view);
  scrollTo(0, 0);
}

function applyLang() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = AR() ? "rtl" : "ltr";
  document.title = L("TrustFlame | السلامة من الحرائق من بيانات ناسا", "TrustFlame | Fire-safety insights from NASA data");
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = pick(CHROME[el.dataset.i18n]); });
  $("lang").textContent = AR() ? "English" : "عربي";
  setChartLang(state.lang);
  if (!state.meta) return;
  mount($("scenario"), state.meta.scenarios.map((s) => h("option", { value: s.id, text: s[state.lang].name, selected: s.id === state.scenario })));
  mount($("scenario-note"), h("b", { text: `${sc().gravity}, ${sc().atmosphere}. ` }), sc().note);
  $("foot").textContent = L("نموذج أولي لتحدي ناسا Space Apps 2026. البيانات من NASA PSI (CC0) وموارد التحدي. ليس أداة تشغيلية للسلامة من الحرائق.",
    "Prototype for the NASA Space Apps Challenge 2026. Data from NASA PSI (CC0) and the challenge resources. Not an operational fire-safety tool.");
}
export const onLangChange = [];
function setLang(lang) {
  state.lang = lang; localStorage.setItem("lang", lang);
  const u = new URL(location.href); u.searchParams.set("lang", lang); history.replaceState(null, "", u);
  closeDrawer(); onLangChange.forEach((fn) => fn()); applyLang(); RENDER[state.view]();
}

export async function init(extraLoaders = []) {
  applyLang();
  $("lang").addEventListener("click", () => setLang(AR() ? "en" : "ar"));
  state.status = await fetch("api/status").then((r) => (r.ok ? r.json() : null), () => null);
  state.static = !state.status;
  [state.meta, state.catalog, state.materials] = await Promise.all([api("/api/meta"), api("/api/catalog"), api("/api/materials")]);
  state.byAcc = Object.fromEntries(state.catalog.map((i) => [i.acc, i]));
  await Promise.all(extraLoaders.map((fn) => fn()));
  applyLang();
  $("scenario").addEventListener("change", (e) => { state.scenario = e.target.value; applyLang(); RENDER[state.view](); });
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => go(b.dataset.view)));
  $("scrim").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
  let t; addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => RENDER[state.view](), 150); });
  const start = location.hash.slice(1);
  go(RENDER[start] ? start : "home");
}
