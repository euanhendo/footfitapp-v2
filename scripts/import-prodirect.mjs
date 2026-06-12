// One-off importer: Pro:Direct Shopify catalogue -> bootDatabase.json entries.
// Usage: node scripts/import-prodirect.mjs [--cutoff 2025-06-01] [--dry]
// Expects raw pages in /tmp/football-{mens,womens,kids}-boots-p<N>.json
// (fetched from prodirectsport.com/collections/<handle>/products.json).
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
  s = s.replace(/(K|C|Y)$/, '');
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (kidsProduct && n >= 10 && n <= 13.5) return UK_MM[`${s}K`] ?? null;
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
  ['football-mens-boots', 'mens'],
  ['football-womens-boots', 'womens'],
  ['football-kids-boots', 'kids'],
];

// ---- filters
const NOT_FOOTWEAR =
  /glove|shin|sock|ball\b|bag|shirt|short|jacket|pant|tee\b|top\b|cap\b|bottle|pump|lace|insole|stud|guard|tape|kit\b|backpack|holdall/i;

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

function cleanModel(title, vendor) {
  let m = title.trim();
  const v = vendor.trim();
  if (m.toLowerCase().startsWith(v.toLowerCase())) m = m.slice(v.length).trim();
  m = m.replace(/\s+-\s+.*$/, ''); // trailing " - Colour/Colour" descriptions
  m = m.replace(/^(kids|junior|womens|women's)\s+/i, '');
  m = m.replace(/\b(?:air\s+)?zoom\s+/gi, '');
  m = m.replace(/\s+Boots?$/i, '');
  return m.trim();
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

// family token -> curated model that carries the family's fit character.
// X Crazyfast / F50 are the Speedportal lineage (same speed last).
const FAMILY_TOKENS = [
  'mercurial superfly', 'mercurial vapor', 'mercurial', 'phantom', 'tiempo',
  'predator', 'copa', 'f50', 'x speedportal', 'x crazyfast',
  'future', 'king', 'ultra',
  'morelia', 'furon', 'tekela', 'magnetico', 'brasil', 'b-elite',
];
const FAMILY_ALIAS = { 'x crazyfast': 'x speedportal', f50: 'x speedportal' };

function familyOf(model) {
  const lower = normKey(model);
  for (const tok of FAMILY_TOKENS) {
    if (lower.includes(tok)) return FAMILY_ALIAS[tok] ?? tok;
  }
  return null;
}

function curatedTemplate(family, gender) {
  if (!family) return null;
  const candidates = curated.filter(
    (b) => b.sport === 'football' && familyOf(b.model) === family,
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

for (const [handle, gender] of COLLECTIONS) {
  const products = loadCollection(handle);
  counts[gender] = { colourways: products.length };
  for (const p of products) {
    if (NOT_FOOTWEAR.test(p.title)) continue;
    if (!p.variants?.length || !p.vendor) continue;
    const brand = BRAND_NAME[p.vendor.toLowerCase()] ?? p.vendor;
    const { model, surface } = splitSurface(cleanModel(p.title, p.vendor));
    if (!model) continue;
    const key = `${gender}|${brand.toLowerCase()}|${normKey(model)}`;
    if (!groups.has(key)) {
      groups.set(key, { gender, brand, model, products: [] });
    }
    groups.get(key).products.push({ ...p, surface });
  }
}

// ---- reduce each group to one entry
const newEntries = [];
const upgrades = [];
let skippedOld = 0;
let skippedNoSizes = 0;

const curatedByKey = new Map(
  curated.map((b) => [`${b.gender}|${b.brand.toLowerCase()}|${normKey(b.model)}`, b]),
);

for (const group of groups.values()) {
  const latest = group.products
    .map((p) => p.published_at ?? '')
    .sort()
    .at(-1);
  if (!latest || latest < CUTOFF) {
    skippedOld++;
    continue;
  }

  const canonical = [...group.products].sort((a, b) => {
    const sa = SURFACE_PREF.indexOf(a.surface);
    const sb = SURFACE_PREF.indexOf(b.surface);
    if (sa !== sb) return (sa < 0 ? 99 : sa) - (sb < 0 ? 99 : sb);
    return (b.published_at ?? '').localeCompare(a.published_at ?? '');
  })[0];

  // Which surface categories this model is sold in, normalised to the five
  // standard football categories. MG (multi-ground) plays on firm + artificial.
  const surfaceSet = new Set();
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
  const surfaces = ['FG', 'SG', 'AG', 'TF', 'IC'].filter((s) => surfaceSet.has(s));

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

  // Price from the canonical (preferred-surface) product only — group-wide
  // min would let a cheap turf/indoor sibling understate the boot's price.
  const prices = canonical.variants
    .map((v) => Number(v.price))
    .filter((n) => Number.isFinite(n) && n > 0);
  const price = Math.round(Math.min(...(prices.length ? prices : [0])));

  const purchaseUrl = `https://www.prodirectsport.com/products/${canonical.handle}`;
  const imageUrl = canonical.images?.[0]?.src ?? '';

  // already curated? upgrade live fields, keep the curated fit data.
  const curatedKey = `${group.gender}|${group.brand.toLowerCase()}|${normKey(group.model)}`;
  const existing = curatedByKey.get(curatedKey);
  if (existing) {
    existing.purchaseUrl = purchaseUrl;
    if (imageUrl) existing.imageUrl = imageUrl;
    if (price > 0) existing.price = price;
    if (surfaces.length > 0) existing.surfaces = surfaces;
    upgrades.push(`${group.brand} ${group.model} (${group.gender})`);
    continue;
  }

  const family = familyOf(group.model);
  const template = curatedTemplate(family, group.gender);
  const widthClass = template?.width ?? 'standard';
  // A same-gender curated template carries exact bands; otherwise derive.
  const [minWidth, maxWidth] =
    template && template.gender === group.gender
      ? [template.minWidth, template.maxWidth]
      : widthBand(widthClass, minLength, maxLength, group.gender);
  const notes = template
    ? template.notes
    : 'Standard fit profile — awaiting FootFit fit verification.';

  newEntries.push({
    brand: group.brand,
    model: group.model,
    gender: group.gender,
    sport: 'football',
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
    surfaces,
  });
}

// Football entries never seen in the feed (hand-curated models) are firm-ground
// designs — default them so the surface filter never silently hides them.
for (const b of curated) {
  if (b.sport === 'football' && !b.surfaces) b.surfaces = ['FG'];
}

newEntries.sort(
  (a, b) =>
    a.gender.localeCompare(b.gender) ||
    a.brand.localeCompare(b.brand) ||
    a.model.localeCompare(b.model),
);

const byGender = {};
for (const e of newEntries) byGender[e.gender] = (byGender[e.gender] ?? 0) + 1;

console.log('cutoff:', CUTOFF);
console.log('colourways:', JSON.stringify(counts));
console.log('model groups:', groups.size);
console.log('skipped (pre-cutoff):', skippedOld, '· skipped (no sizes):', skippedNoSizes);
console.log('curated entries upgraded with live link/image/price:', upgrades.length);
console.log('new entries:', newEntries.length, JSON.stringify(byGender));
const inherited = newEntries.filter((e) => e.notes && !e.notes.startsWith('Standard fit profile')).length;
console.log('fit inherited from curated families:', inherited, '· standard defaults:', newEntries.length - inherited);

if (!DRY) {
  fs.writeFileSync('bootDatabase.json', JSON.stringify([...curated, ...newEntries], null, 2) + '\n');
  console.log('bootDatabase.json written:', curated.length + newEntries.length, 'entries');
}
