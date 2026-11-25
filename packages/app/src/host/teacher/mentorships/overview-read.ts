// NF-6 MK-11: the two reads of one started work for "Moji studenti", through the contract client of src/client
// and checked against the contract's own answer schemas. 401 is "signed out"; any other failure, a broken
// connection or another shape is "unavailable", never an empty list (B-6).
import migrationContracts from "../../../../../../src/client/migration-contracts.generated.json" with { type: "json" };
import { matchesSchema, type Schema } from "../../../../../../src/client/schema-check";
import type { MentoredWork } from "../../../../../../src/components/teacher/mentored-works-read";
import { needsReads, type MilestoneEntry, type SlotEntry, type WorkProgress } from "./overview-model";

type Operation = "work.milestone-states.get" | "work.consultation-slots.get";
export type OverviewCall = (
  id: Operation,
  input: { readonly params: { readonly documentId: string }; readonly query: undefined; readonly body: undefined },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

const schema = (op: Operation): Schema => migrationContracts[op].responses["200"].content["application/json"].schema as Schema;
const MILESTONES = schema("work.milestone-states.get");
const SLOTS = schema("work.consultation-slots.get");

type One<T> = { kind: "ready"; value: T } | { kind: "signedOut" } | { kind: "unavailable" };

async function one<T>(call: OverviewCall, op: Operation, documentId: string, answer: Schema, pick: (body: unknown) => T): Promise<One<T>> {
  try {
    const result = await call(op, { params: { documentId }, query: undefined, body: undefined });
    if (!result.ok) return result.status === 401 ? { kind: "signedOut" } : { kind: "unavailable" };
    if (result.status !== 200 || !matchesSchema(answer, result.body)) return { kind: "unavailable" };
    return { kind: "ready", value: pick(result.body) };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Both reads of one work; the work's state is known only when both answered. */
export async function readProgress(call: OverviewCall, documentId: string): Promise<WorkProgress> {
  const [milestones, slots] = await Promise.all([
    one(call, "work.milestone-states.get", documentId, MILESTONES, (b) => (b as { milestones: MilestoneEntry[] }).milestones),
    one(call, "work.consultation-slots.get", documentId, SLOTS, (b) => (b as { slots: SlotEntry[] }).slots),
  ]);
  if (milestones.kind === "signedOut" || slots.kind === "signedOut") return { kind: "signedOut" };
  if (milestones.kind !== "ready" || slots.kind !== "ready") return { kind: "unavailable" };
  return { kind: "ready", milestones: milestones.value, slots: slots.value };
}

/** The reads of every started work, keyed by mentorship. A finished or unstarted work needs none. */
export async function readOverview(call: OverviewCall, works: readonly MentoredWork[]): Promise<ReadonlyMap<string, WorkProgress>> {
  const started = works.filter(needsReads);
  const read = await Promise.all(started.map(async (w) => [w.mentorshipId, await readProgress(call, w.documentId)] as const));
  return new Map(read);
}
