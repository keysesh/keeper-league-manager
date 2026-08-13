import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Navigation policy tripwire.
 *
 * target="_blank" spawns a new browsing context — in the installed
 * Home-Screen app it punts users out to Safari, and repeated taps stack up
 * extra tabs. The Sleeper handoff regression ("Open Sleeper" opening new
 * windows) came from exactly this. New tabs are only acceptable for links
 * whose purpose is to leave Keeper entirely; everything else must navigate
 * in the same context.
 */
const ALLOWED_BLANK_TARGETS = new Set([
  // "Download Sleeper" on the login screen — leaving Keeper is the point.
  path.join("src", "app", "(auth)", "login", "page.tsx"),
  // Discord OAuth docs link in settings — external documentation.
  path.join("src", "app", "(dashboard)", "settings", "accounts", "page.tsx"),
]);

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walk(full, files);
    } else if (/\.(tsx|ts)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe("navigation policy", () => {
  const srcDir = path.join(process.cwd(), "src");
  const offenders = walk(srcDir)
    .filter((f) => fs.readFileSync(f, "utf8").includes('target="_blank"'))
    .map((f) => path.relative(process.cwd(), f));

  it("the Sleeper handoff opens in the same browsing context (no target=_blank)", () => {
    const handoff = path.join(
      "src",
      "components",
      "keepers",
      "SleeperHandoffSheet.tsx"
    );
    expect(offenders).not.toContain(handoff);
  });

  it("no new-tab navigation exists outside the explicit allowlist", () => {
    const unexpected = offenders.filter((f) => !ALLOWED_BLANK_TARGETS.has(f));
    expect(unexpected).toEqual([]);
  });

  it("nothing in the app uses window.open", () => {
    const windowOpen = walk(srcDir).filter((f) =>
      fs.readFileSync(f, "utf8").includes("window.open(")
    );
    expect(windowOpen).toEqual([]);
  });
});
