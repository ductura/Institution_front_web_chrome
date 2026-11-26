// The work template's rules as the page checks them before sending (the server checks again): a title page of up to five
// fields from a closed list, at most 30 sections with a title of 1 to 120 characters and a hint of up to 400 characters,
// and one citation style (fpzg). The draft keeps the text as typed.
export const WORK_TYPES = ["short_paper", "essay", "seminar_paper", "bachelor_thesis", "master_thesis", "specialist_thesis", "doctoral_thesis"] as const;
export type WorkType = (typeof WORK_TYPES)[number];
export const TITLE_FIELDS = ["title", "author", "mentor", "course", "date"] as const;
export type TitleField = (typeof TITLE_FIELDS)[number];
export const CITATION_STYLE = "fpzg" as const;
export const MAX_SECTIONS = 30;
export const MAX_SECTION_TITLE = 120;
export const MAX_HINT = 400;

export type SectionRow = { readonly title: string; readonly hint: string };
export type TemplateVersion = {
  readonly version: number;
  readonly effectiveFrom: string;
  readonly titlePage: readonly TitleField[];
  readonly sections: readonly SectionRow[];
  readonly citationStyle: typeof CITATION_STYLE;
};

export type DraftSection = { readonly key: number; readonly title: string; readonly hint: string };
export type Draft = { readonly titlePage: readonly TitleField[]; readonly sections: readonly DraftSection[] };
export type RowError = { title?: "titleRequired" | "titleTooLong"; hint?: "hintTooLong" };
export type DraftErrors = { form?: "tooMany"; rows: Readonly<Record<number, RowError>> };

export const isWorkType = (value: string | undefined): value is WorkType => WORK_TYPES.includes(value as WorkType);

let nextKey = 1;
export const newKey = () => nextKey++;
export const emptySection = (): DraftSection => ({ key: newKey(), title: "", hint: "" });

/** The draft of the version in force; with none, the template starts empty. */
export const draftOf = (version: TemplateVersion | null): Draft => ({
  titlePage: version?.titlePage ?? [],
  sections: (version?.sections ?? []).map((s) => ({ key: newKey(), title: s.title, hint: s.hint })),
});

/** Switches a title-page field; the list always keeps the order of TITLE_FIELDS, so the same choice is the same body. */
export const withField = (titlePage: readonly TitleField[], field: TitleField, on: boolean): TitleField[] =>
  TITLE_FIELDS.filter((f) => (f === field ? on : titlePage.includes(f)));

export function checkDraft(draft: Draft): DraftErrors {
  const rows: Record<number, RowError> = {};
  for (const s of draft.sections) {
    const title = s.title.trim();
    const row: RowError = {};
    if (title === "") row.title = "titleRequired";
    else if (title.length > MAX_SECTION_TITLE) row.title = "titleTooLong";
    if (s.hint.trim().length > MAX_HINT) row.hint = "hintTooLong";
    if (row.title !== undefined || row.hint !== undefined) rows[s.key] = row;
  }
  return draft.sections.length > MAX_SECTIONS ? { form: "tooMany", rows } : { rows };
}

export const isValid = (errors: DraftErrors) => errors.form === undefined && Object.keys(errors.rows).length === 0;

/** The body's sections, in order; call only for a draft that passed checkDraft. */
export const sectionsOf = (draft: Draft): SectionRow[] => draft.sections.map((s) => ({ title: s.title.trim(), hint: s.hint.trim() }));

/** Whether the draft differs from the version in force (the order of sections counts). */
export function changed(version: TemplateVersion | null, draft: Draft): boolean {
  const before = JSON.stringify({ t: version?.titlePage ?? [], s: version?.sections.map((s) => [s.title, s.hint]) ?? [] });
  const after = JSON.stringify({ t: draft.titlePage, s: draft.sections.map((s) => [s.title.trim(), s.hint.trim()]) });
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
