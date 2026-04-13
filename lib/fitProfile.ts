export type FitProfile = {
  version: 1;
  sport: string;
  gender: string;
  footLength: number;
  footWidth: number;
  sockType: string;
  savedAt: string;
};

export type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  deleteItem: (key: string) => Promise<void>;
};

const PROFILE_KEY = 'fit_profile_v1';

export function createFitProfileStore(storage: StorageAdapter) {
  return {
    async save(data: Omit<FitProfile, 'version' | 'savedAt'>): Promise<void> {
      const profile: FitProfile = { ...data, version: 1, savedAt: new Date().toISOString() };
      await storage.setItem(PROFILE_KEY, JSON.stringify(profile));
    },

    async load(): Promise<FitProfile | null> {
      const raw = await storage.getItem(PROFILE_KEY);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        if (parsed.version !== 1) return null;
        return parsed as FitProfile;
      } catch {
        return null;
      }
    },

    async clear(): Promise<void> {
      await storage.deleteItem(PROFILE_KEY);
    },
  };
}
