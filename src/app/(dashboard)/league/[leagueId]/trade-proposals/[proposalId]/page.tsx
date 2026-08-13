"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Ticket } from "lucide-react";
import {
  EditorialScreen,
  EditorialHeader,
  EditorialCard,
  SectionLabel,
  Footnote,
  rowHairline,
} from "@/components/editorial";
import { Headshot } from "@/components/editorial/Headshot";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn, editorialPositionColor } from "@/lib/design-tokens";
import { isCurrentlyAfterTradeDeadline } from "@/lib/constants/keeper-rules";

/**
 * Draft trade — editorial review of a proposal (design handoff Aug 2026).
 *
 * NOTE: this page previously rendered against a `team1`/`team2` response
 * shape the API has never returned (every load crashed into the league
 * error boundary). It is now wired to the real contract:
 * parties[] with per-party sending/receiving assets, APPROVE/VETO/ABSTAIN
 * votes, and userContext for what the viewer may do.
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
  fromRoster: { id: string; teamName: string | null } | null;
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

export default function TradeProposalDetailPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const proposalId = params.proposalId as string;

  const [data, setData] = useState<ProposalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [copied, setCopied] = useState(false);

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

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <EditorialScreen>
        <div className="px-5 pt-2 space-y-4">
          <Skeleton className="h-10 w-40 rounded-md" />
          <Skeleton className="h-56 w-full rounded-md" />
        </div>
      </EditorialScreen>
    );
  }

  if (error && !data) {
    return (
      <EditorialScreen>
        <EditorialHeader title="Draft trade" />
        <div className="px-5 py-4 border-t border-[rgba(214,255,232,.10)]">
          <p className="text-[13px] text-[#d4674a]">{error}</p>
          <Link
            href={`/league/${leagueId}/trade-proposals`}
            className="mt-3 inline-block text-[13px] font-medium text-[#a8ac9d] underline underline-offset-4"
          >
            Back to proposals
          </Link>
        </div>
      </EditorialScreen>
    );
  }
  if (!data) return null;

  const { proposal, userContext } = data;
  const myParty = userContext.rosterId
    ? proposal.parties.find((p) => p.rosterId === userContext.rosterId)
    : undefined;
  const otherParties = proposal.parties.filter((p) => p !== myParty);
  const statusLabel = STATUS_LABEL[proposal.status] || proposal.status.toLowerCase();
  const hasPlayers = proposal.parties.some((p) =>
    [...p.assets.sending, ...p.assets.receiving].some((a) => a.type === "PLAYER")
  );
  const resetsYears = hasPlayers && isCurrentlyAfterTradeDeadline();

  const assetRows = (assets: Asset[]) => (
    <>
      {assets.map((a) =>
        a.type === "PLAYER" && a.player ? (
          <div key={a.id} className={cn("flex items-center gap-3 px-5 py-3", rowHairline)}>
            <Headshot sleeperId={a.player.sleeperId} size={36} alt={a.player.fullName} />
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] leading-[1.2] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                {a.player.fullName}
              </span>
              <span className="block text-[11.5px] leading-none text-[#93a08f] mt-1.5">
                <span style={{ color: editorialPositionColor(a.player.position) }}>
                  {a.player.position}
                </span>
                {" · "}
                {a.player.team || "FA"}
                {resetsYears ? " · resets to 0 yrs" : ""}
              </span>
            </span>
          </div>
        ) : (
          <div key={a.id} className={cn("flex items-center gap-3 px-5 py-3", rowHairline)}>
            <span className="w-9 flex justify-center shrink-0 text-[#93a08f]">
              <Ticket size={17} strokeWidth={1.7} />
            </span>
            <span className="flex-1 text-[13px] leading-[1.5] text-[#a8ac9d]">
              {a.type === "DRAFT_PICK"
                ? `${a.pickSeason} round ${a.pickRound}`
                : "player no longer rostered"}
            </span>
          </div>
        )
      )}
      {assets.length === 0 && (
        <div className={cn("px-5 py-3 text-[13px] text-[#93a08f]", rowHairline)}>Nothing</div>
      )}
    </>
  );

  return (
    <EditorialScreen>
      <EditorialHeader
        title="Draft trade"
        sub={
          myParty && otherParties.length > 0
            ? `with ${otherParties.map((p) => p.teamName || "a team").join(", ")} · ${statusLabel}`
            : `${proposal.parties.map((p) => p.teamName || "a team").join(" ↔ ")} · ${statusLabel}`
        }
      />

      {resetsYears && (
        <EditorialCard className="mb-5 !border-[rgba(201,146,47,.3)] !py-3.5">
          <span className="block text-[12.5px] leading-[1.45] font-medium text-[#c9922f]">
            Years kept reset after the deadline
          </span>
          <span className="block text-xs leading-[1.6] text-[#a8ac9d] mt-[7px]">
            Traded players restart at zero years kept with their new team. Keeper
            rounds are unchanged.
          </span>
        </EditorialCard>
      )}

      {myParty ? (
        <>
          <SectionLabel label="YOU GIVE" />
          {assetRows(myParty.assets.sending)}
          <SectionLabel label="YOU GET" className="pt-5" />
          {assetRows(myParty.assets.receiving)}
        </>
      ) : (
        proposal.parties.map((party, i) => (
          <div key={party.rosterId}>
            <SectionLabel
              label={`${(party.teamName || "TEAM").toUpperCase()} SENDS`}
              className={i > 0 ? "pt-5" : undefined}
            />
            {assetRows(party.assets.sending)}
          </div>
        ))
      )}

      {proposal.notes && (
        <div className="px-5 pt-4 text-[12.5px] leading-[1.6] text-[#a8ac9d]">
          {proposal.notes}
        </div>
      )}

      {(userContext.canRespond || userContext.canVote) && (
        <div className="px-4 pt-5 pb-1 grid gap-3">
          {userContext.canVote && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment with your vote (optional)"
              rows={2}
              maxLength={500}
              className="w-full px-3.5 py-3 bg-[#131b17] border border-[rgba(214,255,232,.10)] rounded-lg text-[13px] text-[#eee7da] placeholder-[#93a08f] focus:outline-none focus:border-[rgba(214,255,232,.16)] resize-none"
            />
          )}
          <button
            onClick={() =>
              userContext.canRespond
                ? act({ body: { action: "accept" } })
                : act({
                    query: "?action=vote",
                    body: { vote: "APPROVE", comment: comment || undefined },
                  })
            }
            disabled={busy}
            className="w-full text-center text-sm font-medium p-[15px] min-h-[44px] rounded-lg bg-[#a8401f] hover:bg-[#bd4a26] active:bg-[#8f3517] text-[#fdf6e8] transition-colors disabled:opacity-50"
          >
            {userContext.canRespond ? "Accept trade" : "Approve"}
          </button>
          <button
            onClick={() =>
              userContext.canRespond
                ? act({ body: { action: "reject" } })
                : act({
                    query: "?action=vote",
                    body: { vote: "VETO", comment: comment || undefined },
                  })
            }
            disabled={busy}
            className="w-full text-center text-sm font-medium p-[15px] min-h-[44px] rounded-lg border border-[rgba(214,255,232,.16)] text-[#a8ac9d] hover:bg-[rgba(214,255,232,.05)] transition-colors disabled:opacity-50"
          >
            {userContext.canRespond ? "Decline" : "Veto"}
          </button>
        </div>
      )}

      {error && (
        <p className="px-5 pt-3 text-[12.5px] text-[#d4674a]">{error}</p>
      )}

      <div className="px-4 pb-1 grid">
        <button
          onClick={copyShareLink}
          className="w-full text-center text-[13px] font-medium min-h-[44px] text-[#93a08f]"
        >
          {copied ? "Link copied" : "Copy share link"}
        </button>
      </div>

      <SectionLabel label="PARTIES" className="pt-3" />
      {proposal.parties.map((p) => (
        <div
          key={p.rosterId}
          className={cn("flex items-center justify-between px-5 py-3", rowHairline)}
        >
          <span className="text-[13.5px] leading-none font-medium">
            {p.teamName || "Team"}
            {p.rosterId === userContext.rosterId && (
              <span className="font-plex-mono text-[10px] font-medium text-[#d4674a] ml-[7px]">
                you
              </span>
            )}
          </span>
          <span className="font-plex-mono text-xs text-[#93a08f]">
            {p.status.toLowerCase()}
          </span>
        </div>
      ))}

      {(proposal.votes.approve > 0 ||
        proposal.votes.veto > 0 ||
        proposal.votes.details.length > 0) && (
        <>
          <SectionLabel
            label="LEAGUE VOTES"
            right={`${proposal.votes.approve}–${proposal.votes.veto}${
              proposal.votes.isVetoed ? " · vetoed" : ""
            }`}
            className="pt-5"
          />
          {proposal.votes.details.map((v, i) => (
            <div key={i} className={cn("px-5 py-3", rowHairline)}>
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] leading-none font-medium">
                  {v.teamName || "Team"}
                </span>
                <span className="font-plex-mono text-xs text-[#93a08f]">
                  {v.vote.toLowerCase()}
                </span>
              </div>
              {v.comment && (
                <p className="text-[12.5px] leading-[1.6] text-[#a8ac9d] mt-1.5">{v.comment}</p>
              )}
            </div>
          ))}
        </>
      )}

      {userContext.canCancel && (
        <div className="px-4 pt-4">
          <button
            onClick={() => {
              if (confirm("Cancel this proposal?")) act("delete");
            }}
            disabled={busy}
            className="w-full text-center text-[13px] font-medium min-h-[44px] text-[#d4674a] disabled:opacity-50"
          >
            Cancel proposal
          </button>
        </div>
      )}

      <Footnote>
        Trades execute in Sleeper — proposals here gather the league&apos;s read
        before anyone commits.
      </Footnote>
    </EditorialScreen>
  );
}
