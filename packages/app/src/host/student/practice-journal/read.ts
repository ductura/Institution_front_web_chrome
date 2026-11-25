// WEB-V19-DNEVNIK-STUDENT: the reads and the one write of the journal, through the contract only
// (practice.placements.get, practice.entries.get, practice.entries.post). A refusal is never an empty
// list: "not found" (another student's practice reads the same as an unknown one), "signed out" and
// "unavailable" are states of their own.
import type { createApi, Input } from "@/client/api";

type Api = ReturnType<typeof createApi>;
/** The hours of one entry: the steps the contract allows. */
export type Hours = Input<"practice.entries.post">["body"]["hours"];

export type Placement = {
  readonly placementId: string; readonly mentorshipId: string; readonly organisationName: string;
  readonly startsOn: string; readonly endsOn: string; readonly entryCount: number; readonly signedThrough: string | null;
};
export type Entry = {
  readonly entryId: string; readonly date: string; readonly hours: Hours; readonly text: string;
  readonly correctsEntryId: string | null; readonly createdAt: string;
};
export type Signoff = {
  readonly signoffId: string; readonly throughDate: string; readonly entryCount: number; readonly entriesSha256: string;
  readonly comment: string | null; readonly signedAt: string; readonly mentor: { readonly id: string; readonly givenName: string; readonly familyName: string };
};

export type PlacementsRead =
  | { readonly kind: "ok"; readonly placements: readonly Placement[] }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };
export type EntriesRead =
  | { readonly kind: "ok"; readonly entries: readonly Entry[]; readonly signoffs: readonly Signoff[] }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };
export type AddOutcome =
  | { readonly kind: "saved"; readonly entryId: string }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "closed" }
  | { readonly kind: "conflict" }
  | { readonly kind: "invalid" }
  /** 503, a timeout, a broken connection: the entry may have been recorded. */
  | { readonly kind: "unknown" };

const SIGNED_OUT: ReadonlySet<string> = new Set(["unauthorized", "session_expired"]);
const signedOut = (r: { readonly code: string }) => SIGNED_OUT.has(r.code);

export async function readPlacements(call: Api): Promise<PlacementsRead> {
  const r = await call("practice.placements.get", { params: undefined, query: undefined, body: undefined });
  if (!r.ok) return signedOut(r) ? { kind: "signedOut" } : { kind: "unavailable" };
  return { kind: "ok", placements: r.body.placements };
}

export async function readEntries(call: Api, placementId: string): Promise<EntriesRead> {
  const r = await call("practice.entries.get", { params: { placementId }, query: undefined, body: undefined });
  if (!r.ok) {
    if (signedOut(r)) return { kind: "signedOut" };
    return r.status === 404 || r.code === "not_found" ? { kind: "notFound" } : { kind: "unavailable" };
  }
  return { kind: "ok", entries: r.body.entries, signoffs: r.body.signoffs };
}

export type NewEntry = { readonly date: string; readonly hours: Hours; readonly text: string; readonly correctsEntryId?: string };

export async function addEntry(call: Api, placementId: string, body: NewEntry): Promise<AddOutcome> {
  const r = await call("practice.entries.post", { params: { placementId }, query: undefined, body });
  if (r.ok) return { kind: "saved", entryId: r.body.entryId };
  if (signedOut(r)) return { kind: "signedOut" };
  switch (r.code) {
    case "not_found": return { kind: "notFound" };
    case "placement_closed": return { kind: "closed" };
    case "conflict": return { kind: "conflict" };
    case "invalid_input": case "invalid_json": case "client_rejected": return { kind: "invalid" };
    default: return r.status === 404 ? { kind: "notFound" } : { kind: "unknown" };
  }
}
