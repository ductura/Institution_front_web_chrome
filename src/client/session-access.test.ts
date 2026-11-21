// M1.8: the one place the client names a refusal of access. Invented names only.
import { describe, expect, it } from "vitest";
import {
  accessFailureOf, accessKindOf, routeWithTail, codeOfBody, heldUnsentInput, HELD_LIMIT, holdsUnsentInput, holdUnsentInput, noAccessRoute, releaseUnsentInput,
  SESSION_ENDED_CODES,
} from "./session";
import type { MarkStore } from "./session-marks";

function memory(): MarkStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe("accessFailureOf", () => {
  it("403 is denied whatever its code", () => {
    for (const code of ["forbidden", "not_found", undefined, 7]) expect(accessFailureOf({ status: 403, code })).toBe("denied");
  });
  it("401 with an ended-session code is expired, any other 401 is signedOut", () => {
    expect(accessFailureOf({ status: 401, code: "session_idle_expired" })).toBe("expired");
    expect(accessFailureOf({ status: 401, code: "session_expired" })).toBe("expired");
    expect(accessFailureOf({ status: 401, code: "unauthenticated" })).toBe("signedOut");
    expect(accessFailureOf({ status: 401 })).toBe("signedOut");
    expect(accessFailureOf({ status: 401, code: "SESSION_IDLE_EXPIRED" })).toBe("signedOut");
  });
  it("other statuses are not a refusal of access, even with an ended-session code", () => {
    for (const status of [200, 400, 404, 409, 500, 503]) expect(accessFailureOf({ status, code: "session_idle_expired" })).toBeNull();
    expect([...SESSION_ENDED_CODES].sort()).toEqual(["session_expired", "session_idle_expired"]);
  });
});

describe("codeOfBody", () => {
  it("reads own code, then error; nothing else", () => {
    expect(codeOfBody({ code: "session_idle_expired" })).toBe("session_idle_expired");
    expect(codeOfBody({ error: "session_idle_expired" })).toBe("session_idle_expired");
    expect(codeOfBody({ code: 5, error: "x" })).toBe("x");
    expect(codeOfBody(Object.create({ code: "inherited" }))).toBeNull();
    for (const body of [null, "session_idle_expired", ["a"], 3, {}]) expect(codeOfBody(body)).toBeNull();
  });
});

describe("no-access route", () => {
  it("names the kind and keeps only a local returnTo", () => {
    expect(noAccessRoute("expired", "/zadaci")).toBe("/nema-ovlasti?kind=expired&returnTo=%2Fzadaci");
    expect(noAccessRoute("denied", "//elsewhere.example")).toBe("/nema-ovlasti?kind=denied");
    expect(noAccessRoute("signedOut")).toBe("/nema-ovlasti?kind=signedOut");
  });
  it("an unknown kind shows the screen that reveals the least", () => {
    expect(accessKindOf("expired")).toBe("expired");
    expect(accessKindOf("signedOut")).toBe("signedOut");
    for (const value of [null, "", "denied", "x", "EXPIRED"]) expect(accessKindOf(value)).toBe("denied");
  });
});

describe("routeWithTail", () => {
  it("keeps the query and fragment of the asked address", () => {
    expect(routeWithTail("/nastavnik/zadatak/novi?kolegij=k1", "/nastavnik/zadatak/novi")).toBe("/nastavnik/zadatak/novi?kolegij=k1");
    expect(routeWithTail("/zadaci#dno", "/zadaci")).toBe("/zadaci#dno");
    expect(routeWithTail("/zadaci", "/zadaci")).toBe("/zadaci");
  });
  it("leaves a route that already has them", () => {
    expect(routeWithTail("/app/web/zadaci?a=1", "/zadaci?a=1")).toBe("/zadaci?a=1");
  });
});

describe("unsent input kept on the device", () => {
  it("keeps, reads and releases by scope", () => {
    const store = memory();
    expect(holdUnsentInput("obrazac:komentar", "Izmišljeni tekst", store)).toBe(true);
    expect(heldUnsentInput("obrazac:komentar", store)).toBe("Izmišljeni tekst");
    expect(holdsUnsentInput("obrazac:drugi", store)).toBe(false);
    releaseUnsentInput("obrazac:komentar", store);
    expect(heldUnsentInput("obrazac:komentar", store)).toBeNull();
  });
  it("refuses empty or oversized input and storage that is missing or throws", () => {
    const store = memory();
    expect(holdUnsentInput("a", "", store)).toBe(false);
    expect(holdUnsentInput("a", "x".repeat(HELD_LIMIT + 1), store)).toBe(false);
    expect(store.data.size).toBe(0);
    expect(holdUnsentInput("a", "t", null)).toBe(false);
    const broken: MarkStore = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("full"); }, removeItem: () => { throw new Error("denied"); } };
    expect(holdUnsentInput("a", "t", broken)).toBe(false);
    expect(heldUnsentInput("a", broken)).toBeNull();
    expect(() => releaseUnsentInput("a", broken)).not.toThrow();
  });
});
