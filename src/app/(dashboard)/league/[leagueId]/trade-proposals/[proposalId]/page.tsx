"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Layers, X } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { PickValueBadge } from "@/components/ui/DraftPickValueChart";
import {
  ScreenHeader,
  HeaderIconButton,
  listCard,
  featureCard,
} from "@/components/league-screens";
import { cn, getPositionClasses } from "@/lib/design-tokens";

/**
 * Trade Proposal — judge a draft-capital trade before acting on it
 * (value-screens handoff). Wired to the real parties/assets/userContext
 * contract; asset values arrive on the draft-pick-points scale with player
 * values estimated from market rounds (labeled as estimates).
 */

interface Asset {
  id: string;
  type: "PLAYER" | "DRAFT_PICK";
  player: {
    id: string;
    sleeperId: string;
    fullName: string;
    position: string | null;
    team: string | null;
  } | null;
  pickSeason: number | null;
  pickRound: number | null;
  estimatedValue: number | null;
  marketRound: number | null;
}

interface Party {
  rosterId: string;
  teamName: string | null;
  status: string;
  assets: { sending: Asset[]; receiving: Asset[] };
}

interface ProposalResponse {
  proposal: {
    id: string;
    title: string;
    notes: string | null;
    status: string;
    createdAt: string;
    parties: Party[];
    votes: {
      approve: number;
      veto: number;
      abstain: number;
      vetoThreshold: number;
      isVetoed: boolean;
      details: Array<{
        rosterId: string;
        teamName: string | null;
        vote: "APPROVE" | "VETO" | "ABSTAIN";
        comment: string | null;
      }>;
    };
  };
  userContext: {
    rosterId: string | null;
    isProposer: boolean;
    isParty: boolean;
    canRespond: boolean;
    canVote: boolean;
    canCancel: boolean;
    userVote?: string;
  };
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "awaiting response",
  ACCEPTED: "accepted",
  REJECTED: "declined",
  VETOED: "vetoed",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
};

const TIER_NAME = (round: number) =>
  round === 1 ? "Elite" : round <= 3 ? "Premium" : round <= 6 ? "Starter" : round <= 10 ? "Depth" : "Lottery";

export default function TradeProposalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.leagueId as string;
  const proposalId = params.proposalId as string;

  const [data, setData] = useState<ProposalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");

  const fetchProposal = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/trade-proposals/${proposalId}`);
      if (!res.ok) throw new Error("Failed to fetch proposal");
      setData(await res.json());
      setError("");
    } catch {
      setError("Failed to load trade proposal");
    } finally {
      setLoading(false);
    }
  }, [leagueId, proposalId]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  const act = async (init: { query?: string; body: Record<string, unknown> } | "delete") => {
    setBusy(true);
    try {
      const res =
        init === "delete"
          ? await fetch(`/api/leagues/${leagueId}/trade-proposals/${proposalId}`, {
              method: "DELETE",
            })
          : await fetch(
              `/api/leagues/${leagueId}/trade-proposals/${proposalId}${init.query || ""}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(init.body),
              }
            );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Action failed");
      }
      setComment("");
      await fetchProposal();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const view = useMemo(() => {
    if (!data) return null;
    const { proposal, userContext } = data;
    const myParty = userContext.rosterId
      ? proposal.parties.find((p) => p.rosterId === userContext.rosterId)
      : undefined;
    // Third parties judge from the first party's perspective, labeled as such
    const perspective = myParty ?? proposal.parties[0];
    const other = proposal.parties.find((p) => p !== perspective);
    const sum = (assets: Asset[]) =>
      assets.reduce((s, a) => s + (a.estimatedValue ?? 0), 0);
    const sendTotal = Math.round(sum(perspective?.assets.sending ?? []));
    const getTotal = Math.round(sum(perspective?.assets.receiving ?? []));
    const net = getTotal - sendTotal;
    const larger = Math.max(sendTotal, getTotal, 1);
    const advantagePct = Math.round((Math.abs(net) / larger) * 100);
    return { proposal, userContext, myParty, perspective, other, sendTotal, getTotal, net, advantagePct };
  }, [data]);

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-12 w-52 rounded-lg" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-2xl">
        <div className="bg-[#0c1219] border border-rose-500/20 rounded-xl p-6">
          <p className="text-rose-400 font-medium">{error}</p>
          <Link
            href={`/league/${leagueId}/trade-proposals`}
            className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300"
          >
            Back to proposals
          </Link>
        </div>
      </div>
    );
  }
  if (!view) return null;

  const { proposal, userContext, myParty, perspective, other, sendTotal, getTotal, net, advantagePct } = view;
  const statusLabel = STATUS_LABEL[proposal.status] || proposal.status.toLowerCase();
  const favorable = net >= 0;
  const youLabel = myParty ? "You" : perspective?.teamName || "Team";
  const netTint = favorable
    ? {
        background:
          "linear-gradient(160deg, rgba(16,185,129,.15) 0%, rgba(6,182,212,.07) 45%, #0c1219 100%)",
        boxShadow: "0 0 34px -10px rgba(16,185,129,.3)",
      }
    : {
        background:
          "linear-gradient(160deg, rgba(244,63,94,.14) 0%, rgba(239,68,68,.06) 45%, #0c1219 100%)",
        boxShadow: "0 0 34px -10px rgba(244,63,94,.28)",
      };

  const assetRow = (a: Asset) => {
    const value = a.estimatedValue !== null ? Math.round(a.estimatedValue) : null;
    if (a.type === "PLAYER" && a.player) {
      const pos = getPositionClasses(a.player.position || "");
      return (
        <div key={a.id} className="flex items-center gap-3 px-[13px] py-3">
          <PlayerAvatar sleeperId={a.player.sleeperId} name={a.player.fullName} size="sm" />
          <span className="flex-1 min-w-0">
            <span className="block text-[13.5px] font-medium text-slate-50 truncate">
              {a.player.fullName}
            </span>
            <span className="flex items-center gap-1.5 mt-1">
              <span className={cn("px-1.5 py-px rounded text-[9px] font-semibold border", pos.bg, pos.text, pos.border)}>
                {a.player.position || "?"}
              </span>
              <span className="text-[11px] text-slate-500">
                {a.player.team || "FA"}
                {a.marketRound ? ` · mkt R${a.marketRound}` : " · no estimate"}
              </span>
            </span>
          </span>
          <span className="font-mono text-[13px] font-semibold text-slate-200 shrink-0">
            {value ?? "—"}
          </span>
        </div>
      );
    }
    return (
      <div key={a.id} className="flex items-center gap-3 px-[13px] py-3">
        <span className="flex items-center justify-center w-9 h-9 rounded-[9px] bg-[#141c2b] border border-white/[0.08] text-slate-400 shrink-0">
          <Layers size={16} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13.5px] font-medium text-slate-50">
            {a.pickSeason} Round {a.pickRound}
          </span>
          <span className="flex items-center gap-1.5 mt-1">
            {a.pickRound && <PickValueBadge round={a.pickRound} />}
            {a.pickRound && (
              <span className="text-[11px] text-slate-500">{TIER_NAME(a.pickRound)} tier</span>
            )}
          </span>
        </span>
        <span className="font-mono text-[13px] font-semibold text-slate-200 shrink-0">
          {value ?? "—"}
        </span>
      </div>
    );
  };

  const sectionLabel = (label: string, total: number, tone: "send" | "get") => (
    <div className="flex items-center gap-3 px-1 mb-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 shrink-0">
        {label}
      </span>
      <span className="flex-1 h-px bg-white/[0.06]" />
      <span
        className={cn(
          "font-mono text-[11px] font-semibold shrink-0",
          tone === "send" ? "text-rose-400" : "text-emerald-400"
        )}
      >
        {tone === "send" ? `−${total}` : `+${total}`}
      </span>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-4">
      <ScreenHeader
        title="Trade Proposal"
        subtitle={
          other
            ? `${myParty ? "with" : `${perspective?.teamName || "Team"} ↔`} ${other.teamName || "a team"} · ${statusLabel}`
            : statusLabel
        }
        right={
          <HeaderIconButton
            label="Back to proposals"
            onClick={() => router.push(`/league/${leagueId}/trade-proposals`)}
          >
            <X size={19} />
          </HeaderIconButton>
        }
      />

      {/* Verdict card */}
      <div className={featureCard} style={netTint}>
        <div className="flex items-start justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.07em] text-slate-400">
            Net value to {youLabel.toLowerCase() === "you" ? "you" : youLabel}
          </span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded-md font-mono text-[11px] font-semibold border",
              favorable
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                : "bg-rose-500/15 text-rose-400 border-rose-500/25"
            )}
          >
            {net === 0 ? "EVEN" : favorable ? (myParty ? "FAVORS YOU" : "FAVORS THEM") : (myParty ? "FAVORS THEM" : "FAVORS YOU")}
          </span>
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span
            className={cn(
              "font-mono text-[34px] leading-none font-semibold tracking-[-0.035em]",
              favorable ? "text-emerald-400" : "text-rose-400"
            )}
          >
            {net > 0 ? `+${net}` : net}
          </span>
          <span className="text-xs font-medium text-slate-400">pick pts</span>
        </div>

        {/* Fulcrum bar */}
        <div className="relative h-2 rounded bg-[#080d14] mt-3.5 overflow-hidden">
          <span className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.22]" />
          {net !== 0 && (
            <span
              className="absolute top-0 bottom-0"
              style={{
                left: favorable ? "50%" : `${50 - advantagePct / 2}%`,
                width: `${advantagePct / 2}%`,
                background: favorable
                  ? "linear-gradient(90deg, #059669, #34d399)"
                  : "linear-gradient(90deg, #e11d48, #fb7185)",
                borderRadius: favorable ? "0 4px 4px 0" : "4px 0 0 4px",
              }}
            />
          )}
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10.5px] font-medium">
          <span className="text-slate-500">{other?.teamName || "Them"}</span>
          <span className="text-slate-300">Even</span>
          <span className={favorable ? "text-emerald-400" : "text-slate-500"}>{youLabel}</span>
        </div>

        <p className="text-xs leading-normal text-slate-300 mt-3">
          {myParty ? "You" : perspective?.teamName || "This side"} send{myParty ? "" : "s"}{" "}
          {sendTotal} points of estimated value and get{myParty ? "" : "s"} back {getTotal} — a{" "}
          {advantagePct}% edge {net >= 0 ? "in" : "against"} {myParty ? "your" : "their"} favor.
          Player values are estimated from last season&apos;s scoring.
        </p>
      </div>

      <div>
        {sectionLabel(myParty ? "You send" : `${perspective?.teamName || "Team"} sends`, sendTotal, "send")}
        <div className={listCard}>
          {(perspective?.assets.sending.length ?? 0) > 0 ? (
            perspective!.assets.sending.map(assetRow)
          ) : (
            <p className="text-sm text-slate-500 py-3.5 text-center">Nothing</p>
          )}
        </div>
      </div>

      <div>
        {sectionLabel(myParty ? "You get" : `${perspective?.teamName || "Team"} gets`, getTotal, "get")}
        <div className={listCard}>
          {(perspective?.assets.receiving.length ?? 0) > 0 ? (
            perspective!.assets.receiving.map(assetRow)
          ) : (
            <p className="text-sm text-slate-500 py-3.5 text-center">Nothing</p>
          )}
        </div>
      </div>

      {proposal.notes && (
        <p className="px-1 text-xs leading-normal text-slate-400">{proposal.notes}</p>
      )}

      {/* Actions */}
      {(userContext.canRespond || userContext.canVote) && (
        <div className="space-y-2.5">
          {userContext.canVote && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment with your vote (optional)"
              rows={2}
              maxLength={500}
              className="w-full px-3.5 py-3 bg-[#0c1219] border border-white/[0.08] rounded-lg text-[13px] text-slate-50 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 resize-none"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() =>
                userContext.canRespond
                  ? act({ body: { action: "accept" } })
                  : act({ query: "?action=vote", body: { vote: "APPROVE", comment: comment || undefined } })
              }
              disabled={busy}
              className="flex-1 min-h-[44px] rounded-[10px] text-[13px] font-semibold text-white transition-all duration-150 disabled:opacity-50"
              style={{
                background: "linear-gradient(90deg, #2563eb, #7c3aed)",
                boxShadow: "0 8px 22px -6px rgba(59,130,246,.5)",
              }}
            >
              {userContext.canRespond ? "Accept trade" : "Approve"}
            </button>
            <button
              onClick={() =>
                userContext.canRespond
                  ? act({ body: { action: "reject" } })
                  : act({ query: "?action=vote", body: { vote: "VETO", comment: comment || undefined } })
              }
              disabled={busy}
              className="min-h-[44px] px-4 rounded-[10px] bg-[#1c2840] hover:bg-[#253654] border border-white/[0.08] text-[13px] font-semibold text-slate-300 transition-colors duration-150 disabled:opacity-50"
            >
              {userContext.canRespond ? "Decline" : "Veto"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose-400 px-1">{error}</p>}

      {/* Parties + votes */}
      <div className={listCard}>
        {proposal.parties.map((p) => (
          <div key={p.rosterId} className="flex items-center justify-between px-[13px] py-3">
            <span className="text-[13px] font-medium text-slate-50">
              {p.teamName || "Team"}
              {p.rosterId === userContext.rosterId && (
                <span className="ml-2 px-1.5 py-px rounded text-[9px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20">
                  YOU
                </span>
              )}
            </span>
            <span className="font-mono text-[11px] text-slate-500">{p.status.toLowerCase()}</span>
          </div>
        ))}
        {proposal.votes.details.map((v, i) => (
          <div key={`v-${i}`} className="px-[13px] py-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-slate-300">{v.teamName || "Team"}</span>
              <span
                className={cn(
                  "font-mono text-[11px] font-semibold",
                  v.vote === "APPROVE" ? "text-emerald-400" : v.vote === "VETO" ? "text-rose-400" : "text-slate-500"
                )}
              >
                {v.vote.toLowerCase()}
              </span>
            </div>
            {v.comment && <p className="text-xs text-slate-500 mt-1">{v.comment}</p>}
          </div>
        ))}
      </div>

      {userContext.canCancel && (
        <button
          onClick={() => {
            if (confirm("Cancel this proposal?")) act("delete");
          }}
          disabled={busy}
          className="w-full min-h-[44px] text-[13px] font-medium text-rose-400/80 hover:text-rose-400 transition-colors disabled:opacity-50"
        >
          Cancel proposal
        </button>
      )}
    </div>
  );
}
