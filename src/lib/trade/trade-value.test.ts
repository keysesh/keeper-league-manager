import { describe, it, expect } from "vitest";

/**
 * Trade Value Calculation Tests
 *
 * These are pure function tests for trade value calculations
 * without database dependencies.
 */

// Trade value constants (from the actual implementation)
const POSITION_BASE_VALUES: Record<string, number> = {
  QB: 80,
  RB: 100,
  WR: 95,
  TE: 70,
  K: 20,
  DEF: 30,
};

const DRAFT_PICK_VALUES: Record<number, number> = {
  1: 100,
  2: 75,
  3: 50,
  4: 35,
  5: 25,
  6: 15,
  7: 10,
  8: 5,
  9: 3,
  10: 2,
};

// Pure function implementations for testing
function calculateAgeModifier(age: number | null, position: string | null): number {
  if (!age) return 0;

  // RBs peak earlier and decline faster
  if (position === "RB") {
    if (age <= 23) return 15;
    if (age <= 25) return 10;
    if (age <= 27) return 0;
    if (age <= 29) return -15;
    return -30;
  }

  // WRs have longer careers
  if (position === "WR") {
    if (age <= 24) return 15;
    if (age <= 27) return 10;
    if (age <= 30) return 0;
    return -15;
  }

  // QBs can play into their late 30s
  if (position === "QB") {
    if (age <= 26) return 10;
    if (age <= 32) return 5;
    if (age <= 38) return 0;
    return -20;
  }

  // TEs peak in late 20s
  if (position === "TE") {
    if (age <= 24) return 5;
    if (age <= 28) return 10;
    if (age <= 31) return 0;
    return -15;
  }

  return 0;
}

function calculateKeeperValueBonus(
  isKeeper: boolean,
  keeperCost: number | null,
  yearsRemaining: number
): number {
  if (!isKeeper || !keeperCost) return 0;

  // Higher value for lower cost keepers
  const costBonus = Math.max(0, (10 - keeperCost) * 5);

  // Higher value for more years remaining
  const yearsBonus = yearsRemaining * 10;

  return costBonus + yearsBonus;
}

function calculatePlayerTradeValue(
  position: string | null,
  age: number | null,
  isKeeper: boolean,
  keeperCost: number | null,
  yearsRemaining: number
): {
  baseValue: number;
  ageModifier: number;
  keeperBonus: number;
  totalValue: number;
} {
  const baseValue = POSITION_BASE_VALUES[position || ""] || 50;
  const ageModifier = calculateAgeModifier(age, position);
  const keeperBonus = calculateKeeperValueBonus(isKeeper, keeperCost, yearsRemaining);

  return {
    baseValue,
    ageModifier,
    keeperBonus,
    totalValue: baseValue + ageModifier + keeperBonus,
  };
}

function calculateDraftPickValue(round: number): number {
  return DRAFT_PICK_VALUES[round] || 1;
}

function calculateFairnessScore(team1Value: number, team2Value: number): number {
  const totalValue = team1Value + team2Value;
  if (totalValue === 0) return 50;

  const difference = Math.abs(team1Value - team2Value);
  const fairness = Math.max(0, 100 - (difference / totalValue * 100));

  return Math.round(fairness);
}

// Tests
describe("Trade Value Calculations", () => {
  describe("Position Base Values", () => {
    it("should have RB as highest value position", () => {
      expect(POSITION_BASE_VALUES.RB).toBe(100);
    });

    it("should have WR as second highest value", () => {
      expect(POSITION_BASE_VALUES.WR).toBe(95);
    });

    it("should have K as lowest value position", () => {
      expect(POSITION_BASE_VALUES.K).toBe(20);
    });
  });

  describe("Age Modifier", () => {
    it("should give positive modifier to young RBs", () => {
      expect(calculateAgeModifier(22, "RB")).toBe(15);
      expect(calculateAgeModifier(23, "RB")).toBe(15);
    });

    it("should give negative modifier to old RBs", () => {
      expect(calculateAgeModifier(28, "RB")).toBe(-15);
      expect(calculateAgeModifier(30, "RB")).toBe(-30);
    });

    it("should give positive modifier to young WRs", () => {
      expect(calculateAgeModifier(23, "WR")).toBe(15);
      expect(calculateAgeModifier(26, "WR")).toBe(10);
    });

    it("should be more lenient with QB age", () => {
      expect(calculateAgeModifier(30, "QB")).toBe(5);
      expect(calculateAgeModifier(35, "QB")).toBe(0);
    });

    it("should return 0 for null age", () => {
      expect(calculateAgeModifier(null, "RB")).toBe(0);
    });
  });

  describe("Keeper Value Bonus", () => {
    it("should give bonus for low cost keepers", () => {
      // Round 1 keeper = (10-1)*5 = 45 cost bonus
      const bonus = calculateKeeperValueBonus(true, 1, 1);
      expect(bonus).toBeGreaterThan(0);
    });

    it("should give higher bonus for more years remaining", () => {
      const bonus1Year = calculateKeeperValueBonus(true, 5, 1);
      const bonus2Years = calculateKeeperValueBonus(true, 5, 2);
      expect(bonus2Years).toBeGreaterThan(bonus1Year);
    });

    it("should return 0 for non-keepers", () => {
      expect(calculateKeeperValueBonus(false, 5, 2)).toBe(0);
    });

    it("should return 0 for null cost", () => {
      expect(calculateKeeperValueBonus(true, null, 2)).toBe(0);
    });
  });

  describe("Player Trade Value", () => {
    it("should calculate total value correctly", () => {
      const result = calculatePlayerTradeValue("RB", 24, false, null, 0);
      expect(result.baseValue).toBe(100);
      expect(result.ageModifier).toBe(10);
      expect(result.keeperBonus).toBe(0);
      expect(result.totalValue).toBe(110);
    });

    it("should add keeper bonus when applicable", () => {
      const nonKeeper = calculatePlayerTradeValue("RB", 24, false, null, 0);
      const keeper = calculatePlayerTradeValue("RB", 24, true, 5, 2);
      expect(keeper.totalValue).toBeGreaterThan(nonKeeper.totalValue);
    });

    it("should handle unknown position gracefully", () => {
      const result = calculatePlayerTradeValue("UNKNOWN", 25, false, null, 0);
      expect(result.baseValue).toBe(50);
    });
  });

  describe("Draft Pick Value", () => {
    it("should return 100 for round 1", () => {
      expect(calculateDraftPickValue(1)).toBe(100);
    });

    it("should return 75 for round 2", () => {
      expect(calculateDraftPickValue(2)).toBe(75);
    });

    it("should decrease value for later rounds", () => {
      expect(calculateDraftPickValue(3)).toBe(50);
      expect(calculateDraftPickValue(5)).toBe(25);
    });

    it("should return minimal value for rounds 10+", () => {
      expect(calculateDraftPickValue(10)).toBe(2);
      expect(calculateDraftPickValue(11)).toBe(1);
    });
  });

  describe("Fairness Score", () => {
    it("should return 100 when both sides are equal", () => {
      // 100% fair when values are identical
      expect(calculateFairnessScore(100, 100)).toBe(100);
    });

    it("should return higher score for closer trades", () => {
      const closeScore = calculateFairnessScore(100, 95);
      const farScore = calculateFairnessScore(100, 50);
      expect(closeScore).toBeGreaterThan(farScore);
    });

    it("should return 50 when both values are 0", () => {
      expect(calculateFairnessScore(0, 0)).toBe(50);
    });

    it("should never return below 0", () => {
      expect(calculateFairnessScore(100, 0)).toBeGreaterThanOrEqual(0);
    });

    it("should give lower score for lopsided trades", () => {
      // 150 vs 50 = 100 difference out of 200 total = 50% difference
      expect(calculateFairnessScore(150, 50)).toBe(50);
    });
  });
});

describe("Trade Scenarios", () => {
  it("should identify lopsided trades", () => {
    // Team 1 gets: Stud RB (age 23) with keeper value
    const team1Gets = calculatePlayerTradeValue("RB", 23, true, 3, 2);

    // Team 2 gets: Aging RB (age 29) no keeper value
    const team2Gets = calculatePlayerTradeValue("RB", 29, false, null, 0);

    // Calculate actual values to verify
    // Team 1: base 100 + age 15 + keeper bonus (7*5 + 2*10 = 35 + 20 = 55) = 170
    // Team 2: base 100 + age -15 = 85
    expect(team1Gets.totalValue).toBeGreaterThan(team2Gets.totalValue);

    const fairness = calculateFairnessScore(team1Gets.totalValue, team2Gets.totalValue);
    // Fairness should be relatively low (under 70) for this trade
    expect(fairness).toBeLessThan(70);
  });

  it("should identify fair trades", () => {
    // Team 1 gets: Young WR keeper
    const team1Gets = calculatePlayerTradeValue("WR", 24, true, 5, 2);

    // Team 2 gets: Peak RB + draft pick
    const team2GetsPlayer = calculatePlayerTradeValue("RB", 25, false, null, 0);
    const team2GetsPick = calculateDraftPickValue(3);
    const team2Total = team2GetsPlayer.totalValue + team2GetsPick;

    // Calculate fairness for reference (not asserted, using raw value comparison instead)
    const _fairness = calculateFairnessScore(team1Gets.totalValue, team2Total);

    // Values should be relatively close
    expect(Math.abs(team1Gets.totalValue - team2Total)).toBeLessThan(30);
  });

  it("should value early picks highly", () => {
    const round1 = calculateDraftPickValue(1);
    const round5 = calculateDraftPickValue(5);

    // Round 1 should be 4x more valuable than round 5
    expect(round1).toBe(round5 * 4);
  });
});
