/**
 * Export utilities for draft board and other data
 */

interface KeeperData {
  playerName: string;
  position: string | null;
  team: string | null;
  rosterName: string | null;
  finalCost: number;
  baseCost: number;
  cascaded: boolean;
  yearsKept?: number;
  keeperType?: string;
}

/**
 * Export keepers data to CSV format
 */
export function exportKeepersToCSV(
  keepers: KeeperData[],
  filename: string = "keepers"
): void {
  const headers = [
    "Player",
    "Position",
    "NFL Team",
    "Fantasy Team",
    "Cost (Round)",
    "Base Cost",
    "Cascaded",
    "Years Kept",
    "Type",
  ];

  const rows = keepers.map((k) => [
    k.playerName,
    k.position || "",
    k.team || "",
    k.rosterName || "",
    k.finalCost.toString(),
    k.baseCost.toString(),
    k.cascaded ? "Yes" : "No",
    k.yearsKept?.toString() || "",
    k.keeperType === "FRANCHISE" ? "Franchise" : "Regular",
  ]);

  downloadCSV([headers, ...rows], `${filename}.csv`);
}

/**
 * Export full draft board to CSV
 */
export function exportDraftBoardToCSV(
  draftBoard: Array<{
    round: number;
    slots: Array<{
      rosterName: string | null;
      status: string;
      keeper?: { playerName: string; position: string | null };
      tradedTo?: string;
    }>;
  }>,
  rosters: Array<{ rosterName: string | null }>,
  filename: string = "draft-board"
): void {
  // Header row with team names
  const headers = ["Round", ...rosters.map((r) => r.rosterName || "Unknown")];

  // Data rows
  const rows = draftBoard.map((round) => {
    const roundData = [round.round.toString()];

    for (const slot of round.slots) {
      if (slot.status === "keeper" && slot.keeper) {
        roundData.push(`${slot.keeper.playerName} (${slot.keeper.position || "?"})`);
      } else if (slot.status === "traded" && slot.tradedTo) {
        roundData.push(`→ ${slot.tradedTo}`);
      } else {
        roundData.push("Open");
      }
    }

    return roundData;
  });

  downloadCSV([headers, ...rows], `${filename}.csv`);
}

/**
 * Generic CSV download helper
 */
function downloadCSV(data: string[][], filename: string): void {
  const csvContent = data
    .map((row) =>
      row
        .map((cell) => {
          // Escape quotes and wrap in quotes if contains comma
          const escaped = cell.replace(/"/g, '""');
          return escaped.includes(",") || escaped.includes('"')
            ? `"${escaped}"`
            : escaped;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export draft board as JSON
 */
export function exportDraftBoardToJSON(
  data: unknown,
  filename: string = "draft-board"
): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Trigger print dialog with custom styling
 */
export function printDraftBoard(): void {
  // Add print class for enhanced styling
  document.body.classList.add("printing-draft-board");

  // Small delay to ensure styles are applied
  setTimeout(() => {
    window.print();

    // Remove print class after printing
    setTimeout(() => {
      document.body.classList.remove("printing-draft-board");
    }, 500);
  }, 100);
}

/**
 * Format data for clipboard copy
 */
export function copyDraftBoardToClipboard(
  draftBoard: Array<{
    round: number;
    slots: Array<{
      rosterName: string | null;
      status: string;
      keeper?: { playerName: string; position: string | null };
      tradedTo?: string;
    }>;
  }>,
  rosters: Array<{ rosterName: string | null }>
): Promise<void> {
  const headers = ["Round", ...rosters.map((r) => r.rosterName || "Unknown")];

  const rows = draftBoard.map((round) => {
    const roundData = [round.round.toString()];

    for (const slot of round.slots) {
      if (slot.status === "keeper" && slot.keeper) {
        roundData.push(`${slot.keeper.playerName}`);
      } else if (slot.status === "traded" && slot.tradedTo) {
        roundData.push(`→${slot.tradedTo}`);
      } else {
        roundData.push("");
      }
    }

    return roundData;
  });

  const text = [headers, ...rows].map((row) => row.join("\t")).join("\n");

  return navigator.clipboard.writeText(text);
}
