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
        className="sticky top-0 z-50 w-full border-b border-[#2a2a2a] bg-[#0d0d0d]"
        role="banner"
      >
        <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 lg:px-8">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden flex items-center justify-center w-10 h-10 -ml-1 rounded-md text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-all"
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
            {/* User badge */}
            <div
              className="hidden sm:flex items-center gap-3 px-3 py-2 rounded-md bg-[#1a1a1a] border border-[#2a2a2a]"
              aria-label={`Logged in as ${displayName}`}
            >
              {user.image ? (
                <Image
                  src={user.image}
                  alt={`${displayName} avatar`}
                  width={32}
                  height={32}
                  className="rounded-full ring-2 ring-[#333333]"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white"
                  aria-hidden="true"
                >
                  {displayName[0].toUpperCase()}
                </div>
              )}
              <span className="text-sm text-gray-200 font-medium max-w-[120px] truncate">
                {displayName}
              </span>
            </div>

            {/* Sign out */}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="group flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-white transition-all duration-200 w-10 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-2.5 rounded-md hover:bg-[#1a1a1a] border border-transparent hover:border-[#2a2a2a] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              aria-label="Sign out of your account"
            >
              <LogOut size={18} strokeWidth={2} className="text-gray-500 group-hover:text-white transition-colors" />
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
            className="fixed inset-0 bg-black/80"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-in Menu */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#0d0d0d] border-r border-[#2a2a2a] overflow-y-auto overflow-x-hidden">
            {/* Menu Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
              <LogoMark size="sm" />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center w-10 h-10 rounded-md text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-all"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Info */}
            <div className="p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]">
              <div className="flex items-center gap-3">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={`${displayName} avatar`}
                    width={44}
                    height={44}
                    className="rounded-full ring-2 ring-[#333333]"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
                    {displayName[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{displayName}</p>
                  <p className="text-xs text-gray-400">Keeper Manager</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="p-3" role="navigation" aria-label="Main navigation">
              {isLeaguePage && (
                <>
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3.5 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-md transition-all duration-200 min-h-[48px]"
                  >
                    <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">Back to Dashboard</span>
                  </Link>
                  <div className="h-px bg-[#2a2a2a] my-2 mx-4" />
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
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-md transition-all duration-200 min-h-[48px] ${
                        isActive
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : "text-gray-400 hover:text-white hover:bg-[#1a1a1a] border border-transparent"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${
                        isActive
                          ? "bg-blue-500/20"
                          : "bg-[#1a1a1a]"
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="font-medium">{item.name}</span>
                      {isActive && (
                        <span className="ml-auto w-2 h-2 rounded-full bg-blue-400" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* Sign Out */}
            <div className="p-3 mt-4">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut({ callbackUrl: "/login" });
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all duration-200 min-h-[48px] border border-[#2a2a2a]"
              >
                <div className="w-9 h-9 rounded-md flex items-center justify-center bg-[#1a1a1a]">
                  <LogOut className="w-5 h-5" />
                </div>
                <span className="font-medium">Sign Out</span>
              </button>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#2a2a2a] bg-[#0d0d0d]">
              <p className="text-xs text-gray-500 font-medium">
                E Pluribus Fantasy Football
              </p>
              <p className="text-[10px] text-gray-600 mt-0.5">
                Keeper Tracker v2.0
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
