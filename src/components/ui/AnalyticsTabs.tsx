"use client";

import { useState } from "react";
import { Zap, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/design-tokens";
import { PowerRankings } from "./PowerRankings";
import { LuckFactor } from "./LuckFactor";
import { TopScorers } from "./TopScorers";

type TabId = "power-rankings" | "luck-factor" | "top-scorers";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: "power-rankings", label: "Power Rankings", icon: <Zap className="w-4 h-4" /> },
  { id: "luck-factor", label: "Luck Factor", icon: <Sparkles className="w-4 h-4" /> },
  { id: "top-scorers", label: "Top Scorers", icon: <Trophy className="w-4 h-4" /> },
];

interface AnalyticsTabsProps {
  leagueId: string;
  userRosterId?: string;
}

export function AnalyticsTabs({ leagueId, userRosterId }: AnalyticsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("power-rankings");

  return (
    <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex border-b border-white/[0.06]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-white/[0.05] text-white border-b-2 border-blue-500"
                : "text-slate-400 hover:text-white hover:bg-white/[0.02]"
            )}
          >
            <span className={cn(
              activeTab === tab.id ? "text-blue-400" : "text-slate-500"
            )}>
              {tab.icon}
            </span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="transition-all duration-200">
        {activeTab === "power-rankings" && (
          <div id="power-rankings" className="scroll-mt-20">
            <PowerRankingsInline leagueId={leagueId} userRosterId={userRosterId} />
          </div>
        )}
        {activeTab === "luck-factor" && (
          <div id="luck" className="scroll-mt-20">
            <LuckFactorInline leagueId={leagueId} userRosterId={userRosterId} />
          </div>
        )}
        {activeTab === "top-scorers" && (
          <TopScorersInline />
        )}
      </div>
    </div>
  );
}

// Inline versions that don't render their own outer container
function PowerRankingsInline({ leagueId, userRosterId }: { leagueId: string; userRosterId?: string }) {
  return (
    <div className="[&>div]:border-0 [&>div]:rounded-none [&>div>div:first-child]:hidden">
      <PowerRankings
        leagueId={leagueId}
        userRosterId={userRosterId}
        useApi={true}
        condensed={true}
      />
    </div>
  );
}

function LuckFactorInline({ leagueId, userRosterId }: { leagueId: string; userRosterId?: string }) {
  return (
    <div className="[&>div]:border-0 [&>div]:rounded-none [&>div>div:first-child]:hidden">
      <LuckFactor
        leagueId={leagueId}
        userRosterId={userRosterId}
        condensed={true}
      />
    </div>
  );
}

function TopScorersInline() {
  return (
    <div className="[&>div]:border-0 [&>div]:rounded-none [&>div>div:first-child]:hidden">
      <TopScorers condensed={true} />
    </div>
  );
}
