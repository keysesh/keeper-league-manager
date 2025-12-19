interface StatPillProps {
  label?: string;
  value: string | number;
  variant?: "primary" | "success" | "warning" | "danger" | "subtle" | "info";
  size?: "xs" | "sm";
}

const variantStyles = {
  primary: "bg-purple-500/20 text-purple-400",
  success: "bg-green-500/20 text-green-400",
  warning: "bg-amber-500/20 text-amber-400",
  danger: "bg-red-500/20 text-red-400",
  subtle: "bg-gray-500/20 text-gray-400",
  info: "bg-cyan-500/20 text-cyan-400",
};

const sizeStyles = {
  xs: "text-[9px] px-1.5 py-0.5",
  sm: "text-[10px] px-2 py-0.5",
};

export function StatPill({
  label,
  value,
  variant = "subtle",
  size = "sm",
}: StatPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-bold ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {label && <span className="opacity-70 font-medium">{label}</span>}
      <span>{value}</span>
    </span>
  );
}
