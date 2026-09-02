import { ScreenSkeleton } from "@/components/league-screens";

export default function DraftBoardLoading() {
  return <ScreenSkeleton tiles={2} rows={8} />;
}
