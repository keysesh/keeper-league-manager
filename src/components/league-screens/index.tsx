import { ReactNode } from "react";
import { cn } from "@/lib/design-tokens";

/**
 * Shared shell pieces for the five league screens (value-screens handoff).
 * Everything here is an application of the existing token system: 4-layer
 * surfaces, top-lit bevel borders, Geist/Geist-Mono, 44px hit targets.
 */

/** 22px/600 screen title with 12.5px subtitle and a 44px icon action right. */
export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between px-1 mb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.025em] text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[12.5px] text-slate-500 mt-1.5">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

/** 44px icon button, glyph optically at the edge. */
export function HeaderIconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex items-center justify-center w-11 h-11 -mt-2 -mr-3 rounded-lg text-slate-400 hover:text-white hover:bg-[#1c2840] transition-colors duration-150"
    >
      {children}
    </button>
  );
}

/** Uppercase section label with optional mono column caption on the right. */
export function SectionLabel({
  label,
  right,
  className,
}: {
  label: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between px-1 mb-2", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </span>
      {right && (
        <span className="font-mono text-[10.5px] font-medium text-slate-600 whitespace-nowrap">
          {right}
        </span>
      )}
    </div>
  );
}

/** The top-lit bevel list card; rows divide with white/[0.06]. */
export const listCard =
  "bg-[#0c1219] border border-white/[0.08] border-t-white/[0.12] rounded-xl overflow-hidden divide-y divide-white/[0.06]";

/** Feature-card glow recipe: pass the tint via inline style (gradient + shadow). */
export const featureCard =
  "relative rounded-2xl border border-white/[0.12] border-t-white/[0.18] p-4";

/** Label/track/value meter row used by the keeper-pressure card. */
export function MeterRow({
  label,
  percent,
  gradient,
  value,
}: {
  label: string;
  percent: number;
  gradient: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-[11px] font-medium text-slate-400">{label}</span>
      <div className="flex-1 h-1.5 rounded-[3px] bg-[#080d14] overflow-hidden">
        <div
          className="h-full rounded-[3px]"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: gradient }}
        />
      </div>
      <span className="w-8 shrink-0 text-right font-mono text-[11px] font-semibold text-slate-50">
        {value}
      </span>
    </div>
  );
}

/**
 * The waiting state for a league screen — the screen's own chrome, drawn
 * empty.
 *
 * Route-level loading.tsx and the client screen's own loading branch both
 * render this, and that is the point. They used to be different pictures: a
 * pre-redesign grid of light-grey cards for the route, then the real screen's
 * dark skeleton once the component mounted, so a tab switch showed two
 * unrelated animations in a row and read as a stall. One shape, held from tap
 * to paint, reads as the screen arriving.
 */
export function ScreenSkeleton({
  hero = false,
  tiles = 0,
  rows = 6,
  className,
}: {
  /** A tall feature card above the list — the keeper and team screens. */
  hero?: boolean;
  /** Summary tiles across the top, two per row. */
  tiles?: number;
  /** Rows in the list card below. */
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("max-w-2xl space-y-4 animate-pulse", className)}
      aria-hidden
    >
      <div className="px-1 mb-4 space-y-2">
        <div className="h-[22px] w-40 rounded-md bg-white/[0.07]" />
        <div className="h-[13px] w-56 rounded bg-white/[0.04]" />
      </div>

      {hero && (
        <div className={cn(featureCard, "h-36 bg-white/[0.035]")} />
      )}

      {tiles > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          {Array.from({ length: tiles }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl border border-white/[0.08] border-t-white/[0.12] bg-white/[0.035]"
            />
          ))}
        </div>
      )}

      {rows > 0 && (
        <div className={listCard}>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-[52px]" />
          ))}
        </div>
      )}
    </div>
  );
}
