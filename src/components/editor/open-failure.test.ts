import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { messagesHr } from "@/lib/i18n/messages.hr";

import { openFailureExit, openFailureText, type OpenFailure } from "./open-failure";

// ED-01b (NF2-P1, G-1 and G-2): one sentence and one way out per cause of a
// failed open. Invented assignment only.
const ID = "6e2f3a41-5b6c-4d7e-8f90-a1b2c3d4e5f7";
const FAILURES: readonly OpenFailure[] = ["offline", "signedOut", "missing", "server", "reload", "closed"];
const t = messagesHr.workspace;

describe("openFailureText", () => {
  it("names every cause in its own sentence", () => {
    const sentences = FAILURES.map(openFailureText);
    expect(new Set(sentences).size).toBe(FAILURES.length);
    for (const s of sentences) expect(s).toMatch(/^[A-ZČĆŠŽĐ].*\.$/);
  });

  it("promises the device's text only where the device still holds it unsent", () => {
    for (const f of ["offline", "server"] as const) {
      expect(openFailureText(f)).toContain("Ako ste na ovom uređaju već pisali, taj tekst ostaje netaknut.");
      expect(openFailureText(f)).not.toMatch(/spremljen/);
    }
    for (const f of FAILURES.filter((x) => x !== "offline" && x !== "server")) {
      expect(openFailureText(f)).not.toContain("netaknut");
    }
  });

  it("uses no technical words", () => {
    for (const f of FAILURES) expect(openFailureText(f)).not.toMatch(/\b(HTTP|API|server|status|\d{3}|protokol|token|sesij)/i);
  });
});

describe("openFailureExit", () => {
  it.each([
    ["offline", { kind: "retry", label: "Pokušaj ponovno" }],
    ["server", { kind: "retry", label: "Pokušaj ponovno" }],
    ["reload", { kind: "reload", label: "Učitaj ponovno" }],
  ] as const)("%s: %j", (failure, exit) => {
    expect(openFailureExit(failure, { assignmentId: ID })).toEqual(exit);
  });

  it("signed out: sign in, and come back to this work under the host's base", () => {
    const exit = openFailureExit("signedOut", { assignmentId: ID, base: "/app/web" });
    expect(exit).toMatchObject({ kind: "link", label: "Prijavi se" });
    if (exit.kind !== "link") throw new Error("a link");
    expect(new URL(exit.href, "https://primjer.invalid").searchParams.get("returnTo")).toBe(`/app/web/rad/${ID}`);
  });

  it("missing: back to the assignments; closed: the notice of this assignment", () => {
    expect(openFailureExit("missing", { assignmentId: ID, base: "/app/web" }))
      .toEqual({ kind: "link", label: t.openBackToTasks, href: "/app/web/zadaci" });
    expect(openFailureExit("closed", { assignmentId: ID, base: "/app/web" }))
      .toEqual({ kind: "link", label: t.openNoticeLink, href: `/app/web/zadatak/${ID}` });
    expect(openFailureExit("closed", { assignmentId: ID })).toMatchObject({ href: `/zadatak/${ID}` });
  });
});

describe("the sheet", () => {
  const code = readFileSync(new URL("./EditorPageWork.tsx", import.meta.url), "utf8");

  it("says each cause in role=alert with its way out, and no longer the one generic sentence", () => {
    expect(code).toMatch(/role="alert"/);
    expect(code).toMatch(/openFailureText\(/);
    expect(code).toMatch(/openFailureExit\(/);
    expect(code).not.toMatch(/t\.workspace\.openError/);
  });
});
