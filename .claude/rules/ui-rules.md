---
paths:
  - app/**/*
---

- All styles are inline objects — no styling library, no theme file, no shared style components
- Colours: dark text `#111`, muted text `#666`/`#999`, background `#f9f9f9`, cards `#fff`, borders `#e8e8e8`/`#ebebeb` (`#d5d5d5` for chips), primary buttons `#111` with white text
- Use `Pressable` over `TouchableOpacity`
- Width fit badges are colour-coded: narrow `#1a6bb5`, standard `#2a8a3a`, wide `#b55a1a`

## Design language (Nike/Adidas-inspired, 2026-06)

- **Section labels**: uppercase, `fontSize 11, fontWeight '800', color '#999', letterSpacing 1.5`
- **Border radius three-tier**: 16 for cards and photo bands · 4 for chips/secondary buttons (squared, Adidas-style) · 999 for primary CTAs and badges (pill, Nike-style)
- **Chips**: squared (radius 4), border `#d5d5d5`, uppercase `fontSize 11, fontWeight '800', letterSpacing 1`; active = `#111` bg + white text
- **Hero/profile cards**: black `#111` card, uppercase eyebrow in `#888`, measurement as the big number (`fontSize 24–34, fontWeight '800'`, white) with small muted unit, hairline divider `rgba(255,255,255,0.15)`
- **Product cards** (Result): brand as uppercase eyebrow, model name bold below it, price first in the meta row, score badge as black pill on the image
- **Photo bands** (Home sport picker): height 110, radius 16, remote boot-level action image with `rgba(0,0,0,0.32)` scrim, uppercase white label `fontWeight '900', letterSpacing 2.5`; `onError` falls back to plain `#1a1a1a` so labels survive offline
- **No emojis in production UI** — type and photography carry the design
- Numbers shown to users get translated into plain human language wherever a judgement is implied (fit, room, snugness)
