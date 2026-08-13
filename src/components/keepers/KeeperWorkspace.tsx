"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Star, Trophy, Users, FileText, Send, TrendingUp, X } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PremiumPlayerCard } from "@/components/players/PremiumPlayerCard";
import { KeeperHistoryModal } from "@/components/players/KeeperHistoryModal";
import { DraftCapital } from "@/components/ui/DraftCapital";
import { RefreshFromSleeper } from "@/components/ui/RefreshFromSleeper";
import {
  diffPlanSnapshots,
  type PlanChange,
  type PlanSnapshot,
  type StoredPlanSnapshot,
} from "@/lib/keeper/plan-diff";
import { KeeperRow } from "./KeeperRow";
import { PlanningTray } from "./PlanningTray";
import { PlayerDetailSheet } from "./PlayerDetailSheet";
import {
  SleeperHandoffSheet,
  type HandoffKeeper,
  type HandoffVerification,
} from "./SleeperHandoffSheet";
import type {
  RosterData,
  CascadeData,
  DraftPicksData,
  EligiblePlayer,
} from "./types";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  });

interface KeeperWorkspaceProps {
  leagueId: string;
  rosterId: string;
  sleeperLeagueId: string;
  leagueName: string;
  teamName: string;
}


/**
 * The keeper planning workspace (My Keepers tab).
 *
 * Mobile: sticky planning tray + compact scannable rows + detail sheet —
 * every candidate's cost is visible without opening anything, and slot/round
 * state never scrolls away.
 *
 * Desktop (lg+): the richer card grid + draft capital view.
 *
 * Mutations (optimistic add/remove with rollback) are the same logic the
 * previous owner view used — domain behavior unchanged.
 */
export function KeeperWorkspace({
  leagueId,
  rosterId,
  sleeperLeagueId,
  leagueName,
  teamName,
}: KeeperWorkspaceProps) {
  const { success, error: showError } = useToast();
  const [historyPlayerId, setHistoryPlayerId] = useState<string | null>(null);
  const [sheetPlayerId, setSheetPlayerId] = useState<string | null>(null);
  const [showHandoff, setShowHandoff] = useState(false);

  const { data, error, mutate, isLoading } = useSWR<RosterData>(
    `/api/leagues/${leagueId}/rosters/${rosterId}/eligible-keepers`,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateIfStale: true,
      dedupingInterval: 0,
    }
  );

  // Live cascade — same source as the draft board, so costs always agree
  const { data: cascadeData, mutate: mutateCascade } = useSWR<CascadeData>(
    `/api/leagues/${leagueId}/keepers/cascade`,
    fetcher,
    { revalidateOnFocus: true }
  );

  // Draft picks — desktop Draft Capital section
  const { data: draftPicksData } = useSWR<DraftPicksData>(
    `/api/leagues/${leagueId}/draft-picks`,
    fetcher
  );

  // Round-trip verification: does Sleeper's draft board match the plan?
  const { data: verification, mutate: mutateVerification } = useSWR<HandoffVerification>(
    `/api/leagues/${leagueId}/keepers/verification?rosterId=${rosterId}`,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 60000 }
  );

  const rosterCascade = cascadeData?.cascade.find((c) => c.rosterId === rosterId);

  const addKeeper = async (
    playerId: string,
    type: "FRANCHISE" | "REGULAR",
    playerName: string,
    costData?: { baseCost: number; finalCost: number; yearsKept: number }
  ) => {
    if (!data) return;

    const playerToAdd = data.players.find((p) => p.player.id === playerId);
    if (!playerToAdd) return;

    const optimisticData: RosterData = {
      ...data,
      players: data.players.map((p) =>
        p.player.id === playerId
          ? {
              ...p,
              existingKeeper: {
                id: `temp-${playerId}`,
                type,
                finalCost: costData?.finalCost || p.costs.regular?.finalCost || 1,
                isLocked: false,
              },
            }
          : p
      ),
      currentKeepers: {
        franchise:
          type === "FRANCHISE" ? data.currentKeepers.franchise + 1 : data.currentKeepers.franchise,
        regular:
          type === "REGULAR" ? data.currentKeepers.regular + 1 : data.currentKeepers.regular,
        total: data.currentKeepers.total + 1,
      },
    };

    mutate(optimisticData, { revalidate: false });
    success(`${playerName} added as ${type === "FRANCHISE" ? "FT" : "Keeper"}`);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/keepers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rosterId,
          playerId,
          type,
          baseCost: costData?.baseCost,
          finalCost: costData?.finalCost,
          yearsKept: costData?.yearsKept,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add keeper");
      }

      mutate();
      mutateCascade();
    } catch (err) {
      mutate(data, { revalidate: false });
      showError(err instanceof Error ? err.message : "Failed to add keeper");
    }
  };

  const removeKeeper = async (keeperId: string, playerName: string) => {
    if (!data) return;

    const playerWithKeeper = data.players.find((p) => p.existingKeeper?.id === keeperId);
    if (!playerWithKeeper) return;

    const keeperType = playerWithKeeper.existingKeeper?.type;

    const newFranchiseCount =
      keeperType === "FRANCHISE" ? data.currentKeepers.franchise - 1 : data.currentKeepers.franchise;
    const newRegularCount =
      keeperType === "REGULAR" ? data.currentKeepers.regular - 1 : data.currentKeepers.regular;
    const newTotalCount = data.currentKeepers.total - 1;

    const optimisticData: RosterData = {
      ...data,
      players: data.players.map((p) =>
        p.existingKeeper?.id === keeperId ? { ...p, existingKeeper: null } : p
      ),
      currentKeepers: {
        franchise: newFranchiseCount,
        regular: newRegularCount,
        total: newTotalCount,
      },
      canAddMore: {
        franchise:
          newFranchiseCount < data.limits.maxFranchiseTags && newTotalCount < data.limits.maxKeepers,
        regular:
          newRegularCount < data.limits.maxRegularKeepers && newTotalCount < data.limits.maxKeepers,
        any: newTotalCount < data.limits.maxKeepers,
      },
    };

    mutate(optimisticData, { revalidate: false });
    success(`${playerName} removed`);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/keepers?keeperId=${keeperId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to remove keeper");
      }

      mutate();
      mutateCascade();
    } catch (err) {
      mutate(data, { revalidate: false });
      showError(err instanceof Error ? err.message : "Failed to remove keeper");
    }
  };

  // Derived lists (shared by mobile + desktop renderings)
  const currentKeepers = useMemo(
    () =>
      (data?.players ?? [])
        .filter((p) => p.existingKeeper)
        .sort((a, b) => {
          const costOf = (p: EligiblePlayer) =>
            rosterCascade?.results.find((r) => r.playerId === p.player.sleeperId)?.finalCost ??
            p.existingKeeper?.finalCost ??
            99;
          return costOf(a) - costOf(b);
        }),
    [data, rosterCascade]
  );

  const eligiblePlayers = useMemo(
    () =>
      (data?.players ?? [])
        .filter((p) => p.eligibility.isEligible && !p.existingKeeper)
        .sort((a, b) => {
          const costOf = (p: EligiblePlayer) =>
            p.costs.regular?.finalCost ?? p.costs.franchise?.finalCost ?? 99;
          const diff = costOf(a) - costOf(b);
          if (diff !== 0) return diff;
          return (b.player.lastSeasonPpg ?? 0) - (a.player.lastSeasonPpg ?? 0);
        }),
    [data]
  );

  const ineligiblePlayers = useMemo(
    () => (data?.players ?? []).filter((p) => !p.eligibility.isEligible && !p.existingKeeper),
    [data]
  );

  const sheetEntry =
    data?.players.find((p) => p.player.id === sheetPlayerId) ?? null;

  // ============================================================
  // "Since you last planned" — diff the current plan against the
  // snapshot from the user's previous visit (device-local). Catches
  // cascade shifts from league-mates' trades, sync corrections, and
  // roster changes — interpretation Sleeper itself never provides.
  // ============================================================
  const [planChanges, setPlanChanges] = useState<PlanChange[]>([]);
  const diffedRef = useRef(false);
  const snapshotKey = `keeper-plan-snapshot-${rosterId}`;

  useEffect(() => {
    // Wait until both the roster and live cascade have arrived so the
    // costs we compare are the ones the user actually sees.
    if (!data || !cascadeData) return;

    const selected = data.players.filter((p) => p.existingKeeper);
    const cascade = cascadeData.cascade.find((c) => c.rosterId === rosterId);

    const currentSnapshot: PlanSnapshot = {};
    for (const p of selected) {
      const live = cascade?.results.find((r) => r.playerId === p.player.sleeperId);
      currentSnapshot[p.player.sleeperId] = {
        name: p.player.fullName,
        cost: live?.finalCost ?? p.existingKeeper?.finalCost ?? 1,
      };
    }

    // Diff exactly once per visit, against the previous visit's snapshot
    // (pure logic in lib/keeper/plan-diff.ts, unit-tested)
    if (!diffedRef.current) {
      diffedRef.current = true;
      try {
        const raw = localStorage.getItem(snapshotKey);
        if (raw) {
          const prev = JSON.parse(raw) as StoredPlanSnapshot;
          const rosteredSleeperIds = new Set(data.players.map((p) => p.player.sleeperId));
          setPlanChanges(
            diffPlanSnapshots(prev, data.season, currentSnapshot, rosteredSleeperIds)
          );
        }
      } catch {
        // Unreadable snapshot — skip diffing this visit
      }
    }

    // Keep the snapshot current (user's own edits update it silently)
    try {
      localStorage.setItem(
        snapshotKey,
        JSON.stringify({ season: data.season, plan: currentSnapshot })
      );
    } catch {
      // Storage unavailable — diffing just won't work on this device
    }
  }, [data, cascadeData, rosterId, snapshotKey]);

  // Keepers formatted for the Sleeper entry checklist (final cascade rounds)
  const handoffKeepers: HandoffKeeper[] = useMemo(
    () =>
      currentKeepers.map((p) => {
        const cascadeResult = rosterCascade?.results.find(
          (r) => r.playerId === p.player.sleeperId
        );
        return {
          sleeperId: p.player.sleeperId,
          playerName: p.player.fullName,
          position: p.player.position,
          finalCost: cascadeResult?.finalCost ?? p.existingKeeper?.finalCost ?? 1,
          type: p.existingKeeper?.type ?? "REGULAR",
        };
      }),
    [currentKeepers, rosterCascade]
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-xl bg-white/[0.05]" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg bg-white/[0.03]" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#0c1219] border border-rose-500/20 rounded-xl p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
          <Trophy className="w-8 h-8 text-rose-400" />
        </div>
        <p className="text-rose-400 font-medium text-lg">Failed to load roster data</p>
        <p className="text-slate-500 text-sm mt-1">There was an error loading your team information</p>
        <button
          onClick={() => mutate()}
          className="mt-6 px-5 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 rounded-lg text-sm font-medium transition-colors border border-rose-500/25 min-h-[44px]"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Changes since the user's last planning visit */}
      {planChanges.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-950/25 px-4 py-3">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-300 mb-1">
                Since you last planned
              </p>
              <ul className="space-y-0.5">
                {planChanges.map((c, i) => (
                  <li key={i} className="text-sm text-amber-200/90">
                    {c.message}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setPlanChanges([])}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-amber-400/60 hover:text-amber-300 transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ============ STICKY PLANNING TRAY (all viewports) ============ */}
      <div className="sticky top-14 z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 py-2.5 bg-[#06090f]/95 backdrop-blur-lg border-b border-white/[0.08] lg:border lg:rounded-xl lg:bg-[#0c1219] lg:p-4">
        <div className="flex items-start justify-between gap-3">
          <PlanningTray data={data} cascadeResults={rosterCascade?.results} className="flex-1 min-w-0" />
          <RefreshFromSleeper
            leagueId={leagueId}
            compact
            className="flex-shrink-0"
            onRefreshed={() => {
              mutate();
              mutateCascade();
              mutateVerification();
            }}
          />
        </div>
      </div>

      {/* ============ MOBILE: compact rows ============ */}
      <div className="lg:hidden space-y-5">
        {/* Current keepers */}
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
            <Star size={14} className="text-amber-400" />
            Your Keepers
            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[11px] font-bold tabular-nums">
              {currentKeepers.length}
            </span>
          </h2>
          {currentKeepers.length > 0 ? (
            <div className="space-y-1.5">
              {currentKeepers.map((p) => {
                const cascadeResult = rosterCascade?.results.find(
                  (r) => r.playerId === p.player.sleeperId
                );
                return (
                  <KeeperRow
                    key={p.player.id}
                    entry={p}
                    liveCost={cascadeResult?.finalCost}
                    cascaded={cascadeResult?.cascaded ?? false}
                    onClick={() => setSheetPlayerId(p.player.id)}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-3 text-center bg-[#0c1219] border border-white/[0.08] rounded-lg">
              No keepers selected yet — pick from the list below
            </p>
          )}

          {/* Sleeper handoff — the plan's exit into Sleeper */}
          {currentKeepers.length > 0 && (
            <button
              onClick={() => setShowHandoff(true)}
              className="w-full flex items-center justify-center gap-2 mt-2 min-h-[48px] rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-bold transition-colors"
            >
              <Send size={15} />
              Set these in Sleeper
            </button>
          )}
        </section>

        {/* Eligible players */}
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
            <Users size={14} className="text-blue-400" />
            Eligible Players
            <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 text-[11px] font-bold tabular-nums">
              {eligiblePlayers.length}
            </span>
            <span className="ml-auto text-[11px] font-normal text-slate-500">sorted by cost</span>
          </h2>
          {eligiblePlayers.length > 0 ? (
            <div className="space-y-1.5">
              {eligiblePlayers.map((p) => (
                <KeeperRow
                  key={p.player.id}
                  entry={p}
                  onClick={() => setSheetPlayerId(p.player.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-3 text-center">No eligible players available</p>
          )}
        </section>

        {/* Ineligible — collapsed one-liners */}
        {ineligiblePlayers.length > 0 && (
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-slate-500 hover:text-slate-300 py-2 min-h-[44px] text-xs font-semibold uppercase tracking-wider">
              Ineligible Players ({ineligiblePlayers.length})
              <span className="text-slate-600 group-open:hidden font-normal normal-case">Tap to expand</span>
            </summary>
            <div className="space-y-1.5 mt-1">
              {ineligiblePlayers.map((p) => (
                <KeeperRow
                  key={p.player.id}
                  entry={p}
                  onClick={() => setSheetPlayerId(p.player.id)}
                />
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ============ DESKTOP: rich card grid ============ */}
      <div className="hidden lg:block space-y-6">
        {/* Draft Capital */}
        {draftPicksData &&
          (() => {
            const thisRoster = draftPicksData.rosters.find((r) => r.id === rosterId);
            if (!thisRoster?.sleeperId) return null;

            const keepersForCapital = currentKeepers.map((p) => {
              const cascadeResult = rosterCascade?.results.find(
                (r) => r.playerId === p.player.sleeperId
              );
              return {
                id: p.existingKeeper?.id || p.player.id,
                sleeperId: p.player.sleeperId,
                player: {
                  fullName: p.player.fullName,
                  position: p.player.position,
                  team: p.player.team,
                  sleeperId: p.player.sleeperId,
                },
                finalCost: cascadeResult?.finalCost ?? p.existingKeeper?.finalCost ?? 1,
                type: p.existingKeeper?.type || "REGULAR",
                yearsKept: p.eligibility.consecutiveYears || 1,
              };
            });

            const maxDraftRound = draftPicksData.picks.reduce(
              (max, pick) => Math.max(max, pick.round),
              0
            );
            const draftRounds = Math.max(maxDraftRound, 16);

            return (
              <div className="bg-[#0c1219] border border-white/[0.08] rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/[0.08]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                      <FileText className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-white">Draft Capital & Keepers</h2>
                  </div>
                </div>
                <div className="p-5">
                  <DraftCapital
                    picks={draftPicksData.picks}
                    allPicks={draftPicksData.allPicks}
                    teamSleeperId={thisRoster.sleeperId}
                    teamName={thisRoster.teamName || undefined}
                    showSeasons={1}
                    maxRounds={draftRounds}
                    keepers={keepersForCapital}
                  />
                </div>
              </div>
            );
          })()}

        {/* Current Keepers */}
        <div className="bg-[#0c1219] border border-white/[0.08] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                <Star className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Current Keepers</h2>
              <span className="px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-400 text-xs font-bold">
                {currentKeepers.length}
              </span>
              {currentKeepers.length > 0 && (
                <button
                  onClick={() => setShowHandoff(true)}
                  className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
                >
                  <Send size={14} />
                  Set these in Sleeper
                </button>
              )}
            </div>
          </div>
          <div className="p-5">
            {currentKeepers.length > 0 ? (
              <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {currentKeepers.map((p) => (
                  <PremiumPlayerCard
                    key={p.player.id}
                    player={p.player}
                    eligibility={p.eligibility}
                    existingKeeper={p.existingKeeper}
                    onRemoveKeeper={(keeperId) => removeKeeper(keeperId, p.player.fullName)}
                    onShowHistory={setHistoryPlayerId}
                    isLoading={false}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-300 font-medium">No keepers selected yet</p>
                <p className="text-sm text-slate-500 mt-1">Add players from the eligible list below</p>
              </div>
            )}
          </div>
        </div>

        {/* Eligible Players */}
        <div className="bg-[#0c1219] border border-white/[0.08] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.08]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Eligible Players</h2>
                <span className="px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-400 text-xs font-medium">
                  {eligiblePlayers.length}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  Keep
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  Franchise Tag
                </span>
              </div>
            </div>
          </div>
          <div className="p-5">
            {eligiblePlayers.length > 0 ? (
              <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {eligiblePlayers.map((p) => (
                  <PremiumPlayerCard
                    key={p.player.id}
                    player={p.player}
                    eligibility={p.eligibility}
                    costs={p.costs}
                    onAddKeeper={(playerId, type) => {
                      const cost = type === "FRANCHISE" ? p.costs.franchise : p.costs.regular;
                      addKeeper(
                        playerId,
                        type,
                        p.player.fullName,
                        cost
                          ? {
                              baseCost: cost.baseCost,
                              finalCost: cost.finalCost,
                              yearsKept: p.eligibility.yearsKept,
                            }
                          : undefined
                      );
                    }}
                    onShowHistory={setHistoryPlayerId}
                    isLoading={false}
                    canAddFranchise={data.canAddMore.any && data.canAddMore.franchise}
                    canAddRegular={data.canAddMore.any && data.canAddMore.regular}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-500">No eligible players available</p>
              </div>
            )}
          </div>
        </div>

        {/* Ineligible Players */}
        {ineligiblePlayers.length > 0 && (
          <details className="group">
            <summary className="flex items-center gap-3 cursor-pointer hover:text-slate-300 transition-colors text-slate-500 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Ineligible Players ({ineligiblePlayers.length})
              </span>
              <span className="text-xs text-slate-600 group-open:hidden">Click to expand</span>
            </summary>
            <div className="mt-4 grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {ineligiblePlayers.map((p) => (
                <PremiumPlayerCard
                  key={p.player.id}
                  player={p.player}
                  eligibility={p.eligibility}
                  onShowHistory={setHistoryPlayerId}
                />
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Player detail sheet (mobile action surface) */}
      <PlayerDetailSheet
        entry={sheetEntry}
        isOpen={!!sheetEntry}
        onClose={() => setSheetPlayerId(null)}
        canAddFranchise={data.canAddMore.any && data.canAddMore.franchise}
        canAddRegular={data.canAddMore.any && data.canAddMore.regular}
        onAddKeeper={(playerId, type) => {
          const p = data.players.find((x) => x.player.id === playerId);
          if (!p) return;
          const cost = type === "FRANCHISE" ? p.costs.franchise : p.costs.regular;
          addKeeper(
            playerId,
            type,
            p.player.fullName,
            cost
              ? {
                  baseCost: cost.baseCost,
                  finalCost: cost.finalCost,
                  yearsKept: p.eligibility.yearsKept,
                }
              : undefined
          );
        }}
        onRemoveKeeper={(keeperId) => {
          const p = data.players.find((x) => x.existingKeeper?.id === keeperId);
          removeKeeper(keeperId, p?.player.fullName ?? "Player");
        }}
        onShowHistory={setHistoryPlayerId}
      />

      {/* Sleeper entry checklist */}
      <SleeperHandoffSheet
        isOpen={showHandoff}
        onClose={() => setShowHandoff(false)}
        keepers={handoffKeepers}
        season={data.season}
        leagueName={leagueName}
        teamName={teamName}
        sleeperLeagueId={sleeperLeagueId}
        rosterId={rosterId}
        verification={verification ?? null}
      />

      {/* Keeper History Modal */}
      <KeeperHistoryModal
        playerId={historyPlayerId || ""}
        isOpen={!!historyPlayerId}
        onClose={() => setHistoryPlayerId(null)}
      />
    </div>
  );
}
