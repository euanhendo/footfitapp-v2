---
name: route-params-strings
description: Enforces string-only route params and Number() parsing when editing app/_layout.tsx or any screen in app/screens/. Covers expo-router Stack registration, SafeAreaView usage, and dynamic SockSelection rendering. Use when adding, editing, or wiring navigation between FootFit screens.
---

# FootFit screen & routing conventions

## Route params are strings — always

Expo Router serialises params through the URL. A param typed as `number` will arrive as a string at runtime, causing silent `NaN` bugs.

**Do:**
```ts
// sender
router.push({
  pathname: '/screens/SockSelectionScreen',
  params: { footLength: String(footLengthMm), sport, gender },
});

// receiver
const { footLength, sport, gender } = useLocalSearchParams<{
  footLength: string; sport: string; gender: string;
}>();
const footLengthMm = Number(footLength);
```

**Don't:**
- Type any param field as `number` in `useLocalSearchParams<…>()`.
- Skip the `Number()` parse and pass `footLength` straight into math.
- Default to `parseInt` — use `Number()` so decimals survive.

## Stack registration

Every new screen must be added to `app/_layout.tsx`:

```tsx
<Stack.Screen name="screens/NewScreen" options={{ title: '…' }} />
```

File path convention: `app/screens/<Name>Screen.tsx`. The route `name` is `screens/<Name>Screen` — match exactly.

## Top-level wrapper

Screens wrap their root in `SafeAreaView` from **`react-native-safe-area-context`** (not the deprecated RN one):

```tsx
import { SafeAreaView } from 'react-native-safe-area-context';
```

## Screen flow (do not reorder)

`HomeScreen` → `ManualInputScreen` → `SockSelectionScreen` → `ResultScreen`. Params accumulate down the stack; each screen re-passes what the next one needs.

## SockSelection renders dynamically

Never hardcode `<Picker.Item>` for socks. Always call `getSocksForSport(sockDatabase, sport)` and map the result. Adding a sock is a data-only change; a screen edit means something is wrong.

## UI primitives

- Use `Pressable`, not `TouchableOpacity`.
- Styles are inline objects — no theme file, no styled-components.
- Colour tokens (dark text `#111`, muted `#666`/`#999`, bg `#f9f9f9`, cards `#fff`, borders `#e8e8e8`/`#ebebeb`) — reuse these rather than inventing new hex values.
- Width badges: narrow `#1a6bb5`, standard `#2a8a3a`, wide `#b55a1a`.

## Red flags while editing

- `params: { footLength: number }` in a type.
- A screen importing from `react-native`'s `SafeAreaView`.
- A new screen that isn't registered in `_layout.tsx`.
- Hardcoded sock options in a Picker.
