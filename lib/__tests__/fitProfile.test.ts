import { createFitProfileStore, parseMeasureSource, StorageAdapter, FitProfile } from '../fitProfile';

function createMemoryStorage(): StorageAdapter {
  const store: Record<string, string> = {};
  return {
    getItem: async (key) => store[key] ?? null,
    setItem: async (key, value) => { store[key] = value; },
    deleteItem: async (key) => { delete store[key]; },
  };
}

const sampleData = {
  sport: 'football',
  gender: 'mens',
  footLength: 265,
  footWidth: 99,
  sockType: 'trusox_mid',
};

describe('fitProfile', () => {
  it('saves and loads a profile with version and savedAt', async () => {
    const store = createFitProfileStore(createMemoryStorage());
    await store.save(sampleData);
    const loaded = await store.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(1);
    expect(loaded!.sport).toBe('football');
    expect(loaded!.footLength).toBe(265);
    expect(loaded!.savedAt).toBeTruthy();
  });

  it('returns null when no profile saved', async () => {
    const store = createFitProfileStore(createMemoryStorage());
    expect(await store.load()).toBeNull();
  });

  it('round-trips the measurement source', async () => {
    const store = createFitProfileStore(createMemoryStorage());
    await store.save({ ...sampleData, source: 'scanned' });
    expect((await store.load())!.source).toBe('scanned');
  });

  it('loads legacy profiles that have no source', async () => {
    const store = createFitProfileStore(createMemoryStorage());
    await store.save(sampleData);
    const loaded = await store.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.source).toBeUndefined();
  });

  it('returns null for corrupt JSON', async () => {
    const storage = createMemoryStorage();
    await storage.setItem('fit_profile_v1', 'not json{{{');
    const store = createFitProfileStore(storage);
    expect(await store.load()).toBeNull();
  });

  it('returns null for unknown version', async () => {
    const storage = createMemoryStorage();
    await storage.setItem('fit_profile_v1', JSON.stringify({ ...sampleData, version: 2, savedAt: '' }));
    const store = createFitProfileStore(storage);
    expect(await store.load()).toBeNull();
  });

  it('clears profile so load returns null', async () => {
    const store = createFitProfileStore(createMemoryStorage());
    await store.save(sampleData);
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it('overwrites on second save', async () => {
    const store = createFitProfileStore(createMemoryStorage());
    await store.save(sampleData);
    await store.save({ ...sampleData, sport: 'running' });
    const loaded = await store.load();
    expect(loaded!.sport).toBe('running');
  });

  it('preserves numeric types through round-trip', async () => {
    const store = createFitProfileStore(createMemoryStorage());
    await store.save(sampleData);
    const loaded = await store.load();
    expect(typeof loaded!.footLength).toBe('number');
    expect(typeof loaded!.footWidth).toBe('number');
  });

  it('savedAt is a valid ISO 8601 string', async () => {
    const store = createFitProfileStore(createMemoryStorage());
    await store.save(sampleData);
    const loaded = await store.load();
    const parsed = new Date(loaded!.savedAt);
    expect(parsed.getTime()).not.toBeNaN();
  });
});

describe('parseMeasureSource', () => {
  it('accepts the three known sources', () => {
    expect(parseMeasureSource('scanned')).toBe('scanned');
    expect(parseMeasureSource('manual')).toBe('manual');
    expect(parseMeasureSource('estimated')).toBe('estimated');
  });

  it('returns undefined for unknown or empty route-param values', () => {
    expect(parseMeasureSource('')).toBeUndefined();
    expect(parseMeasureSource('banana')).toBeUndefined();
    expect(parseMeasureSource(undefined)).toBeUndefined();
  });
});
