// @vitest-environment jsdom
// WEB-V21-KOD-TESTOVI-OBRAZAC: the form mounted in jsdom over a test double of the port. Invented text only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CodeTestsForm } from "./CodeTestsForm";
import { fakeCodeTestsPort, FAKE_ASSIGNMENT } from "./fake-port";
import { codeTestsText as t } from "./messages.hr";
import type { CodeTestsPort, ReadResult, WriteResult } from "./port";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const A = FAKE_ASSIGNMENT;
const SAVED = { revisionNo: 1, language: "javascript" as const, tests: [{ id: "t1", title: "Zbroj", input: [1, 2], expected: 3 }] };

describe("the code-test form in the browser", () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  let signedOut: ReturnType<typeof vi.fn>;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); signedOut = vi.fn(); });
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const render = async (port: CodeTestsPort) => { await act(async () => { root?.render(h(CodeTestsForm, { assignmentId: A, port, onSignedOut: signedOut as () => void })); }); };
  const text = () => host.textContent ?? "";
  const click = async (el: Element | null | undefined) => { await act(async () => { (el as HTMLElement).click(); }); };
  const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label || b.getAttribute("aria-label") === label);
  const field = (label: string, n = 0) => [...host.querySelectorAll("label")].filter((l) => l.textContent === label)[n]!.control as HTMLInputElement | HTMLTextAreaElement;
  const type = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    await act(async () => { Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  const submit = async () => { await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); };
  const stub = (read: ReadResult, write: WriteResult = { kind: "done", view: SAVED }) => {
    const port = { read: vi.fn(async () => read), write: vi.fn(async () => write) };
    return port satisfies CodeTestsPort;
  };
  const addTest = async (title: string, input: string, expected: string) => {
    await click(button(t.add));
    const n = host.querySelectorAll("[data-testid=test-row]").length - 1;
    await type(field(t.test.title, n), title); await type(field(t.test.input, n), input); await type(field(t.test.expected, n), expected);
  };

  it("shows loading, then 'no tests' as a state of its own", async () => {
    await render(fakeCodeTestsPort());
    expect(host.querySelector("[data-testid=no-tests]")!.textContent).toContain(t.empty);
    expect(button(t.add)).toBeDefined();
    expect(host.querySelector("[data-testid=count]")!.textContent).toContain("0 od 10");
  });
  it("503 is 'unavailable' with a retry, not 'no tests'; the retry reads again", async () => {
    const port = stub({ kind: "unavailable" });
    await render(port);
    expect(text()).toContain(t.unavailable);
    expect(host.querySelector("[data-testid=no-tests]")).toBeNull();
    port.read.mockResolvedValueOnce({ kind: "ok", view: SAVED });
    await click(button(t.retry));
    expect(port.read).toHaveBeenCalledTimes(2);
    expect(field(t.test.title).value).toBe("Zbroj");
  });
  it("another course's task (404) is 'not available' and shows no form", async () => {
    await render(stub({ kind: "notFound" }));
    expect(host.querySelector("[role=alert]")!.textContent).toContain(t.gone);
    expect(button(t.retry)).toBeUndefined();
    expect(host.querySelector("form")).toBeNull();
  });
  it("shows each part of the summary in its own line, without a dot between them, and the limit from {max}", async () => {
    await render(stub({ kind: "ok", view: SAVED }));
    expect(text()).not.toContain("·");
    expect(host.querySelector("[data-testid=revision]")!.textContent).toBe(t.revision.replace("{n}", "1"));
    expect(host.querySelector("[data-testid=size]")!.textContent).toMatch(/^Veličina: \d+ od 16384 bajtova$/);
    expect(host.querySelector("[data-testid=count]")!.textContent).toBe("Testova: 1 od 10");
    expect(text()).not.toContain("{max}");
  });
  it("the empty state offers 'Dodaj test', which adds the first row", async () => {
    await render(stub({ kind: "ok", view: { ...SAVED, tests: [] } }));
    await click(button(t.add));
    expect(host.querySelectorAll("[data-testid=test-row]")).toHaveLength(1);
    expect(host.querySelector("[data-testid=no-tests]")).toBeNull();
  });
  it("signed out goes to sign-in", async () => {
    await render(stub({ kind: "signedOut" }));
    expect(signedOut).toHaveBeenCalledOnce();
  });
  it("sends nothing for invalid JSON input and names the field", async () => {
    const port = stub({ kind: "ok", view: { ...SAVED, tests: [] } });
    await render(port);
    await addTest("Zbroj", "{nope", "3");
    await submit();
    expect(port.write).not.toHaveBeenCalled();
    expect(text()).toContain(t.errors.input);
    await type(field(t.test.input), "[1,2]");
    await submit();
    expect(port.write).toHaveBeenCalledOnce();
  });
  it("disables adding the 11th test", async () => {
    await render(stub({ kind: "ok", view: { ...SAVED, tests: [] } }));
    for (let i = 0; i < 10; i += 1) await click(button(t.add));
    expect(host.querySelectorAll("[data-testid=test-row]")).toHaveLength(10);
    expect((button(t.add) as HTMLButtonElement).disabled).toBe(true);
    expect(host.querySelector("[data-testid=add-limit]")).not.toBeNull();
    await click(button(t.add));
    expect(host.querySelectorAll("[data-testid=test-row]")).toHaveLength(10);
  });
  it("saves, shows the new revision and the preview only after the server answered", async () => {
    const port = stub({ kind: "ok", view: { ...SAVED, revisionNo: 0, tests: [] } });
    await render(port);
    await addTest("Zbroj", "[1,2]", "3");
    expect(host.querySelector("[data-testid=preview]")!.textContent).toContain("Zbroj");
    expect(text()).not.toContain(t.saved);
    await submit();
    expect(port.write).toHaveBeenCalledWith(A, { language: "javascript", tests: [{ id: "t1", title: "Zbroj", input: [1, 2], expected: 3 }] });
    expect(host.querySelector("[role=status]")!.textContent).toBe(t.saved);
    expect(host.querySelector("[data-testid=revision]")!.textContent).toContain("1");
    expect(text()).toContain(t.preview.note);
  });
  it("a lost answer is 'unknown', not saved, and keeps what was typed", async () => {
    const port = stub({ kind: "ok", view: { ...SAVED, tests: [] } }, { kind: "unknown" });
    await render(port);
    await addTest("Zbroj", "[1,2]", "3");
    await submit();
    expect(host.querySelector("[role=alert]")!.textContent).toBe(t.writeFailure.unknown);
    expect(text()).not.toContain(t.saved);
    expect(field(t.test.title).value).toBe("Zbroj");
  });
  it("a server refusal (422) is shown and keeps the draft", async () => {
    const port = stub({ kind: "ok", view: { ...SAVED, tests: [] } }, { kind: "invalid" });
    await render(port);
    await addTest("Zbroj", "[1,2]", "3");
    await submit();
    expect(host.querySelector("[role=alert]")!.textContent).toBe(t.writeFailure.invalid);
    expect(field(t.test.input).value).toBe("[1,2]");
  });
  it("removing a test and resetting restores the saved rows; nothing is sent without a change", async () => {
    const port = stub({ kind: "ok", view: SAVED });
    await render(port);
    expect((button(t.save) as HTMLButtonElement).disabled).toBe(true);
    await click(button(t.test.remove.replace("{n}", "1")));
    expect(host.querySelector("[data-testid=no-tests]")).not.toBeNull();
    await click(button(t.reset));
    expect(field(t.test.title).value).toBe("Zbroj");
    expect(port.write).not.toHaveBeenCalled();
  });
  it("never says a test is hidden or that its result counts", async () => {
    await render(stub({ kind: "ok", view: SAVED }));
    expect(text()).not.toMatch(/skriven|ocjen[ua] se|bodov/i);
  });
});
