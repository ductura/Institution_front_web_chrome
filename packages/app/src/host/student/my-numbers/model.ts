// Pure rules of "Moj rad u brojkama" (F4-PM2-R20; plan M7.13, FEATURES A-10; PRODUCT §5 rule 4, D-63).
// Figures come from saved versions only (count, distinct calendar days) and from the deadline and the
// milestones the student already sees. Nothing here is a time per change, a rhythm, a pause or a comparison.
export type MyWork = {
  readonly workId: string;
  readonly title: string;
  readonly courseName: string;
  readonly dueAt: string;
  readonly state: "in_progress" | "submitted";
};

/** One page of versions, as work.versions.get gives it (newest first). */
export type VersionsPage = { readonly savedMinutes: readonly string[]; readonly more: boolean };
export type Milestones = { readonly done: number; readonly total: number };

/** `null` where that read did not answer: never shown as zero. */
export type WorkNumbers = {
  readonly work: MyWork;
  readonly versions: { readonly count: number; readonly more: boolean } | null;
  readonly days: { readonly count: number; readonly more: boolean } | null;
  readonly daysLeft: number | null;
  readonly milestones: Milestones | null;
};

const zagrebDay = (iso: string): string =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zagreb", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

/** Distinct Zagreb calendar days of the saved minutes; the time of day is dropped here, so no rhythm can follow. */
export function distinctDays(savedMinutes: readonly string[]): number {
  return new Set(savedMinutes.filter((m) => !Number.isNaN(Date.parse(m))).map(zagrebDay)).size;
}

const DAY_MS = 86_400_000;
/** Whole calendar days from `now` to the deadline in Zagreb; 0 is today, negative is passed. Null for a bad date or a submitted work. */
export function daysToDeadline(dueAt: string, now: Date, state: MyWork["state"]): number | null {
  if (state === "submitted" || Number.isNaN(Date.parse(dueAt))) return null;
  const a = Date.parse(`${zagrebDay(dueAt)}T00:00:00Z`);
  const b = Date.parse(`${zagrebDay(now.toISOString())}T00:00:00Z`);
  return Math.round((a - b) / DAY_MS);
}

export function numbersOf(work: MyWork, versions: VersionsPage | null, milestones: Milestones | null, now: Date): WorkNumbers {
  return {
    work,
    versions: versions === null ? null : { count: versions.savedMinutes.length, more: versions.more },
    days: versions === null ? null : { count: distinctDays(versions.savedMinutes), more: versions.more },
    daysLeft: daysToDeadline(work.dueAt, now, work.state),
    milestones,
  };
}

export type NumbersView =
  | { readonly kind: "ready"; readonly items: readonly WorkNumbers[] }
  | { readonly kind: "empty" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };
