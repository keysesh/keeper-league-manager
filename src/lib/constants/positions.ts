export const POSITION_COLORS = {
  QB: {
    bg: "bg-red-500",
    bgLight: "bg-red-500/20",
    text: "text-red-500",
    border: "border-red-500",
    hex: "#ef4444",
  },
  RB: {
    bg: "bg-green-500",
    bgLight: "bg-green-500/20",
    text: "text-green-500",
    border: "border-green-500",
    hex: "#22c55e",
  },
  WR: {
    bg: "bg-blue-500",
    bgLight: "bg-blue-500/20",
    text: "text-blue-500",
    border: "border-blue-500",
    hex: "#3b82f6",
  },
  TE: {
    bg: "bg-orange-500",
    bgLight: "bg-orange-500/20",
    text: "text-orange-500",
    border: "border-orange-500",
    hex: "#f97316",
  },
  K: {
    bg: "bg-purple-500",
    bgLight: "bg-purple-500/20",
    text: "text-purple-500",
    border: "border-purple-500",
    hex: "#a855f7",
  },
  DEF: {
    bg: "bg-gray-500",
    bgLight: "bg-gray-500/20",
    text: "text-gray-500",
    border: "border-gray-500",
    hex: "#6b7280",
  },
} as const;

export type Position = keyof typeof POSITION_COLORS;

export function getPositionColor(position: string | null | undefined) {
  if (!position) return POSITION_COLORS.DEF;
  const pos = position.toUpperCase() as Position;
  return POSITION_COLORS[pos] || POSITION_COLORS.DEF;
}

export const FANTASY_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
export const SKILL_POSITIONS = ["QB", "RB", "WR", "TE"] as const;
