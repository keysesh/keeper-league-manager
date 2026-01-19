"use client";

import {
  // Navigation
  Home,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  // Actions
  RefreshCw,
  Plus,
  Minus,
  Edit,
  Trash2,
  Copy,
  Download,
  Upload,
  Search,
  Filter,
  // Status
  Check,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  HelpCircle,
  // Loading
  Loader2,
  Clock,
  // Users & Auth
  Users,
  UserCircle,
  LogOut,
  LogIn,
  Shield,
  ShieldCheck,
  // Sports & Gaming
  Trophy,
  Star,
  Crown,
  Target,
  Flag,
  Zap,
  // Data & Charts
  BarChart3,
  TrendingUp,
  Activity,
  PieChart,
  LineChart,
  Gauge,
  // Settings & Tools
  Settings,
  Wrench,
  // System
  Database,
  Server,
  // Misc
  ExternalLink,
  MoreHorizontal,
  Eye,
  EyeOff,
  Calendar,
  Bell,
  Bookmark,
  // Arrows
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  // Layout
  Grid,
  List,
  Columns,
  Table,
  Layers,
  type LucideIcon,
} from "lucide-react";

// Re-export commonly used icons with semantic names
export {
  // Navigation
  Home as HomeIcon,
  LayoutDashboard as DashboardIcon,
  ChevronLeft as BackIcon,
  ChevronRight as ForwardIcon,
  Menu as MenuIcon,
  X as CloseIcon,

  // Actions
  RefreshCw as SyncIcon,
  Plus as AddIcon,
  Minus as RemoveIcon,
  Edit as EditIcon,
  Trash2 as DeleteIcon,
  Copy as CopyIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Search as SearchIcon,
  Filter as FilterIcon,

  // Status
  Check as CheckIcon,
  X as XIcon,
  AlertTriangle as WarningIcon,
  AlertCircle as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  XCircle as FailureIcon,
  HelpCircle as HelpIcon,

  // Loading
  Loader2 as SpinnerIcon,
  Clock as ClockIcon,

  // Users & Auth
  Users as UsersIcon,
  UserCircle as UserIcon,
  LogOut as LogOutIcon,
  LogIn as LogInIcon,
  Shield as ShieldIcon,
  ShieldCheck as AdminIcon,

  // Sports & Gaming
  Trophy as TrophyIcon,
  Star as StarIcon,
  Crown as CrownIcon,
  Target as TargetIcon,
  Flag as FlagIcon,
  Zap as BoltIcon,

  // Data & Charts
  BarChart3 as ChartIcon,
  TrendingUp as TrendingIcon,
  Activity as ActivityIcon,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Gauge as GaugeIcon,

  // Settings & Tools
  Settings as SettingsIcon,
  Wrench as ToolsIcon,

  // System
  Database as DatabaseIcon,
  Server as ServerIcon,

  // Misc
  ExternalLink as ExternalLinkIcon,
  MoreHorizontal as MoreIcon,
  Eye as ViewIcon,
  EyeOff as HideIcon,
  Calendar as CalendarIcon,
  Bell as NotificationIcon,
  Bookmark as BookmarkIcon,

  // Arrows
  ArrowUp as ArrowUpIcon,
  ArrowDown as ArrowDownIcon,
  ArrowLeft as ArrowLeftIcon,
  ArrowRight as ArrowRightIcon,
  ArrowUpRight as ArrowUpRightIcon,
  ChevronDown as ChevronDownIcon,
  ChevronUp as ChevronUpIcon,
  ChevronsUpDown as SortIcon,

  // Layout
  Grid as GridIcon,
  List as ListIcon,
  Columns as ColumnsIcon,
  Table as TableIcon,
  Layers as LayersIcon,
};

// Football-specific icon (custom SVG)
export function FootballIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
    >
      <ellipse cx="12" cy="12" rx="9" ry="5" transform="rotate(45 12 12)" />
      <path d="M12 12L8.5 8.5M12 12l3.5 3.5M12 12L8.5 15.5M12 12l3.5-3.5" />
    </svg>
  );
}

// Trade/Exchange icon
export function TradeIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
    >
      <path d="M16 3l4 4-4 4" />
      <path d="M20 7H4" />
      <path d="M8 21l-4-4 4-4" />
      <path d="M4 17h16" />
    </svg>
  );
}

// Draft Board icon
export function DraftBoardIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

// History/Timeline icon
export function HistoryIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// Keeper/Lock icon
export function KeeperIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  );
}

// Franchise Tag icon
export function FranchiseIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

// League icon
export function LeagueIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

// Roster/Team icon
export function RosterIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// System Health icon
export function SystemHealthIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

// Discord icon (official brand)
export function DiscordIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      width={size}
      height={size}
      className={className}
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

// Export type for icon props
export type IconProps = {
  className?: string;
  size?: number;
};

export type { LucideIcon };
