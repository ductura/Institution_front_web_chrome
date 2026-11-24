// NZ-7a (NF-4): "Ovako će student vidjeti obavijest". Pure: built from the fields of the loaded version
// (institution.assignment.get), the same fields the student notice shows; no student names, no work content.
import { AI_PURPOSES } from "@/components/teacher/assignment-create";
import { wordRangeHr } from "@/lib/i18n/length-line";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { momentHr } from "../n12/model";
import { noticePreviewHr as text } from "./messages.hr";

/** The short labels of the five FPZG čl. 8 purposes (D-80), one catalogue for every teacher and admin screen. */
const purposeLabels = messagesHr.facultyRuleVersions.purposeLabels;

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

/** The word range as the student reads it (S3 notice: "2 000–2 500 riječi"); no limit is said in words. */
export function wordsText(min: number | null, max: number | null): string {
  return wordRangeHr({ min, max }) ?? text.noLimit;
}

/**
 * The allowed purposes exactly as the student notice picks them (host/student/enrol/HostNotice.tsx): the closed
 * list AI_PURPOSES, in its order, kept when the version lists it. A key outside the list is never shown.
 */
export function allowedPurposes(aiPurposes: readonly string[]): readonly string[] {
  return AI_PURPOSES.filter((p) => aiPurposes.includes(p)).map((p) => purposeLabels[p]);
}

/** The lines a student reads, in a fixed order. */
export function noticeLines(f: NoticeFields): readonly NoticeLine[] {
  const purposes = allowedPurposes(f.aiPurposes);
  const tools = purposes.length === 0 ? text.toolsNone : text.toolsSome(purposes.join(", "));
  return [
    { label: text.due, value: momentHr(f.dueAt) },
    { label: text.tools, value: tools },
    { label: text.scope, value: wordsText(f.wordMin, f.wordMax) },
    { label: text.importing, value: f.importAllowed ? text.importYes : text.importNo },
    { label: text.version, value: String(f.versionNo) },
  ];
}
