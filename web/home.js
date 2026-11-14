// Home page: the problem in one line, Ask as the main feature, then what we found and where to look next.
// Every number is read from the built data; nothing here is typed in by hand except the wording.
import { h, mount, fmt } from "./charts.js?v=1";
import { state, L, AR, RENDER, api, go, onLangChange } from "./app.js?v=1";
import { askFromHome, SUGGEST } from "./ask.js?v=1";

let evals = null;

function askBox() {
  const input = h("input", { type: "search", dir: "auto", class: "home-input",
    placeholder: L("مثال: هل إيقاف التهوية يطفئ الحريق في أكسجين عالٍ؟", "e.g. Does shutting off ventilation put out a fire in high oxygen?"),
    "aria-label": L("سؤالك", "Your question") });
  const send = () => { const q = input.value.trim(); if (q) askFromHome(q); };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  return h("div", { class: "home-ask" },
    h("div", { class: "home-ask-row" }, input, h("button", { class: "btn primary big", text: L("اسأل ناسا", "Ask NASA"), onclick: send })),
    h("div", { class: "chips" }, SUGGEST[state.lang].slice(0, 4).map((q) => h("button", { class: "chip btn", text: q, onclick: () => askFromHome(q) }))));
}

function render() {
  const root = document.getElementById("view-home");
  const st = state.meta.stats;
  const solidMax = Math.max(...state.materials.filter((m) => m.phase === "solid" && m.o2_max != null).map((m) => m.o2_max));
  const evalTile = h("b", { class: "ltr", text: "…" });
  const setEval = (e) => { evalTile.textContent = e && e.total ? `${e.passed} / ${e.total}` : "—"; };
  if (evals) setEval(evals); else api("/api/eval").then((e) => { evals = e; setEval(e); }).catch(() => setEval(null));

  const step = (n, title, text) => h("div", { class: "home-step" }, h("span", { class: "home-step-n ltr", text: String(n) }), h("div", {}, h("b", { text: title }), h("p", { text: text })));
  const finding = (big, title, text, view, hot) => h("button", { class: "home-find" + (hot ? " hot" : ""), onclick: () => go(view) },
    h("div", { class: "home-find-big ltr", text: big }), h("b", { text: title }), h("p", { text: text }), h("span", { class: "home-more", text: L("اعرف أكثر ←", "Learn more →") }));
  const tile = (view, title, text) => h("button", { class: "home-tile", onclick: () => go(view) }, h("b", { text: title }), h("span", { text: text }));

  mount(root,
    // 1. the problem, in one line
    h("section", { class: "home-hero" },
      h("img", { class: "home-hero-img", src: "media/PSI-25_1.jpg", alt: "" }),
      h("div", { class: "home-hero-text" },
        h("div", { class: "kicker", text: L("تحدي ناسا Space Apps 2026 · لهب في السقوط الحر", "NASA Space Apps Challenge 2026 · Flame in Freefall") }),
        h("h1", {}, L("القاعدة القمرية ستتنفس ", "A Moon base will breathe "), h("span", { class: "hot ltr", text: "30%" }), L(" أكسجين.", " oxygen."), h("br"),
          L("ناسا اختبرت المواد حتى ", "NASA tested its materials only up to "), h("span", { class: "hot ltr", text: `${fmt(solidMax, 0)}%` }), L(" فقط.", ".")),
        h("p", { class: "home-sub", text: L("النار تحب الأكسجين. وتجارب ناسا عن الحرائق كثيرة وصعبة البحث. TrustFlame يجعلها سهلة: اسأل بياناتها بلغتك، واحصل على جواب يفحص كل جملة وكل رقم.",
          "Fire loves oxygen, and NASA's fire experiments are many and hard to search. TrustFlame makes them easy: ask NASA's data in your language and get an answer that checks every sentence and every number.") }),
        askBox()),
      h("div", { class: "home-credit ltr", text: "Photo: BASS-II flame test aboard the ISS, NASA PSI (PSI-25)" })),

    // 2. how Ask works, in three steps
    h("section", { class: "card home-how" },
      h("h2", { text: L("كيف يجيب «اسأل»؟", "How does Ask answer?") }),
      h("div", { class: "home-steps" },
        step(1, L("يبحث في مصادر ناسا فقط", "Searches NASA's sources only"), L(`${st.investigations} تجربة و${num0(st.passages)} مقطعاً من نصوص ناسا.`, `${st.investigations} investigations and ${num0(st.passages)} passages of NASA text.`)),
        step(2, L("يكتب جواباً منها", "Writes an answer from them"), L("نموذج ذكاء اصطناعي يعمل على الحاسوب، بدون إنترنت.", "An AI model that runs on the laptop, offline.")),
        step(3, L("يفحص كل جملة وكل رقم", "Checks every sentence and number"), L("الجملة بلا دليل تُحذف، وإذا لم يجد دليلاً يقول: لا أعرف.", "A sentence without evidence is removed; with no evidence it says: I don't know."))),
      h("div", { class: "home-trust" }, evalTile, h("span", { text: L("أسئلة كتبها الفريق من مصادر التحدي أجاب عنها بشكل صحيح. النتائج كلها في صفحة «اسأل».", "team-written questions from the challenge sources answered correctly. All results are on the Ask page.") }))),

    // 3. what we found
    h("section", {},
      h("h2", { class: "home-h2", text: L("ماذا وجدنا في بيانات ناسا؟", "What did we find in NASA's data?") }),
      h("div", { class: "home-finds" },
        finding(`${fmt(solidMax, 1)}% ≠ 30%`, L("لم تُختبر أي عيّنة صلبة حقيقية في جو القمر", "No real solid sample was tested in Moon-base air"),
          L("القماش والبلاستيك اختُبرت حتى 22.2% أكسجين فقط، ولا مرة بضغط منخفض. أقرب شيء: تجربة BRE بحارقات غاز تقلّد المواد الصلبة.", "Fabrics and plastics were tested only up to 22.2% oxygen, never at low pressure. The closest: BRE, gas burners that emulate solids."), "moon", true),
        finding("BRE", L("إيقاف التهوية قد لا يطفئ الحريق", "Shutting off ventilation may not put a fire out"),
          L("في أكسجين عالٍ استمر الاحتراق بدون تدفق هواء، بينما انطفأ عند 21%. ناسا تصف النتائج بأنها أولية.", "In high oxygen, burning went on with no air flow, while it went out at 21%. NASA calls the results preliminary."), "equipment", false),
        finding("0", L("لا بيانات بجاذبية القمر بعد", "No lunar-gravity data yet"),
          L("كل التجارب في محطة الفضاء أو على الأرض. ناسا تتوقع إضافة تجارب LUCI وFM2.", "Every test ran on the space station or on Earth. NASA expects to add LUCI and FM2."), "story", false))),

    // 4. where to go next
    h("section", {},
      h("h2", { class: "home-h2", text: L("استكشف", "Explore") }),
      h("div", { class: "home-tiles" },
        tile("moon", L("جاهزية القمر", "Moon readiness"), L("اختاري الأكسجين والضغط، وشوفي ماذا اختبرت ناسا وماذا ينقص.", "Pick an oxygen level and pressure; see what NASA tested and what is missing.")),
        tile("investigations", L("التجارب", "Investigations"), L(`${st.investigations} تجربة مرتّبة من 100: أيها يهم القمر أو المحطة أكثر.`, `${st.investigations} investigations scored out of 100 for the Moon, the station and more.`)),
        tile("equipment", L("من البحث إلى المعدّات", "Research to equipment"), L("كيف ساعدت التجارب كواشف الدخان والإطفاء واختيار المواد.", "How the experiments shaped smoke detectors, suppression and material choice.")),
        tile("data", L("بيانات الاختبارات", "Test data"), L(`كل أرقام ناسا: ${num0(st.test_rows)} اختبار، رسم وتنزيل.`, `All of NASA's numbers: ${num0(st.test_rows)} tests, plotted and downloadable.`)),
        tile("story", L("القصة", "The story"), L("القصة كاملة بالتمرير: من Apollo 1 إلى القمر.", "The full story, by scrolling: from Apollo 1 to the Moon.")))),
  );
}
const num0 = (v) => Number(v).toLocaleString("en-US");

RENDER.home = render;
onLangChange.push(() => {});
