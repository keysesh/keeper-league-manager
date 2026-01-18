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
    <aside className="w-72 bg-[#0d0d0d] border-r border-[#2a2a2a] min-h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-[#2a2a2a]">
        <Link
          href="/admin"
          className="flex items-center gap-3 group"
        >
          <span className="flex items-center justify-center w-10 h-10 rounded-md bg-blue-600">
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
                    group flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium
                    transition-all duration-200
                    ${isActive
                      ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      : "text-gray-400 hover:text-white hover:bg-[#1a1a1a] border border-transparent"
                    }
                  `}
                >
                  <span className={`
                    flex items-center justify-center w-9 h-9 rounded-md transition-all duration-200
                    ${isActive
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-[#1a1a1a] text-gray-500 group-hover:bg-[#222222] group-hover:text-gray-300"
                    }
                  `}>
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <span className="tracking-wide">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Back Link */}
      <div className="p-4 border-t border-[#2a2a2a]">
        <Link
          href="/leagues"
          className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-all duration-200 group"
        >
          <span className="flex items-center justify-center w-9 h-9 rounded-md bg-[#1a1a1a] text-gray-500 group-hover:bg-[#222222] group-hover:text-gray-300 transition-all duration-200">
            <ArrowLeft size={18} strokeWidth={2} />
          </span>
          <span className="tracking-wide">Back to App</span>
        </Link>
      </div>
    </aside>
  );
}
