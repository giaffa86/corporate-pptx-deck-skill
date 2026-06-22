---
name: corporate-pptx-deck
description: Create editable corporate PowerPoint decks using PptxGenJS with an optional user-provided brand theme. Use when the user asks for a PPTX, PowerPoint, corporate deck, business report, technical presentation, agenda-based recap, speaker deck, or asks to configure a logo/theme for generated slides.
---

# Corporate PPTX Deck

## Workflow

1. Use PptxGenJS for final `.pptx` output.
2. Load theme config if available:
   - project-local `theme.local.json`
   - user-local `~/.codex/corporate-pptx-deck/theme.json`
   - fallback to `assets/default-theme.json`
3. For first-time setup, run `scripts/init-theme.js`.
4. Create deck data JSON, then run `scripts/build-deck.js`.
5. Verify generated deck:
   - count slides with `unzip -l deck.pptx | rg 'ppt/slides/slide[0-9]+\\.xml' | wc -l`
   - if LibreOffice exists, convert to PDF for render inspection.

`scripts/init-theme.js` is interactive when a TTY is available. `scripts/build-deck.js` is non-interactive: pass `deck.json output.pptx`; it reads JSON, resolves theme, writes PPTX.

The deck JSON must exist before running `scripts/build-deck.js`. The script does
not convert `.md`, `.dokuwiki`, or existing `.pptx` files directly; create/update
the JSON first, then render.

Prefer a sidecar source file next to the output, e.g.
`presentations/name.json` -> `presentations/name.pptx`. Treat JSON as
source of truth and PPTX as generated output.

Run `scripts/build-deck.js` from the project root that owns `theme.local.json`,
relative image paths, and deliverable paths. Relative input, image, and output
paths resolve from the command working directory. Auto-versioning writes
`.deck-versions.json` next to the output PPTX.

## Design Rules

- 16:9 widescreen.
- Real editable `.pptx`, not screenshots-only.
- Max 5 bullets per slide.
- One main idea per slide.
- Prefer title + left text + right visual + bottom callout.
- Add speaker notes when useful.
- If no logo is configured, do not show a logo.
- Never assume a company name, logo, confidentiality string, or proprietary palette.

## Setup

To configure a brand theme:

```bash
node corporate-pptx-deck/scripts/init-theme.js
```

For global `pptxgenjs`, use:

```bash
NODE_PATH=$(npm root -g) node corporate-pptx-deck/scripts/build-deck.js deck.json output.pptx
```

## Data Model

Use `examples/sample-deck.json` as the starting data shape. Patch project-specific content there, then generate the deck.

Read `references/deck-data.md` for the full deck JSON contract, including metadata, versioning, author, slide types, background images, watermarks, page numbering, image paths, and speaker notes.

## References

- Deck data fields: `references/deck-data.md`
- Theme fields: `references/theme-schema.md`
- Deck patterns: `references/deck-patterns.md`
