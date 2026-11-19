import { describe, expect, it } from "vitest";

import { signInDecision } from "./sign-in-state";

const student = { kind: "signedIn", role: "student", institution: null } as const;

describe("/prijava states (WEB-08, E-1)", () => {
  it("sends a signed-in person to the asked page or to their own home", () => {
    expect(signInDecision(student, {})).toEqual({ kind: "redirect", to: "/zadaci" });
    expect(signInDecision({ ...student, role: "teacher" }, {})).toEqual({ kind: "redirect", to: "/nastavnik" });
    expect(signInDecision({ ...student, role: "admin" }, {})).toEqual({ kind: "redirect", to: "/ustanova" });
    expect(signInDecision(student, { returnTo: "/upis" })).toEqual({ kind: "redirect", to: "/upis" });
  });

  it("never forwards off the origin, to the API or back to /prijava", () => {
    for (const returnTo of ["//evil.test", "https://evil.test/", "/api/v1/me", "/prijava", "/PRIJAVA/", "/prijava?stanje=odjava"]) {
      expect(signInDecision(student, { returnTo })).toEqual({ kind: "redirect", to: "/zadaci" });
    }
  });

  it("shows A-5 for an account without a role, whatever is asked", () => {
    expect(signInDecision({ kind: "noRole" }, { stanje: "odjava", returnTo: "/zadaci" })).toEqual({ kind: "show", state: "noRole", returnTo: null });
  });

  it("shows unavailable when the server did not answer", () => {
    expect(signInDecision({ kind: "unavailable" }, { stanje: "odjava" })).toEqual({ kind: "show", state: "unavailable", returnTo: null });
  });

  it("reads the asked state, and the plain sign-in for anything else", () => {
    const out = { kind: "signedOut" } as const;
    expect(signInDecision(out, { stanje: "odjava" })).toMatchObject({ state: "signedOut" });
    expect(signInDecision(out, { stanje: "istekla", returnTo: "/zadaci" })).toEqual({ kind: "show", state: "expired", returnTo: "/zadaci" });
    expect(signInDecision(out, { stanje: ["greska", "odjava"] })).toMatchObject({ state: "failed" });
    for (const stanje of [undefined, "", "toString", "__proto__", "nepoznato"]) {
      expect(signInDecision(out, { stanje })).toMatchObject({ state: "signIn" });
    }
  });
});
