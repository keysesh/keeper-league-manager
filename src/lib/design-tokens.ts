/**
 * Design Tokens for Keeper League Manager
 * Premium Sports Analytics Platform
 * Deep navy aesthetic with electric accents
 */

// ============================================
// COLOR SYSTEM
// ============================================

export const colors = {
  // Background colors - Deep Navy System
  bg: {
    app: "#080c14",              // Deepest - app shell
    surface: "#0d1420",          // Cards, surfaces
    elevated: "#131a28",         // Modals, dropdowns
    interactive: "#1a2435",      // Hover states
    selected: "#243044",         // Selected/active
  },

  // Border colors
  border: {
    subtle: "rgba(255, 255, 255, 0.06)",
    default: "rgba(255, 255, 255, 0.1)",
    strong: "rgba(255, 255, 255, 0.15)",
  },

  // Text hierarchy
  text: {
    primary: "#f8fafc",          // Headlines, important
    secondary: "#cbd5e1",        // Body text
    tertiary: "#64748b",         // Labels, captions
    muted: "#475569",            // Disabled, hints
  },

  // Accent colors
  accent: {
    primary: "#3b82f6",
    primaryHover: "#60a5fa",
    primarySubtle: "rgba(59, 130, 246, 0.15)",
  },

  // Semantic colors
  semantic: {
    positive: "#10b981",         // Wins, gains, success
    negative: "#ef4444",         // Losses, drops, errors
    warning: "#f59e0b",          // Caution, pending
    info: "#3b82f6",             // Neutral info
  },

  // Position colors (Fantasy Football)
  position: {
    qb: "#ef4444",               // Red
    rb: "#10b981",               // Emerald
    wr: "#3b82f6",               // Blue
    te: "#f59e0b",               // Amber
    k: "#8b5cf6",                // Purple
    def: "#64748b",              // Slate
  },

  // Grade colors for power rankings
  grade: {
    "A+": { from: "#fbbf24", to: "#d97706" },  // Amber
    "A":  { from: "#34d399", to: "#059669" },  // Emerald
    "A-": { from: "#34d399", to: "#059669" },
    "B+": { from: "#60a5fa", to: "#2563eb" },  // Blue
    "B":  { from: "#60a5fa", to: "#2563eb" },
    "B-": { from: "#60a5fa", to: "#2563eb" },
    "C+": { from: "#94a3b8", to: "#475569" },  // Slate
    "C":  { from: "#94a3b8", to: "#475569" },
    "C-": { from: "#94a3b8", to: "#475569" },
    "D":  { from: "#fb923c", to: "#ea580c" },  // Orange
    "F":  { from: "#f87171", to: "#dc2626" },  // Rose
  },
} as const;

// ============================================
// GRADIENTS
// ============================================

export const gradients = {
  primary: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
  warm: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
  cool: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
  success: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
} as const;

// ============================================
// SPACING
// ============================================

export const spacing = {
  1: "0.25rem",   // 4px
  2: "0.5rem",    // 8px
  3: "0.75rem",   // 12px
  4: "1rem",      // 16px
  5: "1.25rem",   // 20px
  6: "1.5rem",    // 24px
  8: "2rem",      // 32px
  10: "2.5rem",   // 40px
  12: "3rem",     // 48px
} as const;

// ============================================
// BORDER RADIUS
// ============================================

export const radius = {
  sm: "0.375rem",   // 6px - Buttons, badges
  md: "0.5rem",     // 8px - Cards
  lg: "0.75rem",    // 12px - Modals
  xl: "1rem",       // 16px - Large cards
  full: "9999px",   // Pills
} as const;

// ============================================
// SHADOWS
// ============================================

export const shadows = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.3)",
  md: "0 4px 12px rgba(0, 0, 0, 0.4)",
  lg: "0 8px 24px rgba(0, 0, 0, 0.5)",
  glow: "0 0 20px rgba(59, 130, 246, 0.15)",
  glowStrong: "0 0 30px rgba(59, 130, 246, 0.25)",
} as const;

// ============================================
// ANIMATION
// ============================================

export const animation = {
  duration: {
    fast: "150ms",
    normal: "200ms",
    slow: "300ms",
    slower: "500ms",
  },
  easing: {
    out: "cubic-bezier(0, 0, 0.2, 1)",
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  // Tailwind animation classes
  fadeIn: "animate-fade-in",
  fadeInUp: "animate-fade-in-up",
  slideUp: "animate-slide-up",
  slideDown: "animate-slide-down",
  scaleIn: "animate-scale-in",
} as const;

// ============================================
// CARD STYLES
// ============================================

export const card = {
  base: "bg-[#0d1420] border border-white/[0.06] rounded-xl",
  elevated: "bg-[#131a28] border border-white/[0.08] rounded-xl shadow-lg",
  interactive: "bg-[#0d1420] border border-white/[0.06] rounded-xl hover:bg-[#131a28] hover:border-white/[0.1] transition-all duration-150 cursor-pointer",
  gradient: "relative rounded-xl overflow-hidden border border-white/[0.1]",
  feature: "relative bg-[#0d1420]/80 backdrop-blur-xl border border-white/[0.1] rounded-2xl",
  padding: {
    sm: "p-3",
    md: "p-4 sm:p-5",
    lg: "p-5 sm:p-6",
  },
  header: "px-4 sm:px-5 py-4 border-b border-white/[0.06]",
  // Combined classes for common patterns
  default: "bg-[#0d1420] border border-white/[0.06] rounded-xl p-4 sm:p-5",
} as const;

// ============================================
// BUTTON STYLES
// ============================================

export const button = {
  base: "inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 active:scale-[0.98]",
  sizes: {
    xs: "text-xs px-2.5 py-1.5 rounded-md gap-1.5",
    sm: "text-sm px-3 py-1.5 rounded-md gap-2",
    md: "text-sm px-4 py-2 rounded-lg gap-2",
    lg: "text-base px-5 py-2.5 rounded-lg gap-2.5",
  },
  variants: {
    primary: "bg-blue-600 text-white hover:bg-blue-500 focus-visible:ring-blue-500/50 shadow-lg shadow-blue-500/25",
    secondary: "bg-[#1a2435] text-slate-200 hover:bg-[#243044] focus-visible:ring-slate-500/50 border border-white/[0.06]",
    ghost: "text-slate-400 hover:text-white hover:bg-[#1a2435] focus-visible:ring-slate-500/50",
    danger: "bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-500/50",
    outline: "border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 focus-visible:ring-blue-500/50",
    gradient: "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-500 hover:to-purple-500 shadow-lg",
  },
} as const;

// ============================================
// INPUT STYLES
// ============================================

export const input = {
  base: "w-full bg-[#0d1420] border border-white/[0.1] rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all",
  error: "border-red-500/50 focus:ring-red-500/30 focus:border-red-500/50",
  sizes: {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2.5",
    lg: "px-4 py-3 text-lg",
  },
} as const;

// ============================================
// BADGE STYLES
// ============================================

export const badge = {
  base: "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
  variants: {
    blue: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
    emerald: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
    amber: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
    red: "bg-red-500/15 text-red-400 border border-red-500/20",
    purple: "bg-purple-500/15 text-purple-400 border border-purple-500/20",
    slate: "bg-slate-500/15 text-slate-400 border border-slate-500/20",
  },
  // Position badges
  position: {
    qb: "bg-red-500/15 text-red-400 border border-red-500/20",
    rb: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
    wr: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
    te: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
    k: "bg-purple-500/15 text-purple-400 border border-purple-500/20",
    def: "bg-slate-500/15 text-slate-400 border border-slate-500/20",
  },
} as const;

// ============================================
// SECTION STYLES
// ============================================

export const section = {
  header: {
    base: "flex items-center justify-between gap-3 mb-4",
    title: "text-lg font-semibold text-white",
    subtitle: "text-sm text-slate-500",
    icon: "w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br",
  },
  // Section dividers
  divider: "border-t border-white/[0.06] my-6",
} as const;

// ============================================
// NAV STYLES
// ============================================

export const nav = {
  item: {
    base: "flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 transition-all duration-150",
    hover: "hover:text-slate-200 hover:bg-[#1a2435]",
    active: "text-white bg-[#243044] border-l-2 border-blue-500",
  },
  sectionHeader: "text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 pt-4 pb-2",
  // Mobile bottom nav
  bottomNav: {
    container: "fixed bottom-0 inset-x-0 bg-[#0d1420] border-t border-white/[0.06] z-50",
    item: "flex flex-col items-center justify-center py-2 px-1 text-slate-500 transition-colors min-w-[64px]",
    itemActive: "text-blue-500",
    label: "text-[10px] mt-1",
  },
} as const;

// ============================================
// STAT DISPLAY STYLES
// ============================================

export const stat = {
  big: {
    value: "text-4xl font-bold tracking-tight",
    label: "text-sm text-slate-400 mt-1",
    trend: "text-xs font-medium mt-2",
    trendUp: "text-emerald-400",
    trendDown: "text-red-400",
  },
  compact: {
    value: "text-2xl font-bold",
    label: "text-xs text-slate-500",
  },
} as const;

// ============================================
// TABLE STYLES
// ============================================

export const table = {
  container: "overflow-x-auto",
  base: "w-full",
  header: {
    row: "border-b border-white/[0.06]",
    cell: "px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider",
  },
  body: {
    row: "border-b border-white/[0.06] hover:bg-[#131a28] transition-colors",
    cell: "px-4 py-4 text-sm",
  },
} as const;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Combine classes conditionally
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Get position color classes
 */
export function getPositionClasses(position: string) {
  const pos = position?.toUpperCase() || "";
  const positionMap: Record<string, { bg: string; text: string; border: string }> = {
    QB: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/20" },
    RB: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/20" },
    WR: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/20" },
    TE: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/20" },
    K: { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/20" },
    DEF: { bg: "bg-slate-500/15", text: "text-slate-400", border: "border-slate-500/20" },
    DST: { bg: "bg-slate-500/15", text: "text-slate-400", border: "border-slate-500/20" },
  };
  return positionMap[pos] || positionMap.DEF;
}

/**
 * Get grade gradient classes
 */
export function getGradeGradient(grade: string): string {
  const gradeMap: Record<string, string> = {
    "A+": "from-amber-400 to-amber-600",
    "A": "from-emerald-400 to-emerald-600",
    "A-": "from-emerald-400 to-emerald-600",
    "B+": "from-blue-400 to-blue-600",
    "B": "from-blue-400 to-blue-600",
    "B-": "from-blue-400 to-blue-600",
    "C+": "from-slate-400 to-slate-600",
    "C": "from-slate-400 to-slate-600",
    "C-": "from-slate-400 to-slate-600",
    "D": "from-orange-400 to-orange-600",
    "F": "from-rose-400 to-rose-600",
  };
  return gradeMap[grade] || gradeMap.C;
}

/**
 * Format number with trend indicator
 */
export function formatTrend(value: number): { display: string; className: string } {
  if (value > 0) {
    return { display: `+${value}`, className: "text-emerald-400" };
  } else if (value < 0) {
    return { display: `${value}`, className: "text-red-400" };
  }
  return { display: "0", className: "text-slate-500" };
}
