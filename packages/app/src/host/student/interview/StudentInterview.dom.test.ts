// @vitest-environment jsdom
// PIL-K-RAZGOVOR: the student's interview page and the outcomes of a send, mounted in jsdom. The work's
// document and the host are stubbed; the port is a test double. Invented texts only.
import { File } from "node:buffer";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { interviewMessages as text } from "./messages.hr";
import type { InterviewPort, InterviewRead, InterviewWrite } from "./port";
import StudentInterview from "./StudentInterview";

const work = vi.hoisted(() => ({ current: null as unknown }));
const missing = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));
vi.mock("next/navigation", () => ({ notFound: missing, useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("../other", () => ({ useWorkDocument: () => work.current }));
vi.mock("../../context", () => ({ useHost: () => ({ base: "/app/web" }) }));
const { default: StudentInterviewPage } = await import("./StudentInterviewPage");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const READY: InterviewRead = {
  kind: "ready", workTitle: null, slot: null, heldAt: null, attachments: [], explanations: [],
  questions: [{ id: "q1", paragraphRef: null, text: "Koje si izmišljene izvore koristila?" }],
};
const DRAFT = "Izmišljeno objašnjenje.";

function portWith(write: () => Promise<InterviewWrite>, reads: InterviewRead[] = [READY]) {
  let n = 0;
  const read = vi.fn(async () => reads[Math.min(n++, reads.length - 1)]!);
  const explain = vi.fn(write);
  return { read, explain, port: { read, explain } satisfies InterviewPort };
}

describe("StudentInterview in the browser", () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; work.current = null; missing.mockClear(); });

  const render = async (node: ReturnType<typeof h>) => { await act(async () => { root?.render(node); }); };
  const type = async (value: string) => {
    const area = host.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, value);
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const sendButton = () => [...host.querySelectorAll("button")].find((b) => /objašnjenj/.test(b.textContent ?? "")) as HTMLButtonElement;

  it("keeps the clicked button focusable and busy while the server has not answered, then announces the outcome", async () => {
    let answer!: (w: InterviewWrite) => void;
    const { port } = portWith(() => new Promise((resolve) => { answer = resolve; }));
    await render(h(StudentInterview, { port, documentId: "doc-1" }));
    const status = host.querySelector('[role="status"]');
    expect(status?.textContent).toBe("");
    await type(DRAFT);
    sendButton().focus();
    await act(async () => { sendButton().click(); });
    expect(sendButton().textContent).toBe(text.sending);
    expect(sendButton().getAttribute("aria-disabled")).toBe("true");
    expect(sendButton().disabled).toBe(false);
    expect(document.activeElement).toBe(sendButton());
    expect(host.textContent).not.toContain(text.sent);
    await act(async () => { answer({ kind: "saved", explanation: { id: "e1", questionId: "q1", text: DRAFT } }); });
    expect(host.querySelector('[role="status"]')).toBe(status);
    expect(status?.textContent).toBe(text.sent);
    expect(host.textContent).toContain(DRAFT);
  });

  it("a send answered 401 goes to sign-in, 404 to not found, and 403 reads the talk again", async () => {
    const signedOut = vi.fn();
    const first = portWith(async () => ({ kind: "signedOut" }));
    await render(h(StudentInterview, { port: first.port, documentId: "doc-1", onSignedOut: signedOut }));
    await type(DRAFT);
    await act(async () => { sendButton().click(); });
    expect(signedOut).toHaveBeenCalled();

    const gone = vi.fn();
    const second = portWith(async () => ({ kind: "notFound" }));
    await render(h(StudentInterview, { key: "b", port: second.port, documentId: "doc-1", onNotFound: gone }));
    await type(DRAFT);
    await act(async () => { sendButton().click(); });
    expect(gone).toHaveBeenCalled();

    const third = portWith(async () => ({ kind: "notInvited" }), [READY, { kind: "notInvited" }]);
    await render(h(StudentInterview, { key: "c", port: third.port, documentId: "doc-1" }));
    await type(DRAFT);
    await act(async () => { sendButton().click(); });
    expect(third.read).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain(text.notInvited);
  });

  it("the page shows its own states of the work, and a missing work as not found", async () => {
    const { port } = portWith(async () => ({ kind: "unavailable" }));
    const page = (key: string) => h(StudentInterviewPage, { key, assignmentId: "zadatak-1", port });
    work.current = { kind: "notStarted" };
    await render(page("a"));
    expect(host.textContent).toContain(text.notStarted);
    expect(host.textContent).not.toContain("reprodukcij");
    work.current = { kind: "unavailable" };
    await render(page("b"));
    expect(host.textContent).toContain(text.notSubmitted);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    work.current = { kind: "document", assignmentId: "zadatak-1", documentId: "doc-1" };
    await render(page("c"));
    expect(host.textContent).toContain(READY.questions[0]!.text);
    work.current = { kind: "notFound" };
    await expect(render(page("d"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("lists a note only after the server confirms it, and hides the action once the talk is held (409)", async () => {
    let answer!: (w: InterviewWrite) => void;
    const held: InterviewRead = { ...READY, heldAt: "2026-11-21" };
    const read = vi.fn(async () => (read.mock.calls.length > 1 ? held : READY));
    const attachNote = vi.fn(() => new Promise<InterviewWrite>((resolve) => { answer = resolve; }));
    const port: InterviewPort = { read, explain: vi.fn(), attachNote };
    await render(h(StudentInterview, { port, documentId: "doc-1" }));
    const choose = async (file: File) => {
      const input = host.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(input, "files", { configurable: true, value: [file] });
      await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
    };
    await choose(new File(["x"], "skripta.exe"));
    expect(attachNote).not.toHaveBeenCalled();
    expect(host.textContent).toContain(text.errors.fileType);

    await choose(new File(["Izmišljene bilješke."], "biljeske.txt"));
    await vi.waitFor(() => expect(attachNote).toHaveBeenCalledTimes(1));
    expect((host.querySelector('input[type="file"]') as HTMLInputElement).disabled).toBe(true);
    expect(host.textContent).not.toContain(`${text.attached}: biljeske.txt`);
    await act(async () => { answer({ kind: "saved", note: { id: "n1", fileName: "biljeske.txt" } }); });
    expect(host.textContent).toContain(`${text.attached}: biljeske.txt`);
    expect(host.textContent).toContain(text.noteSaved);

    await choose(new File(["Kasne bilješke."], "kasno.txt"));
    await vi.waitFor(() => expect(attachNote).toHaveBeenCalledTimes(2));
    await act(async () => { answer({ kind: "closed" }); });
    expect(host.querySelector('input[type="file"]')).toBeNull();
    expect(host.textContent).toContain(text.noteClosed);
    expect(host.textContent).toContain(`${text.attached}: biljeske.txt`);
    expect(host.textContent).not.toContain("kasno.txt");
    expect(read).toHaveBeenCalledTimes(2);
  });
});
