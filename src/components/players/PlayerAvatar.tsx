"use client";

import { useState, useCallback, useEffect } from "react";

interface PlayerAvatarProps {
  sleeperId: string;
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  // NFLverse data (optional - for enhanced headshots)
  nflverseHeadshot?: string | null;
  gsisId?: string | null;
  espnId?: string | null;
}

const sizes = {
  xs: 24,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

const sizeClasses = {
  xs: "w-6 h-6",
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
  xl: "w-24 h-24",
};

/**
 * Build array of image sources in fallback order:
 * 1. NFLverse headshot_url (highest quality)
 * 2. NFL.com via GSIS ID
 * 3. ESPN via ESPN ID
 * 4. Sleeper CDN (current fallback)
 */
function getImageSources(props: PlayerAvatarProps): string[] {
  const sources: string[] = [];

  // 1. NFLverse direct headshot URL (highest quality)
  if (props.nflverseHeadshot) {
    sources.push(props.nflverseHeadshot);
  }

  // 2. NFL.com via GSIS ID
  if (props.gsisId) {
    sources.push(
      `https://static.www.nfl.com/image/upload/t_headshot_desktop/league/${props.gsisId}`
    );
  }

  // 3. ESPN via ESPN ID
  if (props.espnId) {
    sources.push(
      `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${props.espnId}.png`
    );
  }

  // 4. Sleeper CDN (always available if we have sleeperId)
  if (props.sleeperId) {
    sources.push(
      `https://sleepercdn.com/content/nfl/players/thumb/${props.sleeperId}.jpg`
    );
  }

  return sources;
}

export function PlayerAvatar({
  sleeperId,
  name,
  size = "md",
  className = "",
  nflverseHeadshot,
  gsisId,
  espnId,
}: PlayerAvatarProps) {
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  const sources = getImageSources({
    sleeperId,
    name,
    nflverseHeadshot,
    gsisId,
    espnId,
  });

  const dimension = sizes[size];

  // Reset source index when props change - intentional derived state reset
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setCurrentSourceIndex(0);
    setAllFailed(false);
  }, [sleeperId, nflverseHeadshot, gsisId, espnId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleError = useCallback(() => {
    if (currentSourceIndex < sources.length - 1) {
      // Try next source
      setCurrentSourceIndex((prev) => prev + 1);
    } else {
      // All sources failed
      setAllFailed(true);
    }
  }, [currentSourceIndex, sources.length]);

  // Show initials fallback if all sources failed or no sources available
  if (allFailed || sources.length === 0 || !sleeperId) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-gray-700 flex items-center justify-center text-gray-400 font-medium ${className}`}
        title={name}
      >
        <span
          className={
            size === "xs" ? "text-xs" : size === "sm" ? "text-sm" : "text-base"
          }
        >
          {name?.charAt(0)?.toUpperCase() || "?"}
        </span>
      </div>
    );
  }

  return (
    <img
      src={sources[currentSourceIndex]}
      alt={name}
      width={dimension}
      height={dimension}
      className={`${sizeClasses[size]} rounded-full object-cover bg-gray-700 ${className}`}
      onError={handleError}
      loading="lazy"
    />
  );
}

export function TeamLogo({
  team,
  size = "md",
  className = "",
}: {
  team: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !team) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-gray-700 flex items-center justify-center text-gray-400 font-medium ${className}`}
      >
        <span
          className={
            size === "xs" ? "text-xs" : size === "sm" ? "text-sm" : "text-base"
          }
        >
          {team?.charAt(0)?.toUpperCase() || "?"}
        </span>
      </div>
    );
  }

  return (
    <img
      src={`https://sleepercdn.com/images/team_logos/nfl/${team.toLowerCase()}.png`}
      alt={team}
      width={sizes[size]}
      height={sizes[size]}
      className={`${sizeClasses[size]} object-contain ${className}`}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}
