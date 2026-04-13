---
paths:
  - app/**/*
---

Navigation is a Stack in `app/_layout.tsx`. Data passes via route params between screens:

1. **HomeScreen** → user picks sport (football/running) + gender (mens/womens)
2. **ManualInputScreen** → receives `sport`, `gender`. Collects foot length + width via shoe size lookup or direct mm entry
3. **SockSelectionScreen** → receives `footLength`, `footWidth`, `sport`, `gender`. User picks a sock type
4. **ResultScreen** → receives all params. Adds sock thickness, filters `bootDatabase.json`, shows matching footwear

When adding a new screen, register it in `app/_layout.tsx` and place the component in `app/screens/`.
