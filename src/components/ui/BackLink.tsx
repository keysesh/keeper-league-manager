"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface BackLinkProps {
  href: string;
  label?: string;
}

export function BackLink({ href, label = "Back" }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-gray-500 hover:text-purple-400 text-sm mb-4 transition-colors group"
    >
      <ArrowLeft
        size={16}
        strokeWidth={2}
        className="group-hover:-translate-x-0.5 transition-transform"
      />
      <span>{label}</span>
    </Link>
  );
}
