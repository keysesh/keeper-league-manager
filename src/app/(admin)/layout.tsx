import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

// Every admin route is session-gated and reads live data — static
// prerendering them at build time is both meaningless (they redirect
// without a session) and breaks builds in environments without runtime
// services. Render the whole segment on request.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!user) {
    // Session token for a user that no longer exists — clear it instead of
    // bouncing a ghost session around the app.
    redirect("/api/auth/stale-session");
  }

  if (!user.isAdmin) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-[#0F0B1A]">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 max-w-7xl">
        {children}
      </main>
    </div>
  );
}
