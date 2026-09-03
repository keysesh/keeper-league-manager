"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ChevronRight,
  Users as UsersIcon,
  FileText,
  Settings,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetSkeleton } from "@/components/ui/WidgetSkeleton";
import { DeadlineBanner } from "@/components/ui/DeadlineBanner";
import { AlertsBanner } from "@/components/ui/AlertsBanner";
import {
  ScreenHeader,
  SectionLabel,
  listCard,
  MeterRow,
} from "@/components/league-screens";

const PowerRankings = dynamic(
  () => import("@/components/ui/PowerRankings").then((mod) => ({ default: mod.PowerRankings })),
  { loading: () => <WidgetSkeleton rows={6} />, ssr: false }
);

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  });

interface League {
  id: string;
  name: string;
  season: number;
  totalRosters: number;
  rosters: Array<{ id: string; isUserRoster: boolean }>;
}

interface Economics {
  pressure: {
    teamCount: number;
    teamsLocked: number;
    maxKeepers: number;
    slotsFilledPct: number;
    tagsUsedPct: number;
    earlyRoundsGonePct: number;
  };
}

/**
 * League — power rankings plus league-wide keeper pressure
 * (value-screens handoff). The ranking cards are PowerRankings.tsx in
 * condensed API mode, not a rebuild.
 */
export default function LeaguePage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const { data: league, error, isLoading } = useSWR<League>(
    `/api/leagues/${leagueId}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );
  const { data: economics } = useSWR<Economics>(
    `/api/leagues/${leagueId}/keeper-economics`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-12 w-56 rounded-lg" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-[#0c1219] border border-rose-500/20 rounded-xl p-6">
          <p className="text-rose-400 font-medium">League not found</p>
        </div>
      </div>
    );
  }

  const userRosterId = league.rosters?.find((r) => r.isUserRoster)?.id;
  const pressure = economics?.pressure;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <ScreenHeader
        title="League"
        subtitle={`${league.name} · ${league.totalRosters} teams`}
      />

      <DeadlineBanner leagueId={leagueId} />
      <AlertsBanner leagueId={leagueId} />

      {/* Power rankings — the component's own condensed API mode */}
      <PowerRankings
        leagueId={leagueId}
        userRosterId={userRosterId}
        useApi={true}
        condensed={true}
        viewAllHref={`/league/${leagueId}/team`}
      />

      {/* League keeper pressure */}
      {pressure && (
        <div className="bg-[#0c1219] border border-white/[0.08] border-t-white/[0.12] rounded-xl px-[15px] py-3.5">
          <p className="text-xs leading-normal text-slate-300">
            {pressure.teamsLocked} of {pressure.teamCount} teams have locked all{" "}
            {pressure.maxKeepers} slots.{" "}
            {pressure.earlyRoundsGonePct >= 50
              ? "Early-round capital is getting scarce."
              : "Early-round capital is still available."}
          </p>
          <div className="space-y-[11px] mt-3.5">
            <MeterRow
              label="Slots filled"
              percent={pressure.slotsFilledPct}
              gradient="linear-gradient(90deg, #2563eb, #60a5fa)"
              value={`${pressure.slotsFilledPct}%`}
            />
            <MeterRow
              label="Tags used"
              percent={pressure.tagsUsedPct}
              gradient="linear-gradient(90deg, #d97706, #fbbf24)"
              value={`${pressure.tagsUsedPct}%`}
            />
            <MeterRow
              label="R1–R3 gone"
              percent={pressure.earlyRoundsGonePct}
              gradient="linear-gradient(90deg, #7c3aed, #a78bfa)"
              value={`${pressure.earlyRoundsGonePct}%`}
            />
          </div>
        </div>
      )}

      {/* Secondary destinations */}
      <div>
        <SectionLabel label="More" />
        <div className={listCard}>
          {[
            { label: "All teams", meta: "Every roster in the league", href: `/league/${leagueId}/team`, icon: UsersIcon },
            { label: "Trade proposals", meta: "Saved and shared trades", href: `/league/${leagueId}/trade-proposals`, icon: FileText },
            { label: "Settings", meta: "League rules and keepers", href: `/league/${leagueId}/settings`, icon: Settings },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-[13px] py-3 min-h-[44px] hover:bg-[#111822] transition-colors duration-150"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 text-blue-400 shrink-0">
                <item.icon size={15} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-medium text-slate-50">{item.label}</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">{item.meta}</span>
              </span>
              <ChevronRight size={15} className="text-slate-600 shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
