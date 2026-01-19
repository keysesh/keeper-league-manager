"use client";

import useSWR from "swr";
import Image from "next/image";
import { Trophy, Crown, Medal, Star, TrendingUp, Award, Lock, Target, ArrowLeftRight, ShoppingCart, Calendar } from "lucide-react";
import { cn } from "@/lib/design-tokens";

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface SeasonChampion {
  season: number;
  champion: {
    rosterId: string;
    teamName: string;
    owners: string[];
    wins: number;
    losses: number;
    pointsFor: number;
  };
  runnerUp: {
    rosterId: string;
    teamName: string;
    owners: string[];
  } | null;
  pointsLeader: {
    rosterId: string;
    teamName: string;
    pointsFor: number;
  };
  mostKeepers: {
    rosterId: string;
    teamName: string;
    keeperCount: number;
  } | null;
}

interface OwnerStats {
  userId: string;
  displayName: string;
  avatar: string | null;
  championships: number;
  secondPlace: number;
  seasonsPlayed: number;
  totalWins: number;
  totalLosses: number;
}

interface AllTimeRecords {
  mostChampionships: { name: string; count: number } | null;
  mostSeasons: { name: string; count: number } | null;
  highestSingleSeasonPoints: { name: string; season: number; points: number } | null;
  bestRecord: { name: string; season: number; record: string } | null;
  mostKeepers: { name: string; season: number; count: number } | null;
  mostRunnerUps: { name: string; count: number } | null;
  mostTrades: { ownerName: string; count: number } | null;
  mostWaivers: { ownerName: string; count: number } | null;
}

interface ChampionshipHistoryProps {
  leagueId: string;
  userRosterId?: string;
  compact?: boolean;
}

function getAvatarUrl(avatarId: string | null): string | null {
  if (!avatarId) return null;
  if (avatarId.startsWith("http")) return avatarId;
  return `https://sleepercdn.com/avatars/thumbs/${avatarId}`;
}

/**
 * Championship History / Trophy Case component
 * Shows past champions, superlatives, and hall of fame
 */
export function ChampionshipHistory({ leagueId, userRosterId, compact = false }: ChampionshipHistoryProps) {
  const { data, isLoading, error } = useSWR<{
    championships: SeasonChampion[];
    ownerStats: OwnerStats[];
    allTimeRecords: AllTimeRecords;
    totalSeasons: number;
  }>(
    `/api/leagues/${leagueId}/history/championships`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  if (isLoading) {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden animate-pulse">
        <div className="px-4 py-4 border-b border-white/[0.06]">
          <div className="h-8 w-40 bg-white/[0.05] rounded" />
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-white/[0.05] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.championships) {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-8 text-center">
        <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-base text-slate-400 font-medium">No championship data</p>
        <p className="text-sm text-slate-600 mt-1">Complete a season to see champions</p>
      </div>
    );
  }

  const { championships, ownerStats, allTimeRecords, totalSeasons } = data;

  if (championships.length === 0) {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-8 text-center">
        <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-base text-slate-400 font-medium">No champions yet</p>
        <p className="text-sm text-slate-600 mt-1">Crown your first champion!</p>
      </div>
    );
  }

  // Compact view for dashboard
  if (compact) {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/25 to-yellow-500/15 border border-amber-400/30 shadow-lg shadow-amber-500/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Trophy Case</h3>
              <p className="text-sm text-slate-500">{totalSeasons} season{totalSeasons !== 1 ? "s" : ""} of history</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {championships.slice(0, 3).map((c) => (
            <div key={c.season} className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border border-amber-500/20 flex items-center justify-center">
                <Crown className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">{c.season}</span>
                  <span className="text-sm text-slate-400">Champion</span>
                </div>
                <p className="text-base text-white truncate">{c.champion.teamName}</p>
                <p className="text-sm text-slate-500">{c.champion.wins}-{c.champion.losses} · {Math.round(c.champion.pointsFor).toLocaleString()} pts</p>
              </div>
            </div>
          ))}
        </div>

        {ownerStats.length > 0 && ownerStats[0].championships > 0 && (
          <div className="p-4 border-t border-white/[0.06] bg-gradient-to-r from-amber-500/5 to-transparent">
            <div className="flex items-center gap-2 text-sm">
              <Star className="w-4 h-4 text-amber-400" />
              <span className="text-slate-500">Dynasty:</span>
              <span className="text-amber-400 font-medium">{ownerStats[0].displayName}</span>
              <span className="text-slate-500">({ownerStats[0].championships} titles)</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full view with superlatives
  return (
    <div className="space-y-6">
      {/* Trophy Case Header */}
      <div className="bg-gradient-to-br from-[#0d1420] to-[#131a28] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.06] bg-gradient-to-r from-amber-500/10 via-transparent to-transparent">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/30 to-yellow-600/20 border border-amber-400/30 shadow-lg shadow-amber-500/20 flex items-center justify-center">
              <Trophy className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Trophy Case</h2>
              <p className="text-sm text-slate-400">{totalSeasons} seasons of dynasty history</p>
            </div>
          </div>
        </div>

        {/* Superlatives Grid */}
        <div className="p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">All-Time Records</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {/* Most Trades */}
            {allTimeRecords.mostTrades && allTimeRecords.mostTrades.count > 0 && (
              <SuperlativeCard
                icon={<ArrowLeftRight className="w-5 h-5" />}
                label="Most Trades"
                value={allTimeRecords.mostTrades.count.toString()}
                name={allTimeRecords.mostTrades.ownerName}
                colorClass="text-purple-400"
                bgClass="from-purple-500/20 to-purple-600/10"
                borderClass="border-purple-500/20"
              />
            )}

            {/* Most Waivers */}
            {allTimeRecords.mostWaivers && allTimeRecords.mostWaivers.count > 0 && (
              <SuperlativeCard
                icon={<ShoppingCart className="w-5 h-5" />}
                label="Most Waivers"
                value={allTimeRecords.mostWaivers.count.toString()}
                name={allTimeRecords.mostWaivers.ownerName}
                colorClass="text-cyan-400"
                bgClass="from-cyan-500/20 to-cyan-600/10"
                borderClass="border-cyan-500/20"
              />
            )}

            {/* Highest Score */}
            {allTimeRecords.highestSingleSeasonPoints && allTimeRecords.highestSingleSeasonPoints.points > 0 && (
              <SuperlativeCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Highest Score"
                value={Math.round(allTimeRecords.highestSingleSeasonPoints.points).toLocaleString()}
                name={allTimeRecords.highestSingleSeasonPoints.name}
                subtitle={`${allTimeRecords.highestSingleSeasonPoints.season}`}
                colorClass="text-blue-400"
                bgClass="from-blue-500/20 to-blue-600/10"
                borderClass="border-blue-500/20"
              />
            )}

            {/* Best Record */}
            {allTimeRecords.bestRecord && (
              <SuperlativeCard
                icon={<Award className="w-5 h-5" />}
                label="Best Record"
                value={allTimeRecords.bestRecord.record}
                name={allTimeRecords.bestRecord.name}
                subtitle={`${allTimeRecords.bestRecord.season}`}
                colorClass="text-emerald-400"
                bgClass="from-emerald-500/20 to-emerald-600/10"
                borderClass="border-emerald-500/20"
              />
            )}

            {/* Most Seasons */}
            {allTimeRecords.mostSeasons && allTimeRecords.mostSeasons.count > 0 && (
              <SuperlativeCard
                icon={<Calendar className="w-5 h-5" />}
                label="Most Seasons"
                value={allTimeRecords.mostSeasons.count.toString()}
                name={allTimeRecords.mostSeasons.name}
                colorClass="text-slate-300"
                bgClass="from-slate-500/20 to-slate-600/10"
                borderClass="border-slate-500/20"
              />
            )}

            {/* Most Keepers */}
            {allTimeRecords.mostKeepers && allTimeRecords.mostKeepers.count > 0 && (
              <SuperlativeCard
                icon={<Lock className="w-5 h-5" />}
                label="Most Keepers"
                value={allTimeRecords.mostKeepers.count.toString()}
                name={allTimeRecords.mostKeepers.name}
                subtitle={`${allTimeRecords.mostKeepers.season}`}
                colorClass="text-orange-400"
                bgClass="from-orange-500/20 to-orange-600/10"
                borderClass="border-orange-500/20"
              />
            )}
          </div>
        </div>
      </div>

      {/* Championship Timeline */}
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/25 to-yellow-500/15 border border-amber-400/30 shadow-lg shadow-amber-500/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Championship Timeline</h3>
              <p className="text-sm text-slate-500">Season-by-season champions</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {championships.map((c) => {
            const isUserChampion = c.champion.rosterId === userRosterId;

            return (
              <div
                key={c.season}
                className={cn(
                  "p-5 transition-colors",
                  isUserChampion && "bg-amber-500/5"
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Year Badge */}
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/25 to-yellow-600/15 border border-amber-500/25 flex items-center justify-center shadow-lg">
                      <Trophy className="w-7 h-7 text-amber-400" />
                    </div>
                    <span className="text-lg font-bold text-white mt-2">{c.season}</span>
                  </div>

                  {/* Champion Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="text-lg font-bold text-white">{c.champion.teamName}</h4>
                      {isUserChampion && (
                        <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded font-bold">
                          YOU
                        </span>
                      )}
                    </div>
                    <p className="text-base text-slate-400 mb-2">
                      {c.champion.owners.join(", ")}
                    </p>
                    <div className="flex items-center gap-4 text-base flex-wrap">
                      <span className="text-emerald-400 font-semibold">{c.champion.wins}-{c.champion.losses}</span>
                      <span className="text-slate-500">{Math.round(c.champion.pointsFor).toLocaleString()} pts</span>
                    </div>

                    {/* Runner-up */}
                    {c.runnerUp && (
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <Medal className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-500">Runner-up:</span>
                        <span className="text-slate-300">{c.runnerUp.teamName}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hall of Fame */}
      {ownerStats.length > 0 && (
        <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/25 to-pink-500/15 border border-purple-400/30 shadow-lg shadow-purple-500/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Hall of Fame</h3>
                <p className="text-sm text-slate-500">All-time owner rankings</p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {ownerStats.map((owner, index) => {
              const avatarUrl = getAvatarUrl(owner.avatar);

              return (
                <div key={owner.userId} className="p-4 flex items-center gap-4">
                  {/* Rank Badge */}
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-base flex-shrink-0",
                    index === 0 && "bg-amber-500 text-black",
                    index === 1 && "bg-slate-400 text-black",
                    index === 2 && "bg-orange-600 text-white",
                    index > 2 && "bg-white/[0.05] text-slate-400"
                  )}>
                    {index === 0 ? <Crown className="w-5 h-5" /> : index + 1}
                  </div>

                  {/* Avatar */}
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={owner.displayName}
                      width={40}
                      height={40}
                      className="rounded-lg object-cover flex-shrink-0"
                      unoptimized
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-slate-400 font-bold text-sm flex-shrink-0">
                      {owner.displayName[0].toUpperCase()}
                    </div>
                  )}

                  {/* Owner Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-white truncate">{owner.displayName}</p>
                    <p className="text-sm text-slate-500">{owner.seasonsPlayed} seasons · {owner.totalWins}-{owner.totalLosses}</p>
                  </div>

                  {/* Trophies */}
                  <div className="flex items-center gap-4">
                    {owner.championships > 0 && (
                      <span className="flex items-center gap-1 text-amber-400 font-medium">
                        <Trophy className="w-4 h-4" />
                        {owner.championships}
                      </span>
                    )}
                    {owner.secondPlace > 0 && (
                      <span className="flex items-center gap-1 text-slate-400">
                        <Medal className="w-4 h-4" />
                        {owner.secondPlace}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Superlative Card Component
function SuperlativeCard({
  icon,
  label,
  value,
  name,
  subtitle,
  colorClass,
  bgClass,
  borderClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  name: string;
  subtitle?: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl p-4 border backdrop-blur-sm",
      borderClass,
      "bg-gradient-to-br",
      bgClass
    )}>
      {/* Background glow effect */}
      <div className={cn(
        "absolute -top-4 -right-4 w-16 h-16 rounded-full blur-2xl opacity-30",
        bgClass.replace("to-", "bg-").replace("/20", "/40").replace("/10", "/30")
      )} />

      <div className="relative">
        <div className={cn("mb-2", colorClass)}>
          {icon}
        </div>
        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <p className={cn("text-2xl font-bold mt-1", colorClass)}>{value}</p>
        <p className="text-sm text-white font-medium mt-2 truncate" title={name}>{name}</p>
        {subtitle && (
          <p className="text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
