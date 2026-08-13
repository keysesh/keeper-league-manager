"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  EditorialScreen,
  EditorialHeader,
  SectionLabel,
  Footnote,
  rowHairline,
} from "@/components/editorial";
import { Headshot } from "@/components/editorial/Headshot";
import { cn } from "@/lib/design-tokens";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  });

interface Roster {
  id: string;
  teamName: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  isUserRoster: boolean;
  keeperCount: number;
}

interface League {
  id: string;
  name: string;
  season: number;
  status: string;
  totalRosters: number;
  lastSyncedAt: string | null;
  rosters: Roster[];
}

interface ScoringLeader {
  playerId: string;
  sleeperId: string;
  fullName: string;
  position: string | null;
  team: string | null;
  pointsPerGame: number | null;
  ownerTeamName: string | null;
  rosterId: string;
}

// The league's first Sleeper season — drives the "sixth season" style
// sub-line. 2023 is where the synced history chain starts.
const FIRST_SLEEPER_SEASON = 2023;
const ORDINALS = [
  "first", "second", "third", "fourth", "fifth", "sixth", "seventh",
  "eighth", "ninth", "tenth",
];

function seasonOrdinal(season: number): string {
  const n = season - FIRST_SLEEPER_SEASON + 1;
  return ORDINALS[n - 1] || `${n}th`;
}

export default function LeaguePage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const { data: league, error, isLoading } = useSWR<League>(
    `/api/leagues/${leagueId}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );
  const { data: leaders } = useSWR<{ leaders: ScoringLeader[] }>(
    `/api/leagues/${leagueId}/scoring-leaders?limit=3`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  if (isLoading) {
    return (
      <EditorialScreen>
        <div className="px-5 pt-2 space-y-4">
          <Skeleton className="h-10 w-2/3 rounded-md" />
          <Skeleton className="h-64 w-full rounded-md" />
        </div>
      </EditorialScreen>
    );
  }

  if (error || !league) {
    return (
      <EditorialScreen>
        <div className="px-5 pt-2">
          <p className="text-[13px] text-[#d4674a]">League not found.</p>
        </div>
      </EditorialScreen>
    );
  }

  const sorted = [...league.rosters].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointsFor - a.pointsFor;
  });

  const preSeason = sorted.every((r) => r.wins === 0 && r.losses === 0);

  return (
    <EditorialScreen>
      <EditorialHeader
        title={league.name}
        sub={`${league.totalRosters} teams · ${seasonOrdinal(league.season)} season`}
      />

      <div className="tabular-nums">
        <SectionLabel label="STANDINGS" right="W–L · KEPT" />
        {sorted.map((roster, i) => (
          <Link
            key={roster.id}
            href={`/league/${leagueId}/team/${roster.id}`}
            className={cn(
              "flex items-center gap-3 px-5 py-3",
              rowHairline,
              // The user's own row is marked three ways (wash, inset bar,
              // accent rank + "you") — never by tint alone.
              roster.isUserRoster &&
                "bg-[rgba(199,80,47,.07)] shadow-[inset_2px_0_0_#a8401f]"
            )}
          >
            <span
              className={cn(
                "w-4 shrink-0 font-plex-mono text-xs font-medium leading-none",
                roster.isUserRoster ? "text-[#d4674a]" : "text-[#93a08f]"
              )}
            >
              {i + 1}
            </span>
            <span className="flex-1 min-w-0 flex items-baseline gap-[7px]">
              <span className="text-[13.5px] leading-none font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                {roster.teamName || "—"}
              </span>
              {roster.isUserRoster && (
                <span className="font-plex-mono text-[10px] leading-none font-medium text-[#d4674a] shrink-0">
                  you
                </span>
              )}
            </span>
            <span className="font-plex-mono text-[13px] leading-none font-medium">
              {roster.wins}–{roster.losses}
            </span>
            <span className="w-6 shrink-0 text-right font-plex-mono text-[12.5px] leading-none text-[#93a08f]">
              {roster.keeperCount}
            </span>
          </Link>
        ))}

        {leaders && leaders.leaders.length > 0 && (
          <>
            <SectionLabel label="SCORING LEADERS" right="PPG" className="pt-[22px]" />
            {leaders.leaders.map((p) => (
              <Link
                key={p.playerId}
                href={`/league/${leagueId}/player/${p.playerId}`}
                className={cn("flex items-center gap-3 px-5 py-[11px]", rowHairline)}
              >
                <Headshot sleeperId={p.sleeperId} size={32} alt={p.fullName} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] leading-[1.2] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                    {p.fullName}
                  </span>
                  <span className="block text-[11px] leading-none text-[#93a08f] mt-1.5">
                    {p.team || "FA"} · {p.ownerTeamName || "unowned"}
                  </span>
                </span>
                <span className="font-plex-mono text-[13.5px] leading-none font-medium">
                  {p.pointsPerGame?.toFixed(1)}
                </span>
              </Link>
            ))}
          </>
        )}

        {/* Secondary league destinations — not part of the five designed
            screens, but the League tab is the only route to them. Same row
            language, no card chrome. */}
        <SectionLabel label="MORE" className="pt-[22px]" />
        {[
          { label: "Activity", href: `/league/${leagueId}/activity` },
          { label: "All teams", href: `/league/${leagueId}/team` },
          { label: "Trade proposals", href: `/league/${leagueId}/trade-proposals` },
          { label: "Settings", href: `/league/${leagueId}/settings` },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center justify-between px-5 py-3 min-h-[44px]",
              rowHairline
            )}
          >
            <span className="text-[13.5px] leading-none font-medium">{item.label}</span>
            <ChevronRight size={14} strokeWidth={1.9} className="text-[#93a08f]" />
          </Link>
        ))}
      </div>

      <Footnote>
        {preSeason
          ? "Pre-season — records begin in week 1. Kept counts show declared keepers."
          : "Standings update as Sleeper scores post."}
      </Footnote>
    </EditorialScreen>
  );
}
