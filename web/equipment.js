// Research to equipment: which microgravity investigations inform which fire-safety equipment.
// Every link shows a sentence copied word for word from NASA (a PSI record field or a challenge resource);
// src/applications.py stops the build if a quote is not found in its source.
import { h, mount } from "./charts.js?v=1";
import { state, L, AR, RENDER, api, short, openDrawer, closeDrawer, drawerExtras, go } from "./app.js?v=1";

let APPS = null;
export async function loadApplications() { try { APPS = await api("/api/applications"); } catch (e) { APPS = null; } }

const SPINOFF = /^spinoff_/;
const FIELD = { impacts: ["حقل «الأثر» في سجل PSI", "PSI record, field “impacts”"], objective: ["حقل «الهدف» في سجل PSI", "PSI record, field “objective”"] };

const nq = (items) => items.reduce((n, i) => n + (i.quotes || [i.quote]).length, 0);   // quotes in a list of items
function sourceLine(item) {
  const label = item.acc ? L(FIELD[item.field][0], FIELD[item.field][1]) : item.source_title;
  return h("div", { class: "eq-src" }, h("a", { href: item.url, target: "_blank", rel: "noopener", text: label + " ↗" }));
}

function quote(text) {
  return h("blockquote", { class: "quote ltr", dir: "ltr", text: "“" + text + "”" });
}

function invChip(acc) {
  const inv = state.byAcc[acc];
  return h("button", { class: "chip btn", text: inv ? short(inv) : acc, title: L("افتح تفاصيل التجربة", "Open investigation details"), onclick: () => openDrawer(acc) });
}

function linkItem(item) {
  const head = item.acc ? invChip(item.acc)
    : h("span", { class: "chip" + (SPINOFF.test(item.resource) ? " spin" : ""), text: SPINOFF.test(item.resource) ? "NASA Spinoff" : item.source_title });
  return h("div", { class: "eq-link" },
    h("div", { class: "eq-link-head" }, head, item.acc && h("span", { class: "eq-acc ltr", text: item.acc })),
    AR() && h("p", { text: item.ar }),
    (item.quotes || [item.quote]).map(quote),
    sourceLine(item));
}

function category(c) {
  const desc = AR() ? c.desc_ar : c.desc_en;
  return h("section", { class: "card eq-cat", id: "eq-" + c.id },
    h("div", { class: "card-head" },
      h("div", {}, h("h3", { text: AR() ? c.name_ar : c.name_en }), h("p", { class: "sub", text: desc })),
      h("span", { class: "badge meta", text: L(`${nq([...c.links, ...c.earth])} اقتباسات`, `${nq([...c.links, ...c.earth])} quotes`) })),
    h("div", { class: "eq-cols" },
      h("div", {}, h("h4", { class: "eq-col-title", text: L("في المركبات والقواعد الفضائية", "In spacecraft and habitats") }), c.links.map(linkItem)),
      h("div", {}, h("h4", { class: "eq-col-title", text: L("على الأرض", "On Earth") }),
        c.earth.length ? c.earth.map(linkItem) : h("p", { class: "why", text: L("لا يذكر أي مصدر من ناسا هنا استخداماً على الأرض.", "No NASA source here names a use on Earth.") }))));
}

function render() {
  const root = document.getElementById("view-equipment");
  if (!APPS) { mount(root, h("div", { class: "card empty", text: L("جاري التحميل…", "Loading…") })); loadApplications().then(() => APPS && render()); return; }
  const k = APPS.key_insight;
  const invs = new Set(APPS.categories.flatMap((c) => [...c.links, ...c.earth]).map((l) => l.acc).filter(Boolean));
  const quotes = nq(APPS.categories.flatMap((c) => [...c.links, ...c.earth])) + nq(APPS.lessons) + k.quotes.length;
  mount(root,
    h("div", { class: "eq-hero" },
      h("div", { class: "kicker", text: L("من تجارب الجاذبية الصغرى إلى معدات السلامة", "From microgravity experiments to fire-safety equipment") }),
      h("h1", { text: L("ماذا غيّرت هذه التجارب في معدات السلامة؟", "What did this research change in fire-safety equipment?") }),
      h("p", { class: "sub", text: L("كل رابط بين تجربة وجهاز يقتبس جملة من ناسا حرفياً، مع رابط المصدر. برنامج البناء يتوقف إذا لم يجد الاقتباس في مصدره، فلا توجد روابط مخترعة.",
        "Every link between an investigation and a piece of equipment quotes NASA word for word, with a link to the source. The build stops if a quote is not found in its source, so no link is invented.") })),
    h("div", { class: "kpis eq-kpis" },
      kpi(L("أنواع معدات", "Equipment areas"), APPS.categories.length),
      kpi(L("اقتباسات متحقق منها حرفياً", "Quotes checked word for word"), quotes),
      kpi(L("تجارب مرتبطة", "Investigations linked"), invs.size),
      kpi(L("فجوات وجدناها", "Gaps we found"), APPS.gaps.length, true)),
    h("section", { class: "card eq-key" },
      h("div", { class: "kicker", text: L("أهم اكتشاف للقاعدة القمرية", "Key finding for a Moon base") }),
      h("h2", { text: AR() ? k.title_ar : k.title_en }),
      h("p", { text: AR() ? k.ar : k.en }),
      k.quotes.map(quote),
      h("div", { class: "eq-link-head" }, invChip(k.acc), sourceLine(k))),
    h("nav", { class: "chips eq-nav", "aria-label": L("أنواع المعدات", "Equipment areas") },
      APPS.categories.map((c) => h("button", { class: "chip btn", text: AR() ? c.name_ar : c.name_en, onclick: () => document.getElementById("eq-" + c.id).scrollIntoView({ block: "start" }) }))),
    APPS.categories.map(category),
    h("h2", { class: "eq-section", text: L("دروس من حرائق حقيقية", "Lessons from real fires") }),
    h("div", { class: "grid-even" }, APPS.lessons.map((l) => h("section", { class: "card eq-lesson" },
      h("h3", { text: AR() ? l.title_ar : l.title_en }), h("p", { text: AR() ? l.ar : l.en }), (l.quotes || [l.quote]).map(quote), sourceLine(l)))),
    h("h2", { class: "eq-section", text: L("ما لا تغطيه بيانات ناسا بعد", "What NASA's data does not cover yet") }),
    h("div", { class: "grid-even" }, APPS.gaps.map((g) => h("div", { class: "insight gap" }, h("p", { class: "big", text: AR() ? g.ar : g.en })))));
}

function kpi(label, value, alarm = false) {
  return h("div", { class: "kpi" + (alarm ? " alarm" : "") }, h("div", { class: "label", text: label }), h("div", { class: "value", text: String(value) }));
}

RENDER.equipment = render;

// In the investigation drawer: which equipment this research informs
drawerExtras.push((inv) => {
  if (!APPS) return null;
  const cats = APPS.categories.filter((c) => [...c.links, ...c.earth].some((l) => l.acc === inv.acc));
  if (!cats.length) return null;
  return h("section", {},
    h("h4", { text: L("المعدات التي تساهم فيها هذه التجربة", "Equipment this research informs") }),
    h("div", { class: "chips" }, cats.map((c) => h("button", { class: "chip btn", text: AR() ? c.name_ar : c.name_en,
      onclick: () => { closeDrawer(); go("equipment"); setTimeout(() => document.getElementById("eq-" + c.id)?.scrollIntoView({ block: "start" }), 50); } }))));
});
