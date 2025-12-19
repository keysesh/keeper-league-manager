import { getPositionColor } from "@/lib/constants/positions";

interface PositionBadgeProps {
  position: string | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "filled" | "outline" | "subtle";
  className?: string;
}

const sizeClasses = {
  xs: "text-[10px] px-1.5 py-0.5 min-w-[24px]",
  sm: "text-xs px-2 py-0.5 min-w-[28px]",
  md: "text-sm px-2.5 py-1 min-w-[32px]",
  lg: "text-base px-3 py-1.5 min-w-[40px]",
};

// Premium position colors with gradients
const positionStyles: Record<string, { bg: string; text: string; border: string }> = {
  QB: { bg: "bg-gradient-to-r from-red-600 to-red-500", text: "text-red-400", border: "border-red-500/50" },
  RB: { bg: "bg-gradient-to-r from-green-600 to-green-500", text: "text-green-400", border: "border-green-500/50" },
  WR: { bg: "bg-gradient-to-r from-blue-600 to-blue-500", text: "text-blue-400", border: "border-blue-500/50" },
  TE: { bg: "bg-gradient-to-r from-orange-600 to-orange-500", text: "text-orange-400", border: "border-orange-500/50" },
  K: { bg: "bg-gradient-to-r from-purple-600 to-purple-500", text: "text-purple-400", border: "border-purple-500/50" },
  DEF: { bg: "bg-gradient-to-r from-gray-600 to-gray-500", text: "text-gray-400", border: "border-gray-500/50" },
  default: { bg: "bg-gradient-to-r from-gray-700 to-gray-600", text: "text-gray-400", border: "border-gray-600/50" },
};

export function PositionBadge({
  position,
  size = "sm",
  variant = "filled",
  className = "",
}: PositionBadgeProps) {
  const colors = getPositionColor(position);
  const displayPosition = position?.toUpperCase() || "—";
  const premiumStyles = positionStyles[displayPosition] || positionStyles.default;

  const variantClasses = {
    filled: `${premiumStyles.bg} text-white shadow-sm`,
    outline: `border-2 ${premiumStyles.border} ${premiumStyles.text} bg-transparent`,
    subtle: `${colors.bgLight} ${premiumStyles.text}`,
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center font-bold rounded-md tracking-wide
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
    xs: "text-[10px] px-1.5 py-0.5",
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center font-bold rounded-md
        bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-sm
        ${sizeClasses[size]}
        ${className}
      `}
    >
      R
    </span>
  );
}
