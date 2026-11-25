// WEB-NF6-RUNDA (#631 review 2, point 3): what the student has seen of a work (work.seen-by-student.get),
// read through the shared contract client.
import { createApi } from "../../../../../../src/client/api";

import type { SeenItem } from "./round-model";

export type SeenRead = (documentId: string) => Promise<readonly SeenItem[] | null>;

export const readSeen: SeenRead = async (documentId) => {
  try {
    const answer = await createApi()("work.seen-by-student.get", { params: { documentId }, query: undefined, body: undefined });
    return answer.ok ? answer.body.items : null;
  } catch {
    return null;
  }
};
