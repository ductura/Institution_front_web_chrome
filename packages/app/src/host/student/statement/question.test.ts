// @vitest-environment jsdom
// NF-3 PR-20 (E-9, R-33): the teacher's question and the student's answer on the declaration step,
// on the probe port. Invented data only.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StatementRead } from "../../../../../../src/client/statement.ts";
import { fakeStatementPort, PROBE_QUESTION } from "./fake-port";
import { statementMessages } from "./messages.hr";
import { ANSWER_MAX_CHARS, answerAfterRead, checkAnswer, saveAnswer } from "./model";
import TeacherQuestion from "./TeacherQuestion";

const q = statementMessages.question;
const ID = "00000000-0000-4000-8000-0000000000a1";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("the answer's rules", () => {
  it("trims, keeps line feeds, and takes an empty answer as taken back", () => {
    expect(checkAnswer("  Izmišljeni odgovor.\r\nDrugi red.  ")).toEqual({ kind: "ok", text: "Izmišljeni odgovor.\nDrugi red." });
    expect(checkAnswer(" \n ")).toEqual({ kind: "empty" });
  });

  it("counts code points against the named limit and refuses control characters", () => {
    expect(checkAnswer("ž".repeat(ANSWER_MAX_CHARS)).kind).toBe("ok");
    expect(checkAnswer("ž".repeat(ANSWER_MAX_CHARS + 1)).kind).toBe("tooLong");
    expect(checkAnswer("a\u0007b").kind).toBe("badCharacter");
    expect(checkAnswer("a\tb").kind).toBe("badCharacter");
  });

  it("the field shows the held answer only to the question asked now, and keeps an unsaved edit", async () => {
    const read = await fakeStatementPort(false, PROBE_QUESTION).read(ID);
    expect(answerAfterRead(null, read)).toBe("");
    expect(answerAfterRead("tipkam", read)).toBe("tipkam");
    const held = { ...read, answer: { questionId: PROBE_QUESTION.questionId, questionText: PROBE_QUESTION.text, text: "Izmišljeno." } } as StatementRead;
    expect(answerAfterRead(null, held)).toBe("Izmišljeno.");
    const other = { ...read, answer: { questionId: "00000000-0000-4000-8000-0000000000e0", questionText: "Staro.", text: "Staro." } } as StatementRead;
    expect(answerAfterRead(null, other)).toBe("");
  });

  it("sends nothing without a question, after submission, or for an answer the server cannot take", async () => {
    const without = fakeStatementPort();
    expect(await saveAnswer(without, ID, await without.read(ID), "Izmišljeno.")).toEqual({ kind: "readOnly" });
    const submitted = fakeStatementPort(true, PROBE_QUESTION);
    expect(await saveAnswer(submitted, ID, await submitted.read(ID), "Izmišljeno.")).toEqual({ kind: "readOnly" });
    const port = fakeStatementPort(false, PROBE_QUESTION);
    expect((await saveAnswer(port, ID, await port.read(ID), "x".repeat(ANSWER_MAX_CHARS + 1))).kind).toBe("invalid");
    expect(port.answers).toEqual([]);
    expect(await saveAnswer(port, ID, await port.read(ID), " Izmišljeno. ")).toEqual({ kind: "saved" });
    expect(await saveAnswer(port, ID, await port.read(ID), "")).toEqual({ kind: "saved" });
    expect(port.answers).toEqual([{ questionId: PROBE_QUESTION.questionId, text: "Izmišljeno." }, null]);
  });

  it("a thrown port is unavailable, never saved", async () => {
    const port = { ...fakeStatementPort(false, PROBE_QUESTION), saveAnswer: async () => { throw new Error("mreža"); } };
    expect(await saveAnswer(port, ID, await port.read(ID), "Izmišljeno.")).toEqual({ kind: "unavailable" });
  });
});

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });

async function show(port: ReturnType<typeof fakeStatementPort>, onReload = vi.fn()) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const read = await port.read(ID);
  await act(async () => {
    root!.render(createElement(TeacherQuestion, { port, assignmentId: ID, read, onReload, onSignIn: () => undefined }));
  });
  return host;
}

function type(area: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => { setter.call(area, value); area.dispatchEvent(new Event("input", { bubbles: true })); });
}

describe("TeacherQuestion", () => {
  it("shows nothing when the teacher asked no question", async () => {
    expect((await show(fakeStatementPort())).textContent).toBe("");
  });

  it("shows the question, saves the answer on the server and says so", async () => {
    const port = fakeStatementPort(false, PROBE_QUESTION);
    const onReload = vi.fn();
    const view = await show(port, onReload);
    expect(view.textContent).toContain(q.title);
    expect(view.textContent).toContain(PROBE_QUESTION.text);
    const area = view.querySelector("textarea")!;
    const button = [...view.querySelectorAll("button")].find((b) => b.textContent === q.save)!;
    // Nothing typed, nothing to save.
    expect(button.disabled).toBe(true);
    type(area, "Izmišljeni odgovor.");
    expect(button.disabled).toBe(false);
    await act(async () => { button.click(); });
    expect(port.answers).toEqual([{ questionId: PROBE_QUESTION.questionId, text: "Izmišljeni odgovor." }]);
    expect(view.querySelector('[role="status"]')?.textContent).toBe(q.saved);
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("an answer over the limit is said beside the field and cannot be sent", async () => {
    const view = await show(fakeStatementPort(false, PROBE_QUESTION));
    type(view.querySelector("textarea")!, "x".repeat(ANSWER_MAX_CHARS + 1));
    expect(view.textContent).toContain("Najviše 2.000 znakova");
    expect(view.querySelector("textarea")!.getAttribute("aria-invalid")).toBe("true");
    expect([...view.querySelectorAll("button")].find((b) => b.textContent === q.save)!.disabled).toBe(true);
  });

  it("a failed write stays as an alert and keeps the text", async () => {
    const port = { ...fakeStatementPort(false, PROBE_QUESTION), saveAnswer: async () => ({ kind: "unavailable" as const }) };
    const view = await show(port);
    type(view.querySelector("textarea")!, "Izmišljeni odgovor.");
    await act(async () => { [...view.querySelectorAll("button")].find((b) => b.textContent === q.save)!.click(); });
    expect(view.querySelector('[role="alert"]')?.textContent).toBe(statementMessages.failed);
    expect(view.querySelector("textarea")!.value).toBe("Izmišljeni odgovor.");
  });

  it("after submission the answer is read only, and a missing one is said plainly", async () => {
    const port = fakeStatementPort(false, PROBE_QUESTION);
    await port.saveAnswer(ID, { questionId: PROBE_QUESTION.questionId, text: "Izmišljeni odgovor." });
    port.submit();
    const view = await show(port);
    expect(view.querySelector("textarea")).toBeNull();
    expect(view.querySelector("button")).toBeNull();
    expect(view.textContent).toContain("Izmišljeni odgovor.");
    expect(view.textContent).toContain(q.readOnly);
    act(() => root?.unmount());
    host?.remove();
    const empty = fakeStatementPort(true, PROBE_QUESTION);
    expect((await show(empty)).textContent).toContain(q.noAnswer);
  });
});
