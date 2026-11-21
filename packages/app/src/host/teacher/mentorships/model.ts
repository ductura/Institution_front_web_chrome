import type { MentoredWork } from "../../../../../../src/components/teacher/mentored-works-read";

export type MentoredStudent = {
  /** The key of the list: the student's name, or the work for a student without a name pair. */
  readonly key: string;
  readonly name: string | null;
  readonly works: readonly MentoredWork[];
};

/**
 * "Moji studenti": the students of the teacher's mentored works, one row per
 * student, in the order the server gave the works. The server decides whose
 * works; a student without a name pair is never given a stand-in name.
 */
export function studentsOf(works: readonly MentoredWork[]): readonly MentoredStudent[] {
  const byKey = new Map<string, { name: string | null; works: MentoredWork[] }>();
  for (const work of works) {
    const name = work.student === null ? null : `${work.student.givenName} ${work.student.familyName}`.trim();
    const key = name === null ? `work:${work.mentorshipId}` : `name:${name}`;
    const row = byKey.get(key) ?? { name, works: [] };
    row.works.push(work);
    byKey.set(key, row);
  }
  return [...byKey].map(([key, row]) => ({ key, name: row.name, works: row.works }));
}
