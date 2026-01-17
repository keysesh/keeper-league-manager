"use client";

import { useState, useEffect } from "react";
import { Clock, X, AlertTriangle, Bell, Lock, ChevronRight, Sparkles } from "lucide-react";
import { getKeeperDeadlineInfo } from "@/lib/constants/keeper-rules";
import Link from "next/link";

interface DeadlineBannerProps {
  leagueId: string;
}

export function DeadlineBanner({ leagueId }: DeadlineBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const deadlineInfo = getKeeperDeadlineInfo();

  // Initialize state from localStorage and set up countdown interval
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Check if user has dismissed this banner recently
    const dismissedKey = `deadline-banner-dismissed-${new Date().toDateString()}`;
    if (localStorage.getItem(dismissedKey) === "true") {
      setDismissed(true);
    }

    // Update countdown every minute
    const updateCountdown = () => {
      if (!deadlineInfo.deadline) {
        setTimeRemaining("");
        return;
      }

      const now = new Date();
      const deadline = new Date(deadlineInfo.deadline);
      const diffMs = deadline.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeRemaining("Deadline passed");
        return;
      }

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h remaining`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m remaining`);
      } else {
        setTimeRemaining(`${minutes}m remaining`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);

    return () => clearInterval(interval);
  }, [deadlineInfo.deadline]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDismiss = () => {
    setDismissed(true);
    const dismissedKey = `deadline-banner-dismissed-${new Date().toDateString()}`;
    localStorage.setItem(dismissedKey, "true");
  };

  // Don't show if dismissed or if deadline isn't approaching
  if (dismissed) return null;

  // Show different banners based on deadline status
  if (!deadlineInfo.isActive) {
    // Keepers are locked
    return (
      <div className="relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-950/80 via-red-900/60 to-red-950/80" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent" />

        {/* Bottom border glow */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/20 ring-1 ring-red-500/30">
                <Lock size={18} className="text-red-400" />
              </div>
              {/* Pulse effect */}
              <div className="absolute inset-0 rounded-xl bg-red-500/20 animate-ping opacity-20" />
            </div>
            <div>
              <p className="text-red-200 font-semibold text-sm flex items-center gap-2">
                Keeper selections are locked
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wide">
                  Closed
                </span>
              </p>
              <p className="text-red-400/70 text-xs mt-0.5">{deadlineInfo.message}</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-2 hover:bg-red-500/20 rounded-lg text-red-400/70 hover:text-red-400 transition-all"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    );
  }

  // Check if deadline is approaching (within 7 days)
  if (deadlineInfo.deadline) {
    const now = new Date();
    const deadline = new Date(deadlineInfo.deadline);
    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) {
      const isUrgent = diffDays <= 3;

      return (
        <div className="relative overflow-hidden">
          {/* Animated gradient background */}
          <div className={`absolute inset-0 ${
            isUrgent
              ? "bg-gradient-to-r from-amber-950/80 via-orange-900/60 to-red-950/80"
              : "bg-gradient-to-r from-purple-950/80 via-indigo-900/60 to-purple-950/80"
          }`} />
          <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] ${
            isUrgent
              ? "from-amber-500/10 via-transparent to-transparent"
              : "from-purple-500/10 via-transparent to-transparent"
          }`} />

          {/* Animated shimmer effect for urgent */}
          {isUrgent && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/5 to-transparent animate-shimmer" />
          )}

          {/* Bottom border glow */}
          <div className={`absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent ${
            isUrgent ? "via-amber-500/50" : "via-purple-500/40"
          } to-transparent`} />

          <div className="relative max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className={`flex items-center justify-center w-10 h-10 rounded-xl ring-1 ${
                  isUrgent
                    ? "bg-amber-500/20 ring-amber-500/30"
                    : "bg-purple-500/20 ring-purple-500/30"
                }`}>
                  {isUrgent ? (
                    <AlertTriangle size={18} className="text-amber-400" />
                  ) : (
                    <Bell size={18} className="text-purple-400" />
                  )}
                </div>
                {/* Pulse effect for urgent */}
                {isUrgent && (
                  <div className="absolute inset-0 rounded-xl bg-amber-500/20 animate-ping opacity-30" />
                )}
              </div>
              <div>
                <p className={`font-semibold text-sm flex items-center gap-2 ${
                  isUrgent ? "text-amber-200" : "text-purple-200"
                }`}>
                  {isUrgent ? "Keeper deadline approaching!" : "Keeper deadline reminder"}
                  {isUrgent && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wide animate-pulse">
                      Urgent
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${
                    isUrgent ? "bg-amber-500/10" : "bg-purple-500/10"
                  }`}>
                    <Clock size={12} className={isUrgent ? "text-amber-400" : "text-purple-400"} />
                    <span className={`text-xs font-bold tabular-nums ${
                      isUrgent ? "text-amber-400" : "text-purple-400"
                    }`}>
                      {timeRemaining}
                    </span>
                  </div>
                  <span className={`text-xs ${
                    isUrgent ? "text-amber-400/60" : "text-purple-400/60"
                  }`}>
                    to finalize selections
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/league/${leagueId}/draft-board`}
                className={`group flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isUrgent
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-lg shadow-amber-500/20"
                    : "bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 ring-1 ring-purple-500/30"
                }`}
              >
                View Draft Board
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <button
                onClick={handleDismiss}
                className={`p-2 rounded-lg transition-all ${
                  isUrgent
                    ? "hover:bg-amber-500/20 text-amber-400/70 hover:text-amber-400"
                    : "hover:bg-purple-500/20 text-purple-400/70 hover:text-purple-400"
                }`}
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Show open status banner (non-urgent)
  return (
    <div className="relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/60 via-emerald-900/40 to-emerald-950/60" />

      {/* Bottom border glow */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/20">
            <Sparkles size={14} className="text-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-200 text-sm font-medium">
              Keeper selections are open
            </span>
            {timeRemaining && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400/80 text-xs">
                {timeRemaining}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1.5 hover:bg-emerald-500/20 rounded-lg text-emerald-400/60 hover:text-emerald-400 transition-all"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
