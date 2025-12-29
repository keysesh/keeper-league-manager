"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { LayoutGrid, ArrowLeftRight, TrendingUp, ArrowRight, Loader2 } from "lucide-react";

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800/50 backdrop-blur-xl bg-gray-950/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white tracking-tight">
            <span className="text-amber-500">E Pluribus</span> Keeper Tracker
          </h1>
          <Link
            href="/login"
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-xl text-white text-sm font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Fantasy Football Keeper Management
          </div>

          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight leading-tight">
            Manage Your Fantasy{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              Keepers
            </span>
          </h2>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Track keeper eligibility, calculate draft costs, visualize your draft board, and analyze trades. Syncs directly with Sleeper.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-2xl text-white font-semibold text-lg transition-all duration-200 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70"
            >
              Get Started
              <ArrowRight size={20} strokeWidth={2} />
            </Link>
          </div>

          {/* Features */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<LayoutGrid size={24} strokeWidth={1.5} />}
              title="Draft Board"
              description="Visualize all keeper selections across your league with an interactive draft board."
              color="amber"
            />
            <FeatureCard
              icon={<ArrowLeftRight size={24} strokeWidth={1.5} />}
              title="Trade Analyzer"
              description="Evaluate trade fairness based on keeper value and draft capital."
              color="blue"
            />
            <FeatureCard
              icon={<TrendingUp size={24} strokeWidth={1.5} />}
              title="Historical Data"
              description="Track keeper trends and analyze past seasons to make better decisions."
              color="emerald"
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-500 text-sm">
          Syncs with Sleeper Fantasy Football
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: "amber" | "blue" | "emerald";
}) {
  const colorClasses = {
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };

  const iconBgClasses = {
    amber: "bg-amber-500/20 text-amber-400",
    blue: "bg-blue-500/20 text-blue-400",
    emerald: "bg-emerald-500/20 text-emerald-400",
  };

  return (
    <div className={`rounded-2xl p-6 border backdrop-blur-sm ${colorClasses[color]} transition-all duration-200 hover:scale-[1.02]`}>
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 ${iconBgClasses[color]}`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
