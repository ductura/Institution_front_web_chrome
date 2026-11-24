import type { MentoredWork } from "../../../../../../src/components/teacher/mentored-works-read";
import { byFamilyName, liveHref, studentName } from "../../../../../../src/components/teacher/mentored-works-view";

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

/**
 * PIL-K-ROKOVI: one key-dates card per mentorship, in the order of the works list (by family name);
 * a mentorship with two works still has one card. The name is the list's own (with its stand-in text).
 */
export function mentorshipsOf(works: readonly MentoredWork[]): readonly { readonly mentorshipId: string; readonly name: string }[] {
  const seen = new Set<string>();
  const out: { mentorshipId: string; name: string }[] = [];
  for (const work of byFamilyName(works)) {
    if (seen.has(work.mentorshipId)) continue;
    seen.add(work.mentorshipId);
    out.push({ mentorshipId: work.mentorshipId, name: studentName(work) });
  }
  return out;
}

/**
 * WEB-NF6-RUNDA (MK-8): one "Pregled runde" per started work (it has a document), in the works list order;
 * a work not started has nothing to review yet. `href` is the work's page relative to the app.
 */
export function roundWorks(works: readonly MentoredWork[]): readonly { readonly documentId: string; readonly name: string; readonly path: string }[] {
  return byFamilyName(works).flatMap((work) => {
    const path = liveHref(work);
    return work.documentId === null || path === null ? [] : [{ documentId: work.documentId, name: studentName(work), path }];
  });
}
