import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { logger } from "@/lib/logger";
import { resolveDashboardGate } from "@/lib/auth/dashboard-gate";

// Dashboard routes are session-gated (redirect to /login without one) —
// a static build-time snapshot of them is meaningless. Render on request.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Confirm the session still corresponds to a real user, and whether they
  // need onboarding. IMPORTANT: redirect() throws Next's control-flow error,
  // so it must be called OUTSIDE this try/catch — a previous version called
  // it inside and the catch silently swallowed every redirect, which both
  // disabled the onboarding wizard and let stale tokens for deleted users
  // render an empty "logged in" app.
  let gateUser:
    | { onboardingComplete: boolean; isAdmin: boolean; teamMembershipCount: number }
    | null
    | undefined;
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        onboardingComplete: true,
        isAdmin: true,
        _count: { select: { teamMemberships: true } },
      },
    });
    gateUser = user
      ? {
          onboardingComplete: user.onboardingComplete,
          isAdmin: user.isAdmin,
          teamMembershipCount: user._count.teamMemberships,
        }
      : null;
  } catch (error) {
    // DB hiccup — fail open (render without admin nav) rather than lock the
    // whole app; `undefined` tells the gate this was an error, not a missing
    // user.
    logger.warn("Dashboard user lookup failed - rendering with defaults", {
      error: String(error),
    });
    gateUser = undefined;
  }

  const gate = resolveDashboardGate(gateUser);
  if (gate.action === "stale-session") {
    redirect("/api/auth/stale-session");
  }
  if (gate.action === "onboarding") {
    redirect("/onboarding");
  }
  const isAdmin = gate.isAdmin;

  return (
    <div className="min-h-screen bg-[#06090f]">
      <Header user={session.user} />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <Sidebar isAdmin={isAdmin} />
        <main className="flex-1 w-full min-w-0 overflow-x-hidden">
          <div className="p-4 sm:p-6 lg:p-8 max-w-[100vw] lg:max-w-none pb-20 lg:pb-8">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
