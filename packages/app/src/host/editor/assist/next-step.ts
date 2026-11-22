// WEB-2128: "Sljedeći korak" and "Što još (N)" in the left panel (plus.js).
// The steps are listed in the order of the prototype; the first is the next
// step. Inputs that only the server knows (review round, stages, holes of the
// requirements profile) are optional: without them the step is simply absent.
import { assistHr as t } from "./messages.hr";
import { allObservations, type AdviceInput } from "./advice";
import { ownAndSub, type AssistChapter } from "./blocks";
import type { WorkRange } from "./balance";

export type StepTarget =
  | { readonly kind: "tab"; readonly tab: "work" | "comments" | "sources" | "progress" | "requirements" }
  | { readonly kind: "chapter"; readonly id: string }
  | { readonly kind: "wizard" };

export type Step = { readonly text: string; readonly target?: StepTarget };

export type NextStepInput = AdviceInput & {
  readonly submitted: boolean;
  readonly teacherView: boolean;
  readonly range: WorkRange;
  readonly review?: { readonly status: "revise" | "review" | "accepted" | "draft"; readonly due: string | null; readonly openComments: number; readonly firstCommentChapterId: string | null } | null;
  readonly stagesBack?: readonly { readonly name: string; readonly note: string }[];
  /** Citations not tied to the list of sources, when the editor knows. */
  readonly unlinkedCites?: number;
  readonly requirements?: readonly { readonly text: string; readonly detail: string }[];
  /** First open task of each chapter, in document order. */
  readonly todos?: readonly { readonly chapterId: string; readonly text: string }[];
};

const MARK = /\[(?:\?|izvor)\]/gu;

export function holesOf(chapters: readonly AssistChapter[]): { count: number; first: AssistChapter | null } {
  let count = 0;
  let first: AssistChapter | null = null;
  for (const c of chapters) {
    const n = c.text.match(MARK)?.length ?? 0;
    if (n > 0 && !first) first = c;
    count += n;
  }
  return { count, first };
}

const label = (c: AssistChapter | undefined) => (c ? `${c.number} ${c.title || "…"}`.trim() : "");

export function nextSteps(input: NextStepInput): Step[] {
  const { chapters } = input;
  const top = chapters.filter((c) => c.parentId === null);
  const steps: Step[] = [];
  if (input.submitted) return [{ text: t.next.submitted, target: { kind: "tab", tab: "work" } }];
  if (input.teacherView) return [];
  if (input.review?.status === "revise") {
    const first = chapters.find((c) => c.id === input.review?.firstCommentChapterId);
    steps.push({ text: t.next.revise(input.review.due, input.review.openComments, first ? label(first) : null), target: { kind: "tab", tab: "comments" } });
  }
  for (const back of input.stagesBack ?? []) steps.push({ text: t.next.stageBack(back.name, back.note) });
  const holes = holesOf(chapters);
  if (holes.count > 0 && holes.first) steps.push({ text: t.next.holes(holes.count, label(holes.first)), target: { kind: "chapter", id: holes.first.id } });
  const words = top.reduce((sum, c) => sum + ownAndSub(chapters, c.id).words, 0);
  const sized = top.map((c) => ({ c, words: ownAndSub(chapters, c.id).words }));
  if (input.range.max !== null && words > input.range.max) {
    const longest = [...sized].sort((a, b) => b.words - a.words)[0];
    steps.push({ text: `${t.next.over(words - input.range.max)} ${longest ? t.next.overFarthest(label(longest.c)) : ""}`.trim(), target: { kind: "tab", tab: "progress" } });
  }
  const empty = top.find((c) => ownAndSub(chapters, c.id).words === 0);
  if (empty) steps.push({ text: t.next.emptyChapter(label(empty)), target: { kind: "chapter", id: empty.id } });
  if (input.range.min !== null && words < input.range.min) {
    const shortest = [...sized].sort((a, b) => a.words - b.words)[0];
    steps.push({ text: `${t.next.under(input.range.min - words)} ${shortest ? t.next.underFarthest(label(shortest.c)) : ""}`.trim(), target: { kind: "tab", tab: "progress" } });
  }
  if ((input.unlinkedCites ?? 0) > 0) steps.push({ text: t.next.unlinked(input.unlinkedCites!), target: { kind: "tab", tab: "sources" } });
  for (const req of input.requirements ?? []) steps.push({ text: t.next.requirement(req.text, req.detail), target: { kind: "tab", tab: "requirements" } });
  const seen = new Set<string>();
  for (const todo of input.todos ?? []) {
    if (seen.has(todo.chapterId)) continue;
    seen.add(todo.chapterId);
    steps.push({ text: t.next.todo(label(chapters.find((c) => c.id === todo.chapterId)), todo.text), target: { kind: "chapter", id: todo.chapterId } });
    if (seen.size >= 9) break;
  }
  const obs = allObservations(input)[0];
  if (obs) steps.push({ text: t.next.observation(label(chapters.find((c) => c.id === obs.chapterId)), obs.text), target: { kind: "chapter", id: obs.chapterId } });
  if (steps.length === 0) {
    return top.length === 0 ? [{ text: t.next.empty, target: { kind: "wizard" } }] : [{ text: t.next.nothing }];
  }
  return steps;
}
