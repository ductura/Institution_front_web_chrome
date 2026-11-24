// @vitest-environment jsdom
// NZ-5: the dialog sends the draft, the answer decides the message, a closed dialog sends nothing.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HostContext, type HostValue } from "../../context";
import { LateException, type LateResult } from "./LateException";
import { offersLate } from "./late-exception";
import { assignmentFactsMessages as text } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no modal dialog: opening only sets the attribute.
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
const HOST = { base: "/app/web", page: { path: "/nastavnik" }, role: "teacher" } as unknown as HostValue;
const NOW = Date.parse("2027-02-01T10:00:00Z");

describe("LateException (NZ-5)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

  async function mount(record: ReturnType<typeof vi.fn>, results: LateResult[]) {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(h(HostContext.Provider, { value: HOST },
        h(LateException, { assignmentId: "a1", studentId: "s1", name: "Ana Izmišljena", now: () => NOW, onResult: (r: LateResult) => results.push(r), record: record as never })));
    });
    await act(async () => { host.querySelector<HTMLButtonElement>("button.btn")!.click(); });
    return host;
  }
  const fill = async (reason: string, due: string) => {
    const select = document.querySelector<HTMLSelectElement>("dialog select")!;
    const field = document.querySelector<HTMLInputElement>('dialog input[type="datetime-local"]')!;
    const set = (el: HTMLInputElement | HTMLSelectElement, value: string, proto: object) => {
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    };
    await act(async () => { set(select, reason, HTMLSelectElement.prototype); set(field, due, HTMLInputElement.prototype); });
  };
  const send = async () => { await act(async () => { [...document.querySelectorAll<HTMLButtonElement>("dialog button")].find((b) => b.textContent === text.late.record)!.click(); }); };

  it("says the student sees the new deadline and reason and that the record stays", async () => {
    await mount(vi.fn(), []);
    expect(document.querySelector("dialog")?.textContent).toContain(text.late.studentSees);
  });

  it("asks for what is missing and sends nothing", async () => {
    const record = vi.fn();
    await mount(record, []);
    await send();
    expect(document.querySelector("dialog [role=alert]")?.textContent).toBe(text.late.needReason);
    expect(record).not.toHaveBeenCalled();
  });

  it("reports a recorded exception to the parent only after the server's answer", async () => {
    const results: LateResult[] = [];
    const record = vi.fn(async () => ({ kind: "zabiljezeno", extension: { dueAt: "2027-02-10T11:00:00.000Z" }, existingSubmissionsUnchanged: false }));
    await mount(record, results);
    await fill("justified", "2027-02-10T12:00");
    await send();
    expect(record).toHaveBeenCalledWith(expect.anything(), "a1", { scope: "one", studentId: "s1", dueAt: "2027-02-10T11:00:00.000Z", reasonId: "justified" });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ tone: "status", assignmentId: null });
    expect(results[0]!.text).toContain("Zabilježeno");
  });

  it("keeps the dialog open with a sentence when the server refuses, and links the list when unsure", async () => {
    const results: LateResult[] = [];
    await mount(vi.fn(async () => ({ kind: "greska", code: "invalid" })), results);
    await fill("technical", "2027-02-10T12:00");
    await send();
    expect(document.querySelector("dialog [role=alert]")?.textContent).toBe(text.late.notRecorded);
    expect(results).toEqual([]);
    act(() => root?.unmount());
    document.body.innerHTML = "";
    const unsure: LateResult[] = [];
    await mount(vi.fn(async () => ({ kind: "nepoznato" })), unsure);
    await fill("agreement", "2027-02-10T12:00");
    await send();
    expect(unsure).toEqual([{ tone: "alert", text: text.late.unknown, assignmentId: "a1" }]);
  });
});

describe("offersLate (NZ-5)", () => {
  const reads = { dueAt: "2027-01-30T16:00:00.000Z", extensions: null };
  it("offers it to not-submitted rows and to never-opened rows once the deadline passed", () => {
    expect(offersLate({ kind: "notSubmitted", studentId: "s" }, reads, NOW)).toBe(true);
    expect(offersLate({ kind: "notOpened", studentId: "s" }, reads, NOW)).toBe(true);
    expect(offersLate({ kind: "notOpened", studentId: "s" }, reads, Date.parse("2027-01-01T00:00:00Z"))).toBe(false);
    expect(offersLate({ kind: "submitted", studentId: "s" }, reads, NOW)).toBe(false);
    expect(offersLate({ kind: "writing", studentId: "s" }, reads, NOW)).toBe(false);
  });
  it("counts the student's own extension as the deadline", () => {
    const extended = { ...reads, extensions: [{ scope: "one" as const, studentId: "s", dueAt: "2027-03-01T00:00:00.000Z" }] };
    expect(offersLate({ kind: "notOpened", studentId: "s" }, extended, NOW)).toBe(false);
  });
});
