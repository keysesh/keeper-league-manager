"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { name: "Dashboard", href: "/", icon: "🏠" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r lg:border-gray-800/50 bg-[#0c0c0e] min-h-[calc(100vh-4rem)]">
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? "bg-gradient-to-r from-purple-600/20 to-purple-600/10 text-purple-400 border border-purple-500/20 shadow-lg shadow-purple-500/5"
                  : "text-gray-500 hover:text-white hover:bg-gray-800/50 border border-transparent"
              }`}
            >
              <span className={`text-lg ${isActive ? "" : "opacity-70"}`}>{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Stats Section */}
      <div className="px-4 py-4 mx-4 mb-4 rounded-xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-800/50">
        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Season</p>
        <p className="text-2xl font-bold text-white">{new Date().getFullYear()}</p>
        <p className="text-xs text-purple-400 mt-1">Keeper selections open</p>
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-800/50">
        <p className="text-xs text-gray-600 font-medium">
          E Pluribus Fantasy Football
        </p>
        <p className="text-xs text-gray-700 mt-0.5">
          Keeper Tracker v1.0
        </p>
      </div>
    </aside>
  );
}
