"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { LogoFull, LogoMark } from "@/components/ui/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import {
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  LayoutGrid,
  ArrowLeftRight,
  Users,
  Settings,
  Home,
} from "lucide-react";

interface HeaderProps {
  user: {
    name?: string | null;
    image?: string | null;
    username?: string;
  };
}

export function Header({ user }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const displayName = user.name || user.username || "User";
  const pathname = usePathname();
  const params = useParams();
  const leagueId = params?.leagueId as string | undefined;

  const isLeaguePage = pathname.includes("/league/") && leagueId;

  const dashboardNav = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
  ];

  const leagueNav = leagueId
    ? [
        { name: "Overview", href: `/league/${leagueId}`, icon: Home },
        { name: "Draft Board", href: `/league/${leagueId}/draft-board`, icon: LayoutGrid },
        { name: "Trades", href: `/league/${leagueId}/trade-analyzer`, icon: ArrowLeftRight },
        { name: "Teams", href: `/league/${leagueId}/team`, icon: Users },
        { name: "Settings", href: `/league/${leagueId}/settings`, icon: Settings },
      ]
    : [];

  const navigation = isLeaguePage ? leagueNav : dashboardNav;

  return (
    <>
      <header
        className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#0F0B1A]/90 backdrop-blur-xl"
        role="banner"
      >
        <div className="flex h-16 items-center justify-between px-4 lg:px-8">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Logo */}
          <div className="hidden lg:block">
            <LogoFull size="sm" />
          </div>
          <div className="lg:hidden">
            <LogoMark size="sm" />
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationBell />
            <div
              className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm"
              aria-label={`Logged in as ${displayName}`}
            >
              {user.image ? (
                <Image
                  src={user.image}
                  alt={`${displayName} avatar`}
                  width={32}
                  height={32}
                  className="rounded-full ring-2 ring-violet-500/30"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-violet-500/20"
                  aria-hidden="true"
                >
                  {displayName[0].toUpperCase()}
                </div>
              )}
              <span className="text-sm text-zinc-200 font-medium">
                {displayName}
              </span>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="group flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-all duration-200 px-3 py-2.5 rounded-xl hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70"
              aria-label="Sign out of your account"
            >
              <LogOut size={16} strokeWidth={2} className="text-zinc-500 group-hover:text-white transition-colors" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Slide-in Menu */}
          <div className="fixed inset-y-0 left-0 w-64 max-w-[85vw] bg-[#0F0B1A]/95 backdrop-blur-xl border-r border-white/[0.06] overflow-y-auto">
            {/* Menu Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <LogoMark size="sm" />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* User Info */}
            <div className="p-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={`${displayName} avatar`}
                    width={40}
                    height={40}
                    className="rounded-full ring-2 ring-violet-500/30"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-violet-500/20">
                    {displayName[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-white font-medium">{displayName}</p>
                  <p className="text-xs text-zinc-500">Keeper Manager</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="p-4 space-y-1">
              {isLeaguePage && (
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white hover:bg-white/[0.05] rounded-xl transition-all duration-200"
                >
                  <LayoutDashboard className="w-5 h-5" />
                  <span>Back to Dashboard</span>
                </Link>
              )}
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? "bg-violet-500/15 text-violet-400 border border-violet-500/20"
                        : "text-zinc-400 hover:text-white hover:bg-white/[0.05] border border-transparent"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/[0.06]">
              <p className="text-xs text-zinc-500 font-medium">
                E Pluribus Fantasy Football
              </p>
              <p className="text-[10px] text-zinc-600 mt-0.5">
                Keeper Tracker v2.0
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
