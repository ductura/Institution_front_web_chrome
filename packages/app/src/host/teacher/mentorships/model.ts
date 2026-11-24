import type { MentoredWork } from "../../../../../../src/components/teacher/mentored-works-read";
import { byFamilyName, studentName } from "../../../../../../src/components/teacher/mentored-works-view";

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

/** WEB-NF6-ETAPE (MK-6): the works whose plan can be shown, one per mentorship, in the list's order; a not started work has no document yet. */
export function startedWorks(works: readonly MentoredWork[]): readonly (MentoredWork & { readonly documentId: string })[] {
  const seen = new Set<string>();
  const out: (MentoredWork & { readonly documentId: string })[] = [];
  for (const work of byFamilyName(works)) {
    if (work.documentId === null || seen.has(work.documentId)) continue;
    seen.add(work.documentId);
    out.push(work as MentoredWork & { readonly documentId: string });
  }
  return out;
}

/** WEB-NF6-ETAPE (MK-5): the latest consultation by its day (the server's order breaks a tie); null for none. */
export function latestRecord<T extends { readonly heldOn: string }>(records: readonly T[]): T | null {
  let last: T | null = null;
  for (const record of records) if (last === null || record.heldOn >= last.heldOn) last = record;
  return last;
}

/** "2026-11-05" as "5. 11. 2026."; a day is a calendar day, so no time zone applies. */
export function dayText(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return match === null ? day : `${Number(match[3])}. ${Number(match[2])}. ${match[1]}.`;
}
