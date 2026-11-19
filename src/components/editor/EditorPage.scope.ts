// WEB-14c: the local journal's scope is the person's: the `journalScope` field of
// the session route (`SESSION_PATH`, SRV-JS, Ductus#2028 c.7021405589): an opaque SHA-256 hex
// the server derives, like Ductus `principal.scope`. Every work of one person
// shares that journal, so the sign-out summary counts all of them. Fail
// closed: without a valid scope the editor is not opened at all.

import { browserTransport, SESSION_PATH } from "@/client/api";

// TODO(ugovor): SRV-JS adds `journalScope` to `profile.me.get` in
// @ductura/contracts. Until the bumped contract reaches src/client, this local
// type and reader stand in for createApi("profile.me.get"), which still
// rejects the new field under the closed schema.
export type MeJournalScope = { readonly journalScope: string };

export type ScopeRead =
  | { readonly kind: "scope"; readonly scope: string }
  | { readonly kind: "signedOut" }
  /** 200, but no valid `journalScope`: the editor stays closed. */
  | { readonly kind: "noScope" }
  | { readonly kind: "unavailable" };

const SCOPE = /^[0-9a-f]{64}$/;

/** The `journalScope` of a 200 body of the session route; null unless it is an own 64-character lower-case hex string. */
export function journalScopeOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  if (!Object.hasOwn(body, "journalScope")) return null;
  const scope = (body as Partial<MeJournalScope>).journalScope;
  return typeof scope === "string" && SCOPE.test(scope) ? scope : null;
}

export type ScopeReadOptions = { readonly baseUrl?: string; readonly transport?: typeof browserTransport };

/** One read of the person's journal scope: same origin, with the session cookie. */
export async function readJournalScope(options: ScopeReadOptions = {}): Promise<ScopeRead> {
  const baseUrl = options.baseUrl ?? globalThis.location.origin;
  const transport = options.transport ?? browserTransport;
  try {
    const res = await transport(new URL(SESSION_PATH, baseUrl), {
      method: "GET",
      credentials: "include",
      redirect: "manual",
      headers: { accept: "application/json" },
    });
    if (res.status === 401) return { kind: "signedOut" };
    if (res.status !== 200 || !res.headers.get("content-type")?.startsWith("application/json")) return { kind: "unavailable" };
    const scope = journalScopeOf(await res.json());
    return scope === null ? { kind: "noScope" } : { kind: "scope", scope };
  } catch {
    return { kind: "unavailable" };
  }
}
