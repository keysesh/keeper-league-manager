"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { playerCutoutUrl, teamColors } from "@/lib/design/identity";

interface PlayerCutoutProps {
  sleeperId: string;
  name: string;
  /** Sleeper club abbreviation — decides the glow behind the cutout. */
  team?: string | null;
  size?: number;
  className?: string;
}

/**
 * A player's transparent-background headshot, standing on a disc of his club's
 * colour.
 *
 * Deliberately NOT PlayerAvatar: that renders the `thumb/` crop, a circle on a
 * solid plate, which cannot sit on a team wash without showing its own
 * background as a visible square. This uses the full cutout and lets the row
 * behind it show through.
 *
 * Falls back to the initial rather than a broken image — every defense in the
 * league is a "player" with no headshot at all, so the empty case is common,
 * not exceptional.
 */
export function PlayerCutout({
  sleeperId,
  name,
  team,
  size = 46,
  className = "",
}: PlayerCutoutProps) {
  const [failed, setFailed] = useState(false);
  const { primary } = teamColors(team);

  // A row can be reused for a different player as the list re-sorts.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => setFailed(false), [sleeperId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <span
      className={`relative inline-flex shrink-0 items-end justify-center overflow-hidden rounded-xl ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 78%, ${primary}59, transparent 68%)`,
      }}
    >
      {failed || !sleeperId ? (
        <span
          className="flex h-full w-full items-center justify-center font-semibold text-slate-300"
          style={{ fontSize: size * 0.36 }}
        >
          {name?.charAt(0)?.toUpperCase() || "?"}
        </span>
      ) : (
        // next/image, not <img>: a keeper list is a column of these on a
        // phone, and sleepercdn serves full-size headshots. Routing them
        // through the optimiser (sleepercdn is already in remotePatterns)
        // gets AVIF at the size actually rendered.
        <Image
          src={playerCutoutUrl(sleeperId)}
          alt=""
          aria-hidden="true"
          width={size * 2}
          height={size * 2}
          loading="lazy"
          unoptimized={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain object-bottom"
          style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.45))" }}
        />
      )}
    </span>
  );
}
