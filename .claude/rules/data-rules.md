---
paths:
  - bootDatabase.json
  - sockDatabase.json
  - lib/fitting.ts
---

### bootDatabase.json

Array of boot objects. All measurements in mm. Every entry must include:

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

- `purchaseUrl` defaults to a Google search scoped to prodirectsoccer.com
- Width ranges: narrow (~82–94mm), standard (~89–101mm), wide (~95–108mm)
- Length ranges should cover UK 5–12 (~240–299mm)

### sockDatabase.json

Map of sock key → `{ brand, name, thickness, sport, imageUrl }`. Thickness is in mm, added to both length and width before filtering. Key format: `snake_case`. The `sport` field (`"football" | "running" | "rugby"`) controls which socks appear in the list — SockSelectionScreen renders dynamically from this file, grouped into sections by `brand`.

- `brand` is the manufacturer only (e.g. `"Nike"`, `"Adidas"`, `"Trusox"`). Entries sharing a `brand` render under one section header. Use `"Generic"` for unbranded socks.
- `name` is the product/model (e.g. `"Grip Socks"`, `"Everyday Cushion Crew"`). Shown as the row label.
- `imageUrl` is rendered as a thumbnail when set to a real product photo URL. Set to `""` (empty string) when no real image is available — the screen falls back to a deterministic branded badge (brand initials on a colour derived from the brand name). Legacy `via.placeholder.com` URLs are also skipped client-side and rendered as the badge.

When adding a new sock, just add the entry here with the correct `brand`, `name`, and `sport`. Set `imageUrl: ""` unless you have a real product photo URL. No screen changes needed.
