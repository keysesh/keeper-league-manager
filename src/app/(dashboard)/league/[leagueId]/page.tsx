"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";
import { DeadlineBanner } from "@/components/ui/DeadlineBanner";
import { AlertsBanner } from "@/components/ui/AlertsBanner";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { AgeIndicator } from "@/components/ui/AgeBadge";
import { WidgetSkeleton } from "@/components/ui/WidgetSkeleton";
import { Card, HeroCard } from "@/components/ui/Card";
import { BigStat, StatGrid } from "@/components/ui/BigStat";
import { cn } from "@/lib/design-tokens";
import {
  ChevronRight,
  Trophy,
  Crown,
  Target,
  Zap,
  Star,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

// Dynamic imports for better performance
const AnalyticsTabs = dynamic(
  () => import("@/components/ui/AnalyticsTabs").then(mod => ({ default: mod.AnalyticsTabs })),
  { loading: () => <WidgetSkeleton rows={8} />, ssr: false }
);

const RecentTrades = dynamic(
  () => import("@/components/ui/RecentTrades").then(mod => ({ default: mod.RecentTrades })),
  { loading: () => <WidgetSkeleton rows={3} />, ssr: false }
);

const ChampionshipHistory = dynamic(
  () => import("@/components/ui/ChampionshipHistory").then(mod => ({ default: mod.ChampionshipHistory })),
  { loading: () => <WidgetSkeleton rows={3} />, ssr: false }
);

const PowerRankings = dynamic(
  () => import("@/components/ui/PowerRankings").then(mod => ({ default: mod.PowerRankings })),
  { loading: () => <WidgetSkeleton rows={6} />, ssr: false }
);

const UserStatsHero = dynamic(
  () => import("@/components/ui/UserStatsHero").then(mod => ({ default: mod.UserStatsHero })),
  { loading: () => <WidgetSkeleton rows={2} />, ssr: false }
);

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
});

interface Roster {
  id: string;
  sleeperId: string;
  teamName: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  isUserRoster: boolean;
  owners: Array<{
    id: string;
    displayName: string;
    avatar: string | null;
    role: string;
  }>;
  playerCount: number;
  keeperCount: number;
  currentKeepers: Array<{
    id: string;
    player: {
      fullName: string;
      position: string;
      team: string;
      age: number | null;
      yearsExp: number | null;
    };
    type: string;
    finalCost: number;
  }>;
}

interface League {
  id: string;
  sleeperId: string;
  name: string;
  season: number;
  status: string;
  totalRosters: number;
  draftRounds: number;
  lastSyncedAt: string | null;
  keeperSettings: {
    maxKeepers: number;
    maxFranchiseTags: number;
    maxRegularKeepers: number;
    regularKeeperMaxYears: number;
    undraftedRound: number;
  } | null;
  rosters: Roster[];
  recentDrafts: Array<{
    id: string;
    season: number;
    type: string;
    status: string;
  }>;
  counts: {
    rosters: number;
    drafts: number;
    transactions: number;
  };
}

export default function LeaguePage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const { data: league, error, isLoading } = useSWR<League>(
    `/api/leagues/${leagueId}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card variant="default" className="border-red-500/30 bg-red-500/5">
          <p className="text-red-400 font-medium">{error || "League not found"}</p>
        </Card>
      </div>
    );
  }

  const userRoster = league.rosters.find((r) => r.isUserRoster);
  const sortedRosters = [...league.rosters].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointsFor - a.pointsFor;
  });
  const userRank = userRoster ? sortedRosters.findIndex(r => r.id === userRoster.id) + 1 : 0;
  const maxKeepers = league.keeperSettings?.maxKeepers || 7;
  const winPct = userRoster ? ((userRoster.wins / (userRoster.wins + userRoster.losses)) * 100).toFixed(0) : 0;

  return (
    <>
      <DeadlineBanner leagueId={leagueId} />
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ALERTS BANNER */}
        <AlertsBanner leagueId={leagueId} />

        {/* HERO SECTION - Your Team Status */}
        {userRoster && (
          <HeroCard>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              {/* Team Info */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                  #{userRank}
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white">
                    {userRoster.teamName || "Your Team"}
                  </h1>
                  <p className="text-slate-400 text-sm">{league.name} &middot; {league.season}</p>
                </div>
              </div>

              {/* Stats Grid */}
              <StatGrid columns={4} className="lg:max-w-md">
                <BigStat value={`#${userRank}`} label="Rank" size="sm" />
                <BigStat
                  value={`${userRoster.wins}-${userRoster.losses}`}
                  label="Record"
                  size="sm"
                  color={userRoster.wins > userRoster.losses ? "positive" : userRoster.wins < userRoster.losses ? "negative" : "default"}
                />
                <BigStat value={`${winPct}%`} label="Win %" size="sm" />
                <BigStat
                  value={`${userRoster.keeperCount}/${maxKeepers}`}
                  label="Keepers"
                  size="sm"
                  color={userRoster.keeperCount >= maxKeepers ? "positive" : "primary"}
                />
              </StatGrid>
            </div>

            {/* Keeper Progress Bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Keeper Selection</span>
                <Link
                  href={`/league/${leagueId}/team/${userRoster.id}`}
                  className="text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
                >
                  Manage <ArrowRight size={14} />
                </Link>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${(userRoster.keeperCount / maxKeepers) * 100}%` }}
                />
              </div>
            </div>
          </HeroCard>
        )}

        {/* LEGACY USER STATS HERO (if no user roster, show for logged-out view) */}
        {!userRoster && (
          <UserStatsHero
            leagueId={leagueId}
            roster={league.rosters[0]}
            rank={1}
            totalRosters={league.totalRosters}
            maxKeepers={maxKeepers}
          />
        )}

        {/* POWER RANKINGS - Primary ranking view with full stats */}
        <section id="power-rankings" className="scroll-mt-20">
          <PowerRankings
            leagueId={leagueId}
            userRosterId={userRoster?.id}
            useApi={true}
            condensed={false}
            viewAllHref={`/league/${leagueId}/team`}
          />
        </section>

        {/* TWO COLUMN LAYOUT: Trades + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* RECENT TRADES */}
          <RecentTrades
            leagueId={leagueId}
            userRosterId={userRoster?.id}
            limit={3}
          />

          {/* QUICK ACTIONS - moved here for better hierarchy */}
          <div className="grid grid-cols-2 gap-3 h-fit">
            <QuickActionCard
              href={`/league/${leagueId}/draft-board`}
              icon={<Target className="w-5 h-5" />}
              label="Draft Board"
              description="View keeper costs"
              gradient="primary"
            />
            <QuickActionCard
              href={`/league/${leagueId}/trade-analyzer`}
              icon={<Zap className="w-5 h-5" />}
              label="Trade Center"
              description="Evaluate trades"
              gradient="warm"
            />
            <QuickActionCard
              href={`/league/${leagueId}/team`}
              icon={<Trophy className="w-5 h-5" />}
              label="All Teams"
              description="View all rosters"
              gradient="success"
            />
            <QuickActionCard
              href={`/league/${leagueId}/history`}
              icon={<Crown className="w-5 h-5" />}
              label="Championships"
              description="League history"
              gradient="cool"
            />
          </div>
        </div>

        {/* YOUR KEEPERS */}
        {userRoster && userRoster.currentKeepers.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/25 to-purple-500/15 border border-blue-400/30 shadow-lg shadow-blue-500/10 flex items-center justify-center">
                  <Crown className="w-4 h-4 text-blue-400" strokeWidth={2} />
                </div>
                <h2 className="font-semibold text-white">Your {league.season} Keepers</h2>
              </div>
              <Link
                href={`/league/${leagueId}/team/${userRoster.id}`}
                className="text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
              >
                Manage <ChevronRight size={16} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
              {userRoster.currentKeepers.map((keeper) => (
                <Card
                  key={keeper.id}
                  variant={keeper.type === "FRANCHISE" ? "gradient" : "default"}
                  padding="sm"
                  className={cn(
                    "relative transition-all hover:scale-[1.02]",
                    keeper.type === "FRANCHISE" && "border-t-2 border-t-amber-500"
                  )}
                >
                  {keeper.type === "FRANCHISE" && (
                    <div className="absolute top-2 right-2">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 mb-2">
                    <PositionBadge position={keeper.player.position} size="xs" />
                    {keeper.player.age && (
                      <AgeIndicator
                        age={keeper.player.age}
                        position={keeper.player.position}
                        size="xs"
                      />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white truncate">{keeper.player.fullName}</p>
                  <p className="text-xs text-slate-500 mb-2">{keeper.player.team}</p>

                  <div className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold",
                    keeper.type === "FRANCHISE"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-white/[0.05] text-slate-300"
                  )}>
                    R{keeper.finalCost}
                  </div>
                </Card>
              ))}

              {/* Empty slots */}
              {Array.from({ length: Math.min(maxKeepers - userRoster.currentKeepers.length, 2) }).map((_, i) => (
                <Link
                  key={`empty-${i}`}
                  href={`/league/${leagueId}/team/${userRoster.id}`}
                  className="rounded-xl p-3 border-2 border-dashed border-white/[0.1] hover:border-blue-500/50 flex flex-col items-center justify-center text-slate-600 hover:text-blue-400 transition-all min-h-[120px] hover:bg-blue-500/5"
                >
                  <div className="w-10 h-10 rounded-lg border-2 border-dashed border-current flex items-center justify-center mb-2">
                    <span className="text-xl">+</span>
                  </div>
                  <span className="text-xs font-medium">Add Keeper</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ANALYTICS - Luck Factor & Top Scorers */}
        <AnalyticsTabs
          leagueId={leagueId}
          userRosterId={userRoster?.id}
        />

        {/* CHAMPIONSHIP HISTORY */}
        <ChampionshipHistory
          leagueId={leagueId}
          userRosterId={userRoster?.id}
          compact={true}
        />

        {/* Footer */}
        {league.lastSyncedAt && (
          <p className="text-center text-xs text-slate-600 pb-4">
            Last synced {new Date(league.lastSyncedAt).toLocaleDateString()} at{" "}
            {new Date(league.lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </>
  );
}

function QuickActionCard({
  href,
  icon,
  label,
  description,
  gradient = "primary",
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  gradient?: "primary" | "warm" | "cool" | "success";
}) {
  // Premium icon styling with increased opacity and shadows
  const gradientStyles = {
    primary: "from-blue-500/25 to-purple-500/15 group-hover:from-blue-500/35 group-hover:to-purple-500/25 border-blue-400/30 shadow-lg shadow-blue-500/10",
    warm: "from-amber-500/25 to-orange-500/15 group-hover:from-amber-500/35 group-hover:to-orange-500/25 border-amber-400/30 shadow-lg shadow-amber-500/10",
    cool: "from-cyan-500/25 to-blue-500/15 group-hover:from-cyan-500/35 group-hover:to-blue-500/25 border-cyan-400/30 shadow-lg shadow-cyan-500/10",
    success: "from-emerald-500/25 to-cyan-500/15 group-hover:from-emerald-500/35 group-hover:to-cyan-500/25 border-emerald-400/30 shadow-lg shadow-emerald-500/10",
  };

  const iconColors = {
    primary: "text-blue-400",
    warm: "text-amber-400",
    cool: "text-cyan-400",
    success: "text-emerald-400",
  };

  return (
    <Link
      href={href}
      className="group p-4 rounded-xl bg-[#0d1420] border border-white/[0.06] hover:border-white/[0.12] transition-all hover:scale-[1.02]"
    >
      <div className={cn(
        "w-10 h-10 rounded-xl bg-gradient-to-br border flex items-center justify-center mb-3 transition-all",
        gradientStyles[gradient]
      )}>
        <span className={iconColors[gradient]}>{icon}</span>
      </div>
      <p className="font-semibold text-white text-sm mb-0.5">{label}</p>
      <p className="text-xs text-slate-500">{description}</p>
    </Link>
  );
}
