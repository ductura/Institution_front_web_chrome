import type { MentoredWork } from "../../../../../../src/components/teacher/mentored-works-read";

export type MentoredStudent = {
  /** The mentorship: the work has no student identifier, so a name never joins two rows. */
  readonly key: string;
  readonly name: string | null;
  readonly works: readonly MentoredWork[];
};

/**
 * "Moji studenti": one row per approved mentorship, in the order the server gave
 * the works. `MentoredWork.student` holds names only, no identifier, so two
 * students with the same name stay two rows; a student without a name pair is
 * never given a stand-in name.
 */
export function studentsOf(works: readonly MentoredWork[]): readonly MentoredStudent[] {
  return works.map((work) => ({
    key: work.mentorshipId,
    name: work.student === null ? null : `${work.student.givenName} ${work.student.familyName}`.trim(),
    works: [work],
  }));
}
