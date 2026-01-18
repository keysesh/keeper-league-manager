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
        className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#0F0B1A]/95 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0F0B1A]/80"
        role="banner"
      >
        <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 lg:px-8">
          {/* Mobile Menu Button - Touch optimized */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden flex items-center justify-center w-10 h-10 -ml-1 rounded-xl text-zinc-400 hover:text-white active:bg-white/10 transition-all"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo */}
          <div className="hidden lg:block">
            <LogoFull size="sm" />
          </div>
          <div className="lg:hidden">
            <LogoMark size="sm" />
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            <NotificationBell />
            {/* User badge - compact on mobile, expanded on desktop */}
            <div
              className="hidden sm:flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm"
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
              <span className="text-sm text-zinc-200 font-medium max-w-[120px] truncate">
                {displayName}
              </span>
            </div>

            {/* Sign out - touch optimized */}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="group flex items-center justify-center gap-2 text-sm text-zinc-500 hover:text-white active:text-white transition-all duration-200 w-10 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-2.5 rounded-xl hover:bg-white/[0.05] active:bg-white/[0.08] border border-transparent hover:border-white/[0.08] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70"
              aria-label="Sign out of your account"
            >
              <LogOut size={18} strokeWidth={2} className="text-zinc-500 group-hover:text-white transition-colors" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-in Menu - Improved touch targets and spacing */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#0F0B1A] border-r border-violet-500/10 overflow-y-auto overflow-x-hidden animate-slide-in-left safe-top safe-bottom">
            {/* Menu Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <LogoMark size="sm" />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center w-10 h-10 rounded-xl text-zinc-400 hover:text-white active:bg-white/10 transition-all"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Info - Prominent display */}
            <div className="p-4 border-b border-white/[0.06] bg-gradient-to-r from-violet-500/5 to-transparent">
              <div className="flex items-center gap-3">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={`${displayName} avatar`}
                    width={44}
                    height={44}
                    className="rounded-full ring-2 ring-violet-500/40"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-violet-500/30">
                    {displayName[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{displayName}</p>
                  <p className="text-xs text-violet-400/80">Keeper Manager</p>
                </div>
              </div>
            </div>

            {/* Navigation - Touch optimized with larger targets */}
            <nav className="p-3" role="navigation" aria-label="Main navigation">
              {isLeaguePage && (
                <>
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3.5 text-zinc-400 hover:text-white active:bg-white/[0.08] rounded-xl transition-all duration-200 min-h-[48px]"
                  >
                    <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">Back to Dashboard</span>
                  </Link>
                  <div className="h-px bg-white/[0.06] my-2 mx-4" />
                </>
              )}
              <div className="space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 min-h-[48px] ${
                        isActive
                          ? "bg-violet-500/15 text-violet-400 border border-violet-500/25 shadow-lg shadow-violet-500/10"
                          : "text-zinc-400 hover:text-white active:bg-white/[0.08] border border-transparent"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isActive
                          ? "bg-violet-500/20"
                          : "bg-white/[0.04]"
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="font-medium">{item.name}</span>
                      {isActive && (
                        <span className="ml-auto w-2 h-2 rounded-full bg-violet-400 shadow-lg shadow-violet-400/50" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* Sign Out - Touch friendly placement */}
            <div className="p-3 mt-4">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut({ callbackUrl: "/login" });
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-zinc-400 hover:text-red-400 active:bg-red-500/10 rounded-xl transition-all duration-200 min-h-[48px] border border-white/[0.06]"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.04]">
                  <LogOut className="w-5 h-5" />
                </div>
                <span className="font-medium">Sign Out</span>
              </button>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/[0.06] bg-[#0F0B1A]">
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
