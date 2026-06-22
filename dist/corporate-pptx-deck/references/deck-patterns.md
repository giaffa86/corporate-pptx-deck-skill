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

Prefer checking a PDF render:

```bash
libreoffice --headless --convert-to pdf --outdir /tmp/check output.pptx
```
