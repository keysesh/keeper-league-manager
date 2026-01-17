/**
 * Shared Color Constants
 * Centralized color definitions for consistent UI theming
 */

// ============================================
// TEAM COLORS (for draft board and standings)
// ============================================

export const TEAM_COLORS = [
  { bg: "bg-red-900/30", border: "border-red-500", text: "text-red-400" },
  { bg: "bg-blue-900/30", border: "border-blue-500", text: "text-blue-400" },
  { bg: "bg-green-900/30", border: "border-green-500", text: "text-green-400" },
  { bg: "bg-yellow-900/30", border: "border-yellow-500", text: "text-yellow-400" },
  { bg: "bg-purple-900/30", border: "border-purple-500", text: "text-purple-400" },
  { bg: "bg-pink-900/30", border: "border-pink-500", text: "text-pink-400" },
  { bg: "bg-indigo-900/30", border: "border-indigo-500", text: "text-indigo-400" },
  { bg: "bg-cyan-900/30", border: "border-cyan-500", text: "text-cyan-400" },
  { bg: "bg-orange-900/30", border: "border-orange-500", text: "text-orange-400" },
  { bg: "bg-teal-900/30", border: "border-teal-500", text: "text-teal-400" },
  { bg: "bg-lime-900/30", border: "border-lime-500", text: "text-lime-400" },
  { bg: "bg-amber-900/30", border: "border-amber-500", text: "text-amber-400" },
  { bg: "bg-rose-900/30", border: "border-rose-500", text: "text-rose-400" },
  { bg: "bg-fuchsia-900/30", border: "border-fuchsia-500", text: "text-fuchsia-400" },
  { bg: "bg-emerald-900/30", border: "border-emerald-500", text: "text-emerald-400" },
  { bg: "bg-sky-900/30", border: "border-sky-500", text: "text-sky-400" },
] as const;

/**
 * Get team color by index (wraps around if more teams than colors)
 */
export function getTeamColor(index: number) {
  return TEAM_COLORS[index % TEAM_COLORS.length];
}

// ============================================
// POSITION COLORS
// ============================================

export const POSITION_COLORS = {
  QB: {
    bg: "bg-red-900/50",
    border: "border-red-500",
    text: "text-red-400",
    badge: "bg-red-600",
  },
  RB: {
    bg: "bg-green-900/50",
    border: "border-green-500",
    text: "text-green-400",
    badge: "bg-green-600",
  },
  WR: {
    bg: "bg-blue-900/50",
    border: "border-blue-500",
    text: "text-blue-400",
    badge: "bg-blue-600",
  },
  TE: {
    bg: "bg-orange-900/50",
    border: "border-orange-500",
    text: "text-orange-400",
    badge: "bg-orange-600",
  },
  K: {
    bg: "bg-purple-900/50",
    border: "border-purple-500",
    text: "text-purple-400",
    badge: "bg-purple-600",
  },
  DEF: {
    bg: "bg-yellow-900/50",
    border: "border-yellow-500",
    text: "text-yellow-400",
    badge: "bg-yellow-600",
  },
  DL: {
    bg: "bg-pink-900/50",
    border: "border-pink-500",
    text: "text-pink-400",
    badge: "bg-pink-600",
  },
  LB: {
    bg: "bg-indigo-900/50",
    border: "border-indigo-500",
    text: "text-indigo-400",
    badge: "bg-indigo-600",
  },
  DB: {
    bg: "bg-cyan-900/50",
    border: "border-cyan-500",
    text: "text-cyan-400",
    badge: "bg-cyan-600",
  },
} as const;

export type Position = keyof typeof POSITION_COLORS;

/**
 * Get position color (returns gray default if position not found)
 */
export function getPositionColor(position: string | null | undefined) {
  if (!position) {
    return {
      bg: "bg-gray-900/50",
      border: "border-gray-500",
      text: "text-gray-400",
      badge: "bg-gray-600",
    };
  }
  return POSITION_COLORS[position as Position] ?? {
    bg: "bg-gray-900/50",
    border: "border-gray-500",
    text: "text-gray-400",
    badge: "bg-gray-600",
  };
}

// ============================================
// STATUS COLORS
// ============================================

export const STATUS_COLORS = {
  success: {
    bg: "bg-green-900/30",
    border: "border-green-500",
    text: "text-green-400",
  },
  warning: {
    bg: "bg-yellow-900/30",
    border: "border-yellow-500",
    text: "text-yellow-400",
  },
  error: {
    bg: "bg-red-900/30",
    border: "border-red-500",
    text: "text-red-400",
  },
  info: {
    bg: "bg-blue-900/30",
    border: "border-blue-500",
    text: "text-blue-400",
  },
  neutral: {
    bg: "bg-gray-900/30",
    border: "border-gray-500",
    text: "text-gray-400",
  },
} as const;

// ============================================
// KEEPER TYPE COLORS
// ============================================

export const KEEPER_TYPE_COLORS = {
  FRANCHISE: {
    bg: "bg-amber-900/50",
    border: "border-amber-500",
    text: "text-amber-400",
    badge: "bg-amber-600",
  },
  REGULAR: {
    bg: "bg-blue-900/50",
    border: "border-blue-500",
    text: "text-blue-400",
    badge: "bg-blue-600",
  },
} as const;

// ============================================
// INJURY STATUS COLORS
// ============================================

export const INJURY_COLORS = {
  IR: { bg: "bg-red-600", text: "text-white" },
  Out: { bg: "bg-red-500", text: "text-white" },
  Doubtful: { bg: "bg-orange-500", text: "text-white" },
  Questionable: { bg: "bg-yellow-500", text: "text-black" },
  Probable: { bg: "bg-green-500", text: "text-white" },
  PUP: { bg: "bg-purple-500", text: "text-white" },
  Sus: { bg: "bg-gray-500", text: "text-white" },
} as const;

export function getInjuryColor(status: string | null | undefined) {
  if (!status) return null;
  return INJURY_COLORS[status as keyof typeof INJURY_COLORS] ?? null;
}
