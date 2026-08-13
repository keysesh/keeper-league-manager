import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KeeperWorkspace } from "@/components/keepers/KeeperWorkspace";
import { Crown } from "lucide-react";

/**
 * My Keepers — the keeper planning workspace and default league landing.
 *
 * Server component: resolves the viewer's roster in one narrow query and
 * renders the workspace with a real rosterId on first paint (no client-side
 * redirect hop).
 */
export default async function KeepersPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [roster, league] = await Promise.all([
    prisma.roster.findFirst({
      where: {
        leagueId,
        teamMembers: { some: { userId: session.user.id } },
      },
      select: { id: true, teamName: true },
    }),
    prisma.league.findUnique({
      where: { id: leagueId },
      select: { sleeperId: true, name: true },
    }),
  ]);

  if (!league) {
    redirect("/leagues");
  }

  if (!roster) {
    // Viewer has no team in this league — point them at the league overview
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#0c1219] border border-white/[0.08] rounded-xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-7 h-7 text-blue-400" />
          </div>
          <p className="text-white font-medium text-lg">No team in this league</p>
          <p className="text-slate-500 text-sm mt-1">
            You don&apos;t manage a roster here, so there are no keepers to plan.
          </p>
          <Link
            href={`/league/${leagueId}`}
            className="inline-flex items-center justify-center mt-6 px-5 py-2.5 min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            View League
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Desktop-only header — the mobile editorial screen carries its own
          title block (design handoff Aug 2026) */}
      <div className="hidden lg:block mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">My Keepers</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {roster.teamName || "Your team"} — plan, compare and finalize your keeper selections
        </p>
      </div>
      <KeeperWorkspace
        leagueId={leagueId}
        rosterId={roster.id}
        sleeperLeagueId={league.sleeperId}
        leagueName={league.name}
        teamName={roster.teamName || "Your team"}
      />
    </div>
  );
}
