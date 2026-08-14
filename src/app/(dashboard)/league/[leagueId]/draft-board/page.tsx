"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowUp,
  FlaskConical,
  ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { KeeperHistoryModal } from "@/components/players/KeeperHistoryModal";
import { TeamRoundsView } from "@/components/draft/TeamRoundsView";
import {
  DraftPickValueChart,
  type PickStatus,
} from "@/components/ui/DraftPickValueChart";
import { InfoModal } from "@/components/ui/InfoModal";
import {
  ScreenHeader,
  SectionLabel,
  listCard,
} from "@/components/league-screens";
import { cn } from "@/lib/design-tokens";
import { getDraftPickValue } from "@/lib/constants/league-config";

interface KeeperResult {
  playerId: string;
  playerName: string;
  position: string | null;
  team: string | null;
  baseCost: number;
  finalCost: number;
  cascaded: boolean;
  keeperType?: "FRANCHISE" | "REGULAR";
}

interface DraftSlot {
  rosterId: string;
  rosterName: string | null;
  status: "available" | "keeper" | "traded";
  tradedTo?: string;
}

interface CascadeResult {
  rosterId: string;
  rosterName: string | null;
  results: KeeperResult[];
  tradedAwayPicks: number[];
  acquiredPicks: Array<{ round: number; fromRosterId: string }>;
}

interface DraftBoardData {
  season: number;
  leagueId: string;
  totalRosters: number;
  draftRounds: number;
  cascade: CascadeResult[];
  draftBoard: Array<{ round: number; slots: DraftSlot[] }>;
  summary: {
    totalKeepers: number;
    cascadedKeepers: number;
    tradedPicks: number;
  };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Total pick value a team holds: base rounds kept + acquired, minus dealt. */
function capitalOf(team: CascadeResult, draftRounds: number): number {
  let total = 0;
  for (let round = 1; round <= draftRounds; round++) {
    if (!team.tradedAwayPicks.includes(round)) total += getDraftPickValue(round);
  }
  for (const p of team.acquiredPicks) total += getDraftPickValue(p.round);
  return total;
}

function rankSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

/**
 * Draft Board — the value of the picks you hold, which are consumed by
 * keepers, and which are gone (value-screens handoff). The full league
 * board stays reachable below.
 */
export default function DraftBoardPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [data, setData] = useState<DraftBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const { data: rostersData } = useSWR<{
    rosters: Array<{ id: string; isUserRoster: boolean }>;
  }>(`/api/leagues/${leagueId}/rosters`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000,
  });
  const userRosterId = rostersData?.rosters?.find((r) => r.isUserRoster)?.id;

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/keepers/cascade`);
      if (!res.ok) throw new Error("Failed to fetch draft board");
      setData(await res.json());
      setError("");
    } catch {
      setError("Failed to load draft board");
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const derived = useMemo(() => {
    if (!data || !userRosterId) return null;
    const mine = data.cascade.find((t) => t.rosterId === userRosterId);
    if (!mine) return null;

    const picksOwned =
      data.draftRounds - mine.tradedAwayPicks.length + mine.acquiredPicks.length;

    const capitals = data.cascade
      .map((t) => ({ rosterId: t.rosterId, capital: capitalOf(t, data.draftRounds) }))
      .sort((a, b) => b.capital - a.capital);
    const capitalRank =
      capitals.findIndex((c) => c.rosterId === userRosterId) + 1;

    const statuses: Record<number, PickStatus> = {};
    for (let round = 1; round <= data.draftRounds; round++) {
      if (mine.results.some((k) => k.finalCost === round)) statuses[round] = "KEEPER";
      else if (mine.tradedAwayPicks.includes(round)) statuses[round] = "TRADED";
      else statuses[round] = "OPEN";
    }

    const nameOf = new Map(
      data.cascade.map((t) => [t.rosterId, t.rosterName || "a team"])
    );
    const movement = [
      ...mine.tradedAwayPicks.map((round) => {
        const slot = data.draftBoard
          .find((r) => r.round === round)
          ?.slots.find((s) => s.rosterId === userRosterId);
        return {
          key: `out-${round}`,
          direction: "out" as const,
          label: `Round ${round}${slot?.tradedTo ? ` · to ${slot.tradedTo}` : ""}`,
          meta: "Dealt via trade",
          value: -getDraftPickValue(round),
        };
      }),
      ...mine.acquiredPicks.map((p, i) => ({
        key: `in-${p.round}-${i}`,
        direction: "in" as const,
        label: `Round ${p.round} · from ${nameOf.get(p.fromRosterId) || "a team"}`,
        meta: "Acquired via trade",
        value: getDraftPickValue(p.round),
      })),
    ];

    return { mine, picksOwned, capitalRank, capitalCount: capitals.length, statuses, movement };
  }, [data, userRosterId]);

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-12 w-48 rounded-lg" />
        <div className="grid grid-cols-2 gap-2.5">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl">
        <div className="bg-[#0c1219] border border-rose-500/20 rounded-xl p-8 text-center">
          <p className="text-rose-400 font-medium">{error || "Failed to load data"}</p>
          <button
            onClick={() => fetchData()}
            className="mt-4 px-5 py-2.5 min-h-[44px] bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 rounded-lg text-sm font-medium border border-rose-500/25 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <ScreenHeader
        title="Draft Board"
        subtitle={`${data.season} season · ${data.draftRounds} rounds`}
        right={
          <InfoModal
            title="Draft capital"
            description={
              <>
                Pick values weigh each round for keeper-cost analysis. Status shows
                whether your pick in that round is open, consumed by a keeper, or
                dealt away.
              </>
            }
            iconSize={18}
          />
        }
      />

      {derived ? (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 gap-2.5">
            <div
              className="rounded-xl border border-white/[0.10] border-t-white/[0.16] p-[13px]"
              style={{
                background: "linear-gradient(165deg, rgba(59,130,246,.14), #0c1219 78%)",
                boxShadow: "0 0 26px -10px rgba(59,130,246,.35)",
              }}
            >
              <span className="block text-[10px] font-medium uppercase tracking-[0.07em] text-slate-400">
                Picks owned
              </span>
              <span className="flex items-baseline gap-1 mt-1.5">
                <span className="font-mono text-[26px] leading-none font-semibold text-slate-50">
                  {derived.picksOwned}
                </span>
                <span className="font-mono text-xs text-slate-500">/{data.draftRounds}</span>
              </span>
            </div>
            <div
              className="rounded-xl border border-white/[0.10] border-t-white/[0.16] p-[13px]"
              style={{
                background: "linear-gradient(165deg, rgba(139,92,246,.14), #0c1219 78%)",
                boxShadow: "0 0 26px -10px rgba(139,92,246,.3)",
              }}
            >
              <span className="block text-[10px] font-medium uppercase tracking-[0.07em] text-slate-400">
                Capital rank
              </span>
              <span className="flex items-baseline gap-1.5 mt-1.5">
                <span className="font-mono text-[26px] leading-none font-semibold text-slate-50">
                  {derived.capitalRank}
                  {rankSuffix(derived.capitalRank)}
                </span>
                <span className="flex items-center gap-0.5 font-mono text-[11px] font-semibold text-slate-500">
                  <ArrowUp size={11} className="opacity-0" aria-hidden />
                  of {derived.capitalCount}
                </span>
              </span>
            </div>
          </div>

          {/* Pick value chart with ownership status */}
          <DraftPickValueChart statuses={derived.statuses} />

          {/* Pick movement */}
          {derived.movement.length > 0 && (
            <div>
              <SectionLabel label="Movement" />
              <div className={listCard}>
                {derived.movement.map((m) => (
                  <div key={m.key} className="flex items-center gap-3 px-[13px] py-3">
                    <span
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-lg border shrink-0",
                        m.direction === "out"
                          ? "bg-orange-500/15 border-orange-500/20 text-orange-400"
                          : "bg-emerald-500/15 border-emerald-500/20 text-emerald-400"
                      )}
                    >
                      {m.direction === "out" ? (
                        <ArrowUpRight size={15} />
                      ) : (
                        <ArrowDownLeft size={15} />
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium text-slate-50 truncate">
                        {m.label}
                      </span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">{m.meta}</span>
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[12.5px] font-semibold shrink-0",
                        m.value < 0 ? "text-orange-400" : "text-emerald-400"
                      )}
                    >
                      {m.value > 0 ? `+${m.value}` : m.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-[#0c1219] border border-white/[0.08] border-t-white/[0.12] rounded-xl p-5 text-sm text-slate-500">
          You don&apos;t manage a roster in this league — the league board below
          shows every team.
        </div>
      )}

      {/* Sandbox */}
      <Link
        href={`/league/${leagueId}/simulation`}
        className="flex items-center gap-3 px-[13px] py-3 min-h-[44px] bg-[#0c1219] border border-white/[0.08] border-t-white/[0.12] rounded-xl hover:bg-[#111822] transition-colors duration-150"
      >
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/20 text-purple-400 shrink-0">
          <FlaskConical size={15} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-medium text-slate-50">Sandbox</span>
          <span className="block text-[11px] text-slate-500 mt-0.5">
            Simulate keeper and pick scenarios
          </span>
        </span>
        <ChevronRight size={15} className="text-slate-600 shrink-0" />
      </Link>

      {/* Full league board */}
      <div>
        <SectionLabel label="League board" right="BY TEAM" />
        <TeamRoundsView
          cascade={data.cascade}
          draftBoard={data.draftBoard}
          draftRounds={data.draftRounds}
          userRosterId={userRosterId}
          onPlayerClick={setSelectedPlayerId}
        />
      </div>

      <KeeperHistoryModal
        playerId={selectedPlayerId || ""}
        isOpen={!!selectedPlayerId}
        onClose={() => setSelectedPlayerId(null)}
      />
    </div>
  );
}
