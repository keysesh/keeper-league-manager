"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider
      // Re-check session every 5 minutes so stale tabs stay alive
      refetchInterval={5 * 60}
      // Immediately verify session when the user switches back to this tab
      refetchOnWindowFocus={true}
    >
      {children}
    </SessionProvider>
  );
}
