"use client";

import { useEffect, useCallback, useRef, ReactNode } from "react";
import { X } from "lucide-react";

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * Bottom sheet — the mobile-first detail/action surface.
 *
 * Slides up from the bottom edge, respects the home-indicator safe area,
 * and caps its height so the page behind never scrolls. On >=sm viewports
 * it centers as a card so the same component works everywhere.
 */
export function Sheet({ isOpen, onClose, title, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      panelRef.current?.focus();
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
      previousActiveElement.current?.focus();
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative w-full sm:max-w-lg bg-[#141c2b] border-t sm:border border-white/[0.12] rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slide-up outline-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      >
        {/* Drag handle (visual affordance only) */}
        <div className="sm:hidden pt-3 flex justify-center">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 sm:pt-4">
          {title ? (
            <h2 className="text-base font-semibold text-white">{title}</h2>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 -mr-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1c2840] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pb-4 overflow-y-auto max-h-[75vh] sm:max-h-[70vh]">
          {children}
        </div>
      </div>
    </div>
  );
}
