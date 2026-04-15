---
name: test-patterns
description: FootFit testing conventions for lib/__tests__/ — Jest + ts-jest, in-memory StorageAdapter fakes, and [0,100] score-bound assertions. Use when writing or editing unit tests for fitting math, fit scoring, or persisted profiles.
---

# FootFit test patterns

Tests live in `lib/__tests__/` and cover **pure functions only**. No React Native component tests here — if you need to test a screen, that's a separate concern (and currently out of scope).

## Structure (AAA)

```ts
describe('computeFitScore', () => {
  it('returns 100 when measurements hit the center of range', () => {
    // Arrange
    const boot = makeBoot({ minLength: 270, maxLength: 280, minWidth: 95, maxWidth: 105 });

    // Act
    const result = computeFitScore(boot, 275, 100);

    // Assert
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBe(100);
  });
});
```

Keep `describe` blocks per public function. One behaviour per `it`. No shared mutable state between tests.

## Score-bound assertion is mandatory

Every test that produces a score must assert the `[0, 100]` invariant, even if it also asserts an exact number:

```ts
expect(result.score).toBeGreaterThanOrEqual(0);
expect(result.score).toBeLessThanOrEqual(100);
```

This catches regressions where a code change produces 105 or -3 for edge inputs.

## Storage tests inject a fake adapter

```ts
function createFakeAdapter(): StorageAdapter {
  const store = new Map<string, string>();
  return {
    getItem: async (k) => store.get(k) ?? null,
    setItem: async (k, v) => { store.set(k, v); },
    deleteItem: async (k) => { store.delete(k); },
  };
}
```

**Never** `jest.mock('expo-secure-store')`. The adapter indirection exists precisely so tests can swap in-memory storage.

## Profile schema tests

Any change to `FitProfile`'s shape must add a test that:

1. Writes an old-version blob directly via the fake adapter's `setItem`.
2. Calls `store.load()`.
3. Asserts either a successful migration or a clean `null` return.

## Fixtures

Prefer tiny inline builders (`makeBoot({ … })`) over JSON fixture files. The boot shape is small; a factory keeps the intent visible in each test.

## Running

```bash
npm test                # all tests
npm test -- fitScore    # filtered
```

`/verify` runs `npm test`, `npx tsc --noEmit`, and `npm run lint` in parallel — use it before declaring done.

## Red flags while editing

- A test that calls `computeFitScore` but never asserts the `[0,100]` bound.
- `jest.mock('expo-secure-store')` appearing anywhere.
- Component/rendering tests leaking into `lib/__tests__/`.
- Shared `let` state between `it` blocks.