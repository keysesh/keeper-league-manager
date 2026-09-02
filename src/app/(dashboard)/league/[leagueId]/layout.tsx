import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { resolvePlanningSeason } from "@/lib/keeper/planning-season";

/**
 * Every screen under a league gets a banner when that league has been
 * superseded — i.e. a later league row already exists for the season it plans
 * for.
 *
 * These pages stay fully browsable on purpose: last season's rosters, drafts
 * and standings are the league's history. What they were missing was any sign
 * of WHICH season you were looking at, so a 2025 team page reads exactly like
 * a current one. A manager checked his roster, saw Bijan Robinson on it, and
 * reported the app as wrong — Bijan really is on that roster, in 2025, having
 * been traded away in August 2026.
 *
 * Keeper editing is already refused on these rows (lockReason "superseded" in
 * lib/keeper/deadline.ts). This is the same fact, said before someone acts on
 * a stale roster rather than after.
 */
export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { season: true, status: true },
  });

  const planningSeason = league ? resolvePlanningSeason(league) : null;
  const successor =
    league && planningSeason !== null && league.season !== planningSeason
      ? await prisma.league.findFirst({
          where: { season: planningSeason, id: { not: leagueId } },
          select: { id: true, season: true },
        })
      : null;

  return (
    <>
      {successor && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-amber-500/25 bg-amber-950/25 px-4 py-3">
          <span className="font-numeral text-[17px] leading-none text-amber-300">
            {league!.season}
          </span>
          <span className="text-sm text-amber-200/90">
            You are looking at the {league!.season} season. Rosters and keepers
            here are how they finished, not how they are now.
          </span>
          <Link
            href={`/league/${successor.id}`}
            className="ml-auto inline-flex min-h-[36px] items-center rounded-lg bg-amber-500/15 px-3 text-[13px] font-semibold text-amber-200 transition-colors hover:bg-amber-500/25"
          >
            Go to {successor.season}
          </Link>
        </div>
      )}
      {children}
    </>
  );
}
