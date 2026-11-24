// WEB-14c: the local journal's scope is the person's: the `journalScope` field of
// the session route (`SESSION_PATH`, SRV-JS, Ductus#2028 c.7021405589): an opaque SHA-256 hex
// the server derives, like Ductus `principal.scope`. Every work of one person
// shares that journal, so the sign-out summary counts all of them. The same
// read gives `sessionTag` (SRV-ST, c.7023897577), the opaque mark of this
// sign-in that lets the editor stop once the session ends in another tab.
// Fail closed: without a valid scope and tag the editor is not opened at all.

import { browserTransport, SESSION_PATH } from "../../client/api";
import type { SessionMark } from "../../client/session-marks";

// TODO(ugovor): SRV-JS adds `journalScope` to `profile.me.get` in
// @ductura/contracts. Until the bumped contract reaches src/client, this local
// type and reader stand in for createApi("profile.me.get"), which still
// rejects the new field under the closed schema.
export type MeJournalScope = { readonly journalScope: string };
// TODO(ugovor) SRV-ST: `sessionTag` in `profile.me.get`, new at every sign-in.
export type MeSessionTag = { readonly sessionTag: string };

export type ScopeRead =
  | { readonly kind: "scope"; readonly scope: string; readonly session: SessionMark }
  | { readonly kind: "signedOut" }
  /** 200, but no valid `journalScope` or `sessionTag`: the editor stays closed. */
  | { readonly kind: "noScope" }
  /** `offline`: the read got no answer at all (ED-01b). */
  | { readonly kind: "unavailable"; readonly offline?: true };

const SCOPE = /^[0-9a-f]{64}$/;
/** Opaque, but one token: hex, base64, base64url or a UUID fit; spaces, quotes, ";" and "," never. */
const TAG = /^[A-Za-z0-9._~+\/=-]{16,256}$/;

/** The `journalScope` of a 200 body of the session route; null unless it is an own 64-character lower-case hex string. */
export function journalScopeOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  if (!Object.hasOwn(body, "journalScope")) return null;
  const scope = (body as Partial<MeJournalScope>).journalScope;
  return typeof scope === "string" && SCOPE.test(scope) ? scope : null;
}

/** The `sessionTag` of a 200 body of the session route; null unless it is an own token of 16 to 256 such characters. */
export function sessionTagOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  if (!Object.hasOwn(body, "sessionTag")) return null;
  const tag = (body as Partial<MeSessionTag>).sessionTag;
  return typeof tag === "string" && TAG.test(tag) ? tag : null;
}

export type ScopeReadOptions = {
  readonly baseUrl?: string;
  readonly transport?: typeof browserTransport;
  /** When this page read its session: the mark's `at`, newer than any earlier page. */
  readonly now?: () => number;
};

/** One read of the person's journal scope: same origin, with the session cookie. */
export async function readJournalScope(options: ScopeReadOptions = {}): Promise<ScopeRead> {
  const baseUrl = options.baseUrl ?? globalThis.location.origin;
  const transport = options.transport ?? browserTransport;
  let res: Response;
  try {
    res = await transport(new URL(SESSION_PATH, baseUrl), {
      method: "GET",
      credentials: "include",
      redirect: "manual",
      headers: { accept: "application/json" },
    });
  } catch {
    // No answer at all: the network, not the server.
    return { kind: "unavailable", offline: true };
  }
  try {
    if (res.status === 401) return { kind: "signedOut" };
    if (res.status !== 200 || !res.headers.get("content-type")?.startsWith("application/json")) return { kind: "unavailable" };
    const body: unknown = await res.json();
    const scope = journalScopeOf(body);
    const tag = sessionTagOf(body);
    if (scope === null || tag === null) return { kind: "noScope" };
    return { kind: "scope", scope, session: { tag, at: (options.now ?? Date.now)() } };
  } catch {
    return { kind: "unavailable" };
  }
}
