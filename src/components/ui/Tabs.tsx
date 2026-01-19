"use client";

import { useState, createContext, useContext, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Context for managing tab state
interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tab components must be used within a Tabs provider");
  }
  return context;
}

// Main Tabs container
interface TabsProps {
  defaultTab?: string;
  value?: string;
  onChange?: (tab: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ defaultTab = "", value, onChange, children, className = "" }: TabsProps) {
  const [internalTab, setInternalTab] = useState(defaultTab);
  const activeTab = value ?? internalTab;

  const setActiveTab = (tab: string) => {
    if (onChange) {
      onChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

// Tab list container
interface TabListProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "pills" | "underline";
}

export function TabList({ children, className = "", variant = "default" }: TabListProps) {
  const variantStyles = {
    default: "flex items-center gap-1 p-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg",
    pills: "flex items-center gap-2",
    underline: "flex items-center gap-0 border-b border-[#2a2a2a]",
  };

  return (
    <div className={`${variantStyles[variant]} ${className}`} role="tablist">
      {children}
    </div>
  );
}

// Individual tab trigger
interface TabTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function TabTrigger({ value, children, className = "", disabled = false }: TabTriggerProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`tab-panel-${value}`}
      disabled={disabled}
      onClick={() => !disabled && setActiveTab(value)}
      className={`
        px-4 py-2 text-sm font-medium rounded-md transition-all duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50
        ${isActive
          ? "bg-[#2a2a2a] text-white shadow-sm"
          : "text-gray-400 hover:text-white hover:bg-[#222]"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${className}
      `}
    >
      {children}
    </button>
  );
}

// Tab content panel
interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ value, children, className = "" }: TabPanelProps) {
  const { activeTab } = useTabsContext();

  if (activeTab !== value) return null;

  return (
    <div
      role="tabpanel"
      id={`tab-panel-${value}`}
      aria-labelledby={`tab-${value}`}
      className={`animate-in fade-in duration-200 ${className}`}
    >
      {children}
    </div>
  );
}

// Link-based tabs (for URL-driven navigation)
interface LinkTabsProps {
  tabs: Array<{
    label: string;
    href: string;
    icon?: ReactNode;
    badge?: number;
  }>;
  className?: string;
  variant?: "default" | "pills" | "underline";
}

export function LinkTabs({ tabs, className = "", variant = "default" }: LinkTabsProps) {
  const pathname = usePathname();

  const variantStyles = {
    default: "flex items-center gap-1 p-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg",
    pills: "flex items-center gap-2",
    underline: "flex items-center gap-0 border-b border-[#2a2a2a]",
  };

  const getTabStyles = (isActive: boolean) => {
    if (variant === "underline") {
      return isActive
        ? "px-4 py-2.5 text-sm font-medium text-blue-400 border-b-2 border-blue-400 -mb-[1px]"
        : "px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white border-b-2 border-transparent -mb-[1px]";
    }
    if (variant === "pills") {
      return isActive
        ? "px-4 py-2 text-sm font-medium rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30"
        : "px-4 py-2 text-sm font-medium rounded-full text-gray-400 hover:text-white hover:bg-[#1a1a1a] border border-transparent";
    }
    return isActive
      ? "px-4 py-2 text-sm font-medium rounded-md bg-[#2a2a2a] text-white shadow-sm"
      : "px-4 py-2 text-sm font-medium rounded-md text-gray-400 hover:text-white hover:bg-[#222]";
  };

  return (
    <div className={`${variantStyles[variant]} ${className}`} role="tablist">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");

        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`
              inline-flex items-center gap-2 transition-all duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50
              ${getTabStyles(isActive)}
            `}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge && tab.badge > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-400">
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

// Page-level tabs component that combines header with tabs
interface PageTabsProps {
  title: string;
  description?: string;
  tabs: Array<{
    label: string;
    href: string;
    icon?: ReactNode;
  }>;
  actions?: ReactNode;
}

export function PageTabs({ title, description, tabs, actions }: PageTabsProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {description && <p className="text-gray-400 mt-1">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <LinkTabs tabs={tabs} variant="underline" />
    </div>
  );
}
