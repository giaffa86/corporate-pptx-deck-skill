#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const { findUserTheme } = require("./theme-paths");

const USAGE = "Usage: node build-deck.js deck.json output.pptx [--theme theme.json] [--no-bump]";
const positional = [];
let themeArg = null;
let noBump = false;
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === "--no-bump") noBump = true;
  else if (arg === "--theme") themeArg = process.argv[++i];
  else if (arg.startsWith("--theme=")) themeArg = arg.slice("--theme=".length);
  else if (arg === "-h" || arg === "--help") { console.log(USAGE); process.exit(0); }
  else if (arg.startsWith("--")) { console.error(`Unknown option: ${arg}\n${USAGE}`); process.exit(1); }
  else positional.push(arg);
}
const input = positional[0];
const output = positional[1] || "output.pptx";
if (!input || (process.argv.includes("--theme") && !themeArg)) {
  console.error(USAGE);
  process.exit(1);
}

const cwd = process.cwd();
const skillDir = path.resolve(__dirname, "..");
const inputAbs = path.resolve(cwd, input);
if (!fs.existsSync(inputAbs)) {
  console.error(`Input deck JSON not found: ${inputAbs}`);
  console.error("build-deck.js requires a deck data JSON file; it does not read .md, .dokuwiki, or existing .pptx files directly.");
  console.error("Create the JSON first, then rerun with: node build-deck.js deck.json output.pptx");
  process.exit(1);
}

let deck;
try {
  deck = JSON.parse(fs.readFileSync(inputAbs, "utf8"));
} catch (err) {
  console.error(`Invalid deck JSON: ${inputAbs}`);
  console.error(err.message);
  process.exit(1);
}

function readJsonIfExists(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

function deepMerge(base, override) {
  if (!override) return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v && typeof v === "object" && !Array.isArray(v)) out[k] = deepMerge(out[k] || {}, v);
    else if (v !== undefined) out[k] = v;
  }
  return out;
}

const defaultTheme = readJsonIfExists(path.join(skillDir, "assets", "default-theme.json"));
const userThemePath = findUserTheme(themeArg);
if (themeArg && !fs.existsSync(userThemePath)) {
  console.error(`Theme not found: ${userThemePath}`);
  process.exit(1);
}
const userTheme = userThemePath ? readJsonIfExists(userThemePath) : null;
const localTheme = readJsonIfExists(path.resolve(cwd, "theme.local.json"));
const theme = deepMerge(deepMerge(defaultTheme, userTheme), localTheme);
const C = theme.colors;
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

// --- version & author resolution ---
const outputAbs = path.resolve(cwd, output);

function bumpVersion(prev) {
  if (!prev) return "0.0.1";
  const m = String(prev).match(/^(.*?)(\d+)(\D*)$/); // bump the last numeric run
  if (!m) return "0.0.1";
  return `${m[1]}${parseInt(m[2], 10) + 1}${m[3]}`;
}

// Version resolution:
//   - autoIncrement !== true and version set  -> frozen (returns version as-is)
//   - autoIncrement === true                  -> bump a ledger next to the output;
//       version (if any) seeds the first build, then each rebuild bumps it
//   - neither version nor autoIncrement        -> legacy auto-increment (back-compat)
function resolveVersion() {
  const explicit = deck.version ? String(deck.version) : null;
  const auto = deck.autoIncrement === true || (!explicit && deck.autoIncrement !== false);
  if (!auto) return explicit;

  const ledgerPath = path.join(path.dirname(outputAbs), ".deck-versions.json");
  const key = path.basename(outputAbs);
  let ledger = {};
  try { ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8")); } catch { /* none yet */ }
  if (noBump) return ledger[key] || explicit || "0.0.1";
  const next = ledger[key] ? bumpVersion(ledger[key]) : (explicit || "0.0.1");
  ledger[key] = next;
  try { fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`); } catch { /* read-only dir */ }
  return next;
}

const version = resolveVersion();

// Fixed slide strings: deck.labels > theme.labels > defaults for deck.lang.
const lang = deck.lang || "it-IT";
const DEFAULT_LABELS = {
  it: { cover: "DOCUMENTO", agenda: "Agenda", section: "Sezione", takeaways: "Takeaways", takeawayEyebrow: "Sintesi" },
  en: { cover: "DOCUMENT", agenda: "Agenda", section: "Section", takeaways: "Takeaways", takeawayEyebrow: "Summary" },
};
const L = {
  ...(DEFAULT_LABELS[lang.slice(0, 2).toLowerCase()] || DEFAULT_LABELS.en),
  ...(theme.labels || {}),
  ...(deck.labels || {}),
};
const author = deck.author || theme.author || ""; // shown on cover; no companyName fallback
const totalSlides = 1
  + (deck.agenda?.length ? 1 : 0)
  + (deck.sections?.length || 0)
  + (deck.takeaways?.length ? 1 : 0);
let currentSlideNumber = 0;

const pptx = new pptxgen();
pptx.defineLayout({ name: "LAYOUT_WIDE", width: 13.333, height: 7.5 });
pptx.layout = "LAYOUT_WIDE";
pptx.author = author || theme.companyName || "";
pptx.revision = version;
pptx.company = theme.companyName || "";
pptx.subject = deck.subtitle || "";
pptx.title = deck.title || "Corporate Deck";
pptx.lang = lang;
pptx.theme = {
  headFontFace: theme.fonts.head,
  bodyFontFace: theme.fonts.body,
  lang,
};

// Relative paths resolve from the deck JSON folder first, then the working directory.
const deckDir = path.dirname(inputAbs);
const warnedAssets = new Set();
function asset(p) {
  if (!p) return null;
  const candidates = path.isAbsolute(p) ? [p] : [path.resolve(deckDir, p), path.resolve(cwd, p)];
  const found = candidates.find((c) => fs.existsSync(c));
  if (found) return found;
  if (!warnedAssets.has(p)) {
    warnedAssets.add(p);
    console.warn(`Warning: image not found, skipped: ${p}`);
  }
  return null;
}

function hasOwn(obj, key) {
  return obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function resolveVisual(scope, key) {
  if (hasOwn(scope, key)) return scope[key];
  if (hasOwn(deck, key)) return deck[key];
  return theme[key];
}

function definedFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function opacityToTransparency(value, fallbackOpacity) {
  const opacity = clampNumber(value, 0, 1, fallbackOpacity);
  return Math.round((1 - opacity) * 100);
}

function addBackgroundImage(slide, scope = {}) {
  const image = resolveVisual(scope, "backgroundImage");
  const img = asset(image);
  if (!img) return;
  const transparency = opacityToTransparency(resolveVisual(scope, "backgroundOpacity"), 0.08);
  slide.addImage({
    path: img,
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: SLIDE_H,
    transparency,
    sizing: { type: "cover", x: 0, y: 0, w: SLIDE_W, h: SLIDE_H },
  });
}

function addWatermark(slide, scope = {}) {
  const text = resolveVisual(scope, "watermark");
  if (!text) return;
  const transparency = clampNumber(resolveVisual(scope, "watermarkTransparency"), 0, 100, 88);
  slide.addText(String(text).toUpperCase(), {
    x: -0.15,
    y: 2.78,
    w: 13.65,
    h: 1.0,
    rotate: 330,
    fontSize: 54,
    bold: true,
    align: "center",
    color: resolveVisual(scope, "watermarkColor") || C.ink,
    transparency,
    margin: 0,
    fit: "shrink",
  });
}

function resolvePageNumberFormat(scope = {}) {
  if (hasOwn(scope, "pageNumberFormat")) return scope.pageNumberFormat;
  if (hasOwn(deck, "pageNumberFormat")) return deck.pageNumberFormat;
  if (hasOwn(theme, "pageNumberFormat")) return theme.pageNumberFormat;
  return "";
}

function formatPageNumber(format) {
  if (format === true) format = "{{page}}";
  if (!format) return "";
  return String(format)
    .replace(/\{\{\s*page\s*\}\}/g, String(currentSlideNumber))
    .replace(/\{\{\s*total\s*\}\}/g, String(totalSlides));
}

function addTopBar(slide) {
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.08, fill: { color: C.accent2 }, line: { color: C.accent2 } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 5.2, h: 0.08, fill: { color: C.accent }, line: { color: C.accent } });
}

function addFooter(slide, section = "", scope = {}) {
  slide.addShape(pptx.ShapeType.line, { x: 0.55, y: 7.05, w: 10.8, h: 0, line: { color: C.line, width: 1 } });
  slide.addText(section, { x: 0.55, y: 7.15, w: 6.5, h: 0.16, fontSize: 7.8, color: C.footerText, margin: 0 });
  const right = [theme.companyName, theme.confidentiality || theme.footer].filter(Boolean).join(" · ");
  slide.addText(right, { x: 8.2, y: 7.15, w: 3.55, h: 0.16, fontSize: 7.8, color: C.footerText, align: "right", margin: 0 });
  const pageNumber = formatPageNumber(resolvePageNumberFormat(scope));
  if (pageNumber) {
    slide.addText(pageNumber, {
      x: 11.95, y: 7.15, w: 0.85, h: 0.16,
      fontSize: 7.8, color: resolveVisual(scope, "pageNumberColor") || C.footerText,
      align: "right", margin: 0, fit: "shrink",
    });
  }
}

function imageSize(file) {
  try {
    const buf = fs.readFileSync(file);
    if (buf.length > 24 && buf.toString("hex", 0, 8) === "89504e470d0a1a0a") {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; // PNG IHDR
    }
    if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) { // JPEG: scan SOF markers
      let off = 2;
      while (off + 9 < buf.length) {
        if (buf[off] !== 0xff) { off++; continue; }
        const m = buf[off + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
        }
        off += 2 + buf.readUInt16BE(off + 2);
      }
    }
  } catch { /* unreadable → fall back to box */ }
  return null;
}

// Fit the logo inside a maxW x maxH box preserving its real aspect ratio (no stretch).
function addLogo(slide, x = 0.75, y = 0.55, maxW = 1.8, maxH = 0.55) {
  const logo = asset(theme.logo);
  if (!logo) return;
  let w = maxW, h = maxH;
  const sz = imageSize(logo);
  if (sz && sz.w && sz.h) {
    const r = sz.w / sz.h;
    h = maxH; w = h * r;
    if (w > maxW) { w = maxW; h = w / r; }
  }
  slide.addImage({ path: logo, x, y, w, h });
}

function addTitle(slide, title, eyebrow) {
  if (eyebrow) {
    slide.addText(String(eyebrow).toUpperCase(), {
      x: 0.65, y: 0.62, w: 6.2, h: 0.18, fontSize: 8.5, bold: true,
      color: C.accent, charSpace: 1.4, margin: 0,
    });
  }
  slide.addText(title, {
    x: 0.62, y: eyebrow ? 0.86 : 0.62, w: 10.5, h: 0.6,
    fontSize: 28, bold: true, color: C.ink, margin: 0, fit: "shrink",
  });
}

function addBullets(slide, items, x, y, w, h, fontSize = 15) {
  slide.addText((items || []).map((text) => ({
    text,
    options: { bullet: { indent: 12 }, hanging: 4, breakLine: true },
  })), {
    x, y, w, h, fontSize, color: C.ink, paraSpaceAfterPt: 7, margin: 0.02, fit: "shrink",
  });
}

function addCallout(slide, text, x, y, w, h, color = C.accent) {
  if (!text) return;
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: C.calloutBg },
    line: { color, width: 1.2 },
  });
  slide.addText(text, {
    x: x + 0.18, y: y + 0.12, w: w - 0.36, h: h - 0.24,
    fontSize: 13, bold: true, color: C.ink, margin: 0, fit: "shrink",
  });
}

function addImageFrame(slide, image, x, y, w, h, line = C.line) {
  const img = asset(image);
  if (!img) return;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: x - 0.03, y: y - 0.03, w: w + 0.06, h: h + 0.06,
    rectRadius: 0.06, fill: { color: C.white }, line: { color: line, width: 0.8 },
  });
  slide.addImage({ path: img, x, y, w, h, sizing: { type: "contain", x, y, w, h } });
}

function cover() {
  const slide = pptx.addSlide();
  currentSlideNumber++;
  slide.background = { color: C.softBg };
  addBackgroundImage(slide);
  addTopBar(slide);
  addLogo(slide);
  slide.addText(deck.label || L.cover, {
    x: 0.8, y: 1.8, w: 3.8, h: 0.22, fontSize: 9,
    bold: true, color: C.accent, charSpace: 1.5, margin: 0,
  });
  slide.addText(deck.title || "Corporate Deck", {
    x: 0.75, y: 2.25, w: 6.1, h: 1.2,
    fontSize: 36, bold: true, color: C.ink, margin: 0, fit: "shrink",
  });
  slide.addText(deck.subtitle || "", {
    x: 0.8, y: 3.75, w: 5.7, h: 0.58, fontSize: 15.5,
    color: C.muted, margin: 0, fit: "shrink",
  });
  slide.addShape(pptx.ShapeType.line, { x: 0.8, y: 5.2, w: 4.6, h: 0, line: { color: C.line, width: 1 } });
  const vLabel = /^v/i.test(version) ? version : `v${version}`;
  const metaParts = [deck.date, vLabel, author].filter(Boolean)
    .filter((p, i, a) => a.findIndex((q) => String(q).includes(String(p))) === i);
  slide.addText(metaParts.join("  ·  "), { x: 0.8, y: 5.45, w: 5.8, h: 0.24, fontSize: 10.5, color: C.muted, margin: 0 });
  addImageFrame(slide, deck.coverImage, 7.15, 1.25, 5.2, 3.9);
  addFooter(slide, deck.footer || "Corporate deck");
  addWatermark(slide);
  if (deck.notes) slide.addNotes(deck.notes);
}

function agenda() {
  if (!deck.agenda?.length) return;
  const slide = pptx.addSlide();
  currentSlideNumber++;
  const agendaVisuals = definedFields({
    backgroundImage: deck.agendaBackgroundImage,
    backgroundOpacity: deck.agendaBackgroundOpacity,
    watermark: deck.agendaWatermark,
    watermarkColor: deck.agendaWatermarkColor,
    watermarkTransparency: deck.agendaWatermarkTransparency,
    pageNumberFormat: deck.agendaPageNumberFormat,
    pageNumberColor: deck.agendaPageNumberColor,
  });
  slide.background = { color: C.whiteBg };
  addBackgroundImage(slide, agendaVisuals);
  addTopBar(slide);
  addTitle(slide, deck.agendaTitle || L.agenda, deck.agendaEyebrow || L.agenda);
  addFooter(slide, L.agenda, agendaVisuals);
  const midpoint = Math.ceil(deck.agenda.length / 2);
  const render = (items, x) => {
    slide.addText(items.map((it) => ({
      text: `${it.time || ""}  ${it.speaker || it.title || ""}\n${it.topic || ""}`,
      options: { breakLine: true },
    })), {
      x, y: 1.55, w: 5.55, h: 4.8, fontSize: 12.8,
      color: C.ink, bold: true, paraSpaceAfterPt: 9, fit: "shrink", margin: 0,
    });
  };
  render(deck.agenda.slice(0, midpoint), 0.75);
  render(deck.agenda.slice(midpoint), 6.8);
  addWatermark(slide, agendaVisuals);
}

function sectionSlide(s) {
  const slide = pptx.addSlide();
  currentSlideNumber++;
  slide.background = { color: C.darkBg };
  addBackgroundImage(slide, s);
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.1, fill: { color: C.accent2 }, line: { color: C.accent2 } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 5.2, h: 0.1, fill: { color: C.accent }, line: { color: C.accent } });
  slide.addText(s.title, { x: 0.8, y: 1.0, w: 5.8, h: 0.95, fontSize: 34, bold: true, color: C.white, margin: 0, fit: "shrink" });
  slide.addText(s.subtitle || "", { x: 0.82, y: 2.15, w: 5.3, h: 0.8, fontSize: 15, color: C.sectionSubtitle, margin: 0, fit: "shrink" });
  addImageFrame(slide, s.image, 7.0, 1.0, 5.4, 4.2, C.accent2);
  addFooter(slide, L.section, s);
  addWatermark(slide, s);
  if (s.notes) slide.addNotes(s.notes);
}

function topicSlide(s) {
  const slide = pptx.addSlide();
  currentSlideNumber++;
  slide.background = { color: C.whiteBg };
  addBackgroundImage(slide, s);
  addTopBar(slide);
  addTitle(slide, s.title, s.eyebrow);
  addFooter(slide, s.speaker || s.section || "", s);
  // Title box ends at 1.22 (no eyebrow) or 1.46 (eyebrow); keep the speaker line below it.
  if (s.speaker) slide.addText(s.speaker, { x: 0.68, y: s.eyebrow ? 1.52 : 1.34, w: 5.4, h: 0.28, fontSize: 13.5, bold: true, color: C.accent, margin: 0, fit: "shrink" });
  addBullets(slide, s.bullets, 0.72, 1.85, 5.4, 2.95, s.fontSize || 14.4);
  addCallout(slide, s.callout, 0.72, 5.12, 5.55, 0.86, s.accent || C.accent);
  addImageFrame(slide, s.image, 6.78, 1.32, 5.72, 4.45, s.accent || C.line);
  addWatermark(slide, s);
  if (s.notes) slide.addNotes(s.notes);
}

cover();
agenda();
for (const section of deck.sections || []) {
  if (section.type === "section") sectionSlide(section);
  else topicSlide(section);
}
if (deck.takeaways?.length) {
  topicSlide({
    title: deck.takeawayTitle || L.takeaways,
    eyebrow: deck.takeawayEyebrow || L.takeawayEyebrow,
    bullets: deck.takeaways,
    callout: deck.takeawayCallout,
    image: deck.takeawayImage,
    section: L.takeaways,
    ...definedFields({
      backgroundImage: deck.takeawayBackgroundImage,
      backgroundOpacity: deck.takeawayBackgroundOpacity,
      watermark: deck.takeawayWatermark,
      watermarkColor: deck.takeawayWatermarkColor,
      watermarkTransparency: deck.takeawayWatermarkTransparency,
      pageNumberFormat: deck.takeawayPageNumberFormat,
      pageNumberColor: deck.takeawayPageNumberColor,
    }),
  });
}

pptx.writeFile({ fileName: path.resolve(cwd, output) });
