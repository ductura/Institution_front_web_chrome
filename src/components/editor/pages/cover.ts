/** Cover page data: work facts come from the work, the faculty from the rule profile. */

export type CoverFields = {
  student: string;
  mentor: string;
  study: string;
  place: string;
  /** Month and year; empty means the current month. */
  date: string;
};

export type Cover = {
  readonly university: string;
  readonly unit: string;
  readonly study: string;
  readonly kind: string;
  readonly title: string;
  readonly student: string;
  readonly mentor: string;
  readonly place: string;
  readonly date: string;
};

export const DEFAULT_COVER_FIELDS: CoverFields = { student: "", mentor: "", study: "", place: "Zagreb", date: "" };

const MONTHS = ["siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj", "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac"];

export const monthYear = (now: Date) => `${MONTHS[now.getMonth()]} ${now.getFullYear()}.`;

export type CoverWork = { title?: string; kind?: string; unit?: string };

export function buildCover(fields: Partial<CoverFields>, work: CoverWork, now: Date): Cover {
  const text = (value: string | undefined) => (value ?? "").trim();
  return {
    university: "Sveučilište u Zagrebu",
    unit: text(work.unit) || "Fakultet političkih znanosti",
    study: text(fields.study),
    kind: text(work.kind) || "Rad",
    title: text(work.title) || "Naslov rada",
    student: text(fields.student) || "Ime i prezime studenta",
    mentor: text(fields.mentor),
    place: text(fields.place) || "Zagreb",
    date: text(fields.date) || monthYear(now),
  };
}
