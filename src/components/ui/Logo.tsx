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
        className="rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 p-1.5 shadow-lg shadow-blue-500/25"
        style={{ width: dimension + 12, height: dimension + 12 }}
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: dimension, height: dimension }}
        >
          {/* Shield — "Keeper" / protection motif */}
          <path
            d="M24 4 L40 13 L40 26 C40 35 24 44 24 44 C24 44 8 35 8 26 L8 13 Z"
            stroke="white"
            strokeWidth="2.5"
            strokeLinejoin="round"
            fill="white"
            fillOpacity="0.08"
          />

          {/* Crown inside shield top — franchise / royalty */}
          <path
            d="M16 19 L20 14 L24 18 L28 14 L32 19"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Roster lines — player list / management */}
          <line x1="15" y1="25" x2="33" y2="25" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
          <line x1="16.5" y1="30" x2="31.5" y2="30" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
          <line x1="18.5" y1="35" x2="29.5" y2="35" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
        </svg>
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">E Pluribus</span>
          <span className="text-[10px] text-slate-500 font-medium -mt-0.5 tracking-wide">Keeper Manager</span>
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

// E Pluribus logo variant — Standalone component for login page
export function EPluribusLogo({ size = "md" }: { size: "sm" | "md" | "lg" | "xl" }) {
  const sizes = { sm: 32, md: 48, lg: 64, xl: 80 };
  const dimension = sizes[size];

  return (
    <div className="relative">
      <div
        className="rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 p-2 shadow-2xl shadow-blue-500/30"
        style={{ width: dimension + 16, height: dimension + 16 }}
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: dimension, height: dimension }}
        >
          {/* Shield — larger variant for login page */}
          <path
            d="M24 3 L41 12.5 L41 26.5 C41 36 24 45 24 45 C24 45 7 36 7 26.5 L7 12.5 Z"
            stroke="white"
            strokeWidth="2.8"
            strokeLinejoin="round"
            fill="white"
            fillOpacity="0.1"
          />

          {/* Crown — bolder for large variant */}
          <path
            d="M15 19.5 L19.5 14 L24 18.5 L28.5 14 L33 19.5"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Roster lines */}
          <line x1="14.5" y1="25.5" x2="33.5" y2="25.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
          <line x1="16" y1="30.5" x2="32" y2="30.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
          <line x1="18" y1="35.5" x2="30" y2="35.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.38" />
        </svg>
      </div>
    </div>
  );
}
