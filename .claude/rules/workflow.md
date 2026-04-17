When the user describes a feature, change, or idea:

1. **Understand** — read the relevant screen(s) and data files before writing any code. Check how data flows through route params.
2. **Plan** — briefly explain what you'll change and which files are affected. Wait for confirmation on big changes.
3. **Implement** — make the changes. Keep them minimal and focused on what was asked.
4. **Verify** — after every change, run these checks:
   - `npm test` — confirm all unit tests pass
   - `npx tsc --noEmit` — confirm no TypeScript errors
   - `npm run lint` — confirm no lint issues
   - If editing JSON data files, validate entries match the data-rules
   - Re-read the changed files and confirm they do what was asked — nothing more, nothing less
5. **Report** — briefly state what was changed and the result of each check. If anything failed, fix it before moving on.

Do NOT add extra features, refactors, or "improvements" beyond what was asked.

## Idea-to-ship loop (high-ROI workflow)

Prefer these slash commands over ad-hoc prompting:

| Stage | Command | Purpose |
|---|---|---|
| Explore an idea | `/brainstorm <idea>` | Conversational pressure-test. No code, no issue. |
| Capture it | `/add-issue <idea>` | Lightweight GitHub issue (problem + rough idea only). |
| Shape it | `/shape-issue <number>` | Flesh out files, tasks, assumptions, open questions as an issue comment. |
| Build it | `/feature <name>` | Automated plan → implement → simplify → verify → review (global command). |
| Review it | `/review` | Multi-perspective review of what was built. |
| Learn from it | `/retro <issue or feature>` | Capture durable learnings; prune stale "Mistakes to Avoid". |
| Pause mid-work | `/handoff` | Write a short resume-note to `.claude/handoff.md` before a compact or new window. |
| Add a boot | `/add-boot` | Validated append to `bootDatabase.json`. |
| Add a sock | `/add-sock` | Validated append to `sockDatabase.json`. |

Skip stages when appropriate (e.g. a tiny fix doesn't need `/brainstorm` or an issue), but do not skip `/retro` after non-trivial work — that's how learnings survive context windows.
