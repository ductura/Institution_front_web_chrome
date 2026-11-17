// Ported from Ductus src/components/shell/app-shell-home.test.ts at 078c780f
// (DAN-753): next/link is a plain <a> here, and the sign-out lead waits for 2.c3-b.
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { messagesHr as t } from "../../../locales/hr.ts";

import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms.ts";
import { accountPlace } from "./nav";

// #802 part B: a signed-in person always has a way out and a way home. The
// unit project does not compile JSX, so the shell is read from the source,
// like shell-scope-coverage; the decisions themselves are pure functions.
const SCOPE = "c2NvcGUtb2YtYW4taW52ZW50ZWQtcGVyc29u";
const shell = readFileSync(new URL("./AppShell.tsx", import.meta.url), "utf8");

describe("accountPlace", () => {
  it("gives the sign-out to anyone with a scope, also without a role", () => {
    expect(accountPlace(SCOPE, false)).toBe("signOut");
  });

  it("gives nothing without a scope (signed out, or a session that could not be read)", () => {
    expect(accountPlace(null, false)).toBe("none");
  });

  it("keeps the page's own account (the workspace's LocalLogout) in its place", () => {
    expect(accountPlace(SCOPE, true)).toBe("own");
    expect(accountPlace(null, true)).toBe("own");
  });
});

// Web (DAN-753, review PASS c.6905999818): ☰ and the side bar share one id,
// the app's own by default and the catalogue's per shell.
describe("AppShell side bar id", () => {
  it("defaults to bocna-navigacija and ties ☰ to the same id", () => {
    expect(shell).toContain('navId = "bocna-navigacija"');
    expect(shell).toContain("id={navId}>");
    expect(shell).toContain("aria-controls={navId}");
    expect(shell).not.toMatch(/(?:id|aria-controls)="bocna-navigacija"/);
  });
});

describe("AppShell sign-out and Početna (#802 part B)", () => {
  it("decides the account place by accountPlace, not by the role", () => {
    expect(shell).toContain("const place = accountPlace(scope, account !== undefined);");
    expect(shell).toMatch(/place === "signOut" \? \(/);
    expect(shell).not.toMatch(/\) : role !== null \? \(\s*<ShellLogout/);
  });

  // Web: ShellLogout's `lead` comes with 2.c3-b; until then the same label
  // stands alone in the sign-out place, still only with a role.
  it("shows the role label in the sign-out place only with a role", () => {
    const from = shell.indexOf('place === "signOut" ? (');
    const signOut = shell.slice(from, shell.indexOf(") : null;", from));
    expect(signOut).toMatch(/\{role !== null \? <span className=\{styles\.who\}>\{t\.shell\.role\[role\]\}<\/span> : null\}/);
  });

  it("leads the brand and the first crumb, Početna, to homeHref(role)", () => {
    expect(shell).toContain("const home = homeHref(role);");
    expect(shell).toMatch(/<a className=\{styles\.brand\} href=\{home\}/);
    const crumbs = shell.slice(shell.indexOf("aria-label={t.shell.breadcrumb}"));
    expect(crumbs).toMatch(/^[^]*?<a\s+className=\{styles\.homeCrumb\}\s+href=\{home\}[^]*?\{t\.shell\.homeCrumb\}[^]*?\{crumbs\.map/);
  });

  it("keeps Početna in the top bar, outside the side bar's drawer", () => {
    const topbar = shell.indexOf("<header className={styles.topbar}>");
    expect(topbar).toBeGreaterThan(shell.indexOf("</aside>"));
    expect(shell.indexOf("styles.homeCrumb")).toBeGreaterThan(topbar);
  });

  it("says Početna and uses no forbidden term in the new home texts", () => {
    expect(t.shell.homeCrumb).toBe("Početna");
    expect(findForbiddenTerms([t.shell.homeCrumb, ...Object.values(t.home)].join(" "))).toEqual([]);
  });
});

// DAN-891 (891-3): the 64 px rail is for the shell outside the workspace only, from
// 800 px; the workspace's drawer (/rad) and the no-script fallback stay as they were.
describe("AppShell 64 px rail (D-202 t. 1)", () => {
  const css = readFileSync(new URL("./AppShell.module.css", import.meta.url), "utf8");
  const railFrom = css.indexOf("@media (min-width: 800px)");
  const rail = railFrom < 0 ? "" : css.slice(railFrom, css.indexOf("\n}\n", railFrom));

  it("keeps the workspace drawer at 248 px", () => {
    expect(css).toMatch(/\.drawerShell \.sidebar \{\s*width: 248px;/);
  });

  it("keeps the no-script fallback: the side bar in the page flow", () => {
    expect(css).toMatch(/@media \(scripting: none\) \{\s*\.shell\.drawerShell \.sidebar \{\s*position: static;/);
    expect(css).toMatch(/@media \(scripting: none\) and \(max-width: 799\.98px\) \{\s*\.sidebar \{\s*position: static;/);
  });

  it("scopes every rail rule to the shell that is not the drawer", () => {
    const body = rail.slice(rail.indexOf("{") + 1);
    const selectors = body.split("}").map((rule) => rule.split("{")[0]!.trim()).filter((sel) => sel !== "" && !sel.startsWith("/*"));
    expect(selectors.length).toBeGreaterThan(0);
    for (const group of selectors) {
      for (const sel of group.split(",")) expect(sel.trim()).toMatch(/^\.shell:not\(\.drawerShell\) /);
    }
    expect(rail).toMatch(/\.shell:not\(\.drawerShell\) \.sidebar \{[^}]*width: 64px;/);
  });
});
