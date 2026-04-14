import { StorageAdapter } from './fitProfile';

export type OwnedShoe = {
  brand: string;
  model: string;
  gender: string;
  savedAt: string;
};

export type OwnedShoesV1 = {
  version: 1;
  shoes: OwnedShoe[];
};

const OWNED_SHOES_KEY = 'owned_shoes_v1';

function sameShoe(a: OwnedShoe, b: { brand: string; model: string; gender: string }): boolean {
  return a.brand === b.brand && a.model === b.model && a.gender === b.gender;
}

export function createOwnedShoesStore(storage: StorageAdapter) {
  async function load(): Promise<OwnedShoe[]> {
    const raw = await storage.getItem(OWNED_SHOES_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (parsed.version !== 1 || !Array.isArray(parsed.shoes)) return [];
      return parsed.shoes as OwnedShoe[];
    } catch {
      return [];
    }
  }

  async function save(shoes: OwnedShoe[]): Promise<void> {
    const payload: OwnedShoesV1 = { version: 1, shoes };
    await storage.setItem(OWNED_SHOES_KEY, JSON.stringify(payload));
  }

  return {
    load,
    save,

    async add(shoe: Omit<OwnedShoe, 'savedAt'>): Promise<OwnedShoe[]> {
      const current = await load();
      if (current.some((s) => sameShoe(s, shoe))) return current;
      const next = [...current, { ...shoe, savedAt: new Date().toISOString() }];
      await save(next);
      return next;
    },

    async remove(shoe: { brand: string; model: string; gender: string }): Promise<OwnedShoe[]> {
      const current = await load();
      const next = current.filter((s) => !sameShoe(s, shoe));
      await save(next);
      return next;
    },

    async clear(): Promise<void> {
      await storage.deleteItem(OWNED_SHOES_KEY);
    },
  };
}
