/**
 * Design Tokens for Keeper League Manager
 * Centralized styling constants for consistent UI
 */

export const card = {
  base: "bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg",
  hover: "hover:border-[#3a3a3a] transition-colors",
  padding: "p-4 sm:p-5",
  // Combined classes for common patterns
  default: "bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 sm:p-5",
  interactive: "bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 sm:p-5 hover:border-[#3a3a3a] transition-colors",
  header: "px-4 sm:px-5 py-4 border-b border-[#2a2a2a]",
} as const;

export const colors = {
  // Background colors
  bg: {
    primary: "#0F0B1A",
    secondary: "#0d0d0d",
    card: "#1a1a1a",
    elevated: "#222222",
    hover: "#2a2a2a",
  },
  // Border colors
  border: {
    default: "#2a2a2a",
    hover: "#3a3a3a",
    subtle: "#1a1a1a",
  },
  // Text colors
  text: {
    primary: "#ffffff",
    secondary: "#a0a0a0",
    muted: "#666666",
    inverse: "#000000",
  },
  // Accent colors
  accent: {
    blue: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      text: "text-blue-400",
    },
    emerald: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      text: "text-emerald-400",
    },
    yellow: {
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
      text: "text-yellow-400",
    },
    purple: {
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
      text: "text-purple-400",
    },
    orange: {
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      text: "text-orange-400",
    },
    red: {
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      text: "text-red-400",
    },
  },
} as const;

export const button = {
  base: "inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2",
  sizes: {
    sm: "text-sm px-3 py-1.5 rounded-md",
    md: "text-sm px-4 py-2 rounded-lg",
    lg: "text-base px-5 py-2.5 rounded-lg",
  },
  variants: {
    primary: "bg-blue-600 text-white hover:bg-blue-500 focus-visible:ring-blue-500/50",
    secondary: "bg-[#2a2a2a] text-white hover:bg-[#333] focus-visible:ring-gray-500/50",
    ghost: "text-gray-400 hover:text-white hover:bg-[#2a2a2a] focus-visible:ring-gray-500/50",
    danger: "bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-500/50",
  },
} as const;

export const input = {
  base: "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all",
  error: "border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50",
} as const;

export const badge = {
  base: "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
  variants: {
    blue: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
    emerald: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    yellow: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
    red: "bg-red-500/20 text-red-400 border border-red-500/30",
    gray: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
  },
} as const;

export const section = {
  header: {
    base: "flex items-center gap-3",
    icon: "w-10 h-10 rounded-md flex items-center justify-center",
    title: "text-base font-semibold text-white",
    subtitle: "text-sm text-gray-500",
  },
} as const;

export const animation = {
  fadeIn: "animate-in fade-in duration-200",
  slideIn: "animate-in slide-in-from-bottom-2 duration-200",
  zoomIn: "animate-in zoom-in-95 duration-200",
} as const;

// Utility function to combine classes conditionally
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
