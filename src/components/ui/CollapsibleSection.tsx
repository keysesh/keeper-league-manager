"use client";

import { useState, useEffect, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  defaultExpanded?: boolean;
  storageKey?: string;
  badge?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  icon,
  defaultExpanded = true,
  storageKey,
  badge,
  headerAction,
  children,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [mounted, setMounted] = useState(false);

  // Load saved state from localStorage
  useEffect(() => {
    setMounted(true);
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        setIsExpanded(saved === "true");
      }
    }
  }, [storageKey]);

  // Save state to localStorage
  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    if (storageKey) {
      localStorage.setItem(storageKey, String(newState));
    }
  };

  // Prevent hydration mismatch by only rendering after mount
  if (!mounted) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            {icon && (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-[#222] border border-[#2a2a2a] flex items-center justify-center">
                {icon}
              </div>
            )}
            <h2 className="text-base sm:text-lg font-semibold text-white">{title}</h2>
            {badge}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md overflow-hidden">
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#222] transition-colors"
      >
        <div className="flex items-center gap-2 sm:gap-3">
          {icon && (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-[#222] border border-[#2a2a2a] flex items-center justify-center">
              {icon}
            </div>
          )}
          <h2 className="text-base sm:text-lg font-semibold text-white">{title}</h2>
          {badge}
        </div>
        <div className="flex items-center gap-2">
          {headerAction && (
            <span onClick={(e) => e.stopPropagation()}>
              {headerAction}
            </span>
          )}
          <ChevronDown
            className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Content with animation */}
      <div
        className={`transition-all duration-200 ease-in-out overflow-hidden ${
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-[#2a2a2a]">
          {children}
        </div>
      </div>
    </div>
  );
}

export default CollapsibleSection;
