import { createApi } from "../../../../../../src/client/api";

// WEB-NF6-ETAPE (NF-6 MK-6): the two plan writes the "Etape" card has no button for yet, over the server's
// operations work.milestone-plan.apply-template.post and work.milestone-plan.add.post. A result is
// read only from the server's answer (B-6, 2164); anything the contract does not name is "unknown".

export type Submits = "current_version" | "topic_text";
export type NewStage = { readonly title: string; readonly dueAt?: string; readonly submits: Submits };
export type PlanOutcome = "saved" | "conflict" | "forbidden" | "notFound" | "invalid" | "signedOut" | "unknown";

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code?: string };
export type PlanCall = (
  id: "work.milestone-plan.apply-template.post" | "work.milestone-plan.add.post",
  input: { params: { documentId: string }; query: undefined; body: unknown },
) => Promise<Answer>;

export const planCall = (): PlanCall => createApi() as unknown as PlanCall;

const isPlan = (body: unknown) =>
  typeof body === "object" && body !== null && Array.isArray((body as { milestones?: unknown }).milestones);

export function planOutcome(answer: Answer): PlanOutcome {
  if (answer.ok) return isPlan(answer.body) ? "saved" : "unknown";
  switch (answer.status) {
    case 401: return "signedOut";
    case 403: return answer.code === "forbidden" ? "forbidden" : "unknown";
    case 404: return "notFound";
    case 409: return "conflict";
    case 422: return "invalid";
    default: return "unknown";
  }
}

async function settle(run: () => Promise<Answer>): Promise<PlanOutcome> {
  try {
    return planOutcome(await run());
  } catch {
    return "unknown";
  }
}

export function applyTemplate(call: PlanCall, documentId: string): Promise<PlanOutcome> {
  return settle(() => call("work.milestone-plan.apply-template.post", { params: { documentId }, query: undefined, body: undefined }));
}

export function addStage(call: PlanCall, documentId: string, stage: NewStage): Promise<PlanOutcome> {
  const body = stage.dueAt === undefined ? { title: stage.title, submits: stage.submits } : { title: stage.title, dueAt: stage.dueAt, submits: stage.submits };
  return settle(() => call("work.milestone-plan.add.post", { params: { documentId }, query: undefined, body }));
}
