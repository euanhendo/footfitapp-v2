# Roadmap — April 2026

Captured from brainstorm on 2026-04-15. Guides which issues get shaped next via `/add-issue` → `/shape-issue` → `/feature`. Status refreshed 2026-04-17.

## Shipped

- ✅ Score-breakdown bug — asymmetric width scoring + recentred ratios (`3125e73`).
- ✅ HomeScreen Unisex + US sizes (`4096989`).
- ✅ Rugby boot database (`4096989`).
- ✅ Measure guide screen (`c18c90c`).
- ✅ Result screen: boot images (`BootImage`) and boot-vs-user dimensions panel.
- ✅ Result filter / sort / width-preference boost (`8444baf`).

## Remaining

### SockSelection screen

- Replace Picker with a **search bar** (e.g. "Nike" → Nike socks).
- Show a **picture** of each sock.

### Camera-based foot scan (stretch / spike)

Marked out-of-scope in `CLAUDE.md` but user wants it reconsidered. Accuracy is make-or-break (5mm error worse than manual input). Likely needs Expo camera + reference-object scaling (A4) or ARKit/ARCore depth. **Spike first**, go/no-go before full build.

## Priority

1. SockSelection search + images.
2. Camera scan — spike only.