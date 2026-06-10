---
name: plan-tight
description: "Tight plan-mode template — no alternatives, no trailing options, ends at ExitPlanMode"
---

Use this template to enter plan mode for `$ARGUMENTS` without option-dumps or scope drift.

---

Task: $ARGUMENTS

## Constraints

- Follow `CLAUDE.md` and `.claude/rules/` — reuse existing `lib/` and `app/screens/` patterns, no new abstractions.
- Honour the load-bearing rules: string route params, `StorageAdapter` boundary, `VisionAdapter` boundary.
- Touch the minimum number of files.
- No speculative features, no "while we're here" cleanup.
- Do **not** propose alternatives — pick one approach and commit to it.

## Plan output shape

1. **Context** — 1–2 lines on why this change exists.
2. **Files to change** — paths + what changes in each.
3. **Reused utilities** — existing functions from `lib/` that this plan leans on.
4. **Verification** — `npm test` · `npx tsc --noEmit` · `npm run lint` (or `/verify`).
5. **ExitPlanMode.**

## Rules

- Do not end with "next steps", "would you like me to…", or a list of follow-up options.
- If a genuine branch requires user input, use `AskUserQuestion` during planning — not a trailing menu.
- Plan ends at `ExitPlanMode`. Nothing after it.