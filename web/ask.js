// Ask: answers from NASA sources only. Every sentence is checked; removed sentences stay visible, struck through.
import { h, mount, fmt } from "./charts.js?v=1";
import { state, L, AR, RENDER, api, short, ltr, drawerExtras, onLangChange, go } from "./app.js?v=1";

export const SUGGEST = {
  ar: ["ما التجارب التي اختبرت أكسجين 30% أو أكثر، وبأي وقود؟", "هل إيقاف التهوية يطفئ الحريق في جو غني بالأكسجين؟", "ما المواد الصلبة التي أُحرقت في BASS-II وما نطاق الأكسجين؟",
    "كيف قيس الدخان في تجربتي SAME وSAME-R؟", "ماذا تعلّمت ناسا من حريق Apollo 1؟", "ما سبب حريق محطة Mir عام 1997؟"],
  en: ["Which investigations tested 30% oxygen or more, and with which fuels?", "Does shutting off ventilation put out a fire in high oxygen?", "What solid materials were burned in BASS-II and over what oxygen range?",
    "How was smoke measured in SAME and SAME-R?", "What did NASA learn from the Apollo 1 fire?", "What caused the fire on Mir in 1997?"],
};
const VERDICT = { supported: ["مدعومة", "Supported", "ok"], weak: ["دعم ضعيف", "Weak", "warn"], unsupported: ["حُذفت", "Removed", "bad"], meta: ["ملاحظة", "Note", "meta"],
  accepted: ["تم التحقق", "Verified", "ok"], partial: ["تحقق جزئي", "Partly verified", "warn"], abstained: ["امتنع عن الإجابة", "Declined", "bad"] };
const badge = (v) => h("span", { class: "badge " + VERDICT[v][2] }, ({ ok: "✓ ", warn: "∼ ", bad: "✕ ", meta: "i " })[VERDICT[v][2]], VERDICT[v][AR() ? 0 : 1]);
const scope = { only: "", busy: false };
let runner = null, pending = null;          // the home page hands its question to the Ask page
export function askFromHome(q) { pending = q; go("ask"); if (runner) { const p = pending; pending = null; runner(p); } }

function why(res) {
  if (res.decision === "accepted") return L("كل جملة مدعومة بأدلة من ناسا.", "Every sentence is supported by NASA evidence.");
  if (res.decision === "partial") return L(`حُذفت ${res.removed} جملة غير مدعومة.`, `${res.removed} unsupported sentence(s) removed.`);
  if (res.why === "off_topic") return L("السؤال خارج قاعدة معرفة ناسا عن الاحتراق.", "The question is outside NASA's combustion knowledge base.");
  if (res.why === "model_insufficient") return L("النموذج نفسه قال إن الأدلة غير كافية.", "The model itself said the evidence is insufficient.");
  return L("قليل من الجمل مدعوم بالأدلة، فامتنع النظام بدل التخمين.", "Too few sentences were supported, so the system declined instead of guessing.");
}
const evidenceList = (list) => h("div", { class: "evidence" }, list.map((e) => {
  const card = h("div", { class: "ev", dir: "ltr" }, h("div", { class: "ev-head" }, h("a", { href: e.url, target: "_blank", rel: "noopener", text: `${e.cite} / ${e.section}` }),
    e.similarity != null && h("span", { text: `sim ${fmt(e.similarity, 2)}` })), h("p", { text: e.text }));
  card.addEventListener("click", (ev) => { if (ev.target.tagName !== "A") card.classList.toggle("open"); });
  return card;
}));

export function verified(res, { pendingAr = false } = {}) {
  const box = h("div", { class: "ai" }, h("div", { class: "ai-head" }, badge(res.decision), h("span", { class: "why", text: why(res) })));
  if (res.decision === "abstained") box.append(h("div", { class: "ai-text", text: AR() ? res.final_ar || "الأدلة المسترجعة غير كافية لإجابة موثوقة." : res.final }));
  else {
    // the checked text is English, so it is always shown as the answer; the Arabic below is a convenience translation
    box.append(h("div", { class: "ai-text", dir: "ltr", text: res.final }));
    if (AR() && res.final_ar) box.append(h("details", { class: "ai-ar" },
      h("summary", { class: "ai-ar-label", text: "ترجمة آلية تقريبية إلى العربية (اضغط للعرض)" }),
      h("div", { class: "ai-text", text: res.final_ar }),
      h("div", { class: "stats", text: "النص الإنجليزي أعلاه هو الذي فُحص وهو المرجع. الترجمة يكتبها نموذج صغير يعمل على الحاسوب: تُفحص فيها الأرقام والأسماء، لكنها قد تخطئ في المعنى." + (res.translation_ok === false ? " بعض الجمل بقيت بالإنجليزية لأن ترجمتها لم تجتز الفحص." : "") })));
    else if (AR() && pendingAr) box.append(h("div", { class: "why" }, h("span", { class: "spinner" }), " جاري الترجمة إلى العربية…"));
  }
  if (res.claims && res.claims.length) box.append(h("details", {}, h("summary", { text: L(`التحقق جملة بجملة (${res.claims.length})`, `Sentence-by-sentence check (${res.claims.length})`) }),
    h("div", { class: "claims" }, res.claims.map((c) => h("div", { class: "claim " + c.verdict }, badge(c.verdict),
      h("div", {}, h("div", { class: "c-text", dir: "ltr", text: c.text }),
        h("div", { class: "c-src", dir: "ltr" }, (c.why.startsWith("number_missing") ? `Number not in the evidence (${c.why.split(":")[1]}). ` : "") + `Closest evidence (${fmt(c.score, 2)}): `,
          c.evidence ? h("a", { href: c.evidence.url, target: "_blank", rel: "noopener", text: `${c.evidence.cite} / ${c.evidence.section}` }) : c.cite || "")))))));
  if (res.stats && res.stats.total_seconds) box.append(h("div", { class: "stats", dir: "ltr", text: `Local ${state.status ? state.status.llm_model : "LLM"}: ${res.stats.prompt_tokens} tokens read, ${res.stats.answer_tokens} written at ${res.stats.tok_per_sec} tok/s · guardrail ${res.stats.guardrail_seconds}s · total ${res.stats.total_seconds}s` }));
  return box;
}

function render() {
  const root = document.getElementById("view-ask");
  if (root.dataset.ready === state.lang) { root.querySelector("select").value = scope.only; return; }
  runner = null;
  root.dataset.ready = state.lang;
  const ta = h("textarea", { rows: 2, dir: "auto", placeholder: L("اسأل عن الوقود، حدود الأكسجين، انتشار اللهب، الدخان، الإخماد، حوادث Apollo…", "Ask about fuels, oxygen limits, flame spread, smoke, suppression, the Apollo fires…") });
  const send = h("button", { class: "btn primary big", text: L("اسأل", "Ask") }), log = h("div", { class: "view" }), evalBox = h("div", {});
  const sel = h("select", { onchange: (e) => { scope.only = e.target.value; } }, h("option", { value: "", text: L("كل المصادر", "All sources") }),
    state.catalog.map((i) => h("option", { value: i.acc, text: short(i), selected: i.acc === scope.only })));
  const go1 = (q) => { q = (q || ta.value).trim(); if (q && !scope.busy) { ta.value = ""; ask(q, log, send); } };
  send.addEventListener("click", () => go1());
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go1(); } });
  mount(root, h("div", { class: "ask-wrap" },
    h("div", { class: "card" },
      h("div", { class: "card-head" }, h("div", {},
        h("h1", { class: "ask-title", text: L("اسأل أرشيف ناسا عن الحرائق", "Ask NASA's fire archive") }),
        h("p", { class: "sub", text: L("يبحث في 24 تجربة و8 موارد للتحدي، ثم يكتب نموذج محلي (بدون إنترنت) جواباً منها فقط، ثم يفحص صمام الأمان كل جملة وكل رقم. الجمل غير المدعومة تُحذف أمامك، وإذا بقي القليل يمتنع بدل أن يخمّن.",
          "Searches 24 investigations and 8 challenge resources, a local model (no internet) drafts an answer from them only, then the guardrail checks every sentence and every number. Unsupported sentences are removed in front of you; if too little survives, it declines instead of guessing.") })),
        h("label", { class: "field" }, h("span", { text: L("ابحث في", "Search in") }), sel)),
      state.static && h("div", { class: "warn", text: L("في هذا الرابط العام: الأسئلة المقترحة تعرض أجوبة حقيقية محفوظة من النظام، وأي سؤال آخر يعرض أقرب مقاطع ناسا له. الجواب الكامل المفحوص يعمل على حاسوب الفريق، لأن النموذج يعمل بدون إنترنت.",
        "On this public link: the suggested questions show real saved answers from the system, and any other question shows the closest NASA passages. The full checked answer runs on the team's laptop, because the model works offline.") }),
      h("div", { class: "ask-form" }, ta, send),
      h("div", { class: "chips", style: "margin-top:12px" }, SUGGEST[state.lang].map((q) => h("button", { class: "chip btn", text: q, onclick: () => go1(q) }))),
      evalBox),
    log));
  api("/api/eval").then((e) => { if (e && e.total) mount(evalBox, evalLine(e)); }).catch(() => {});
  runner = go1;
  if (pending) { const p = pending; pending = null; go1(p); }
}

// Result of src/evaluate.py: the team's own test questions, written from the challenge resources
// ---------- public copy: keyword search (BM25) over NASA's passages ----------
// Arabic words are mapped to the English words NASA uses, since the sources are in English.
const AR_EN = { "أكسجين": "oxygen", "الأكسجين": "oxygen", "اكسجين": "oxygen", "حريق": "fire", "الحريق": "fire", "حرائق": "fire", "نار": "fire", "النار": "fire",
  "لهب": "flame", "اللهب": "flame", "دخان": "smoke", "الدخان": "smoke", "كاشف": "detector", "كواشف": "detector", "إطفاء": "suppression extinguish", "الإطفاء": "suppression extinguish",
  "تهوية": "ventilation", "التهوية": "ventilation", "مادة": "material", "مواد": "material", "المواد": "material", "صلبة": "solid", "قماش": "fabric", "بلاستيك": "plastic PMMA",
  "القمر": "moon lunar", "قمر": "moon lunar", "قمرية": "moon lunar", "ضغط": "pressure", "الضغط": "pressure", "جاذبية": "gravity microgravity", "الجاذبية": "gravity microgravity",
  "وقود": "fuel", "الوقود": "fuel", "قطيرة": "droplet", "قطيرات": "droplet", "انتشار": "spread", "اشتعال": "ignition flammability", "الاشتعال": "ignition flammability",
  "انطفاء": "extinction", "سخام": "soot", "محطة": "station", "رواد": "astronaut crew", "الطاقم": "crew", "مركبة": "spacecraft vehicle", "خزان": "tank", "خزانات": "tank",
  "هواء": "air flow", "الهواء": "air flow", "تدفق": "flow", "بارد": "cool", "حرارة": "heat temperature", "ميثانول": "methanol", "هبتان": "heptane", "نيتروجين": "nitrogen",
  "هيليوم": "helium", "الكربون": "carbon dioxide", "تجربة": "experiment investigation", "تجارب": "experiment investigation", "اختبار": "test", "سبب": "cause caused",
  "رجال": "firefighter", "الفضاء": "space microgravity", "يصعد": "rise buoyancy", "كروي": "spherical sphere", "كروية": "spherical sphere", "شمعة": "candle", "المحطة": "station", "Apollo": "apollo", "الإطفائيين": "firefighter", "بدلة": "spacesuit", "مريخ": "mars", "المريخ": "mars", "جسيمات": "particles", "عزل": "insulation" };
const STOP = new Set("the a an of in on at to for and or is are was were be by with what which how why does do did from that this it as its into".split(" "));
let PASSAGES = null;
const toks = (t) => (t.toLowerCase().match(/[a-z0-9][a-z0-9\-]*[a-z0-9]|[a-z0-9]/g) || []).filter((w) => !STOP.has(w));
async function searchPassages(question, k = 5) {
  if (!PASSAGES) {
    const docs = await api("/api/passages").catch(() => []);
    const df = new Map(), tf = docs.map((d) => { const m = new Map(); for (const w of toks(d.text + " " + d.cite + " " + d.section)) m.set(w, (m.get(w) || 0) + 1); return m; });
    tf.forEach((m) => m.forEach((_, w) => df.set(w, (df.get(w) || 0) + 1)));
    const avg = tf.reduce((n, m) => n + [...m.values()].reduce((a, b) => a + b, 0), 0) / Math.max(1, tf.length);
    PASSAGES = { docs, tf, df, avg };
  }
  const { docs, tf, df, avg } = PASSAGES, N = docs.length;
  const q = question.split(/[\s،,؟?.!()]+/).map((w) => AR_EN[w] || AR_EN[w.replace(/^و/, "")] || w).join(" ");
  const terms = [...new Set(toks(q))];
  if (!terms.length) return [];
  const scored = tf.map((m, i) => {
    const len = [...m.values()].reduce((a, b) => a + b, 0);
    let s = 0;
    for (const w of terms) { const f = m.get(w); if (!f) continue; const idf = Math.log(1 + (N - df.get(w) + 0.5) / (df.get(w) + 0.5)); s += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * len / avg)); }
    if (/Publications/.test(docs[i].section)) s *= 0.5;      // a list of paper titles is rarely the best answer
    return [s, i];
  }).filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]);
  if (!scored.length) return [];
  const best = tf[scored[0][1]], covered = terms.filter((w) => best.has(w)).length / terms.length;
  if (covered < 0.6) return [];                          // the closest passage shares too few words with the question
  const top = scored[0][0], out = [], per = new Map();
  for (const [s, i] of scored) {
    if (out.length >= k || s < top * 0.35) break;
    const key = docs[i].cite; if ((per.get(key) || 0) >= 2) continue;
    per.set(key, (per.get(key) || 0) + 1); out.push({ ...docs[i], similarity: null });
  }
  return out;
}

function evalLine(e) {
  const answered = e.results.filter((r) => r.expect === "answer"), declined = e.results.filter((r) => r.expect === "abstain");
  return h("details", { class: "eval" },
    h("summary", {}, h("span", { class: "badge " + (e.passed === e.total ? "ok" : "warn"), text: `${e.passed}/${e.total} (${Math.round(100 * e.passed / e.total)}%)` }),
      L(` اختبرناه على ${e.total} سؤالاً كتبها الفريق من مصادر التحدي (${answered.length} يجب أن يجيب عنها، و${declined.length} يجب أن يرفضها).`,
        ` Tested on ${e.total} questions the team wrote from the challenge resources (${answered.length} to answer, ${declined.length} to decline).`)),
    h("table", { class: "cmp" }, h("tbody", {}, e.results.map((r) => h("tr", {},
      h("td", {}, h("span", { class: "badge " + (r.ok ? "ok" : "bad"), text: r.ok ? "✓" : "✕" })),
      h("td", { class: "ltr", dir: "ltr" }, h("b", { text: r.q }), h("div", { class: "sub", text: (r.expect === "abstain" ? "Expected: decline" : "Expected: " + r.expected) + " · Got: " + (r.final || r.decision) })))))));
}

async function ask(question, log, sendBtn) {
  scope.busy = true; sendBtn.disabled = true;
  const arQ = /[؀-ۿ]/.test(question);
  const steps = [L("ترجمة السؤال", "Translate"), L("البحث", "Retrieve"), L("المسودة", "Draft"), L("التحقق", "Verify"), L("الترجمة", "Translate")].map((t) => h("span", { text: t }));
  if (!arQ) steps[0].hidden = true;
  if (!AR()) steps[4].hidden = true;
  const setStep = (n) => steps.forEach((el, i) => { el.className = i < n ? "done" : i === n ? "now" : ""; });
  const status = h("div", { class: "why" }, h("span", { class: "spinner" }), L(" جاري التحضير…", " Preparing…"));
  const body = h("div", {}, h("div", { class: "ai" }, status)), evBox = h("div", {});
  const card = h("div", { class: "card", style: "display:grid;gap:12px" }, h("div", { class: "msg-q", dir: "auto", text: question }), h("div", { class: "pipeline" }, steps), body, evBox);
  log.prepend(card); setStep(arQ ? 0 : 1);
  const say = (t) => mount(status, h("span", { class: "spinner" }), " " + t);
  let res = null, tokens = 0;
  if (state.static) {                                   // no server: replay the saved real run of a suggested question
    const i = SUGGEST[state.lang].indexOf(question), saved = await api("/api/examples").catch(() => ({}));
    const ex = (saved.examples || []).find((e) => e.q === (i >= 0 ? SUGGEST.en[i] : question));
    scope.busy = false; sendBtn.disabled = false;
    if (ex) {
      setStep(5);
      if (ex.evidence && ex.evidence.length && ex.evidence[0].text) mount(evBox, h("details", {}, h("summary", { text: L(`المقاطع المسترجعة من ناسا (${ex.evidence.length})`, `Passages retrieved from NASA (${ex.evidence.length})`) }), evidenceList(ex.evidence)));
      mount(body, verified(ex), h("div", { class: "stats", text: L(`تشغيل حقيقي محفوظ بتاريخ ${saved.date} على ${saved.model}.`, `A real run saved on ${saved.date} with ${saved.model}.`) }));
    } else {
      const found = await searchPassages(question);
      steps.forEach((el, k) => { el.hidden = k !== 1; el.className = k === 1 ? "done" : ""; });
      mount(body, h("div", { class: "ai" },
        h("div", { class: "ai-head" }, h("span", { class: "badge meta", text: L("بحث في نصوص ناسا", "Search in NASA's text") }),
          h("span", { class: "why", text: found.length ? L("هذه أقرب مقاطع من مصادر ناسا لسؤالك.", "These are the closest passages from NASA's sources.") : L("لم نجد مقاطع قريبة من سؤالك في مصادر ناسا.", "No close passage was found in NASA's sources.") })),
        h("div", { class: "stats", text: L("في الرابط العام لا يعمل النموذج، فلا نكتب جواباً جديداً. الجواب المفحوص جملة بجملة يعمل على حاسوب الفريق.",
          "The model does not run on the public link, so no new answer is written. The sentence-by-sentence checked answer runs on the team's laptop.") })));
      if (found.length) mount(evBox, evidenceList(found));
    }
    return;
  }
  try {
    const r = await fetch("api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, lang: state.lang, only: scope.only ? [scope.only] : null }) });
    if (!r.ok) throw new Error(await r.text());
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const ev = JSON.parse(buf.slice(0, nl)); buf = buf.slice(nl + 1);
        if (ev.stage === "translated") { setStep(1); card.querySelector(".msg-q").after(h("div", { class: "stats" }, L("بُحث عنه بالإنجليزية: ", "Searched in English as: "), ltr(ev.question_en))); }
        else if (ev.stage === "evidence") { setStep(2); mount(evBox, h("details", {}, h("summary", { text: L(`المقاطع المسترجعة من ناسا (${ev.evidence.length})`, `Passages retrieved from NASA (${ev.evidence.length})`) }), evidenceList(ev.evidence))); say(L("النموذج المحلي يكتب من الأدلة فقط…", "The local model is drafting from the evidence only…")); }
        else if (ev.stage === "token") { if (++tokens % 5 === 0) say(L(`النموذج المحلي يكتب… (${tokens} رمزاً)`, `Drafting… (${tokens} tokens)`)); }
        else if (ev.stage === "verifying") { setStep(3); say(L("صمام الأمان يفحص كل جملة وكل رقم…", "The guardrail is checking every sentence and number…")); }
        else if (ev.stage === "final") { res = ev; setStep(ev.decision === "abstained" || !AR() ? 5 : 4); mount(body, verified(ev, { pendingAr: AR() })); }
        else if (ev.stage === "translated_answer") { setStep(5); mount(body, verified({ ...res, final_ar: ev.final_ar, translation_ok: ev.translation_ok })); }
        else if (ev.stage === "error") throw new Error(ev.message);
      }
    }
  } catch (e) {
    mount(body, h("div", { class: "warn", text: L("فشل الطلب: ", "Request failed: ") + e.message }));
  }
  scope.busy = false; sendBtn.disabled = false;
}
RENDER.ask = render;
onLangChange.push(() => { delete document.getElementById("view-ask").dataset.ready; });

// AI summary in the investigation drawer
let SUMMARIES = {};
export async function loadSummaries() { try { SUMMARIES = await api("/api/summaries"); } catch (e) { SUMMARIES = {}; } }
drawerExtras.push((inv) => {
  const box = h("div", {});
  const draw = () => {
    const s = SUMMARIES[inv.acc];
    if (s && (!AR() || s.final_ar || s.decision === "abstained")) return mount(box, verified(s));
    if (state.static) return mount(box, h("div", { class: "ai" }, h("div", { class: "why", text: L("الملخص الموثّق يُنشأ بالنموذج المحلي عند تشغيل المشروع على حاسوبك.", "The verified summary is generated by the local model when you run the project on your computer.") })));
    const btn = h("button", { class: "btn primary", text: L("إنشاء ملخص موثّق", "Generate verified summary") });
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      mount(box, h("div", { class: "ai" }, h("div", {}, h("span", { class: "spinner" }), L(" النموذج المحلي يقرأ سجل التجربة ويفحص كل جملة. دقيقة إلى دقيقتين.", " The local model is reading the record and checking every sentence. One to two minutes."))));
      try { SUMMARIES[inv.acc] = await api(`/api/summary/${inv.acc}?lang=${state.lang}`, { method: "POST" }); draw(); }
      catch (e) { mount(box, h("div", { class: "warn", text: e.message })); }
    });
    mount(box, h("div", { class: "ai" }, h("div", { class: "why", text: L("لا يوجد ملخص محفوظ بعد.", "No saved summary yet.") }), h("div", {}, btn)));
  };
  draw();
  return h("section", {}, h("h4", { text: L("ملخص موثّق بالذكاء الاصطناعي", "Verified AI summary") }), box);
});
