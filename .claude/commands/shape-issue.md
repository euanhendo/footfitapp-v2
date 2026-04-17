---
name: shape-issue
description: "Flesh out a GitHub issue with implementation plan and task breakdown"
argument-hint: '<issue-number>'
---

Shape issue #$ARGUMENTS into an implementable plan.

## Mode

Take a rough issue and turn it into something `/feature` can execute against. Output is a comment appended to the issue, not code.

## Steps

1. **Read the issue**: `gh issue view $ARGUMENTS`.
2. **Explore the codebase** for relevant files. Use the file table in CLAUDE.md as a starting point. Identify:
   - Files likely to change
   - Existing patterns to reuse (e.g. `StorageAdapter`, `getSocksForSport`, route-param conventions)
   - Data files affected (validate against `.claude/rules/data-rules.md`)
3. **Apply critical thinking** (load `critical-thinking` skill):
   - Surface 2–3 assumptions with "if wrong..." consequences
   - One contrarian take — is this the right shape?
   - Simplest version that delivers value
4. **Write the plan** as a GitHub comment with this structure:

   ```markdown
   ## Implementation plan

   ### Files to change
   - `path/to/file.ts` — [what changes]

   ### Tasks (ordered)
   - [ ] Task 1 — [one line]
   - [ ] Task 2 — [one line]
   - [ ] Tests for [module]
   - [ ] Verify: `npm test`, `npx tsc --noEmit`, `npm run lint`

   ### Assumptions & risks
   - [Assumption] — if wrong: [consequence]

   ### Open questions
   - [Anything you need the user to answer before `/feature` can run]

   ### Definition of done
   - [Observable user-facing behaviour]
   - All 3 verify checks pass
   ```

5. **Post**: `gh issue comment $ARGUMENTS --body-file <tempfile>`.
6. **Report** the comment URL and flag any open questions that block `/feature`.

## What NOT to do

- Don't write code. Plan only.
- Don't close the issue.
- Don't skip the "open questions" section if anything is ambiguous — surface it instead of guessing.
