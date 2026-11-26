/**
 * The student sends the revised work back for review (ED-43, P2-15; E 3.3).
 *
 * `collaboration.revision-send.post` of the generated extract, reached only through `createApi`. The send counts as
 * done only when the answer carries the new round number; any other answer is unknown and the dialog keeps its
 * state. An empty message is sent as null (the message to the mentor is optional).
 */

import { createApi } from "./api";

type Api = ReturnType<typeof createApi>;

/** The HTTP status a dialog `post` reads: 200 only for a confirmed round, null when nothing is known. Never throws. */
export async function sendRevisionStatus(documentId: string, message: string, call?: Api): Promise<number | null> {
  try {
    const body = { documentId, message: message === "" ? null : message };
    const result = await (call ?? createApi())("collaboration.revision-send.post", { params: undefined, query: undefined, body });
    if (!result.ok) return result.status === 401 || result.status === 403 || result.status === 409 ? result.status : null;
    return Number.isInteger(result.body.round) && result.body.round > 0 ? 200 : null;
  } catch {
    return null;
  }
}
