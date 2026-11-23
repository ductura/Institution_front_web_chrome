// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { fakeSubmissionsPort } from "../fake-port";
import TeacherSubmissions from "../TeacherSubmissions";
import type { HistoryCall } from "./contract";
import { ASSIGNMENT, STUDENT, fakeHistoryServer } from "./fake-port";
import { historyText as t, showHistoryLabel } from "./messages.hr";

// PIL-D3-NASTAVNIK: the history and the withdrawal switch as the submissions table mounts them, over the
// fake server (invented data). The port itself is tested over the contract's vectors in port.test.ts.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

async function show(history?: HistoryCall) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<TeacherSubmissions port={fakeSubmissionsPort()} assignmentId={ASSIGNMENT} names={{ [STUDENT]: "Ivo Izmišljeni" }} history={history} />);
  });
  return host;
}

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const button = (el: HTMLElement, name: string) => {
  const found = [...el.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === name || b.textContent === name);
  if (found === undefined) throw new Error(`button missing: ${name}`);
  return found;
};

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null; host = null;
});

describe("history and withdrawal switch beside the submission rows (PIL-D3-NASTAVNIK)", () => {
  it("without a history transport the table is as before: no switch, no history column", async () => {
    const el = await show();
    await settle();
    expect(el.textContent).not.toContain(t.column);
    expect(el.textContent).not.toContain(t.settingLabel);
  });

  it("(1) a row opens that student's submissions and withdrawals with their times, and closes again", async () => {
    const el = await show(fakeHistoryServer().call);
    await settle();
    expect(el.textContent).toContain(t.column);
    expect(el.textContent).not.toContain(t.title);
    await act(async () => { button(el, showHistoryLabel("Ivo Izmišljeni")).click(); });
    await settle();
    expect(el.textContent).toContain(t.title);
    const rows = [...el.querySelectorAll("section[aria-labelledby='submission-history-h'] tbody tr")].map((r) => r.textContent ?? "");
    // (3) the withdrawn submission stays in the history: three events, newest first.
    expect(rows).toHaveLength(3);
    expect(rows.some((r) => r.includes(t.withdrawn))).toBe(true);
    expect(rows.filter((r) => r.includes(t.submitted))).toHaveLength(2);
    expect(rows.every((r) => /2026/.test(r))).toBe(true);
    expect(button(el, showHistoryLabel("Ivo Izmišljeni")).getAttribute("aria-pressed")).toBe("true");
    await act(async () => { button(el, t.hide).click(); });
    expect(el.textContent).not.toContain(t.title);
  });

  it("(2) the switch shows the server's value and changes only after the server's answer", async () => {
    const server = fakeHistoryServer(undefined, { enabled: true });
    const el = await show(server.call);
    await settle();
    const box = el.querySelector<HTMLInputElement>("input[type='checkbox']");
    expect(box?.checked).toBe(true);
    await act(async () => { box!.click(); });
    await settle();
    expect(server.enabled()).toBe(false);
    expect(el.querySelector<HTMLInputElement>("input[type='checkbox']")?.checked).toBe(false);
    expect(el.textContent).toContain(t.settingSaved);
  });

  it("(2) a refused save keeps the box as the server holds it and says why", async () => {
    const server = fakeHistoryServer(undefined, { enabled: true, forbidSave: true });
    const el = await show(server.call);
    await settle();
    await act(async () => { el.querySelector<HTMLInputElement>("input[type='checkbox']")!.click(); });
    await settle();
    expect(server.enabled()).toBe(true);
    expect(el.querySelector<HTMLInputElement>("input[type='checkbox']")?.checked).toBe(true);
    expect(el.textContent).toContain(t.settingForbidden);
  });
});
