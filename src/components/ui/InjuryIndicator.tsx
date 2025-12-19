interface InjuryIndicatorProps {
  status: string | null | undefined;
  compact?: boolean;
}

const injuryStyles: Record<string, { bg: string; text: string; label: string }> = {
  IR: { bg: "bg-red-500/20", text: "text-red-400", label: "IR" },
  Out: { bg: "bg-red-500/20", text: "text-red-400", label: "OUT" },
  Doubtful: { bg: "bg-orange-500/20", text: "text-orange-400", label: "D" },
  Questionable: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "Q" },
  PUP: { bg: "bg-red-500/20", text: "text-red-400", label: "PUP" },
  Suspended: { bg: "bg-red-500/20", text: "text-red-400", label: "SUS" },
  COV: { bg: "bg-gray-500/20", text: "text-gray-400", label: "COV" },
  NA: { bg: "bg-gray-500/20", text: "text-gray-400", label: "NA" },
};

export function InjuryIndicator({ status, compact = true }: InjuryIndicatorProps) {
  if (!status) return null;

  const style = injuryStyles[status] || {
    bg: "bg-yellow-500/20",
    text: "text-yellow-400",
    label: status.charAt(0).toUpperCase(),
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded font-bold ${style.bg} ${style.text} ${
        compact ? "text-[8px] w-4 h-4" : "text-[10px] px-1.5 py-0.5"
      }`}
      title={status}
    >
      {compact ? style.label.charAt(0) : style.label}
    </span>
  );
}
