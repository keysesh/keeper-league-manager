/**
 * Visual identity: the colour a player and a manager are drawn in.
 *
 * The league's character was already in the data and the UI threw it away —
 * every player rendered in the same slate, every manager as a name in 12px
 * grey. Two lookups fix that, and both are pure so the colour a row gets is
 * decided in one place instead of at each call site.
 */

/** Primary and secondary marks for an NFL club, keyed by Sleeper's abbreviation. */
export interface TeamColors {
  primary: string;
  secondary: string;
}

/**
 * Club colours, primary first. Sourced from each club's own brand marks, so
 * some "secondary" values are deliberately metallic (Dallas silver, Vegas
 * silver) rather than a second saturated hue.
 */
export const NFL_TEAM_COLORS: Record<string, TeamColors> = {
  ARI: { primary: "#97233F", secondary: "#000000" },
  ATL: { primary: "#A71930", secondary: "#000000" },
  BAL: { primary: "#241773", secondary: "#9E7C0C" },
  BUF: { primary: "#00338D", secondary: "#C60C30" },
  CAR: { primary: "#0085CA", secondary: "#101820" },
  CHI: { primary: "#0B162A", secondary: "#C83803" },
  CIN: { primary: "#FB4F14", secondary: "#000000" },
  CLE: { primary: "#311D00", secondary: "#FF3C00" },
  DAL: { primary: "#041E42", secondary: "#869397" },
  DEN: { primary: "#FB4F14", secondary: "#002244" },
  DET: { primary: "#0076B6", secondary: "#B0B7BC" },
  GB: { primary: "#203731", secondary: "#FFB612" },
  HOU: { primary: "#03202F", secondary: "#A71930" },
  IND: { primary: "#002C5F", secondary: "#A2AAAD" },
  JAX: { primary: "#006778", secondary: "#D7A22A" },
  KC: { primary: "#E31837", secondary: "#FFB81C" },
  LAC: { primary: "#0080C6", secondary: "#FFC20E" },
  LAR: { primary: "#003594", secondary: "#FFA300" },
  LV: { primary: "#000000", secondary: "#A5ACAF" },
  MIA: { primary: "#008E97", secondary: "#FC4C02" },
  MIN: { primary: "#4F2683", secondary: "#FFC62F" },
  NE: { primary: "#002244", secondary: "#C60C30" },
  NO: { primary: "#101820", secondary: "#D3BC8D" },
  NYG: { primary: "#0B2265", secondary: "#A71930" },
  NYJ: { primary: "#125740", secondary: "#000000" },
  PHI: { primary: "#004C54", secondary: "#A5ACAF" },
  PIT: { primary: "#101820", secondary: "#FFB612" },
  SEA: { primary: "#002244", secondary: "#69BE28" },
  SF: { primary: "#AA0000", secondary: "#B3995D" },
  TB: { primary: "#D50A0A", secondary: "#34302B" },
  TEN: { primary: "#0C2340", secondary: "#4B92DB" },
  WAS: { primary: "#5A1414", secondary: "#FFB612" },
};

/** Free agents, retired players and defenses with no club get this. */
const NO_TEAM: TeamColors = { primary: "#3A3F4B", secondary: "#20242C" };

/** Club colours for a Sleeper team abbreviation, never null. */
export function teamColors(team: string | null | undefined): TeamColors {
  if (!team) return NO_TEAM;
  return NFL_TEAM_COLORS[team.toUpperCase()] ?? NO_TEAM;
}

/**
 * The wash a player's card sits on: his club's colour bled across the card
 * and dropped into the app's ground, so the row is lit by his team rather
 * than outlined in it. Alpha stays low — this reads behind a cutout and
 * behind text, and a saturated fill would fight both.
 */
export function teamWash(team: string | null | undefined, opacity = 0.55): string {
  const { primary } = teamColors(team);
  return `linear-gradient(100deg, ${withAlpha(primary, opacity)}, rgba(12, 14, 20, 0.45))`;
}

/** #RRGGBB plus an alpha, as #RRGGBBAA. Any other input is returned unchanged. */
export function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.max(0, Math.min(1, alpha));
  return hex + Math.round(a * 255).toString(16).padStart(2, "0");
}

/**
 * One hue per manager, walked around the wheel at even chroma so no two read
 * as the same colour at a glance. Twelve entries for a ten-team league, so a
 * league can grow by two before any hue repeats.
 */
export const MANAGER_HUES = [
  "#FF5A3C", "#FF9500", "#FFD23F", "#2FD66B", "#35DBA0", "#00CFD6",
  "#4EA8FF", "#9D7BFF", "#FF5FA8", "#C0C8D4", "#7BE0C3", "#E0A24E",
] as const;

/**
 * Assign hues across a league's managers.
 *
 * Assigned by position in a sorted list rather than by hashing the id: a hash
 * is stable per manager but collides, and two managers sharing a colour
 * defeats the entire point. Sorting makes the mapping deterministic — the same
 * league renders the same colours on every device and every render — at the
 * cost of hues shifting if the league's membership changes, which happens
 * once a year at most.
 */
export function managerHues(ownerSleeperIds: readonly string[]): Map<string, string> {
  const unique = Array.from(new Set(ownerSleeperIds)).sort();
  const out = new Map<string, string>();
  unique.forEach((id, i) => out.set(id, MANAGER_HUES[i % MANAGER_HUES.length]));
  return out;
}

/** A single manager's hue, for when the whole league is already in hand. */
export function managerHue(
  ownerSleeperId: string,
  ownerSleeperIds: readonly string[]
): string {
  return managerHues(ownerSleeperIds).get(ownerSleeperId) ?? MANAGER_HUES[0];
}

/**
 * The full-bleed player cutout — transparent background, shoulders down.
 * Distinct from the `thumb/` crop PlayerAvatar falls back through, which is a
 * circle on a solid plate and cannot sit on a team wash.
 *
 * The extension is `.jpg` and that is not a mistake to "fix": Sleeper serves
 * these as PNG bytes with alpha, under a .jpg path, with a Content-Type of
 * image/jpeg. The honest-looking `.png` path answers 403, which would have
 * failed the way that hurts most — no error, every player quietly falling
 * back to an initial. Browsers and next/image both sniff the real bytes, so
 * transparency survives; the pinned test below is what keeps someone from
 * tidying this into a 403.
 */
export function playerCutoutUrl(sleeperId: string): string {
  return `https://sleepercdn.com/content/nfl/players/${sleeperId}.jpg`;
}

/** A manager's uploaded Sleeper avatar, or null when they never set one. */
export function managerAvatarUrl(avatarId: string | null | undefined): string | null {
  return avatarId ? `https://sleepercdn.com/avatars/thumbs/${avatarId}` : null;
}

/** Initials for a manager with no avatar — never a grey silhouette. */
export function managerInitials(teamName: string | null | undefined): string {
  if (!teamName) return "?";
  const words = teamName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
