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
- [x] **Block 2 — Visual verification in the workflow**
  - `scripts/render-check.js`: PPTX → PDF → one PNG per slide, isolated LibreOffice profile, graceful skip without LibreOffice/poppler
  - `SKILL.md` visual check loop: inspect PNGs, fix JSON, rebuild with `--no-bump`, re-render
  - Inspection checklist (overflow, overlap, contrast, empty slides) and no-renderer fallback
  - `npm run check:sample`
- [x] **Block 3 — Lint and schema validation**
  - `references/deck.schema.json` (JSON Schema 2020-12) for every deck field
  - `scripts/lint-deck.js`: schema check with "did you mean" hints plus content limits (bullets, text lengths, agenda, takeaways, font size, empty slides)
  - Lint runs on every `build-deck.js` build; `--strict` blocks writing the PPTX
  - Sample deck linted in `npm run validate`

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
