import { describe, it, expect } from "vitest";
import { AcquisitionType } from "@prisma/client";
import { countKeeperYearsFrom } from "./cost";

const KETSESH = "1000541309863559168";
const RYANRUS = "1000542619040026624";
const IMH88 = "915284089220337664";

const drafted = (season: number) => ({
  acquisitionType: AcquisitionType.DRAFTED,
  isPreDeadline: null,
  season,
});
const trade = (season: number, preDeadline: boolean) => ({
  acquisitionType: AcquisitionType.TRADE,
  isPreDeadline: preDeadline,
  season,
});
const waiver = (season: number) => ({
  acquisitionType: AcquisitionType.WAIVER,
  isPreDeadline: true,
  season,
});

describe("countKeeperYearsFrom", () => {
  it("counts the owner's own consecutive keeps after a draft (Lamar Jackson)", () => {
    // Drafted 2023 R2, kept 2024 and 2025 by the same owner: 2026 is year 3.
    const prior = [
      { season: 2024, ownerSleeperId: KETSESH },
      { season: 2025, ownerSleeperId: KETSESH },
    ];
    expect(countKeeperYearsFrom(prior, drafted(2023), KETSESH, 2026)).toBe(2);
  });

  it("REGRESSION: a re-draft resets the clock, even for the same owner", () => {
    // James Cook: kept by RyanRus in 2024, released, re-drafted by RyanRus in
    // 2025 R3. The 2024 keep is before the new acquisition, so it does not count.
    const prior = [{ season: 2024, ownerSleeperId: RYANRUS }];
    expect(countKeeperYearsFrom(prior, drafted(2025), RYANRUS, 2026)).toBe(0);
  });

  it("REGRESSION: never inherits another owner's keeper years on a draft", () => {
    // DeVonta Smith was kept by two other managers before Bison Nation drafted
    // him in 2025. Those years used to make him R3 instead of R5.
    const prior = [
      { season: 2023, ownerSleeperId: IMH88 },
      { season: 2024, ownerSleeperId: KETSESH },
    ];
    expect(countKeeperYearsFrom(prior, drafted(2025), RYANRUS, 2026)).toBe(0);
  });

  it("a waiver claim resets the clock too", () => {
    // Mark Andrews: kept by another manager in 2023, claimed off waivers in 2025.
    const prior = [{ season: 2023, ownerSleeperId: IMH88 }];
    expect(countKeeperYearsFrom(prior, waiver(2025), KETSESH, 2026)).toBe(0);
  });

  it("a pre-deadline trade carries the contract, including other owners' years", () => {
    // George Pickens: kept 2023/2024/2025 under one owner, traded pre-deadline
    // in 2024. The contract transfers, so 2026 is year 4.
    const prior = [
      { season: 2023, ownerSleeperId: KETSESH },
      { season: 2024, ownerSleeperId: KETSESH },
      { season: 2025, ownerSleeperId: KETSESH },
    ];
    expect(countKeeperYearsFrom(prior, trade(2024, true), RYANRUS, 2026)).toBe(3);
  });

  it("a trade with unknown deadline status is treated as pre-deadline, as before", () => {
    const prior = [{ season: 2024, ownerSleeperId: KETSESH }];
    const unknown = { acquisitionType: AcquisitionType.TRADE, isPreDeadline: null, season: 2024 };
    expect(countKeeperYearsFrom(prior, unknown, RYANRUS, 2026)).toBe(1);
  });

  it("a post-deadline trade resets to the new owner's own keeps", () => {
    const prior = [
      { season: 2024, ownerSleeperId: KETSESH },
      { season: 2025, ownerSleeperId: RYANRUS },
    ];
    expect(countKeeperYearsFrom(prior, trade(2024, false), RYANRUS, 2026)).toBe(1);
  });

  it("ignores keeper rows at or after the target season", () => {
    // The stray 2027 rows from the calendar bug must not inflate a 2026 cost.
    const prior = [
      { season: 2026, ownerSleeperId: KETSESH },
      { season: 2027, ownerSleeperId: KETSESH },
    ];
    expect(countKeeperYearsFrom(prior, drafted(2025), KETSESH, 2026)).toBe(0);
  });

  it("no prior rows means year one", () => {
    // Jaylen Waddle: drafted R2 in 2025, never kept. 2026 is his first keep.
    expect(countKeeperYearsFrom([], drafted(2025), KETSESH, 2026)).toBe(0);
  });
});
