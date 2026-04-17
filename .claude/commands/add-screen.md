---
name: add-screen
description: "Scaffold a new expo-router screen honouring FootFit conventions (SafeAreaView, string route params, _layout.tsx registration)"
argument-hint: '<screen-name>'
---

Scaffold a new screen: **$ARGUMENTS**.

## Steps

1. **Clarify** (ask the user if not obvious from the name):
   - What data does the screen receive? (route params — remember, always strings)
   - Where does it come from in the flow? (which screen navigates here?)
   - Where does it go next? (what params does it pass on?)
   - Is any new `lib/` logic needed, or is it a pure rendering/input screen?

2. **Delegate architecture call** to the **architect** agent if the screen introduces:
   - A new persistence surface
   - A new `lib/` module
   - A change to existing route-param shapes

   Otherwise proceed.

3. **Create** `app/screens/<ScreenName>Screen.tsx` with:
   - `SafeAreaView` from `react-native-safe-area-context` at the top.
   - `Pressable` for tappable elements (never `TouchableOpacity`).
   - Route params typed as `string` and parsed via `Number()` at the top of the component if numeric.
   - Inline styles — follow `.claude/rules/ui-rules.md`.
   - No direct `expo-secure-store` import. Go through `StorageAdapter` in `lib/fitProfile.ts` if persistence is needed.
   - No hardcoded list items for data-driven lists — render dynamically.

4. **Register** the route in `app/_layout.tsx`:
   - Add a `<Stack.Screen name="..." />` entry.
   - Extend the route-param type union with the new screen's params (all strings).

5. **Wire navigation** from the originating screen to the new one (use `router.push` with stringified params).

6. **Add a test stub** in `lib/__tests__/` only if the screen introduces new `lib/` logic. Delegate to **tdd-guide** for test content.

7. **Verify**: run `/verify`.

8. **Report**:
   - Screen path
   - Route registered as: `<name>`
   - Params: `<list>`
   - `/verify` result
   - Whether an ADR is recommended (for new patterns)

## What NOT to do

- Don't type route params as `number`. They are always strings.
- Don't import `expo-secure-store` from a screen.
- Don't add a state-management library — local state + params only.
- Don't duplicate logic that exists in `lib/` — import it.
- Don't commit. User commits after review.
