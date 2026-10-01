# Deck Patterns

## Recommended Flow

1. Cover
2. Agenda
3. Section divider
4. Topic/speaker/workstream slides
5. Risks or decisions
6. Takeaways
7. Next steps
8. Closing

## Slide Types

- `section`: dark/full section divider.
- `topic`: title, subtitle/speaker, bullets, callout, optional visual.
- `agenda`: generated from deck `agenda`.
- `takeaways`: generated from deck `takeaways`.

## Content Density

- Cover: title, subtitle, date, version (`vX`), author, optional image.
- Topic: 3 bullets ideal, 5 max.
- Callout: one question or decision.
- Notes: summarize delivery context.

For the JSON fields that create these slides, see `deck-data.md`.

## Verification

Render every slide to PNG and inspect it:

```bash
node corporate-pptx-deck/scripts/render-check.js output.pptx /tmp/check
```

Under the hood this runs:

```bash
soffice --headless --convert-to pdf --outdir /tmp/check output.pptx
pdftoppm -png -r 50 /tmp/check/output.pdf /tmp/check/slide
```

Inspect every PNG and look for:

- text overflowing its box or cut off at the bottom (`fit: "shrink"` does not
  shrink text at render time, so long text really overflows)
- overlapping elements (title over speaker line, callout over bullets, image over text)
- low contrast (text on background image, light text on light background)
- empty or near-empty slides, missing images, wrong slide order
- footer, page number, and watermark readable but not dominant

Fix issues in the deck JSON and rebuild with `--no-bump`. Without LibreOffice or
poppler, the script skips rendering; rely on the slide count and content rules.
