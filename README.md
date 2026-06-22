# Corporate PPTX Deck Skill

Codex/agent skill for generating editable corporate PowerPoint decks with [PptxGenJS](https://gitbrent.github.io/PptxGenJS/).

The default theme is neutral. No company logo, company name, or private branding is bundled. Branding can be configured locally during setup.

## Features

- Generates real editable `.pptx` files.
- Uses a generic corporate 16:9 layout.
- Supports optional local logo/theme config.
- Includes deck helpers for cover, agenda, section, topic, takeaway, and closing slides.
- Supports speaker notes.
- Can be installed for Codex, Claude Code, opencode, or used as a portable agent instruction folder.

## Requirements

- Node.js
- `pptxgenjs`

Install dependency locally:

```bash
npm install
```

Or use a global install:

```bash
npm install -g pptxgenjs
```

When using global `pptxgenjs`, run scripts with:

```bash
NODE_PATH=$(npm root -g) node corporate-pptx-deck/scripts/build-deck.js corporate-pptx-deck/examples/sample-deck.json output.pptx
```

## Install The Skill

Codex:

```bash
node install.js codex
```

Claude Code:

```bash
node install.js claude
```

opencode:

```bash
node install.js opencode
```

All targets:

```bash
node install.js all
```

## Configure Branding

Optional interactive setup:

```bash
node corporate-pptx-deck/scripts/init-theme.js
```

Pass a path to write somewhere other than the default:

```bash
node corporate-pptx-deck/scripts/init-theme.js ./theme.local.json
```

In a real terminal (TTY) this runs a keyboard-driven TUI — no extra dependencies:

- **Color picker** for every color field (`accent`, `accent2`, `ink`, `watermarkColor`, `pageNumberColor`, `softBg`, `whiteBg`, `darkBg`): truecolor swatch grid, arrows to move, `Enter` to pick, `h` for manual hex, `q` to keep current.
- **Logo chooser**: file browser filtered to images, arrows to move, `Enter` to open a folder or select a file, `←` to go up, `h` for manual path, `x` for no logo, `q` to keep current.
- **Background image chooser**: same file browser for an optional deck-wide background image.
- **Watermark setup**: optional deck-wide watermark text, color, and transparency.
- **Page numbering**: optional footer format such as `#{{page}}`, `Pag. {{page}}`, or `{{page}}/{{total}}`.
- **Font chooser**: list of system fonts (via `fc-list`), arrows to move, type to filter, `Enter` to pick.
- Re-running pre-fills every prompt with the **currently saved** values, so editing one field leaves the rest untouched (empty input keeps the existing value).

When stdin is not a TTY (pipes / CI), it falls back to plain line prompts reading answers in field order.

By default it writes a local user theme to:

```text
~/.codex/corporate-pptx-deck/theme.json
```

Theme lookup order:

1. `theme.local.json` in the current project
2. `~/.codex/corporate-pptx-deck/theme.json`
3. `corporate-pptx-deck/assets/default-theme.json`

Private logos and local themes should not be committed.

## Generate A Deck

`build-deck.js` is not interactive and does not open a TUI. It is a deterministic
CLI renderer: it reads one deck JSON file and writes one `.pptx` file.

```bash
node corporate-pptx-deck/scripts/build-deck.js corporate-pptx-deck/examples/sample-deck.json output.pptx
```

Arguments:

- first argument: input deck JSON
- second argument: output `.pptx`; defaults to `output.pptx` when omitted

Run the command from the project root that owns the deck, theme, and image
paths. `build-deck.js` resolves relative paths from the directory where the
command is launched:

- input deck JSON path
- slide/background image paths inside the deck JSON
- project-local `theme.local.json`
- output path

For example, if your deck lives in `presentations`:

```bash
cd /path/to/project
node /path/to/corporate-pptx-deck/scripts/build-deck.js \
  presentations/quarterly-review.json \
  presentations/quarterly-review.pptx
```

Auto-versioning state, when enabled, is written as `.deck-versions.json` next to
the output `.pptx`.

Input deck data is JSON. The source file describes deck metadata, agenda items,
content slides, takeaways, optional images, and speaker notes.

The input JSON must already exist. `build-deck.js` does not convert `.md`,
`.dokuwiki`, or an existing `.pptx` directly; create or update the deck JSON
first, then render it.

Recommended convention: keep the deck JSON next to the PPTX with the same base
name:

```text
presentations/quarterly-review.json
presentations/quarterly-review.pptx
```

```text
corporate-pptx-deck/examples/sample-deck.json
```

Deck file documentation:

```text
corporate-pptx-deck/references/deck-data.md
```

> The deck JSON is normally authored and maintained by the assistant from the
> user's natural-language request (e.g. "generate a deck from this document",
> "bump the version", "set the author to X"). The user does not need to write or
> edit JSON; they state the intent and the assistant edits the deck file, then
> rebuilds.

`init-theme.js` is the only interactive script. Use it for local branding setup.
Use `build-deck.js` for repeatable generation in terminal, CI, or agent flows.

Quick rules:

- `title`, `subtitle`, and `date` appear on the cover.
- `version` appears on the cover as `vX` and is written to PPTX metadata.
  - `version` set, no `autoIncrement`: **frozen** — same value on every rebuild.
  - `autoIncrement: true`: **auto** — bumps on every rebuild via a local
    `.deck-versions.json` ledger **keyed by the output filename** (not the deck
    JSON); `version`, if present, seeds the first build.
  - Neither set: auto-increment starting at `0.0.1` (back-compat default).
  - At regeneration, ask the assistant to freeze, bump, or turn on
    `autoIncrement`. See `references/deck-data.md`.
- `author` appears on the cover and is written to PPTX metadata. If omitted, the
  generator uses `theme.author` (configured once via `init-theme.js`). Keep real
  names in the local theme, not in committed files.
- Relative image paths are resolved from the directory where the command runs.
- `backgroundImage` adds a full-slide background image. `backgroundOpacity`
  controls visibility from `0` to `1`; PNGs with alpha are supported.
- `watermark` adds large rotated semi-transparent text. Use
  `watermarkTransparency` from `0` opaque to `100` invisible.
- `pageNumberFormat` controls footer numbering. Supported tokens:
  `{{page}}` and `{{total}}`.
- `sections` controls the main slide sequence. Set `"type": "section"` for a
  dark divider; omit it for a normal topic slide.
- `notes` values become PowerPoint speaker notes.

## Verify Output

Count slides:

```bash
unzip -l output.pptx | rg 'ppt/slides/slide[0-9]+\.xml' | wc -l
```

Optional PDF render check:

```bash
libreoffice --headless --convert-to pdf --outdir /tmp/pptx-check output.pptx
```

## Repository Layout

```text
corporate-pptx-deck/
  SKILL.md
  agents/openai.yaml
  assets/default-theme.json
  examples/sample-deck.json
  references/deck-data.md
  references/deck-patterns.md
  references/theme-schema.md
  scripts/build-deck.js
  scripts/init-theme.js
install.js
INSTALL.md
package.json
```

## Privacy

This repo intentionally contains no private company branding.

Use local theme files for logos, colors, company names, confidentiality labels, and other organization-specific instructions.
