// @vitest-environment jsdom
// NF-5 PG-6 (NF-3 PR-20): the teacher's question and the student's answer in the declaration card
// of the work review. Invented data only.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { DeclarationPort, TeacherDeclarationRead } from "../../../../../../src/client/declaration.ts";
import AiDeclarationSection from "./AiDeclarationSection";
import { aiDeclarationMessages as text } from "./messages.hr";
import { questionOf } from "./QuestionAnswer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const QUESTION = { questionId: "00000000-0000-4000-8000-0000000000e1", text: "Koji Vam je izmišljeni izvor najviše pomogao?" };
const ANSWER = { questionId: QUESTION.questionId, questionText: QUESTION.text, text: "Izmišljeni udžbenik iz metodologije." };
const NO_USE = { kind: "no_use", confirmedAt: "20. 11. 2026." } as const;

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });

async function show(read: TeacherDeclarationRead) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const port: DeclarationPort = { readStudent: async () => ({ kind: "unavailable" }), confirm: async () => ({ kind: "unavailable" }), readTeacher: async () => read };
  await act(async () => { root!.render(createElement(AiDeclarationSection, { port, submissionId: "s1" })); });
  return host;
}

describe("question and answer beside the declaration (PG-6)", () => {
  it("matches the answer to the question asked; nothing without a question or a read", () => {
    expect(questionOf(null)).toBeNull();
    expect(questionOf({ kind: "unavailable" })).toBeNull();
    expect(questionOf(NO_USE)).toBeNull();
    expect(questionOf({ ...NO_USE, question: QUESTION, answer: ANSWER })).toEqual({ question: QUESTION.text, answer: ANSWER.text, pending: false });
    expect(questionOf({ ...NO_USE, question: QUESTION, answer: { ...ANSWER, questionId: "00000000-0000-4000-8000-0000000000e0" } }))
      .toEqual({ question: QUESTION.text, answer: null, pending: false });
    expect(questionOf({ kind: "pending", question: QUESTION })).toEqual({ question: QUESTION.text, answer: null, pending: true });
  });

  it("shows the question and the answer in the declaration card", async () => {
    const view = await show({ ...NO_USE, question: QUESTION, answer: ANSWER });
    expect(view.querySelector("h3")?.textContent).toBe(text.questionHeading);
    expect(view.textContent).toContain(QUESTION.text);
    expect(view.textContent).toContain(`${text.studentAnswer}${ANSWER.text}`);
  });

  it("a missing answer is said plainly; before the declaration it waits for it", async () => {
    expect((await show({ ...NO_USE, question: QUESTION })).textContent).toContain(text.noAnswer);
    act(() => root?.unmount());
    host?.remove();
    expect((await show({ kind: "pending", question: QUESTION })).textContent).toContain(text.answerPending);
  });

  it("without a question the card is as before", async () => {
    const view = await show(NO_USE);
    expect(view.textContent).not.toContain(text.questionHeading);
  });
});
