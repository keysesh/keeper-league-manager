# Custom Icons

This folder is for storing custom SVG icons exported from Canva Pro.

## Export Guidelines from Canva

1. **Format**: SVG
2. **Size**: 24x24px viewBox
3. **Color**: Use a single color - the component will apply `currentColor`
4. **Naming**: Use kebab-case (e.g., `trophy-premium.svg`)

## Recommended Icons to Create

| Icon Name | Usage | Style Notes |
|-----------|-------|-------------|
| `trophy-premium.svg` | Championships | 3D effect, gold highlights |
| `crown-elite.svg` | Dynasty status | Jeweled, premium feel |
| `fire-streak.svg` | Win streaks | Dynamic, stylized flames |
| `target-precision.svg` | Best record | Modern crosshair style |
| `lightning-trade.svg` | Trade master | Energetic bolt |
| `chart-rising.svg` | Points leader | Upward trend with glow |
| `shield-keeper.svg` | Keeper protection | Badge/crest style |
| `users-team.svg` | Roster/team | Modern silhouettes |

## How to Use

After exporting from Canva:

1. Place the SVG file in this folder
2. Update `src/components/ui/CustomIcons.tsx` with the new SVG paths
3. Import and use in your components:

```tsx
import { TrophyPremium, CrownElite } from "@/components/ui/CustomIcons";

<TrophyPremium className="w-6 h-6 text-amber-400" />
```

## Current Status

The `CustomIcons.tsx` file contains placeholder implementations using standard SVG paths. Replace these with your Canva exports for a unique, premium look.
