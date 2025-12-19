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
    <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-gray-900/60">
      <div className="flex h-16 items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏈</span>
          <span className="font-semibold text-lg hidden sm:inline-block">
            Keeper League Manager
          </span>
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name || "User"}
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm font-medium">
                {user.name?.[0] || user.username?.[0] || "?"}
              </div>
            )}
            <span className="text-sm text-gray-300 hidden sm:inline-block">
              {user.name || user.username}
            </span>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
