// NZ-7a (NF-4): "Ovako će student vidjeti obavijest". Pure: built from the fields of the loaded version
// (institution.assignment.get), the same fields the student notice shows; no student names, no work content.
import { momentHr } from "../n12/model";
import { noticePreviewHr as text } from "./messages.hr";

export type NoticeFields = {
  readonly versionNo: number;
  readonly dueAt: string;
  readonly aiPolicy: string;
  readonly aiPurposes: readonly string[];
  readonly importAllowed: boolean;
  readonly wordMin: number | null;
  readonly wordMax: number | null;
};

export type NoticeLine = { readonly label: string; readonly value: string };

const PURPOSES: Readonly<Record<string, string>> = {
  idea_generation: "smišljanje ideja",
  language_editing: "jezična korektura",
  summarising: "sažimanje",
  translation: "prevođenje",
  feedback: "povratna informacija",
};

export function wordsText(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${min}–${max} riječi`;
  if (min !== null) return `najmanje ${min} riječi`;
  if (max !== null) return `najviše ${max} riječi`;
  return text.noLimit;
}

/** The lines a student reads, in a fixed order. An unknown purpose is shown as it is not, never invented. */
export function noticeLines(f: NoticeFields): readonly NoticeLine[] {
  const purposes = f.aiPurposes.map((p) => PURPOSES[p]).filter((p): p is string => p !== undefined);
  const tools = f.aiPolicy === "prohibited" || purposes.length === 0 ? text.toolsNone : text.toolsSome(purposes.join(", "));
  return [
    { label: text.due, value: momentHr(f.dueAt) },
    { label: text.tools, value: tools },
    { label: text.scope, value: wordsText(f.wordMin, f.wordMax) },
    { label: text.importing, value: f.importAllowed ? text.importYes : text.importNo },
    { label: text.version, value: String(f.versionNo) },
  ];
}
