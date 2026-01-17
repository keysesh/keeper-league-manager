"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ThumbsUp, ThumbsDown, MessageCircle, Clock, User, Copy, Check, Trash2, ArrowLeftRight } from "lucide-react";
import { PositionBadge } from "@/components/ui/PositionBadge";

interface TradeProposal {
  id: string;
  title: string;
  status: string;
  team1: {
    rosterId: string;
    rosterName: string;
    players: string[];
    playerDetails: Array<{ id: string; name: string; position: string }>;
    picks: Array<{ season: number; round: number }>;
  };
  team2: {
    rosterId: string;
    rosterName: string;
    players: string[];
    playerDetails: Array<{ id: string; name: string; position: string }>;
    picks: Array<{ season: number; round: number }>;
  };
  analysis?: {
    fairnessScore: number;
    team1NetValue: number;
    team2NetValue: number;
  };
  votes: {
    approve: Array<{ userId: string; userName: string; timestamp: string }>;
    reject: Array<{ userId: string; userName: string; timestamp: string }>;
    comments: Array<{ userId: string; userName: string; comment: string; timestamp: string }>;
  };
  notes?: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export default function TradeProposalDetailPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const proposalId = params.proposalId as string;

  const [proposal, setProposal] = useState<TradeProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [voting, setVoting] = useState(false);
  const [comment, setComment] = useState("");
  const [copied, setCopied] = useState(false);
  const [userVote, setUserVote] = useState<"approve" | "reject" | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProposal = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/trade-proposals/${proposalId}`);
      if (!res.ok) throw new Error("Failed to fetch proposal");
      const data = await res.json();
      setProposal(data.proposal);
    } catch {
      setError("Failed to load trade proposal");
    } finally {
      setLoading(false);
    }
  }, [leagueId, proposalId]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  const submitVote = async (vote: "approve" | "reject") => {
    setVoting(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/trade-proposals/${proposalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote, comment: comment || undefined }),
      });

      if (!res.ok) throw new Error("Failed to vote");

      const data = await res.json();
      setUserVote(data.votes.userVote);
      setComment("");
      await fetchProposal(); // Refresh to get updated votes
    } catch {
      setError("Failed to submit vote");
    } finally {
      setVoting(false);
    }
  };

  const deleteProposal = async () => {
    if (!confirm("Are you sure you want to close this proposal?")) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/trade-proposals/${proposalId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      // Redirect back to list
      window.location.href = `/league/${leagueId}/trade-proposals`;
    } catch {
      setError("Failed to close proposal");
      setDeleting(false);
    }
  };

  const copyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-800 rounded w-48 mb-4"></div>
          <div className="h-4 bg-gray-800 rounded w-64 mb-8"></div>
          <div className="card-premium rounded-2xl p-6 mb-4">
            <div className="h-6 bg-gray-800 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-800 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-800 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <p className="text-red-400 font-medium">{error || "Proposal not found"}</p>
          <Link
            href={`/league/${leagueId}/trade-proposals`}
            className="text-amber-400 hover:text-amber-300 mt-4 inline-block"
          >
            &larr; Back to proposals
          </Link>
        </div>
      </div>
    );
  }

  const isActive = proposal.status !== "closed";
  const totalVotes = (proposal.votes?.approve?.length || 0) + (proposal.votes?.reject?.length || 0);
  const approvalPercentage = totalVotes > 0
    ? Math.round((proposal.votes?.approve?.length || 0) / totalVotes * 100)
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/league/${leagueId}/trade-proposals`}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-amber-400 text-sm mb-4 transition-colors"
        >
          <span>&larr;</span>
          <span>Back to Proposals</span>
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                {proposal.title}
              </h1>
              {proposal.status === "closed" ? (
                <span className="px-3 py-1 bg-gray-700 text-gray-400 rounded-full text-xs font-medium">
                  Closed
                </span>
              ) : (
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                  Active
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {proposal.createdBy?.name || "Unknown"}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatDate(proposal.createdAt)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyShareLink}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 hover:bg-gray-700 border border-gray-700 rounded-xl text-white font-medium transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Share"}
            </button>
          </div>
        </div>
      </div>

      {/* Fairness Score */}
      {proposal.analysis && (
        <div className="card-premium rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-amber-400" />
            Trade Analysis
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-gray-400 text-sm mb-1">{proposal.team1.rosterName}</p>
              <p className={`text-2xl font-bold ${
                proposal.analysis.team1NetValue >= 0 ? "text-green-400" : "text-red-400"
              }`}>
                {proposal.analysis.team1NetValue >= 0 ? "+" : ""}{proposal.analysis.team1NetValue}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
              <p className="text-gray-400 text-sm mb-1">Fairness</p>
              <p className={`text-2xl font-bold ${
                proposal.analysis.fairnessScore >= 40
                  ? "text-green-400"
                  : proposal.analysis.fairnessScore >= 30
                  ? "text-amber-400"
                  : "text-red-400"
              }`}>
                {proposal.analysis.fairnessScore}%
              </p>
            </div>
            <div className="text-center p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <p className="text-gray-400 text-sm mb-1">{proposal.team2.rosterName}</p>
              <p className={`text-2xl font-bold ${
                proposal.analysis.team2NetValue >= 0 ? "text-green-400" : "text-red-400"
              }`}>
                {proposal.analysis.team2NetValue >= 0 ? "+" : ""}{proposal.analysis.team2NetValue}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Trade Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Team 1 */}
        <div className="card-premium rounded-2xl p-6">
          <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            {proposal.team1.rosterName} sends
          </h3>
          <div className="space-y-3">
            {proposal.team1.playerDetails?.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-xl"
              >
                <PositionBadge position={player.position} size="xs" />
                <span className="text-white font-medium">{player.name}</span>
              </div>
            ))}
            {proposal.team1.picks?.map((pick, i) => (
              <div
                key={i}
                className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 font-medium"
              >
                {pick.season} Round {pick.round} Pick
              </div>
            ))}
            {(proposal.team1.playerDetails?.length || 0) === 0 && (proposal.team1.picks?.length || 0) === 0 && (
              <p className="text-gray-500">Nothing selected</p>
            )}
          </div>
        </div>

        {/* Team 2 */}
        <div className="card-premium rounded-2xl p-6">
          <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
            {proposal.team2.rosterName} sends
          </h3>
          <div className="space-y-3">
            {proposal.team2.playerDetails?.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-xl"
              >
                <PositionBadge position={player.position} size="xs" />
                <span className="text-white font-medium">{player.name}</span>
              </div>
            ))}
            {proposal.team2.picks?.map((pick, i) => (
              <div
                key={i}
                className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 font-medium"
              >
                {pick.season} Round {pick.round} Pick
              </div>
            ))}
            {(proposal.team2.playerDetails?.length || 0) === 0 && (proposal.team2.picks?.length || 0) === 0 && (
              <p className="text-gray-500">Nothing selected</p>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      {proposal.notes && (
        <div className="card-premium rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-3">Notes</h3>
          <p className="text-gray-400">{proposal.notes}</p>
        </div>
      )}

      {/* Voting Section */}
      {isActive && (
        <div className="card-premium rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Cast Your Vote</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Comment (optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add your thoughts on this trade..."
              rows={2}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
              maxLength={200}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => submitVote("approve")}
              disabled={voting}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                userVote === "approve"
                  ? "bg-green-500 text-white"
                  : "bg-green-500/20 hover:bg-green-500/30 text-green-400"
              }`}
            >
              <ThumbsUp className="w-5 h-5" />
              Approve
            </button>
            <button
              onClick={() => submitVote("reject")}
              disabled={voting}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                userVote === "reject"
                  ? "bg-red-500 text-white"
                  : "bg-red-500/20 hover:bg-red-500/30 text-red-400"
              }`}
            >
              <ThumbsDown className="w-5 h-5" />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Voting Results */}
      <div className="card-premium rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Voting Results</h3>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-green-400 font-medium">
              {proposal.votes?.approve?.length || 0} Approve
            </span>
            <span className="text-red-400 font-medium">
              {proposal.votes?.reject?.length || 0} Reject
            </span>
          </div>
          <div className="h-4 bg-gray-700 rounded-full overflow-hidden flex">
            {totalVotes > 0 ? (
              <>
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${approvalPercentage}%` }}
                />
                <div
                  className="h-full bg-red-500"
                  style={{ width: `${100 - approvalPercentage}%` }}
                />
              </>
            ) : (
              <div className="h-full w-full bg-gray-600" />
            )}
          </div>
          <p className="text-center text-gray-500 text-sm mt-2">
            {totalVotes} total vote{totalVotes !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Voter Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <h4 className="text-green-400 font-medium mb-3 flex items-center gap-2">
              <ThumbsUp className="w-4 h-4" />
              Approved
            </h4>
            {proposal.votes?.approve?.length > 0 ? (
              <ul className="space-y-2">
                {proposal.votes.approve.map((vote, i) => (
                  <li key={i} className="text-white text-sm">{vote.userName}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No votes yet</p>
            )}
          </div>

          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <h4 className="text-red-400 font-medium mb-3 flex items-center gap-2">
              <ThumbsDown className="w-4 h-4" />
              Rejected
            </h4>
            {proposal.votes?.reject?.length > 0 ? (
              <ul className="space-y-2">
                {proposal.votes.reject.map((vote, i) => (
                  <li key={i} className="text-white text-sm">{vote.userName}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No votes yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Comments */}
      {proposal.votes?.comments?.length > 0 && (
        <div className="card-premium rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-gray-400" />
            Comments ({proposal.votes.comments.length})
          </h3>
          <div className="space-y-4">
            {proposal.votes.comments.map((c, i) => (
              <div key={i} className="p-4 bg-gray-800/30 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{c.userName}</span>
                  <span className="text-gray-500 text-xs">{formatDate(c.timestamp)}</span>
                </div>
                <p className="text-gray-400">{c.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete (Creator Only) */}
      {isActive && (
        <div className="flex justify-end">
          <button
            onClick={deleteProposal}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? "Closing..." : "Close Proposal"}
          </button>
        </div>
      )}
    </div>
  );
}
