---
name: add-sock
description: "Add a new sock to sockDatabase.json with schema validation"
argument-hint: '[<brand name>]'
---

Add a new sock entry: $ARGUMENTS

## Steps

1. **Collect fields** (ask for any missing):
   - key: `snake_case` identifier (e.g. `nike_grip`)
   - brand: manufacturer only (e.g. `Nike`, `Adidas`, `Trusox`, or `Generic` for unbranded). Groups the sock under a section header in SockSelectionScreen.
   - name: product/model (e.g. `Grip Socks`, `Everyday Cushion Crew`). Shown as the row label.
   - thickness: mm (typical range 0.2–0.8)
   - sport: `football | running | rugby`
   - imageUrl: thumbnail URL, or `""` for the fallback branded badge

2. **Check for duplicate key** in `sockDatabase.json`. If match, ask before proceeding.

3. **Append** the entry, matching the existing column-aligned formatting.

4. **Verify**:
   - `npm test`
   - `npx tsc --noEmit`
   - `npm run lint`

5. **Report** the entry added and verify results.

## Note

SockSelectionScreen renders dynamically from this file — no screen changes needed. See CLAUDE.md "Mistakes to Avoid".
