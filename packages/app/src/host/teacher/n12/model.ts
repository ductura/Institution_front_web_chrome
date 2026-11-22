import { n12Messages as t } from "./messages.hr";

export type VersionLike = { revision: number; kind?: string; savedMinute: string };
export type FormFields = { heldOn: string; revision: string; topic: string; agreement: string };
export type FormCheck =
  | { ok: true; value: { heldOn: string; revision: number; topic: string; agreement: string } }
  | { ok: false; message: string };

export const revisionLabel = (revision: number) => t.versionNumber.replace("{revision}", String(revision));

export const recordTitle = (formattedDate: string) => t.recordTitle.replace("{date}", formattedDate);

/** Today as `yyyy-mm-dd` in local time: the default of the date field (the prototype shows a prefilled date). */
export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Newest first; a copy, never the input. */
export const sortRecords = <T extends { heldOn: string }>(records: readonly T[]): T[] =>
  records.toSorted((first, second) => second.heldOn.localeCompare(first.heldOn));

/** One option per revision (first occurrence wins), labelled as saved or submitted. */
export function versionOptions(versions: readonly VersionLike[], formatTime: (iso: string) => string) {
  const options = new Map<number, string>();
  for (const version of versions) {
    if (options.has(version.revision)) continue;
    const label = version.kind === "submission" ? t.submittedVersion : t.savedVersion;
    options.set(version.revision, label.replace("{version}", revisionLabel(version.revision)).replace("{date}", formatTime(version.savedMinute)));
  }
  return Array.from(options, ([revision, label]) => ({ value: String(revision), label }));
}

/** Date and version first, then topic, as in the prototype; the agreement is optional. */
export function checkForm(fields: FormFields, validRevisions: readonly string[]): FormCheck {
  const heldOn = fields.heldOn.trim();
  if (!heldOn || !validRevisions.includes(fields.revision)) return { ok: false, message: t.needDateAndVersion };
  const topic = fields.topic.trim();
  if (!topic) return { ok: false, message: t.needTopic };
  return { ok: true, value: { heldOn, revision: Number(fields.revision), topic, agreement: fields.agreement.trim() } };
}

export const checkAddition = (text: string): { ok: true; text: string } | { ok: false; message: string } => {
  const trimmed = text.trim();
  return trimmed ? { ok: true, text: trimmed } : { ok: false, message: t.needAddition };
};
