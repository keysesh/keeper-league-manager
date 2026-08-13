import { ReactNode } from "react";
import { cn } from "@/lib/design-tokens";

/**
 * Editorial screen primitives (design handoff Aug 2026).
 *
 * The five league screens are full-bleed hairline lists, not padded cards —
 * these pieces carry the measured values from the handoff so the screens
 * stay consistent: 20px row gutter, hairline rgba(214,255,232,.10),
 * 11px/.06em section labels, IBM Plex faces via the `.editorial` class.
 */

/**
 * Screen wrapper — undoes the dashboard layout's padding so rows can run
 * full-bleed on mobile, and caps width so desktop reads as a column rather
 * than a stretched phone screen. Carries the warm accent rule.
 */
export function EditorialScreen({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "editorial -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8 lg:max-w-[520px] lg:border-x lg:border-[rgba(214,255,232,.10)] min-h-[calc(100vh-3.5rem)]",
        className
      )}
    >
      <div className="editorial-rule" />
      {children}
    </div>
  );
}

/** Screen title block: 19/600 title, 11.5 tertiary sub-line, optional right slot. */
export function EditorialHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 pt-2 pb-4">
      <span>
        <span className="block text-[19px] leading-[1.2] font-semibold tracking-[-0.01em]">
          {title}
        </span>
        {sub && (
          <span className="block text-[11.5px] leading-none text-[#93a08f] mt-[7px]">
            {sub}
          </span>
        )}
      </span>
      {right}
    </div>
  );
}

/** Caps section label row (left) with optional mono column caption (right). */
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
    <>
      <div className={cn("flex items-baseline justify-between px-5 pb-2", className)}>
        <span className="text-[11px] leading-none font-medium text-[#93a08f] tracking-[0.06em]">
          {label}
        </span>
        {right && (
          <span className="font-plex-mono text-[11px] leading-none text-[#93a08f] whitespace-nowrap">
            {right}
          </span>
        )}
      </div>
      <Hairline top />
    </>
  );
}

/** 1px hairline — as a row's bottom border use the class instead. */
export function Hairline({ top }: { top?: boolean }) {
  return (
    <div
      className={top ? "border-t border-[rgba(214,255,232,.10)]" : "border-b border-[rgba(214,255,232,.10)]"}
    />
  );
}

/** Row-bottom hairline class, shared by every list row. */
export const rowHairline = "border-b border-[rgba(214,255,232,.10)]";

/** Footnote block that closes each screen. */
export function Footnote({ children }: { children: ReactNode }) {
  return (
    <div className="px-5 pt-4 pb-5 text-[11.5px] leading-[1.6] text-[#93a08f]">
      {children}
    </div>
  );
}

/** Raised card (summary block / warnings): #131b17 on hairline, radius 10. */
export function EditorialCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-4 bg-[#131b17] border border-[rgba(214,255,232,.10)] rounded-[10px] px-4 py-[15px]",
        className
      )}
    >
      {children}
    </div>
  );
}
