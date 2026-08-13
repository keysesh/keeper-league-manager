import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { PostHogProvider } from "@/providers/PostHogProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["Menlo", "Monaco", "Consolas", "monospace"],
});

// Editorial theme faces (the five league screens)
const plexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex",
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "-apple-system", "sans-serif"],
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  display: "swap",
  fallback: ["Menlo", "Monaco", "monospace"],
});

// viewport-fit=cover is required for env(safe-area-inset-*) to resolve to
// non-zero values on notched iPhones — without it the bottom nav sits under
// the home indicator (MobileNav relies on safe-area-inset-bottom).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#06090f",
};

export const metadata: Metadata = {
  title: "Keeper League Manager",
  description: "Manage your fantasy football keeper league with ease",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  // iOS reads these meta tags (not the manifest) to decide whether a
  // Home-Screen install runs standalone. "black" keeps a solid status bar —
  // no content-under-status-bar surprises. Users must re-add the icon to the
  // Home Screen for this to take effect on an existing install.
  appleWebApp: {
    capable: true,
    title: "Keeper",
    statusBarStyle: "black",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geist.variable} ${geistMono.variable} ${plexSans.variable} ${plexMono.variable} font-sans antialiased text-zinc-100`}
      >
        <AuthProvider>
          <QueryProvider>
            <PostHogProvider>
              <ToastProvider>{children}</ToastProvider>
            </PostHogProvider>
          </QueryProvider>
        </AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
