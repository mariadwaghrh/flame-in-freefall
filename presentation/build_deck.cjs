// Builds presentation/TrustFlame_deck.pptx in the site's theme (7 slides, the Space Apps maximum).
// Run:  node presentation/build_deck.cjs   (needs pptxgenjs; screenshots come from capture.mjs)
const path = require("path");
const pptxgen = require("pptxgenjs");
const A = (f) => path.join(__dirname, "assets", f);
const OUT = path.join(__dirname, "TrustFlame_deck.pptx");

const THEME = {
  name: "TrustFlame", headFontFace: "Arial", bodyFontFace: "Arial",
  colors: { dk1: "0B0C1D", lt1: "FFFFFF", dk2: "141631", lt2: "C9CBE0", accent1: "E4F24A", accent2: "FF8A3D", accent3: "3987E5",
    accent4: "199E70", accent5: "D03B3B", accent6: "8B8EAB", hlink: "8FC0FF", folHlink: "8FC0FF" },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";                       // 13.33 x 7.5 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "TrustFlame";
const C = pres.SchemeColor;
const BG = C.text1, WHITE = C.background1, SURFACE = C.text2, SOFT = C.background2;
const LIME = C.accent1, FLAME = C.accent2, BLUE = C.accent3, RED = C.accent5, MUTED = C.accent6;
const FOOT = "TrustFlame  ·  NASA Space Apps Challenge 2026  ·  Flame in Freefall";

pres.defineSlideMaster({ title: "COVER", background: { color: BG }, objects: [
  { placeholder: { options: { name: "title", type: "title", x: 0.7, y: 2.35, w: 6.2, h: 1.3, fontSize: 66, bold: true, color: WHITE, align: "left", valign: "middle", margin: 0 }, text: "" } },
  { placeholder: { options: { name: "body", type: "body", x: 0.7, y: 3.75, w: 5.4, h: 1.2, fontSize: 22, color: SOFT, align: "left", valign: "top", margin: 0 }, text: "" } },
] });
pres.defineSlideMaster({ title: "CONTENT", background: { color: BG }, objects: [
  { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.4, w: 12.1, h: 1.0, fontSize: 30, bold: true, color: WHITE, align: "left", valign: "middle", margin: 0 }, text: "" } },
  { text: { text: FOOT, options: { x: 0.6, y: 6.98, w: 9, h: 0.3, fontSize: 10, color: MUTED, margin: 0 } } },
], slideNumber: { x: 12.2, y: 6.98, w: 0.6, h: 0.3, fontSize: 10, color: MUTED, align: "right" } });

const T = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, color: WHITE, valign: "top", ...o });
const card = (s, x, y, w, h, name) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.16, fill: { color: SURFACE }, line: { color: SURFACE, width: 0 }, objectName: name });
const quote = (s, text, source, x, y, w, h, name) => {
  T(s, [{ text: "“" + text + "”", options: { italic: true, color: WHITE, fontSize: 14, breakLine: true } },
        { text: source, options: { color: MUTED, fontSize: 10 } }], { x, y, w, h, objectName: name, paraSpaceAfter: 4 });
};

// ---------- 1. cover ----------
pres.addSection({ title: "Story" });
let s = pres.addSlide({ masterName: "COVER", sectionTitle: "Story" });
s.addImage({ path: A("crop-cover-sphere.jpg"), x: 6.6, y: 0, w: 6.73, h: 7.5, altText: "A real spherical flame on the International Space Station (NASA PSI, CFI-G)", objectName: "Cover image" });
T(s, "NASA SPACE APPS 2026  ·  FLAME IN FREEFALL", { x: 0.7, y: 1.85, w: 5.6, h: 0.35, fontSize: 13, bold: true, color: LIME, charSpacing: 1, objectName: "Kicker" });
s.addText("TrustFlame", { placeholder: "title" });
s.addText("Fire-safety answers from NASA data, with every sentence checked", { placeholder: "body" });
T(s, [{ text: "[Team name]", options: { bold: true, color: WHITE, breakLine: true } },
      { text: "[Member 1]  ·  [Member 2]  ·  [Member 3]  ·  [Member 4]", options: { color: SOFT, breakLine: true } },
      { text: "Amman & Aqaba, Jordan", options: { color: SOFT } }], { x: 0.7, y: 5.35, w: 5.6, h: 1.1, fontSize: 14, paraSpaceAfter: 4, objectName: "Team" });
T(s, "Real video frame, brightened: CFI-G flame on the ISS, NASA PSI (PSI-159)", { x: 7.1, y: 7.05, w: 6, h: 0.3, fontSize: 9, color: MUTED, align: "right", objectName: "Image credit" });
s.addNotes("افتتاحية: اسم الفريق والأعضاء والتحدي. الصورة لهب حقيقي كروي من محطة الفضاء. جملة واحدة: TrustFlame يجيب عن أسئلة السلامة من الحرائق من بيانات ناسا فقط، ويفحص كل جملة قبل عرضها. (استبدلوا النص بين الأقواس باسم الفريق والأعضاء.)");

// ---------- 2. the problem ----------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Story" });
s.addText("Fire in space has already cost lives, and the Moon raises the risk", { placeholder: "title" });
const cases = [
  ["APOLLO 1  ·  1967", "100%", "oxygen in the cabin during a launch-pad test", "During the test, a flash fire swept through the spacecraft so quickly, there was no time to open the hatches.", "NASA Safety and Mission Assurance: Apollo 1", "Afterwards: a hatch that opens in three seconds"],
  ["MIR  ·  1997", "6", "crew members aboard when an oxygen generator ignited", "The flame blocked the evacuation route to the Soyuz spacecraft docked at the aft end of Kvant-1", "NASA History: Fire Aboard Space Station Mir", "Most likely cause: latex glove material in the canister"],
  ["MOON BASE  ·  NEXT", "≥ 30%", "oxygen expected, at 10.2 psi or less (Earth: 21%)", "more than a 40% increase in the oxygen concentration making materials much more flammable.", "NASA Space Apps: Flame in Freefall challenge", "NASA's tests of solid materials stop at 22.2%"],
];
cases.forEach(([k, big, label, q, src, after], i) => {
  const x = 0.6 + i * 4.14;
  card(s, x, 1.65, 3.85, 5.0, `Card ${i + 1}`);
  T(s, k, { x: x + 0.3, y: 1.9, w: 3.25, h: 0.3, fontSize: 12, bold: true, color: LIME, charSpacing: 1, objectName: `Case ${i + 1} label` });
  T(s, big, { x: x + 0.3, y: 2.25, w: 3.25, h: 1.05, fontSize: 60, bold: true, color: FLAME, valign: "middle", objectName: `Case ${i + 1} number` });
  T(s, label, { x: x + 0.3, y: 3.35, w: 3.25, h: 0.7, fontSize: 14, color: SOFT, objectName: `Case ${i + 1} caption` });
  quote(s, q, src, x + 0.3, 4.15, 3.25, 1.6, `Case ${i + 1} quote`);
  T(s, after, { x: x + 0.3, y: 5.8, w: 3.25, h: 0.6, fontSize: 14, bold: true, color: i === 2 ? FLAME : WHITE, valign: "bottom", objectName: `Case ${i + 1} outcome` });
});
s.addNotes("المشكلة: Apollo 1 عام 1967، المقصورة أكسجين 100%، والحريق لم يترك وقتاً لفتح الباب. Mir عام 1997، اللهب أغلق طريق الهروب. والآن القاعدة القمرية ستكون عند 30% أكسجين أو أكثر، وناسا نفسها تقول إن هذا يجعل المواد أكثر قابلية للاشتعال. كل الاقتباسات حرفية من ناسا.");

// ---------- 3. the data problem ----------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Story" });
s.addText("NASA ran the experiments. Finding the answer is the hard part", { placeholder: "title" });
[["24", "combustion investigations in NASA's PSI database"], ["2,001", "test rows: fuel, oxygen, pressure, air flow"], ["12.3 TiB", "of raw video and sensor files in the archive"]].forEach(([n, l], i) => {
  const x = 0.6 + i * 2.35;
  T(s, n, { x, y: 1.75, w: 2.2, h: 0.95, fontSize: i === 2 ? 40 : 54, bold: true, color: LIME, valign: "bottom", objectName: `Stat ${i + 1}` });
  T(s, l, { x, y: 2.8, w: 2.1, h: 0.95, fontSize: 14, color: SOFT, objectName: `Stat ${i + 1} label` });
});
card(s, 0.6, 4.05, 6.9, 2.55, "Quote card");
quote(s, "the amount of data can be overwhelming. It can be hard to find, harder to compare, and harder yet to interpret.", "NASA Space Apps: Flame in Freefall challenge", 0.9, 4.3, 6.3, 1.05, "Challenge quote");
T(s, "We read every combustion record and every test table, and put oxygen, pressure, flow and material names on one scale.", { x: 0.9, y: 5.5, w: 6.3, h: 0.8, fontSize: 14, color: WHITE, objectName: "What we did" });
s.addImage({ path: A("crop-BASS.jpg"), x: 7.85, y: 1.65, w: 4.88, h: 4.6, altText: "Camera frame of a BASS flame test on the International Space Station", objectName: "BASS photo" });
T(s, "Real camera frame: BASS test on the ISS, 30 April 2013, NASA PSI (PSI-26)", { x: 7.85, y: 6.33, w: 4.88, h: 0.3, fontSize: 10, color: MUTED, objectName: "Photo credit" });
s.addNotes("ناسا أجرت التجارب ونشرتها في PSI: 24 تجربة احتراق، 2001 صف اختبار، وأرشيف خام 12.3 TiB. المشكلة بكلمات ناسا: صعب أن تجدها، وأصعب أن تقارنها، وأصعب أن تفسّرها. نحن قرأنا كل السجلات والجداول ووحّدناها على مقياس واحد.");

// ---------- 4. what we built ----------
pres.addSection({ title: "Solution" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solution" });
s.addText("TrustFlame delivers the three things NASA asked for", { placeholder: "title" });
[["page-investigations.png", "NASA ASKED: IDENTIFY THE MOST RELEVANT INVESTIGATIONS", "All 24 investigations ranked 0 to 100 for a station, spacecraft, Moon base, rover or Mars base"],
 ["page-data.png", "NASA ASKED: EXTRACT DATA FOR PREDICTIVE MODELLING", "Every NASA test table on one scale, plotted, with CSV export for modellers"],
 ["page-equipment.png", "NASA ASKED: HIGHLIGHT RESEARCH FOR FIRE-SAFETY EQUIPMENT", "34 NASA quotes, checked word for word, link research to detectors, suppression and materials"]].forEach(([img, ask, ours], i) => {
  const x = 0.6 + i * 4.14;
  s.addImage({ path: A(img), x, y: 1.65, w: 3.85, h: 2.17, altText: "Screenshot of the TrustFlame dashboard: " + ours, objectName: `Screenshot ${i + 1}` });
  T(s, ask, { x, y: 4.0, w: 3.85, h: 0.55, fontSize: 11, bold: true, color: LIME, charSpacing: 0.5, objectName: `Ask ${i + 1}` });
  T(s, ours, { x, y: 4.6, w: 3.85, h: 1.0, fontSize: 14, color: WHITE, objectName: `Answer ${i + 1}` });
});
card(s, 0.6, 5.8, 12.13, 0.85, "Extras card");
T(s, [{ text: "Also: ", options: { bold: true, color: FLAME } }, { text: "a Moon readiness tool  ·  an assistant that answers in Arabic or English from NASA sources only  ·  a story home page with real ISS flame video", options: { color: WHITE } }],
  { x: 0.9, y: 5.8, w: 11.5, h: 0.85, fontSize: 14, valign: "middle", objectName: "Extras" });
s.addNotes("التحدي اقترح ثلاثة أشياء، ونفّذنا الثلاثة: ترتيب التجارب حسب بيئة الطاقم، استخراج بيانات للنمذجة مع تنزيل CSV، وربط الأبحاث بمعدات السلامة باقتباسات حرفية من ناسا. هنا ننتقل إلى العرض الحي للموقع.");

// ---------- 5. the finding ----------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solution" });
s.addText("What we found: no solid material was tested above 22.2% oxygen", { placeholder: "title" });
s.addChart(pres.charts.BAR, [{ name: "Highest oxygen tested (%)", labels: ["Wax (candle)", "Silicone", "SIBAL fabric", "Nomex", "PMMA (acrylic)", "Moon base needs"], values: [17.4, 22.1, 22.1, 22.2, 22.2, 30] }], {
  x: 0.6, y: 1.6, w: 7.5, h: 4.75, barDir: "bar", chartColors: [HEX.accent3, HEX.accent3, HEX.accent3, HEX.accent3, HEX.accent3, HEX.accent2], invertedColors: [HEX.accent3],
  showTitle: true, title: "Highest oxygen each solid material was tested at (%)", titleColor: HEX.lt2, titleFontSize: 13, titleFontFace: "+mn-lt",
  showValue: true, dataLabelPosition: "outEnd", dataLabelColor: HEX.lt1, dataLabelFontSize: 12, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: '0.0"%"',
  catAxisLabelColor: HEX.lt2, valAxisLabelColor: HEX.accent6, catAxisLabelFontSize: 12, valAxisLabelFontSize: 11, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
  valAxisMinVal: 0, valAxisMaxVal: 35, valAxisMajorUnit: 5, valGridLine: { color: "262A4A", size: 0.75 }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 55,
  altText: "Bar chart: solid materials were tested up to 22.2% oxygen; a Moon base needs 30%", objectName: "Gap chart" });
T(s, "Computed from the NASA PSI test tables (2,001 rows)", { x: 0.6, y: 6.4, w: 7.5, h: 0.3, fontSize: 10, color: MUTED, objectName: "Chart source" });
card(s, 8.5, 1.65, 4.23, 2.3, "Zero card");
T(s, "0", { x: 8.8, y: 1.8, w: 3.6, h: 1.0, fontSize: 60, bold: true, color: RED, valign: "middle", objectName: "Zero" });
T(s, "test rows burn a solid material at 30% oxygen or more, or at reduced pressure", { x: 8.8, y: 2.85, w: 3.65, h: 0.95, fontSize: 14, color: SOFT, objectName: "Zero label" });
card(s, 8.5, 4.2, 4.23, 2.45, "Six card");
T(s, "6", { x: 8.8, y: 4.35, w: 3.6, h: 1.0, fontSize: 60, bold: true, color: LIME, valign: "middle", objectName: "Six" });
T(s, "investigations reach 30% or more, but every one of them burns a gas or a liquid", { x: 8.8, y: 5.4, w: 3.65, h: 0.95, fontSize: 14, color: SOFT, objectName: "Six label" });
s.addNotes("هذا اكتشافنا من البيانات: أعلى أكسجين اختُبرت فيه مادة صلبة هو 22.2%، والقاعدة القمرية تحتاج 30%. عدد اختبارات المواد الصلبة عند 30% أو أكثر: صفر. ست تجارب وصلت إلى 30% لكنها كلها غاز أو سائل. نحن لا نتنبأ بالخطر، بل نُظهر أين لا توجد بيانات.");

// ---------- 6. how it works ----------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solution" });
s.addText("How it works: no sentence without evidence, no number without a source", { placeholder: "title" });
[["Question", "in Arabic or English"], ["Search", "467 passages from NASA sources"], ["Draft", "a local model, offline, from the passages only"],
 ["Guardrail", "checks every sentence and every number"], ["Result", "verified answer, removed sentence, or refusal"]].forEach(([a, b], i) => {
  const y = 1.7 + i * 0.78, guard = i === 3;
  s.addShape(pres.shapes.OVAL, { x: 0.6, y, w: 0.5, h: 0.5, fill: { color: guard ? LIME : SURFACE }, line: { color: guard ? LIME : SURFACE, width: 0 }, objectName: `Step ${i + 1} dot` });
  T(s, String(i + 1), { x: 0.6, y, w: 0.5, h: 0.5, fontSize: 14, bold: true, align: "center", valign: "middle", color: guard ? BG : WHITE, objectName: `Step ${i + 1} number` });
  T(s, [{ text: a + "   ", options: { bold: true, color: guard ? LIME : WHITE } }, { text: b, options: { color: SOFT } }], { x: 1.3, y, w: 4.9, h: 0.5, fontSize: 14, valign: "middle", objectName: `Step ${i + 1}` });
});
card(s, 0.6, 5.7, 5.6, 0.95, "Test card");
T(s, [{ text: "6 / 7  ", options: { bold: true, color: LIME, fontSize: 24 } }, { text: "team-written test questions passed", options: { color: WHITE, fontSize: 14 } }], { x: 0.85, y: 5.7, w: 5.2, h: 0.95, valign: "middle", objectName: "Test result" });
s.addImage({ path: A("crop-real-run.png"), x: 6.6, y: 1.6, w: 6.13, h: 4.3, altText: "A saved real run: two sentences marked supported with their NASA evidence, and an off-topic question declined", objectName: "Real run" });
T(s, "A saved real run of the system, not a mock-up. Limits we state: 1 to 2 minutes per answer on a laptop, Arabic is machine-translated, PSI has no lunar-gravity data yet.",
  { x: 6.6, y: 6.0, w: 6.13, h: 0.65, fontSize: 11, color: MUTED, objectName: "Limits" });
s.addNotes("كيف يعمل: السؤال، ثم بحث في 467 مقطعاً من ناسا، ثم مسودة من نموذج محلي بدون إنترنت، ثم صمام الأمان يفحص كل جملة وكل رقم، ثم النتيجة. على اليمين تشغيل حقيقي محفوظ: جملتان مدعومتان مع مصدرهما، وسؤال خارج الموضوع مرفوض. اختبرناه على 7 أسئلة كتبها الفريق ونجح في 6. ونذكر حدودنا بصراحة.");

// ---------- 7. impact and next ----------
pres.addSection({ title: "Close" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Close" });
s.addText("Impact, and built to last after the hackathon", { placeholder: "title" });
[["WHO BENEFITS", ["An engineer choosing materials for a Moon base sees in seconds what NASA tested and what it did not", "Arabic-speaking students and researchers read NASA science in their own language"]],
 ["BUILT TO LAST", ["No running cost: open models on one laptop, offline", "6 commands rebuild everything when NASA adds data to PSI", "Open source under Apache-2.0"]],
 ["WHAT COMES NEXT", ["Lunar-gravity data (LUCI, FM2) when NASA publishes it", "A stronger model for Arabic translation", "Analysis of the raw video archive"]]].forEach(([head, items], i) => {
  const x = 0.6 + i * 4.14;
  card(s, x, 1.65, 3.85, 3.2, `Column ${i + 1}`);
  T(s, head, { x: x + 0.3, y: 1.9, w: 3.25, h: 0.35, fontSize: 13, bold: true, color: i === 2 ? FLAME : LIME, charSpacing: 1, objectName: `Column ${i + 1} head` });
  T(s, items.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < items.length - 1 } })), { x: x + 0.3, y: 2.4, w: 3.3, h: 2.3, fontSize: 14, color: WHITE, paraSpaceAfter: 10, objectName: `Column ${i + 1} list` });
});
T(s, [{ text: "TrustFlame never invents an answer: ", options: { color: WHITE } }, { text: "NASA evidence, or “I don’t know”", options: { color: LIME } }],
  { x: 0.6, y: 5.1, w: 12.13, h: 0.7, fontSize: 24, bold: true, valign: "middle", objectName: "Closing line" });
T(s, [{ text: "Code and data:  ", options: { color: SOFT } }, { text: "github.com/mariadwaghrh/flame-in-freefall", options: { color: LIME, bold: true, hyperlink: { url: "https://github.com/mariadwaghrh/flame-in-freefall" } } },
      { text: "     NASA data:  PSI Combustion Science and every resource on the challenge page", options: { color: SOFT } }], { x: 0.6, y: 6.05, w: 12.13, h: 0.6, fontSize: 13, valign: "middle", objectName: "Links" });
s.addNotes("الأثر: مهندس يختار مواد قاعدة قمرية يعرف في ثوانٍ ماذا اختُبر وماذا لم يُختبر، وطلاب وباحثون عرب يقرأون علوم ناسا بلغتهم. الاستمرار: بلا تكلفة تشغيل، ستة أوامر تعيد بناء كل شيء، والكود مفتوح. القادم: بيانات جاذبية القمر عند نشرها، نموذج عربي أقوى، وتحليل الفيديو الخام. الختام: TrustFlame لا يخترع جواباً؛ إما دليل من ناسا، أو يقول لا أعرف.");

(async () => {
  await pres.writeFile({ fileName: OUT });
  const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
