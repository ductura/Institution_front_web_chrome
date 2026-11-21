// M1.8 (DAN-378): how the client reads a refusal of the session, in one place.
// A failed call is a 401 (no valid session), a 403 (the session has no right)
// or anything else. The sign-in is AAI@EduHr only (D-09); this module never
// makes a request, it only names what happened and keeps unsent input on the
// device until the person has signed in again.
import { browserMarkStore, type MarkStore } from "./session-marks";

/** Codes of a 401 that say the session ended by itself (idle or absolute), not that there never was one. */
export const SESSION_ENDED_CODES: ReadonlySet<string> = new Set(["session_idle_expired", "session_expired"]);

/** denied: 403, no right to the view; expired: the session ended; signedOut: no session at all. */
export type AccessFailure = "denied" | "expired" | "signedOut";

/** The shape of a failed call of createApi that matters here. */
export type RefusedCall = { readonly status: number; readonly code?: unknown };

/**
 * What a refused call means for the screen, or null when it is not a refusal
 * of access (the caller handles every other failure itself). A 403 is "denied"
 * whatever its code, so the screen never tells whether the resource exists.
 */
export function accessFailureOf(call: RefusedCall): AccessFailure | null {
  if (call.status === 403) return "denied";
  if (call.status !== 401) return null;
  return typeof call.code === "string" && SESSION_ENDED_CODES.has(call.code) ? "expired" : "signedOut";
}

/** The code of an error body, own fields `code` then `error` (the wire shape of the server); null for anything else. */
export function codeOfBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  for (const field of ["code", "error"]) {
    const value = Object.hasOwn(body, field) ? (body as Record<string, unknown>)[field] : undefined;
    if (typeof value === "string") return value;
  }
  return null;
}

/** The route of the no-access screen under the app's base, with the kind it shows. */
export function noAccessRoute(kind: AccessFailure, returnTo?: string): string {
  const query = new URLSearchParams({ kind });
  if (returnTo !== undefined && returnTo.startsWith("/") && !returnTo.startsWith("//")) query.set("returnTo", returnTo);
  return `/nema-ovlasti?${query.toString()}`;
}

/**
 * The validated route with the query and fragment of the address it came from:
 * `route` is what the app recognised, `href` is what was asked for. A route
 * that already carries them (a base-relative address) is kept as it is.
 */
export function routeWithTail(href: string, route: string): string {
  if (/[?#]/.test(route)) return route;
  const path = href.split(/[?#]/, 1)[0] ?? "";
  return `${route}${href.slice(path.length)}`;
}

/** The kind a screen's address names; anything unknown is "denied", the screen that reveals the least. */
export function accessKindOf(value: string | null): AccessFailure {
  return value === "expired" || value === "signedOut" ? value : "denied";
}

const HELD_PREFIX = "ductura-unsent:";
/** More than this stays out of the device's storage; the editor's own journal keeps the text of a work. */
export const HELD_LIMIT = 20_000;

const keyOf = (scope: string) => `${HELD_PREFIX}${scope}`;

/**
 * Keeps unsent input of one place (`scope`, e.g. a form's name) in this
 * browser's storage while the session is over. True when it is kept; false for
 * empty input, input over the limit, or storage that refuses. Nothing leaves
 * the device, and sign-out clears the browser's storage as it does the rest.
 */
export function holdUnsentInput(scope: string, text: string, store: MarkStore | null = browserMarkStore()): boolean {
  if (store === null || text.length === 0 || text.length > HELD_LIMIT) return false;
  try {
    store.setItem(keyOf(scope), text);
    return true;
  } catch {
    return false;
  }
}

/** The input kept for `scope`, or null. */
export function heldUnsentInput(scope: string, store: MarkStore | null = browserMarkStore()): string | null {
  try {
    return store?.getItem(keyOf(scope)) ?? null;
  } catch {
    return null;
  }
}

/** Drops the kept input once it has been sent. */
export function releaseUnsentInput(scope: string, store: MarkStore | null = browserMarkStore()): void {
  try {
    store?.removeItem(keyOf(scope));
  } catch {
    // Storage refused: nothing was kept that this call could drop.
  }
}

/** Whether anything is kept for `scope`. */
export const holdsUnsentInput = (scope: string, store: MarkStore | null = browserMarkStore()): boolean => heldUnsentInput(scope, store) !== null;
