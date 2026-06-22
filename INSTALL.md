# Install

Install to Codex:

```bash
node install.js codex
```

Install to Claude Code:

```bash
node install.js claude
```

Install portable adapter for opencode:

```bash
node install.js opencode
```

Install all:

```bash
node install.js all
```

Notes:

- Codex and Claude Code use the native `SKILL.md` folder.
- opencode support is a portable adapter folder with `AGENTS.md` plus the same scripts/references.
- For other coding agents, copy `dist/corporate-pptx-deck` or the skill folder into their instruction/plugin directory.
- No company logo or private theme is included. Configure local branding with `scripts/init-theme.js`.
