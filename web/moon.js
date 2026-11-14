// Moon readiness: what has NASA actually tested at the oxygen and pressure of a crew environment?
// Every number shown here is a count or a value from the PSI tables; nothing is predicted or invented.
import { h, mount, fmt, legend } from "./charts.js?v=1";
import { state, L, AR, RENDER, api, fuel, short, num, ltr, openDrawer } from "./app.js?v=1";

const PRESETS = [
  { id: "earth", o2: 21, atm: 1.0, ar: "الأرض / المحطة", en: "Earth / ISS" },
  { id: "moon", o2: 30, atm: 0.694, ar: "القاعدة القمرية", en: "Moon base" },
  { id: "suit", o2: 100, atm: 0.29, ar: "بدلة الفضاء", en: "Spacesuit" },
];
const ui = { o2: 30, atm: 0.694 };
let TESTS = null;

const OUTCOME_AR = { "Test end": "نهاية الاختبار", "Hot ignition": "اشتعال ساخن", "Self-extinguished (SE) or flow terminated (FT)": "انطفأ ذاتياً (SE) أو أُوقف التدفق (FT)",
  "Cool flame": "لهب بارد", "Microgravity burn length": "طول الاحتراق في الجاذبية الصغرى", "Microgravity spread": "الانتشار في الجاذبية الصغرى",
  "Normal-gravity burn length": "طول الاحتراق على الأرض", "Normal-gravity spread rate": "سرعة الانتشار على الأرض" };

function statusBadge(m) {
  if (m.o2_max == null) return h("span", { class: "badge meta", text: L("لا قيمة أكسجين مسجلة", "no O2 recorded") });
  if (m.o2_max >= ui.o2) return h("span", { class: "badge ok", text: L(`اختُبر حتى ${fmt(m.o2_max, 1)}%`, `tested up to ${fmt(m.o2_max, 1)}%`) });
  return h("span", { class: "badge bad", text: L(`أعلى ما اختُبر ${fmt(m.o2_max, 1)}%`, `highest tested ${fmt(m.o2_max, 1)}%`) });
}

function render() {
  const root = document.getElementById("view-moon");
  if (!TESTS) { mount(root, h("div", { class: "card empty", text: L("جاري التحميل…", "Loading…") })); api("/api/tests").then((t) => { TESTS = t; render(); }); return; }
  const atO2 = TESTS.filter((t) => t.o2.some((v) => v >= ui.o2));
  const both = atO2.filter((t) => t.atm.some((v) => v <= ui.atm + 1e-9));
  const solidAtO2 = atO2.filter((t) => t.fuel && state.materials.find((m) => m.name === t.fuel && m.phase === "solid"));
  const byInv = {};
  for (const t of atO2) {
    const e = (byInv[t.acc] ||= { rows: 0, both: 0, fuels: {}, outcomes: {} });
    e.rows++; if (t.atm.some((v) => v <= ui.atm + 1e-9)) e.both++;
    if (t.fuel) e.fuels[t.fuel] = (e.fuels[t.fuel] || 0) + 1;
    for (const [k, v] of Object.entries(t.outcome || {})) ((e.outcomes[k] ||= {})[v] = (e.outcomes[k][v] || 0) + 1);
  }
  const slider = (key, label, min, max, step, unit) => {
    const out = h("b", { text: `${ui[key]}${unit}` });
    const input = h("input", { type: "range", min, max, step, value: ui[key], "aria-label": label });
    input.addEventListener("input", () => { ui[key] = Number(input.value); out.textContent = `${ui[key]}${unit}`; });
    input.addEventListener("change", render);
    return h("label", { class: "moon-slider" }, h("span", {}, label, " ", out), input);
  };
  const preset = PRESETS.find((p) => p.o2 === ui.o2 && Math.abs(p.atm - ui.atm) < 0.01);
  mount(root,
    h("div", { class: "eq-hero" },
      h("div", { class: "kicker", text: L("أداة قرار من بيانات ناسا فقط", "A decision tool built only on NASA data") }),
      h("h1", { text: L("هل اختبرت ناسا هذه الظروف؟", "Has NASA tested these conditions?") }),
      h("p", { class: "sub", text: L("حرّك نسبة الأكسجين والضغط، أو اختر بيئة. يعرض الموقع كم اختباراً في جداول PSI وصل إلى هذه الظروف، وأي مواد اختُبرت، وماذا حدث للهب حيث سجّلته ناسا. لا شيء هنا تنبؤ أو معادلة مخترعة.",
        "Move the oxygen and pressure sliders, or pick an environment. The site shows how many PSI test rows reached these conditions, which materials were tested, and what happened to the flame where NASA recorded it. Nothing here is a prediction or an invented formula.") })),
    h("div", { class: "card moon-controls" },
      h("div", { class: "chips" }, PRESETS.map((p) => h("button", { class: "chip btn" + (preset === p ? " on" : ""), text: `${p[AR() ? "ar" : "en"]} (${p.o2}% · ${p.atm} atm)`, onclick: () => { ui.o2 = p.o2; ui.atm = p.atm; render(); } }))),
      h("div", { class: "moon-sliders" },
        slider("o2", L("الأكسجين على الأقل", "Oxygen at least"), 10, 100, 1, "%"),
        slider("atm", L("الضغط على الأكثر", "Pressure at most"), 0.2, 3, 0.001, " atm"))),
    h("div", { class: "kpis" },
      kpiBox(L("اختبارات بأكسجين ≥ ", "Test rows with O2 ≥ ") + ui.o2 + "%", num(atO2.length), L(`من ${Object.keys(byInv).length} تجارب`, `from ${Object.keys(byInv).length} investigations`)),
      kpiBox(L("ومعها ضغط ≤ ", "…and pressure ≤ ") + ui.atm + " atm", num(both.length), L("حيث سُجّل الضغط", "where pressure is recorded")),
      kpiBox(L("منها مواد صلبة (أقمشة، بلاستيك)", "…of them solid materials"), num(solidAtO2.length), solidAtO2.length ? "" : L("فجوة: لا بيانات", "gap: no data"), !solidAtO2.length)),
    o2Card(),
    h("div", { class: "grid-even" },
      h("div", { class: "card" },
        h("div", { class: "card-head" }, h("div", {}, h("h3", { text: L("جاهزية المواد", "Material readiness") }),
          h("div", { class: "sub", text: L(`أعلى أكسجين وأقل ضغط اختُبرت فيهما كل مادة، مقارنة بـ ${ui.o2}%.`, `Highest oxygen and lowest pressure each material was tested at, against ${ui.o2}%.`) }))),
        h("table", { class: "cmp" }, h("thead", {}, h("tr", {}, [L("المادة", "Material"), L("الأكسجين", "Oxygen"), L("أقل ضغط", "Lowest pressure"), L("التجارب", "Investigations")].map((t) => h("th", { text: t })))),
          h("tbody", {}, state.materials.filter((m) => m.phase !== "aerosol").map((m) => h("tr", {},
            h("td", {}, h("b", { text: fuel(m.name) }), h("div", { class: "sub", text: L({ solid: "صلب", liquid: "سائل", gas: "غازي" }[m.phase] || "", m.phase || "") })),
            h("td", {}, statusBadge(m)),
            h("td", { text: m.atm_min != null ? `${fmt(m.atm_min, 2)} atm` : L("غير مسجّل", "not recorded") }),
            h("td", {}, m.investigations.map((a, i) => [i ? ", " : "", h("button", { class: "linklike", text: short(state.byAcc[a]), onclick: () => openDrawer(a) })]))))))),
      h("div", { class: "card" },
        h("div", { class: "card-head" }, h("div", {}, h("h3", { text: L("التجارب التي وصلت لهذه الظروف", "Investigations that reached these conditions") }),
          h("div", { class: "sub", text: L("وماذا حدث للهب، حيث سجّلت ناسا النتيجة في الجدول.", "And what happened to the flame, where NASA's table records it.") }))),
        Object.keys(byInv).length ? Object.entries(byInv).sort((a, b) => b[1].rows - a[1].rows).map(([acc, e]) => h("div", { class: "moon-inv" },
          h("div", { class: "card-head", style: "margin:0" }, h("button", { class: "linklike", text: short(state.byAcc[acc]), onclick: () => openDrawer(acc) }),
            h("span", { class: "sub", text: L(`${e.rows} اختبار، ${e.both} منها بضغط ≤ ${ui.atm}`, `${e.rows} rows, ${e.both} at ≤ ${ui.atm} atm`) })),
          h("div", { class: "sub", text: Object.entries(e.fuels).map(([f, n]) => `${fuel(f)} (${n})`).join(L("، ", ", ")) }),
          Object.keys(e.outcomes).length ? Object.entries(e.outcomes).map(([k, vals]) => h("div", { class: "moon-outcome" }, h("b", { text: (AR() ? OUTCOME_AR[k] || k : k) + ": " }),
            ltr(Object.entries(vals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v, n]) => `${v} (${n})`).join(" · "))))
            : h("div", { class: "sub", text: L("النتيجة غير مسجّلة في جدول هذه التجربة.", "Outcome not recorded in this table.") })))
          : h("div", { class: "empty", text: L("لا يوجد أي اختبار في PSI بهذه الظروف. هذه فجوة في البيانات.", "No PSI test reached these conditions. This is a data gap.") }))),
    h("div", { class: "card warn-card" }, h("b", { text: L("كيف تقرأ هذه الأداة: ", "How to read this: ") }),
      L("الأداة تعدّ ما اختبرته ناسا فعلاً. عدم وجود اختبار لا يعني أن المادة آمنة أو خطرة، بل يعني أنه لا توجد بيانات، وهذا بالضبط ما يحتاج المهندسون معرفته قبل تصميم قاعدة قمرية. أقرب ما وصلت إليه ناسا تجربة BRE: حارقات غاز تقلّد احتراق المواد الصلبة، حتى 34% أكسجين بضغط 8.2 psi. لكنها ليست عيّنات صلبة حقيقية.",
        "The tool counts what NASA actually tested. A missing test does not mean a material is safe or dangerous; it means there is no data, which is exactly what engineers need to know before designing a Moon base. The closest NASA came is BRE: gas burners that emulate burning solids, up to 34% oxygen at 8.2 psi. They are not real solid samples.")),
  );
}
// Simple arithmetic on the slider values (no model): share of oxygen vs amount of oxygen (partial pressure).
const PSI_PER_ATM = 14.696, EARTH = { o2: 21, atm: 1 };
function o2Card() {
  const psi = (atm) => atm * PSI_PER_ATM, pp = (o2, atm) => psi(atm) * o2 / 100;
  const more = ((ui.o2 - EARTH.o2) / EARTH.o2) * 100, ratio = pp(ui.o2, ui.atm) / pp(EARTH.o2, EARTH.atm);
  const col = (title, o2, atm, hi) => h("div", { class: "o2-col" + (hi ? " hi" : "") }, h("div", { class: "label", text: title }),
    h("div", { class: "o2-row" }, h("span", { text: L("نسبة الأكسجين", "Oxygen share") }), h("b", { class: "ltr", text: `${fmt(o2, 0)}%` })),
    h("div", { class: "o2-row" }, h("span", { text: L("الضغط", "Pressure") }), h("b", { class: "ltr", text: `${fmt(psi(atm), 1)} psi` })),
    h("div", { class: "o2-row" }, h("span", { text: L("كمية الأكسجين (الضغط الجزئي)", "Oxygen amount (partial pressure)") }), h("b", { class: "ltr", text: `${fmt(pp(o2, atm), 2)} psi` })));
  const same = Math.abs(ratio - 1) < 0.1;
  return h("section", { class: "card o2-card" },
    h("div", { class: "card-head" }, h("div", {},
      h("h3", { text: L("نفس كمية الأكسجين تقريباً، لكن نسبته في الهواء أعلى", "About the same amount of oxygen, but a bigger share of the air") }),
      h("div", { class: "sub", text: L("حساب بسيط من أرقام المؤشّر: كمية الأكسجين = الضغط × نسبة الأكسجين.", "Simple arithmetic on the slider values: oxygen amount = pressure × oxygen share.") }))),
    h("div", { class: "o2-grid" },
      col(L("الأرض", "Earth"), EARTH.o2, EARTH.atm, false),
      col(L("الظروف المختارة", "Selected conditions"), ui.o2, ui.atm, true),
      h("div", { class: "o2-col" },
        h("div", { class: "label", text: L("الفرق عن هواء الأرض", "Compared with Earth's air") }),
        h("div", { class: "o2-big ltr", text: `${more >= 0 ? "+" : ""}${fmt(more, 0)}%` }),
        h("div", { class: "sub", text: L("في نسبة الأكسجين", "in oxygen share") }),
        h("div", { class: "o2-big ltr small", text: `×${fmt(ratio, 2)}` }),
        h("div", { class: "sub", text: same ? L("في كمية الأكسجين: تقريباً مثل الأرض", "in oxygen amount: about the same as Earth") : L("في كمية الأكسجين", "in oxygen amount") }))),
    h("blockquote", { class: "quote ltr", dir: "ltr", text: "“The intermediate oxygen concentration used on the Moon will likely be 30% or greater, with a corresponding pressure of 10.2 psi or less. Compared to Earth's atmosphere, that's more than a 40% increase in the oxygen concentration making materials much more flammable.”" }),
    h("div", { class: "eq-src", text: L("من نص تحدي ناسا (Flame in Freefall)", "NASA Space Apps challenge statement (Flame in Freefall)") }));
}
function kpiBox(label, value, hint, alarm = false) {
  return h("div", { class: "kpi" + (alarm ? " alarm" : "") }, h("div", { class: "label", text: label }), h("div", { class: "value", text: value }), h("div", { class: "hint", text: hint }));
}
RENDER.moon = render;
