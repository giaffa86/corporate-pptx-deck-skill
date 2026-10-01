#!/usr/bin/env node
// Render a PPTX to PDF + per-slide PNGs for visual inspection.
// Skips gracefully (exit 0, warning) when LibreOffice or poppler is missing.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const USAGE = "Usage: node render-check.js deck.pptx [outDir] [--dpi 50]";
const positional = [];
let dpi = 50;
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === "--dpi") dpi = Number(process.argv[++i]);
  else if (arg.startsWith("--dpi=")) dpi = Number(arg.slice("--dpi=".length));
  else if (arg === "-h" || arg === "--help") { console.log(USAGE); process.exit(0); }
  else if (arg.startsWith("--")) { console.error(`Unknown option: ${arg}\n${USAGE}`); process.exit(1); }
  else positional.push(arg);
}
if (!positional[0] || !Number.isFinite(dpi) || dpi <= 0) {
  console.error(USAGE);
  process.exit(1);
}

const pptx = path.resolve(positional[0]);
if (!fs.existsSync(pptx)) {
  console.error(`PPTX not found: ${pptx}`);
  process.exit(1);
}
const base = path.basename(pptx, path.extname(pptx));
const outDir = path.resolve(positional[1] || path.join(os.tmpdir(), `deck-check-${base}`));

function which(cmd) {
  try {
    return execFileSync("sh", ["-c", `command -v ${cmd}`], { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

function slideCount(file) {
  try {
    const listing = execFileSync("unzip", ["-l", file], { encoding: "utf8" });
    return listing.split("\n").filter((l) => /ppt\/slides\/slide\d+\.xml$/.test(l.trim())).length;
  } catch {
    return null;
  }
}

const slides = slideCount(pptx);
if (slides !== null) console.log(`Slides in PPTX: ${slides}`);

const soffice = which("soffice") || which("libreoffice");
const pdftoppm = which("pdftoppm");
if (!soffice || !pdftoppm) {
  const missing = [!soffice && "LibreOffice (soffice)", !pdftoppm && "poppler (pdftoppm)"].filter(Boolean);
  console.warn(`Warning: render skipped, missing ${missing.join(" and ")}. Rely on slide count and lint.`);
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) {
  if (/^slide-\d+\.png$/.test(f) || f === `${base}.pdf`) fs.rmSync(path.join(outDir, f));
}

// Isolated profile so a running LibreOffice instance does not block conversion.
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "deck-check-lo-"));
try {
  execFileSync(soffice, [
    `-env:UserInstallation=file://${profile}`,
    "--headless", "--convert-to", "pdf", "--outdir", outDir, pptx,
  ], { stdio: "pipe" });
} catch (err) {
  console.error(`PDF conversion failed: ${err.stderr?.toString().trim() || err.message}`);
  process.exit(1);
} finally {
  fs.rmSync(profile, { recursive: true, force: true });
}

const pdf = path.join(outDir, `${base}.pdf`);
if (!fs.existsSync(pdf)) {
  console.error(`PDF conversion produced no output: ${pdf}`);
  process.exit(1);
}

try {
  execFileSync(pdftoppm, ["-png", "-r", String(dpi), pdf, path.join(outDir, "slide")], { stdio: "pipe" });
} catch (err) {
  console.error(`PNG rendering failed: ${err.stderr?.toString().trim() || err.message}`);
  process.exit(1);
}

const pngs = fs.readdirSync(outDir).filter((f) => /^slide-\d+\.png$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
console.log(`PDF: ${pdf}`);
console.log(`PNGs (${pngs.length}):`);
for (const f of pngs) console.log(`  ${path.join(outDir, f)}`);
if (slides !== null && pngs.length !== slides) {
  console.warn(`Warning: rendered ${pngs.length} pages but PPTX has ${slides} slides.`);
}
