/**
 * Real-world average draft position.
 *
 * The market estimate this replaces was last season's points-per-game over
 * positional replacement — deterministic, league-shaped, and entirely
 * backward-looking, computed off a January stats snapshot. It could not know
 * that a player had been traded, had a new role, or was a rookie, so "market"
 * meant "who scored well last year".
 *
 * ADP comes from Fantasy Football Calculator: the average pick across
 * thousands of real drafts run by real people in the last week, nothing to do
 * with Sleeper or with this league. Parameterised by team count, because a
 * pick number only means a round if you know how many teams are picking.
 */

/** One player's market position, as drafted by the world. */
export interface AdpEntry {
  /** Average overall pick number across the sampled drafts. */
  pick: number;
  /** How many of the sampled drafts actually took him. */
  timesDrafted: number;
}

export interface AdpSample {
  /** PPR / Half-PPR / Standard, as the source labelled it. */
  format: string;
  teams: number;
  /** Number of real drafts behind these averages. */
  totalDrafts: number;
  /** The window the drafts were run in, so staleness is visible. */
  startDate: string;
  endDate: string;
  entries: Map<string, AdpEntry>;
}

interface FfcPlayer {
  name: string;
  position: string;
  team: string;
  adp: number;
  times_drafted: number;
}

/**
 * Scoring format for the FFC endpoint, from the league's own receiving points.
 * A PPR league's first two rounds look nothing like a standard league's, so
 * asking for the wrong format is worse than asking for none.
 */
export function adpFormatForScoring(receptionPoints: number | null | undefined): "ppr" | "half-ppr" | "standard" {
  if (receptionPoints == null) return "standard";
  if (receptionPoints >= 0.75) return "ppr";
  if (receptionPoints >= 0.25) return "half-ppr";
  return "standard";
}

/** Strip everything that differs between two spellings of one player. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replace(/[^a-z]/g, "");
}

/** FFC's position vocabulary differs from Sleeper's in exactly one place. */
export function normalizePosition(position: string): string {
  return position.toUpperCase() === "PK" ? "K" : position.toUpperCase();
}

/**
 * The key a player is joined on.
 *
 * Defenses join on the club, never the name: FFC writes "Seattle Defense"
 * where Sleeper writes "Seattle Seahawks", and no amount of name
 * normalisation reconciles those. Everyone else joins on name + position,
 * which matched 212 of 264 with zero ambiguity; the leftovers were entirely
 * defenses and kickers, both handled here.
 */
export function adpKey(name: string, position: string, team: string | null | undefined): string {
  const pos = normalizePosition(position);
  if (pos === "DEF") return `DEF|${(team ?? "").toUpperCase()}`;
  return `${normalizeName(name)}|${pos}`;
}

/** Parse an FFC response into the join map. Pure, so it can be tested offline. */
export function parseAdpResponse(body: {
  meta?: { type?: string; teams?: number; total_drafts?: number; start_date?: string; end_date?: string };
  players?: FfcPlayer[];
}): AdpSample {
  const entries = new Map<string, AdpEntry>();
  for (const p of body.players ?? []) {
    if (!p?.name || !p.position || typeof p.adp !== "number") continue;
    const key = adpKey(p.name, p.position, p.team);
    // Keep the earliest pick when a key repeats — two rows for one slot means
    // the later one is a duplicate listing, not a cheaper player.
    const prev = entries.get(key);
    if (!prev || p.adp < prev.pick) {
      entries.set(key, { pick: p.adp, timesDrafted: p.times_drafted ?? 0 });
    }
  }
  return {
    format: body.meta?.type ?? "unknown",
    teams: body.meta?.teams ?? 0,
    totalDrafts: body.meta?.total_drafts ?? 0,
    startDate: body.meta?.start_date ?? "",
    endDate: body.meta?.end_date ?? "",
    entries,
  };
}

/**
 * Which round a pick number falls in, for a league of this size.
 * Pick 1 is round 1; with 10 teams pick 10 is still round 1 and 11 is round 2.
 */
export function pickToRound(pick: number, teams: number, maxRounds: number): number {
  if (!Number.isFinite(pick) || pick <= 0 || teams <= 0) return maxRounds;
  return Math.min(maxRounds, Math.max(1, Math.ceil(pick / teams)));
}

/** Fetch the live sample. Throws on a non-Success body so a bad fetch cannot
 *  quietly become "every player is undrafted". */
export async function fetchAdp(
  teams: number,
  format: "ppr" | "half-ppr" | "standard",
  year: number,
  signal?: AbortSignal
): Promise<AdpSample> {
  const url = `https://fantasyfootballcalculator.com/api/v1/adp/${format}?teams=${teams}&year=${year}`;
  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`ADP fetch failed: HTTP ${res.status}`);
  const body = await res.json();
  if (body?.status && body.status !== "Success") {
    throw new Error(`ADP fetch failed: ${body.status}`);
  }
  const sample = parseAdpResponse(body);
  if (sample.entries.size === 0) throw new Error("ADP fetch returned no players");
  return sample;
}
