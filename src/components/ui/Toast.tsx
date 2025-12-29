"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

const typeConfig: Record<ToastType, {
  bg: string;
  border: string;
  icon: string;
  iconBg: string;
}> = {
  success: {
    bg: "bg-emerald-950/90",
    border: "border-emerald-500/30",
    icon: "text-emerald-400",
    iconBg: "bg-emerald-500/20",
  },
  error: {
    bg: "bg-red-950/90",
    border: "border-red-500/30",
    icon: "text-red-400",
    iconBg: "bg-red-500/20",
  },
  info: {
    bg: "bg-blue-950/90",
    border: "border-blue-500/30",
    icon: "text-blue-400",
    iconBg: "bg-blue-500/20",
  },
  warning: {
    bg: "bg-amber-950/90",
    border: "border-amber-500/30",
    icon: "text-amber-400",
    iconBg: "bg-amber-500/20",
  },
};

const TypeIcon = ({ type }: { type: ToastType }) => {
  const iconProps = { size: 18, strokeWidth: 2 };

  switch (type) {
    case "success":
      return <CheckCircle {...iconProps} />;
    case "error":
      return <XCircle {...iconProps} />;
    case "warning":
      return <AlertTriangle {...iconProps} />;
    case "info":
    default:
      return <Info {...iconProps} />;
  }
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const config = typeConfig[toast.type];

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3.5 rounded-xl border backdrop-blur-xl shadow-2xl
        animate-in slide-in-from-right-full fade-in duration-300
        ${config.bg} ${config.border}
      `}
      role="alert"
    >
      <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${config.iconBg} ${config.icon}`}>
        <TypeIcon type={toast.type} />
      </span>
      <span className="flex-1 text-sm font-medium text-white/90">{toast.message}</span>
      <button
        onClick={onRemove}
        className="flex items-center justify-center w-6 h-6 rounded-md text-white/40 hover:text-white/80 hover:bg-white/10 transition-all duration-150"
        aria-label="Dismiss notification"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = "info", duration: number = 4000) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);
      if (duration > 0) setTimeout(() => removeToast(id), duration);
    },
    [removeToast]
  );

  const success = useCallback((message: string) => addToast(message, "success"), [addToast]);
  const error = useCallback((message: string) => addToast(message, "error"), [addToast]);
  const info = useCallback((message: string) => addToast(message, "info"), [addToast]);
  const warning = useCallback((message: string) => addToast(message, "warning"), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, info, warning }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-md">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
