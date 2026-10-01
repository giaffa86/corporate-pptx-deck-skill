#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execFileSync } = require("child_process");
const { defaultUserThemeTarget } = require("./theme-paths");

const skillDir = path.resolve(__dirname, "..");
const defaultTheme = JSON.parse(fs.readFileSync(path.join(skillDir, "assets", "default-theme.json"), "utf8"));
const isTTY = process.stdin.isTTY && process.stdout.isTTY;

// ---------- helpers ----------
function deepMerge(base, override) {
  if (!override || typeof override !== "object") return base;
  for (const [k, v] of Object.entries(override)) {
    if (v && typeof v === "object" && !Array.isArray(v)) deepMerge(base[k] = base[k] || {}, v);
    else if (v !== undefined) base[k] = v;
  }
  return base;
}
function cleanHex(value, fallback) {
  const v = String(value || "").trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : fallback;
}
function cleanNumber(value, fallback, min, max) {
  const n = Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function hexToRgb(hex) {
  const v = String(hex).replace(/^#/, "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
function swatch(hex, w = 4) {
  const [r, g, b] = hexToRgb(hex);
  return `\x1b[48;2;${r};${g};${b}m${" ".repeat(w)}\x1b[0m`;
}
function fg(hex) {
  const [r, g, b] = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m`;
}
const R = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

// ---------- system fonts ----------
function systemFonts() {
  const preferred = ["Aptos Display", "Aptos", "Calibri", "Arial", "Helvetica", "Segoe UI", "Georgia", "Times New Roman"];
  let found = [];
  try {
    found = execFileSync("fc-list", [":", "family"], { encoding: "utf8" })
      .split("\n").map((l) => l.split(",")[0].trim()).filter(Boolean);
  } catch { /* fc-list unavailable */ }
  const all = [...new Set([...preferred, ...found.sort((a, b) => a.localeCompare(b))])];
  return all;
}

// ---------- curated palette ----------
const PALETTE = [
  ["FFFFFF", "F9FAFB", "E5E7EB", "9CA3AF", "6B7280", "374151", "1A1A2E", "111827"],
  ["FEE2E2", "FCA5A5", "EF4444", "DC2626", "B91C1C", "7F1D1D"],
  ["FFEDD5", "FDBA74", "F97316", "EA580C", "D97706", "92400E"],
  ["FEF9C3", "FDE047", "EAB308", "CA8A04", "A16207", "713F12"],
  ["DCFCE7", "86EFAC", "BFD258", "22C55E", "708830", "166534"],
  ["DBEAFE", "93C5FD", "3B82F6", "2563EB", "1D4ED8", "1E3A8A"],
  ["EDE9FE", "C4B5FD", "8B5CF6", "7C3AED", "6D28D9", "4C1D95"],
];

// ---------- raw key reader ----------
function readKeys(onKey) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const handler = (key) => {
      if (key === "") { // Ctrl-C
        stdin.setRawMode(false);
        process.stdout.write("\n");
        process.exit(130);
      }
      const done = onKey(key);
      if (done !== undefined) {
        stdin.removeListener("data", handler);
        stdin.setRawMode(false);
        stdin.pause();
        resolve(done);
      }
    };
    stdin.on("data", handler);
  });
}
const KEY = { UP: "[A", DOWN: "[B", RIGHT: "[C", LEFT: "[D", ENTER1: "\r", ENTER2: "\n" };

// ---------- color picker TUI ----------
async function pickColor(label, current) {
  let row = 0, col = 0;
  // start cursor on current color if present in palette
  outer: for (let r = 0; r < PALETTE.length; r++) {
    for (let c = 0; c < PALETTE[r].length; c++) {
      if (PALETTE[r][c].toUpperCase() === current.toUpperCase()) { row = r; col = c; break outer; }
    }
  }
  const draw = (selected) => {
    let out = "\x1b[2J\x1b[H";
    out += `${BOLD}${label}${R}   ${DIM}arrows = move · Enter = pick · h = hex · q = keep current${R}\n\n`;
    PALETTE.forEach((line, r) => {
      out += "  ";
      line.forEach((hex, c) => {
        const on = r === row && c === col;
        out += on ? `\x1b[97m[${R}${swatch(hex)}\x1b[97m]${R}` : ` ${swatch(hex)} `;
      });
      out += "\n";
    });
    out += `\n  current: ${swatch(current, 3)} ${fg("FFFFFF")}#${current}${R}`;
    out += `   selected: ${swatch(selected, 3)} ${BOLD}#${selected}${R}\n`;
    process.stdout.write(out);
  };
  draw(PALETTE[row][col]);
  while (true) {
    const key = await readKeys((k) => {
      if (k === KEY.UP) { row = (row - 1 + PALETTE.length) % PALETTE.length; col = Math.min(col, PALETTE[row].length - 1); return "move"; }
      if (k === KEY.DOWN) { row = (row + 1) % PALETTE.length; col = Math.min(col, PALETTE[row].length - 1); return "move"; }
      if (k === KEY.LEFT) { col = (col - 1 + PALETTE[row].length) % PALETTE[row].length; return "move"; }
      if (k === KEY.RIGHT) { col = (col + 1) % PALETTE[row].length; return "move"; }
      if (k === KEY.ENTER1 || k === KEY.ENTER2) return "pick";
      if (k === "h" || k === "H") return "hex";
      if (k === "q" || k === "Q") return "keep";
      return undefined;
    });
    if (key === "pick") return PALETTE[row][col];
    if (key === "keep") return current;
    if (key === "hex") {
      process.stdout.write("\x1b[2J\x1b[H");
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ans = await new Promise((res) => rl.question(`${label} — enter hex (6 digits) [${current}]: `, res));
      rl.close();
      return cleanHex(ans, current);
    }
    draw(PALETTE[row][col]);
  }
}

// ---------- font chooser TUI ----------
async function pickFont(label, current, fonts) {
  const idx0 = Math.max(0, fonts.indexOf(current));
  let idx = idx0;
  let filter = "";
  const PAGE = 12;
  const draw = () => {
    const list = filter ? fonts.filter((f) => f.toLowerCase().includes(filter.toLowerCase())) : fonts;
    if (idx >= list.length) idx = Math.max(0, list.length - 1);
    const start = Math.max(0, Math.min(idx - Math.floor(PAGE / 2), Math.max(0, list.length - PAGE)));
    let out = "\x1b[2J\x1b[H";
    out += `${BOLD}${label}${R}   ${DIM}arrows = move · Enter = pick · type = filter · Backspace · q = keep${R}\n`;
    out += `  ${DIM}current:${R} ${current}    ${DIM}filter:${R} ${filter || "—"}\n\n`;
    list.slice(start, start + PAGE).forEach((f, i) => {
      const real = start + i;
      out += real === idx ? `  ${fg("BFD258")}❯ ${BOLD}${f}${R}\n` : `    ${f}\n`;
    });
    if (!list.length) out += `  ${DIM}(no match)${R}\n`;
    process.stdout.write(out);
    return list;
  };
  let list = draw();
  while (true) {
    const action = await readKeys((k) => {
      if (k === KEY.UP) { idx = Math.max(0, idx - 1); return "move"; }
      if (k === KEY.DOWN) { idx = idx + 1; return "move"; }
      if (k === KEY.ENTER1 || k === KEY.ENTER2) return "pick";
      if (k === "" || k === "\b") { filter = filter.slice(0, -1); idx = 0; return "move"; }
      if (k === "") return "keep"; // Ctrl-Q safety
      if (k.length === 1 && k >= " " && !["\r", "\n"].includes(k)) {
        // 'q' alone keeps only when no filter typed yet
        if ((k === "q" || k === "Q") && filter === "") return "keep";
        filter += k; idx = 0; return "move";
      }
      return undefined;
    });
    list = filter ? fonts.filter((f) => f.toLowerCase().includes(filter.toLowerCase())) : fonts;
    if (action === "pick") return list[idx] || current;
    if (action === "keep") return current;
    list = draw();
  }
}

// ---------- logo chooser TUI (file browser) ----------
const IMG_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"]);
function listDir(dir) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch { return []; }
  const dirs = [], files = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    if (e.isDirectory()) dirs.push({ name: e.name, dir: true });
    else if (IMG_EXT.has(path.extname(e.name).toLowerCase())) files.push({ name: e.name, dir: false });
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  return [{ name: "..", dir: true, up: true }, ...dirs, ...files];
}
async function pickImage(label, current) {
  let cwd = current && fs.existsSync(current) ? path.dirname(path.resolve(current))
    : (current && fs.existsSync(path.dirname(current)) ? path.dirname(current) : process.cwd());
  let items = listDir(cwd);
  let idx = 0;
  const PAGE = 14;
  const draw = () => {
    if (idx >= items.length) idx = Math.max(0, items.length - 1);
    const start = Math.max(0, Math.min(idx - Math.floor(PAGE / 2), Math.max(0, items.length - PAGE)));
    let out = "\x1b[2J\x1b[H";
    out += `${BOLD}${label}${R}   ${DIM}arrows = move · Enter = open/select · h = path · x = none · q = keep${R}\n`;
    out += `  ${DIM}dir:${R} ${cwd}\n  ${DIM}current:${R} ${current || "(none)"}\n\n`;
    items.slice(start, start + PAGE).forEach((it, i) => {
      const real = start + i;
      const tag = it.up ? "⤴ .." : it.dir ? `${fg("BFD258")}▸ ${it.name}/${R}` : `🖼 ${it.name}`;
      out += real === idx ? `  ${fg("BFD258")}❯ ${BOLD}${tag}${R}\n` : `    ${tag}\n`;
    });
    if (items.length <= 1) out += `  ${DIM}(no images here)${R}\n`;
    process.stdout.write(out);
  };
  draw();
  while (true) {
    const action = await readKeys((k) => {
      if (k === KEY.UP) { idx = Math.max(0, idx - 1); return "move"; }
      if (k === KEY.DOWN) { idx = Math.min(items.length - 1, idx + 1); return "move"; }
      if (k === KEY.LEFT) return "up";
      if (k === KEY.ENTER1 || k === KEY.ENTER2) return "enter";
      if (k === "h" || k === "H") return "path";
      if (k === "x" || k === "X") return "none";
      if (k === "q" || k === "Q") return "keep";
      return undefined;
    });
    if (action === "keep") return current;
    if (action === "none") return "";
    if (action === "path") {
      process.stdout.write("\x1b[2J\x1b[H");
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ans = await new Promise((res) => rl.question(`${label} path [${current || "none"}]: `, res));
      rl.close();
      return (ans || current).trim();
    }
    const sel = items[idx];
    if (action === "up" || (action === "enter" && sel && sel.up)) {
      cwd = path.dirname(cwd); items = listDir(cwd); idx = 0;
    } else if (action === "enter" && sel) {
      if (sel.dir) { cwd = path.join(cwd, sel.name); items = listDir(cwd); idx = 0; }
      else return path.join(cwd, sel.name);
    }
    draw();
  }
}

const pickLogo = (current) => pickImage("Logo image", current);

// ---------- plain fallback ----------
async function plainPrompts(theme) {
  const raw = fs.readFileSync(0, "utf8"); // read all piped stdin
  const lines = raw.split("\n");
  let i = 0;
  const ask = (_q, fb = "") => {
    const v = i < lines.length ? lines[i++].trim() : "";
    return v || fb;
  };
  theme.companyName = await ask("Company name (empty for none)", theme.companyName);
  theme.logo = await ask("Logo path (empty for none)", theme.logo);
  theme.backgroundImage = await ask("Background image path (empty for none)", theme.backgroundImage);
  theme.backgroundOpacity = cleanNumber(await ask("Background opacity 0-1", theme.backgroundOpacity), theme.backgroundOpacity, 0, 1);
  theme.watermark = await ask("Watermark text (empty for none)", theme.watermark);
  theme.watermarkColor = cleanHex(await ask("Watermark color hex", theme.watermarkColor), theme.watermarkColor);
  theme.watermarkTransparency = cleanNumber(await ask("Watermark transparency 0-100", theme.watermarkTransparency), theme.watermarkTransparency, 0, 100);
  theme.pageNumberFormat = await ask("Page number format, e.g. #{{page}} or {{page}}/{{total}} (empty for none)", theme.pageNumberFormat);
  theme.pageNumberColor = cleanHex(await ask("Page number color hex", theme.pageNumberColor), theme.pageNumberColor);
  theme.footer = await ask("Footer text (empty for none)", theme.footer);
  theme.confidentiality = await ask("Confidentiality text (empty for none)", theme.confidentiality);
  theme.author = await ask("Default author shown on cover (empty for none)", theme.author);
  theme.colors.accent = cleanHex(await ask("Primary accent hex", theme.colors.accent), theme.colors.accent);
  theme.colors.accent2 = cleanHex(await ask("Secondary accent hex", theme.colors.accent2), theme.colors.accent2);
  theme.colors.ink = cleanHex(await ask("Text color hex", theme.colors.ink), theme.colors.ink);
  theme.colors.softBg = cleanHex(await ask("Cover background hex", theme.colors.softBg), theme.colors.softBg);
  theme.colors.whiteBg = cleanHex(await ask("Content slide background hex", theme.colors.whiteBg), theme.colors.whiteBg);
  theme.colors.darkBg = cleanHex(await ask("Section divider background hex", theme.colors.darkBg), theme.colors.darkBg);
  theme.fonts.head = await ask("Heading font", theme.fonts.head);
  theme.fonts.body = await ask("Body font", theme.fonts.body);
}

// ---------- main ----------
async function main() {
  const target = process.argv[2] || defaultUserThemeTarget();
  // base = factory defaults; if an existing theme is present at target, overlay it
  // so the prompts pre-fill with previously saved values (new fields still inherit defaults).
  const theme = structuredClone(defaultTheme);
  if (fs.existsSync(target)) {
    try {
      const existing = JSON.parse(fs.readFileSync(target, "utf8"));
      deepMerge(theme, existing);
    } catch { /* malformed file → keep factory defaults */ }
  }

  if (!isTTY) {
    await plainPrompts(theme);
  } else {
    // text fields first (line mode)
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q, fb = "") => new Promise((r) => rl.question(`${q}${fb ? ` [${fb}]` : ""}: `, (a) => r((a || fb).trim())));
    process.stdout.write(`${BOLD}Corporate PPTX — theme setup${R}\n\n`);
    theme.companyName = await ask("Company name (empty for none)", theme.companyName);
    theme.footer = await ask("Footer text (empty for none)", theme.footer);
    theme.confidentiality = await ask("Confidentiality text (empty for none)", theme.confidentiality);
    theme.author = await ask("Default author shown on cover (empty for none)", theme.author);
    theme.watermark = await ask("Watermark text (empty for none)", theme.watermark);
    theme.pageNumberFormat = await ask("Page number format, e.g. #{{page}} or {{page}}/{{total}} (empty for none)", theme.pageNumberFormat);
    theme.backgroundOpacity = cleanNumber(await ask("Background opacity 0-1", theme.backgroundOpacity), theme.backgroundOpacity, 0, 1);
    theme.watermarkTransparency = cleanNumber(await ask("Watermark transparency 0-100", theme.watermarkTransparency), theme.watermarkTransparency, 0, 100);
    rl.close();

    theme.logo = await pickLogo(theme.logo);
    theme.backgroundImage = await pickImage("Background image", theme.backgroundImage);

    const colorFields = [
      ["accent", "Primary accent"],
      ["accent2", "Secondary accent"],
      ["ink", "Text color"],
      ["watermarkColor", "Watermark color"],
      ["pageNumberColor", "Page number color"],
      ["softBg", "Cover background"],
      ["whiteBg", "Content slide background"],
      ["darkBg", "Section divider background"],
    ];
    for (const [key, lbl] of colorFields) {
      if (key === "watermarkColor") theme.watermarkColor = await pickColor(lbl, theme.watermarkColor);
      else if (key === "pageNumberColor") theme.pageNumberColor = await pickColor(lbl, theme.pageNumberColor);
      else theme.colors[key] = await pickColor(lbl, theme.colors[key]);
    }

    const fonts = systemFonts();
    theme.fonts.head = await pickFont("Heading font", theme.fonts.head, fonts);
    theme.fonts.body = await pickFont("Body font", theme.fonts.body, fonts);
    process.stdout.write("\x1b[2J\x1b[H");
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(theme, null, 2)}\n`);
  console.log(`Theme written: ${target}`);
  process.exit(0);
}

main().catch((err) => {
  if (process.stdin.isTTY) try { process.stdin.setRawMode(false); } catch {}
  console.error(err);
  process.exit(1);
});
