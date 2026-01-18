"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Trophy,
  Settings,
  ArrowLeft,
  Shield,
  FileText,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { FootballIcon } from "@/components/ui/Icons";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon | typeof FootballIcon;
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/players", label: "Players", icon: FootballIcon as unknown as LucideIcon },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/leagues", label: "Leagues", icon: Trophy },
  { href: "/admin/errors", label: "Errors", icon: AlertTriangle },
  { href: "/admin/audit", label: "Audit Log", icon: FileText },
  { href: "/admin/system", label: "System", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800/50 min-h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-800/50">
        <Link
          href="/admin"
          className="flex items-center gap-3 group"
        >
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/20">
            <Shield size={20} className="text-white" strokeWidth={2} />
          </span>
          <div>
            <span className="block text-sm font-semibold text-white tracking-wide">
              Admin Panel
            </span>
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
              Management Console
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                    transition-all duration-200 ease-out
                    ${isActive
                      ? "bg-gradient-to-r from-indigo-500/20 via-indigo-500/10 to-transparent text-indigo-400 shadow-[inset_0_1px_0_0_rgba(99,102,241,0.1)]"
                      : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.03]"
                    }
                  `}
                >
                  <span className={`
                    flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200
                    ${isActive
                      ? "bg-indigo-500/20 text-indigo-400"
                      : "bg-slate-800/50 text-slate-500 group-hover:bg-slate-700/50 group-hover:text-slate-300"
                    }
                  `}>
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <span className="tracking-wide">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Back Link */}
      <div className="p-4 border-t border-slate-800/50">
        <Link
          href="/leagues"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200 group"
        >
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800/50 text-slate-500 group-hover:bg-slate-700/50 group-hover:text-slate-300 transition-all duration-200">
            <ArrowLeft size={18} strokeWidth={2} />
          </span>
          <span className="tracking-wide">Back to App</span>
        </Link>
      </div>
    </aside>
  );
}
