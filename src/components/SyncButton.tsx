"use client";

import { useState, useRef, useEffect } from "react";
import { RefreshCw, Check, AlertCircle, ChevronDown, History, Calculator, FileText } from "lucide-react";

interface SyncButtonProps {
  leagueId?: string;
  variant?: "default" | "compact";
  onSuccess?: () => void;
}

type SyncAction = "refresh" | "sync" | "sync-history" | "sync-drafts" | "update-keepers";

interface SyncOption {
  action: SyncAction;
  label: string;
  description: string;
  icon: React.ReactNode;
  requiresLeagueId: boolean;
}

const syncOptions: SyncOption[] = [
  {
    action: "refresh",
    label: "Refresh",
    description: "Quick roster update",
    icon: <RefreshCw size={14} />,
    requiresLeagueId: true,
  },
  {
    action: "sync",
    label: "Sync Data",
    description: "League + drafts + trades",
    icon: <RefreshCw size={14} />,
    requiresLeagueId: true,
  },
  {
    action: "sync-history",
    label: "Sync History",
    description: "Rosters + traded picks (fast)",
    icon: <History size={14} />,
    requiresLeagueId: true,
  },
  {
    action: "sync-drafts",
    label: "Sync Drafts",
    description: "All draft picks (slow)",
    icon: <FileText size={14} />,
    requiresLeagueId: true,
  },
  {
    action: "update-keepers",
    label: "Recalculate Keepers",
    description: "Fix keeper costs",
    icon: <Calculator size={14} />,
    requiresLeagueId: true,
  },
];

export function SyncButton({ leagueId, variant = "default", onSuccess }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [isOpen, setIsOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<SyncAction | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSync = async (action: SyncAction) => {
    setSyncing(true);
    setStatus("idle");
    setCurrentAction(action);
    setIsOpen(false);

    try {
      // For actions that require a leagueId, use the new action format
      // For user-leagues (when no leagueId), fall back to the old behavior
      const body = leagueId
        ? { action, leagueId }
        : { action: "user-leagues" };

      const res = await fetch("/api/sleeper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setStatus("success");
        onSuccess?.();
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
      }
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    } finally {
      setSyncing(false);
      setCurrentAction(null);
    }
  };

  const getIcon = () => {
    if (syncing) return <RefreshCw size={18} strokeWidth={2} className="animate-spin" />;
    if (status === "success") return <Check size={18} strokeWidth={2} />;
    if (status === "error") return <AlertCircle size={18} strokeWidth={2} />;
    return <RefreshCw size={18} strokeWidth={2} />;
  };

  const getStatusColor = () => {
    if (status === "success") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    if (status === "error") return "border-red-500/30 bg-red-500/10 text-red-400";
    return "border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#333333] hover:bg-[#222222]";
  };

  const getIconColor = () => {
    if (status === "success") return "bg-emerald-500/20 text-emerald-400";
    if (status === "error") return "bg-red-500/20 text-red-400";
    return "bg-[#222222] text-blue-400";
  };

  const getButtonText = () => {
    if (syncing) {
      const option = syncOptions.find(o => o.action === currentAction);
      return option ? `${option.label}...` : "Syncing...";
    }
    if (status === "success") return "Synced!";
    if (status === "error") return "Failed";
    return leagueId ? "Sync" : "Sync Leagues";
  };

  // Compact variant - simple button without dropdown
  if (variant === "compact") {
    return (
      <button
        onClick={() => handleSync(leagueId ? "refresh" : "sync")}
        disabled={syncing}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-50 ${getStatusColor()}`}
      >
        {getIcon()}
        <span>{getButtonText()}</span>
      </button>
    );
  }

  // Default variant - button with dropdown menu
  // If no leagueId, show simple button for user-leagues sync
  if (!leagueId) {
    return (
      <button
        onClick={() => handleSync("sync")}
        disabled={syncing}
        className={`group flex items-center gap-3 px-5 py-3 rounded-md border transition-all duration-150 disabled:opacity-50 ${getStatusColor()}`}
      >
        <span className={`flex items-center justify-center w-9 h-9 rounded-md ${getIconColor()}`}>
          {getIcon()}
        </span>
        <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
          {getButtonText()}
        </span>
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex">
        {/* Main button */}
        <button
          onClick={() => handleSync("refresh")}
          disabled={syncing}
          className={`group flex items-center gap-3 px-4 py-3 rounded-l-md border-l border-y transition-all duration-150 disabled:opacity-50 ${getStatusColor()}`}
        >
          <span className={`flex items-center justify-center w-9 h-9 rounded-md ${getIconColor()}`}>
            {getIcon()}
          </span>
          <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
            {getButtonText()}
          </span>
        </button>

        {/* Dropdown trigger */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={syncing}
          className={`flex items-center px-2 py-3 rounded-r-md border-r border-y border-l-0 transition-all duration-150 disabled:opacity-50 ${getStatusColor()}`}
        >
          <ChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] shadow-lg z-50">
          <div className="py-1">
            {syncOptions.map((option) => (
              <button
                key={option.action}
                onClick={() => handleSync(option.action)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#222222] transition-colors"
              >
                <span className="text-gray-400 mt-0.5">{option.icon}</span>
                <div>
                  <div className="text-sm font-medium text-gray-200">{option.label}</div>
                  <div className="text-xs text-gray-500">{option.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
