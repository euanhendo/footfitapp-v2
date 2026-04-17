# 0003 — No external state management

**Status:** accepted
**Date:** 2026-04-14

## Context

FootFit is a linear, short-flow app: Home → ManualInput → SockSelection → Result. Each screen needs data from the previous. The persisted profile is a one-object blob loaded on Home.

Redux / Zustand / Jotai would add boilerplate, a learning curve for collaborators, and a new testing surface — all to solve a problem we don't have.

## Decision

State stays in **local component state + route params**. Persisted state lives behind `StorageAdapter` (see 0002). No global store. No context providers for app state.

## Consequences

- Adding a new screen means threading params, not mutating a global store. Explicit > implicit.
- If the flow ever branches non-linearly (many entry points, shared cart-like state), revisit this decision — but not before.
- Agents (planner, architect) push back on any proposal that introduces a store.
