import { createApi } from "../../../../../../src/client/api.ts";
import { readRequirements, type LocalCall, type WordRange } from "../../../../../../src/client/submission.ts";

// WEB-2105: the assignment's word range for the footer of E-7, from
// student.assignment-requirements.get through src/client. Unknown or
// unavailable leaves the range out, never a guessed one.
const viaClient: LocalCall = async (id, { params }) => {
  const answer = await createApi()(id as never, { params, query: undefined, body: undefined } as never) as
    { ok: true; status: number; body: unknown } | { ok: false; status: number; code?: string };
  return answer.ok ? answer : { ok: false, status: answer.status, code: answer.code ?? "unavailable" };
};

export async function readWordRange(assignmentId: string, local: LocalCall = viaClient): Promise<WordRange> {
  const read = await readRequirements(local, assignmentId).catch(() => null);
  return read?.kind === "ready" ? read.wordRange : null;
}
