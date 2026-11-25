import { createApi, type ApiOptions, type ApiResult } from "@/client/api";
import { parseTemplate, type TemplateRead } from "./template";

// WEB-V17-TEMPLATE-START: student.assignment-template.get through src/client, the only way out.
export type TemplateCall = (assignmentId: string) => Promise<ApiResult<"student.assignment-template.get">>;

const viaClient = (options?: ApiOptions): TemplateCall => (assignmentId) =>
  createApi(options)("student.assignment-template.get", { params: { assignmentId }, query: {}, body: undefined });

/** 404 is "none" (the same for a foreign and an unknown assignment); 401 is signed out; any other failure is "unavailable", never "none". */
export async function readTemplate(assignmentId: string, call: TemplateCall = viaClient()): Promise<TemplateRead> {
  let answer: Awaited<ReturnType<TemplateCall>>;
  try { answer = await call(assignmentId); } catch { return { kind: "unavailable" }; }
  if (!answer.ok) {
    if (answer.status === 404) return { kind: "none" };
    return answer.status === 401 ? { kind: "signedOut" } : { kind: "unavailable" };
  }
  const template = parseTemplate(answer.body);
  return template === null ? { kind: "unavailable" } : { kind: "ready", template };
}

/**
 * WEB-V17-DORADE: the cards of one list share one read per assignment, so a card drawn
 * again (or the same assignment on two lists) does not ask again. A failed read is not
 * kept: the next card that mounts asks again rather than repeating "unavailable".
 */
export function sharedTemplateReads(read: (assignmentId: string) => Promise<TemplateRead> = (id) => readTemplate(id)) {
  const reads = new Map<string, Promise<TemplateRead>>();
  return (assignmentId: string): Promise<TemplateRead> => {
    const known = reads.get(assignmentId);
    if (known) return known;
    const next = read(assignmentId).catch((): TemplateRead => ({ kind: "unavailable" }));
    reads.set(assignmentId, next);
    void next.then((r) => { if (r.kind === "unavailable" || r.kind === "signedOut") reads.delete(assignmentId); });
    return next;
  };
}
