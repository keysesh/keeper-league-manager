"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { LogoFull, LogoMark } from "@/components/ui/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/design-tokens";
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
  ChevronDown,
  Activity,
  FileText,
  UserCircle,
  Bookmark,
} from "lucide-react";

/**
 * Avatar component with built-in error handling
 */
function UserAvatar({
  src,
  name,
  size = "sm"
}: {
  src?: string | null;
  name: string;
  size?: "sm" | "md"
}) {
  const [hasError, setHasError] = useState(false);
  const sizeClasses = size === "sm" ? "w-8 h-8" : "w-11 h-11";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  if (!src || hasError) {
    return (
      <div className={`${sizeClasses} rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center ${textSize} font-bold text-white`}>
        {name[0].toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} avatar`}
      className={`${sizeClasses} rounded-full ring-2 ring-white/[0.1] object-cover`}
      onError={() => setHasError(true)}
    />
  );
}

interface HeaderProps {
  user: {
    name?: string | null;
    image?: string | null;
    username?: string;
  };
}

interface NavSection {
  title: string;
  items: { name: string; href: string; icon: React.ElementType }[];
}

export function Header({ user }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const displayName = user.name || user.username || "User";
  const pathname = usePathname();
  const params = useParams();
  const leagueId = params?.leagueId as string | undefined;

  const isLeaguePage = pathname.includes("/league/") && leagueId;

  // Mobile menu sections
  const mobileLeagueSections: NavSection[] = leagueId
    ? [
        {
          title: "Overview",
          items: [{ name: "Dashboard", href: `/league/${leagueId}`, icon: Home }],
        },
        {
          title: "My Team",
          items: [
            { name: "Roster", href: `/league/${leagueId}/my-team`, icon: UserCircle },
            { name: "Keepers", href: `/league/${leagueId}/my-team#keepers`, icon: Bookmark },
          ],
        },
        {
          title: "League",
          items: [
            { name: "All Teams", href: `/league/${leagueId}/team`, icon: Users },
          ],
        },
        {
          title: "Activity",
          items: [
            { name: "Trade Center", href: `/league/${leagueId}/trade-analyzer`, icon: ArrowLeftRight },
            { name: "Trade Proposals", href: `/league/${leagueId}/trade-proposals`, icon: FileText },
            { name: "Recent Activity", href: `/league/${leagueId}/activity`, icon: Activity },
          ],
        },
        {
          title: "Draft",
          items: [
            { name: "Draft Board", href: `/league/${leagueId}/draft-board`, icon: LayoutGrid },
          ],
        },
        {
          title: "Settings",
          items: [{ name: "League Settings", href: `/league/${leagueId}/settings`, icon: Settings }],
        },
      ]
    : [];

  const mobileDashboardSections: NavSection[] = [
    {
      title: "Overview",
      items: [
        { name: "My Leagues", href: "/leagues", icon: LayoutDashboard },
        { name: "My Profile", href: "/profile", icon: UserCircle },
      ],
    },
  ];

  const mobileSections = isLeaguePage ? mobileLeagueSections : mobileDashboardSections;

  const isActiveLink = (href: string) => {
    if (pathname === href) return true;
    if (href.includes("#")) {
      return pathname === href.split("#")[0];
    }
    if (href !== "/" && pathname.startsWith(href)) {
      if (href.endsWith("/team")) {
        return pathname === href || pathname === href + "/";
      }
      return true;
    }
    return false;
  };

  return (
    <>
      <header
        className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#080c14]/95 backdrop-blur-xl"
        role="banner"
      >
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          {/* Left: Menu button (mobile) + Logo */}
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden flex items-center justify-center w-10 h-10 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2435] transition-all"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo */}
            <Link href="/leagues" className="flex items-center">
              <div className="hidden lg:block">
                <LogoFull size="sm" />
              </div>
              <div className="lg:hidden">
                <LogoMark size="sm" />
              </div>
            </Link>
          </div>

          {/* Right: Notifications + User */}
          <div className="flex items-center gap-2">
            <NotificationBell />

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1a2435] transition-colors"
              >
                <UserAvatar src={user.image} name={displayName} size="sm" />
                <span className="hidden sm:block text-sm text-slate-200 font-medium max-w-[100px] truncate">
                  {displayName}
                </span>
                <ChevronDown
                  className={cn(
                    "hidden sm:block w-4 h-4 text-slate-500 transition-transform",
                    userMenuOpen && "rotate-180"
                  )}
                />
              </button>

              {/* User Dropdown */}
              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-[#131a28] border border-white/[0.1] rounded-xl shadow-xl z-50 animate-scale-in overflow-hidden">
                    <div className="p-3 border-b border-white/[0.06]">
                      <p className="text-sm font-medium text-white truncate">{displayName}</p>
                      <p className="text-xs text-slate-500">Keeper Manager</p>
                    </div>
                    <div className="p-1">
                      <Link
                        href="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-[#1a2435] rounded-lg transition-colors"
                      >
                        <UserCircle className="w-4 h-4" />
                        My Profile
                      </Link>
                      <Link
                        href="/leagues"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-[#1a2435] rounded-lg transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        My Leagues
                      </Link>
                    </div>
                    <div className="p-1 border-t border-white/[0.06]">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          signOut({ callbackUrl: "/login" });
                        }}
                        className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-300 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Slide-in Menu */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#080c14] border-r border-white/[0.06] overflow-y-auto animate-slide-down">
            {/* Menu Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <LogoMark size="sm" />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2435] transition-all"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Info */}
            <div className="p-4 border-b border-white/[0.06] bg-[#0d1420]">
              <div className="flex items-center gap-3">
                <UserAvatar src={user.image} name={displayName} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{displayName}</p>
                  <p className="text-xs text-slate-500">Keeper Manager</p>
                </div>
              </div>
            </div>

            {/* Back to Leagues (when in league view) */}
            {isLeaguePage && (
              <div className="p-3 border-b border-white/[0.06]">
                <Link
                  href="/leagues"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-blue-400 hover:bg-[#1a2435] rounded-lg transition-all"
                >
                  <LayoutDashboard className="w-5 h-5" />
                  <span className="font-medium">All Leagues</span>
                </Link>
              </div>
            )}

            {/* Navigation Sections */}
            <nav className="p-3 pb-24" role="navigation">
              {mobileSections.map((section, index) => (
                <div key={section.title} className={cn(index > 0 && "mt-4")}>
                  <h3 className="px-3 pb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {section.title}
                  </h3>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive = isActiveLink(item.href);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 min-h-[44px]",
                            isActive
                              ? "bg-[#243044] text-white border-l-2 border-blue-500 pl-[10px]"
                              : "text-slate-400 hover:text-white hover:bg-[#1a2435] border-l-2 border-transparent pl-[10px]"
                          )}
                        >
                          <Icon
                            className={cn(
                              "w-5 h-5 flex-shrink-0",
                              isActive ? "text-blue-400" : "text-slate-500"
                            )}
                          />
                          <span className="font-medium">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Sign Out */}
            <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/[0.06] bg-[#080c14]">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut({ callbackUrl: "/login" });
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all min-h-[44px]"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
