"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";
import { AlertTriangle, ArrowRight, X, FileText, Calendar, Activity } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface AlertsBannerProps {
  leagueId: string;
}

interface Alert {
  type: "trade" | "draft" | "injury";
  count: number;
  message: string;
  href: string;
  icon: typeof FileText;
}

export function AlertsBanner({ leagueId }: AlertsBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Fetch pending trades
  const { data: tradesData } = useSWR(
    `/api/leagues/${leagueId}/trade-proposals?status=PENDING`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  useEffect(() => {
    setMounted(true);
    // Check if banner was dismissed today
    const dismissKey = `alerts-banner-${leagueId}-${new Date().toDateString()}`;
    if (localStorage.getItem(dismissKey) === "true") {
      setDismissed(true);
    }
  }, [leagueId]);

  const handleDismiss = () => {
    setDismissed(true);
    const dismissKey = `alerts-banner-${leagueId}-${new Date().toDateString()}`;
    localStorage.setItem(dismissKey, "true");
  };

  if (!mounted || dismissed) return null;

  // Collect alerts
  const alerts: Alert[] = [];

  // Pending trades
  const pendingTrades = tradesData?.proposals?.filter(
    (p: { status: string }) => p.status === "PENDING"
  )?.length || 0;

  if (pendingTrades > 0) {
    alerts.push({
      type: "trade",
      count: pendingTrades,
      message: `${pendingTrades} pending trade${pendingTrades > 1 ? "s" : ""}`,
      href: `/league/${leagueId}/trade-proposals`,
      icon: FileText,
    });
  }

  // If no alerts, don't show banner
  if (alerts.length === 0) return null;

  return (
    <div className="relative bg-amber-500/10 border border-amber-500/30 rounded-md overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5" />

      <div className="relative px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>

          <div className="flex items-center gap-2 flex-wrap text-sm">
            {alerts.map((alert, index) => (
              <span key={alert.type} className="flex items-center gap-1">
                {index > 0 && <span className="text-gray-500 mx-1">•</span>}
                <Link
                  href={alert.href}
                  className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-medium transition-colors"
                >
                  <alert.icon className="w-3.5 h-3.5" />
                  {alert.message}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1.5 rounded-md hover:bg-amber-500/20 text-amber-500/70 hover:text-amber-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default AlertsBanner;
