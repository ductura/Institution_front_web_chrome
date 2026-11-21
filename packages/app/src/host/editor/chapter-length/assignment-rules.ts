import { createApi } from "../../../../../../src/client/api.ts";

import { chapterTargetsOf, type ChapterTargets } from "./chapter-length";

type ReadRequirements = (assignmentId: string) => Promise<{ ok: true; body: unknown } | { ok: false }>;

const readRequirements: ReadRequirements = (assignmentId) => createApi()("student.assignment-requirements.get", {
  params: { assignmentId }, query: undefined, body: undefined,
});

/** Missing or unavailable optional rules leave the word count visible on its own. */
export async function readChapterTargets(assignmentId: string, read: ReadRequirements = readRequirements): Promise<ChapterTargets> {
  const result = await read(assignmentId).catch(() => ({ ok: false } as const));
  return chapterTargetsOf(result.ok ? result.body : null);
}
