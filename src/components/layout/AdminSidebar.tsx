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
    <aside className="w-72 bg-gradient-to-b from-[#1A1425] to-[#0F0B1A] border-r border-violet-500/10 min-h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-violet-500/10">
        <Link
          href="/admin"
          className="flex items-center gap-3 group"
        >
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg shadow-violet-500/20">
            <Shield size={20} className="text-white" strokeWidth={2} />
          </span>
          <div>
            <span className="block text-sm font-semibold text-white tracking-wide">
              Admin Panel
            </span>
            <span className="block text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">
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
                      ? "bg-gradient-to-r from-violet-500/20 via-violet-500/10 to-transparent text-violet-400 shadow-[inset_0_1px_0_0_rgba(139,92,246,0.1)]"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.03]"
                    }
                  `}
                >
                  <span className={`
                    flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200
                    ${isActive
                      ? "bg-violet-500/20 text-violet-400"
                      : "bg-white/[0.03] text-zinc-500 group-hover:bg-white/[0.06] group-hover:text-zinc-300"
                    }
                  `}>
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <span className="tracking-wide">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Back Link */}
      <div className="p-4 border-t border-violet-500/10">
        <Link
          href="/leagues"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200 group"
        >
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.03] text-zinc-500 group-hover:bg-white/[0.06] group-hover:text-zinc-300 transition-all duration-200">
            <ArrowLeft size={18} strokeWidth={2} />
          </span>
          <span className="tracking-wide">Back to App</span>
        </Link>
      </div>
    </aside>
  );
}
