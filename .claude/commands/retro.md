---
name: retro
description: "Retrospective on a completed feature — surface learnings for future context windows"
argument-hint: '[<issue-number or feature name>]'
---

Run a retrospective on: $ARGUMENTS (or the most recent feature if no argument).

## Mode

Reflect on what just got built. The goal is to capture **durable learnings** that survive this context window — via memory, CLAUDE.md "Mistakes to Avoid", or updated rules.

## Steps

1. **Gather context**:
   - `git log --oneline -20` to see the arc of recent work
   - `gh issue view <n>` if an issue was referenced
   - Read CLAUDE.md "Mistakes to Avoid" — what's already captured?

2. **Answer these questions honestly** (short, not padded):
   - **What went well?** — approaches worth repeating
   - **What was friction?** — things that took longer than they should have
   - **What surprised me?** — assumptions that turned out wrong
   - **What did the user correct?** — scroll conversation for "no", "don't", "stop", or redirects
   - **What did the user validate?** — non-obvious choices they accepted without pushback

3. **Categorise each learning**:

   | Learning | Where it belongs |
   |---|---|
   | Project-specific gotcha | CLAUDE.md "Mistakes to Avoid" |
   | Cross-project preference | Auto-memory (feedback type) |
   | Architectural decision | `.claude/rules/*.md` |
   | Ephemeral / one-off | Nowhere — don't save |

4. **Apply the updates**:
   - Edit CLAUDE.md / rules files directly for project-specific items
   - Save memory entries for cross-conversation feedback (follow the auto-memory guidance — include **Why** and **How to apply**)
   - Skip anything derivable from code or git history

5. **Prune "Mistakes to Avoid"**: scan CLAUDE.md's list. For each entry, ask: has this been relevant in recent work? If it's stale or has been internalised (no longer a real risk), remove it or graduate it into a positive rule in `.claude/rules/`. Lists that only grow stop being read.

6. **Report** a short summary:
   - 3–5 bullet learnings
   - What was persisted (file path or memory name) and what was deliberately not
   - What was pruned from "Mistakes to Avoid"

## What NOT to do

- Don't save process narration ("we did X then Y") — that's in git log.
- Don't duplicate existing CLAUDE.md entries.
- Don't invent learnings to fill the template — if nothing surprising happened, say so.
