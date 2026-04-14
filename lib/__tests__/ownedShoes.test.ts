import { createOwnedShoesStore } from '../ownedShoes';
import { StorageAdapter } from '../fitProfile';

function createMemoryStorage(): StorageAdapter {
  const store: Record<string, string> = {};
  return {
    getItem: async (key) => store[key] ?? null,
    setItem: async (key, value) => { store[key] = value; },
    deleteItem: async (key) => { delete store[key]; },
  };
}

const phantom = { brand: 'Nike', model: 'Phantom GX II', gender: 'mens' };
const tiempo = { brand: 'Nike', model: 'Tiempo', gender: 'mens' };

describe('ownedShoes', () => {
  it('returns empty array when nothing saved', async () => {
    const store = createOwnedShoesStore(createMemoryStorage());
    expect(await store.load()).toEqual([]);
  });

  it('adds a shoe with savedAt stamped', async () => {
    const store = createOwnedShoesStore(createMemoryStorage());
    const result = await store.add(phantom);
    expect(result).toHaveLength(1);
    expect(result[0].brand).toBe('Nike');
    expect(result[0].savedAt).toBeTruthy();
    expect(new Date(result[0].savedAt).getTime()).not.toBeNaN();
  });

  it('persists across load', async () => {
    const storage = createMemoryStorage();
    const store = createOwnedShoesStore(storage);
    await store.add(phantom);
    const loaded = await createOwnedShoesStore(storage).load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].model).toBe('Phantom GX II');
  });

  it('does not duplicate the same shoe', async () => {
    const store = createOwnedShoesStore(createMemoryStorage());
    await store.add(phantom);
    const result = await store.add(phantom);
    expect(result).toHaveLength(1);
  });

  it('adds multiple distinct shoes', async () => {
    const store = createOwnedShoesStore(createMemoryStorage());
    await store.add(phantom);
    const result = await store.add(tiempo);
    expect(result).toHaveLength(2);
  });

  it('removes a shoe by brand+model+gender', async () => {
    const store = createOwnedShoesStore(createMemoryStorage());
    await store.add(phantom);
    await store.add(tiempo);
    const result = await store.remove(phantom);
    expect(result).toHaveLength(1);
    expect(result[0].model).toBe('Tiempo');
  });

  it('returns empty for unknown version', async () => {
    const storage = createMemoryStorage();
    await storage.setItem('owned_shoes_v1', JSON.stringify({ version: 2, shoes: [phantom] }));
    const store = createOwnedShoesStore(storage);
    expect(await store.load()).toEqual([]);
  });

  it('returns empty for corrupt JSON', async () => {
    const storage = createMemoryStorage();
    await storage.setItem('owned_shoes_v1', 'not json{{{');
    const store = createOwnedShoesStore(storage);
    expect(await store.load()).toEqual([]);
  });

  it('clear removes all shoes', async () => {
    const store = createOwnedShoesStore(createMemoryStorage());
    await store.add(phantom);
    await store.clear();
    expect(await store.load()).toEqual([]);
  });
});
