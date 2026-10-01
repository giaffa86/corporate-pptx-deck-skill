#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = __dirname;
const skillName = "corporate-pptx-deck";
const source = path.join(root, skillName);

const targets = {
  codex: path.join(os.homedir(), ".codex", "skills", skillName),
  claude: path.join(os.homedir(), ".claude", "skills", skillName),
  opencode: path.join(os.homedir(), ".opencode", "skills", skillName),
  portable: path.join(root, "dist", skillName),
};

function copyDir(src, dst) {
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function writeAdapter(target, agent) {
  const adapter = `# ${skillName} adapter for ${agent}

Use this folder as portable instructions for agents without native Codex skill loading.

Read SKILL.md first. Then use:

- scripts/init-theme.js for optional local theme setup
- scripts/build-deck.js for PptxGenJS deck generation
- scripts/render-check.js to render slides to PNG for visual inspection
- references/theme-schema.md for theme config
- references/deck-patterns.md for deck structure

Do not commit private logos or local theme files.
`;
  fs.writeFileSync(path.join(target, "AGENTS.md"), adapter);
}

function main() {
  const args = new Set(process.argv.slice(2));
  const selected = args.size ? [...args].map((x) => x.replace(/^--/, "")) : ["codex"];
  if (selected.includes("all")) selected.splice(0, selected.length, "codex", "claude", "opencode", "portable");

  for (const name of selected) {
    const target = targets[name];
    if (!target) {
      console.error(`Unknown target: ${name}`);
      process.exitCode = 1;
      continue;
    }
    copyDir(source, target);
    if (name === "opencode" || name === "portable") writeAdapter(target, name);
    console.log(`Installed ${skillName} -> ${target}`);
  }
}

main();
