// WEB-V17-RUBRIC-STUDENT: the one read of the card, through the contract only (student.assignment-rubric.get).
// A refusal is never an empty answer: "not found" (another course's, a not enrolled or an unknown assignment
// read the same), "signed out" and "unavailable" are states of their own, and a rubric without criteria is
// "empty", also its own state.
import type { createApi } from "@/client/api";

type Api = ReturnType<typeof createApi>;

export type RubricLevel = { readonly label: string; readonly descriptor: string };
export type RubricCriterion = { readonly id: string; readonly title: string; readonly levels: readonly RubricLevel[] };
export type RubricRead =
  | { readonly kind: "ok"; readonly version: number; readonly criteria: readonly RubricCriterion[] }
  | { readonly kind: "empty" }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

const SIGNED_OUT: ReadonlySet<string> = new Set(["unauthorized", "session_expired"]);

export async function readRubric(call: Api, assignmentId: string): Promise<RubricRead> {
  let r;
  try {
    r = await call("student.assignment-rubric.get", { params: { assignmentId }, query: undefined, body: undefined });
  } catch {
    return { kind: "unavailable" };
  }
  if (r.ok) return r.body.criteria.length === 0 ? { kind: "empty" } : { kind: "ok", version: r.body.version, criteria: r.body.criteria };
  if (SIGNED_OUT.has(r.code)) return { kind: "signedOut" };
  return r.status === 404 || r.code === "not_found" ? { kind: "notFound" } : { kind: "unavailable" };
}
