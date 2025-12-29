"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import {
  LayoutDashboard,
  type LucideIcon
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  label: string;
}

const navigation: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Go to Dashboard"
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden lg:flex lg:flex-col lg:w-72 lg:border-r lg:border-gray-800/40 bg-gradient-to-b from-[#0d0c0a] to-[#0a0908] min-h-[calc(100vh-4rem)]"
      aria-label="Main navigation"
    >
      <nav className="flex-1 px-5 py-8 space-y-1.5" role="navigation">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname === "/" && item.href === "/dashboard";
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`
                group flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium
                transition-all duration-200 ease-out
                focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900
                ${isActive
                  ? "bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent text-amber-400 shadow-[inset_0_1px_0_0_rgba(251,191,36,0.1)]"
                  : "text-gray-400 hover:text-gray-100 hover:bg-white/[0.03]"
                }
              `}
            >
              <span className={`
                flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200
                ${isActive
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-gray-800/50 text-gray-500 group-hover:bg-gray-700/50 group-hover:text-gray-300"
                }
              `}>
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="tracking-wide">{item.name}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Season Card */}
      <div className="mx-5 mb-6">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-gray-800/40 via-gray-800/20 to-transparent border border-gray-700/30 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-semibold">
              Current Season
            </span>
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-3xl font-bold text-white tracking-tight">{new Date().getFullYear()}</p>
          <p className="text-xs text-amber-400/90 mt-2 font-medium">Keeper selections open</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-5 border-t border-gray-800/40">
        <p className="text-[11px] text-gray-500 font-medium tracking-wide">
          E Pluribus Fantasy Football
        </p>
        <p className="text-[10px] text-gray-600 mt-1 font-medium">
          Keeper Tracker v1.0
        </p>
      </div>
    </aside>
  );
}
