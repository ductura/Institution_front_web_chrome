import { readSession, type ApiOptions, type Session, type SessionRead } from "@/client/api";

import type { ShellRole } from "./nav";

// WEB-08 (Ductus#2028 c.7008147932): the shell's role comes from the
// institution server's session read (me), never from the database. The
// earlier database read (shell-role.ts) stays for the pages still waiting in
// src/_cekanje. The browser never chooses the role; every page and route
// still checks the session on its own.

/** The transport of a server-side read (cookieTransport of src/client). */
export type Transport = NonNullable<ApiOptions["fetchImpl"]>;

/** What the shell knows of the person behind the request. */
export type ShellAccess =
  | { readonly kind: "signedIn"; readonly role: ShellRole; readonly institution: string | null }
  /** Signed in through AAI@EduHr, but the institution gave the account no role (A-5): /me answers 403. */
  | { readonly kind: "noRole" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

/** The shell role of a session: administrator, then teacher, then student; null for any other. */
export function shellRoleOf(session: Session): ShellRole | null {
  if (session.roles.includes("institution_admin")) return "admin";
  if (session.roles.includes("teacher")) return "teacher";
  if (session.roles.includes("student")) return "student";
  return null;
}

/**
 * The shell's access from one read of /me and its HTTP status: 403 is a
 * signed-in account without a role (A-5), as is a session whose roles the
 * shell has no place for. A status the read did not see is null.
 */
export function shellAccess(read: SessionRead, status: number | null): ShellAccess {
  if (status === 403) return { kind: "noRole" };
  if (read.kind !== "signedIn") return { kind: read.kind };
  const role = shellRoleOf(read.session);
  return role === null ? { kind: "noRole" } : { kind: "signedIn", role, institution: read.session.institution };
}

/**
 * Reads /me at `baseUrl` with `transport` (the request's cookie already on
 * it) and keeps the status, which readSession does not return, so 403 can be
 * told from an unavailable server. Without a cookie nothing is asked.
 */
export async function readShellAccessWith(cookie: string, baseUrl: string, transport: Transport): Promise<ShellAccess> {
  if (cookie.trim() === "") return { kind: "signedOut" };
  let status: number | null = null;
  const read = await readSession({
    baseUrl,
    fetchImpl: async (input, init) => {
      const response = await transport(input, init);
      status = response.status;
      return response;
    },
  });
  return shellAccess(read, status);
}
