"use client";

import { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "glass";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black border-transparent shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 focus:ring-amber-500",
  secondary:
    "bg-white/[0.05] hover:bg-white/[0.08] text-zinc-100 border-white/[0.08] hover:border-white/[0.12] focus:ring-zinc-500",
  danger:
    "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white border-transparent shadow-lg shadow-red-500/25 focus:ring-red-500",
  ghost:
    "bg-transparent hover:bg-white/[0.05] text-zinc-400 hover:text-white border-transparent focus:ring-zinc-500",
  glass:
    "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border-amber-500/20 hover:border-amber-500/30 backdrop-blur-sm focus:ring-amber-500",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center gap-2
          font-medium rounded-xl border
          transition-all duration-300 ease-out
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#09090b]
          disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? "w-full" : ""}
          ${className}
        `}
        aria-disabled={isDisabled}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <span
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
        ) : (
          leftIcon && <span aria-hidden="true">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && <span aria-hidden="true">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";

// Icon button variant for icon-only buttons
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, variant = "ghost", size = "md", className = "", ...props }, ref) => {
    const iconSizeStyles: Record<ButtonSize, string> = {
      sm: "p-1.5",
      md: "p-2",
      lg: "p-3",
    };

    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center
          rounded-xl border border-transparent
          transition-all duration-300 ease-out
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#09090b]
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${iconSizeStyles[size]}
          ${className}
        `}
        aria-label={label}
        {...props}
      >
        <span aria-hidden="true">{icon}</span>
      </button>
    );
  }
);

IconButton.displayName = "IconButton";
