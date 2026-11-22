import type { FastPathRecord, FastPathStudent } from "../../../../../../src/components/teacher/fast-path.ts";
import { whenText } from "../../../../../../src/components/teacher/fast-path.ts";
import { messagesHr } from "../../../../../../src/lib/i18n/messages.hr.ts";
import type { TeacherRead } from "../../pages";

import { fastPathHostText as t } from "./messages.hr";

/** What `readFastPath` (src/components/teacher/fast-path/read.ts) answers. */
export type FastPathAnswer =
  | { readonly kind: "ok"; readonly students: readonly FastPathStudent[] }
  | { readonly kind: "signedOut" | "forbidden" | "unavailable" };

/** The read of the host page: forbidden is a teacher of another course; anything unknown is unavailable. */
export function fastPathRead(answer: FastPathAnswer): TeacherRead<readonly FastPathStudent[]> {
  if (answer.kind === "ok") return { kind: "ready", value: answer.students };
  if (answer.kind === "signedOut") return { kind: "signedOut" };
  if (answer.kind === "forbidden") return { kind: "notTeacher" };
  return { kind: "unavailable" };
}

/** The state of a work as a word only: the prototype cards drop the coloured dot (N-05). */
export function stateText(student: FastPathStudent): string {
  return t.work[student.work];
}

export type DetailLine = { readonly key: "state" | "lastChange" | "pastes" | "record"; readonly label: string; readonly value: string };

/**
 * The details of a started work, in the prototype's order: Stanje, Zadnja promjena,
 * Lijepljenja bez izvora, Stanje zapisa. The pastes say only whether there are any;
 * their list is in the full summary (their place in the text is not known, #757).
 */
export function detailLines(student: FastPathStudent, record: FastPathRecord): DetailLine[] {
  const recordState = messagesHr.summary.recordState;
  return [
    { key: "state", label: t.lines.state, value: stateText(student) },
    { key: "lastChange", label: t.lines.lastChange, value: whenText(student.lastChangeAt) },
    { key: "pastes", label: t.lines.pastes, value: record.pastesWithoutSource > 0 ? t.pastesSome : t.pastesNone },
    { key: "record", label: recordState.label, value: recordState[record.summary.recordState] },
  ];
}

/** The assignment named by `?zadatak=`, or null when there is none to read. */
export function assignmentOf(query: string | null): string | null {
  const id = query?.trim() ?? "";
  return id === "" ? null : id;
}
