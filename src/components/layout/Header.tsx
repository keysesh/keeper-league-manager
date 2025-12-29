"use client";

import { signOut } from "next-auth/react";
import Image from "next/image";
import { LogoFull, LogoMark } from "@/components/ui/Logo";
import { LogOut } from "lucide-react";

interface HeaderProps {
  user: {
    name?: string | null;
    image?: string | null;
    username?: string;
  };
}

export function Header({ user }: HeaderProps) {
  const displayName = user.name || user.username || "User";

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-gray-800/40 bg-[#0d0c0a]/90 backdrop-blur-xl"
      role="banner"
    >
      <div className="flex h-16 items-center justify-between px-5 lg:px-8">
        {/* Logo */}
        <div className="hidden sm:block">
          <LogoFull size="sm" />
        </div>
        <div className="sm:hidden">
          <LogoMark size="sm" />
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gray-800/40 border border-gray-700/40"
            aria-label={`Logged in as ${displayName}`}
          >
            {user.image ? (
              <Image
                src={user.image}
                alt={`${displayName} avatar`}
                width={32}
                height={32}
                className="rounded-full ring-2 ring-amber-500/30"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-amber-500/20"
                aria-hidden="true"
              >
                {displayName[0].toUpperCase()}
              </div>
            )}
            <span className="text-sm text-gray-200 hidden sm:inline-block font-medium">
              {displayName}
            </span>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="group flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-all duration-150 px-4 py-2.5 rounded-xl hover:bg-gray-800/50 border border-transparent hover:border-gray-700/50 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70"
            aria-label="Sign out of your account"
          >
            <LogOut size={16} strokeWidth={2} className="text-gray-500 group-hover:text-white transition-colors" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
