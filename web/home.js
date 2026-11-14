// Home page: the problem in one line, Ask as the main feature, then what we found and where to look next.
// Every number is read from the built data; nothing here is typed in by hand except the wording.
import { h, mount, fmt } from "./charts.js?v=1";
import { state, L, AR, RENDER, api, go, onLangChange } from "./app.js?v=1";
import { askInto, SUGGEST } from "./ask.js?v=1";
import { icon } from "./icons.js?v=1";

let evals = null;
const answers = h("div", { class: "view home-answers" });   // answers stay here while you move between pages

function askBox() {
  const input = h("input", { type: "search", dir: "auto", class: "home-input",
    placeholder: L("مثال: هل إيقاف التهوية يطفئ الحريق في أكسجين عالٍ؟", "e.g. Does shutting off ventilation put out a fire in high oxygen?"),
    "aria-label": L("سؤالك", "Your question") });
  const btn = h("button", { class: "btn primary big" }, icon("search"), L("اسأل ناسا", "Ask NASA"));
  const run = (q) => { q = (q || input.value).trim(); if (!q) return; input.value = ""; askInto(q, answers, btn);
    setTimeout(() => answers.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };
  btn.addEventListener("click", () => run());
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  return h("div", { class: "home-ask" },
    h("div", { class: "home-ask-row" }, input, btn),
    h("div", { class: "chips" }, SUGGEST[state.lang].slice(0, 3).map((q) => h("button", { class: "chip btn", text: q, onclick: () => run(q) }))));
}

function render() {
  const root = document.getElementById("view-home");
  const solidMax = Math.max(...state.materials.filter((m) => m.phase === "solid" && m.o2_max != null).map((m) => m.o2_max));
  const evalTile = h("b", { class: "ltr", text: "…" });
  const setEval = (e) => { evalTile.textContent = e && e.total ? `${e.passed}/${e.total} (${Math.round(100 * e.passed / e.total)}%)` : "—"; };
  if (evals) setEval(evals); else api("/api/eval").then((e) => { evals = e; setEval(e); }).catch(() => setEval(null));
  const door = (ic, view, title, text) => h("button", { class: "home-door", onclick: () => go(view) },
    icon(ic, "home-door-ic"), h("b", { text: title }), h("span", { text: text }), h("span", { class: "home-go" }, L("افتح", "Open"), " ", icon("arrow", "flip")));

  mount(root,
    h("section", { class: "home-hero" },
      h("img", { class: "home-hero-img", src: "media/PSI-25_1.jpg", alt: "" }),
      h("div", { class: "home-hero-text" },
        h("div", { class: "kicker", text: L("تحدي ناسا Space Apps 2026 · لهب في السقوط الحر", "NASA Space Apps Challenge 2026 · Flame in Freefall") }),
        h("h1", {}, L("محرّك بحث موثوق لأرشيف حرائق ناسا", "A trusted search engine for NASA's space-fire archive")),
        h("p", { class: "home-sub", text: L(`${state.meta.stats.investigations} تجربة و${num0(state.meta.stats.test_rows)} اختبار عن النار في الفضاء، في مكان واحد. اسأل بلغتك، وكل جملة وكل رقم في الجواب يُفحص مقابل ملفات ناسا.`,
          `${state.meta.stats.investigations} experiments and ${num0(state.meta.stats.test_rows)} tests on fire in space, in one place. Ask in your language; every sentence and number in the answer is checked against NASA's files.`) }),
        askBox()),
      h("div", { class: "home-credit ltr", text: "Photo: BASS-II flame test aboard the ISS, NASA PSI (PSI-25)" })),
    h("div", { class: "home-doors" },
      door("search", "investigations", L("قارن التجارب", "Compare the experiments"), L("التجارب الأربع والعشرون مرتّبة من 100، مع تنزيل البيانات.", "All 24 ranked out of 100, with data to download.")),
      door("moon", "moon", L("جاهزية القمر", "Moon readiness"), L(`ماذا اختُبر عند 30% أكسجين؟ المواد الصلبة توقفت عند ${fmt(solidMax, 1)}%.`, `What was tested at 30% oxygen? Solid materials stop at ${fmt(solidMax, 1)}%.`)),
      door("shield", "ask", L("اسأل المساعد الموثوق", "Ask the verified assistant"), L("جواب من مصادر ناسا فقط، وإذا لم يجد دليلاً يقول: لا أعرف.", "Answers from NASA sources only; with no evidence it says: I don't know."))),
    answers,
    h("p", { class: "home-trust" }, icon("check", "home-trust-ic"), evalTile, h("span", { text: L("أسئلة كتبها الفريق من مصادر التحدي أجاب عنها بشكل صحيح.", "team-written questions from the challenge sources answered correctly.") })));
}
const num0 = (v) => Number(v).toLocaleString("en-US");

RENDER.home = render;
onLangChange.push(() => { answers.replaceChildren(); });
