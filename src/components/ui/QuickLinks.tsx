"use client";

import Link from "next/link";
import {
  LayoutGrid,
  ArrowLeftRight,
  MessageCircle,
  Activity,
  Settings,
  Star,
  LucideIcon,
} from "lucide-react";

interface QuickLink {
  href: string;
  icon: LucideIcon;
  label: string;
  description?: string;
  color: string;
  gradient: string;
}

interface QuickLinksProps {
  leagueId: string;
  userRosterId?: string;
}

export function QuickLinks({ leagueId, userRosterId }: QuickLinksProps) {
  const links: QuickLink[] = [
    ...(userRosterId ? [{
      href: `/league/${leagueId}/team/${userRosterId}`,
      icon: Star,
      label: "My Keepers",
      description: "Manage your keepers",
      color: "text-amber-400",
      gradient: "from-amber-500/10 to-amber-600/5",
    }] : []),
    {
      href: `/league/${leagueId}/draft-board`,
      icon: LayoutGrid,
      label: "Draft Board",
      description: "View full draft board",
      color: "text-purple-400",
      gradient: "from-purple-500/10 to-purple-600/5",
    },
    {
      href: `/league/${leagueId}/trade-analyzer`,
      icon: ArrowLeftRight,
      label: "Trade",
      description: "Analyze trades",
      color: "text-emerald-400",
      gradient: "from-emerald-500/10 to-emerald-600/5",
    },
    {
      href: `/league/${leagueId}/trade-proposals`,
      icon: MessageCircle,
      label: "Proposals",
      description: "View trade offers",
      color: "text-blue-400",
      gradient: "from-blue-500/10 to-blue-600/5",
    },
    {
      href: `/league/${leagueId}/activity`,
      icon: Activity,
      label: "Activity",
      description: "Recent transactions",
      color: "text-orange-400",
      gradient: "from-orange-500/10 to-orange-600/5",
    },
    {
      href: `/league/${leagueId}/settings`,
      icon: Settings,
      label: "Settings",
      description: "League config",
      color: "text-zinc-400",
      gradient: "from-zinc-500/10 to-zinc-600/5",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`
            group relative overflow-hidden rounded-xl p-3
            bg-gradient-to-br ${link.gradient}
            border border-white/[0.04]
            hover:border-white/[0.1]
            transition-all duration-300
            hover:scale-[1.02]
          `}
        >
          {/* Icon */}
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center mb-2
            bg-black/20 ring-1 ring-white/[0.06]
            group-hover:ring-white/[0.12] transition-all
          `}>
            <link.icon className={`w-4 h-4 ${link.color}`} />
          </div>

          {/* Text */}
          <div>
            <span className="text-sm font-medium text-white block">
              {link.label}
            </span>
            {link.description && (
              <span className="text-[10px] text-zinc-500 block mt-0.5">
                {link.description}
              </span>
            )}
          </div>

          {/* Hover glow */}
          <div className={`
            absolute inset-0 opacity-0 group-hover:opacity-100
            transition-opacity duration-500 pointer-events-none
            bg-gradient-to-br ${link.gradient}
          `} />
        </Link>
      ))}
    </div>
  );
}
