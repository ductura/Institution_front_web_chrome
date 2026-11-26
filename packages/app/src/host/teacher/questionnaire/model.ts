// WEB-V18-UPITNIK-AUTOR: pure rules of the teacher's questionnaire screens. Drafts are text typed in forms;
// bodyOf() turns one into the contract's body or names the first problem. Answers of a paper sheet are checked
// the same way. Nothing here touches the network.
export const KINDS = ["single", "multiple", "scale", "number", "text"] as const;
export type Kind = (typeof KINDS)[number];
export type State = "draft" | "open" | "closed";

export const MAX_QUESTIONS = 40;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 20;
const MAX_TITLE = 400;
const MAX_QUESTION_TEXT = 1000;
const MAX_LABEL = 240;
const MAX_ANSWER_TEXT = 2000;

export type Option = { readonly code: string; readonly label: string };
export type Scale = { readonly min: number; readonly max: number };
export type Question = {
  readonly id: string;
  readonly order: number;
  readonly kind: Kind;
  readonly text: string;
  readonly options: readonly Option[] | null;
  readonly scale: Scale | null;
};
export type Questionnaire = {
  readonly id: string;
  readonly courseId: string;
  readonly title: string;
  readonly state: State;
  readonly questions: readonly Question[];
};
export type ListItem = {
  readonly id: string;
  readonly title: string;
  readonly state: State;
  readonly createdOn: string;
  readonly questionCount: number;
  readonly responseCount: number;
};

/** What a form holds while typing: everything is text. */
export type DraftQuestion = { kind: Kind; text: string; options: string; scaleMin: string; scaleMax: string };
export type Draft = { title: string; questions: DraftQuestion[] };

export type BodyQuestion = {
  kind: Kind;
  text: string;
  options?: Option[];
  scale?: Scale;
};
export type Body = { title: string; questions: BodyQuestion[] };
export type Problem = "title" | "count" | "text" | "options" | "scale";
export type Checked<T> = { ok: true; value: T } | { ok: false; problem: Problem; index: number | null };

export const emptyQuestion = (): DraftQuestion => ({ kind: "single", text: "", options: "", scaleMin: "1", scaleMax: "5" });
export const emptyDraft = (): Draft => ({ title: "", questions: [emptyQuestion()] });

/** The draft a form shows for a questionnaire read from the server. */
export function draftOf(questionnaire: Questionnaire): Draft {
  return {
    title: questionnaire.title,
    questions: [...questionnaire.questions].sort((a, b) => a.order - b.order).map((q) => ({
      kind: q.kind,
      text: q.text,
      options: (q.options ?? []).map((o) => o.label).join("\n"),
      scaleMin: String(q.scale?.min ?? 1),
      scaleMax: String(q.scale?.max ?? 5),
    })),
  };
}

/** a-z, 0-9 and "-" only, starting with a letter or digit, at most 40 characters ("Što je to?" → "sto-je-to"). */
export function codeOf(label: string): string {
  const slug = label.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  return slug === "" ? "odgovor" : slug;
}

/** Codes are unique within a question: a repeat gets "-2", "-3" … (a label repeated by itself is refused earlier). */
export function optionsOf(text: string): Option[] | null {
  const labels = text.split("\n").map((line) => line.trim()).filter((line) => line !== "");
  if (labels.length < MIN_OPTIONS || labels.length > MAX_OPTIONS) return null;
  if (labels.some((label) => label.length > MAX_LABEL)) return null;
  if (new Set(labels.map((label) => label.toLowerCase())).size !== labels.length) return null;
  const used = new Set<string>();
  return labels.map((label) => {
    const base = codeOf(label);
    let code = base;
    for (let n = 2; used.has(code); n += 1) code = `${base.slice(0, 40 - String(n).length - 1)}-${n}`;
    used.add(code);
    return { code, label };
  });
}

function wholeNumber(text: string): number | null {
  return /^\d{1,2}$/.test(text.trim()) ? Number(text.trim()) : null;
}

/** The contract's body of a draft, or the first problem (with the question's index, null for the title or count). */
export function bodyOf(draft: Draft): Checked<Body> {
  const title = draft.title.trim();
  if (title === "" || title.length > MAX_TITLE) return { ok: false, problem: "title", index: null };
  if (draft.questions.length < 1 || draft.questions.length > MAX_QUESTIONS) return { ok: false, problem: "count", index: null };
  const questions: BodyQuestion[] = [];
  for (const [index, q] of draft.questions.entries()) {
    const text = q.text.trim();
    if (text === "" || text.length > MAX_QUESTION_TEXT) return { ok: false, problem: "text", index };
    if (q.kind === "single" || q.kind === "multiple") {
      const options = optionsOf(q.options);
      if (options === null) return { ok: false, problem: "options", index };
      questions.push({ kind: q.kind, text, options });
    } else if (q.kind === "scale") {
      const min = wholeNumber(q.scaleMin);
      const max = wholeNumber(q.scaleMax);
      if (min === null || max === null || min > 10 || max > 10 || min >= max) return { ok: false, problem: "scale", index };
      questions.push({ kind: "scale", text, scale: { min, max } });
    } else {
      questions.push({ kind: q.kind, text });
    }
  }
  return { ok: true, value: { title, questions } };
}

export type AnswerValue = string | number | string[];
export type Answer = { questionId: string; value: AnswerValue };
/** One question's typed input on a paper sheet: a code, codes, or text. */
export type SheetInput = string | string[];
export type SheetCheck = { ok: true; answers: Answer[] } | { ok: false; reason: "none" | "value"; bad: string[] };

/**
 * The answers of one paper sheet. An empty field is "not answered"; at least one answer is needed; a value that
 * does not fit its question (an unknown option, a number off the scale) is named and nothing is sent.
 */
export function answersOf(questions: readonly Question[], inputs: Readonly<Record<string, SheetInput | undefined>>): SheetCheck {
  const answers: Answer[] = [];
  const bad: string[] = [];
  for (const q of questions) {
    const input = inputs[q.id];
    if (input === undefined || (typeof input === "string" && input.trim() === "") || (Array.isArray(input) && input.length === 0)) continue;
    const codes = new Set((q.options ?? []).map((o) => o.code));
    if (q.kind === "single" && typeof input === "string" && codes.has(input)) answers.push({ questionId: q.id, value: input });
    else if (q.kind === "multiple" && Array.isArray(input) && new Set(input).size === input.length && input.every((c) => codes.has(c))) answers.push({ questionId: q.id, value: input });
    else if (q.kind === "text" && typeof input === "string" && input.trim() !== "" && input.trim().length <= MAX_ANSWER_TEXT) answers.push({ questionId: q.id, value: input.trim() });
    else if ((q.kind === "number" || q.kind === "scale") && typeof input === "string" && input.trim() !== "" && Number.isFinite(Number(input))) {
      const value = Number(input);
      const fits = q.kind === "number" || (q.scale !== null && Number.isInteger(value) && value >= q.scale.min && value <= q.scale.max);
      if (fits) answers.push({ questionId: q.id, value }); else bad.push(q.id);
    } else bad.push(q.id);
  }
  if (bad.length > 0) return { ok: false, reason: "value", bad };
  return answers.length === 0 ? { ok: false, reason: "none", bad: [] } : { ok: true, answers };
}

/** Only a published (open or closed) questionnaire takes a paper sheet; a draft does not exist for respondents. */
export const takesManualEntry = (state: State): boolean => state !== "draft";
/** The one-way steps: a draft is published, an open one is closed, a closed one stays closed. */
export const nextState = (state: State): "open" | "closed" | null => (state === "draft" ? "open" : state === "open" ? "closed" : null);
