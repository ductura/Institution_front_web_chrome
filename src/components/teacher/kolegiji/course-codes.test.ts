import { describe, expect, it } from "vitest";

import { codeOutcome, defaultValidUntil, nextNote, validUntilInstant } from "./course-codes";

describe("defaultValidUntil", () => {
  it("offers the end of the day two weeks later, in Zagreb time", () => {
    // 19. 11. 2026. 10:00 UTC → 3. 12. 2026. (winter time, +01:00)
    expect(defaultValidUntil(Date.parse("2026-11-19T10:00:00Z"))).toBe("2026-12-03T23:59");
  });

  it("takes the Zagreb date, not the UTC one, late in the evening", () => {
    // 23:30 UTC on 1 Dec is already 2 Dec in Zagreb.
    expect(defaultValidUntil(Date.parse("2026-12-01T23:30:00Z"))).toBe("2026-12-16T23:59");
  });

  it("is a minute the field and the server both accept", () => {
    const local = defaultValidUntil(Date.parse("2026-03-20T12:00:00Z"));
    expect(validUntilInstant(local)).toBe("2026-04-03T21:59:00.000Z");
  });
});

describe("validUntilInstant", () => {
  it("refuses an empty field and a date that does not exist", () => {
    expect(validUntilInstant("")).toBeNull();
    expect(validUntilInstant("2027-02-30T12:00")).toBeNull();
    // The minute skipped by the spring clock change.
    expect(validUntilInstant("2027-03-28T02:30")).toBeNull();
  });
});

describe("codeOutcome", () => {
  it("shows a well-formed code once", () => {
    expect(codeOutcome({ ok: true, body: { code: "A1B2-C3D4-E5F6-0789" } })).toEqual({ kind: "issued", code: "A1B2-C3D4-E5F6-0789" });
  });

  it("never shows a malformed code or an empty answer", () => {
    expect(codeOutcome({ ok: true, body: { code: "a1b2-c3d4-e5f6-0789" } })).toEqual({ kind: "unavailable" });
    expect(codeOutcome({ ok: true, body: {} })).toEqual({ kind: "unavailable" });
    expect(codeOutcome({ ok: true, body: null })).toEqual({ kind: "unavailable" });
  });

  it("tells a revocation from nothing to revoke", () => {
    expect(codeOutcome({ ok: true, body: { revoked: true } })).toEqual({ kind: "revoked", revoked: true });
    expect(codeOutcome({ ok: true, body: { revoked: false } })).toEqual({ kind: "revoked", revoked: false });
  });

  it("maps the errors without guessing", () => {
    expect(codeOutcome({ ok: false, status: 401, code: "unauthenticated" })).toEqual({ kind: "signedOut" });
    expect(codeOutcome({ ok: false, status: 401, code: "session_expired" })).toEqual({ kind: "signedOut" });
    expect(codeOutcome({ ok: false, status: 403, code: "forbidden" })).toEqual({ kind: "forbidden" });
    expect(codeOutcome({ ok: false, status: 422, code: "invalid_input" })).toEqual({ kind: "invalid" });
    expect(codeOutcome({ ok: false, status: 400, code: "invalid_json" })).toEqual({ kind: "invalid" });
    expect(codeOutcome({ ok: false, status: 0, code: "client_rejected" })).toEqual({ kind: "invalid" });
    expect(codeOutcome({ ok: false, status: 0, code: "unexpected" })).toEqual({ kind: "unavailable" });
    expect(codeOutcome({ ok: false, status: 503, code: "unavailable" })).toEqual({ kind: "unavailable" });
  });
});

describe("nextNote", () => {
  const until = "2026-12-03T22:59:00.000Z";

  it("keeps only that a code was issued, never the code", () => {
    const note = nextNote(null, { kind: "issued", code: "A1B2-C3D4-E5F6-0789" }, until);
    expect(note).toEqual({ kind: "issued", validUntil: until });
    expect(JSON.stringify(note)).not.toContain("A1B2");
  });

  it("records a revocation, and says when there was nothing to revoke", () => {
    expect(nextNote({ kind: "issued", validUntil: until }, { kind: "revoked", revoked: true }, until)).toEqual({ kind: "revoked" });
    expect(nextNote(null, { kind: "revoked", revoked: false }, until)).toEqual({ kind: "nothingRevoked" });
  });

  it("leaves the previous note after an error", () => {
    const issued = { kind: "issued", validUntil: until } as const;
    expect(nextNote(issued, { kind: "unavailable" }, until)).toBe(issued);
    expect(nextNote(null, { kind: "forbidden" }, until)).toBeNull();
  });
});
