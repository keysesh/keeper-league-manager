"use client";

import { Eye, Lock, LogIn } from "lucide-react";
import Link from "next/link";

interface PublicViewBannerProps {
  leagueName?: string;
  showLoginPrompt?: boolean;
  className?: string;
}

/**
 * Banner shown when viewing a league in public/read-only mode
 */
export function PublicViewBanner({
  leagueName,
  showLoginPrompt = true,
  className = "",
}: PublicViewBannerProps) {
  return (
    <div
      className={`bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-4 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Eye className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              Viewing {leagueName || "this league"} in public mode
            </p>
            <p className="text-xs text-gray-400">
              Some features are limited. Join the league to access all features.
            </p>
          </div>
        </div>

        {showLoginPrompt && (
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Badge indicating private/restricted content
 */
export function PrivateBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded ${className}`}
    >
      <Lock className="w-3 h-3" />
      Private
    </span>
  );
}

/**
 * Restricted content placeholder for public viewers
 */
export function RestrictedContent({
  title = "Restricted Content",
  description = "Sign in and join the league to view this content",
  showLogin = true,
}: {
  title?: string;
  description?: string;
  showLogin?: boolean;
}) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
      <div className="w-14 h-14 mx-auto rounded-full bg-gray-500/10 flex items-center justify-center mb-4">
        <Lock className="w-7 h-7 text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-400 mb-4">{description}</p>
      {showLogin && (
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-colors"
        >
          <LogIn className="w-4 h-4" />
          Sign In to View
        </Link>
      )}
    </div>
  );
}

/**
 * Inline message for member-only features
 */
export function MemberOnlyFeature({ feature }: { feature: string }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm">
      <Lock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
      <span className="text-yellow-300">
        <strong>{feature}</strong> is available to league members only.
      </span>
    </div>
  );
}
