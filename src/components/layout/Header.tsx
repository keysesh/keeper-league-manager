"use client";

import { signOut } from "next-auth/react";
import Image from "next/image";

interface HeaderProps {
  user: {
    name?: string | null;
    image?: string | null;
    username?: string;
  };
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-800/50 bg-[#0c0c0e]/95 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <span className="text-xl">🏈</span>
          </div>
          <div className="hidden sm:block">
            <span className="font-bold text-lg text-white tracking-tight">
              E Pluribus
            </span>
            <span className="text-xs text-gray-500 block -mt-0.5 font-medium">
              Keeper Tracker
            </span>
          </div>
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-gray-800/50 border border-gray-700/50">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name || "User"}
                width={28}
                height={28}
                className="rounded-full ring-2 ring-purple-500/30"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-xs font-bold text-white">
                {user.name?.[0] || user.username?.[0] || "?"}
              </div>
            )}
            <span className="text-sm text-gray-300 hidden sm:inline-block font-medium">
              {user.name || user.username}
            </span>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-gray-500 hover:text-white transition-all px-4 py-2 rounded-xl hover:bg-gray-800 border border-transparent hover:border-gray-700 font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
