"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Trash2, Database } from "lucide-react";

interface CacheStats {
  cacheSize: number;
  cacheKeys: string[];
  timestamp: string;
}

export function CacheControls() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/cache");
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch cache stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const clearCache = async (pattern?: string) => {
    try {
      setClearing(true);
      const url = pattern
        ? `/api/admin/cache?pattern=${encodeURIComponent(pattern)}`
        : "/api/admin/cache";
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        setMessage({ text: data.message, type: "success" });
        await fetchStats();
      } else {
        setMessage({ text: data.error || "Failed to clear cache", type: "error" });
      }
    } catch (error) {
      setMessage({ text: "Failed to clear cache", type: "error" });
    } finally {
      setClearing(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`px-4 py-2 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between py-2 border-b border-gray-800">
        <span className="text-gray-400">Cache Entries</span>
        <span className="text-white font-medium">{stats?.cacheSize ?? 0}</span>
      </div>

      <div className="flex items-center justify-between py-2 border-b border-gray-800">
        <span className="text-gray-400">Last Updated</span>
        <span className="text-white font-medium text-sm">
          {stats?.timestamp ? new Date(stats.timestamp).toLocaleTimeString() : "-"}
        </span>
      </div>

      {stats && stats.cacheKeys.length > 0 && (
        <div className="py-2">
          <p className="text-gray-400 text-sm mb-2">Active Cache Keys:</p>
          <div className="max-h-32 overflow-y-auto bg-gray-800/50 rounded p-2">
            {stats.cacheKeys.slice(0, 20).map((key) => (
              <div key={key} className="text-xs text-gray-500 truncate py-0.5">
                {key}
              </div>
            ))}
            {stats.cacheKeys.length > 20 && (
              <div className="text-xs text-gray-600 italic">
                ... and {stats.cacheKeys.length - 20} more
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => fetchStats()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
        <button
          onClick={() => clearCache()}
          disabled={clearing || !stats || stats.cacheSize === 0}
          className="flex items-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          {clearing ? "Clearing..." : "Clear All"}
        </button>
      </div>

      <div className="pt-2 border-t border-gray-800">
        <p className="text-gray-500 text-xs mb-2">Quick Clear:</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => clearCache("league:.*")}
            disabled={clearing}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            League Data
          </button>
          <button
            onClick={() => clearCache("roster:.*")}
            disabled={clearing}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Roster Data
          </button>
          <button
            onClick={() => clearCache("trade:.*")}
            disabled={clearing}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Trade Analysis
          </button>
          <button
            onClick={() => clearCache("player:.*")}
            disabled={clearing}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Player Data
          </button>
        </div>
      </div>
    </div>
  );
}
