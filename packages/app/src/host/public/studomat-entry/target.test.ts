import { describe, expect, it } from "vitest";

import { studomatTarget } from "./target";

const ID = "11111111-1111-4111-8111-111111111111";
const q = (s: string) => new URLSearchParams(s);

describe("studomatTarget", () => {
  it("sends a signed-out browser to sign-in, back to the entry", () => {
    expect(studomatTarget({ session: false, role: null, query: q("") })).toEqual({ kind: "sign-in", returnTo: "/ulaz/studomat" });
    expect(studomatTarget({ session: false, role: null, query: q(`kolegij=${ID}`) })).toEqual({ kind: "sign-in", returnTo: `/ulaz/studomat?kolegij=${ID}` });
  });
  it("keeps only a valid kolegij in returnTo, never an extra parameter", () => {
    expect(studomatTarget({ session: false, role: null, query: q(`kolegij=${ID}&osoba=x&token=y`) })).toEqual({ kind: "sign-in", returnTo: `/ulaz/studomat?kolegij=${ID}` });
    expect(studomatTarget({ session: false, role: null, query: q("kolegij=https%3A%2F%2Fevil.example&x=1") })).toEqual({ kind: "sign-in", returnTo: "/ulaz/studomat" });
  });
  it("sends a student with a valid id to the enrolment, lower-cased", () => {
    expect(studomatTarget({ session: true, role: "student", query: q(`kolegij=${ID.toUpperCase()}&x=1`) })).toEqual({ kind: "enroll", courseId: ID });
  });
  it.each(["", "kolegij=", "kolegij=abc", "kolegij=//evil.example", "kolegij=/zadaci", "kolegij=../x", `kolegij=${ID}x`, `kolegij=${ID}&kolegij=${ID}`, "kolegij=11111111-1111-9111-8111-111111111111"])(
    "ignores %j and sends a student home (no open redirect)", (s) => {
      expect(studomatTarget({ session: true, role: "student", query: q(s) })).toEqual({ kind: "home" });
    });
  it("sends teacher, admin and a session without role home even with a valid id", () => {
    for (const role of ["teacher", "admin", null] as const) expect(studomatTarget({ session: true, role, query: q(`kolegij=${ID}`) })).toEqual({ kind: "home" });
  });
});
