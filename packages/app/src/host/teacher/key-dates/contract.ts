// The real port of the key-dates card (PIL-K-ROKOVI; server route SRV-1705): mentorship.key-dates.get through
// the contract client of src/client, checked against the contract's own answer schema. 401 is "signed out";
// 404, 503, a rejected call, a broken connection or any other shape is "unavailable", never an empty list.
import migrationContracts from "../../../../../../src/client/migration-contracts.generated.json" with { type: "json" };
import { matchesSchema, type Schema } from "../../../../../../src/client/schema-check";
import type { KeyDateEntry, KeyDatesPort, KeyDatesRead } from "./model";

export type KeyDatesCall = (
  id: "mentorship.key-dates.get",
  input: { readonly params: { readonly id: string }; readonly query: undefined; readonly body: undefined },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

const ANSWER = migrationContracts["mentorship.key-dates.get"].responses["200"].content["application/json"].schema as Schema;
const UNAVAILABLE = { kind: "unavailable" } as const;

/** One read of mentorship.key-dates.get for one mentorship. */
export async function readKeyDates(call: KeyDatesCall, mentorshipId: string): Promise<KeyDatesRead> {
  try {
    const result = await call("mentorship.key-dates.get", { params: { id: mentorshipId }, query: undefined, body: undefined });
    if (!result.ok) return result.status === 401 ? { kind: "signedOut" } : UNAVAILABLE;
    if (result.status !== 200 || !matchesSchema(ANSWER, result.body)) return UNAVAILABLE;
    return { kind: "ready", dates: (result.body as { dates: KeyDateEntry[] }).dates };
  } catch {
    return UNAVAILABLE;
  }
}

/** The port the card reads through; the page gives the contract client, tests a fake. */
export function keyDatesPort(call: () => KeyDatesCall): KeyDatesPort {
  return { read: (mentorshipId) => readKeyDates(call(), mentorshipId) };
}
