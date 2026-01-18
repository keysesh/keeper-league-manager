"use client";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showText?: boolean;
}

const sizes = {
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
};

export function Logo({ size = "md", className = "", showText = false }: LogoProps) {
  const dimension = sizes[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 p-1.5 shadow-lg shadow-amber-500/20"
        style={{ width: dimension + 12, height: dimension + 12 }}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: dimension, height: dimension }}
        >
          {/* Eagle - Geometric/Stylized Design */}
          {/* Body and Head */}
          <path
            d="M16 8C16 8 12 10 10 14C8 18 9 22 12 24C14 25.5 16 26 16 26C16 26 18 25.5 20 24C23 22 24 18 22 14C20 10 16 8 16 8Z"
            fill="white"
            fillOpacity="0.95"
          />
          {/* Left Wing */}
          <path
            d="M10 14C10 14 6 12 3 14C1 15.5 1 18 3 19C5 20 8 19 10 17L10 14Z"
            fill="white"
            fillOpacity="0.9"
          />
          {/* Right Wing */}
          <path
            d="M22 14C22 14 26 12 29 14C31 15.5 31 18 29 19C27 20 24 19 22 17L22 14Z"
            fill="white"
            fillOpacity="0.9"
          />
          {/* Beak */}
          <path
            d="M16 11L14.5 13.5H17.5L16 11Z"
            fill="#0d0c0a"
          />
          {/* Eyes */}
          <circle cx="14" cy="12" r="1" fill="#0d0c0a" />
          <circle cx="18" cy="12" r="1" fill="#0d0c0a" />
          {/* Tail Feathers */}
          <path
            d="M13 24L12 28L14 26L16 28L18 26L20 28L19 24"
            fill="white"
            fillOpacity="0.85"
          />
        </svg>
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white tracking-tight">E Pluribus</span>
          <span className="text-[10px] text-gray-400 font-medium -mt-0.5">Keeper Manager</span>
        </div>
      )}
    </div>
  );
}

export function LogoMark({ size = "md", className = "" }: Omit<LogoProps, "showText">) {
  return <Logo size={size} className={className} showText={false} />;
}

export function LogoFull({ size = "md", className = "" }: Omit<LogoProps, "showText">) {
  return <Logo size={size} className={className} showText={true} />;
}
