"use client";

import { useState, useEffect } from "react";
import { Clock, CheckCircle, Lock, AlertTriangle } from "lucide-react";

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function getKeeperDeadline(): Date {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear();
  // Keeper deadline: August 25th at midnight EST
  return new Date(year, 7, 25, 0, 0, 0);
}

function calculateTimeRemaining(deadline: Date): TimeRemaining {
  const now = new Date();
  const total = deadline.getTime() - now.getTime();

  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }

  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((total % (1000 * 60)) / 1000),
    total,
  };
}

export function KeeperDeadlineCountdown() {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [deadline] = useState(() => getKeeperDeadline());

  useEffect(() => {
    const updateTime = () => {
      setTimeRemaining(calculateTimeRemaining(deadline));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!timeRemaining) {
    return (
      <div className="animate-pulse bg-gray-800 rounded-xl h-12 w-48" />
    );
  }

  const isExpired = timeRemaining.total <= 0;
  const isUrgent = !isExpired && timeRemaining.days < 3;
  const isWarning = !isExpired && !isUrgent && timeRemaining.days < 7;

  if (isExpired) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-700/50 border border-gray-600/30">
        <Lock className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-400">Keepers Locked</span>
      </div>
    );
  }

  const containerClasses = isUrgent
    ? "bg-red-500/10 border-red-500/30 text-red-400"
    : isWarning
    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";

  const Icon = isUrgent ? AlertTriangle : isWarning ? Clock : CheckCircle;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${containerClasses}`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {isUrgent ? "Deadline:" : "Keepers Open"}
        </span>
        <div className="flex items-center gap-1 font-mono text-sm">
          {timeRemaining.days > 0 && (
            <>
              <TimeUnit value={timeRemaining.days} label="d" />
              <span className="text-gray-600">:</span>
            </>
          )}
          <TimeUnit value={timeRemaining.hours} label="h" />
          <span className="text-gray-600">:</span>
          <TimeUnit value={timeRemaining.minutes} label="m" />
          {timeRemaining.days === 0 && (
            <>
              <span className="text-gray-600">:</span>
              <TimeUnit value={timeRemaining.seconds} label="s" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <span className="tabular-nums">
      {value.toString().padStart(2, "0")}
      <span className="text-xs opacity-70">{label}</span>
    </span>
  );
}

export function KeeperDeadlineBanner({ leagueName }: { leagueName?: string }) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [deadline] = useState(() => getKeeperDeadline());

  useEffect(() => {
    const updateTime = () => {
      setTimeRemaining(calculateTimeRemaining(deadline));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!timeRemaining || timeRemaining.total <= 0 || timeRemaining.days > 7) {
    return null;
  }

  const isUrgent = timeRemaining.days < 3;

  return (
    <div
      className={`w-full px-4 py-3 ${
        isUrgent
          ? "bg-gradient-to-r from-red-500/20 to-orange-500/20 border-b border-red-500/30"
          : "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-b border-amber-500/30"
      }`}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle
            className={`w-5 h-5 ${isUrgent ? "text-red-400" : "text-amber-400"}`}
          />
          <p className={`text-sm font-medium ${isUrgent ? "text-red-400" : "text-amber-400"}`}>
            {isUrgent ? "Keeper deadline approaching!" : "Reminder: Set your keepers"}
            {leagueName && ` for ${leagueName}`}
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className={isUrgent ? "text-red-400" : "text-amber-400"}>
            {timeRemaining.days}d {timeRemaining.hours}h {timeRemaining.minutes}m remaining
          </span>
        </div>
      </div>
    </div>
  );
}
