"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  Users,
  LayoutGrid,
  ArrowRight,
  Check,
  RefreshCw,
  Sparkles,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { logger } from "@/lib/logger";

interface League {
  id: string;
  name: string;
  totalRosters: number;
  season: number;
}

type Step = "welcome" | "sync" | "leagues" | "tips" | "complete";

const STEPS: Step[] = ["welcome", "sync", "leagues", "tips", "complete"];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    // Check onboarding status
    fetch("/api/onboarding")
      .then((res) => res.json())
      .then((data) => {
        if (data.onboardingComplete) {
          router.push("/");
        }
        setUsername(data.sleeperUsername || "");
        if (data.hasLeagues) {
          fetchLeagues();
        }
      })
      .catch((err) => logger.error("Failed to check onboarding status", err));
  }, [router]);

  const fetchLeagues = async () => {
    try {
      const res = await fetch("/api/leagues");
      if (res.ok) {
        const data = await res.json();
        setLeagues(data);
        if (data.length === 1) {
          setSelectedLeague(data[0].id);
        }
      }
    } catch (error) {
      logger.error("Failed to fetch leagues", error);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncError("");

    try {
      const res = await fetch("/api/sleeper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "user-leagues" }),
      });

      if (res.ok) {
        await fetchLeagues();
        setCurrentStep("leagues");
      } else {
        const data = await res.json();
        setSyncError(data.error || "Failed to sync leagues");
      }
    } catch {
      setSyncError("Failed to connect to Sleeper. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);

    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });

      // Navigate to selected league or dashboard
      if (selectedLeague) {
        router.push(`/league/${selectedLeague}`);
      } else {
        router.push("/");
      }
    } catch (error) {
      logger.error("Failed to complete onboarding", error);
      router.push("/");
    }
  };

  const handleSkip = async () => {
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      });
      router.push("/");
    } catch {
      router.push("/");
    }
  };

  const nextStep = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1]);
    }
  };

  const stepIndex = STEPS.indexOf(currentStep);

  return (
    <div className="min-h-screen bg-[#0d0c0a] relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-amber-900/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-orange-900/20 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to Keeper Tracker</h1>
          <p className="text-gray-500 mt-1">Let&apos;s get you set up in just a few steps</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.slice(0, -1).map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  index < stepIndex
                    ? "bg-amber-500 text-white"
                    : index === stepIndex
                    ? "bg-amber-500/20 text-amber-400 border-2 border-amber-500"
                    : "bg-gray-800 text-gray-500"
                }`}
              >
                {index < stepIndex ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              {index < STEPS.length - 2 && (
                <div
                  className={`w-12 h-0.5 mx-1 ${
                    index < stepIndex ? "bg-amber-500" : "bg-gray-800"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="card-premium rounded-2xl p-8">
          {currentStep === "welcome" && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-3">
                Hey {username}! Ready to dominate your keeper league?
              </h2>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                We&apos;ll help you track keepers, analyze trades, and plan your draft strategy.
                Let&apos;s start by syncing your Sleeper leagues.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <FeatureCard
                  icon={<Trophy className="w-5 h-5" />}
                  title="Track Keepers"
                  description="Manage keeper costs and eligibility"
                />
                <FeatureCard
                  icon={<Users className="w-5 h-5" />}
                  title="Trade Analysis"
                  description="Evaluate trades with keeper impact"
                />
                <FeatureCard
                  icon={<LayoutGrid className="w-5 h-5" />}
                  title="Draft Board"
                  description="Visualize your entire draft"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={nextStep}
                  className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSkip}
                  className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {currentStep === "sync" && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-6">
                <RefreshCw className={`w-8 h-8 text-blue-400 ${syncing ? "animate-spin" : ""}`} />
              </div>
              <h2 className="text-xl font-bold text-white mb-3">
                Sync Your Sleeper Leagues
              </h2>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                We&apos;ll import your leagues, rosters, and draft history from Sleeper.
                This only takes a few seconds.
              </p>

              {syncError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-left max-w-md mx-auto">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{syncError}</p>
                </div>
              )}

              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 mx-auto shadow-lg shadow-blue-500/30"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sync from Sleeper
                  </>
                )}
              </button>

              <button
                onClick={handleSkip}
                className="block mx-auto mt-4 text-gray-500 hover:text-gray-400 text-sm"
              >
                I&apos;ll do this later
              </button>
            </div>
          )}

          {currentStep === "leagues" && (
            <div>
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                  <Users className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-3">
                  {leagues.length > 0 ? "Your Leagues" : "No Leagues Found"}
                </h2>
                <p className="text-gray-400 max-w-md mx-auto">
                  {leagues.length > 0
                    ? "Select a league to start managing keepers"
                    : "We couldn't find any leagues. Make sure you're in a keeper league on Sleeper."}
                </p>
              </div>

              {leagues.length > 0 ? (
                <>
                  <div className="space-y-3 mb-8 max-h-64 overflow-y-auto">
                    {leagues.map((league) => (
                      <button
                        key={league.id}
                        onClick={() => setSelectedLeague(league.id)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                          selectedLeague === league.id
                            ? "border-amber-500 bg-amber-500/10"
                            : "border-gray-700 bg-gray-800/30 hover:border-gray-600"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-semibold">{league.name}</p>
                            <p className="text-gray-500 text-sm">
                              {league.totalRosters} teams &bull; {league.season} Season
                            </p>
                          </div>
                          {selectedLeague === league.id && (
                            <Check className="w-5 h-5 text-amber-400" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={nextStep}
                    disabled={!selectedLeague}
                    className="w-full px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="w-full px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                    Try Syncing Again
                  </button>
                  <button
                    onClick={handleSkip}
                    className="text-gray-500 hover:text-gray-400"
                  >
                    Continue anyway
                  </button>
                </div>
              )}
            </div>
          )}

          {currentStep === "tips" && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-3">
                Quick Tips
              </h2>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                Here are a few things to help you get the most out of Keeper Tracker
              </p>

              <div className="space-y-4 text-left mb-8">
                <TipCard
                  number={1}
                  title="Set Your Keepers"
                  description="Go to your team page and select which players to keep. Costs are calculated automatically."
                />
                <TipCard
                  number={2}
                  title="View the Draft Board"
                  description="See the full league draft board with all keepers mapped to their rounds."
                />
                <TipCard
                  number={3}
                  title="Analyze Trades"
                  description="Use the trade analyzer to see how trades affect keeper values and costs."
                />
                <TipCard
                  number={4}
                  title="Check Notifications"
                  description="Stay updated on trade proposals and keeper deadlines via the bell icon."
                />
              </div>

              <button
                onClick={nextStep}
                className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 mx-auto shadow-lg shadow-amber-500/30"
              >
                Let&apos;s Go!
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {currentStep === "complete" && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-3">
                You&apos;re All Set!
              </h2>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                Your account is ready. Time to start managing your keepers and dominating your league.
              </p>

              <button
                onClick={handleComplete}
                disabled={completing}
                className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 mx-auto shadow-lg shadow-amber-500/30"
              >
                {completing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : selectedLeague ? (
                  <>
                    Go to My League
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-sm mt-8">
          Need help?{" "}
          <Link href="/" className="text-amber-400 hover:text-amber-300">
            Visit our support page
          </Link>
        </p>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/50">
      <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
        {icon}
      </div>
      <h3 className="text-white font-semibold text-sm mb-1">{title}</h3>
      <p className="text-gray-500 text-xs">{description}</p>
    </div>
  );
}

function TipCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4 p-4 rounded-xl bg-gray-800/30 border border-gray-700/50">
      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold flex-shrink-0">
        {number}
      </div>
      <div>
        <h3 className="text-white font-semibold text-sm mb-1">{title}</h3>
        <p className="text-gray-500 text-sm">{description}</p>
      </div>
    </div>
  );
}
