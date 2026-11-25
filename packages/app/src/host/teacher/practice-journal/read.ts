// WEB-V19-DNEVNIK-MENTOR: the mentor's two writes, through the contract only (practice.placements.post,
// practice.signoffs.post). The reads (practice.placements.get, practice.entries.get) are the student page's
// own, since the contract gives the same answer; the server shows a mentor only the practices of the
// mentorships they lead. A refusal is never "saved": "not found", "signed out", "nothing to sign" and
// "unknown" (503, a timeout, a lost answer: it may have been recorded) are states of their own.
import type { createApi, Input } from "@/client/api";

export { readEntries, readPlacements } from "../../student/practice-journal/read";
export type { EntriesRead, Entry, Placement, PlacementsRead, Signoff } from "../../student/practice-journal/read";

type Api = ReturnType<typeof createApi>;

export type OpenInput = Input<"practice.placements.post">["body"];
export type OpenOutcome =
  | { readonly kind: "opened"; readonly placementId: string }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "invalid" }
  | { readonly kind: "unknown" };

export type SignInput = Input<"practice.signoffs.post">["body"];
export type SignOutcome =
  | { readonly kind: "signed"; readonly entryCount: number; readonly signoffId: string }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "nothingToSign" }
  | { readonly kind: "invalid" }
  | { readonly kind: "unknown" };

const SIGNED_OUT: ReadonlySet<string> = new Set(["unauthorized", "session_expired"]);
const signedOut = (r: { readonly code: string }) => SIGNED_OUT.has(r.code);
const INVALID: ReadonlySet<string> = new Set(["invalid_input", "invalid_json", "client_rejected"]);

/** The client rejects when the connection drops or the body cannot be read: for a write that is "unknown". */
async function attempt<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

export async function openPlacement(call: Api, body: OpenInput): Promise<OpenOutcome> {
  const r = await attempt(() => call("practice.placements.post", { params: undefined, query: undefined, body }));
  if (r === null) return { kind: "unknown" };
  if (r.ok) return { kind: "opened", placementId: r.body.placementId };
  if (signedOut(r)) return { kind: "signedOut" };
  if (r.code === "not_found" || r.status === 404) return { kind: "notFound" };
  return INVALID.has(r.code) ? { kind: "invalid" } : { kind: "unknown" };
}

export async function signEntries(call: Api, placementId: string, body: SignInput): Promise<SignOutcome> {
  const r = await attempt(() => call("practice.signoffs.post", { params: { placementId }, query: undefined, body }));
  if (r === null) return { kind: "unknown" };
  if (r.ok) return { kind: "signed", entryCount: r.body.entryCount, signoffId: r.body.signoffId };
  if (signedOut(r)) return { kind: "signedOut" };
  if (r.code === "not_found" || r.status === 404) return { kind: "notFound" };
  if (r.code === "nothing_to_sign") return { kind: "nothingToSign" };
  return INVALID.has(r.code) ? { kind: "invalid" } : { kind: "unknown" };
}
