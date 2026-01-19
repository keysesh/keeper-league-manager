"use client";

import { cn } from "@/lib/design-tokens";

interface IconProps {
  className?: string;
  size?: number;
}

/**
 * Custom Icons Component
 *
 * Premium custom icons for the Keeper League Manager.
 * These are placeholder implementations - replace SVG paths with
 * exports from Canva Pro for a unique, non-Lucide aesthetic.
 *
 * Export guidelines from Canva:
 * - SVG format
 * - 24x24px viewBox
 * - Single color using currentColor
 * - Clean paths (no unnecessary groups/transforms)
 */

// Trophy with premium 3D effect
export function TrophyPremium({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Trophy cup */}
      <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
      <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
      <path d="M6 3h12v7a6 6 0 0 1-12 0V3z" />
      {/* Base */}
      <path d="M9 21h6" />
      <path d="M12 16v5" />
      {/* Star accent */}
      <path d="M12 7l1 2h2l-1.5 1.5.5 2.5-2-1.5-2 1.5.5-2.5L9 9h2l1-2z" />
    </svg>
  );
}

// Crown with jeweled premium feel
export function CrownElite({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Crown shape */}
      <path d="M2 17l3-8 4 4 3-6 3 6 4-4 3 8H2z" />
      {/* Base band */}
      <path d="M2 17h20v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3z" />
      {/* Jewels */}
      <circle cx="12" cy="18.5" r="1" fill="currentColor" />
      <circle cx="8" cy="18.5" r="0.75" fill="currentColor" />
      <circle cx="16" cy="18.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

// Dynamic fire/flame for streaks
export function FireStreak({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Main flame */}
      <path d="M12 22c-4.97 0-8-3.58-8-8 0-5.5 5-10 8-13 3 3 8 7.5 8 13 0 4.42-3.03 8-8 8z" />
      {/* Inner flame detail */}
      <path d="M12 22c-2 0-4-1.5-4-4 0-3 2.5-5 4-7 1.5 2 4 4 4 7 0 2.5-2 4-4 4z" />
    </svg>
  );
}

// Modern crosshair target for precision/best record
export function TargetPrecision({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Outer ring */}
      <circle cx="12" cy="12" r="9" />
      {/* Middle ring */}
      <circle cx="12" cy="12" r="5" />
      {/* Center dot */}
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      {/* Crosshairs */}
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

// Energetic lightning bolt for trade master
export function LightningTrade({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Main bolt */}
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
      {/* Energy accent lines */}
      <path d="M19 6l2-1M19 18l2 1" strokeWidth="1" />
    </svg>
  );
}

// Upward trend chart with glow effect
export function ChartRising({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Trend line */}
      <path d="M3 20l5-5 4 4 9-11" />
      {/* Arrow head */}
      <path d="M17 4h4v4" />
      {/* Chart bars */}
      <path d="M3 20h18" strokeWidth="1" />
      <rect x="4" y="15" width="2" height="5" fill="currentColor" opacity="0.3" />
      <rect x="9" y="12" width="2" height="8" fill="currentColor" opacity="0.5" />
      <rect x="14" y="9" width="2" height="11" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

// Shield/crest for keeper protection
export function ShieldKeeper({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Shield shape */}
      <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
      {/* Star emblem */}
      <path d="M12 8l1.5 3h3l-2.5 2 1 3.5-3-2-3 2 1-3.5-2.5-2h3L12 8z" />
    </svg>
  );
}

// Modern team/users silhouettes
export function UsersTeam({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Center person (larger) */}
      <circle cx="12" cy="7" r="3" />
      <path d="M12 13c-4 0-6 2-6 4v2h12v-2c0-2-2-4-6-4z" />
      {/* Left person */}
      <circle cx="5" cy="9" r="2" />
      <path d="M5 14c-2 0-3 1-3 2v1h4" strokeWidth="1" />
      {/* Right person */}
      <circle cx="19" cy="9" r="2" />
      <path d="M19 14c2 0 3 1 3 2v1h-4" strokeWidth="1" />
    </svg>
  );
}

// Medal for runner-up
export function MedalSilver({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Ribbon */}
      <path d="M7.5 3l2 5M16.5 3l-2 5" />
      <path d="M5 3h14" />
      {/* Medal circle */}
      <circle cx="12" cy="14" r="6" />
      {/* Number 2 */}
      <path d="M10 12c0-1 1-2 2-2s2 1 2 2c0 .5-.5 1-1 1.5l-3 2.5h4" strokeWidth="1.25" />
    </svg>
  );
}

// Trade arrows for activity
export function TradeArrows({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Top arrow (right) */}
      <path d="M4 8h13M13 4l4 4-4 4" />
      {/* Bottom arrow (left) */}
      <path d="M20 16H7M11 12l-4 4 4 4" />
    </svg>
  );
}

// Export all icons as a collection for easy access
export const CustomIcons = {
  TrophyPremium,
  CrownElite,
  FireStreak,
  TargetPrecision,
  LightningTrade,
  ChartRising,
  ShieldKeeper,
  UsersTeam,
  MedalSilver,
  TradeArrows,
};

export default CustomIcons;
