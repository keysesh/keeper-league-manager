"use client";

interface AgeBadgeProps {
  age: number | null;
  yearsExp: number | null;
  position?: string | null;
  showExp?: boolean;
  size?: "xs" | "sm" | "md";
}

/**
 * Age tier thresholds by position
 * RB/WR peak earlier, QB/TE age better
 */
const POSITION_AGE_TIERS: Record<string, { prime: [number, number]; aging: number }> = {
  QB: { prime: [26, 34], aging: 36 },
  RB: { prime: [22, 27], aging: 29 },
  WR: { prime: [24, 30], aging: 31 },
  TE: { prime: [25, 31], aging: 32 },
  K: { prime: [25, 38], aging: 40 },
  DEF: { prime: [0, 99], aging: 99 }, // Team defense, no age
};

function getAgeTier(
  age: number,
  position: string | null
): "young" | "prime" | "aging" | "veteran" {
  const tiers = POSITION_AGE_TIERS[position || "WR"] || POSITION_AGE_TIERS.WR;

  if (age < tiers.prime[0]) return "young";
  if (age <= tiers.prime[1]) return "prime";
  if (age <= tiers.aging) return "aging";
  return "veteran";
}

const tierStyles = {
  young: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    label: "Rising",
  },
  prime: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/30",
    label: "Prime",
  },
  aging: {
    bg: "bg-orange-500/15",
    text: "text-orange-400",
    border: "border-orange-500/30",
    label: "Aging",
  },
  veteran: {
    bg: "bg-red-500/15",
    text: "text-red-400",
    border: "border-red-500/30",
    label: "Vet",
  },
};

const sizeClasses = {
  xs: "text-[9px] px-1 py-px",
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-xs px-2 py-1",
};

export function AgeBadge({
  age,
  yearsExp,
  position,
  showExp = true,
  size = "sm",
}: AgeBadgeProps) {
  if (age === null) return null;

  const tier = getAgeTier(age, position ?? null);
  const styles = tierStyles[tier];
  const isRookie = yearsExp === 0;

  return (
    <div className="flex items-center gap-1">
      {/* Age badge with tier color */}
      <span
        className={`
          inline-flex items-center font-semibold rounded border
          ${sizeClasses[size]}
          ${styles.bg} ${styles.text} ${styles.border}
        `}
        title={`${styles.label} - ${age} years old${position ? ` for ${position}` : ""}`}
      >
        {age}
      </span>

      {/* Experience indicator */}
      {showExp && yearsExp !== null && (
        <span
          className={`
            inline-flex items-center font-medium rounded
            ${sizeClasses[size]}
            ${isRookie
              ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
              : "bg-gray-800 text-gray-400"
            }
          `}
          title={isRookie ? "Rookie - First NFL season" : `${yearsExp} years NFL experience`}
        >
          {isRookie ? "R" : `${yearsExp}yr`}
        </span>
      )}
    </div>
  );
}

/**
 * Compact version for tight spaces - just shows age with color
 */
export function AgeIndicator({
  age,
  position,
  size = "xs",
}: {
  age: number | null;
  position?: string | null;
  size?: "xs" | "sm";
}) {
  if (age === null) return null;

  const tier = getAgeTier(age, position ?? null);
  const styles = tierStyles[tier];

  return (
    <span
      className={`
        inline-flex items-center justify-center font-bold rounded
        ${size === "xs" ? "text-[9px] w-5 h-4" : "text-[10px] w-6 h-5"}
        ${styles.bg} ${styles.text}
      `}
      title={`Age ${age} - ${styles.label}`}
    >
      {age}
    </span>
  );
}

/**
 * Get age tier info for custom usage
 */
export function getAgeInfo(age: number | null, position: string | null) {
  if (age === null) return null;

  const tier = getAgeTier(age, position);
  return {
    tier,
    ...tierStyles[tier],
  };
}
