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

Map of sock key → `{ brand, thickness }`. Thickness is in mm, added to both length and width before filtering. Key format: `snake_case` matching the Picker value in SockSelectionScreen.

When adding a new sock, also add a `<Picker.Item>` in `SockSelectionScreen.tsx` under the correct sport section.
