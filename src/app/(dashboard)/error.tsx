"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { logger } from "@/lib/logger";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    logger.error("Dashboard error", error);
  }, [error]);

  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-500/10 text-red-400">
          <AlertCircle size={40} strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
          Something went wrong
        </h2>
        <p className="text-gray-400 mb-6 leading-relaxed">
          We encountered an error loading this page. This might be a temporary issue.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-500 mb-6 font-mono bg-gray-800/50 px-3 py-2 rounded-lg inline-block">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70"
          >
            <RefreshCw size={16} strokeWidth={2} />
            Try again
          </button>
          <a
            href="/leagues"
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500/70"
          >
            <Home size={16} strokeWidth={2} />
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
