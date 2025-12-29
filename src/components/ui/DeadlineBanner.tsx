"use client";

import { useState, useEffect } from "react";
import { Clock, X, AlertTriangle, Bell, Lock, Unlock } from "lucide-react";
import { getKeeperDeadlineInfo } from "@/lib/constants/keeper-rules";
import Link from "next/link";

interface DeadlineBannerProps {
  leagueId: string;
}

export function DeadlineBanner({ leagueId }: DeadlineBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const deadlineInfo = getKeeperDeadlineInfo();

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
      <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 border-b border-red-500/20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20">
              <Lock size={16} className="text-red-400" />
            </div>
            <div>
              <p className="text-red-300 font-medium text-sm">
                Keeper selections are locked
              </p>
              <p className="text-red-400/70 text-xs">{deadlineInfo.message}</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
          >
            <X size={16} />
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
      const bgClass = isUrgent
        ? "bg-gradient-to-r from-amber-500/20 to-red-500/20 border-amber-500/30"
        : "bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20";
      const iconClass = isUrgent ? "bg-amber-500/20" : "bg-purple-500/20";
      const textClass = isUrgent ? "text-amber-300" : "text-purple-300";
      const subTextClass = isUrgent ? "text-amber-400/70" : "text-purple-400/70";
      const timeClass = isUrgent ? "text-amber-400" : "text-purple-400";

      return (
        <div className={`${bgClass} border-b`}>
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${iconClass}`}>
                {isUrgent ? (
                  <AlertTriangle size={16} className="text-amber-400" />
                ) : (
                  <Bell size={16} className="text-purple-400" />
                )}
              </div>
              <div>
                <p className={`font-medium text-sm ${textClass}`}>
                  {isUrgent ? "Keeper deadline approaching!" : "Keeper deadline reminder"}
                </p>
                <div className="flex items-center gap-2">
                  <Clock size={12} className={timeClass} />
                  <span className={`text-xs font-medium ${timeClass}`}>{timeRemaining}</span>
                  <span className={`text-xs ${subTextClass}`}>
                    to finalize your keeper selections
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/league/${leagueId}/draft-board`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isUrgent
                    ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300"
                    : "bg-purple-500/20 hover:bg-purple-500/30 text-purple-300"
                }`}
              >
                View Draft Board
              </Link>
              <button
                onClick={handleDismiss}
                className={`p-1.5 hover:bg-gray-700/50 rounded-lg transition-colors ${
                  isUrgent ? "text-amber-400" : "text-purple-400"
                }`}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Show open status banner (non-urgent)
  return (
    <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border-b border-emerald-500/20">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Unlock size={14} className="text-emerald-400" />
          <span className="text-emerald-300 text-sm">
            Keeper selections are open
          </span>
          {timeRemaining && (
            <span className="text-emerald-400/70 text-xs">
              ({timeRemaining})
            </span>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-emerald-500/20 rounded text-emerald-400 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
