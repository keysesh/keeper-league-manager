"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ThumbsUp, ThumbsDown, MessageCircle, Clock, User, ArrowRight, Plus } from "lucide-react";

interface TradeProposal {
  id: string;
  title: string;
  status: string;
  team1: {
    rosterId: string;
    rosterName: string;
    playerDetails: Array<{ id: string; name: string; position: string }>;
    picks: Array<{ season: number; round: number }>;
  };
  team2: {
    rosterId: string;
    rosterName: string;
    playerDetails: Array<{ id: string; name: string; position: string }>;
    picks: Array<{ season: number; round: number }>;
  };
  analysis?: {
    fairnessScore: number;
    team1NetValue: number;
    team2NetValue: number;
  };
  votes: {
    approve: Array<{ userId: string; userName: string }>;
    reject: Array<{ userId: string; userName: string }>;
    comments: Array<{ userId: string; userName: string; comment: string; timestamp: string }>;
  };
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export default function TradeProposalsPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [proposals, setProposals] = useState<TradeProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"active" | "closed" | "all">("active");

  useEffect(() => {
    fetchProposals();
  }, [leagueId, filter]);

  const fetchProposals = async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/trade-proposals?status=${filter}`);
      if (!res.ok) throw new Error("Failed to fetch proposals");
      const data = await res.json();
      setProposals(data.proposals || []);
    } catch {
      setError("Failed to load trade proposals");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-800 rounded w-48 mb-4"></div>
          <div className="h-4 bg-gray-800 rounded w-64 mb-8"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-premium rounded-2xl p-6 mb-4">
              <div className="h-6 bg-gray-800 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-800 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-800 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <p className="text-red-400 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/league/${leagueId}`}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-amber-400 text-sm mb-4 transition-colors"
          >
            <span>&larr;</span>
            <span>Back to League</span>
          </Link>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Trade Proposals</h1>
          <p className="text-gray-500 mt-2 text-lg">
            Review and vote on proposed trades from league members
          </p>
        </div>
        <Link
          href={`/league/${leagueId}/trade-analyzer`}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 rounded-xl text-white font-medium transition-all hover:scale-[1.02] shadow-lg shadow-amber-500/30"
        >
          <Plus className="w-5 h-5" />
          Create Proposal
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-1 bg-gray-800/30 rounded-xl w-fit">
        {(["active", "closed", "all"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === status
                ? "bg-amber-500 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700/50"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Proposals List */}
      {proposals.length === 0 ? (
        <div className="card-premium rounded-2xl p-12 text-center">
          <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No proposals yet</h3>
          <p className="text-gray-500 mb-6">
            Be the first to create a trade proposal for your league to discuss.
          </p>
          <Link
            href={`/league/${leagueId}/trade-analyzer`}
            className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 rounded-xl text-white font-medium transition-all hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5" />
            Analyze a Trade
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <Link
              key={proposal.id}
              href={`/league/${leagueId}/trade-proposals/${proposal.id}`}
              className="block card-premium rounded-2xl p-6 hover:border-amber-500/30 transition-all group"
            >
              {/* Title & Status */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                    {proposal.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDate(proposal.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {proposal.createdBy}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {proposal.status === "closed" ? (
                    <span className="px-3 py-1 bg-gray-700 text-gray-400 rounded-full text-xs font-medium">
                      Closed
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                      Active
                    </span>
                  )}
                  {proposal.analysis && (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      proposal.analysis.fairnessScore >= 40
                        ? "bg-green-500/20 text-green-400"
                        : proposal.analysis.fairnessScore >= 30
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-red-500/20 text-red-400"
                    }`}>
                      {proposal.analysis.fairnessScore}% Fair
                    </span>
                  )}
                </div>
              </div>

              {/* Trade Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <p className="text-blue-400 font-medium text-sm mb-2">{proposal.team1.rosterName} sends</p>
                  <div className="space-y-1">
                    {proposal.team1.playerDetails?.slice(0, 3).map((player) => (
                      <p key={player.id} className="text-white text-sm">
                        <span className="text-gray-500">{player.position}</span> {player.name}
                      </p>
                    ))}
                    {(proposal.team1.playerDetails?.length || 0) > 3 && (
                      <p className="text-gray-500 text-sm">+{proposal.team1.playerDetails.length - 3} more</p>
                    )}
                    {proposal.team1.picks?.map((pick, i) => (
                      <p key={i} className="text-blue-400 text-sm">
                        {pick.season} Round {pick.round} pick
                      </p>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <p className="text-green-400 font-medium text-sm mb-2">{proposal.team2.rosterName} sends</p>
                  <div className="space-y-1">
                    {proposal.team2.playerDetails?.slice(0, 3).map((player) => (
                      <p key={player.id} className="text-white text-sm">
                        <span className="text-gray-500">{player.position}</span> {player.name}
                      </p>
                    ))}
                    {(proposal.team2.playerDetails?.length || 0) > 3 && (
                      <p className="text-gray-500 text-sm">+{proposal.team2.playerDetails.length - 3} more</p>
                    )}
                    {proposal.team2.picks?.map((pick, i) => (
                      <p key={i} className="text-blue-400 text-sm">
                        {pick.season} Round {pick.round} pick
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Votes & Comments */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 text-green-400">
                    <ThumbsUp className="w-4 h-4" />
                    <span className="text-sm font-medium">{proposal.votes?.approve?.length || 0}</span>
                  </span>
                  <span className="flex items-center gap-1 text-red-400">
                    <ThumbsDown className="w-4 h-4" />
                    <span className="text-sm font-medium">{proposal.votes?.reject?.length || 0}</span>
                  </span>
                  <span className="flex items-center gap-1 text-gray-400">
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">{proposal.votes?.comments?.length || 0}</span>
                  </span>
                </div>
                <span className="flex items-center gap-1 text-amber-400 text-sm font-medium group-hover:gap-2 transition-all">
                  View Details
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
