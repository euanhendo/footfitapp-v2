---
name: data-schema-validation
description: Validates bootDatabase.json and sockDatabase.json entries when edited directly — required fields, mm units, width-band numeric ranges, gender/sport enums. Use when adding or modifying boot or sock data outside the /add-boot and /add-sock commands.
---

# FootFit data schema validation

The `/add-boot` and `/add-sock` slash commands are the preferred entry points. This skill activates when the JSON files are edited directly — to catch drift before it reaches the app.

## bootDatabase.json

Array of boot objects. **All lengths and widths are mm.**

Required fields on every entry:

```json
{
  "brand": "string",
  "model": "string",
  "gender": "mens | womens | unisex",
  "sport": "football | running",
  "width": "narrow | standard | wide",
  "minLength": 0,
  "maxLength": 0,
  "minWidth": 0,
  "maxWidth": 0,
  "price": 0,
  "notes": "string",
  "purchaseUrl": "https://www.google.com/search?q=Brand+Model+site:prodirectsoccer.com",
  "imageUrl": "string"
}
```

### Enums (no free text)

- `gender ∈ {"mens", "womens", "unisex"}`
- `sport ∈ {"football", "running"}`
- `width ∈ {"narrow", "standard", "wide"}`

### Numeric ranges (mm)

- `minLength < maxLength`, `minWidth < maxWidth` (strict).
- Length range should cover some portion of UK 5–12 (`240–299 mm`).
- Width-band sanity:
  - `narrow` → ~82–94 mm
  - `standard` → ~89–101 mm
  - `wide` → ~95–108 mm

Flag entries where the width band label doesn't match the numeric range (e.g. `"width": "narrow"` with `minWidth: 100`).

### Defaults

- `purchaseUrl` defaults to a Google search scoped to `prodirectsoccer.com` when the real URL isn't known.
- `notes` can be empty string but the key must exist.
- `imageUrl` should be a real URL; placeholder `""` is tolerated but avoid shipping it.

## sockDatabase.json

Map of snake_case key → entry:

```json
"nike_grip_crew": {
  "brand": "Nike",
  "thickness": 3,
  "sport": "football"
}
```

- Key format: `snake_case`. No spaces, no camelCase.
- `thickness` in **mm** (typically 1–5).
- `sport` must match a valid sport (`football` | `running`) so `getSocksForSport` picks it up.

Adding a sock is a data-only change. **No screen edits needed** — `SockSelectionScreen` renders dynamically from `getSocksForSport(sockDatabase, sport)`.

## Red flags while editing

- Length or width in cm or inches (values like `27.5` for length are a red flag — mm values should be ~240+).
- `width: "narrow"` with `minWidth > 94`, or `width: "wide"` with `maxWidth < 95`.
- `sport` or `gender` spelled inconsistently (e.g. `"Football"`, `"Men"`).
- Sock key in camelCase or with spaces.
- `minLength >= maxLength`.
- Missing required field — don't silently omit.

If any of these appear, fix before saving and prefer re-running `/add-boot` or `/add-sock` so the validation is reusable.