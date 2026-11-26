// EDI-R12: the sources the mentor recommended or required on the work, in the Izvori card. Read from
// student.work-sources.get (the student's own sources come back with requirement null and are not listed here).
import { createApi } from "../../../../../../src/client/api.ts";

export type Requirement = "recommended" | "required";

export type RecommendedSource = {
  readonly id: string;
  readonly requirement: Requirement;
  readonly label: string;
  readonly title: string;
};

export type RecommendedRead =
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "ready"; readonly sources: readonly RecommendedSource[] };

type SourcesCall = (
  id: "student.work-sources.get",
  input: { readonly params: { readonly assignmentId: string }; readonly query: undefined; readonly body: undefined },
) => Promise<{ ok: boolean; status: number; body?: unknown }>;

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** "Family, Family (2021)" from the record; the title alone when the record names no author. */
function labelOf(record: Record<string, unknown>): { label: string; title: string } {
  const title = text(record.title);
  const authors = Array.isArray(record.authors) ? record.authors : [];
  const names = authors
    .map((a) => (typeof a === "object" && a !== null ? text((a as Record<string, unknown>).family) || text((a as Record<string, unknown>).name) : ""))
    .filter((n) => n !== "");
  const year = typeof record.year === "number" ? ` (${record.year})` : typeof record.year === "string" && record.year.trim() !== "" ? ` (${record.year.trim()})` : "";
  const who = names.length > 2 ? `${names[0]} i dr.` : names.join(", ");
  return { label: `${who}${year}`.trim() || title, title };
}

/** The mentor's sources through the shared client; anything but the contract's answer is "unavailable". */
export async function readRecommended(call: SourcesCall, assignmentId: string): Promise<RecommendedRead> {
  try {
    const answer = await call("student.work-sources.get", { params: { assignmentId }, query: undefined, body: undefined });
    if (answer.status === 401) return { kind: "signedOut" };
    if (!answer.ok || answer.status !== 200) return { kind: "unavailable" };
    const list = (answer.body as { sources?: unknown } | undefined)?.sources;
    if (!Array.isArray(list)) return { kind: "unavailable" };
    const sources: RecommendedSource[] = [];
    for (const s of list) {
      if (typeof s !== "object" || s === null) return { kind: "unavailable" };
      const v = s as Record<string, unknown>;
      if (typeof v.id !== "string" || typeof v.record !== "object" || v.record === null) return { kind: "unavailable" };
      if (v.requirement === null || v.requirement === undefined) continue;
      if (v.requirement !== "recommended" && v.requirement !== "required") return { kind: "unavailable" };
      sources.push({ id: v.id, requirement: v.requirement, ...labelOf(v.record as Record<string, unknown>) });
    }
    // Required ones first, the order of the server (oldest first) otherwise.
    sources.sort((a, b) => Number(b.requirement === "required") - Number(a.requirement === "required"));
    return { kind: "ready", sources };
  } catch {
    return { kind: "unavailable" };
  }
}

export const liveRecommended = (assignmentId: string) => readRecommended(createApi() as unknown as SourcesCall, assignmentId);
