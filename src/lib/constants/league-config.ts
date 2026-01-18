/**
 * E Pluribus Gridiron Dynasty - League Configuration
 *
 * Single-league optimized settings for the E Pluribus keeper league
 */

export const LEAGUE_CONFIG = {
  // League identity
  name: "E Pluribus Gridiron Dynasty",
  shortName: "E Pluribus",
  tagline: "Out of Many, One Champion",

  // Branding colors
  colors: {
    primary: "#3b82f6",      // Blue
    secondary: "#10b981",    // Emerald
    accent: "#f59e0b",       // Amber
    franchise: "#9333ea",    // Purple for franchise tags
  },

  // League structure
  teamCount: 12,
  draftRounds: 16,

  // Keeper rules (specific to E Pluribus)
  keeperRules: {
    maxKeepers: 7,
    maxFranchiseTags: 2,
    maxRegularKeepers: 5,
    regularKeeperMaxYears: 2,
    undraftedRound: 8,
    minimumRound: 1,
    costReductionPerYear: 1,
  },

  // Scoring format
  scoring: "PPR",

  // Draft pick values (based on historical league data)
  // Higher value = more valuable pick
  draftPickValues: {
    1: 100,   // Round 1 - Elite talent
    2: 85,    // Round 2 - High-end starters
    3: 70,    // Round 3 - Solid starters
    4: 55,    // Round 4 - Flex worthy
    5: 42,    // Round 5 - Depth/upside
    6: 32,    // Round 6 - Fliers
    7: 24,    // Round 7 - Lottery tickets
    8: 18,    // Round 8 - Undrafted keeper cost
    9: 14,
    10: 11,
    11: 8,
    12: 6,
    13: 5,
    14: 4,
    15: 3,
    16: 2,
  } as Record<number, number>,

  // Position scarcity multipliers for trade values
  positionScarcity: {
    QB: 0.9,   // QB is less scarce in 1QB leagues
    RB: 1.2,   // RBs are scarce and valuable
    WR: 1.0,   // WRs are the baseline
    TE: 1.1,   // Premium TEs are valuable
    K: 0.3,    // Kickers have minimal value
    DEF: 0.3,  // Defenses have minimal value
  } as Record<string, number>,

  // Age curves by position (peak years)
  ageCurves: {
    QB: { peakStart: 26, peakEnd: 34, cliff: 38 },
    RB: { peakStart: 22, peakEnd: 27, cliff: 30 },
    WR: { peakStart: 24, peakEnd: 30, cliff: 32 },
    TE: { peakStart: 25, peakEnd: 31, cliff: 33 },
  } as Record<string, { peakStart: number; peakEnd: number; cliff: number }>,
} as const;

/**
 * Calculate draft pick trade value
 */
export function getDraftPickValue(round: number): number {
  return LEAGUE_CONFIG.draftPickValues[round] || 1;
}

/**
 * Calculate position-adjusted player value
 */
export function getPositionMultiplier(position: string | null): number {
  if (!position) return 1.0;
  return LEAGUE_CONFIG.positionScarcity[position.toUpperCase()] || 1.0;
}

/**
 * Calculate age-adjusted value modifier
 * Returns a multiplier (1.0 = peak, lower = past peak)
 */
export function getAgeValueModifier(age: number | null, position: string | null): number {
  if (!age || !position) return 1.0;

  const curve = LEAGUE_CONFIG.ageCurves[position.toUpperCase()];
  if (!curve) return 1.0;

  if (age < curve.peakStart) {
    // Young player - slight discount for unproven
    return 0.9 + (age / curve.peakStart) * 0.1;
  }
  if (age <= curve.peakEnd) {
    // Peak years - full value
    return 1.0;
  }
  if (age <= curve.cliff) {
    // Declining - gradual reduction
    const yearsPostPeak = age - curve.peakEnd;
    const yearsToCliff = curve.cliff - curve.peakEnd;
    return 1.0 - (yearsPostPeak / yearsToCliff) * 0.4;
  }
  // Past cliff - significant reduction
  return 0.5 - (age - curve.cliff) * 0.1;
}
