// WEB-V17-RUBRIC-FORM: the teacher's rubric of an assignment, as the form edits it.
// Limits mirror the contract `teacher.assignment-rubric.put` (up to 12 criteria, three levels each, no points).

export const MAX_CRITERIA = 12;
export const LEVEL_COUNT = 3;
export const MAX_TITLE = 120;
export const MAX_LABEL = 80;
export const MAX_DESCRIPTOR = 400;
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export type RubricLevel = { readonly label: string; readonly descriptor: string };
export type RubricCriterion = {
  readonly id: string;
  readonly title: string;
  readonly levels: readonly [RubricLevel, RubricLevel, RubricLevel];
};
export type Rubric = readonly RubricCriterion[];

/** Where a problem sits: the criterion's index and the field ("title" or "label0".."label2"/"descriptor0".."descriptor2"), or the whole list. */
export type RubricErrors = { list?: "empty-title" | "too-many"; fields: Readonly<Record<string, "required" | "too-long">> };

export const emptyLevels = (): RubricCriterion["levels"] => [
  { label: "", descriptor: "" }, { label: "", descriptor: "" }, { label: "", descriptor: "" },
];

/** A new blank criterion with an id that no other criterion of the list uses. */
export function addCriterion(rubric: Rubric): Rubric {
  if (rubric.length >= MAX_CRITERIA) return rubric;
  const used = new Set(rubric.map((c) => c.id));
  let n = rubric.length + 1;
  while (used.has(`k${n}`)) n += 1;
  return [...rubric, { id: `k${n}`, title: "", levels: emptyLevels() }];
}

export function removeCriterion(rubric: Rubric, index: number): Rubric {
  return rubric.filter((_, i) => i !== index);
}

export function setTitle(rubric: Rubric, index: number, title: string): Rubric {
  return rubric.map((c, i) => (i === index ? { ...c, title } : c));
}

export function setLevel(rubric: Rubric, index: number, level: number, patch: Partial<RubricLevel>): Rubric {
  return rubric.map((c, i) => i !== index ? c : {
    ...c,
    levels: c.levels.map((l, j) => (j === level ? { ...l, ...patch } : l)) as unknown as RubricCriterion["levels"],
  });
}

/** An empty rubric is valid: it means "no rubric", and students then see the default criteria. */
export function checkRubric(rubric: Rubric): RubricErrors {
  const fields: Record<string, "required" | "too-long"> = {};
  rubric.forEach((c, i) => {
    const title = c.title.trim();
    if (title === "") fields[`${i}.title`] = "required";
    else if (title.length > MAX_TITLE) fields[`${i}.title`] = "too-long";
    c.levels.forEach((l, j) => {
      const label = l.label.trim();
      if (label === "") fields[`${i}.label${j}`] = "required";
      else if (label.length > MAX_LABEL) fields[`${i}.label${j}`] = "too-long";
      if (l.descriptor.trim().length > MAX_DESCRIPTOR) fields[`${i}.descriptor${j}`] = "too-long";
    });
  });
  return { ...(rubric.length > MAX_CRITERIA ? { list: "too-many" as const } : {}), fields };
}

export const rubricIsValid = (rubric: Rubric): boolean => {
  const e = checkRubric(rubric);
  return e.list === undefined && Object.keys(e.fields).length === 0 && rubric.every((c) => ID_PATTERN.test(c.id));
};

/** The PUT body's criteria: trimmed text, null when there is nothing to save (no rubric, or an invalid one). */
export function toCriteria(rubric: Rubric): { id: string; title: string; levels: { label: string; descriptor: string }[] }[] | null {
  if (rubric.length === 0 || !rubricIsValid(rubric)) return null;
  return rubric.map((c) => ({
    id: c.id, title: c.title.trim(),
    levels: c.levels.map((l) => ({ label: l.label.trim(), descriptor: l.descriptor.trim() })),
  }));
}
