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
  "gender": "mens | womens | unisex | kids",
  "sport": "football | running | rugby",
  "width": "narrow | standard | wide",
  "minLength": 0,
  "maxLength": 0,
  "minWidth": 0,
  "maxWidth": 0,
  "sizeOffset": 0,
  "price": 0,
  "notes": "string",
  "purchaseUrl": "https://...",
  "imageUrl": "string"
}
```

- `purchaseUrl`: prefer a direct retailer product page (Pro:Direct `…/products/<handle>` for imported entries), else a brand-site search URL (`nike.com/gb/w?q=<model>` etc.). Never a Google search.
- Width bands (mens): narrow (~82–94mm), standard (~89–101mm), wide (~95–108mm). Womens bands sit ~7mm lower; kids bands scale with the size run's mid-length relative to UK 8 (265mm).
- Length ranges: mens typically UK 5–12 (~240–299mm); womens convention is 220–262mm; kids from the junior run (child 10K ≈ 176mm up to junior 5.5 ≈ 244mm). Junior size tables live in `lib/fitting.ts` (`10K`–`13.5K` child keys, continuous 1–5.5 junior).
- `sizeOffset` (mm) shifts the per-boot size recommendation vs. the universal UK/EU/US tables. `0` = true-to-size (default). Negative = runs small (recommend going up — e.g. `-3` for a model that's consistently ~3mm short). Positive = runs large. Leave at `0` unless you have size-chart evidence.
- Bulk imports come from `scripts/import-prodirect.mjs` (Pro:Direct Shopify JSON → deduped models; fit data inherited from curated family entries, unmatched families get standard defaults flagged in `notes`). Re-run it to refresh prices/links. Curated fit knowledge always wins over scraped data.

### sockDatabase.json

Map of sock key → `{ brand, name, thickness, sport, imageUrl }`. Thickness is in mm, added to both length and width before filtering. Key format: `snake_case`. The `sport` field (`"football" | "running" | "rugby"`) controls which socks appear in the list — SockSelectionScreen renders dynamically from this file, grouped into sections by `brand`.

- `thickness` is the *effective fit impact* in mm (compressed, in-shoe), calibrated 2026-06-12 against measured data: cushioned running socks carry 2–3 mm of terry pile uncompressed, socks compress ~50% under load, and a thick sock shifts fit by about half a size (~3 mm). Scale: ultra-thin/racing ≈ 0.6 · standard team/crew ≈ 1.2–1.5 · grip ≈ 1.2 · cushioned ≈ 1.8–2.1 · long rugby/thermal ≈ 2.4–2.7. Manufacturers publish no thickness specs, so these are category calibrations, not per-product measurements.
- `brand` is the manufacturer only (e.g. `"Nike"`, `"Adidas"`, `"Trusox"`). Entries sharing a `brand` render under one section header. Use `"Generic"` for unbranded socks.
- `name` is the product/model (e.g. `"Grip Socks"`, `"Everyday Cushion Crew"`). Shown as the row label.
- `imageUrl` is rendered as a thumbnail when set to a real product photo URL. Set to `""` (empty string) when no real image is available — the screen falls back to a deterministic branded badge (brand initials on a colour derived from the brand name). Legacy `via.placeholder.com` URLs are also skipped client-side and rendered as the badge.

When adding a new sock, just add the entry here with the correct `brand`, `name`, and `sport`. Set `imageUrl: ""` unless you have a real product photo URL. No screen changes needed.
