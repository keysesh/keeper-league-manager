"use client";

import { cn } from "@/lib/design-tokens";

interface IconProps {
  className?: string;
  size?: number;
}

/**
 * Custom Premium Icons for Keeper League Manager
 *
 * Stylized SVG icons with distinctive designs:
 * - Layered strokes for depth
 * - Decorative accents
 * - Unique silhouettes
 */

// Championship Trophy - Ornate with handles and star
export function TrophyPremium({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      {/* Left handle */}
      <path
        d="M6.5 4H4C2.9 4 2 4.9 2 6v1c0 2.2 1.8 4 4 4h.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Right handle */}
      <path
        d="M17.5 4H20c1.1 0 2 .9 2 2v1c0 2.2-1.8 4-4 4h-.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Cup body */}
      <path
        d="M6.5 3h11v8c0 3.3-2.5 6-5.5 6s-5.5-2.7-5.5-6V3z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.1"
      />
      {/* Cup rim highlight */}
      <path
        d="M6.5 3h11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Stem */}
      <path
        d="M12 17v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Base */}
      <path
        d="M8 21h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M9 19h6v2H9z"
        fill="currentColor"
        fillOpacity="0.15"
      />
      {/* Star emblem */}
      <path
        d="M12 6.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.2-2.4 1.2.5-2.6-1.9-1.8 2.6-.4L12 6.5z"
        fill="currentColor"
        fillOpacity="0.4"
      />
    </svg>
  );
}

// Dynasty Crown - Ornate with jewels and velvet
export function CrownElite({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      {/* Crown body with fill */}
      <path
        d="M3 16l2.5-7 3.5 3.5L12 7l3 5.5L18.5 9l2.5 7H3z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.1"
        strokeLinejoin="round"
      />
      {/* Crown points */}
      <circle cx="5.5" cy="9" r="1" fill="currentColor" fillOpacity="0.5" />
      <circle cx="12" cy="7" r="1.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="18.5" cy="9" r="1" fill="currentColor" fillOpacity="0.5" />
      {/* Base band */}
      <path
        d="M3 16h18v3.5c0 .8-.7 1.5-1.5 1.5h-15c-.8 0-1.5-.7-1.5-1.5V16z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.15"
      />
      {/* Center jewel */}
      <rect x="10.5" y="17.5" width="3" height="2" rx="0.5" fill="currentColor" fillOpacity="0.6" />
      {/* Side jewels */}
      <circle cx="7" cy="18.5" r="0.8" fill="currentColor" fillOpacity="0.4" />
      <circle cx="17" cy="18.5" r="0.8" fill="currentColor" fillOpacity="0.4" />
    </svg>
  );
}

// Dynamic Flame - Multi-layered fire effect
export function FireStreak({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      {/* Outer flame glow */}
      <path
        d="M12 2c2.5 2.5 7 6.5 7 12 0 4.4-3.1 8-7 8s-7-3.6-7-8c0-5.5 4.5-9.5 7-12z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.08"
      />
      {/* Middle flame layer */}
      <path
        d="M12 6c1.8 1.8 5 5 5 9 0 3-2.2 5.5-5 5.5S7 18 7 15c0-4 3.2-7.2 5-9z"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.7"
        fill="currentColor"
        fillOpacity="0.15"
      />
      {/* Inner flame core */}
      <path
        d="M12 10c1 1.2 3 3 3 5.5 0 1.8-1.3 3.5-3 3.5s-3-1.7-3-3.5c0-2.5 2-4.3 3-5.5z"
        fill="currentColor"
        fillOpacity="0.35"
      />
      {/* Flame tip accent */}
      <path
        d="M12 4v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
    </svg>
  );
}

// Precision Target - Modern crosshair with depth
export function TargetPrecision({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      {/* Outer ring */}
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.05"
      />
      {/* Middle ring */}
      <circle
        cx="12"
        cy="12"
        r="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.7"
      />
      {/* Inner ring */}
      <circle
        cx="12"
        cy="12"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.5"
      />
      {/* Bullseye */}
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      {/* Crosshairs - thicker at ends */}
      <path d="M12 2v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 17v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M2 12h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 12h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Corner accents */}
      <path d="M5 5l2 2M19 5l-2 2M5 19l2-2M19 19l-2-2" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
    </svg>
  );
}

// Lightning Bolt - Electric trade master
export function LightningTrade({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      {/* Main bolt with fill */}
      <path
        d="M13 2L4 13h6l-1 9 10-12h-6l2-8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.15"
      />
      {/* Inner highlight */}
      <path
        d="M12.5 5L7 12h4l-.5 5 5.5-7h-4l1-5z"
        fill="currentColor"
        fillOpacity="0.25"
      />
      {/* Energy sparks */}
      <circle cx="18" cy="5" r="0.8" fill="currentColor" fillOpacity="0.6" />
      <circle cx="20" cy="8" r="0.5" fill="currentColor" fillOpacity="0.4" />
      <circle cx="19" cy="17" r="0.6" fill="currentColor" fillOpacity="0.5" />
      <circle cx="4" cy="7" r="0.5" fill="currentColor" fillOpacity="0.4" />
    </svg>
  );
}

// Rising Chart - Points leader with momentum
export function ChartRising({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      {/* Background bars */}
      <rect x="3" y="16" width="3" height="5" rx="0.5" fill="currentColor" fillOpacity="0.15" />
      <rect x="8" y="12" width="3" height="9" rx="0.5" fill="currentColor" fillOpacity="0.25" />
      <rect x="13" y="8" width="3" height="13" rx="0.5" fill="currentColor" fillOpacity="0.35" />
      <rect x="18" y="4" width="3" height="17" rx="0.5" fill="currentColor" fillOpacity="0.45" />
      {/* Trend line */}
      <path
        d="M3 17l5-4 5-4 6-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arrow head */}
      <path
        d="M16 4h5v5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Data points */}
      <circle cx="3" cy="17" r="1.5" fill="currentColor" fillOpacity="0.6" />
      <circle cx="8" cy="13" r="1.5" fill="currentColor" fillOpacity="0.7" />
      <circle cx="13" cy="9" r="1.5" fill="currentColor" fillOpacity="0.8" />
    </svg>
  );
}

// Shield Keeper - Crest with star emblem
export function ShieldKeeper({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      {/* Shield body */}
      <path
        d="M12 2L4 6v6c0 5.5 3.4 10.3 8 12 4.6-1.7 8-6.5 8-12V6l-8-4z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.1"
      />
      {/* Shield border accent */}
      <path
        d="M12 4L6 7v5c0 4.4 2.7 8.3 6 9.7"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.3"
        strokeLinecap="round"
      />
      {/* Star emblem */}
      <path
        d="M12 7l1.5 3 3.3.5-2.4 2.3.6 3.2-3-1.6-3 1.6.6-3.2-2.4-2.3 3.3-.5L12 7z"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="currentColor"
        fillOpacity="0.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Team Users - Stylized group
export function UsersTeam({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      {/* Center person (leader) */}
      <circle cx="12" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
      <path
        d="M7 19v-1c0-2.2 2.2-4 5-4s5 1.8 5 4v1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M7 19h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Left person */}
      <circle cx="5" cy="9" r="2" stroke="currentColor" strokeWidth="1.25" strokeOpacity="0.7" />
      <path
        d="M2 17v-.5c0-1.4 1.3-2.5 3-2.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeOpacity="0.7"
        strokeLinecap="round"
      />
      {/* Right person */}
      <circle cx="19" cy="9" r="2" stroke="currentColor" strokeWidth="1.25" strokeOpacity="0.7" />
      <path
        d="M22 17v-.5c0-1.4-1.3-2.5-3-2.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeOpacity="0.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Silver Medal - Runner-up with ribbon
export function MedalSilver({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      {/* Left ribbon */}
      <path
        d="M8 2v6l-2 1v-7h2z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1"
      />
      {/* Right ribbon */}
      <path
        d="M16 2v6l2 1v-7h-2z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1"
      />
      {/* Ribbon cross */}
      <path d="M6 2h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Medal circle */}
      <circle
        cx="12"
        cy="15"
        r="6"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.1"
      />
      {/* Inner ring */}
      <circle
        cx="12"
        cy="15"
        r="4"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.5"
      />
      {/* Number 2 */}
      <path
        d="M10 13.5c0-.8.9-1.5 2-1.5s2 .7 2 1.5c0 .4-.3.8-.8 1.2L11 17h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// Trade Arrows - Dynamic exchange
export function TradeArrows({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      {/* Top arrow line with fill */}
      <path
        d="M3 7h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M13 3l5 4-5 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
      {/* Bottom arrow line with fill */}
      <path
        d="M21 17H7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M11 13l-5 4 5 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
      {/* Motion lines */}
      <path d="M5 5h2M7 9h2" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" strokeLinecap="round" />
      <path d="M17 15h2M15 19h2" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" strokeLinecap="round" />
    </svg>
  );
}

// Playoff Bracket Icon
export function PlayoffBracket({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      {/* Left bracket lines */}
      <path d="M3 4h4v4H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 16h4v4H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 6h3v6H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 18h3v-6H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Center to trophy */}
      <path d="M10 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Mini trophy */}
      <path
        d="M16 9h4v3c0 1.7-1.3 3-3 3h-1c-1.7 0-3-1.3-3-3V9h3z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path d="M17 15v2M16 17h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Win Streak - Multiple flames
export function WinStreak({ className, size = 24 }: IconProps) {
  return (
    <svg
      className={cn("text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      {/* Left small flame */}
      <path
        d="M5 18c-1.5 0-2.5-1.5-2.5-3 0-2.5 2-4 2.5-5 .5 1 2.5 2.5 2.5 5 0 1.5-1 3-2.5 3z"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="currentColor"
        fillOpacity="0.15"
      />
      {/* Center large flame */}
      <path
        d="M12 20c-3 0-5-2.5-5-5.5 0-4 3.5-7 5-9 1.5 2 5 5 5 9 0 3-2 5.5-5 5.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path
        d="M12 20c-1.5 0-2.5-1.2-2.5-2.8 0-2 1.5-3.5 2.5-4.7 1 1.2 2.5 2.7 2.5 4.7 0 1.6-1 2.8-2.5 2.8z"
        fill="currentColor"
        fillOpacity="0.35"
      />
      {/* Right small flame */}
      <path
        d="M19 18c-1.5 0-2.5-1.5-2.5-3 0-2.5 2-4 2.5-5 .5 1 2.5 2.5 2.5 5 0 1.5-1 3-2.5 3z"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="currentColor"
        fillOpacity="0.15"
      />
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
  PlayoffBracket,
  WinStreak,
};

export default CustomIcons;
