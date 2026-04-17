---
name: resume
description: "Read handoff.md, latest decisions, and git state — propose the next concrete action"
---

Pick up where the previous session left off.

## Steps

1. **Read context** in parallel:
   - `cat .claude/handoff.md`
   - `ls .claude/decisions/ 2>/dev/null | tail -3` then read the newest
   - `git status --short` and `git log --oneline -5`
   - `git rev-parse --short HEAD`

2. **Reconcile** — if the handoff's "Last verified state" commit ≠ current HEAD, flag the drift. If the branch is dirty with unrelated changes, flag that too.

3. **Propose next action** in this shape:

   ```
   Resuming: <goal from handoff>
   Last verified: <commit> · /verify <pass|fail|stale>
   Drift: <none | describe>

   Next: <single concrete action>
   Open questions: <list, or none>
   ```

4. **Wait for user confirmation** before executing. Do not start coding. If the user says "go", begin with the Next action.

## Rules

- Never overwrite `handoff.md` from `/resume` — that's `/handoff`'s job.
- If `handoff.md` is missing or stale (>7 days), say so and ask the user what to work on.
- Do not re-verify unless the user asks — just report the last known state.
