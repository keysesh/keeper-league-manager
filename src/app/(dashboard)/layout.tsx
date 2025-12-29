import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Check if user has completed onboarding
  // Wrapped in try-catch to handle case where onboardingComplete column doesn't exist yet
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingComplete: true },
    });

    if (user && !user.onboardingComplete) {
      redirect("/onboarding");
    }
  } catch {
    // Column may not exist yet - skip onboarding check for existing users
    console.warn("onboardingComplete field not available - skipping onboarding check");
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Header user={session.user} />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
