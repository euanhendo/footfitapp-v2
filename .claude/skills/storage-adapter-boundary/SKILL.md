---
name: storage-adapter-boundary
description: Enforces the StorageAdapter boundary when editing lib/fitProfile.ts, lib/ownedShoes.ts, or any app/screens/*.tsx that persists data. Bans direct expo-secure-store imports in components and mandates dependency injection for testability. Use when touching persistence, saving profiles, or refactoring storage code.
---

# FootFit storage boundary

## The rule

Only `lib/fitProfile.ts` and `lib/ownedShoes.ts` know that persistence exists. Screens and other `lib/` modules consume a **store instance** returned by `createFitProfileStore(adapter)` / `createOwnedShoesStore(adapter)`. No one else touches `expo-secure-store`.

## Adapter shape

```ts
export type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  deleteItem: (key: string) => Promise<void>;
};
```

Any new persistence layer must conform to this shape. Do not add `getAllKeys`, `multiSet`, or other SecureStore-specific methods — if you need them, the abstraction is wrong.

## Component-side pattern

```ts
// lib/fitProfile.ts (or a small factory file)
import * as SecureStore from 'expo-secure-store';
export const fitProfileStore = createFitProfileStore(SecureStore);

// app/screens/SomeScreen.tsx
import { fitProfileStore } from '../../lib/fitProfile';
await fitProfileStore.save({ … });
```

Screens **never** `import * as SecureStore`. If you see that import outside `lib/`, it's a bug.

## Test-side pattern

Tests inject an in-memory fake — they do **not** mock the native module:

```ts
function createFakeAdapter(): StorageAdapter {
  const store = new Map<string, string>();
  return {
    getItem: async (k) => store.get(k) ?? null,
    setItem: async (k, v) => { store.set(k, v); },
    deleteItem: async (k) => { store.delete(k); },
  };
}

const store = createFitProfileStore(createFakeAdapter());
```

Never `jest.mock('expo-secure-store')` — it couples tests to native-module internals and breaks CI.

## Schema versioning

`FitProfile.version` is a literal type (currently `1`). To change the shape:

1. Bump the literal (`version: 2`).
2. Handle old-version reads explicitly in `load()` (migrate or return `null`).
3. Consider a new key (`fit_profile_v2`) if the shape is incompatible.
4. Add a test loading a v1 blob and asserting the v2 store handles it.

Never silently coerce across versions.

## Red flags while editing

- `import * as SecureStore` in any `app/screens/*.tsx` file.
- `jest.mock('expo-secure-store')` in a test.
- A `lib/` helper that accepts raw storage keys instead of a store instance.
- Changing `FitProfile`'s shape without bumping `version` or adding a migration test.
