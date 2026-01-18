import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { logger } from "@/lib/logger";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Check if user has completed onboarding and if they're an admin
  let isAdmin = false;
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingComplete: true, isAdmin: true },
    });

    if (user && !user.onboardingComplete) {
      redirect("/onboarding");
    }
    isAdmin = user?.isAdmin ?? false;
  } catch (error) {
    // Column may not exist yet - skip onboarding check for existing users
    logger.warn("onboardingComplete field not available - skipping onboarding check", { error: String(error) });
    // Still try to get isAdmin separately
    try {
      const adminCheck = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isAdmin: true },
      });
      isAdmin = adminCheck?.isAdmin ?? false;
    } catch {
      // Ignore - isAdmin stays false
    }
  }

  return (
    <div className="min-h-screen bg-[#0F0B1A]">
      <Header user={session.user} />
      <div className="flex">
        <Sidebar isAdmin={isAdmin} />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
