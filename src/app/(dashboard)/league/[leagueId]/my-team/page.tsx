import { redirect } from "next/navigation";

/**
 * Legacy route — the owner workspace now lives at /league/[leagueId]/keepers
 * (the My Keepers tab). Kept so old bookmarks and links keep working.
 */
export default async function MyTeamPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  redirect(`/league/${leagueId}/keepers`);
}
