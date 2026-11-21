import { existsSync } from "node:fs";
import { join } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HOW_IT_WORKS_HREF } from "@/components/shell/nav";
import type { ShellAccess } from "@/components/shell/shell-access";

import { howItWorksShell } from "./access";
import HowItWorks from "./HowItWorks";

// DAN-431 (J-02), WEB-13: every answer of the server session read (me). The
// page is the same for all of them; only the shell follows the session.
const CASES: ReadonlyArray<{ name: string; access: ShellAccess; role: "admin" | "teacher" | "student" | null; signedIn: boolean }> = [
  { name: "signed out (no session)", access: { kind: "signedOut" }, role: null, signedIn: false },
  { name: "server unavailable", access: { kind: "unavailable" }, role: null, signedIn: false },
  { name: "account without a role (A-5)", access: { kind: "noRole" }, role: null, signedIn: true },
  { name: "student", access: { kind: "signedIn", role: "student", institution: "Izmisljeni fakultet" }, role: "student", signedIn: true },
  { name: "teacher", access: { kind: "signedIn", role: "teacher", institution: null }, role: "teacher", signedIn: true },
  { name: "administrator", access: { kind: "signedIn", role: "admin", institution: "Izmisljeni fakultet" }, role: "admin", signedIn: true },
];

describe("howItWorksShell", () => {
  it.each(CASES)("$name: role $role", ({ access, role, signedIn }) => {
    const shell = howItWorksShell(access);
    expect(shell.role).toBe(role);
    expect(shell.signedIn).toBe(signedIn);
  });

  it("shows the institution only of a signed-in read and never invents a role", () => {
    for (const { access } of CASES) {
      const shell = howItWorksShell(access);
      expect(shell.institution).toBe(access.kind === "signedIn" ? access.institution : null);
      if (access.kind !== "signedIn") expect(shell.role).toBeNull();
    }
  });
});

describe("/kako-radi", () => {
  it("is a route that exists", () => {
    expect(existsSync(join(import.meta.dirname, "../../app", HOW_IT_WORKS_HREF, "page.tsx"))).toBe(true);
  });

  it("renders the same page without any reader input", () => {
    const first = renderToStaticMarkup(createElement(HowItWorks));
    const second = renderToStaticMarkup(createElement(HowItWorks));
    expect(first).toBe(second);
    expect(first).not.toMatch(/<form|<input|<button/);
  });
});
