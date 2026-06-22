# Deck Data

Deck files are JSON inputs for `scripts/build-deck.js`. They describe content,
metadata, images, and speaker notes. The generator turns them into an editable
PowerPoint file; it does not require screenshots or prebuilt slides.

The deck JSON is normally authored and maintained by the assistant from the
user's natural-language request. The user states intent ("generate a deck from
this document", "bump the version", "set the author"); the assistant writes or
edits the deck file and rebuilds. The fields below document what the assistant
controls, not a format the user is expected to hand-write.

Run:

```bash
node corporate-pptx-deck/scripts/build-deck.js deck.json output.pptx
```

`build-deck.js` is non-interactive. It does not prompt, open menus, or modify the
deck JSON. It may write `.deck-versions.json` next to the output PPTX when
auto-versioning is enabled. All deck content comes from the JSON file plus the
resolved theme.

The input JSON must already exist. `build-deck.js` does not convert `.md`,
`.dokuwiki`, or an existing `.pptx` directly. In agent workflows, first ask the
assistant to create or update the deck JSON from source material, then run
`build-deck.js`.

Recommended sidecar convention:

```text
presentations/quarterly-review.json
presentations/quarterly-review.pptx
```

The `.json` is the source of truth for future rebuilds. The `.pptx` is generated
output.

Use `init-theme.js` only for interactive local branding setup. Use
`build-deck.js` for repeatable deck rendering.

## Where To Run It

Run `build-deck.js` from the project root that owns the deck, local theme, and
image paths. The current working directory matters:

- input deck JSON paths are resolved from the current working directory
- relative image paths in the deck JSON are resolved from the current working directory
- `theme.local.json` is searched in the current working directory
- output PPTX paths are resolved from the current working directory
- `.deck-versions.json`, when auto-versioning is enabled, is written next to the
  output PPTX

Project example:

```bash
cd /path/to/project
node /path/to/corporate-pptx-deck/scripts/build-deck.js \
  presentations/quarterly-review.json \
  presentations/quarterly-review.pptx
```

## Minimal Example

```json
{
  "title": "Project Update",
  "subtitle": "Quarterly technical and business recap",
  "date": "2026-06-22",
  "version": "1.0.0",
  "autoIncrement": false,
  "author": "Jane Doe",
  "backgroundImage": "",
  "backgroundOpacity": 0.08,
  "watermark": "",
  "pageNumberFormat": "{{page}}/{{total}}",
  "agenda": [
    { "time": "1", "speaker": "Context", "topic": "Why this work matters" }
  ],
  "sections": [
    {
      "type": "section",
      "title": "Executive Summary",
      "subtitle": "From activity to decisions"
    },
    {
      "title": "Current State",
      "eyebrow": "Progress",
      "speaker": "Workstream A",
      "bullets": [
        "Milestone completed",
        "Operational risk reduced",
        "Next dependency identified"
      ],
      "callout": "Decision needed: approve next phase.",
      "notes": "Use this slide to frame outcome, not only activity."
    }
  ],
  "takeaways": [
    "Outcome matters more than output.",
    "Make decisions explicit."
  ]
}
```

## Top-Level Fields

- `title`: cover title and PPTX document title. Defaults to `Corporate Deck`.
- `subtitle`: cover subtitle and PPTX subject.
- `date`: cover metadata text.
- `version`: cover metadata and PPTX revision. If it does not start with `v`,
  the cover renders it as `v{version}`.
- `autoIncrement`: optional boolean. When `true`, the version is bumped on every
  build via the local ledger; `version` (if present) seeds the first build.
- `author`: cover metadata and PPTX author. If omitted, `theme.author` is used
  when present; the company name is only used for PPTX metadata fallback.
- `lang`: PPTX language. Defaults to `it-IT`.
- `label`: small cover label. Defaults to `DOCUMENTO`.
- `coverImage`: optional image path for the cover visual.
- `backgroundImage`: optional deck-wide full-slide background image.
- `backgroundOpacity`: optional `0` to `1` background image opacity. Defaults
  to theme value, usually `0.08`.
- `watermark`: optional deck-wide large rotated watermark text.
- `watermarkColor`: optional hex text color without `#`.
- `watermarkTransparency`: optional `0` to `100`; higher values make the
  watermark fainter.
- `pageNumberFormat`: optional footer page number format. Use `{{page}}` and
  `{{total}}`, for example `#{{page}}`, `Pag. {{page}}`, or
  `{{page}}/{{total}}`.
- `pageNumberColor`: optional page number color without `#`.
- `notes`: optional speaker notes on the cover slide.
- `agendaEyebrow`: small label above the agenda title. Defaults to `Agenda`.
- `agenda`: optional array. If empty or omitted, no agenda slide is generated.
- `agendaBackgroundImage`, `agendaBackgroundOpacity`, `agendaWatermark`,
  `agendaWatermarkColor`, `agendaWatermarkTransparency`,
  `agendaPageNumberFormat`: optional agenda-slide visual and numbering overrides.
- `sections`: main slide sequence. Each item becomes either a section divider or
  a topic slide.
- `takeaways`: optional bullet array. If present, a final takeaways slide is
  generated.
- `takeawayTitle`: optional title for the generated takeaways slide. Defaults to
  `Takeaways`.
- `takeawayCallout`: optional callout on the generated takeaways slide.
- `takeawayImage`: optional image path for the generated takeaways slide.

## Version Behavior

Three modes, controlled by `version` and `autoIncrement`:

| `version` | `autoIncrement` | Result |
|-----------|-----------------|--------|
| set       | absent / `false`| **Frozen** — same value on every build, ledger untouched |
| set       | `true`          | **Auto** — first build uses `version` as the seed, then bumps each rebuild |
| absent    | `true` or absent| **Auto** — starts at `0.0.1`, bumps each rebuild |

Frozen, for a reproducible deck:

```json
{ "version": "1.0.0" }
```

Auto-increment, explicit (preferred), optionally seeded:

```json
{ "version": "1.0.0", "autoIncrement": true }
```

In auto mode the generator keeps a local `.deck-versions.json` file next to the
output PPTX and bumps the last numeric part per output filename:

- no previous value -> seed (`version`) or `0.0.1`
- `0.0.1` -> `0.0.2`
- `draft-9` -> `draft-10`

`.deck-versions.json` is local generation state and should not be committed.

### How the deck file binds to a specific PPTX

The deck JSON does not know which `.pptx` it belongs to. The binding is the
output filename passed on the command line, and the ledger is keyed by that
filename (not by the deck JSON):

```bash
node scripts/build-deck.js  deck.json  quarterly-review.pptx
#                            ^ content   ^ ledger key
```

Consequences:

- Same deck JSON -> two different output names = two independent counters.
- Two different deck JSON files -> same output name = one shared counter.
- With an explicit `version` in the deck, the ledger is ignored for that file.

### Choosing the version at regeneration time

- Reproducible / frozen: set `"version": "1.0.0"` in the deck. It stays fixed on
  every rebuild.
- Bump: edit the explicit value (`0.0.2` -> `0.0.3`).
- Resume auto-increment: remove the `version` field; the next build continues
  from the ledger value.

## Agenda Items

Agenda items are rendered in two columns:

```json
{
  "time": "1",
  "speaker": "Context",
  "topic": "Why this work matters"
}
```

- `time`: short marker such as `1`, `09:30`, or `15 min`.
- `speaker`: shown as the bold first line. If missing, `title` is used.
- `title`: fallback when `speaker` is empty.
- `topic`: second line under the speaker/title.

## Section Divider Slides

A section divider is any `sections` item with `"type": "section"`:

```json
{
  "type": "section",
  "title": "Executive Summary",
  "subtitle": "From activity to decisions",
  "image": "assets/summary.png",
  "backgroundImage": "assets/background.png",
  "backgroundOpacity": 0.12,
  "watermark": "DRAFT",
  "pageNumberFormat": "#{{page}}",
  "notes": "Pause here and reset the discussion."
}
```

- `title`: required for useful output.
- `subtitle`: optional supporting line.
- `image`: optional right-side visual.
- `backgroundImage`, `backgroundOpacity`: optional overrides for this slide.
- `watermark`, `watermarkColor`, `watermarkTransparency`: optional overrides for
  this slide. Set `watermark` to an empty string to suppress a deck-wide
  watermark on this slide.
- `pageNumberFormat`: optional page-number override for this slide.
- `notes`: optional speaker notes.

## Topic Slides

Any `sections` item without `"type": "section"` is rendered as a topic slide:

```json
{
  "title": "Current State",
  "eyebrow": "Progress",
  "speaker": "Workstream A",
  "bullets": [
    "Milestone completed",
    "Operational risk reduced",
    "Next dependency identified"
  ],
  "callout": "Decision needed: approve next phase.",
  "image": "assets/current-state.png",
  "backgroundImage": "assets/background.png",
  "backgroundOpacity": 0.10,
  "watermark": "INTERNAL",
  "pageNumberFormat": "Pag. {{page}}",
  "accent": "2563EB",
  "fontSize": 14.4,
  "notes": "Keep focus on outcomes."
}
```

- `title`: slide title.
- `eyebrow`: optional small uppercase label above the title.
- `speaker`: optional line under the title; also used in the footer when present.
- `section`: optional footer text when `speaker` is absent.
- `bullets`: array of bullet strings. Keep to 3 ideal, 5 max.
- `callout`: optional highlighted decision/question block.
- `image`: optional right-side visual.
- `backgroundImage`, `backgroundOpacity`: optional overrides for this slide.
- `watermark`, `watermarkColor`, `watermarkTransparency`: optional overrides for
  this slide. Set `watermark` to an empty string to suppress a deck-wide
  watermark on this slide.
- `pageNumberFormat`: optional page-number override for this slide.
- `accent`: optional hex color for callout/image frame. Omit `#`.
- `fontSize`: optional bullet font size.
- `notes`: optional speaker notes.

## Image Paths

Image paths can be absolute or relative. Relative paths are resolved from the
current working directory where the command is run, not from the JSON file
location.

Supported by PptxGenJS and this helper:

- logo/theme images: configured in `theme.local.json` or user theme
- slide images: `coverImage`, section/topic `image`, `takeawayImage`
- background images: `backgroundImage`, `agendaBackgroundImage`, section/topic
  `backgroundImage`

If an image path is empty or unreadable, the slide is generated without that
image.

## Backgrounds, Watermarks, And Page Numbers

Backgrounds, watermarks, and page numbers resolve in this order:

1. slide-level field
2. deck-level field
3. theme field

`backgroundImage` fills the whole slide with PptxGenJS `cover` sizing.
`backgroundOpacity` is easier to reason about than PowerPoint transparency:

- `0` means invisible
- `0.08` is a subtle texture
- `0.20` is clearly visible but still behind content
- `1` is fully opaque

Watermarks are large rotated text drawn above slide content with high
transparency. Use `watermarkTransparency`:

- `0` is opaque
- `88` is subtle
- `100` is invisible

Page numbering uses `pageNumberFormat`. Supported tokens:

- `{{page}}`: current slide number
- `{{total}}`: total generated slide count

Examples:

```json
{ "pageNumberFormat": "#{{page}}" }
{ "pageNumberFormat": "Pag. {{page}}" }
{ "pageNumberFormat": "{{page}}/{{total}}" }
```

PowerPoint image transparency support depends on the editor. For maximum
compatibility, use a PNG that already has alpha when precise semi-transparency
matters.

## Speaker Notes

Use `notes` on the cover, section divider, or topic slide. Notes are written as
PowerPoint speaker notes and do not appear on the slide canvas.

## Practical Rules

- Keep each slide to one main idea.
- Prefer 3 bullets; avoid more than 5.
- Put decisions, risks, or next steps in `callout`.
- Use explicit `version` for decks you want to reproduce exactly.
- Use subtle `backgroundOpacity` values; `0.08` to `0.16` is usually enough.
- Keep watermarks short, for example `DRAFT`, `INTERNAL`, or `CONFIDENTIAL`.
- Keep private images and local brand data out of the repository.
