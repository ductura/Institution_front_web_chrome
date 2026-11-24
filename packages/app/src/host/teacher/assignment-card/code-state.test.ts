// NZ-13: the state of the enrolment code, its revocation and the deadline the teacher chooses. Invented data only.
import { describe, expect, it } from "vitest";

import { canRevoke, chosenInstant, codeStateOf, codeStateText, revocationOf } from "./code-state";

const NOW = Date.parse("2026-11-24T10:00:00.000Z");
const ok = (body: unknown) => ({ ok: true, body }) as const;

describe("codeStateOf", () => {
  it("reads a code that is still valid and one that has expired", () => {
    expect(codeStateOf(ok({ current: { validUntil: "2026-12-01T22:59:00.000Z" } }), NOW)).toEqual({ kind: "valid", validUntil: "2026-12-01T22:59:00.000Z" });
    expect(codeStateOf(ok({ current: { validUntil: "2026-11-01T22:59:00.000Z" } }), NOW).kind).toBe("expired");
  });
  it("reads no code as none, never as unknown", () => {
    expect(codeStateOf(ok({ current: null }), NOW)).toEqual({ kind: "none" });
  });
  it("a failed or broken answer is unknown, never none", () => {
    expect(codeStateOf({ ok: false, status: 503 }, NOW).kind).toBe("unknown");
    expect(codeStateOf(ok({}), NOW).kind).toBe("unknown");
    expect(codeStateOf(ok(null), NOW).kind).toBe("unknown");
    expect(codeStateOf(ok({ current: { validUntil: "sutra" } }), NOW).kind).toBe("unknown");
  });
});

describe("codeStateText and canRevoke", () => {
  it("says the deadline in Zagreb time and offers revocation only while valid", () => {
    const valid = codeStateOf(ok({ current: { validUntil: "2026-12-01T22:59:00.000Z" } }), NOW);
    expect(codeStateText(valid)).toBe("Vrijedi do 1. 12. 2026. u 23:59.");
    expect(canRevoke(valid)).toBe(true);
    const expired = codeStateOf(ok({ current: { validUntil: "2026-11-01T22:59:00.000Z" } }), NOW);
    expect(codeStateText(expired)).toBe("Istekao 1. 11. 2026. u 23:59.");
    expect(canRevoke(expired)).toBe(false);
    expect(codeStateText({ kind: "none" })).toBe("Nema izdanog koda.");
    expect(canRevoke({ kind: "none" })).toBe(false);
    expect(canRevoke({ kind: "unknown" })).toBe(false);
    // A failed or broken read never claims a state the server did not give.
    expect(codeStateText({ kind: "unknown" })).toContain("nije dostupno");
  });
});

describe("revocationOf", () => {
  it("maps the answers", () => {
    expect(revocationOf(ok({ revoked: true }))).toBe("revoked");
    expect(revocationOf(ok({ revoked: false }))).toBe("nothing");
    expect(revocationOf(ok({}))).toBe("unavailable");
    expect(revocationOf({ ok: false, status: 401 })).toBe("signedOut");
    expect(revocationOf({ ok: false, status: 403 })).toBe("forbidden");
    expect(revocationOf({ ok: false, status: 503 })).toBe("unavailable");
  });
});

describe("chosenInstant", () => {
  it("takes a future Zagreb minute and refuses an empty, impossible or past one", () => {
    expect(chosenInstant("2026-12-14T23:59", NOW)).toEqual({ ok: true, instant: "2026-12-14T22:59:00.000Z" });
    expect(chosenInstant("", NOW).ok).toBe(false);
    expect(chosenInstant("2026-02-30T10:00", NOW).ok).toBe(false);
    expect(chosenInstant("2026-11-01T10:00", NOW).ok).toBe(false);
  });
});
