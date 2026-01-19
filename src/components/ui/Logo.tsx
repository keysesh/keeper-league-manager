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
          {/* E Pluribus Unum - "Out of Many, One"
              Converging lines design: Multiple elements from different directions
              all meeting at a central point, symbolizing unity */}

          {/* Background glow effect */}
          <defs>
            <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="white" stopOpacity="0.3" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Central glow */}
          <circle cx="24" cy="24" r="8" fill="url(#centerGlow)" />

          {/* Converging lines from 6 directions */}
          {/* Top line */}
          <path
            d="M24 6 L24 18"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.95"
          />
          {/* Top-right line */}
          <path
            d="M36.5 11.5 L28.2 19.8"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.9"
          />
          {/* Bottom-right line */}
          <path
            d="M36.5 36.5 L28.2 28.2"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.85"
          />
          {/* Bottom line */}
          <path
            d="M24 42 L24 30"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.9"
          />
          {/* Bottom-left line */}
          <path
            d="M11.5 36.5 L19.8 28.2"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.85"
          />
          {/* Top-left line */}
          <path
            d="M11.5 11.5 L19.8 19.8"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.9"
          />

          {/* Central unity point - star/diamond shape */}
          <path
            d="M24 18 L28 24 L24 30 L20 24 Z"
            fill="white"
            opacity="1"
          />

          {/* Inner highlight for depth */}
          <path
            d="M24 20 L26 24 L24 28 L22 24 Z"
            fill="white"
            opacity="0.6"
          />
        </svg>
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white tracking-tight">E Pluribus</span>
          <span className="text-[10px] text-slate-400 font-medium -mt-0.5">Keeper Manager</span>
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

// E Pluribus logo variant - Standalone component for login page
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
          {/* E Pluribus Unum - Converging lines to unity */}

          <defs>
            <radialGradient id="centerGlowLarge" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="white" stopOpacity="0.4" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Central glow */}
          <circle cx="24" cy="24" r="10" fill="url(#centerGlowLarge)" />

          {/* Converging lines from 6 directions */}
          <path d="M24 4 L24 17" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.95" />
          <path d="M38 10 L29 19" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
          <path d="M38 38 L29 29" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />
          <path d="M24 44 L24 31" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
          <path d="M10 38 L19 29" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />
          <path d="M10 10 L19 19" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />

          {/* Central unity diamond */}
          <path d="M24 17 L29 24 L24 31 L19 24 Z" fill="white" />
          <path d="M24 19 L27 24 L24 29 L21 24 Z" fill="white" opacity="0.5" />
        </svg>
      </div>
    </div>
  );
}
