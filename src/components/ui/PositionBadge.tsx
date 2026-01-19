import { cn } from "@/lib/design-tokens";

interface PositionBadgeProps {
  position: string | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "filled" | "outline" | "minimal" | "glow";
  className?: string;
}

const sizeClasses = {
  xs: "text-[9px] px-1 py-px min-w-[18px]",
  sm: "text-[10px] px-1.5 py-0.5 min-w-[22px]",
  md: "text-xs px-2 py-0.5 min-w-[26px]",
  lg: "text-sm px-2.5 py-1 min-w-[32px]",
};

// Premium position colors - deep, rich tones
const positionStyles: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  QB: {
    bg: "bg-red-500/15",
    text: "text-red-400",
    border: "border-red-500/25",
    glow: "shadow-[0_0_12px_rgba(239,68,68,0.3)]",
  },
  RB: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    border: "border-emerald-500/25",
    glow: "shadow-[0_0_12px_rgba(16,185,129,0.3)]",
  },
  WR: {
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    border: "border-blue-500/25",
    glow: "shadow-[0_0_12px_rgba(59,130,246,0.3)]",
  },
  TE: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/25",
    glow: "shadow-[0_0_12px_rgba(245,158,11,0.3)]",
  },
  K: {
    bg: "bg-purple-500/15",
    text: "text-purple-400",
    border: "border-purple-500/25",
    glow: "shadow-[0_0_12px_rgba(139,92,246,0.3)]",
  },
  DEF: {
    bg: "bg-slate-500/15",
    text: "text-slate-400",
    border: "border-slate-500/25",
    glow: "shadow-[0_0_12px_rgba(100,116,139,0.3)]",
  },
  DST: {
    bg: "bg-slate-500/15",
    text: "text-slate-400",
    border: "border-slate-500/25",
    glow: "shadow-[0_0_12px_rgba(100,116,139,0.3)]",
  },
  default: {
    bg: "bg-slate-500/10",
    text: "text-slate-500",
    border: "border-slate-500/20",
    glow: "",
  },
};

export function PositionBadge({
  position,
  size = "sm",
  variant = "filled",
  className = "",
}: PositionBadgeProps) {
  const displayPosition = position?.toUpperCase() || "";
  const styles = positionStyles[displayPosition] || positionStyles.default;

  const variantClasses = {
    filled: cn(styles.bg, styles.text, "border", styles.border),
    outline: cn("border", styles.border, styles.text, "bg-transparent"),
    minimal: cn(styles.text, "bg-transparent"),
    glow: cn(styles.bg, styles.text, "border", styles.border, styles.glow),
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-semibold rounded tracking-wider uppercase transition-all",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      {displayPosition}
    </span>
  );
}

interface RookieBadgeProps {
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function RookieBadge({ size = "sm", className = "" }: RookieBadgeProps) {
  const sizeMappings = {
    xs: "text-[9px] px-1 py-px",
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-0.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-semibold rounded tracking-wider",
        "bg-amber-500/15 text-amber-400 border border-amber-500/25",
        sizeMappings[size],
        className
      )}
    >
      R
    </span>
  );
}

interface FranchiseBadgeProps {
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function FranchiseBadge({ size = "sm", className = "" }: FranchiseBadgeProps) {
  const sizeMappings = {
    xs: "text-[9px] px-1 py-px gap-0.5",
    sm: "text-[10px] px-1.5 py-0.5 gap-1",
    md: "text-xs px-2 py-0.5 gap-1",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-semibold rounded tracking-wider",
        "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border border-amber-500/30",
        sizeMappings[size],
        className
      )}
    >
      <span className="text-amber-300">&#9733;</span>
      FRANCHISE
    </span>
  );
}

interface KeeperBadgeProps {
  round?: number;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function KeeperBadge({ round, size = "sm", className = "" }: KeeperBadgeProps) {
  const sizeMappings = {
    xs: "text-[9px] px-1 py-px",
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-0.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-semibold rounded tracking-wider",
        "bg-blue-500/15 text-blue-400 border border-blue-500/25",
        sizeMappings[size],
        className
      )}
    >
      {round ? `R${round}` : "KEEPER"}
    </span>
  );
}
