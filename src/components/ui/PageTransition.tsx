"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * PageTransition - Wraps content with fade animation on route changes
 */
export function PageTransition({ children, className = "" }: PageTransitionProps) {
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayedPath, setDisplayedPath] = useState(pathname);

  useEffect(() => {
    if (pathname !== displayedPath) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setDisplayedPath(pathname);
        setIsTransitioning(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [pathname, displayedPath]);

  return (
    <div
      className={`
        transition-opacity duration-150 ease-out
        ${isTransitioning ? "opacity-0" : "opacity-100"}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/**
 * FadeIn - Animates content on mount
 */
export function FadeIn({
  children,
  delay = 0,
  duration = 200,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`
        transition-all ease-out
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}
        ${className}
      `}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * SlideIn - Slides content in from a direction
 */
export function SlideIn({
  children,
  direction = "up",
  delay = 0,
  duration = 300,
  className = "",
}: {
  children: ReactNode;
  direction?: "up" | "down" | "left" | "right";
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const transforms = {
    up: isVisible ? "translate-y-0" : "translate-y-4",
    down: isVisible ? "translate-y-0" : "-translate-y-4",
    left: isVisible ? "translate-x-0" : "translate-x-4",
    right: isVisible ? "translate-x-0" : "-translate-x-4",
  };

  return (
    <div
      className={`
        transition-all ease-out
        ${isVisible ? "opacity-100" : "opacity-0"}
        ${transforms[direction]}
        ${className}
      `}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * Stagger - Staggers children animations
 */
export function Stagger({
  children,
  staggerDelay = 50,
  initialDelay = 0,
  className = "",
}: {
  children: ReactNode[];
  staggerDelay?: number;
  initialDelay?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <FadeIn key={index} delay={initialDelay + index * staggerDelay}>
          {child}
        </FadeIn>
      ))}
    </div>
  );
}

/**
 * LoadingOverlay - Full-page or section loading overlay
 */
export function LoadingOverlay({
  isLoading,
  children,
  className = "",
}: {
  isLoading: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-[#0F0B1A]/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-400">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ProgressBar - Animated progress indicator
 */
export function ProgressBar({
  progress,
  className = "",
  showLabel = false,
}: {
  progress: number;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
      )}
      <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Pulse - Pulsing indicator
 */
export function Pulse({ className = "", color = "blue" }: { className?: string; color?: "blue" | "green" | "red" | "yellow" }) {
  const colors = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    red: "bg-red-500",
    yellow: "bg-yellow-500",
  };

  return (
    <span className={`relative flex h-3 w-3 ${className}`}>
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors[color]} opacity-75`} />
      <span className={`relative inline-flex rounded-full h-3 w-3 ${colors[color]}`} />
    </span>
  );
}
