"use client";

import { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
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
    "bg-amber-600 hover:bg-amber-700 text-white border-transparent focus:ring-amber-500",
  secondary:
    "bg-gray-700 hover:bg-gray-600 text-white border-gray-600 focus:ring-gray-500",
  danger:
    "bg-red-600 hover:bg-red-700 text-white border-transparent focus:ring-red-500",
  ghost:
    "bg-transparent hover:bg-gray-800 text-gray-400 hover:text-white border-transparent focus:ring-gray-500",
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
          font-medium rounded-lg border
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900
          disabled:opacity-50 disabled:cursor-not-allowed
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
          rounded-lg border border-transparent
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900
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
