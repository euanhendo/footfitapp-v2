---
name: brainstorm
description: "Conversational brainstorm about an idea — no commitment to build"
argument-hint: '<idea or question>'
---

Brainstorm with me about: $ARGUMENTS

## Mode

This is **exploratory conversation**, not a plan or implementation. No code changes. No issue creation (user will invoke `/add-issue` if they want that).

## Your job

1. **Restate the idea** in one sentence to confirm understanding.
2. **Ask 1–3 clarifying questions** if the idea is ambiguous. Otherwise skip.
3. **Explore the idea** across these angles (pick what's relevant, skip what isn't):
   - What problem does this solve for a FootFit user? Is it real?
   - Rough shape of the implementation (files, data, UI)
   - What's the simplest version that delivers the value?
   - Risks, unknowns, or things that could make this a bad investment
   - Is this in or out of current scope? (See CLAUDE.md "Mistakes to Avoid" — camera, analytics, remote catalog, wearables, social sharing are explicitly out of scope)
4. **Give a verdict**: worth building now / worth building later / probably skip — with one-line reasoning.

## Style

- Conversational, not a formal doc. Short paragraphs, not heavy headers.
- Push back if the idea is weak. Don't rubber-stamp.
- If the user seems sold on it, suggest `/add-issue` to capture it.
