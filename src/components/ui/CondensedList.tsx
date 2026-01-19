"use client";

import { useMemo, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

interface CondensedListProps<T> {
  items: T[];
  currentUserId?: string;
  getUserId: (item: T) => string;
  renderItem: (item: T, index: number, isCurrentUser: boolean) => ReactNode;
  topCount?: number;
  bottomCount?: number;
  showViewAll?: boolean;
  onViewAll?: () => void;
  viewAllHref?: string;
  viewAllLabel?: string;
  emptyMessage?: string;
}

export function CondensedList<T>({
  items,
  currentUserId,
  getUserId,
  renderItem,
  topCount = 3,
  bottomCount = 2,
  showViewAll = true,
  onViewAll,
  viewAllHref,
  viewAllLabel = "View All",
  emptyMessage = "No items to display",
}: CondensedListProps<T>) {
  const { displayItems, showSeparators } = useMemo(() => {
    if (!items.length) {
      return { displayItems: [], showSeparators: { afterTop: false, beforeBottom: false } };
    }

    const userIdx = currentUserId
      ? items.findIndex(item => getUserId(item) === currentUserId)
      : -1;

    // If we can show all items, no need for condensing
    if (items.length <= topCount + bottomCount + 1) {
      return {
        displayItems: items.map((item, idx) => ({ item, originalIndex: idx, isSeparator: false })),
        showSeparators: { afterTop: false, beforeBottom: false },
      };
    }

    const topItems = items.slice(0, topCount).map((item, idx) => ({
      item,
      originalIndex: idx,
      isSeparator: false
    }));
    const bottomStartIdx = items.length - bottomCount;
    const bottomItems = items.slice(bottomStartIdx).map((item, idx) => ({
      item,
      originalIndex: bottomStartIdx + idx,
      isSeparator: false
    }));

    // Check if user is in top or bottom sections
    const userInTop = userIdx >= 0 && userIdx < topCount;
    const userInBottom = userIdx >= bottomStartIdx;
    const userInMiddle = userIdx >= topCount && userIdx < bottomStartIdx;

    const result: Array<{ item: T; originalIndex: number; isSeparator: boolean }> = [...topItems];

    // Add separator and user if they're in the middle section
    if (userInMiddle && userIdx !== -1) {
      result.push({ item: items[userIdx], originalIndex: -1, isSeparator: true }); // separator marker
      result.push({ item: items[userIdx], originalIndex: userIdx, isSeparator: false });
    } else if (!userInTop && !userInBottom && userIdx === -1) {
      // No user, just show gap separator
      result.push({ item: items[topCount], originalIndex: -1, isSeparator: true });
    }

    // Add separator before bottom if user is not adjacent to bottom
    const needsBottomSeparator = userInMiddle && userIdx < bottomStartIdx - 1;
    if (needsBottomSeparator) {
      result.push({ item: items[bottomStartIdx], originalIndex: -2, isSeparator: true });
    }

    // Add bottom items
    result.push(...bottomItems);

    return {
      displayItems: result,
      showSeparators: {
        afterTop: userInMiddle || (!userInTop && !userInBottom && userIdx === -1),
        beforeBottom: needsBottomSeparator
      },
    };
  }, [items, currentUserId, getUserId, topCount, bottomCount]);

  if (!items.length) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        {emptyMessage}
      </div>
    );
  }

  const ViewAllButton = () => {
    if (!showViewAll || items.length <= topCount + bottomCount + 1) return null;

    const buttonContent = (
      <>
        {viewAllLabel} ({items.length})
        <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
      </>
    );

    if (viewAllHref) {
      return (
        <Link
          href={viewAllHref}
          className="group flex items-center justify-center gap-1 py-2 px-3 text-sm text-blue-500 hover:text-blue-400 font-medium transition-colors rounded-md hover:bg-blue-500/10"
        >
          {buttonContent}
        </Link>
      );
    }

    if (onViewAll) {
      return (
        <button
          onClick={onViewAll}
          className="group flex items-center justify-center gap-1 py-2 px-3 text-sm text-blue-500 hover:text-blue-400 font-medium transition-colors rounded-md hover:bg-blue-500/10 w-full"
        >
          {buttonContent}
        </button>
      );
    }

    return null;
  };

  return (
    <div className="space-y-1">
      {displayItems.map(({ item, originalIndex, isSeparator }, displayIndex) => {
        if (isSeparator) {
          return <Separator key={`separator-${displayIndex}`} />;
        }

        const isCurrentUser = currentUserId ? getUserId(item) === currentUserId : false;
        return (
          <div key={getUserId(item)}>
            {renderItem(item, originalIndex, isCurrentUser)}
          </div>
        );
      })}

      <ViewAllButton />
    </div>
  );
}

function Separator() {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#333] to-transparent" />
      <span className="text-xs text-gray-600 font-medium">...</span>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#333] to-transparent" />
    </div>
  );
}

export default CondensedList;
