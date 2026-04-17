# 0002 — Persistence goes through StorageAdapter, not direct SecureStore

**Status:** accepted
**Date:** 2026-04-14

## Context

`expo-secure-store` is a native module. Mocking it in Jest requires mocking the native bridge, which is fragile and couples tests to Expo internals. A previous attempt at direct mocks broke on Expo SDK upgrades.

FootFit persists the fit profile (measurements + preferences). This will expand over time (saved comparisons, history).

## Decision

All persistence is accessed through a `StorageAdapter` interface defined in `lib/fitProfile.ts`. Production wires it to `expo-secure-store`; tests inject an in-memory fake. Screens and components never import `expo-secure-store` directly — they go through `lib/fitProfile.ts`.

## Consequences

- Tests for profile logic are fast and deterministic (in-memory fake).
- Swapping the storage backend (e.g. to MMKV) is a one-file change.
- Adding a second persistence surface (e.g. settings) means extending the adapter, not introducing a second storage import.
- Enforced by `code-reviewer` as a Critical finding when a screen imports `expo-secure-store`.
