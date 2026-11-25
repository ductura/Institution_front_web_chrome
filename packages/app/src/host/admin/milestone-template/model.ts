// The template's rules as the page checks them before sending (the server checks again): at most 20 milestones, a title of
// 1 to 200 characters, a due of 1 to 1095 days or none. The draft keeps the due as typed so a half-typed value is not lost.
export const MAX_MILESTONES = 20;
export const MAX_TITLE = 200;
export const MIN_DUE = 1;
export const MAX_DUE = 1095;
export const SUBMITS = ["topic_text", "current_version"] as const;
export type Submits = (typeof SUBMITS)[number];

export type MilestoneRow = { readonly title: string; readonly relativeDue?: number; readonly submits: Submits };
export type TemplateVersion = {
  readonly version: number;
  readonly effectiveFrom: string;
  readonly requireFinalStageApproval: boolean;
  readonly milestones: readonly MilestoneRow[];
};

export type DraftMilestone = { readonly key: number; readonly title: string; readonly due: string; readonly submits: Submits };
export type Draft = { readonly requireFinalStageApproval: boolean; readonly milestones: readonly DraftMilestone[] };

export type DraftErrors = { form?: "tooMany"; rows: Readonly<Record<number, { title?: "titleRequired" | "titleTooLong"; due?: "dueRange" }>> };

let nextKey = 1;
export const newKey = () => nextKey++;

export const emptyMilestone = (): DraftMilestone => ({ key: newKey(), title: "", due: "", submits: "current_version" });

/** The draft of a version in force; with none, the template starts empty and the final stage needs no approval. */
export const draftOf = (version: TemplateVersion | null): Draft => ({
  requireFinalStageApproval: version?.requireFinalStageApproval ?? false,
  milestones: (version?.milestones ?? []).map((m) => ({ key: newKey(), title: m.title, due: m.relativeDue === undefined ? "" : String(m.relativeDue), submits: m.submits })),
});

/** The due a draft row stands for: null for none, NaN for a value outside 1..1095 or not a whole number. */
export function parseDue(due: string): number | null {
  const text = due.trim();
  if (text === "") return null;
  if (!/^\d+$/.test(text)) return Number.NaN;
  const n = Number(text);
  return n >= MIN_DUE && n <= MAX_DUE ? n : Number.NaN;
}

export function checkDraft(draft: Draft): DraftErrors {
  const rows: Record<number, { title?: "titleRequired" | "titleTooLong"; due?: "dueRange" }> = {};
  for (const m of draft.milestones) {
    const title = m.title.trim();
    const row: { title?: "titleRequired" | "titleTooLong"; due?: "dueRange" } = {};
    if (title === "") row.title = "titleRequired";
    else if (title.length > MAX_TITLE) row.title = "titleTooLong";
    if (Number.isNaN(parseDue(m.due))) row.due = "dueRange";
    if (row.title !== undefined || row.due !== undefined) rows[m.key] = row;
  }
  return draft.milestones.length > MAX_MILESTONES ? { form: "tooMany", rows } : { rows };
}

export const isValid = (errors: DraftErrors) => errors.form === undefined && Object.keys(errors.rows).length === 0;

/** The body's milestones, in order; call only for a draft that passed checkDraft. */
export const milestonesOf = (draft: Draft): MilestoneRow[] =>
  draft.milestones.map((m) => {
    const due = parseDue(m.due);
    return due === null ? { title: m.title.trim(), submits: m.submits } : { title: m.title.trim(), relativeDue: due, submits: m.submits };
  });

/** Whether the draft differs from the version in force (the order of milestones counts). */
export function changed(version: TemplateVersion | null, draft: Draft): boolean {
  const before = JSON.stringify({ f: version?.requireFinalStageApproval ?? false, m: version?.milestones.map((m) => [m.title, m.relativeDue ?? null, m.submits]) ?? [] });
  const after = JSON.stringify({ f: draft.requireFinalStageApproval, m: draft.milestones.map((m) => [m.title.trim(), parseDue(m.due), m.submits]) });
  return before !== after;
}

/** Moves a row one place; out-of-range moves leave the list as it is. */
export function move<T>(list: readonly T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (to < 0 || to >= list.length) return [...list];
  const copy = [...list];
  const [item] = copy.splice(index, 1);
  copy.splice(to, 0, item as T);
  return copy;
}
