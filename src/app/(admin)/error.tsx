"use client";

import { useEffect } from "react";
import { ShieldAlert, RefreshCw, Shield } from "lucide-react";
import { logger } from "@/lib/logger";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: ErrorProps) {
  useEffect(() => {
    logger.error("Admin panel error", error);
  }, [error]);

  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 rounded-2xl bg-amber-500/10 text-amber-400">
          <ShieldAlert size={40} strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
          Admin Panel Error
        </h2>
        <p className="text-gray-400 mb-6 leading-relaxed">
          An error occurred in the admin panel. Please try again or contact support if the issue persists.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-500 mb-6 font-mono bg-gray-800/50 px-3 py-2 rounded-lg inline-block">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70"
          >
            <RefreshCw size={16} strokeWidth={2} />
            Try again
          </button>
          <a
            href="/admin"
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500/70"
          >
            <Shield size={16} strokeWidth={2} />
            Admin Home
          </a>
        </div>
      </div>
    </div>
  );
}
