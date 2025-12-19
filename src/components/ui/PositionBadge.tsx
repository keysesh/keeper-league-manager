import { getPositionColor } from "@/lib/constants/positions";

interface PositionBadgeProps {
  position: string | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "filled" | "outline" | "subtle";
  className?: string;
}

const sizeClasses = {
  xs: "text-[10px] px-1 py-0.5",
  sm: "text-xs px-1.5 py-0.5",
  md: "text-sm px-2 py-1",
  lg: "text-base px-3 py-1.5",
};

export function PositionBadge({
  position,
  size = "sm",
  variant = "filled",
  className = "",
}: PositionBadgeProps) {
  const colors = getPositionColor(position);
  const displayPosition = position?.toUpperCase() || "—";

  const variantClasses = {
    filled: `${colors.bg} text-white`,
    outline: `border ${colors.border} ${colors.text} bg-transparent`,
    subtle: `${colors.bgLight} ${colors.text}`,
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center font-semibold rounded
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
    xs: "text-[10px] px-1 py-0.5",
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center font-semibold rounded
        bg-yellow-500/20 text-yellow-500 border border-yellow-500/50
        ${sizeClasses[size]}
        ${className}
      `}
    >
      R
    </span>
  );
}
