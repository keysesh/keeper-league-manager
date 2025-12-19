"use client";

import { useState } from "react";

interface PlayerAvatarProps {
  sleeperId: string;
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
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

export function PlayerAvatar({
  sleeperId,
  name,
  size = "md",
  className = "",
}: PlayerAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const dimension = sizes[size];

  if (hasError || !sleeperId) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-gray-700 flex items-center justify-center text-gray-400 font-medium ${className}`}
        title={name}
      >
        <span className={size === "xs" ? "text-xs" : size === "sm" ? "text-sm" : "text-base"}>
          {name?.charAt(0)?.toUpperCase() || "?"}
        </span>
      </div>
    );
  }

  return (
    <img
      src={`https://sleepercdn.com/content/nfl/players/thumb/${sleeperId}.jpg`}
      alt={name}
      width={dimension}
      height={dimension}
      className={`${sizeClasses[size]} rounded-full object-cover bg-gray-700 ${className}`}
      onError={() => setHasError(true)}
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
        <span className={size === "xs" ? "text-xs" : size === "sm" ? "text-sm" : "text-base"}>
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
    />
  );
}
