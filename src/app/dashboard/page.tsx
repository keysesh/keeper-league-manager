"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface League {
  id: string;
  name: string;
  season: number;
  totalRosters: number;
  status: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchLeagues();
    }
  }, [session]);

  const fetchLeagues = async () => {
    try {
      const res = await fetch("/api/leagues");
      if (res.ok) {
        const data = await res.json();
        setLeagues(data.leagues || []);
      }
    } catch (err) {
      console.error("Failed to fetch leagues:", err);
    } finally {
      setLoading(false);
    }
  };

  const syncLeagues = async () => {
    setSyncing(true);
    setError("");
    try {
      const res = await fetch("/api/sleeper/sync", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Sync failed");
      }
      await fetchLeagues();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">
            <span className="text-purple-500">E Pluribus</span> Keeper Tracker
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400">
              {session?.user?.name || session?.user?.username}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-white">Your Leagues</h2>
          <button
            onClick={syncLeagues}
            disabled={syncing}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
          >
            {syncing ? "Syncing..." : "Sync from Sleeper"}
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {leagues.length === 0 ? (
          <div className="bg-gray-800/50 rounded-xl p-12 text-center border border-gray-700">
            <div className="text-4xl mb-4">🏈</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No Leagues Found
            </h3>
            <p className="text-gray-400 mb-6">
              Click &quot;Sync from Sleeper&quot; to import your leagues
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leagues.map((league) => (
              <Link
                key={league.id}
                href={`/league/${league.id}`}
                className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-purple-500/50 transition-colors"
              >
                <h3 className="text-lg font-semibold text-white mb-2">
                  {league.name}
                </h3>
                <div className="space-y-1 text-sm text-gray-400">
                  <p>Season: {league.season}</p>
                  <p>Teams: {league.totalRosters}</p>
                  <p className="capitalize">
                    Status: {league.status.replace("_", " ").toLowerCase()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
