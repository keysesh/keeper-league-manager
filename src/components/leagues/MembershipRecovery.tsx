"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, RefreshCw, AlertCircle } from "lucide-react";

type Phase = "checking" | "not_in_league" | "error";

// One automatic attempt per browser session — a manual Retry is always
// available, but auto-rerunning after every refresh could loop against a
// failing Sleeper API.
const AUTO_ATTEMPT_KEY = "membership-recovery-attempted";

/**
 * Rendered where "No leagues found" used to sit. An empty dashboard almost
 * always means the user's TeamMember link hasn't been created yet (new
 * registrant, mid-renewal league, failed registration sync) — resolve it
 * right now via the bounded membership sync instead of telling the user to
 * wait for a cron or a commissioner.
 */
export function MembershipRecovery() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const startedRef = useRef(false);

  const attempt = useCallback(async () => {
    setPhase("checking");
    setErrorDetail(null);
    try {
      const res = await fetch("/api/sleeper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "membership" }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorDetail(payload?.error || `Sync failed (${res.status})`);
        setPhase("error");
        return;
      }
      if (payload?.data?.status === "linked") {
        // Membership now exists — re-render the server page, which will show
        // the league (and auto-redirect into it when it's the only one).
        router.refresh();
        return;
      }
      setPhase("not_in_league");
    } catch {
      setErrorDetail("Could not reach the server. Check your connection.");
      setPhase("error");
    }
  }, [router]);

  // Reading sessionStorage is only possible client-side, so the initial
  // phase has to be resolved in an effect (same hydration pattern as the
  // handoff sheet's check-off state).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let alreadyAttempted = false;
    try {
      alreadyAttempted = sessionStorage.getItem(AUTO_ATTEMPT_KEY) === "1";
      sessionStorage.setItem(AUTO_ATTEMPT_KEY, "1");
    } catch {
      // Storage unavailable — still allow the single in-memory attempt
    }
    if (alreadyAttempted) {
      setPhase("error");
      setErrorDetail(null);
      return;
    }
    attempt();
  }, [attempt]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md p-8 sm:p-12 text-center">
      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-md bg-[#222222] border border-[#333333] flex items-center justify-center mx-auto mb-3 sm:mb-4">
        {phase === "checking" ? (
          <RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400 animate-spin" />
        ) : phase === "error" ? (
          <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400" />
        ) : (
          <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-gray-500" />
        )}
      </div>

      {phase === "checking" && (
        <>
          <p className="text-gray-400 font-medium text-sm sm:text-base">
            Looking up your league on Sleeper…
          </p>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Linking your roster — this takes a few seconds.
          </p>
        </>
      )}

      {phase === "not_in_league" && (
        <>
          <p className="text-gray-400 font-medium text-sm sm:text-base">
            Your Sleeper account isn&apos;t in the E Pluribus league
          </p>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            If the league was just renewed, accept the invite in the Sleeper
            app first, then try again.
          </p>
          <button
            onClick={attempt}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#222222] border border-[#333333] text-sm text-gray-300 hover:text-white hover:bg-[#2a2a2a] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Check again
          </button>
        </>
      )}

      {phase === "error" && (
        <>
          <p className="text-gray-400 font-medium text-sm sm:text-base">
            No leagues found
          </p>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            {errorDetail ||
              "We couldn't link your league automatically. Try again below."}
          </p>
          <button
            onClick={attempt}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#222222] border border-[#333333] text-sm text-gray-300 hover:text-white hover:bg-[#2a2a2a] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </>
      )}
    </div>
  );
}
