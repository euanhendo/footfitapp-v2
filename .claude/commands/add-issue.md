---
name: add-issue
description: "Create a GitHub issue for a feature idea (lightweight — just capture it)"
argument-hint: '<short description of feature>'
---

Create a GitHub issue for: $ARGUMENTS

## Mode

Lightweight capture. The goal is to get the idea out of the user's head and into the tracker before it's forgotten. Detail comes later via `/shape-issue`.

## Steps

1. **Confirm scope** — one sentence on what this issue is about. If ambiguous, ask before creating.
2. **Draft** the issue body with this structure (keep it brief — 5–15 lines total):

   ```markdown
   ## Problem
   [What user need or gap does this address?]

   ## Rough idea
   [1–3 sentences on the proposed solution.]

   ## Out of scope (for now)
   [Anything explicitly not part of this issue.]

   ## Next step
   Run `/shape-issue <number>` to flesh out implementation details.
   ```

3. **Pick a label** from existing repo labels (`gh label list`). If none fit, leave unlabelled — don't invent new labels.
4. **Create** via `gh issue create --title "<title>" --body "<body>" [--label ...]`. Title under 70 chars, no trailing period, lowercase-ish (match repo style via `gh issue list --limit 5`).
5. **Report** the issue URL. Do not start implementation.

## What NOT to do

- Don't write implementation details — that's `/shape-issue`.
- Don't create the issue if the idea is still fuzzy. Push back and suggest `/brainstorm` first.
- Don't commit code. Don't touch files.
