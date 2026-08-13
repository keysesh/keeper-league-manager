import { redirect } from "next/navigation";

/**
 * Root route — /leagues is the canonical home (it also auto-redirects
 * single-league users straight into their keeper workspace). This page
 * was a drifted near-copy of /leagues; a redirect keeps one source of truth.
 */
export default function DashboardPage() {
  redirect("/leagues");
}
