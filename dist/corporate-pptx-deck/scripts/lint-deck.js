#!/usr/bin/env node
// Validate deck JSON against references/deck.schema.json and flag content that
// is likely to overflow or read badly. Warnings only; --strict exits 1 on any.
const fs = require("fs");
const path = require("path");

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "references", "deck.schema.json"), "utf8"));

const LIMITS = {
  bullets: 5,
  bulletChars: 90,
  titleChars: 60,
  coverTitleChars: 70,
  subtitleChars: 120,
  calloutChars: 140,
  agendaItems: 10,
  takeaways: 5,
  minFontSize: 11,
};

// ---------- minimal JSON Schema subset: type, enum, pattern, min/max, properties, additionalProperties, items, $ref ----------
function typeOf(v) {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  return typeof v;
}

function resolveRef(ref) {
  return ref.replace(/^#\//, "").split("/").reduce((node, key) => node[key], schema);
}

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function suggest(key, known) {
  let best = null;
  for (const k of known) {
    const d = editDistance(key.toLowerCase(), k.toLowerCase());
    if (d <= 2 && (!best || d < best.d)) best = { k, d };
  }
  return best ? ` (did you mean "${best.k}"?)` : "";
}

function validate(value, node, where, out) {
  if (node.$ref) node = resolveRef(node.$ref);
  if (node.enum && !node.enum.includes(value)) {
    out.push({ where, message: `must be one of ${node.enum.map((e) => JSON.stringify(e)).join(", ")}` });
    return;
  }
  if (node.type) {
    const types = [].concat(node.type);
    const t = typeOf(value);
    if (!types.includes(t) && !(t === "number" && types.includes("integer"))) {
      out.push({ where, message: `expected ${types.join(" or ")}, got ${t}` });
      return;
    }
  }
  if (typeof value === "string" && node.pattern && !new RegExp(node.pattern).test(value)) {
    const hint = value.startsWith("#") ? " (omit the #)" : "";
    out.push({ where, message: `"${value}" does not match ${node.description || node.pattern}${hint}` });
  }
  if (typeof value === "number") {
    if (node.minimum !== undefined && value < node.minimum) out.push({ where, message: `${value} is below minimum ${node.minimum}` });
    if (node.maximum !== undefined && value > node.maximum) out.push({ where, message: `${value} is above maximum ${node.maximum}` });
  }
  if (Array.isArray(value) && node.items) {
    value.forEach((item, i) => validate(item, node.items, `${where}[${i}]`, out));
  }
  if (typeOf(value) === "object" && node.properties) {
    const known = Object.keys(node.properties);
    for (const [k, v] of Object.entries(value)) {
      const child = where ? `${where}.${k}` : k;
      if (node.properties[k]) validate(v, node.properties[k], child, out);
      else if (node.additionalProperties === false) out.push({ where: child, message: `unknown field, ignored${suggest(k, known)}` });
    }
  }
}

// ---------- content rules ----------
function len(s) {
  return typeof s === "string" ? s.length : 0;
}

function contentRules(deck, out) {
  const warn = (where, message) => out.push({ where, message });

  if (!deck.title) warn("title", "missing; cover falls back to \"Corporate Deck\"");
  if (len(deck.title) > LIMITS.coverTitleChars) warn("title", `${len(deck.title)} chars, keep cover title under ${LIMITS.coverTitleChars}`);
  if (len(deck.subtitle) > LIMITS.subtitleChars) warn("subtitle", `${len(deck.subtitle)} chars, keep under ${LIMITS.subtitleChars}`);
  if (Array.isArray(deck.agenda) && deck.agenda.length > LIMITS.agendaItems) {
    warn("agenda", `${deck.agenda.length} items, more than ${LIMITS.agendaItems} will be cramped; group items or split the agenda`);
  }
  if (!Array.isArray(deck.sections) || deck.sections.length === 0) warn("sections", "no content slides");
  if (Array.isArray(deck.takeaways) && deck.takeaways.length > LIMITS.takeaways) {
    warn("takeaways", `${deck.takeaways.length} items, keep to ${LIMITS.takeaways} or fewer`);
  }
  (deck.takeaways || []).forEach((t, i) => {
    if (len(t) > LIMITS.bulletChars) warn(`takeaways[${i}]`, `${len(t)} chars, keep under ${LIMITS.bulletChars}`);
  });
  if (len(deck.takeawayCallout) > LIMITS.calloutChars) warn("takeawayCallout", `${len(deck.takeawayCallout)} chars, keep under ${LIMITS.calloutChars}`);

  (Array.isArray(deck.sections) ? deck.sections : []).forEach((s, i) => {
    if (typeOf(s) !== "object") return;
    const where = `sections[${i}]${s.title ? ` "${String(s.title).slice(0, 40)}"` : ""}`;
    if (!s.title) warn(where, "missing title");
    if (len(s.title) > LIMITS.titleChars) warn(where, `title is ${len(s.title)} chars, keep under ${LIMITS.titleChars}`);

    if (s.type === "section") {
      for (const k of ["bullets", "callout", "eyebrow", "speaker"]) {
        if (s[k] !== undefined) warn(`${where}.${k}`, "ignored on section dividers; use a topic slide");
      }
      return;
    }

    const bullets = Array.isArray(s.bullets) ? s.bullets : [];
    if (bullets.length > LIMITS.bullets) warn(`${where}.bullets`, `${bullets.length} bullets, keep to ${LIMITS.bullets} or fewer; split the slide or move detail to notes`);
    bullets.forEach((b, j) => {
      if (len(b) > LIMITS.bulletChars) warn(`${where}.bullets[${j}]`, `${len(b)} chars, keep under ${LIMITS.bulletChars}`);
    });
    if (len(s.callout) > LIMITS.calloutChars) warn(`${where}.callout`, `${len(s.callout)} chars, keep under ${LIMITS.calloutChars}`);
    if (typeof s.fontSize === "number" && s.fontSize < LIMITS.minFontSize) warn(`${where}.fontSize`, `${s.fontSize}pt is hard to read; cut content instead`);
    if (!bullets.length && !s.callout && !s.image) warn(where, "no bullets, callout, or image; slide will be nearly empty");
  });
}

function lintDeck(deck) {
  const out = [];
  validate(deck, schema, "", out);
  if (typeOf(deck) === "object") contentRules(deck, out);
  return out;
}

function printWarnings(warnings, stream = process.stderr) {
  for (const w of warnings) stream.write(`Lint: ${w.where || "(deck)"}: ${w.message}\n`);
}

module.exports = { lintDeck, printWarnings, LIMITS };

if (require.main === module) {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("Usage: node lint-deck.js deck.json [--strict]");
    process.exit(1);
  }
  let deck;
  try {
    deck = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  } catch (err) {
    console.error(`Cannot read deck JSON: ${err.message}`);
    process.exit(1);
  }
  const warnings = lintDeck(deck);
  printWarnings(warnings);
  console.log(warnings.length ? `${warnings.length} lint warning(s)` : "Lint clean");
  if (strict && warnings.length) process.exit(1);
}
