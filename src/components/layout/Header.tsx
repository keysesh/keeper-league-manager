"use client";

import { signOut } from "next-auth/react";
import Image from "next/image";
import { LogoFull, LogoMark } from "@/components/ui/Logo";

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
      className="sticky top-0 z-50 w-full border-b border-gray-800/50 bg-[#0d0c0a]/95 backdrop-blur-xl"
      role="banner"
    >
      <div className="flex h-16 items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <div className="hidden sm:block">
          <LogoFull size="sm" />
        </div>
        <div className="sm:hidden">
          <LogoMark size="sm" />
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-gray-800/50 border border-gray-700/50"
            aria-label={`Logged in as ${displayName}`}
          >
            {user.image ? (
              <Image
                src={user.image}
                alt={`${displayName} avatar`}
                width={28}
                height={28}
                className="rounded-full ring-2 ring-amber-500/30"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xs font-bold text-white"
                aria-hidden="true"
              >
                {displayName[0]}
              </div>
            )}
            <span className="text-sm text-gray-300 hidden sm:inline-block font-medium">
              {displayName}
            </span>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-gray-500 hover:text-white transition-all px-4 py-2 rounded-xl hover:bg-gray-800 border border-transparent hover:border-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            aria-label="Sign out of your account"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
