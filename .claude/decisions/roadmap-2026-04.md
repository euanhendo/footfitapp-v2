# Roadmap — April 2026

Captured from brainstorm on 2026-04-15. Guides which issues get shaped next via `/add-issue` → `/shape-issue` → `/feature`.

## HomeScreen — "I am shopping for"

- Add **Unisex** option alongside Men's / Women's.
- Keep the narrow / standard / wide foot-feel toggle.
- Add more **size systems** — US first, alongside current UK/EU.

## Sport coverage

- Build out the **Rugby** boot database (new sport category in `bootDatabase.json`).
- Broader push: fill `bootDatabase.json` and `sockDatabase.json` as fully as possible.

## SockSelection screen

- Show a **picture** of each sock — users don't always recognise socks by name.
- Replace the Picker with a **search bar** (e.g. "Nike" filters to Nike socks, "Trusox" filters to Trusox). Better UX than a long scroll list.

## Result / Matches screen

- **Score-breakdown bug**: narrow-fit users see every sub-score at 100. Investigate `lib/fitScore.ts` — narrow path likely isn't penalising correctly.
- Use **exact boot dimensions vs user dimensions** directly in verdict copy so users see *why* a boot fits.
- Add **boot pictures** on result cards.

## Camera-based foot scan (stretch)

Currently marked out-of-scope in `CLAUDE.md`. User wants it reconsidered as a potential differentiator.

- Likely needs Expo camera + reference-object scaling (e.g. A4 paper) or ARKit/ARCore depth APIs.
- Accuracy is make-or-break — a 5mm error is worse than manual input.
- **Spike first**, decide go/no-go before committing to a full build.

## Priority

1. Fix score-breakdown bug (correctness — quick win).
2. Unisex + US sizes + Rugby DB (small, high-value).
3. SockSelection search + images.
4. Result screen dimensions + boot images.
5. Camera scan — spike only.