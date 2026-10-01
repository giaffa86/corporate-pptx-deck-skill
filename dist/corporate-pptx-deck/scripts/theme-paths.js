const fs = require("fs");
const os = require("os");
const path = require("path");

const skillName = "corporate-pptx-deck";
const skillDir = path.resolve(__dirname, "..");
const agentHomes = [".codex", ".claude", ".opencode"];

// Agent home that owns this installed copy, e.g. ~/.claude for ~/.claude/skills/corporate-pptx-deck.
function installedAgentHome() {
  const parent = path.dirname(skillDir);
  if (path.basename(parent) !== "skills") return null;
  const home = path.dirname(parent);
  return agentHomes.includes(path.basename(home)) ? home : null;
}

function userThemeCandidates() {
  const own = installedAgentHome();
  const homes = [own, ...agentHomes.map((d) => path.join(os.homedir(), d))].filter(Boolean);
  return [...new Set(homes)].map((h) => path.join(h, skillName, "theme.json"));
}

// User theme lookup: explicit path > CORPORATE_PPTX_THEME > installed agent home > ~/.codex, ~/.claude, ~/.opencode.
function findUserTheme(explicit) {
  if (explicit) return path.resolve(explicit);
  if (process.env.CORPORATE_PPTX_THEME) return path.resolve(process.env.CORPORATE_PPTX_THEME);
  return userThemeCandidates().find((p) => fs.existsSync(p)) || null;
}

// Default write target for init-theme.js.
function defaultUserThemeTarget() {
  if (process.env.CORPORATE_PPTX_THEME) return path.resolve(process.env.CORPORATE_PPTX_THEME);
  return userThemeCandidates()[0];
}

module.exports = { findUserTheme, defaultUserThemeTarget, userThemeCandidates };
