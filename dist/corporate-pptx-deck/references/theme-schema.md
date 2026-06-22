# Theme Schema

Theme resolution order:

1. `theme.local.json` in current project
2. `~/.codex/corporate-pptx-deck/theme.json`
3. `assets/default-theme.json`

Fields:

```json
{
  "companyName": "",
  "author": "",
  "logo": "",
  "footer": "",
  "confidentiality": "",
  "backgroundImage": "",
  "backgroundOpacity": 0.08,
  "watermark": "",
  "watermarkColor": "111827",
  "watermarkTransparency": 88,
  "pageNumberFormat": "",
  "pageNumberColor": "9CA3AF",
  "colors": {
    "ink": "111827",
    "muted": "6B7280",
    "softBg": "F9FAFB",
    "whiteBg": "FFFFFF",
    "darkBg": "111827",
    "line": "E5E7EB",
    "accent": "2563EB",
    "accent2": "10B981",
    "danger": "B91C1C",
    "amber": "D97706",
    "white": "FFFFFF"
  },
  "fonts": {
    "head": "Aptos Display",
    "body": "Aptos"
  }
}
```

Background colors (where each is used):

- `softBg` — cover slide background.
- `whiteBg` — content slide background (agenda, topic, takeaways).
- `darkBg` — section divider slide background.
- `ink` is the text color; `white` is a foreground fill (frames, text on dark).

Rules:

- `logo` can be empty. Empty means no logo.
- `footer` and `confidentiality` are optional.
- `author` is the default author shown on the cover; configure it once via `init-theme.js`. A deck can override it per-document with its own `author` field (deck wins, theme is the fallback). Keep personal names out of the repo — set them in the local theme, not in committed files.
- `backgroundImage` is optional. Relative paths are resolved from the command working directory.
- `backgroundOpacity` is `0` to `1`; lower values make the image fainter.
- `watermark` is optional deck-wide rotated text.
- `watermarkColor` is a hex color without `#`.
- `watermarkTransparency` is `0` to `100`; higher values make the text fainter.
- `pageNumberFormat` is optional footer numbering. Use `{{page}}` and `{{total}}`, for example `#{{page}}`, `Pag. {{page}}`, or `{{page}}/{{total}}`.
- `pageNumberColor` is a hex color without `#`.
- Hex colors omit `#` for PptxGenJS compatibility.
- Do not store private logos in a public repo. Use local absolute paths or `theme.local.json`.
- Missing fields fall back to `assets/default-theme.json`, so older theme files keep working.

Deck-level meta (`examples/sample-deck.json`):

- `version` — shown on the cover as `vX`. If omitted, it auto-increments per output file via a `.deck-versions.json` ledger written next to the `.pptx`.
- `author` — overrides `theme.author` for that deck only.
