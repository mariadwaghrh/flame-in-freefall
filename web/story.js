// Home page: the story told by scrolling. A sticky stage (real NASA flame video, charts) changes as each text step passes.
// Every quote on this page is copied word for word from a NASA source; every number is read from the built data;
// the worked example is a saved real run of the pipeline (src/examples.py), not a mock-up.
import { h, mount, fmt } from "./charts.js?v=1";
import { state, L, AR, RENDER, api, fuel, num, go, onLangChange } from "./app.js?v=1";

const SRC = {
  challenge: ["NASA Space Apps: Flame in Freefall", "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/"],
  apollo: ["NASA Safety and Mission Assurance: Apollo 1", "https://sma.nasa.gov/sma-disciplines/accllp/apollo-1"],
  mir: ["NASA History: Fire Aboard Space Station Mir", "https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/"],
};
let observer = null, onScroll = null, extras = { examples: null, evals: null };

const quote = (text, src) => h("figure", { class: "st-quote" },
  h("blockquote", { class: "ltr", dir: "ltr", text: "“" + text + "”" }),
  h("figcaption", {}, h("a", { href: SRC[src][1], target: "_blank", rel: "noopener", text: SRC[src][0] + " ↗" })));

function video(file, start, credit, end) {
  const v = h("video", { src: `media/${file}#t=${start}`, muted: true, playsinline: true, preload: "metadata", "aria-hidden": "true" });
  v.muted = true;
  const again = () => { v.currentTime = start; v.play().catch(() => {}); };
  v.addEventListener("ended", again);
  if (end) v.addEventListener("timeupdate", () => { if (v.currentTime >= end) again(); });
  return [v, h("div", { class: "st-shade" }), h("div", { class: "st-credit ltr", dir: "ltr", text: credit })];
}

function countUp(el, to, decimals = 0) {
  const show = (v) => { el.textContent = Number(v).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return show(to);
  const t0 = performance.now(), dur = 1100;
  const tick = (t) => { const p = Math.min(1, (t - t0) / dur); show(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

// ---------- stage layers ----------
function gapChart() {
  const solids = state.materials.filter((m) => m.phase === "solid" && m.o2_max != null).sort((a, b) => b.o2_max - a.o2_max).slice(0, 5);
  const top = Math.max(...solids.map((m) => m.o2_max)), MAX = 40, pct = (v) => (v / MAX) * 100;
  return h("div", { class: "st-viz gap-chart" },
    h("div", { class: "viz-title", text: L("أعلى أكسجين اختُبرت فيه كل مادة صلبة", "Highest oxygen each solid material was tested at") }),
    h("div", { class: "gap-rows ltr", dir: "ltr" },
      h("div", { class: "gap-zone", style: `left:${pct(top)}%;width:${pct(30) - pct(top)}%` }, h("span", { dir: "auto", text: L("لا بيانات", "no data") })),
      h("div", { class: "gap-line earth", style: `left:${pct(21)}%` }, h("span", { dir: "auto", text: L("الأرض 21%", "Earth 21%") })),
      h("div", { class: "gap-line moon", style: `left:${pct(30)}%` }, h("span", { dir: "auto", text: L("القمر 30%", "Moon 30%") })),
      solids.map((m, i) => h("div", { class: "gap-row" },
        h("div", { class: "gap-name" }, h("span", { dir: "auto", text: fuel(m.name) }), h("b", { text: `${fmt(m.o2_max, 1)}%` })),
        h("div", { class: "gap-track" }, h("i", { style: `--w:${pct(m.o2_max)}%;--i:${i}` }))))),
    h("div", { class: "viz-note", text: L(`صفوف اختبار لمواد صلبة عند 30% أكسجين أو أكثر: 0`, `Test rows of solid materials at 30% oxygen or more: 0`) }),
    h("div", { class: "viz-foot", text: L("المواد الصلبة التي سجّلت ناسا أكسجينها. خمس مواد أخرى (Kapton، Teflon، فتيل، رغوة Pyrell، Ultem) من تجارب الدخان SAME بلا أكسجين مسجّل.", "Solid materials whose oxygen NASA recorded. Five more (Kapton, Teflon, lamp wick, Pyrell foam, Ultem) come from the SAME smoke tests, with no oxygen recorded.") }));
}

function moonBars() {
  const bars = [[21, L("هواء الأرض", "Earth's air"), "14.7 psi"], [30, L("قاعدة القمر", "Moon base"), "≤ 10.2 psi"], [100, L("بدلة الفضاء", "Spacesuit"), "4.3 psi"]];
  return h("div", { class: "st-viz vbars" },
    h("div", { class: "viz-title", text: L("نسبة الأكسجين في ما يتنفسه الطاقم", "Share of oxygen in what the crew breathes") }),
    h("div", { class: "vbars-row" }, bars.map(([v, name, p], i) => h("div", { class: "vbar" + (i === 1 ? " hot" : "") },
      h("div", { class: "vbar-val ltr", text: (i === 1 ? "≥ " : "") + v + "%" }),
      h("div", { class: "vbar-track" }, h("i", { style: `--h:${v}%;--i:${i}` })),
      h("div", { class: "vbar-name", text: name }), h("div", { class: "vbar-sub ltr", text: p })))));
}

function pipeline() {
  const st = state.meta.stats;
  const steps = [
    [L("السؤال", "Question"), L("بالعربية أو الإنجليزية", "in Arabic or English")],
    [L("البحث", "Search"), L(`في ${num(st.passages)} مقطعاً من مصادر ناسا`, `${num(st.passages)} passages from NASA sources`)],
    [L("المسودة", "Draft"), L("نموذج محلي، بدون إنترنت، من المقاطع فقط", "a local model, offline, from the passages only")],
    [L("صمام الأمان", "Guardrail"), L("يفحص كل جملة وكل رقم مقابل الدليل", "checks every sentence and every number against the evidence")],
    [L("النتيجة", "Result"), L("جواب موثّق، أو حذف الجملة، أو امتناع", "a verified answer, a removed sentence, or a refusal")],
  ];
  return h("ol", { class: "st-viz pipe" }, steps.map(([a, b], i) => h("li", { style: `--i:${i}`, class: i === 3 ? "guard" : "" },
    h("span", { class: "pipe-n ltr", text: String(i + 1) }), h("div", {}, h("b", { text: a }), h("div", { class: "pipe-sub", text: b })))));
}

function proof() {
  const box = h("div", { class: "st-viz proof" }, h("div", { class: "viz-note", text: L("جاري تحميل المثال المحفوظ…", "Loading the saved run…") }));
  const fill = () => {
    const ex = (extras.examples && extras.examples.examples) || [];
    // prefer a run where the guardrail removed something, then the one with the most checked numbers
    const answered = ex.find((e) => e.decision === "partial") || ex.find((e) => e.decision === "accepted" && /BASS-II/.test(e.q)) || ex.find((e) => e.decision === "accepted");
    const declined = ex.find((e) => e.why === "off_topic");
    if (!answered) return mount(box, h("div", { class: "viz-note", text: L("شغّل python src/examples.py لحفظ أمثلة حقيقية.", "Run python src/examples.py to save real examples.") }));
    const mark = { supported: ["ok", "✓", L("مدعومة", "supported")], weak: ["warn", "∼", L("دعم ضعيف", "weak")], unsupported: ["bad", "✕", L("حُذفت", "removed")], meta: ["meta", "i", ""] };
    mount(box,
      h("div", { class: "proof-q ltr", dir: "ltr", text: answered.q }),
      answered.claims.slice(0, 4).map((c) => h("div", { class: "proof-claim " + mark[c.verdict][0] },
        h("span", { class: "badge " + mark[c.verdict][0], text: `${mark[c.verdict][1]} ${mark[c.verdict][2]}` }),
        h("div", { class: "ltr", dir: "ltr" }, h("p", { text: c.text }),
          h("div", { class: "proof-src", text: `${c.verdict === "unsupported" ? (c.why.startsWith("number_missing") ? "number not in the evidence: " + c.why.split(":")[1] : "no matching evidence") : "evidence: " + c.cite} · ${fmt(c.score, 2)}` })))),
      declined && h("div", { class: "proof-declined" },
        h("div", { class: "proof-q ltr", dir: "ltr", text: declined.q }),
        h("span", { class: "badge bad", text: L("✕ امتنع: خارج مصادر ناسا", "✕ declined: outside NASA sources") })),
      h("div", { class: "viz-note", text: L(`تشغيل فعلي محفوظ بتاريخ ${extras.examples.date} على ${extras.examples.model}. النص المفحوص بالإنجليزية.`, `A real run saved on ${extras.examples.date} with ${extras.examples.model}.`) }));
  };
  if (extras.examples) fill(); else api("/api/examples").then((e) => { extras.examples = e || {}; fill(); }).catch(fill);
  return box;
}

function honesty() {
  const evalTile = h("div", { class: "tile" }, h("b", { class: "ltr", text: "…" }), h("span", { text: L("في اختبار كتبه الفريق من مصادر التحدي", "on the test our team wrote from the challenge resources") }));
  const set = (e) => { if (e && e.total) evalTile.firstChild.textContent = `${e.passed} / ${e.total}`; else evalTile.hidden = true; };
  if (extras.evals) set(extras.evals); else api("/api/eval").then((e) => { extras.evals = e || {}; set(e); }).catch(() => set(null));
  return h("div", { class: "st-viz tiles" },
    evalTile,
    h("div", { class: "tile" }, h("b", { text: L("1–2 دقيقة", "1–2 min") }), h("span", { text: L("لكل جواب على لابتوب عادي بدون إنترنت", "per answer on an ordinary laptop, offline") })),
    h("div", { class: "tile" }, h("b", { text: L("ترجمة آلية", "Machine translation") }), h("span", { text: L("الجواب المفحوص بالإنجليزية. الترجمة العربية يكتبها نموذج صغير وقد تخطئ في المعنى، فنعرضها تحت النص الإنجليزي لا بدلاً منه", "the checked answer is English. The Arabic translation comes from a small model and can be wrong in meaning, so it is shown under the English text, not instead of it") })),
    h("div", { class: "tile" }, h("b", { text: L("لا جاذبية قمرية", "No lunar gravity") }), h("span", { text: L("لا توجد في PSI بيانات جاذبية جزئية بعد، فلا نتنبأ بها", "PSI has no partial-gravity data yet, so we do not predict it") })),
    h("div", { class: "tile" }, h("b", { text: L("ليس NLI", "Not NLI") }), h("span", { text: L("الفحص تشابه معنى + مطابقة أرقام، وعتباته ضُبطت يدوياً", "the check is meaning similarity plus number matching, with hand-set thresholds") })));
}

// ---------- the page ----------
function render() {
  const root = document.getElementById("view-story");
  if (root.dataset.ready === state.lang) return;
  root.dataset.ready = state.lang;
  if (observer) observer.disconnect();
  if (onScroll) removeEventListener("scroll", onScroll);
  const st = state.meta.stats;
  const solidMax = Math.max(...state.materials.filter((m) => m.phase === "solid" && m.o2_max != null).map((m) => m.o2_max));
  const high = state.catalog.filter((i) => i.o2_range && i.o2_range[1] >= 30).length;
  const counters = [[st.investigations, 0, L("تجربة احتراق", "combustion investigations")], [st.test_rows, 0, L("صف اختبار", "test rows")], [st.archive_tib, 1, L("TiB في الأرشيف", "TiB in the archive")]]
    .map(([v, d, label]) => ({ v, d, el: h("b", { class: "ltr", text: "0" }), label }));

  // [layer key, layer content, step content]
  const chapters = [
    ["flame", video("PSI-159_2.mp4", 23, "Real video, brightened for display: CFI-G flame on the ISS, NASA PSI (PSI-159)", 62), [
      h("div", { class: "kicker", text: L("تحدي ناسا Space Apps 2026 · لهب في السقوط الحر", "NASA Space Apps Challenge 2026 · Flame in Freefall") }),
      h("h1", { text: L("في الفضاء، النار لا تشبه النار التي تعرفها", "In space, fire is not the fire you know") }),
      h("p", { text: L("هذا لهب حقيقي صوّرته ناسا على محطة الفضاء الدولية: بعد الاشتعال يصير كرة زرقاء.", "This is a real flame NASA filmed on the International Space Station: after ignition it becomes a blue sphere.") }),
      quote("Instead of a flickering teardrop, a candle flame becomes a ghostly blue sphere reliant on diffusion for its oxygen.", "challenge"),
      h("div", { class: "cta" }, h("span", { class: "st-hint", text: L("مرّر للأسفل ↓", "Scroll ↓") }),
        h("button", { class: "btn ghost", text: L("تخطَّ إلى لوحة البيانات", "Skip to the dashboard"), onclick: () => go("overview") }))]],
    ["apollo", h("div", { class: "st-viz bignum" }, h("div", { class: "bn-year ltr", text: "1967" }), h("div", { class: "bn-val ltr", text: "100%" }), h("div", { class: "bn-label", text: L("أكسجين في المقصورة", "oxygen in the cabin") })), [
      h("div", { class: "kicker", text: "Apollo 1" }),
      h("h2", { text: L("حريق لم يترك وقتاً لفتح الباب", "A fire that left no time to open the hatch") }),
      quote("During the test, a flash fire swept through the spacecraft so quickly, there was no time to open the hatches.", "apollo"),
      h("p", {}, L("اختبار على منصة الإطلاق، والمقصورة مضغوطة بأكسجين 100%. لم ينجُ رواد الفضاء الثلاثة: ", "A launch-pad test, the cabin pressurised with 100% oxygen. The three astronauts did not survive: "),
        h("span", { class: "ltr", dir: "ltr", text: "Grissom, White, Chaffee" }), "."),
      h("p", { class: "after", text: L("بعدها: باب يُفتح في ثلاث ثوانٍ، وتقييد المواد القابلة للاشتعال داخل المركبة.", "Afterwards: a hatch that opens in three seconds, and limits on combustible material inside the spacecraft.") })]],
    ["mir", h("div", { class: "st-viz bignum" }, h("div", { class: "bn-year ltr", text: "1997" }), h("div", { class: "bn-val ltr", text: "6" }), h("div", { class: "bn-label", text: L("رواد على متن محطة Mir", "crew members aboard Mir") })), [
      h("div", { class: "kicker", text: L("محطة Mir", "Space station Mir") }),
      h("h2", { text: L("لهب أغلق طريق الهروب", "A flame that blocked the way out") }),
      quote("The flame blocked the evacuation route to the Soyuz spacecraft docked at the aft end of Kvant-1", "mir"),
      h("p", { text: L("اشتعل مولّد أكسجين. السبب الأرجح: مادة من قفاز لاتكس دخلت العبوة بالخطأ. ناسا تصفه بهذه الكلمات:", "An oxygen generator ignited. The most likely cause: latex glove material left inside the canister. NASA describes it in these words:") }),
      quote("the worst in-orbit fire incident in the history of spaceflight.", "mir")]],
    ["moon", moonBars(), [
      h("div", { class: "kicker", text: L("الآن", "Now") }),
      h("h2", { text: L("نعود إلى القمر، بأكسجين أكثر", "We are going back to the Moon, with more oxygen") }),
      quote("The intermediate oxygen concentration used on the Moon will likely be 30% or greater, with a corresponding pressure of 10.2 psi or less. Compared to Earth's atmosphere, that's more than a 40% increase in the oxygen concentration making materials much more flammable.", "challenge")]],
    ["data", [video("PSI-26_1.mp4", 9, "Real video: BASS test on the ISS, 30 April 2013, NASA PSI (PSI-26)"),
      h("div", { class: "st-viz counters" }, counters.map((c) => h("div", { class: "counter" }, c.el, h("span", { text: c.label }))))], [
      h("div", { class: "kicker", text: L("المشكلة", "The problem") }),
      h("h2", { text: L("ناسا أجرت التجارب، لكن الصعب هو إيجاد الجواب", "NASA ran the experiments, but finding the answer is the hard part") }),
      quote("the amount of data can be overwhelming. It can be hard to find, harder to compare, and harder yet to interpret.", "challenge"),
      h("p", { text: L("قرأنا كل سجلات الاحتراق في قاعدة بيانات ناسا (PSI) وكل جداول اختباراتها، ووحّدنا الأكسجين والضغط والتدفق وأسماء المواد على مقياس واحد.", "We read every combustion record in NASA's PSI database and every test table, and put oxygen, pressure, flow and material names on one scale.") })]],
    ["gap", gapChart(), [
      h("div", { class: "kicker", text: L("ما وجدناه", "What we found") }),
      h("h2", { text: L(`لم تُختبر أي عيّنة صلبة حقيقية فوق ${fmt(solidMax, 1)}% أكسجين`, `No real solid sample was tested above ${fmt(solidMax, 1)}% oxygen`) }),
      h("p", { text: L(`${high} تجارب وصلت إلى 30% أو أكثر، لكنها كلها تحرق غازاً أو سائلاً. الأقمشة والبلاستيك التي ستكون داخل القاعدة القمرية لم تُختبر في جوّها، ولا عند ضغط منخفض. أقرب ما وصلت إليه ناسا تجربة BRE: حارقات غاز تقلّد احتراق المواد الصلبة، حتى 34% أكسجين بضغط 8.2 psi. لكنها ليست عيّنات صلبة حقيقية.`,
        `${high} investigations reach 30% or more, but all of them burn a gas or a liquid. The fabrics and plastics that will sit inside a Moon base were not tested in its atmosphere, nor at reduced pressure. The closest NASA came is BRE: gas burners that emulate burning solids, up to 34% oxygen at 8.2 psi. They are not real solid samples.`) }),
      h("div", { class: "cta" }, h("button", { class: "btn primary", text: L("ماذا يجب أن تختبر ناسا؟", "What should NASA test next?"), onclick: () => { go("moon"); setTimeout(() => document.querySelector(".next-card")?.scrollIntoView({ block: "start" }), 300); } }))]],
    ["how", pipeline(), [
      h("div", { class: "kicker", text: L("كيف يعمل TrustFlame", "How TrustFlame works") }),
      h("h2", { text: L("لا جملة بلا دليل، ولا رقم بلا مصدر", "No sentence without evidence, no number without a source") }),
      h("p", { text: L("في هندسة الفضاء، رقم واحد مخترع قد يكلّف مهمة. لذلك لا تُعرض المسودة أبداً قبل فحصها: الجملة غير المدعومة تُحذف أمامك، والرقم غير الموجود عند ناسا يُسقط جملته، وإذا بقي القليل يمتنع النظام بدل أن يخمّن.",
        "In space engineering one invented number can cost a mission. So a draft is never shown before it is checked: an unsupported sentence is removed in front of you, a number that NASA never wrote takes its sentence down, and if too little survives the system declines instead of guessing.") })]],
    ["proof", proof(), [
      h("div", { class: "kicker", text: L("الدليل", "The proof") }),
      h("h2", { text: L("تشغيل حقيقي، لا عرض مُعدّ", "A real run, not a staged demo") }),
      h("p", { text: L("هذه نتيجة فعلية محفوظة من النظام: السؤال، كل جملة في الجواب، حكم صمام الأمان عليها، ودرجة تشابهها مع أقرب دليل من ناسا.", "This is a saved real result: the question, every sentence of the answer, the guardrail's verdict on it, and its similarity to the closest NASA evidence.") }),
      h("div", { class: "cta" }, h("button", { class: "btn primary", text: L("اسأل بنفسك", "Ask it yourself"), onclick: () => go("ask") }))]],
    ["honest", honesty(), [
      h("div", { class: "kicker", text: L("ما لا نخفيه", "What we do not hide") }),
      h("h2", { text: L("حدود النظام، كما هي", "The system's limits, as they are") }),
      h("p", { text: L("هذا نموذج أولي للبحث في بيانات ناسا، وليس أداة تشغيلية للسلامة. عدم وجود اختبار لا يعني أن المادة آمنة أو خطرة، بل يعني أنه لا توجد بيانات.", "This is a prototype for searching NASA's data, not an operational safety tool. A missing test does not mean a material is safe or dangerous; it means there is no data.") })]],
    ["next", h("div", { class: "st-viz tiles" },
        h("div", { class: "tile" }, h("b", { text: L("بلا تكلفة تشغيل", "No running cost") }), h("span", { text: L("نماذج مفتوحة تعمل على لابتوب واحد: لا سحابة، لا اشتراك، لا إنترنت بعد التنزيل الأول", "open models on one laptop: no cloud, no subscription, no internet after the first download") })),
        h("div", { class: "tile" }, h("b", { text: L("6 أوامر", "6 commands") }), h("span", { text: L("تعيد بناء كل شيء من مواقع ناسا عندما تُضاف بيانات جديدة إلى PSI", "rebuild everything from NASA's sites when new data is added to PSI") })),
        h("div", { class: "tile" }, h("b", { class: "ltr", text: "Apache-2.0" }), h("span", { text: L("الكود مفتوح: أي فريق يستطيع تشغيله وصيانته وتطويره", "open source: any team can run, maintain and extend it") })),
        h("div", { class: "tile" }, h("b", { class: "ltr", text: "LUCI · FM2" }), h("span", { text: L("تجارب الجاذبية القمرية التي تتوقع ناسا إضافتها. مكانها جاهز في الموقع", "the lunar-gravity experiments NASA expects to add. Their place in the site is ready") }))), [
      h("div", { class: "kicker", text: L("ماذا بعد", "What comes next") }),
      h("h2", { text: L("مبني ليستمر بعد الهاكاثون", "Built to last after the hackathon") }),
      quote("We expect such data will be added in the future, for example from the Lunar-g Combustion Investigation (LUCI) and the Flammability of Materials on the Moon (FM2) experiment.", "challenge"),
      h("p", { text: L("خطواتنا القادمة: إدخال بيانات الجاذبية القمرية عند نشرها، نموذج أقوى للترجمة العربية، وتحليل الفيديو الخام في أرشيف ناسا.", "Our next steps: add lunar-gravity data when it is published, a stronger model for Arabic translation, and analysis of the raw video in NASA's archive.") })]],
    ["end", [h("img", { src: "media/PSI-25_1.jpg", alt: "" }), h("div", { class: "st-shade" }), h("div", { class: "st-credit ltr", dir: "ltr", text: "Photo: BASS-II flame test aboard the ISS, NASA PSI (PSI-25)" })], [
      h("h2", { text: L("استكشف بنفسك", "Explore it yourself") }),
      h("div", { class: "st-links" },
        [["moon", L("جاهزية القمر", "Moon readiness"), L("ماذا اختبرت ناسا عند 30% أكسجين؟", "What did NASA test at 30% oxygen?")],
         ["ask", L("اسأل", "Ask"), L("جواب من مصادر ناسا فقط، مفحوص جملة بجملة", "Answers from NASA sources only, checked sentence by sentence")],
         ["equipment", L("من البحث إلى المعدّات", "Research to equipment"), L("كواشف الدخان، الإطفاء، التهوية، المواد", "Smoke detectors, suppression, ventilation, materials")],
         ["investigations", L("التجارب", "Investigations"), L(`${st.investigations} تجربة مرتّبة حسب بيئة الطاقم`, `${st.investigations} investigations ranked for a crew environment`)]]
          .map(([v, a, b]) => h("button", { class: "st-link", onclick: () => go(v) }, h("b", { text: a }), h("span", { text: b }))))]],
  ];

  const bar = h("i", {});
  const layers = chapters.map(([k, content]) => h("div", { class: "st-layer k-" + k, "data-k": k }, content));
  const steps = chapters.map(([k, , body], i) => h("section", { class: "st-step" + (i === 0 ? " first" : "") + (k === "end" ? " last" : ""), "data-i": i }, h("div", { class: "st-panel" }, body)));
  const story = h("div", { class: "story" }, h("div", { class: "st-progress", "aria-hidden": "true" }, bar), h("div", { class: "st-stage" }, layers), h("div", { class: "st-steps" }, steps));
  mount(root, story);
  story.style.setProperty("--tb", document.querySelector(".topbar").offsetHeight + "px");

  let counted = false;
  const activate = (i) => {
    layers.forEach((l, j) => {
      l.classList.toggle("on", j === i);
      l.querySelectorAll("video").forEach((v) => { if (j === i) v.play().catch(() => {}); else v.pause(); });
    });
    steps.forEach((s, j) => s.classList.toggle("on", j === i));
    if (i >= 0 && chapters[i][0] === "data" && !counted) { counted = true; counters.forEach((c) => countUp(c.el, c.v, c.d)); }
  };
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) activate(Number(e.target.dataset.i));
    if (root.hidden) activate(-1);
  }, { rootMargin: "-50% 0px -50% 0px" });
  steps.forEach((s) => observer.observe(s));
  onScroll = () => { if (root.hidden) return; const r = story.getBoundingClientRect(); bar.style.width = Math.max(0, Math.min(1, -r.top / (r.height - innerHeight))) * 100 + "%"; };
  addEventListener("scroll", onScroll, { passive: true });
  activate(0);
  // ?scene=gap opens the page on one scene (for screenshots, slides and recording the video)
  const scene = chapters.findIndex((c) => c[0] === new URLSearchParams(location.search).get("scene"));
  if (scene > 0) setTimeout(() => { steps[scene].scrollIntoView({ block: "center" }); activate(scene); onScroll(); }, 200);
}

RENDER.story = render;
onLangChange.push(() => { delete document.getElementById("view-story").dataset.ready; });
