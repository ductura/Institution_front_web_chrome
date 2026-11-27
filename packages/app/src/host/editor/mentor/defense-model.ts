// ED-121 (prototype tools.js defenseText, "Kostur za obranu"): a starting outline for the defence, put
// together in the browser from what the student already wrote: the title, the question of the work (the
// writing help's notes), the first sentence of each chapter (the first two of the conclusion) and the
// hypotheses named in the text. Nothing new is written; empty places say what to fill in. The edited
// outline stays on this device, per work, and never enters the document or a submission.
import { CHAPTER_LEVEL } from "../assist/blocks";
import { clean, type NoteStorage } from "../assist/work-notes";
import { mentorCardHr } from "./messages.hr";

const t = mentorCardHr.defense;

export const MAX_DEFENSE = 8000;
export const defenseKey = (workId: string) => `ductura.defense-outline.${workId}`;

export type DefenseChapter = { readonly title: string; readonly paragraphs: readonly string[] };
export type DefenseInput = {
  readonly title: string;
  readonly thesis: string;
  readonly chapters: readonly DefenseChapter[];
  readonly hypotheses: readonly string[];
};

/** The first `n` sentences of a paragraph; a closing quote or bracket stays with its sentence. */
export function firstSentences(text: string, n: number): string {
  const parts = text.match(/[^.!?…]+(?:[.!?…]+["”»')\]]*|$)/gu) ?? [];
  return parts.map((s) => s.trim()).filter((s) => s !== "").slice(0, n).join(" ");
}

/** H1, H2 … as the text names them, once each, in number order. */
export function hypothesesOf(text: string): string[] {
  return [...new Set(text.match(/\bH\d+\b/gu) ?? [])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

const CONCLUSION = /zaklju/iu;

export function defenseText(input: DefenseInput): string {
  const out: string[] = [];
  const add = (head: string, body: string) => { out.push(`${out.length + 1}. ${head}\n   ${body}`); };
  add(t.titleHead, input.title.trim() !== "" ? input.title.trim() : t.titleEmpty);
  add(t.thesisHead, input.thesis.trim() !== "" ? input.thesis.trim() : t.thesisEmpty);
  for (const ch of input.chapters) {
    const first = ch.paragraphs.find((p) => p.trim() !== "");
    const said = first === undefined ? "" : firstSentences(first, CONCLUSION.test(ch.title) ? 2 : 1);
    add(ch.title.trim() !== "" ? ch.title.trim() : t.untitled, said !== "" ? said : t.chapterEmpty);
  }
  if (input.hypotheses.length > 0) add(t.hypothesesHead, `${input.hypotheses.join(", ")}: ${t.hypothesesAsk}`);
  add(t.limitsHead, t.fillIn);
  add(t.closingHead, "");
  return out.join("\n\n").replace(/\n {3}$/u, "");
}

/** The parts of a ProseMirror node the outline reads. */
export type OutlineNode = {
  readonly type: { readonly name: string };
  readonly attrs: Readonly<Record<string, unknown>>;
  readonly textContent: string;
};
export type OutlineDoc = { forEach(fn: (node: OutlineNode) => void): void };

/** Chapters are the top headings (as the writing help reads them); a lower heading stays inside its chapter. */
export function defenseInputOf(doc: OutlineDoc, title: string | null, thesis: string): DefenseInput {
  const chapters: { title: string; paragraphs: string[] }[] = [];
  const whole: string[] = [];
  doc.forEach((node) => {
    whole.push(node.textContent);
    if (node.type.name === "heading") {
      if (Number(node.attrs.level) <= CHAPTER_LEVEL) chapters.push({ title: node.textContent, paragraphs: [] });
      return;
    }
    if (node.type.name === "paragraph") chapters[chapters.length - 1]?.paragraphs.push(node.textContent);
  });
  return { title: title ?? "", thesis, chapters, hypotheses: hypothesesOf(whole.join("\n")) };
}

/** The outline the student edited, or null when there is none (or the store cannot be read). */
export function loadDefense(storage: NoteStorage | null, workId: string): string | null {
  try {
    const raw = storage?.getItem(defenseKey(workId));
    return typeof raw === "string" ? clean(raw, MAX_DEFENSE) : null;
  } catch {
    return null;
  }
}

/** Saves the edited outline; null forgets it, so the next opening composes it again from the work. */
export function saveDefense(storage: NoteStorage | null, workId: string, text: string | null): void {
  try {
    if (text === null) storage?.removeItem(defenseKey(workId));
    else storage?.setItem(defenseKey(workId), clean(text, MAX_DEFENSE));
  } catch {
    // A full or blocked store keeps the text on the screen only.
  }
}
