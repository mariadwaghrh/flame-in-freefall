// Research to equipment: which microgravity investigations inform which fire-safety equipment.
// Every link shows a sentence copied word for word from NASA (a PSI record field or a challenge resource);
// src/applications.py stops the build if a quote is not found in its source.
import { h, mount } from "./charts.js?v=1";
import { state, L, AR, RENDER, api, short, openDrawer, closeDrawer, drawerExtras, go } from "./app.js?v=1";
import { icon } from "./icons.js?v=1";
const AREA_ICON = { detection: "smoke", suppression: "extinguisher", ventilation: "wind", materials: "layers", models: "cpu" };
// real NASA images and video from investigations linked to each area (only where PSI has a clear picture of one of them)
const AREA_MEDIA = {
  suppression: { src: "media/still-PSI-26.jpg", acc: "PSI-26", ar: "لقطة حقيقية من كاميرا تجربة BASS، التي أطفأت اللهب بالنيتروجين", en: "Real camera frame from BASS, which put flames out with nitrogen" },
  ventilation: { src: "media/PSI-25_1.jpg", acc: "PSI-25", ar: "صورة حقيقية: لهب BASS-II في تدفق هواء على المحطة", en: "Real photo: a BASS-II flame in air flow on the ISS" },
  models: { src: "media/PSI-107_1.mp4", video: true, start: 3, end: 12, acc: "PSI-107", ar: "فيديو حقيقي: لهب في قناة تدفق SPICE على المحطة", en: "Real video: a flame in the SPICE flow duct on the ISS" },
};
function areaMedia(id) {
  const m = AREA_MEDIA[id];
  if (!m) return null;
  let el;
  if (m.video) {
    el = h("video", { src: `${m.src}#t=${m.start}`, muted: true, playsinline: true, autoplay: true, preload: "metadata", "aria-hidden": "true" });
    el.muted = true;
    el.addEventListener("timeupdate", () => { if (el.currentTime >= m.end) el.currentTime = m.start; });
    el.addEventListener("ended", () => { el.currentTime = m.start; el.play().catch(() => {}); });
  } else el = h("img", { src: m.src, alt: AR() ? m.ar : m.en, loading: "lazy" });
  return h("figure", { class: "eq-media" }, el, h("figcaption", {}, (AR() ? m.ar : m.en) + " · ", h("span", { class: "ltr", text: `NASA PSI (${m.acc})` })));
}

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

// One simple card per equipment area; NASA's own sentences are one click away, folded under the card.
const earthLine = (item) => {
  if (AR()) return item.ar;
  const who = item.acc ? short(state.byAcc[item.acc]) : item.source_title;
  const q = (item.quotes || [item.quote])[0];
  return `${who}: ${q.length > 110 ? q.slice(0, 107).trim() + "…" : q}`;
};

function category(c) {
  const invs = [...new Set(c.links.map((l) => l.acc).filter(Boolean))];
  const n = nq([...c.links, ...c.earth]);
  return h("section", { class: "card eq-cat", id: "eq-" + c.id },
    h("h3", { class: "eq-title" }, icon(AREA_ICON[c.id] || "flame", "eq-ic"), AR() ? c.name_ar : c.name_en),
    areaMedia(c.id),
    h("p", { class: "eq-desc", text: AR() ? c.desc_ar : c.desc_en }),
    h("div", { class: "eq-row" }, h("b", { text: L("التجارب: ", "Investigations: ") }), h("div", { class: "chips" }, invs.map(invChip))),
    c.earth.length ? h("div", { class: "eq-row eq-earth" }, h("b", { text: L("على الأرض: ", "On Earth: ") }),
      h("ul", {}, c.earth.map((e) => h("li", {}, SPINOFF.test(e.resource || "") && h("span", { class: "chip spin", text: "NASA Spinoff" }), " ", earthLine(e))))) : null,
    h("details", { class: "eq-more" },
      h("summary", { text: L(`اقرأ كلام ناسا الأصلي (${n} اقتباسات)`, `Read NASA's own words (${n} quotes)`) }),
      h("div", { class: "eq-cols" },
        h("div", {}, h("h4", { class: "eq-col-title", text: L("في المركبات والقواعد الفضائية", "In spacecraft and habitats") }), c.links.map(linkItem)),
        h("div", {}, h("h4", { class: "eq-col-title", text: L("على الأرض", "On Earth") }),
          c.earth.length ? c.earth.map(linkItem) : h("p", { class: "why", text: L("لا يذكر أي مصدر من ناسا هنا استخداماً على الأرض.", "No NASA source here names a use on Earth.") })))));
}

function render() {
  const root = document.getElementById("view-equipment");
  if (!APPS) { mount(root, h("div", { class: "card empty", text: L("جاري التحميل…", "Loading…") })); loadApplications().then(() => APPS && render()); return; }
  const k = APPS.key_insight;
  const quotes = nq(APPS.categories.flatMap((c) => [...c.links, ...c.earth])) + nq(APPS.lessons) + k.quotes.length;
  mount(root,
    h("div", { class: "eq-hero" },
      h("div", { class: "kicker", text: L("من تجارب الفضاء إلى معدات السلامة", "From space experiments to safety equipment") }),
      h("h1", { text: L("كيف ساعدت تجارب ناسا معدات السلامة من الحرائق؟", "How did NASA's experiments help fire-safety equipment?") }),
      h("p", { class: "sub", text: L(`خمسة أنواع من المعدات. لكل نوع: ماذا تعلّمت ناسا في الفضاء، وأين يفيد على الأرض. كل ذلك من ${quotes} جملة نقلناها من ناسا حرفياً، والبرنامج يتأكد من كل واحدة.`,
        `Five kinds of equipment. For each: what NASA learned in space, and where it helps on Earth. All from ${quotes} sentences copied from NASA word for word, each one checked by the code.`) })),
    h("section", { class: "card eq-key" },
      h("div", { class: "kicker", text: L("أهم اكتشاف للقاعدة القمرية", "Key finding for a Moon base") }),
      h("h2", { text: AR() ? k.title_ar : k.title_en }),
      h("p", { text: AR() ? k.ar : k.en }),
      h("details", { class: "eq-more" }, h("summary", { text: L("اقرأ كلام ناسا الأصلي", "Read NASA's own words") }), k.quotes.map(quote), h("div", { class: "eq-link-head" }, invChip(k.acc), sourceLine(k)))),
    h("div", { class: "eq-grid" }, APPS.categories.map(category)),
    h("h2", { class: "eq-section", text: L("دروس من حرائق حقيقية", "Lessons from real fires") }),
    h("div", { class: "eq-lessons" }, APPS.lessons.map((l) => h("section", { class: "card eq-lesson" },
      h("h3", { class: "eq-title" }, icon("flame", "eq-ic hot"), AR() ? l.title_ar : l.title_en), h("p", { text: AR() ? l.ar : l.en }),
      h("details", { class: "eq-more" }, h("summary", { text: L("اقرأ كلام ناسا الأصلي", "Read NASA's own words") }), (l.quotes || [l.quote]).map(quote), sourceLine(l))))),
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
