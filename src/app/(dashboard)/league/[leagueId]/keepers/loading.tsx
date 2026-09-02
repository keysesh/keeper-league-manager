import { ScreenSkeleton } from "@/components/league-screens";

/** Matches the keeper workspace: deadline strip, feature card, roster rows. */
export default function KeepersLoading() {
  return <ScreenSkeleton hero rows={6} />;
}
