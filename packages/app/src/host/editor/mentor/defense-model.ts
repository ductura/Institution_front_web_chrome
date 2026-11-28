// ED-113 (prototype tools.js defenseText): "Kostur za obranu", composed in the browser only from what the
// work already holds: the title (H1), the question of the work (the left panel's thread), the first sentence
// of each chapter (H2; two for a conclusion) and the hypothesis labels named in the text. Nothing is written
// for the student: a chapter without text says so, and the parts only the student can say are left to fill in.
import { hypothesesOf } from "../assist/advice";
import { sentences } from "../hints/hints-model";

import { mentorCardHr } from "./messages.hr";

const t = mentorCardHr.defense;

export type DefenseChapter = { readonly title: string; readonly firstParagraph: string | null };
export type DefenseInput = {
  readonly title: string | null;
  readonly question: string;
  readonly chapters: readonly DefenseChapter[];
  readonly hypotheses: readonly string[];
};

/** The parts of a ProseMirror node the outline reads. */
export type DefenseNode = {
  readonly type: { readonly name: string };
  readonly attrs: { readonly level?: unknown };
  readonly textContent: string;
  readonly isTextblock: boolean;
  readonly content: { readonly size: number };
  textBetween(from: number, to: number, blockSeparator?: string, leafText?: string): string;
  forEach(fn: (node: DefenseNode) => void): void;
};

const levelOf = (node: DefenseNode): number | null =>
  node.type.name === "heading" && typeof node.attrs.level === "number" ? node.attrs.level : null;

/** The outline's facts from the document; the question comes from the thread the student wrote. */
export function defenseInputOf(doc: DefenseNode, question: string): DefenseInput {
  let title: string | null = null;
  const chapters: { title: string; firstParagraph: string | null }[] = [];
  doc.forEach((node) => {
    const level = levelOf(node);
    if (level === 1) {
      if (title === null && node.textContent.trim() !== "") title = node.textContent.trim();
      return;
    }
    if (level === 2) { chapters.push({ title: node.textContent.trim(), firstParagraph: null }); return; }
    // A deeper heading belongs to the chapter above it: the chapter's text runs on through its subchapters, so
    // a chapter that opens with a subchapter starts with that subchapter's first paragraph (prototype paras to headEnd).
    if (level !== null) return;
    const open = chapters[chapters.length - 1];
    if (open === undefined || open.firstParagraph !== null || node.type.name !== "paragraph") return;
    const text = node.textContent.trim();
    if (text !== "") open.firstParagraph = text;
  });
  return {
    title,
    question: question.trim(),
    chapters: chapters.filter((c) => c.title !== ""),
    hypotheses: hypothesesOf(doc.textBetween(0, doc.content.size, " ", " ")),
  };
}

const CONCLUSION = /zaklju/iu;

/** The chapter's opening: its first sentence, the first two for a conclusion. */
function opening(chapter: DefenseChapter): string {
  if (chapter.firstParagraph === null) return t.noText;
  const said = sentences(chapter.firstParagraph).map((s) => s.s.trim()).filter((s) => s !== "");
  if (said.length === 0) return t.noText;
  return said.slice(0, CONCLUSION.test(chapter.title) ? 2 : 1).join(" ");
}

/** The numbered outline, as the prototype lays it out: a heading per point, its text indented under it. */
export function defenseText(input: DefenseInput): string {
  const points: [string, string | null][] = [
    [t.titleRow, input.title ?? t.noTitle],
    [t.question, input.question === "" ? t.noQuestion : input.question],
    ...input.chapters.map((c): [string, string] => [c.title, opening(c)]),
  ];
  if (input.hypotheses.length > 0) points.push([t.hypotheses, `${input.hypotheses.join(", ")}: ${t.hypothesesAsk}`]);
  points.push([t.limits, t.fillIn], [t.thanks, null]);
  return points.map(([head, body], i) => `${i + 1}. ${head}${body === null ? "" : `\n   ${body}`}`).join("\n\n");
}

/** A saved outline is a string; anything else in the store is no outline. */
export const parseDefense = (raw: unknown): string | null => (typeof raw === "string" ? raw.slice(0, 20_000) : null);
