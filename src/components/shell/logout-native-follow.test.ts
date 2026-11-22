import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * INT-20c: a fetch cannot follow the logout route's redirect on to the
 * provider's logout, so every confirmed sign-out follows it natively
 * (followLogoutNatively). Leaving straight for "/" keeps the AAI@EduHr
 * session open, and the next sign-in in that browser is silent.
 * Read from the source: the components need a browser to run.
 */
const REPO = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const callers = [join(REPO, "src/components"), join(REPO, "packages/app/src")]
  .flatMap(sources)
  .map((file) => [relative(REPO, file).replaceAll("\\", "/"), readFileSync(file, "utf8")] as const)
  .filter(([, source]) => /\b(signOut|signOutHere)\(/.test(source));

describe("every confirmed sign-out follows the logout route natively (INT-20c)", () => {
  it("finds the sign-outs, the app's dialog among them", () => {
    expect(callers.map(([file]) => file)).toEqual(expect.arrayContaining([
      "packages/app/src/host/SignOut.tsx",
      "src/components/shell/ShellSignOut.tsx",
      "src/components/shell/ShellLogout.tsx",
    ]));
  });

  it.each(callers)("%s", (_file, source) => {
    expect(source).toContain("followLogoutNatively");
    expect(source).not.toMatch(/leaveFor\(\s*["']\/["']\s*\)/);
  });
});
