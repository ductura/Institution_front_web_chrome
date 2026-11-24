"use client";

import { EntryList } from "@ductura/ui";

import type { TeacherDeclarationRead } from "../../../../../../src/client/declaration.ts";
import { aiDeclarationMessages as text } from "./messages.hr";

/** The question and the answer of a read, matched by question; null when no question was asked. */
export function questionOf(read: TeacherDeclarationRead | null): { readonly question: string; readonly answer: string | null; readonly pending: boolean } | null {
  if (read === null || read.kind === "unavailable" || read.kind === "signedOut") return null;
  const question = read.question ?? null;
  if (question === null) return null;
  const answer = read.answer ?? null;
  return {
    question: question.text,
    answer: answer !== null && answer.questionId === question.questionId ? answer.text : null,
    pending: read.kind === "pending",
  };
}

/**
 * NF-5 PG-6 (NF-3 PR-20, NF-4 NZ-15): the teacher's question beside the declaration and the
 * student's answer, in the same card as the declaration and its conversations. Read only; the
 * answer is not obligatory, so a missing one is said plainly and means nothing more.
 */
export default function QuestionAnswer({ read }: { read: TeacherDeclarationRead | null }) {
  const qa = questionOf(read);
  if (qa === null) return null;
  return (
    <div data-nf5="PG-6">
      <h3 className="sb-sub">{text.questionHeading}</h3>
      <p className="note">{qa.question}</p>
      {qa.answer === null
        ? <p className="meta">{qa.pending ? text.answerPending : text.noAnswer}</p>
        : <EntryList entries={[{ id: "answer", who: text.studentAnswer, text: qa.answer }]} />}
    </div>
  );
}
