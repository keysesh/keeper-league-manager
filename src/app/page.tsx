"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">
            <span className="text-purple-500">E Pluribus</span> Keeper Tracker
          </h1>
          <Link
            href="/login"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-3xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Manage Your Fantasy Football{" "}
            <span className="text-purple-500">Keepers</span>
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Track keeper eligibility, calculate draft costs, visualize your draft board,
            and analyze trades. Syncs directly with Sleeper.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-xl text-white font-semibold text-lg transition-colors"
            >
              Get Started
            </Link>
          </div>

          {/* Features */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="text-lg font-semibold text-white mb-2">Draft Board</h3>
              <p className="text-gray-400 text-sm">
                Visualize all keeper selections across your league with an interactive draft board.
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <div className="text-3xl mb-3">🔄</div>
              <h3 className="text-lg font-semibold text-white mb-2">Trade Analyzer</h3>
              <p className="text-gray-400 text-sm">
                Evaluate trade fairness based on keeper value and draft capital.
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <div className="text-3xl mb-3">📈</div>
              <h3 className="text-lg font-semibold text-white mb-2">Historical Data</h3>
              <p className="text-gray-400 text-sm">
                Track keeper trends and analyze past seasons to make better decisions.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          Syncs with Sleeper Fantasy Football
        </div>
      </footer>
    </div>
  );
}
