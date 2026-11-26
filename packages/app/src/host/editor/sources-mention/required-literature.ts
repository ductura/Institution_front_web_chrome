// EDI-R11 (F4-EDI-R11): the course's required literature at the top of the Izvori card, read from
// student.course-literature.get. Read only: the student sees what the teacher marked as required for the
// course; adding one to the work stays the existing "Dodaj izvor" flow.
import { createApi } from "../../../../../../src/client/api.ts";

export type RequiredSource = { readonly id: string; readonly label: string };

export type LiteratureRead =
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "ready"; readonly sources: readonly RequiredSource[] };

type LiteratureCall = (
  id: "student.course-literature.get",
  input: { readonly params: { readonly courseId: string }; readonly query: undefined; readonly body: undefined },
) => Promise<{ ok: boolean; status: number; body?: unknown }>;

type Author = { kind: "person"; family: string; given: string } | { kind: "organization"; name: string };

const isString = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isAuthor = (a: unknown): a is Author => {
  if (typeof a !== "object" || a === null) return false;
  const v = a as Record<string, unknown>;
  return (v.kind === "person" && isString(v.family) && typeof v.given === "string") || (v.kind === "organization" && isString(v.name));
};

/** "Prezime, I.; Druga Ustanova (2019). Naslov" from the server's record; null for a record off the contract. */
export function labelOf(record: unknown): string | null {
  if (typeof record !== "object" || record === null) return null;
  const r = record as Record<string, unknown>;
  if (!isString(r.title) || !Array.isArray(r.authors) || r.authors.length === 0 || !r.authors.every(isAuthor)) return null;
  const authors = (r.authors as Author[])
    .map((a) => (a.kind === "organization" ? a.name.trim() : a.given.trim() === "" ? a.family.trim() : `${a.family.trim()}, ${a.given.trim()}`))
    .join("; ");
  const year = typeof r.year === "number" && Number.isFinite(r.year) ? ` (${r.year})` : "";
  return `${authors}${year}. ${r.title.trim()}`;
}

/** The required literature through the shared client; anything but the contract's 200 (401, 404, 503, a thrown call, a bad body) is "unavailable". */
export async function readRequiredLiterature(call: LiteratureCall, courseId: string): Promise<LiteratureRead> {
  try {
    const answer = await call("student.course-literature.get", { params: { courseId }, query: undefined, body: undefined });
    if (!answer.ok || answer.status !== 200) return { kind: "unavailable" };
    const list = (answer.body as { sources?: unknown } | undefined)?.sources;
    if (!Array.isArray(list)) return { kind: "unavailable" };
    const sources: RequiredSource[] = [];
    for (const item of list) {
      const id = (item as { id?: unknown } | null)?.id;
      const label = labelOf((item as { record?: unknown } | null)?.record);
      if (typeof id !== "string" || label === null) return { kind: "unavailable" };
      sources.push({ id, label });
    }
    return { kind: "ready", sources };
  } catch {
    return { kind: "unavailable" };
  }
}

export const liveRequiredLiterature = (courseId: string) => readRequiredLiterature(createApi() as unknown as LiteratureCall, courseId);

/** The course the assignment belongs to, from the answer of student.assignments.get ({ ok, body }); null when it failed or the assignment is in no course. */
export function courseIdOf(assignments: { readonly ok?: boolean; readonly body?: unknown } | null | undefined, assignmentId: string): string | null {
  if (assignments?.ok !== true) return null;
  const courses = (assignments.body as { courses?: unknown } | null | undefined)?.courses;
  if (!Array.isArray(courses)) return null;
  const wanted = assignmentId.toLowerCase();
  for (const course of courses as { id?: unknown; assignments?: unknown }[]) {
    if (!Array.isArray(course?.assignments) || typeof course.id !== "string") continue;
    if ((course.assignments as { id?: unknown }[]).some((a) => typeof a?.id === "string" && a.id.toLowerCase() === wanted)) return course.id;
  }
  return null;
}
