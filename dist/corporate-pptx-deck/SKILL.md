---
name: corporate-pptx-deck
description: Create editable corporate PowerPoint decks using PptxGenJS with an optional user-provided brand theme. Use when the user asks for a PPTX, PowerPoint, corporate deck, business report, technical presentation, agenda-based recap, speaker deck, or asks to configure a logo/theme for generated slides.
---

# Corporate PPTX Deck

## Workflow

1. Use PptxGenJS for final `.pptx` output.
2. Load theme config if available:
   - project-local `theme.local.json` (overlays the user theme)
   - user theme: `--theme path`, else `$CORPORATE_PPTX_THEME`, else the first
     existing `~/.{codex,claude,opencode}/corporate-pptx-deck/theme.json`
     (the agent home where the skill is installed is checked first)
   - fallback to `assets/default-theme.json`
3. For first-time setup, run `scripts/init-theme.js`.
4. Create deck data JSON, then run `scripts/build-deck.js`.
5. Verify the generated deck (see "Visual Check" below):
   - read stderr: `Warning: image not found, skipped: ...` means a broken image path
   - render with `node corporate-pptx-deck/scripts/render-check.js deck.pptx`
   - look at every PNG, fix the deck JSON, rebuild with `--no-bump`, re-render
   - repeat until clean, then do one final build without `--no-bump` if the deck
     auto-versions

`scripts/init-theme.js` is interactive when a TTY is available. `scripts/build-deck.js` is non-interactive: pass `deck.json output.pptx`; it reads JSON, resolves theme, writes PPTX.
Options: `--theme theme.json` (explicit user theme), `--no-bump` (rebuild without
advancing the auto-version ledger; use it for verification rebuilds).

The deck JSON must exist before running `scripts/build-deck.js`. The script does
not convert `.md`, `.dokuwiki`, or existing `.pptx` files directly; create/update
the JSON first, then render.

Prefer a sidecar source file next to the output, e.g.
`presentations/name.json` -> `presentations/name.pptx`. Treat JSON as
source of truth and PPTX as generated output.

Run `scripts/build-deck.js` from the project root that owns `theme.local.json`
and deliverable paths. Input and output paths resolve from the command working
directory. Relative image paths resolve from the deck JSON folder first, then
the working directory. Auto-versioning writes `.deck-versions.json` next to the
output PPTX.

Fixed slide strings (cover label, "Section", takeaway eyebrow) follow `lang`
(`it-*` → Italian, otherwise English); override them with `labels`.

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

## Visual Check

`scripts/render-check.js deck.pptx [outDir] [--dpi 50]` converts the PPTX to PDF
with LibreOffice and to one PNG per slide with `pdftoppm`. It prints the slide
count and the PNG paths (default `outDir`: `$TMPDIR/deck-check-<name>`), and
warns when rendered pages and slides differ. It uses an isolated LibreOffice
profile, so a running LibreOffice does not block it.

Inspect every PNG and look for:

- text overflowing its box or cut off at the bottom (`fit: "shrink"` does not
  shrink text at render time, so long text really overflows)
- overlapping elements (title over speaker line, callout over bullets, image over text)
- low contrast (text on background image, light text on light background)
- empty or near-empty slides, missing images, wrong slide order
- footer, page number, and watermark readable but not dominant

Fix problems in the deck JSON, not in the PPTX: shorten bullets or titles, split
a dense slide in two, move detail to `notes`, lower `fontSize`, change or drop an
image, reduce `backgroundOpacity`. Rebuild with `--no-bump` while iterating so
verification rebuilds do not advance the version.

If LibreOffice or `pdftoppm` is missing, the script prints
`Warning: render skipped, ...` and exits 0. Then fall back to the slide count
(`unzip -l deck.pptx | grep -cE 'ppt/slides/slide[0-9]+\.xml$'`) and the content
rules in Design Rules, and tell the user the deck was not visually checked.

LibreOffice rendering is close to PowerPoint but not identical (fonts may be
substituted). Treat it as a check for layout problems, not pixel-exact output.

## Data Model

Use `examples/sample-deck.json` as the starting data shape. Patch project-specific content there, then generate the deck.

Read `references/deck-data.md` for the full deck JSON contract, including metadata, versioning, author, slide types, background images, watermarks, page numbering, image paths, and speaker notes.

## References

- Deck data fields: `references/deck-data.md`
- Theme fields: `references/theme-schema.md`
- Deck patterns: `references/deck-patterns.md`
