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

/** A source takes part in signing out when it posts the logout or renders a sign-out control. */
const SIGN_OUT = /\b(signOut|signOutHere|postLogout)\(|<(LocalLogout|ShellLogout|ShellSignOut|SignOutDialogButton)\b|\bafterSignOut\s*=/;

/**
 * Leaving without the route: allowed only where the page's session already
 * ended elsewhere and nothing is posted (the "leave" step, F-137). Each entry
 * names the exact line, so a new one needs a reason here.
 */
const ALLOWED_EXITS: Readonly<Record<string, readonly string[]>> = {
  "src/components/shell/ShellLogout.tsx": ['window.location.assign("/");'],
  "src/components/editor/LocalDocument.tsx": ['window.location.assign("/");'],
};

/** What keeps a sign-out from following the route natively; empty when nothing does. */
function violations(file: string, source: string): string[] {
  if (!SIGN_OUT.test(source)) return [];
  const allowed = [...(ALLOWED_EXITS[file] ?? [])];
  const found: string[] = [];
  for (const line of source.split("\n").map((text) => text.trim())) {
    const handler = /\bafterSignOut\s*=\s*\{?\s*(.*)$/.exec(line);
    if (handler && !/^followLogoutNatively\b/.test(handler[1] ?? "")) found.push(`afterSignOut: ${line}`);
    if (/\bleaveFor\(\s*["'`]\//.test(line) || /\blocation\.(assign|replace)\(|\blocation\.href\s*=/.test(line)) {
      const at = allowed.indexOf(line);
      if (at === -1) found.push(`exit: ${line}`);
      else allowed.splice(at, 1);
    }
  }
  if ((/\b(signOut|signOutHere)\(/.test(source)) && !source.includes("followLogoutNatively")) {
    found.push("posts the logout but never follows it natively");
  }
  return found;
}

const files = [join(REPO, "src/components"), join(REPO, "packages/app/src")]
  .flatMap(sources)
  .map((file) => [relative(REPO, file).replaceAll("\\", "/"), readFileSync(file, "utf8")] as const)
  .filter(([, source]) => SIGN_OUT.test(source));

describe("every confirmed sign-out follows the logout route natively (INT-20c)", () => {
  it("finds the sign-outs, the app's among them", () => {
    expect(files.map(([file]) => file)).toEqual(expect.arrayContaining([
      "packages/app/src/host/SignOut.tsx",
      "packages/app/src/host/editor/save-status/EditorSessionControls.tsx",
      "src/components/shell/ShellSignOut.tsx",
      "src/components/shell/ShellLogout.tsx",
      "src/components/editor/LocalDocument.tsx",
    ]));
  });

  it.each(files)("%s", (file, source) => {
    expect(violations(file, source)).toEqual([]);
  });

  it("every allowed exit still exists, so the list cannot go stale", () => {
    for (const [file, lines] of Object.entries(ALLOWED_EXITS)) {
      const source = readFileSync(join(REPO, file), "utf8").split("\n").map((text) => text.trim());
      for (const line of lines) expect(source, file).toContain(line);
    }
  });
});

describe("the guard catches what it is for", () => {
  const fixture = (body: string) => `import { signOut } from "@/client/api";\n${body}\n`;

  it.each([
    ["leaving for / after signOut", fixture('if (await signOut()) { leaveFor("/"); }')],
    ["an afterSignOut that leaves", '<LocalLogout afterSignOut={() => leaveFor("/")} />'],
    ["an afterSignOut that assigns", '<LocalLogout afterSignOut={() => window.location.assign("/")} />'],
    ["location.assign after signOutHere", fixture('if (await signOutHere(null, deps)) { followLogoutNatively(); }\nwindow.location.assign("/");')],
    ["location.href after signOut", fixture('if (await signOut()) { followLogoutNatively(); location.href = "/"; }')],
    ["signOut without the native follow", fixture("if (await signOut()) { done(); }")],
  ])("%s", (_name, source) => {
    expect(violations("fixture.tsx", source).length).toBeGreaterThan(0);
  });

  it("an allowed exit counts once per listed line", () => {
    const twice = 'void signOutHere(s, d).then(followLogoutNatively);\nwindow.location.assign("/");\nwindow.location.assign("/");';
    expect(violations("src/components/shell/ShellLogout.tsx", twice)).toEqual(['exit: window.location.assign("/");']);
  });

  it("the native follow passes", () => {
    expect(violations("fixture.tsx", fixture("if (await signOut()) { followLogoutNatively(); }"))).toEqual([]);
    expect(violations("fixture.tsx", "<LocalLogout afterSignOut={followLogoutNatively} />")).toEqual([]);
  });
});
