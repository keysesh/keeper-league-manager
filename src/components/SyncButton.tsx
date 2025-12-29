"use client";

import { useState } from "react";
import { RefreshCw, Check, AlertCircle } from "lucide-react";

interface SyncButtonProps {
  variant?: "default" | "compact";
  onSuccess?: () => void;
}

export function SyncButton({ variant = "default", onSuccess }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSync = async () => {
    setSyncing(true);
    setStatus("idle");

    try {
      const res = await fetch("/api/sleeper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "user-leagues" }),
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
    return "border-gray-700/50 bg-gray-800/30 hover:border-blue-500/30 hover:bg-blue-500/5";
  };

  const getIconColor = () => {
    if (status === "success") return "bg-emerald-500/20 text-emerald-400";
    if (status === "error") return "bg-red-500/20 text-red-400";
    return "bg-blue-500/20 text-blue-400";
  };

  if (variant === "compact") {
    return (
      <button
        onClick={handleSync}
        disabled={syncing}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${getStatusColor()}`}
      >
        {getIcon()}
        <span>{syncing ? "Syncing..." : status === "success" ? "Synced!" : status === "error" ? "Failed" : "Sync"}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className={`group flex items-center gap-3 px-5 py-3 rounded-xl border transition-all duration-150 disabled:opacity-50 ${getStatusColor()}`}
    >
      <span className={`flex items-center justify-center w-9 h-9 rounded-lg ${getIconColor()}`}>
        {getIcon()}
      </span>
      <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
        {syncing ? "Syncing..." : status === "success" ? "Synced!" : status === "error" ? "Sync Failed" : "Sync Leagues"}
      </span>
    </button>
  );
}
