# 0001 — Route params are strings

**Status:** accepted
**Date:** 2026-04-14

## Context

Expo Router (and React Navigation generally) serialises route params to strings in the URL layer. Typing a param as `number` creates a silent type lie: TypeScript trusts the declaration, but the runtime value is a string, and math on it produces `"240" + 5 === "2405"` bugs.

FootFit passes `footLength`, `footWidth`, `sport`, `gender` through four screens. Numeric ones are load-bearing for filtering and scoring.

## Decision

**All route params are typed as `string`.** The receiving screen parses numeric params with `Number()` (and validates against `NaN`) at the top of the component. This is enforced by `code-reviewer` as a Critical finding when violated.

## Consequences

- Every screen with numeric params has a small parsing preamble. Acceptable tax.
- Refactors that want to add a new param don't get to shortcut the pattern.
- Tests for screens should assert behaviour against string inputs at the boundary.
- The rule is inlined in `CLAUDE.md` so agents see it before writing code.
