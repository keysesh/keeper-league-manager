"use client";

import { cn } from "@/lib/design-tokens";

/**
 * Player headshot with the handoff's required failure behavior: on error the
 * image hides itself, leaving the #1c2621 placeholder — not every player has
 * a CDN image.
 */
export function Headshot({
  sleeperId,
  size = 36,
  alt = "",
  className,
}: {
  sleeperId: string | null | undefined;
  size?: 32 | 36;
  alt?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-md shrink-0 overflow-hidden bg-[#1c2621]",
        size === 36 ? "w-9 h-9" : "w-8 h-8",
        className
      )}
    >
      {sleeperId && (
        // eslint-disable-next-line @next/next/no-img-element -- CDN headshots at fixed 32/36px; next/image adds nothing but a proxy hop here
        <img
          src={`https://sleepercdn.com/content/nfl/players/${sleeperId}.jpg`}
          alt={alt}
          width={size}
          height={size}
          className="block w-full h-full object-cover object-top"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
    </span>
  );
}
