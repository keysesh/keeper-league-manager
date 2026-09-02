import { ScreenSkeleton } from "@/components/league-screens";

export default function TradeAnalyzerLoading() {
  return <ScreenSkeleton className="max-w-7xl" tiles={2} rows={6} />;
}
