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
