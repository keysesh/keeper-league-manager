/**
 * Premium Icon Components
 * Custom SVG icons with built-in gradients, glows, and effects
 * These replace generic Lucide icons for a distinctive look
 */

interface IconProps {
  className?: string;
  size?: number;
}

// Unique gradient IDs to avoid conflicts
const gradientIds = {
  gold: "icon-grad-gold",
  goldDark: "icon-grad-gold-dark",
  emerald: "icon-grad-emerald",
  silver: "icon-grad-silver",
};

/**
 * Shared gradient definitions - include once in your app
 */
export function IconGradientDefs() {
  return (
    <svg width="0" height="0" className="absolute">
      <defs>
        {/* Championship Gold */}
        <linearGradient id={gradientIds.gold} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5c542" />
          <stop offset="50%" stopColor="#d4a012" />
          <stop offset="100%" stopColor="#a67c00" />
        </linearGradient>

        {/* Dark Gold for backgrounds */}
        <linearGradient id={gradientIds.goldDark} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(212,160,18,0.3)" />
          <stop offset="100%" stopColor="rgba(166,124,0,0.1)" />
        </linearGradient>

        {/* Emerald */}
        <linearGradient id={gradientIds.emerald} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>

        {/* Silver/Platinum */}
        <linearGradient id={gradientIds.silver} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e4e4e7" />
          <stop offset="50%" stopColor="#a1a1aa" />
          <stop offset="100%" stopColor="#71717a" />
        </linearGradient>

        {/* Glow filter */}
        <filter id="icon-glow-gold" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feFlood floodColor="#d4a012" floodOpacity="0.5" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

/**
 * Trophy Icon - Championship style with crown details
 */
export function TrophyIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Trophy cup body */}
      <path
        d="M8 2h8v2h3a1 1 0 011 1v3a4 4 0 01-4 4h-.5a5 5 0 01-4.5 4.5V19h3a1 1 0 011 1v2H7v-2a1 1 0 011-1h3v-2.5A5 5 0 016.5 12H6a4 4 0 01-4-4V5a1 1 0 011-1h3V2z"
        fill={`url(#${gradientIds.gold})`}
      />
      {/* Shine highlight */}
      <path
        d="M9 4h2v4H9V4z"
        fill="rgba(255,255,255,0.3)"
      />
      {/* Handle details */}
      <path
        d="M4 6h2v4a2 2 0 01-2-2V6zM18 6h2v2a2 2 0 01-2 2V6z"
        fill={`url(#${gradientIds.gold})`}
        opacity="0.8"
      />
    </svg>
  );
}

/**
 * Shield Icon - Keeper protection symbol
 */
export function ShieldIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Shield body */}
      <path
        d="M12 2L4 5v6c0 5.25 3.4 10.15 8 11.95 4.6-1.8 8-6.7 8-11.95V5l-8-3z"
        fill={`url(#${gradientIds.gold})`}
      />
      {/* Inner shield detail */}
      <path
        d="M12 4.5L6 7v4.5c0 4 2.5 7.5 6 9 3.5-1.5 6-5 6-9V7l-6-2.5z"
        fill="rgba(0,0,0,0.2)"
      />
      {/* Checkmark */}
      <path
        d="M10 12l2 2 4-4"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Crown Icon - Elite/Franchise indicator
 */
export function CrownIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Crown base */}
      <path
        d="M2 8l4 12h12l4-12-5 4-5-6-5 6-5-4z"
        fill={`url(#${gradientIds.gold})`}
      />
      {/* Crown band */}
      <rect x="6" y="18" width="12" height="2" rx="1" fill={`url(#${gradientIds.gold})`} opacity="0.9" />
      {/* Jewels */}
      <circle cx="12" cy="10" r="1.5" fill="#fff" opacity="0.9" />
      <circle cx="8" cy="12" r="1" fill="#fff" opacity="0.7" />
      <circle cx="16" cy="12" r="1" fill="#fff" opacity="0.7" />
      {/* Shine */}
      <path
        d="M7 9l1 8h1l-1-8H7z"
        fill="rgba(255,255,255,0.25)"
      />
    </svg>
  );
}

/**
 * Target Icon - Draft board / precision
 */
export function TargetIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Outer ring */}
      <circle cx="12" cy="12" r="10" stroke={`url(#${gradientIds.gold})`} strokeWidth="2" fill="none" />
      {/* Middle ring */}
      <circle cx="12" cy="12" r="6" stroke={`url(#${gradientIds.gold})`} strokeWidth="2" fill="none" opacity="0.7" />
      {/* Center dot */}
      <circle cx="12" cy="12" r="2" fill={`url(#${gradientIds.gold})`} />
      {/* Crosshairs */}
      <path
        d="M12 2v4M12 18v4M2 12h4M18 12h4"
        stroke={`url(#${gradientIds.gold})`}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

/**
 * Lightning Icon - Quick actions / trades
 */
export function LightningIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <path
        d="M13 2L4 14h7l-2 8 11-12h-7l2-8z"
        fill={`url(#${gradientIds.emerald})`}
      />
      {/* Shine */}
      <path
        d="M11 6l-4 8h4l-1 4 6-7h-4l1-5z"
        fill="rgba(255,255,255,0.2)"
      />
    </svg>
  );
}

/**
 * Chart Icon - Stats / trending
 */
export function ChartIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Bars */}
      <rect x="4" y="12" width="4" height="8" rx="1" fill={`url(#${gradientIds.emerald})`} opacity="0.6" />
      <rect x="10" y="8" width="4" height="12" rx="1" fill={`url(#${gradientIds.emerald})`} opacity="0.8" />
      <rect x="16" y="4" width="4" height="16" rx="1" fill={`url(#${gradientIds.emerald})`} />
      {/* Trend line */}
      <path
        d="M4 16l6-4 4 2 6-8"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
    </svg>
  );
}

/**
 * Users Icon - Teams
 */
export function UsersIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Back person */}
      <circle cx="17" cy="8" r="3" fill={`url(#${gradientIds.silver})`} opacity="0.6" />
      <path
        d="M22 19c0-3-2.5-5-5-5s-5 2-5 5"
        fill={`url(#${gradientIds.silver})`}
        opacity="0.6"
      />
      {/* Front person */}
      <circle cx="9" cy="7" r="4" fill={`url(#${gradientIds.silver})`} />
      <path
        d="M16 21c0-4-3-7-7-7s-7 3-7 7"
        fill={`url(#${gradientIds.silver})`}
      />
    </svg>
  );
}

/**
 * Sync Icon - Refresh with motion feel
 */
export function SyncIcon({ className = "", size = 24, spinning = false }: IconProps & { spinning?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`${className} ${spinning ? 'animate-spin' : ''}`}
    >
      {/* Arrows forming circle */}
      <path
        d="M4 12a8 8 0 018-8c3 0 5.5 1.5 7 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 12a8 8 0 01-8 8c-3 0-5.5-1.5-7-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Arrow heads */}
      <path
        d="M19 4v4h-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M5 20v-4h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * Star Icon - Filled star for franchise tags
 */
export function StarIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={`url(#${gradientIds.gold})`}
      />
      {/* Inner glow */}
      <path
        d="M12 5l2 4 4.5.6-3.25 3.2.75 4.5L12 15l-4 2.3.75-4.5L5.5 9.6 10 9l2-4z"
        fill="rgba(255,255,255,0.15)"
      />
    </svg>
  );
}

/**
 * Rank Badge Component - Medal style for standings
 */
export function RankBadge({ rank, className = "" }: { rank: number; className?: string }) {
  if (rank === 1) {
    return (
      <div className={`relative w-10 h-10 ${className}`}>
        <div className="absolute inset-0 bg-amber-400/30 rounded-xl blur-md" />
        <div className="relative w-full h-full rounded-xl bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/40">
          <CrownIcon size={20} />
        </div>
      </div>
    );
  }

  if (rank === 2) {
    return (
      <div className={`relative w-10 h-10 ${className}`}>
        <div className="absolute inset-0 bg-zinc-400/20 rounded-xl blur-md" />
        <div className="relative w-full h-full rounded-xl bg-gradient-to-br from-zinc-200 via-zinc-300 to-zinc-500 flex items-center justify-center shadow-lg">
          <span className="text-sm font-black text-zinc-700">2</span>
        </div>
      </div>
    );
  }

  if (rank === 3) {
    return (
      <div className={`relative w-10 h-10 ${className}`}>
        <div className="absolute inset-0 bg-orange-400/20 rounded-xl blur-md" />
        <div className="relative w-full h-full rounded-xl bg-gradient-to-br from-orange-300 via-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
          <span className="text-sm font-black text-orange-900">3</span>
        </div>
      </div>
    );
  }

  const isPlayoff = rank <= 6;
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
      isPlayoff
        ? "bg-emerald-500/15 border border-emerald-500/30"
        : "bg-zinc-800/80 border border-zinc-700/50"
    } ${className}`}>
      <span className={`text-sm font-bold ${isPlayoff ? "text-emerald-400" : "text-zinc-500"}`}>
        {rank}
      </span>
    </div>
  );
}

/**
 * Icon Button Container - Premium wrapper for icon buttons
 */
export function IconContainer({
  children,
  variant = "default",
  className = ""
}: {
  children: React.ReactNode;
  variant?: "gold" | "emerald" | "default";
  className?: string;
}) {
  const variants = {
    gold: "from-amber-400/20 to-amber-500/10 border-amber-400/30 shadow-amber-500/20",
    emerald: "from-emerald-400/20 to-emerald-500/10 border-emerald-400/30 shadow-emerald-500/20",
    default: "from-white/10 to-white/5 border-white/10 shadow-white/5",
  };

  return (
    <div className={`
      relative w-12 h-12 rounded-2xl
      bg-gradient-to-br ${variants[variant]}
      border shadow-lg
      flex items-center justify-center
      ${className}
    `}>
      {/* Inner glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent opacity-50" />
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
