import { describe, expect, it, vi } from "vitest";

import { readShellAccessWith, shellAccess, shellRoleOf } from "./shell-access";

// WEB-08: the shell access from the institution server; the earlier
// database read (shell-role.ts) stays until its pages move over.

const BASE = "http://server.test";

function server(status: number, body?: unknown) {
  return vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { "content-type": "application/json" },
  })) as unknown as typeof globalThis.fetch;
}

const session = (roles: string[]) => ({ role: null, roles, displayName: null, institution: "Izmišljeni fakultet" }) as never;

describe("shell role from /me (WEB-08)", () => {
  it("picks administrator, then teacher, then student", () => {
    expect(shellRoleOf(session(["student", "institution_admin"]))).toBe("admin");
    expect(shellRoleOf(session(["student", "teacher"]))).toBe("teacher");
    expect(shellRoleOf(session(["student"]))).toBe("student");
    expect(shellRoleOf(session(["network_engineer"]))).toBeNull();
  });

  it("reads 403 as a signed-in account without a role (A-5), whatever the body", () => {
    expect(shellAccess({ kind: "unavailable" }, 403)).toEqual({ kind: "noRole" });
  });

  it("reads a session with no shell role as without a role", () => {
    expect(shellAccess({ kind: "signedIn", session: session(["network_engineer"]) }, 200)).toEqual({ kind: "noRole" });
  });

  it("asks nothing without a cookie", async () => {
    const transport = server(200, { roles: ["student"] });
    expect(await readShellAccessWith(" ", BASE, transport)).toEqual({ kind: "signedOut" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("asks /me with the cookie's transport and maps every answer", async () => {
    const student = server(200, { roles: ["student"], institution: { displayName: "Izmišljeni fakultet" } });
    expect(await readShellAccessWith("s=1", BASE, student)).toEqual({ kind: "signedIn", role: "student", institution: "Izmišljeni fakultet" });
    expect(String((student as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0])).toBe(`${BASE}/api/v1/me`);
    expect(await readShellAccessWith("s=1", BASE, server(403, { error: "no_role" }))).toEqual({ kind: "noRole" });
    expect(await readShellAccessWith("s=1", BASE, server(401, { error: "unauthenticated" }))).toEqual({ kind: "signedOut" });
    expect(await readShellAccessWith("s=1", BASE, server(502, { error: "server_unavailable" }))).toEqual({ kind: "unavailable" });
    const broken = vi.fn(async () => { throw new TypeError("network"); }) as unknown as typeof globalThis.fetch;
    expect(await readShellAccessWith("s=1", BASE, broken)).toEqual({ kind: "unavailable" });
  });
});
