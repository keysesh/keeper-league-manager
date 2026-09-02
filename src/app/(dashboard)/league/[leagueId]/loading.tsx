import { ScreenSkeleton } from "@/components/league-screens";

/**
 * The waiting state for every league screen that has no more specific one —
 * keepers, settings, player, team, commissioner. It used to draw the league
 * overview's rosters grid in pre-redesign greys no matter where you were
 * headed, so a tap on Keepers flashed a picture of a different screen first.
 */
export default function LeagueLoading() {
  return <ScreenSkeleton tiles={2} rows={6} />;
}
