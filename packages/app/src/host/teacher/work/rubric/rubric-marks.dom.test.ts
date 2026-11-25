// @vitest-environment jsdom
// WEB-V17-RUBRIC-MARK: the marks card over a stand-in client. Invented work and rubric only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RubricMarks } from "./RubricMarks";
import type { Call } from "./port";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LEVELS = [0, 1, 2].map((i) => ({ label: `Razina ${i + 1}`, descriptor: "" }));
const ok = (body: unknown) => ({ ok: true, status: 200, body });
const client = (over: Record<string, (input: { body?: unknown }) => unknown> = {}) => {
  const table: Record<string, (input: { body?: unknown }) => unknown> = {
    "teacher.work.get": () => ok({ documentId: "d1", assignmentId: "a1" }),
    "teacher.assignment-rubric.get": () => ok({ version: 1, criteria: [{ id: "k1", title: "Struktura", levels: LEVELS }] }),
    "teacher.work-rubric.get": () => ok({ rubricVersion: 1, marks: [{ criterionId: "k1", level: null, note: null }] }),
    "teacher.work-rubric-mark.put": ({ body }) => ok({ criterionId: "k1", ...(body as object) }),
    ...over,
  };
  return vi.fn(async (id: string, input: { body?: unknown }) => table[id]!(input)) as unknown as Call & ReturnType<typeof vi.fn>;
};

describe("RubricMarks", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const settle = async () => { for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); }); };
  const mount = async (call: Call) => {
    const host = document.body.appendChild(document.createElement("div"));
    root = createRoot(host);
    act(() => root!.render(h(RubricMarks, { documentId: "d1", call })));
    await settle();
    return host;
  };

  it("marks a level and saves it; the save button waits for a change", async () => {
    const call = client();
    const host = await mount(call);
    const save = [...host.querySelectorAll("button")].find((b) => b.textContent === "Spremi")!;
    expect(save.disabled).toBe(true);
    const radio = host.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1]!;
    await act(async () => { radio.click(); });
    expect(save.disabled).toBe(false);
    await act(async () => { save.click(); });
    await settle();
    const put = call.mock.calls.find((c) => c[0] === "teacher.work-rubric-mark.put")!;
    expect(put[1]).toMatchObject({ params: { documentId: "d1", criterionId: "k1" }, body: { level: 1, note: null } });
    expect(host.textContent).toContain("Spremljeno.");
    expect(host.textContent).not.toMatch(/\d+\s*\/\s*\d+|zbroj ukupno/i);
  });

  it("renders nothing when the assignment has no rubric", async () => {
    const host = await mount(client({ "teacher.assignment-rubric.get": () => ok({ version: 0, criteria: [] }) }));
    expect(host.textContent).toBe("");
  });

  it("shows an error, not an empty card, when the read fails, and can retry", async () => {
    let fail = true;
    const host = await mount(client({ "teacher.assignment-rubric.get": () => (fail ? { ok: false, status: 500 } : ok({ version: 1, criteria: [{ id: "k1", title: "Struktura", levels: LEVELS }] })) }));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("nisu dostupni");
    fail = false;
    await act(async () => { host.querySelector("button")!.click(); });
    await settle();
    expect(host.textContent).toContain("Struktura");
  });

  it("keeps the old mark and says so when saving fails", async () => {
    const host = await mount(client({ "teacher.work-rubric-mark.put": () => ({ ok: false, status: 500 }) }));
    await act(async () => { host.querySelectorAll<HTMLInputElement>('input[type="radio"]')[2]!.click(); });
    await act(async () => { [...host.querySelectorAll("button")].find((b) => b.textContent === "Spremi")!.click(); });
    await settle();
    expect(host.textContent).toContain("Oznaka nije spremljena");
    expect(host.textContent).not.toContain("Spremljeno.");
  });
});
