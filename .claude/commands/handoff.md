---
name: handoff
description: "Write a short mid-session handoff note so a fresh context window can resume cleanly"
---

Overwrite `.claude/handoff.md` with a current resume-note.

## Steps

1. Gather state:
   - `git rev-parse --short HEAD` for current commit
   - `git status --short` for dirty/clean + files touched
   - Recall whether `/verify` has been run recently and its result
2. Write `.claude/handoff.md` using the template in that file. Fill every section. Use today's timestamp in `YYYY-MM-DD HH:MM`.
3. Keep it under ~25 lines. No narration of what was tried — just present state + next action.
4. If `.claude/handoff.md` is not in `.gitignore`, add it.
5. Report: "Handoff written. Next session: `/resume` to pick up."

## Rules

- Overwrite, don't append — this is a resume-note, not a log.
- If the next step is ambiguous, put it in **Open questions**, not Next step.
- If `/verify` hasn't been run since the last change, say so explicitly.
