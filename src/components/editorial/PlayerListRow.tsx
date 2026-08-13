"use client";

import { ReactNode } from "react";
import { cn, editorialPositionColor } from "@/lib/design-tokens";
import { Headshot } from "./Headshot";

/**
 * The editorial roster row (36px headshot · name · meta · right slot),
 * measured from the design handoff: 12px gap, 12px/20px padding, hairline
 * bottom, 14px/500 name with ellipsis, 11.5px meta with coloured position.
 */
export function PlayerListRow({
  sleeperId,
  name,
  position,
  meta,
  right,
  onClick,
  dimmed,
}: {
  sleeperId: string | null | undefined;
  name: string;
  position?: string | null;
  /** Rendered after the coloured position token: "· BAL · tag · kept 3 yrs" */
  meta?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  dimmed?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-5 py-3 text-left border-b border-[rgba(214,255,232,.10)]",
        onClick && "active:bg-[rgba(214,255,232,.05)] transition-colors"
      )}
    >
      <Headshot sleeperId={sleeperId} size={36} alt={name} />
      <span className="flex-1 min-w-0">
        <span
          className={cn(
            "block text-[14px] leading-[1.2] font-medium whitespace-nowrap overflow-hidden text-ellipsis",
            dimmed && "text-[#a8ac9d]"
          )}
        >
          {name}
        </span>
        <span className="block text-[11.5px] leading-none text-[#93a08f] mt-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
          {position && (
            <span style={{ color: editorialPositionColor(position) }}>{position}</span>
          )}
          {meta}
        </span>
      </span>
      {right}
    </Tag>
  );
}
