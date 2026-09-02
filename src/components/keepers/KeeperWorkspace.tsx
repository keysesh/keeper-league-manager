"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Send,
  History,
  TrendingUp,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { KeeperHistoryModal } from "@/components/players/KeeperHistoryModal";
import { PlayerCutout } from "@/components/players/PlayerCutout";
import { teamWash } from "@/lib/design/identity";
import { RefreshFromSleeper } from "@/components/ui/RefreshFromSleeper";
import { DeadlineBanner } from "@/components/ui/DeadlineBanner";
import { CostTrajectory } from "@/components/ui/CostTrajectory";
import {
  ScreenHeader,
  SectionLabel,
  listCard,
  featureCard,
} from "@/components/league-screens";
import { cn, getPositionClasses } from "@/lib/design-tokens";
import { getDraftPickValue } from "@/lib/constants/league-config";
import { DEFAULT_KEEPER_RULES } from "@/lib/constants/keeper-rules";
import {
  diffPlanSnapshots,
  type PlanChange,
  type PlanSnapshot,
  type StoredPlanSnapshot,
} from "@/lib/keeper/plan-diff";
import { PlanningTray } from "./PlanningTray";
import { PlayerDetailSheet } from "./PlayerDetailSheet";
import {
  SleeperHandoffSheet,
  type HandoffKeeper,
  type HandoffVerification,
} from "./SleeperHandoffSheet";
import type { RosterData, CascadeData, EligiblePlayer } from "./types";

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

/** Surplus in pick points: market pick value − keeper cost pick value. */
function surplusFor(marketRound: number | undefined, cost: number): number | null {
  if (marketRound === undefined) return null;
  return getDraftPickValue(marketRound) - getDraftPickValue(cost);
}

/** Cost trajectory rows for the compact chips (current + following years). */
function trajectoryFor(
  cost: number,
  yearsKept: number,
  maxYears: number,
  season: number,
  isFranchise: boolean
) {
  if (isFranchise) {
    // Tags hold their round indefinitely — three flat chips, no final year
    return [0, 1, 2].map((y) => ({
      year: season + y,
      cost,
      isFinalYear: false,
    }));
  }
  const yearsRemaining = Math.max(1, maxYears - yearsKept);
  return Array.from({ length: Math.min(yearsRemaining, 3) }, (_, y) => ({
    year: season + y,
    cost: Math.max(cost - y * DEFAULT_KEEPER_RULES.COST_REDUCTION_PER_YEAR, DEFAULT_KEEPER_RULES.MINIMUM_ROUND),
    isFinalYear: y === yearsRemaining - 1,
  }));
}

function ordinal(n: number): string {
  const words = ["", "best", "second-best", "third-best", "fourth-best", "fifth-best", "sixth-best", "seventh-best", "eighth-best", "ninth-best", "tenth-best"];
  return words[n] ?? `${n}th-best`;
}

/**
 * My Keepers — the keeper value workspace (value-screens handoff).
 * Every keeper shows what it's worth versus what it costs; the roster
 * surplus card totals it. Selection (add/remove via the detail sheet),
 * plan diffing, verification, and the Sleeper handoff carry over unchanged.
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
    { revalidateOnFocus: true, revalidateIfStale: true, dedupingInterval: 0 }
  );

  // Live cascade — same source as the draft board, so costs always agree
  const { data: cascadeData, mutate: mutateCascade } = useSWR<CascadeData>(
    `/api/leagues/${leagueId}/keepers/cascade`,
    fetcher,
    { revalidateOnFocus: true }
  );

  // Round-trip verification: does Sleeper's draft board match the plan?
  const { data: verification, mutate: mutateVerification } = useSWR<HandoffVerification>(
    `/api/leagues/${leagueId}/keepers/verification?rosterId=${rosterId}`,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 60000 }
  );

  // League-wide surplus rank for the feature card pill
  const { data: economics } = useSWR<{
    teams: Array<{ rosterId: string; rank: number; surplus: number }>;
  }>(`/api/leagues/${leagueId}/keeper-economics`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000,
  });

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
                finalCost: costData?.finalCost || p.costs.regular?.price || 1,
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

      // All three, always: the cascade moves other players' slots when one is
      // added or removed, and verification compares the whole plan to Sleeper's
      // board. Revalidating only the roster list leaves those two panels
      // describing the plan as it was before the save.
      mutate();
      mutateCascade();
      mutateVerification();
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

      // All three, always: the cascade moves other players' slots when one is
      // added or removed, and verification compares the whole plan to Sleeper's
      // board. Revalidating only the roster list leaves those two panels
      // describing the plan as it was before the save.
      mutate();
      mutateCascade();
      mutateVerification();
    } catch (err) {
      mutate(data, { revalidate: false });
      showError(err instanceof Error ? err.message : "Failed to remove keeper");
    }
  };

  // Derived lists
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
          const priceOf = (p: EligiblePlayer) =>
            p.costs.regular?.price ?? p.costs.franchise?.price ?? 99;
          const diff = priceOf(a) - priceOf(b);
          if (diff !== 0) return diff;
          return (b.player.lastSeasonPpg ?? 0) - (a.player.lastSeasonPpg ?? 0);
        }),
    [data]
  );

  const ineligiblePlayers = useMemo(
    () => (data?.players ?? []).filter((p) => !p.eligibility.isEligible && !p.existingKeeper),
    [data]
  );

  const sheetEntry = data?.players.find((p) => p.player.id === sheetPlayerId) ?? null;

  /**
   * The round this player actually occupies on the draft board: the live
   * cascade slot once he is a keeper, falling back to his price before the
   * cascade has an answer. Distinct from priceOf() — see EligiblePlayer.costs.
   */
  const liveSlotOf = (p: EligiblePlayer) =>
    rosterCascade?.results.find((r) => r.playerId === p.player.sleeperId)?.finalCost ??
    p.existingKeeper?.finalCost ??
    p.costs.regular?.price ??
    1;

  /** What keeping this player costs, before the cascade moves him to a slot. */
  const priceOfPlayer = (p: EligiblePlayer) =>
    p.costs.regular?.price ?? p.costs.franchise?.price ?? null;

  // Roster surplus + bargain/fair/overpay split across the selected keepers
  const surplusSummary = useMemo(() => {
    let total = 0;
    let bargain = 0;
    let fair = 0;
    let overpay = 0;
    for (const p of currentKeepers) {
      const s = surplusFor(data?.marketRounds?.[p.player.id], liveSlotOf(p));
      if (s === null) {
        fair++;
        continue;
      }
      total += s;
      if (s > 2) bargain++;
      else if (s < -2) overpay++;
      else fair++;
    }
    return { total: Math.round(total), bargain, fair, overpay };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKeepers, data?.marketRounds, rosterCascade]);

  const myRank = economics?.teams.find((t) => t.rosterId === rosterId)?.rank;
  const teamCount = economics?.teams.length ?? 0;

  // ============================================================
  // "Since you last planned" — diff against the previous visit
  // ============================================================
  const [planChanges, setPlanChanges] = useState<PlanChange[]>([]);
  const diffedRef = useRef(false);
  const snapshotKey = `keeper-plan-snapshot-${rosterId}`;

  useEffect(() => {
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

    try {
      localStorage.setItem(
        snapshotKey,
        JSON.stringify({ season: data.season, plan: currentSnapshot })
      );
    } catch {
      // Storage unavailable — diffing just won't work on this device
    }
  }, [data, cascadeData, rosterId, snapshotKey]);

  // Keepers formatted for the Sleeper entry checklist
  const handoffKeepers: HandoffKeeper[] = useMemo(
    () =>
      currentKeepers.map((p) => ({
        sleeperId: p.player.sleeperId,
        playerName: p.player.fullName,
        position: p.player.position,
        finalCost:
          rosterCascade?.results.find((r) => r.playerId === p.player.sleeperId)?.finalCost ??
          p.existingKeeper?.finalCost ??
          1,
        type: p.existingKeeper?.type ?? "REGULAR",
      })),
    [currentKeepers, rosterCascade]
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-xl bg-white/[0.05]" />
        <Skeleton className="h-36 w-full rounded-2xl bg-white/[0.05]" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg bg-white/[0.03]" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#0c1219] border border-rose-500/20 rounded-xl p-8 text-center">
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

  const maxYears = data.keeperRules?.regularKeeperMaxYears ?? DEFAULT_KEEPER_RULES.REGULAR_KEEPER_MAX_YEARS;

  const keeperRow = (p: EligiblePlayer, selectable: boolean) => {
    const isKeeper = !!p.existingKeeper;
    // Two different rounds, and they are not interchangeable:
    //   price — what the keeper rules charge for him
    //   slot  — the pick the cascade actually spends, which slides off the
    //           price when the roster keeps two players at the same price
    // The trajectory escalates from the PRICE (that is what the rule moves),
    // while surplus is judged against the SLOT (that is the pick you give up).
    const price = priceOfPlayer(p) ?? 0;
    const slot = isKeeper ? liveSlotOf(p) : price;
    const slotDiffers = isKeeper && slot !== price && price > 0;
    const market = data.marketRounds?.[p.player.id];
    const surplus = slot ? surplusFor(market, slot) : null;
    const isTag = p.existingKeeper?.type === "FRANCHISE";
    const pos = getPositionClasses(p.player.position || "");

    return (
      <button
        key={p.player.id}
        onClick={() => setSheetPlayerId(p.player.id)}
        className={cn(
          "w-full grid grid-cols-[46px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.04]",
          !selectable && "opacity-60"
        )}
        // A selected keeper is lit by his NFL club; a candidate stays neutral,
        // so the list reads "these six are mine" before any text is parsed.
        style={isKeeper ? { background: teamWash(p.player.team, 0.4) } : undefined}
      >
        <PlayerCutout
          sleeperId={p.player.sleeperId}
          name={p.player.fullName}
          team={p.player.team}
          size={46}
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold tracking-[-0.015em] text-slate-50">
              {p.player.fullName}
            </span>
            {isTag && (
              <span className="shrink-0 rounded-[3px] border border-amber-500/[0.22] bg-amber-500/15 px-1 py-px font-mono text-[8.5px] font-semibold text-amber-400">
                TAG
              </span>
            )}
            {p.player.injuryStatus && (
              <AlertTriangle size={11} className="shrink-0 text-rose-400" />
            )}
          </span>
          <span className="mt-1 flex items-center gap-1.5">
            <span
              className={cn(
                "rounded border px-1.5 py-px text-[9px] font-semibold",
                pos.bg,
                pos.text,
                pos.border
              )}
            >
              {p.player.position || "?"}
            </span>
            {p.player.team && (
              <span className="text-[10px] font-medium text-slate-500">{p.player.team}</span>
            )}
            {price > 0 && (
              <CostTrajectory
                trajectory={trajectoryFor(price, p.eligibility.yearsKept, maxYears, data.season, isTag)}
                currentCost={price}
                yearsKept={p.eligibility.yearsKept}
                maxYears={isTag ? 99 : maxYears}
                compact
              />
            )}
            {!selectable && p.eligibility.reason && (
              <span className="truncate text-[10px] text-slate-600">{p.eligibility.reason}</span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="flex items-baseline gap-1.5">
            {slotDiffers && (
              // The price did not move — the cascade only slid which pick pays
              // it. Struck-through so the two numbers cannot be read as one.
              <span
                className="font-numeral text-[15px] leading-none text-slate-600 line-through"
                title={`Costs a round ${price}, but you already have a keeper there — this one takes your round ${slot} pick`}
              >
                R{price}
              </span>
            )}
            <span
              className={cn(
                "font-numeral text-[26px] leading-none",
                slotDiffers ? "text-amber-300" : "text-slate-50"
              )}
            >
              R{slotDiffers ? slot : price || "—"}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "font-mono text-[10px] font-semibold",
                surplus === null
                  ? "text-slate-600"
                  : surplus > 2
                    ? "text-emerald-400"
                    : surplus < -2
                      ? "text-rose-400"
                      : "text-slate-400"
              )}
            >
              {surplus === null ? "—" : surplus > 0 ? `+${surplus}` : `${surplus}`}
            </span>
            <span className="font-mono text-[10px] text-slate-600">
              {market ? `mkt R${market}` : "no est"}
            </span>
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="My Keepers"
        subtitle={`${teamName} · ${data.currentKeepers.total} of ${data.limits.maxKeepers} slots used`}
        right={
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
        }
      />

      {/* Changes since the user's last planning visit */}
      {planChanges.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-950/25 px-4 py-3">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-300 mb-1">Since you last planned</p>
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

      <DeadlineBanner leagueId={leagueId} />

      {/* Roster surplus feature card */}
      <div
        className={featureCard}
        style={{
          background:
            "linear-gradient(160deg, rgba(59,130,246,.16) 0%, rgba(139,92,246,.09) 42%, #0c1219 100%)",
          boxShadow: "0 0 34px -8px rgba(59,130,246,.28)",
        }}
      >
        <div className="flex items-start justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.07em] text-slate-400">
            Roster surplus
          </span>
          {myRank && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/25">
              <TrendingUp size={12} className="text-emerald-400" />
              <span className="font-mono text-[11px] font-semibold text-emerald-400">
                TOP {myRank}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span
            className={cn(
              "font-mono text-[38px] leading-none font-semibold tracking-[-0.035em]",
              surplusSummary.total >= 0 ? "text-emerald-400" : "text-rose-400"
            )}
          >
            {surplusSummary.total >= 0 ? `+${surplusSummary.total}` : surplusSummary.total}
          </span>
          <span className="text-xs font-medium text-slate-400">pick pts</span>
        </div>
        <p className="text-xs leading-normal text-slate-300 mt-2 max-w-[290px]">
          {surplusSummary.total >= 0
            ? `You keep ${surplusSummary.total} points of value more than the picks cost you`
            : `Your keepers cost ${Math.abs(surplusSummary.total)} points more than their market value`}
          {myRank && teamCount > 1 ? ` — ${ordinal(myRank)} in the league.` : "."}
        </p>
        {currentKeepers.length > 0 && (
          <>
            <div className="flex gap-px h-1.5 rounded-[3px] overflow-hidden mt-3">
              {surplusSummary.bargain > 0 && (
                <div
                  className="h-full"
                  style={{
                    flex: surplusSummary.bargain,
                    background: "linear-gradient(90deg, #34d399, #059669)",
                  }}
                />
              )}
              {surplusSummary.fair > 0 && (
                <div className="h-full bg-slate-600" style={{ flex: surplusSummary.fair }} />
              )}
              {surplusSummary.overpay > 0 && (
                <div
                  className="h-full"
                  style={{
                    flex: surplusSummary.overpay,
                    background: "linear-gradient(90deg, #fb7185, #e11d48)",
                  }}
                />
              )}
            </div>
            <div className="flex items-center gap-3 mt-2">
              {(
                [
                  ["#34d399", `${surplusSummary.bargain} bargain`],
                  ["#475569", `${surplusSummary.fair} fair`],
                  ["#fb7185", `${surplusSummary.overpay} overpay`],
                ] as const
              ).map(([color, label]) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className="w-[7px] h-[7px] rounded-sm" style={{ background: color }} />
                  <span className="text-[10.5px] font-medium text-slate-400">{label}</span>
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Slot state (compact tray keeps round conflicts visible) */}
      <PlanningTray data={data} cascadeResults={rosterCascade?.results} />

      <div>
        <SectionLabel label="Roster" right="COST PATH · SURPLUS" />
        <div className={listCard}>
          {currentKeepers.length > 0 ? (
            currentKeepers.map((p) => keeperRow(p, true))
          ) : (
            <p className="text-sm text-slate-500 py-4 text-center">
              No keepers selected yet — pick from the eligible list below
            </p>
          )}
        </div>

        {/* Explanatory note */}
        <div className="flex items-start gap-2 mt-2 px-2.5 py-2 rounded-lg bg-[#111822] border border-white/[0.06]">
          <Info size={13} className="text-slate-500 shrink-0 mt-px" />
          <p className="text-[10.5px] leading-[1.4] text-slate-400">
            Chips show this year&apos;s cost and the next two years — amber outline marks the final
            eligible year. Market rounds are estimated from last season&apos;s scoring.
          </p>
        </div>
      </div>

      {/* Actions */}
      {currentKeepers.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={() => setShowHandoff(true)}
            className="flex-1 flex items-center justify-center gap-2 min-h-[44px] rounded-[10px] bg-blue-500 hover:bg-blue-400 text-white text-[13px] font-semibold transition-colors duration-150"
            style={{ boxShadow: "0 8px 20px -6px rgba(59,130,246,.55)" }}
          >
            <Send size={15} />
            Submit to Sleeper
          </button>
          <Link
            href={`/league/${leagueId}/activity`}
            aria-label="League activity history"
            className="flex items-center justify-center w-11 min-h-[44px] rounded-[10px] bg-[#1c2840] hover:bg-[#253654] text-slate-300 transition-colors duration-150"
          >
            <History size={16} />
          </Link>
        </div>
      )}

      {/* Eligible players — the selection pool */}
      <div>
        <SectionLabel label="Eligible players" right="COST · MKT" />
        <div className={listCard}>
          {eligiblePlayers.length > 0 ? (
            eligiblePlayers.map((p) => keeperRow(p, true))
          ) : (
            <p className="text-sm text-slate-500 py-4 text-center">No eligible players available</p>
          )}
        </div>
      </div>

      {/* Ineligible — collapsed */}
      {ineligiblePlayers.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-slate-500 hover:text-slate-300 py-2 min-h-[44px] text-xs font-semibold uppercase tracking-wider">
            Ineligible Players ({ineligiblePlayers.length})
            <span className="text-slate-600 group-open:hidden font-normal normal-case">
              Tap to expand
            </span>
          </summary>
          <div className={listCard}>{ineligiblePlayers.map((p) => keeperRow(p, false))}</div>
        </details>
      )}

      {/* Player detail sheet (add/remove actions) */}
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
                  baseCost: cost.startingRound,
                  finalCost: cost.price,
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
