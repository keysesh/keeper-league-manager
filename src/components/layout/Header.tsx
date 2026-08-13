"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { LogoFull, LogoMark } from "@/components/ui/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/design-tokens";
import { LogOut, LayoutDashboard, ChevronDown, UserCircle } from "lucide-react";

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

/**
 * App header — logo + notifications + account menu.
 *
 * Page navigation is NOT here: the bottom bar (mobile) and sidebar (desktop)
 * are the only navigation systems. The old hamburger drawer duplicated the
 * bottom bar with different labels and has been removed.
 */
export function Header({ user }: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const displayName = user.name || user.username || "User";

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-[#06090f]/95 backdrop-blur-xl"
      role="banner"
    >
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        {/* Left: Logo */}
        <Link href="/leagues" className="flex items-center">
          <div className="hidden lg:block">
            <LogoFull size="sm" />
          </div>
          <div className="lg:hidden">
            <LogoMark size="sm" />
          </div>
        </Link>

        {/* Right: Notifications + User */}
        <div className="flex items-center gap-2">
          <NotificationBell />

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1c2840] transition-colors min-h-[44px]"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
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
                <div className="absolute right-0 mt-2 w-56 bg-[#141c2b] border border-white/[0.12] rounded-xl shadow-xl z-50 animate-scale-in overflow-hidden">
                  <div className="p-3 border-b border-white/[0.08]">
                    <p className="text-sm font-medium text-white truncate">{displayName}</p>
                    <p className="text-xs text-slate-500">Keeper Manager</p>
                  </div>
                  <div className="p-1">
                    <Link
                      href="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-[#1c2840] rounded-lg transition-colors min-h-[40px]"
                    >
                      <UserCircle className="w-4 h-4" />
                      My Profile
                    </Link>
                    <Link
                      href="/leagues"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-[#1c2840] rounded-lg transition-colors min-h-[40px]"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      My Leagues
                    </Link>
                  </div>
                  <div className="p-1 border-t border-white/[0.08]">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        signOut({ callbackUrl: "/login" });
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-300 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors min-h-[40px]"
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
  );
}
