// Importer: Pro:Direct Shopify catalogue -> bootDatabase.json entries.
// Usage: node scripts/import-prodirect.mjs [--cutoff 2025-06-01] [--dry]
// Expects raw pages in /tmp/<collection-handle>-p<N>.json (see COLLECTIONS)
// (fetched from prodirectsport.com/collections/<handle>/products.json).
// Re-runnable: collections with no /tmp pages are skipped; existing entries
// get live link/image/price upgraded in place.
//
// What the scrape CANNOT provide is FootFit's fit knowledge. New entries
// inherit width class / width band / sizeOffset / notes from a curated
// family match in the existing database; unmatched families get standard
// defaults and a notes flag so they are auditable later.

import fs from 'fs';

const CUTOFF = process.argv.includes('--cutoff')
  ? process.argv[process.argv.indexOf('--cutoff') + 1]
  : '2025-06-01';
const DRY = process.argv.includes('--dry');

// ---- size table: mirrors lib/fitting.ts UK_SIZE_TO_LENGTH_MM + junior/child
// extension (4 mm half-steps below adult 5) + extrapolation above 12.
const UK_MM = {
  '10K': 176, '10.5K': 180, '11K': 184, '11.5K': 188,
  '12K': 192, '12.5K': 196, '13K': 200, '13.5K': 204,
  '1': 208, '1.5': 212, '2': 216, '2.5': 220,
  '3': 224, '3.5': 228, '4': 232, '4.5': 236,
  '5': 240, '5.5': 244, '6': 248, '6.5': 252,
  '7': 257, '7.5': 261, '8': 265, '8.5': 269,
  '9': 274, '9.5': 278, '10': 282, '10.5': 286,
  '11': 291, '11.5': 295, '12': 299,
  '12.5': 303, '13': 308, '13.5': 312, '14': 316,
};

function sizeToMm(raw, kidsProduct) {
  let s = String(raw).trim().toUpperCase().replace(/\s/g, '');
  const childSuffix = /(K|C)$/.test(s);
  s = s.replace(/(K|C|Y)$/, '');
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (kidsProduct) {
    if (n >= 10 && n <= 13.5) return UK_MM[`${s}K`] ?? null;
    // Below-10 child/infant sizes ("6K", "8.5" on a toddler shoe) sit under
    // the table floor — mapping them through the adult run would poison
    // lengths, so they contribute nothing.
    if (childSuffix) return null;
    if (n >= 7) return null;
  }
  return UK_MM[s] ?? null;
}

// ---- load raw pages
function loadCollection(handle) {
  const out = [];
  for (let p = 1; p <= 40; p++) {
    const f = `/tmp/${handle}-p${p}.json`;
    if (!fs.existsSync(f)) break;
    try {
      out.push(...JSON.parse(fs.readFileSync(f, 'utf8')).products);
    } catch {
      break;
    }
  }
  return out;
}

const COLLECTIONS = [
  ['football-mens-boots', 'mens', 'football'],
  ['football-womens-boots', 'womens', 'football'],
  ['football-kids-boots', 'kids', 'football'],
  ['rugby-adults-boots', 'mens', 'rugby'],
  ['rugby-kids-boots', 'kids', 'rugby'],
  ['running-mens-shoes', 'mens', 'running'],
  ['running-womens-shoes', 'womens', 'running'],
  ['running-kids-shoes', 'kids', 'running'],
];

// The rugby collection is ~90% cross-listed football boots (already in the DB
// under football). Pro:Direct tags genuinely rugby-specific titles with the
// word "Rugby" ("adidas Kakari Elite SG Rugby") — only those, plus rugby-only
// brands, become new rugby entries.
const RUGBY_ONLY_BRANDS = new Set(['canterbury', 'gilbert', 'oxen', 'tru']);

// ---- filters
const NOT_FOOTWEAR =
  /glove|shin|sock|ball\b|bag|shirt|short|jacket|pant|tee\b|top\b|cap\b|bottle|pump|lace|insole|stud|guard|tape|kit\b|backpack|holdall|sandal|slide|mule/i;

const BRAND_NAME = {
  adidas: 'Adidas',
  nike: 'Nike',
  puma: 'Puma',
  'new balance': 'New Balance',
  mizuno: 'Mizuno',
  'under armour': 'Under Armour',
  diadora: 'Diadora',
  umbro: 'Umbro',
  skechers: 'Skechers',
  lotto: 'Lotto',
  concave: 'Concave',
  "pantofola d'oro": "Pantofola d'Oro",
  joma: 'Joma',
  kappa: 'Kappa',
  asics: 'ASICS',
  'adidas originals': 'Adidas',
};

// Trailing tokens that are surface/edition noise, not model identity.
const SURF_TOKENS = new Set([
  'fg', 'sg', 'ag', 'tf', 'ic', 'in', 'mg', 'hg',
  'fg/mg', 'fg/ag', 'sg/fg', 'ag/fg', 'fg/sg',
  'sg-pro', 'ag-pro', 'anti-clog', 'astro', 'turf', 'indoor', 'court',
]);
const EDITION_TOKENS = new Set(['se']);
const EDITION_PHRASES = [/\s+x\s+[A-Z][\w.' ]*$/, /\s+(?:Limited|Player|Special)\s+Edition$/i];
const SURFACE_PREF = ['FG', 'FG/MG', 'FG/AG', 'MG', '', 'SG-PRO', 'SG', 'SG/FG', 'AG-PRO', 'AG', 'HG', 'TF', 'IC', 'IN'];

function splitSurface(model) {
  let m = model.trim();
  let surface = '';
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of EDITION_PHRASES) {
      const hit = m.match(re);
      if (hit) {
        m = m.slice(0, hit.index).trim();
        changed = true;
      }
    }
    const tokens = m.split(/\s+/);
    const last = tokens.at(-1)?.toLowerCase() ?? '';
    if (SURF_TOKENS.has(last)) {
      if (!surface || last === 'anti-clog') surface = surface ? `${last.toUpperCase()} ${surface}` : last.toUpperCase();
      tokens.pop();
      m = tokens.join(' ');
      changed = true;
    } else if (EDITION_TOKENS.has(last)) {
      tokens.pop();
      m = tokens.join(' ');
      changed = true;
    }
  }
  return { model: m.trim(), surface: surface.replace(/^ANTI-CLOG\s*/, '').trim() || surface };
}

function stripKidsNoise(m) {
  m = m.replace(/\b(?:little kids|older kids|younger kids|juniors?|kids|infants?|toddlers?|baby|little)\b/gi, ' ');
  m = m.replace(/\s{2,}/g, ' ').trim();
  return m.replace(/\s+Boots?$/i, '').trim();
}

function cleanModel(title, vendor, sport, gender) {
  let m = title.trim();
  const v = vendor.trim();
  if (m.toLowerCase().startsWith(v.toLowerCase())) m = m.slice(v.length).trim();
  m = m.replace(/\s+-\s+.*$/, ''); // trailing " - Colour/Colour" descriptions
  m = m.replace(/\s*\((?:GS|PS|TD)\)\s*$/i, ''); // running-feed grade-school markers
  m = m.replace(/^(mens|men's|womens|women's)\s+/i, '');
  m = m.replace(/\s+(womens|women's)$/i, '');
  if (gender === 'kids') m = stripKidsNoise(m);
  // Pro:Direct appends the category to rugby titles ("Kakari Elite SG Rugby")
  // — strip it so the surface token becomes trailing and splitSurface sees it.
  if (sport === 'rugby') m = m.replace(/(\s+(?:rugby|boots?))+\s*$/i, '');
  // "Air Zoom" is colourway noise on football boots ("Air Zoom Mercurial");
  // on running shoes Zoom is model identity ("Zoom Fly") — keep it there.
  if (sport !== 'running') m = m.replace(/\b(?:air\s+)?zoom\s+/gi, '');
  m = m.replace(/\s{2,}/g, ' ').trim();
  return m.replace(/\s+Boots?$/i, '').trim();
}

// Match key: lowercase, dots out, Roman numerals (non-initial tokens) to
// arabic, so "Mercurial Vapor XVI Elite" groups with "Mercurial Vapor 16
// Elite" and matches curated names. adidas "X Crazyfast" keeps its X (initial).
const ROMAN = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
  xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17,
};
function normKey(model) {
  const tokens = model.toLowerCase().replace(/\./g, ' ').split(/\s+/).filter(Boolean);
  return tokens
    .map((t, i) => (i > 0 && ROMAN[t] !== undefined ? String(ROMAN[t]) : t))
    .join(' ');
}

// ---- fit inheritance from the curated database
const curated = JSON.parse(fs.readFileSync('bootDatabase.json', 'utf8'));

// Earlier imports kept feed noise ("Boots Kids", "Little Kids") in a few kids
// model names; clean them with the same rules so feed groups match them as
// upgrades instead of duplicating under the clean name.
for (const b of curated) {
  if (b.gender === 'kids') b.model = stripKidsNoise(b.model);
}

// Entries whose names collapse to the same model after cleaning are the same
// boot — keep one (prefer the one with a product image).
{
  const byKey = new Map();
  for (const b of curated) {
    const k = `${b.sport}|${b.gender}|${b.brand.toLowerCase()}|${normKey(b.model)}`;
    const prev = byKey.get(k);
    if (!prev || (!prev.imageUrl && b.imageUrl)) byKey.set(k, b);
  }
  if (byKey.size !== curated.length) {
    console.log('curated dupes removed:', curated.length - byKey.size);
    curated.length = 0;
    curated.push(...byKey.values());
  }
}

// family token -> curated model that carries the family's fit character.
// X Crazyfast / F50 are the Speedportal lineage (same speed last).
const FAMILY_TOKENS = {
  football: [
    'mercurial superfly', 'mercurial vapor', 'mercurial', 'phantom', 'tiempo',
    'predator', 'copa', 'f50', 'x speedportal', 'x crazyfast',
    'future', 'king', 'ultra',
    'morelia', 'furon', 'tekela', 'magnetico', 'brasil', 'b-elite',
  ],
  rugby: [
    'kakari', 'malice', 'stampede', 'speed infinite', 'sidestep',
    'tiempo rugby', 'phoenix',
  ],
  running: [
    'pegasus', 'vomero', 'ultraboost', 'ghost', 'adrenaline',
    'gel-nimbus', 'gel-kayano', 'clifton', 'bondi', '1080',
    'speedcross', 'ride',
  ],
};
const FAMILY_ALIAS = { 'x crazyfast': 'x speedportal', f50: 'x speedportal' };

function familyOf(model, sport) {
  const lower = normKey(model);
  const tokens = lower.split(' ');
  for (const tok of FAMILY_TOKENS[sport] ?? []) {
    // single words match whole tokens ("ride" must not match "stride");
    // multi-word/numeric families match as substrings ("1080" in "1080v13").
    const hit =
      tok.includes(' ') || /\d/.test(tok) || tok.includes('-')
        ? lower.includes(tok)
        : tokens.includes(tok);
    if (hit) return FAMILY_ALIAS[tok] ?? tok;
  }
  return null;
}

function curatedTemplate(family, gender, sport) {
  if (!family) return null;
  const candidates = curated.filter(
    (b) => b.sport === sport && familyOf(b.model, sport) === family,
  );
  if (candidates.length === 0) return null;
  return candidates.find((b) => b.gender === gender) ?? candidates[0];
}

// Adult width bands per class (data-rules); kids bands scale with the size
// run; womens lasts run ~7 mm narrower (matches the curated womens entries).
const WIDTH_BANDS = { narrow: [82, 94], standard: [89, 101], wide: [95, 108] };
const ADULT_MID_MM = 265;
const WOMENS_BAND_SHIFT_MM = 7;

function widthBand(widthClass, minLength, maxLength, gender) {
  const [lo, hi] = WIDTH_BANDS[widthClass];
  if (gender === 'womens') return [lo - WOMENS_BAND_SHIFT_MM, hi - WOMENS_BAND_SHIFT_MM];
  if (gender !== 'kids') return [lo, hi];
  const factor = (minLength + maxLength) / 2 / ADULT_MID_MM;
  return [Math.round(lo * factor), Math.round(hi * factor)];
}

// Womens size labels on the feed are ambiguous (UK womens vs small mens), so
// womens entries use the curated convention: UK womens run ≈ 220–262 mm.
const WOMENS_LENGTH_RANGE = [220, 262];

// ---- group colourways into models
const groups = new Map();
const counts = {};

for (const [handle, gender, sport] of COLLECTIONS) {
  const products = loadCollection(handle);
  counts[`${sport}-${gender}`] = { colourways: products.length };
  for (const p of products) {
    if (NOT_FOOTWEAR.test(p.title)) continue;
    if (gender === 'kids' && /\(TD\)|toddler|infant|baby|crib/i.test(p.title)) continue;
    if (!p.variants?.length || !p.vendor) continue;
    const brand = BRAND_NAME[p.vendor.toLowerCase()] ?? p.vendor;
    const { model, surface } = splitSurface(cleanModel(p.title, p.vendor, sport, gender));
    if (!model) continue;
    const key = `${sport}|${gender}|${brand.toLowerCase()}|${normKey(model)}`;
    if (!groups.has(key)) {
      groups.set(key, { sport, gender, brand, model, products: [], rugbyTagged: false });
    }
    const g = groups.get(key);
    if (sport === 'rugby' && /\brugby\b/i.test(p.title)) g.rugbyTagged = true;
    g.products.push({ ...p, surface });
  }
}

// ---- reduce each group to one entry
const newEntries = [];
const upgrades = [];
let skippedOld = 0;
let skippedNoSizes = 0;
let skippedCrossover = 0;
let skippedSoldOut = 0;

// Availability is the only honest age signal: published_at lies (retro
// re-releases get fresh dates — a 2016 Messi 16+ shows published 2026).
const stockByKey = new Map(); // gender|brand|model -> any variant available
const stockByModel = new Map(); // brand|model -> any variant available, any gender
for (const g of groups.values()) {
  const inStock = g.products.some((p) => p.variants.some((v) => v.available));
  const k = `${g.gender}|${g.brand.toLowerCase()}|${normKey(g.model)}`;
  const mk = `${g.brand.toLowerCase()}|${normKey(g.model)}`;
  stockByKey.set(k, (stockByKey.get(k) ?? false) || inStock);
  stockByModel.set(mk, (stockByModel.get(mk) ?? false) || inStock);
}

const curatedByKey = new Map(
  curated.map((b) => [`${b.gender}|${b.brand.toLowerCase()}|${normKey(b.model)}`, b]),
);

for (const group of groups.values()) {
  const latest = group.products
    .map((p) => p.published_at ?? '')
    .sort()
    .at(-1);

  const canonical = [...group.products].sort((a, b) => {
    const sa = SURFACE_PREF.indexOf(a.surface);
    const sb = SURFACE_PREF.indexOf(b.surface);
    if (sa !== sb) return (sa < 0 ? 99 : sa) - (sb < 0 ? 99 : sb);
    return (b.published_at ?? '').localeCompare(a.published_at ?? '');
  })[0];

  // Which surface categories this model is sold in, normalised to the five
  // standard football categories. MG (multi-ground) plays on firm + artificial.
  // Running shoes have no surface category — they carry no surfaces field.
  const surfaceSet = new Set();
  if (group.sport !== 'running') {
    for (const p of group.products) {
      for (const raw of (p.surface || 'FG').split('/')) {
        const tok = raw.replace(/-PRO|ANTI-CLOG/g, '').trim();
        if (tok === 'FG' || tok === 'HG') surfaceSet.add('FG');
        else if (tok === 'SG') surfaceSet.add('SG');
        else if (tok === 'AG') surfaceSet.add('AG');
        else if (tok === 'TF' || tok === 'ASTRO' || tok === 'TURF') surfaceSet.add('TF');
        else if (tok === 'IC' || tok === 'IN' || tok === 'INDOOR' || tok === 'COURT') surfaceSet.add('IC');
        else surfaceSet.add('FG');
      }
    }
  }
  const surfaces = ['FG', 'SG', 'AG', 'TF', 'IC'].filter((s) => surfaceSet.has(s));

  // Price from the canonical (preferred-surface) product only — group-wide
  // min would let a cheap turf/indoor sibling understate the boot's price.
  const prices = canonical.variants
    .map((v) => Number(v.price))
    .filter((n) => Number.isFinite(n) && n > 0);
  const price = Math.round(Math.min(...(prices.length ? prices : [0])));

  const purchaseUrl = `https://www.prodirectsport.com/products/${canonical.handle}`;
  const imageUrl = canonical.images?.[0]?.src ?? '';

  // already in the DB? Same sport: upgrade live fields, keep curated fit data.
  // Different sport (a football boot cross-listed in the rugby feed): skip —
  // the model is already represented; don't duplicate or clobber its data.
  const curatedKey = `${group.gender}|${group.brand.toLowerCase()}|${normKey(group.model)}`;
  const existing = curatedByKey.get(curatedKey);
  if (existing) {
    if (existing.sport !== group.sport) {
      skippedCrossover++;
      continue;
    }
    existing.purchaseUrl = purchaseUrl;
    if (imageUrl) existing.imageUrl = imageUrl;
    if (price > 0) existing.price = price;
    if (surfaces.length > 0) existing.surfaces = surfaces;
    upgrades.push(`${group.brand} ${group.model} (${group.gender})`);
    continue;
  }

  // Rugby gate: only rugby-tagged titles or rugby-only brands enter as rugby —
  // everything else in that feed is a cross-listed football boot.
  if (
    group.sport === 'rugby' &&
    !group.rugbyTagged &&
    !RUGBY_ONLY_BRANDS.has(group.brand.toLowerCase())
  ) {
    skippedCrossover++;
    continue;
  }

  // Only recent models become NEW entries (upgrades above run regardless, so
  // older-but-still-listed boots keep live images/links).
  if (!latest || latest < CUTOFF) {
    skippedOld++;
    continue;
  }

  // Fully sold out across every colourway and size = not buyable = no entry.
  if (!group.products.some((pr) => pr.variants.some((v) => v.available))) {
    skippedSoldOut++;
    continue;
  }

  const kidsProduct = group.gender === 'kids';
  let minLength;
  let maxLength;
  if (group.gender === 'womens') {
    [minLength, maxLength] = WOMENS_LENGTH_RANGE;
  } else {
    const mms = [];
    for (const p of group.products) {
      for (const v of p.variants) {
        const mm = sizeToMm(v.title, kidsProduct);
        if (mm) mms.push(mm);
      }
    }
    if (mms.length === 0) {
      skippedNoSizes++;
      continue;
    }
    minLength = Math.min(...mms);
    maxLength = Math.max(...mms);
  }

  const family = familyOf(group.model, group.sport);
  const template = curatedTemplate(family, group.gender, group.sport);
  let widthClass = template?.width ?? 'standard';
  // Running brands sell explicit Wide variants as separate models.
  if (group.sport === 'running' && /\bwide\b/i.test(group.model)) widthClass = 'wide';
  // A same-gender, same-width curated template carries exact bands; otherwise derive.
  const [minWidth, maxWidth] =
    template && template.gender === group.gender && template.width === widthClass
      ? [template.minWidth, template.maxWidth]
      : widthBand(widthClass, minLength, maxLength, group.gender);
  const notes = template
    ? template.notes
    : 'Standard fit profile — awaiting FootFit fit verification.';

  newEntries.push({
    brand: group.brand,
    model: group.model,
    gender: group.gender,
    sport: group.sport,
    width: widthClass,
    minLength,
    maxLength,
    minWidth,
    maxWidth,
    sizeOffset: template?.sizeOffset ?? 0,
    price,
    notes,
    purchaseUrl,
    imageUrl,
    ...(surfaces.length > 0 ? { surfaces } : {}),
  });
}

// Football entries never seen in the feed (hand-curated models) are firm-ground
// designs — default them so the surface filter never silently hides them.
for (const b of curated) {
  if (b.sport === 'football' && !b.surfaces) b.surfaces = ['FG'];
}

// ---- prune dead stock. An entry is dead when its model is delisted from the
// feed or listed with zero purchasable sizes in any colourway. Womens/unisex
// entries fall back to the model's stock under any gender (Pro:Direct lists
// many of them under the mens/adults collection only). Sports whose feed
// pages weren't loaded are left untouched.
const feedSports = new Set();
for (const [, gender, sport] of COLLECTIONS) {
  if ((counts[`${sport}-${gender}`]?.colourways ?? 0) > 0) feedSports.add(sport);
}
const pruned = [];
const liveCurated = curated.filter((b) => {
  if (!feedSports.has(b.sport)) return true;
  const k = `${b.gender}|${b.brand.toLowerCase()}|${normKey(b.model)}`;
  const mk = `${b.brand.toLowerCase()}|${normKey(b.model)}`;
  const inStock = stockByKey.has(k) ? stockByKey.get(k) : stockByModel.get(mk);
  if (inStock) return true;
  pruned.push(`${b.brand} ${b.model} (${b.gender}, ${b.sport})${inStock === undefined ? ' — delisted' : ' — sold out'}`);
  return false;
});

newEntries.sort(
  (a, b) =>
    a.sport.localeCompare(b.sport) ||
    a.gender.localeCompare(b.gender) ||
    a.brand.localeCompare(b.brand) ||
    a.model.localeCompare(b.model),
);

const byGender = {};
for (const e of newEntries) {
  const k = `${e.sport}-${e.gender}`;
  byGender[k] = (byGender[k] ?? 0) + 1;
}

console.log('cutoff:', CUTOFF);
console.log('colourways:', JSON.stringify(counts));
console.log('model groups:', groups.size);
console.log(
  'skipped (pre-cutoff):', skippedOld,
  '· skipped (no sizes):', skippedNoSizes,
  '· skipped (cross-listed):', skippedCrossover,
  '· skipped (sold out):', skippedSoldOut,
);
console.log('pruned (delisted/sold out):', pruned.length);
if (process.env.VERBOSE) for (const line of pruned) console.log('  -', line);
console.log('curated entries upgraded with live link/image/price:', upgrades.length);
console.log('new entries:', newEntries.length, JSON.stringify(byGender));
const inherited = newEntries.filter((e) => e.notes && !e.notes.startsWith('Standard fit profile')).length;
console.log('fit inherited from curated families:', inherited, '· standard defaults:', newEntries.length - inherited);

if (process.env.DUMP) {
  fs.writeFileSync('/tmp/new-entries.json', JSON.stringify(newEntries, null, 2));
}

if (!DRY) {
  fs.writeFileSync('bootDatabase.json', JSON.stringify([...liveCurated, ...newEntries], null, 2) + '\n');
  console.log('bootDatabase.json written:', liveCurated.length + newEntries.length, 'entries');
}
