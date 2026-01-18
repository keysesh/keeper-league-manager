"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LeagueError({ error, reset }: ErrorProps) {
  useEffect(() => {
    logger.error("League page error", error);
  }, [error]);

  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        <div className="text-6xl mb-4">🏈</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          League Error
        </h2>
        <p className="text-gray-600 mb-6">
          We couldn&apos;t load this league. The league may not exist, or there
          might be a sync issue.
        </p>
        {error.message && (
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg mb-4">
            {error.message}
          </p>
        )}
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
          <a
            href="/leagues"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to Leagues
          </a>
        </div>
      </div>
    </div>
  );
}
