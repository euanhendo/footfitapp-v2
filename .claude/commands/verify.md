---
name: verify
description: "Run npm test, tsc, and lint in parallel; summarise; suggest the right agent for any failure"
---

Run the FootFit verify suite — codifies step 4 of `.claude/rules/workflow.md`.

## Steps

1. **Run all three in parallel** (single message, three Bash calls):
   - `npm test --silent`
   - `npx tsc --noEmit`
   - `npm run lint`

2. **Summarise** in this exact shape:

   ```
   /verify — <YYYY-MM-DD HH:MM>
   tsc:  <pass|fail>  <short summary if fail>
   lint: <pass|fail>  <short summary if fail>
   test: <pass|fail>  <X/Y suites, X/Y tests>

   Next: <"ship it" | concrete fix | "delegate to <agent>">
   ```

3. **Delegation hints** when failing:
   - Type error in `lib/` math → suggest **fit-domain-expert** (to confirm rule) then **tdd-guide** (to cover it).
   - Type error in a screen around route params → suggest **code-reviewer** (likely missing `Number()`).
   - Failing test in `lib/__tests__/` → suggest **tdd-guide**.
   - Lint on styling → suggest quick inline fix, no agent needed.
   - Anything crossing the `StorageAdapter` boundary → suggest **architect**.

4. **Do not fix failures yourself** unless the user says to — just report.

## Rules

- Never skip a check because "the other two passed".
- Never pass `--no-verify` or similar to make a check go away.
- If `npm test` outputs are very long, truncate to the failing suites only.
- After a successful run, recommend updating `.claude/handoff.md` with the current commit SHA if the user is about to context-switch.
