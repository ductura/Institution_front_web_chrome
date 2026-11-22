/**
 * Reads the literature of a work for the teacher (WEB-2133): the newest saved
 * version from work.versions.get, then that version's canonical document from
 * work.version.get. Both through the generated client; nothing is written.
 * The proofs, recommendations and proof requests have no teacher route in the
 * contract, so they are not read here.
 */
import { createApi } from "../../../../../../../src/client/api.ts";

import { literatureOf, type Literature } from "./literature-model";

type Call = ReturnType<typeof createApi>;

export type LiteratureRead =
  | { kind: "ready"; revision: number; savedMinute: string; literature: Literature }
  | { kind: "noVersion" }
  | { kind: "signedOut" }
  | { kind: "unavailable" };

export async function readWorkLiterature(documentId: string, call: Call = createApi()): Promise<LiteratureRead> {
  try {
    const list = await call("work.versions.get", { params: { documentId }, query: undefined, body: undefined });
    if (!list.ok) return { kind: list.status === 401 ? "signedOut" : "unavailable" };
    const newest = [...list.body.versions].sort((a, b) => b.revision - a.revision)[0];
    if (!newest) return { kind: "noVersion" };
    const one = await call("work.version.get", {
      params: { documentId, revision: String(newest.revision) }, query: {}, body: undefined,
    });
    if (!one.ok) return { kind: one.status === 401 ? "signedOut" : "unavailable" };
    if (!("document" in one.body)) return { kind: "unavailable" };
    const doc: unknown = JSON.parse(one.body.document);
    return { kind: "ready", revision: one.body.revision, savedMinute: newest.savedMinute, literature: literatureOf(doc) };
  } catch {
    return { kind: "unavailable" };
  }
}
