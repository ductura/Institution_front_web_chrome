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
