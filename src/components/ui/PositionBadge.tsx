interface PositionBadgeProps {
  position: string | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "filled" | "outline" | "minimal";
  className?: string;
}

const sizeClasses = {
  xs: "text-[9px] px-1 py-px min-w-[18px]",
  sm: "text-[10px] px-1.5 py-0.5 min-w-[22px]",
  md: "text-xs px-2 py-0.5 min-w-[26px]",
  lg: "text-sm px-2.5 py-1 min-w-[32px]",
};

// Sophisticated muted colors - professional look
const positionStyles: Record<string, { bg: string; text: string; accent: string }> = {
  QB: { bg: "bg-rose-950/60", text: "text-rose-300", accent: "border-rose-700/50" },
  RB: { bg: "bg-emerald-950/60", text: "text-emerald-300", accent: "border-emerald-700/50" },
  WR: { bg: "bg-sky-950/60", text: "text-sky-300", accent: "border-sky-700/50" },
  TE: { bg: "bg-amber-950/60", text: "text-amber-300", accent: "border-amber-700/50" },
  K: { bg: "bg-violet-950/60", text: "text-violet-300", accent: "border-violet-700/50" },
  DEF: { bg: "bg-slate-800/60", text: "text-slate-300", accent: "border-slate-600/50" },
  default: { bg: "bg-gray-800/60", text: "text-gray-400", accent: "border-gray-600/50" },
};

export function PositionBadge({
  position,
  size = "sm",
  variant = "filled",
  className = "",
}: PositionBadgeProps) {
  const displayPosition = position?.toUpperCase() || "—";
  const styles = positionStyles[displayPosition] || positionStyles.default;

  const variantClasses = {
    filled: `${styles.bg} ${styles.text} border ${styles.accent}`,
    outline: `border ${styles.accent} ${styles.text} bg-transparent`,
    minimal: `${styles.text} bg-transparent`,
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center font-semibold rounded tracking-wider uppercase
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {displayPosition}
    </span>
  );
}

export function RookieBadge({
  size = "sm",
  className = "",
}: {
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const sizeClasses = {
    xs: "text-[9px] px-1 py-px",
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-0.5",
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center font-semibold rounded tracking-wider
        bg-amber-900/50 text-amber-300 border border-amber-700/50
        ${sizeClasses[size]}
        ${className}
      `}
    >
      R
    </span>
  );
}
