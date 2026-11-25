import { createApi } from "../../../../../../src/client/api";
import { parseTemplate, type TemplateRead } from "./template";

// WEB-V17-TEMPLATE-START: student.assignment-template.get through src/client, the only way out.
export type TemplateCall = (assignmentId: string) => Promise<{ ok: boolean; status: number; body?: unknown }>;

const viaClient: TemplateCall = async (assignmentId) =>
  await createApi()("student.assignment-template.get" as never, { params: { assignmentId }, query: {}, body: undefined } as never) as never;

export async function readTemplate(assignmentId: string, call: TemplateCall = viaClient): Promise<TemplateRead> {
  let answer: Awaited<ReturnType<TemplateCall>>;
  try { answer = await call(assignmentId); } catch { return { kind: "unavailable" }; }
  if (answer.status === 404) return { kind: "none" };
  if (!answer.ok) return { kind: "unavailable" };
  const template = parseTemplate(answer.body);
  return template === null ? { kind: "unavailable" } : { kind: "ready", template };
}
