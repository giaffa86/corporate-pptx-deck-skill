# Roadmap

Planned improvements for the `corporate-pptx-deck` skill, in suggested order.

## Done

- [x] **Block 1 — Fixes and consistency**
  - Fixed slide strings follow `lang`, overridable via `labels`
  - User theme lookup: `--theme`, `CORPORATE_PPTX_THEME`, installed agent home, `~/.{codex,claude,opencode}`
  - Missing-image warnings; relative images resolve from the deck JSON folder first
  - `--no-bump` for verification rebuilds
  - Hardcoded footer/section/callout colors moved into theme
  - `rg` replaced with `grep` in `SKILL.md`

## Block 2 — Visual verification in the workflow

Goal: the agent sees the rendered slides and fixes problems before handing off.

- [ ] Add a render step to `SKILL.md`:
  ```bash
  soffice --headless --convert-to pdf --outdir /tmp/check out.pptx
  pdftoppm -png -r 50 /tmp/check/out.pdf /tmp/check/slide
  ```
- [ ] Instruct the agent to inspect PNGs for overflow, overlap, contrast, empty slides, then patch the JSON and rebuild with `--no-bump`
- [ ] Optional `scripts/render-check.js` wrapping both commands, with graceful skip when LibreOffice or poppler is missing
- [ ] Document the fallback when no renderer is available (slide count + lint only)

## Block 3 — Lint and schema validation

Goal: catch content problems before rendering. `fit: "shrink"` only sets `normAutofit`;
PowerPoint recalculates on edit and LibreOffice ignores it, so long text overflows.

- [ ] `build-deck.js --lint` (or `scripts/lint-deck.js`) with warnings for:
  - more than 5 bullets on a slide
  - bullets longer than ~90 characters
  - titles longer than ~60 characters
  - agenda with more than ~10 items
  - callout longer than ~140 characters
  - unknown fields (likely typos)
- [ ] `references/deck.schema.json` (JSON Schema) for deck validation
- [ ] Optional `--strict` that turns lint warnings into a non-zero exit

## Block 4 — More slide types

Goal: cover the flow already recommended in `deck-patterns.md` (risks, decisions,
next steps, closing) and use PptxGenJS native, editable objects.

- [ ] Refactor: build a slide plan first, then render; derive `totalSlides` from the plan
- [ ] `chart`: native `addChart` (bar, line, pie, doughnut) from inline data, editable in PowerPoint
- [ ] `kpi`: 2–4 large numbers with label and optional delta
- [ ] `table`: native `addTable` with header styling from theme
- [ ] `comparison`: two columns (before/after, option A/B)
- [ ] `timeline` / `roadmap`: milestones on a horizontal axis
- [ ] `quote` and `closing`
- [ ] Update `deck-data.md`, `deck-patterns.md`, and `examples/sample-deck.json` with each type

## Block 5 — Content guidance in `SKILL.md`

Goal: better decks from source documents, not only better rendering.

- [ ] Action titles: state the conclusion ("Costs down 12%"), not the topic ("Costs")
- [ ] Source to deck: one message per slide, details in speaker notes
- [ ] Mapping content to slide types (numbers → `kpi`/`chart`, options → `comparison`, dates → `timeline`)
- [ ] Slide count heuristics by talk length
- [ ] Short worked example: source paragraph → deck JSON

## Block 6 — Packaging and repo quality

- [ ] Stop tracking `dist/` in git; generate it in CI or on release
- [ ] Smoke test: build the sample, assert slide count, assert lint is clean
- [ ] GitHub Action running `npm run validate` and the smoke test
- [ ] Skill evals with `skill-creator`: trigger evals (should / should not activate) and output-quality evals
