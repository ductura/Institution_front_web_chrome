// F4-PM2-R20: the reads of "Moj rad u brojkama", through the contract only: student-work.works.get (own works),
// work.versions.get and work.milestone-states.get. A refusal is never zero: "signed out", "unavailable" and
// "not found" (another student's work reads the same as an unknown one: it is left out) are states of their own.
import type { createApi } from "@/client/api";
import { numbersOf, type Milestones, type MyWork, type NumbersView, type VersionsPage } from "./model";

type Api = ReturnType<typeof createApi>;
const SIGNED_OUT: ReadonlySet<string> = new Set(["unauthorized", "session_expired"]);
const signedOut = (r: { readonly code: string }) => SIGNED_OUT.has(r.code);
/** One read of the page is bounded: the newest works only. */
export const MAX_WORKS = 50;

async function attempt<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

type One<T> = { readonly kind: "ok"; readonly value: T } | { readonly kind: "signedOut" } | { readonly kind: "notFound" } | { readonly kind: "unavailable" };

async function readVersions(call: Api, workId: string): Promise<One<VersionsPage>> {
  const r = await attempt(() => call("work.versions.get", { params: { documentId: workId }, query: {}, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  if (!r.ok) return signedOut(r) ? { kind: "signedOut" } : r.status === 404 || r.code === "not_found" ? { kind: "notFound" } : { kind: "unavailable" };
  return { kind: "ok", value: { savedMinutes: r.body.versions.map((v) => v.savedMinute), more: r.body.nextBeforeRevision !== null } };
}

async function readMilestones(call: Api, workId: string): Promise<Milestones | null> {
  const r = await attempt(() => call("work.milestone-states.get", { params: { documentId: workId }, query: undefined, body: undefined }));
  if (r === null || !r.ok) return null;
  const list = r.body.milestones;
  return list.length === 0 ? null : { done: list.filter((m) => m.state === "approved").length, total: list.length };
}

/** Own works first (signed out or unavailable there is the page's state), then the figures of each work. */
export async function readMyNumbers(call: Api, now: Date): Promise<NumbersView> {
  const list = await attempt(() => call("student-work.works.get", { params: undefined, query: undefined, body: undefined }));
  if (list === null) return { kind: "unavailable" };
  if (!list.ok) return signedOut(list) ? { kind: "signedOut" } : { kind: "unavailable" };
  const works: MyWork[] = list.body.works
    .map((w) => ({ workId: w.workId, title: w.assignmentTitle, courseName: w.courseName, dueAt: w.dueAt, state: w.state }))
    .slice(0, MAX_WORKS);
  if (works.length === 0) return { kind: "empty" };
  const each = await Promise.all(works.map(async (work) => ({ work, versions: await readVersions(call, work.workId), milestones: await readMilestones(call, work.workId) })));
  if (each.some((e) => e.versions.kind === "signedOut")) return { kind: "signedOut" };
  const items = each
    .filter((e) => e.versions.kind !== "notFound")
    .map((e) => numbersOf(e.work, e.versions.kind === "ok" ? e.versions.value : null, e.milestones, now));
  return items.length === 0 ? { kind: "empty" } : { kind: "ready", items };
}
