// The session read of the institution front (#2028 c.6993786629 §3.3):
// GET /api/v1/me, the sign-in redirect on 401 and sign-out through
// auth.logout.post. Invented names only.
import { describe, expect, it } from "vitest";
import { goToSignIn, parseSession, readSession, SESSION_PATH, signOut } from "./api";

const BASE = "http://127.0.0.1:1";
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function answering(response: () => Response, seen: { url?: string; init?: RequestInit } = {}) {
  return {
    baseUrl: BASE,
    fetchImpl: (async (input: URL | RequestInfo, init?: RequestInit) => {
      seen.url = String(input);
      seen.init = init;
      return response();
    }) as typeof fetch,
  };
}

describe("parseSession", () => {
  it("reads role, name and the institution's display name", () => {
    expect(parseSession({ role: "student", displayName: "Iva Izmišljena", institution: { slug: "test", displayName: "Izmišljeni fakultet" } }))
      .toEqual({ role: "student", roles: ["student"], displayName: "Iva Izmišljena", institution: "Izmišljeni fakultet" });
  });

  it("picks institution_admin, then teacher, then student from roles", () => {
    expect(parseSession({ roles: ["student", "teacher"] })?.role).toBe("teacher");
    expect(parseSession({ roles: ["teacher", "institution_admin", "student"] })?.role).toBe("institution_admin");
    expect(parseSession({ role: "student", roles: ["teacher"] })?.roles).toEqual(["teacher", "student"]);
  });

  it("reads admin as institution_admin and drops unknown roles", () => {
    expect(parseSession({ role: "admin" })?.role).toBe("institution_admin");
    expect(parseSession({ role: "app_admin", roles: ["rector", 7] })).toEqual({ role: null, roles: [], displayName: null, institution: null });
  });

  it("accepts institutionName and ignores unknown fields", () => {
    expect(parseSession({ role: "teacher", institutionName: " Izmišljena akademija ", extra: { a: 1 } })?.institution).toBe("Izmišljena akademija");
  });

  it("refuses a body that is not an object, and reads own fields only", () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession(["student"])).toBeNull();
    expect(parseSession("student")).toBeNull();
    const inherited = Object.create({ role: "institution_admin" }) as object;
    expect(parseSession(inherited)?.role).toBeNull();
  });
});

describe("readSession", () => {
  it("asks the same origin for GET /api/v1/me with the session cookie", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const read = await readSession(answering(() => json(200, { role: "student" }), seen));
    expect(seen.url).toBe(`${BASE}${SESSION_PATH}`);
    expect(seen.init?.method).toBe("GET");
    expect(seen.init?.credentials).toBe("include");
    expect(read).toEqual({ kind: "signedIn", session: { role: "student", roles: ["student"], displayName: null, institution: null } });
  });

  it("is signed out on 401 with or without a body", async () => {
    expect(await readSession(answering(() => json(401, { code: "unauthenticated" })))).toEqual({ kind: "signedOut" });
    expect(await readSession(answering(() => new Response(null, { status: 401 })))).toEqual({ kind: "signedOut" });
  });

  it("is unavailable, marked noRole, on 403: signed in through AAI@EduHr without a role (E-1)", async () => {
    expect(await readSession(answering(() => json(403, {})))).toEqual({ kind: "unavailable", noRole: true });
  });

  it("is unavailable on any other answer, a body that is not JSON, or a broken connection", async () => {
    for (const response of [
      () => json(503, { code: "unavailable" }),
      () => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }),
      () => new Response("{", { status: 200, headers: { "content-type": "application/json" } }),
      () => json(200, ["student"]),
      () => { throw new TypeError("network"); },
    ]) {
      expect(await readSession(answering(response))).toEqual({ kind: "unavailable" });
    }
  });
});

describe("goToSignIn", () => {
  it("leaves for the contract's login route with the app path as returnTo", () => {
    const went: string[] = [];
    goToSignIn("/aplikacija/zadaci", (href) => went.push(href));
    expect(went).toEqual(["/api/v1/auth/login?returnTo=%2Faplikacija%2Fzadaci"]);
  });

  it("drops a returnTo the server would refuse", () => {
    const went: string[] = [];
    goToSignIn("//elsewhere.example/x", (href) => went.push(href));
    expect(went).toEqual(["/api/v1/auth/login"]);
  });
});

describe("signOut", () => {
  it("posts auth.logout.post and is true on its 303", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    expect(await signOut(answering(() => new Response(null, { status: 303, headers: { location: "/" } }), seen))).toBe(true);
    expect(seen.url).toBe(`${BASE}/api/v1/auth/logout`);
    expect(seen.init?.method).toBe("POST");
  });

  it("is false on a refusal or a broken connection", async () => {
    expect(await signOut(answering(() => json(403, { code: "forbidden" })))).toBe(false);
    expect(await signOut(answering(() => { throw new TypeError("network"); }))).toBe(false);
  });
});
