"use client";

import { cn } from "@/lib/design-tokens";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  variant?: "default" | "elevated" | "interactive" | "gradient" | "feature";
  glow?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
}

const variantStyles = {
  default: "bg-[#0d1420] border border-white/[0.06]",
  elevated: "bg-[#131a28] border border-white/[0.08] shadow-xl",
  interactive: "bg-[#0d1420] border border-white/[0.06] hover:bg-[#131a28] hover:border-white/[0.1] cursor-pointer",
  gradient: "bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/[0.1]",
  feature: "bg-[#0d1420]/80 backdrop-blur-xl border border-white/[0.1]",
};

const paddingStyles = {
  none: "",
  sm: "p-3",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

export function Card({
  children,
  variant = "default",
  glow = false,
  padding = "md",
  className,
  onClick,
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl transition-all duration-200",
        variantStyles[variant],
        paddingStyles[padding],
        glow && "shadow-[0_0_20px_rgba(59,130,246,0.15)]",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function CardHeader({ children, className, action }: CardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3 mb-4", className)}>
      <div className="flex items-center gap-3">{children}</div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
  subtitle?: string;
  icon?: ReactNode;
}

export function CardTitle({ children, className, subtitle, icon }: CardTitleProps) {
  return (
    <div className="flex items-center gap-3">
      {icon && (
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-400">
          {icon}
        </div>
      )}
      <div>
        <h3 className={cn("text-lg font-semibold text-white", className)}>{children}</h3>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn(className)}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn("mt-4 pt-4 border-t border-white/[0.06]", className)}>
      {children}
    </div>
  );
}

interface FeatureCardProps {
  children: ReactNode;
  gradient?: "primary" | "warm" | "cool" | "success";
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

const gradientBgStyles = {
  primary: "from-blue-500 to-purple-500",
  warm: "from-amber-500 to-rose-500",
  cool: "from-cyan-500 to-blue-500",
  success: "from-emerald-500 to-cyan-500",
};

export function FeatureCard({
  children,
  gradient = "primary",
  className,
  padding = "md",
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden border border-white/[0.1]",
        className
      )}
    >
      {/* Gradient background */}
      <div
        className={cn(
          "absolute inset-0 opacity-15 bg-gradient-to-br",
          gradientBgStyles[gradient]
        )}
      />

      {/* Glass overlay */}
      <div className="absolute inset-0 bg-[#0d1420]/80 backdrop-blur-xl" />

      {/* Content */}
      <div className={cn("relative z-10", paddingStyles[padding])}>{children}</div>
    </div>
  );
}

interface HeroCardProps {
  children: ReactNode;
  className?: string;
}

export function HeroCard({ children, className }: HeroCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden border border-white/[0.1]",
        className
      )}
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-blue-600/20 animate-gradient" />

      {/* Glass overlay */}
      <div className="absolute inset-0 bg-[#0d1420]/70 backdrop-blur-2xl" />

      {/* Content */}
      <div className="relative z-10 p-6 sm:p-8">{children}</div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: number;
  trendLabel?: string;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  trend,
  trendLabel,
  icon,
  className,
}: StatCardProps) {
  return (
    <Card variant="default" padding="md" className={className}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {trend !== undefined && (
            <p
              className={cn(
                "text-xs font-medium mt-1",
                trend > 0 ? "text-emerald-400" : trend < 0 ? "text-red-400" : "text-slate-500"
              )}
            >
              {trend > 0 ? "+" : ""}
              {trend} {trendLabel}
            </p>
          )}
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-400">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
