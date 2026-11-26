// WEB-V16-POPIS-FAKULTET: the pure rules of the faculty's list of theses. The server's answer is parsed by hand: a
// wrong shape is "unavailable", never an empty list. The list has no grade column and no rank; the order is the server's.
export const STAGES = ["none", "submitted_to_office", "defense_scheduled", "defended"] as const;
export type Stage = (typeof STAGES)[number];
export const WORK_TYPES = ["bachelor_thesis", "master_thesis", "specialist_thesis", "doctoral_thesis"] as const;
export type WorkType = (typeof WORK_TYPES)[number];
export const TOPIC_STATES = ["none", "proposed", "approved", "returned"] as const;
export type TopicState = (typeof TOPIC_STATES)[number];

export type PersonName = { readonly givenName: string; readonly familyName: string };
export type ThesisRow = {
  readonly documentId: string | null;
  readonly workType: WorkType;
  readonly mentorName: PersonName | null;
  readonly studentName: PersonName | null;
  readonly stage: Stage;
  readonly defenseAt: string | null;
  readonly topicState: TopicState;
  readonly committeeSize: number;
};
export type Page = { readonly works: readonly ThesisRow[]; readonly next: string | null };

/** The filter's value: a phase the server allows, or "" for all phases; anything else is no filter. */
export type StageFilter = Stage | "";
export const asStageFilter = (value: string): StageFilter => ((STAGES as readonly string[]).includes(value) ? (value as Stage) : "");

/** The query of one page: only an allowed phase is sent, the limit is the server's default (50). */
export function queryOf(filter: StageFilter, after: string | null): { stage?: Stage; after?: string } {
  return { ...(filter === "" ? {} : { stage: filter }), ...(after === null ? {} : { after }) };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);

function parseName(v: unknown): PersonName | null | undefined {
  if (v === null) return null;
  return isObj(v) && typeof v.givenName === "string" && typeof v.familyName === "string" ? { givenName: v.givenName, familyName: v.familyName } : undefined;
}

function parseRow(v: unknown): ThesisRow | null {
  if (!isObj(v)) return null;
  const { documentId, workType, stage, defenseAt, topicState, committeeSize } = v;
  const mentorName = parseName(v.mentorName);
  const studentName = parseName(v.studentName);
  if (documentId !== null && typeof documentId !== "string") return null;
  if (!oneOf(WORK_TYPES, workType) || !oneOf(STAGES, stage) || !oneOf(TOPIC_STATES, topicState)) return null;
  if (defenseAt !== null && typeof defenseAt !== "string") return null;
  if (typeof committeeSize !== "number" || !Number.isInteger(committeeSize) || committeeSize < 0 || committeeSize > 5) return null;
  if (mentorName === undefined || studentName === undefined) return null;
  return { documentId, workType, mentorName, studentName, stage, defenseAt, topicState, committeeSize };
}

/** One page of the answer, or null when its shape is not the contract's. */
export function parsePage(body: unknown): Page | null {
  if (!isObj(body) || !Array.isArray(body.works) || (body.next !== null && typeof body.next !== "string")) return null;
  const works: ThesisRow[] = [];
  for (const w of body.works) {
    const row = parseRow(w);
    if (row === null) return null;
    works.push(row);
  }
  return { works, next: body.next as string | null };
}

/** The pages in one list: a row the server already sent is not shown twice (documentId is null for a work without one). */
export function appendPage(shown: readonly ThesisRow[], page: Page): ThesisRow[] {
  const seen = new Set(shown.flatMap((r) => (r.documentId === null ? [] : [r.documentId])));
  return [...shown, ...page.works.filter((r) => r.documentId === null || !seen.has(r.documentId))];
}

export const nameText = (name: PersonName | null, fallback: string) => (name === null ? fallback : `${name.givenName} ${name.familyName}`);

/** "1 član", "2 člana", "5 članova" (the committee has at most 5 members); the template is the message's. */
export function pluralMembers(n: number, forms: { readonly one: string; readonly few: string; readonly many: string }): string {
  const form = n === 1 ? forms.one : n >= 2 && n <= 4 ? forms.few : forms.many;
  return form.replace("{n}", String(n));
}
