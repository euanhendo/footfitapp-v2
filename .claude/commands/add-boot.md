---
name: add-boot
description: "Add a new boot to bootDatabase.json with schema validation"
argument-hint: '[<brand> <model>]'
---

Add a new boot entry: $ARGUMENTS

## Steps

1. **Collect fields** (ask the user for any missing):
   - brand, model
   - gender: `mens | womens | unisex`
   - sport: `football | running`
   - width: `narrow | standard | wide`
   - minLength, maxLength (mm, UK 5–12 ≈ 240–299)
   - minWidth, maxWidth (mm — narrow ~82–94, standard ~89–101, wide ~95–108)
   - price (number)
   - notes (short fit description)
   - purchaseUrl (default: `https://www.google.com/search?q=<Brand>+<Model>+site:prodirectsoccer.com`)
   - imageUrl (default: `https://via.placeholder.com/400x250/111111/ffffff`)

2. **Validate against [data-rules.md](.claude/rules/data-rules.md)**:
   - Width ranges match the `width` category
   - Length range inside 240–299
   - All required fields present, correct types

3. **Check for duplicates** — grep `bootDatabase.json` for same brand+model. If match, ask before proceeding.

4. **Append** the entry (preserve existing formatting — 2-space indent, trailing comma rules).

5. **Verify**:
   - `npm test`
   - `npx tsc --noEmit`
   - `npm run lint`

6. **Report** the entry added and verify results. Do not commit — user will commit.

## What NOT to do

- Don't invent measurements. If the user doesn't know width/length, ask them to provide it or point to a source.
- Don't add new fields to the schema — if something new is needed, that's a code change, not a data entry.
