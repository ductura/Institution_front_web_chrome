// @vitest-environment jsdom
// F4-MEN-R03: the mentor adds tasks agreed at a consultation and ticks them (work.consultation-tasks.get/post,
// work.consultation-task-mark.post). Every id and text is invented.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { MAX_TASKS, addTask, failure, markTask, taskTextProblem, tasksOf, type AgreedTask, type TasksCall } from "./agreed-tasks";
import { AgreedTasks } from "./AgreedTasks";
import { mentorPlanText } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const t = mentorPlanText.agreed.taskList;
const DOC = "00000000-0000-4000-8000-00000000f501";
const RECORD = "00000000-0000-4000-8000-00000000f5a1";
const OTHER = "00000000-0000-4000-8000-00000000f5a2";

const task = (n: number, over: Partial<AgreedTask> = {}): AgreedTask => ({
  id: `00000000-0000-4000-8000-0000000f51${String(n).padStart(2, "0")}`, recordId: RECORD, position: n,
  text: `Izmišljeni zadatak ${n}`, done: false, markedAt: null, createdAt: "2026-11-20T10:00:00.000Z", ...over,
});

type Answer = Awaited<ReturnType<TasksCall>>;
type Seen = { id: string; params: unknown; body: unknown };

function server(list: AgreedTask[], answers: Answer[]) {
  const seen: Seen[] = [];
  const call = (async (id, input) => {
    seen.push({ id, params: input.params, body: input.body });
    if (id === "work.consultation-tasks.get") return { ok: true, status: 200, body: { tasks: list } };
    return answers.shift()!;
  }) as TasksCall;
  return { seen: () => seen.filter((s) => s.id !== "work.consultation-tasks.get"), call: () => call };
}

let root: Root | null = null;
let signedOut = 0;
async function mount(call: () => TasksCall) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(h(AgreedTasks, { documentId: DOC, recordId: RECORD, onSignedOut: () => { signedOut++; }, call })); });
  await settle();
  return host;
}
const settle = async () => { for (let i = 0; i < 4; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

const field = (host: HTMLElement) => host.querySelector("input:not([type=checkbox])") as HTMLInputElement;
const boxes = (host: HTMLElement) => [...host.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
const button = (host: HTMLElement, name: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === name) as HTMLButtonElement;
async function type(host: HTMLElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field(host), value);
    field(host).dispatchEvent(new Event("input", { bubbles: true }));
  });
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  signedOut = 0;
  document.body.innerHTML = "";
});

describe("agreed tasks port (F4-MEN-R03)", () => {
  it("keeps one record's tasks in the mentor's order", () => {
    expect(tasksOf([task(2), task(1), task(3, { recordId: OTHER })], RECORD).map((x) => x.position)).toEqual([1, 2]);
  });

  it("checks the text the contract takes before it is sent", () => {
    expect(taskTextProblem("   ")).toBe("blank");
    expect(taskTextProblem("a".repeat(500))).toBeNull();
    expect(taskTextProblem("😀".repeat(501))).toBe("long");
  });

  it("names each refusal and reads a saved task only from the answer", async () => {
    expect(failure({ ok: false, status: 401 })).toBe("signedOut");
    expect(failure({ ok: false, status: 403, code: "forbidden" })).toBe("forbidden");
    expect(failure({ ok: false, status: 403 })).toBe("unknown");
    expect(failure({ ok: false, status: 404 })).toBe("notFound");
    expect(failure({ ok: false, status: 422 })).toBe("invalid");
    expect(failure({ ok: false, status: 503 })).toBe("unknown");
    const odd = (async () => ({ ok: true, status: 201, body: { id: "x" } })) as TasksCall;
    expect(await addTask(odd, DOC, RECORD, "Izmišljeni")).toEqual({ kind: "unknown" });
    const thrown = (async () => { throw new Error("mreža"); }) as TasksCall;
    expect(await markTask(thrown, DOC, task(1).id, true)).toEqual({ kind: "unknown" });
  });
});

describe("AgreedTasks (F4-MEN-R03)", () => {
  it("adds a task the server kept, trimmed, and ticks it only after the server marks it", async () => {
    const added = task(2, { text: "Izmišljeni novi zadatak" });
    const s = server([task(1)], [
      { ok: true, status: 201, body: added },
      { ok: true, status: 200, body: { ...added, done: true, markedAt: "2026-11-21T10:00:00.000Z" } },
    ]);
    const host = await mount(s.call);
    expect(boxes(host)).toHaveLength(1);
    await type(host, "  Izmišljeni novi zadatak  ");
    await act(async () => { button(host, t.add).click(); });
    await settle();
    expect(s.seen()[0]).toEqual({ id: "work.consultation-tasks.post", params: { documentId: DOC, recordId: RECORD }, body: { text: "Izmišljeni novi zadatak" } });
    expect(boxes(host).map((b) => b.closest("label")?.textContent)).toEqual(["Izmišljeni zadatak 1", "Izmišljeni novi zadatak"]);
    expect(field(host).value).toBe("");
    expect(host.querySelector("[role=status]")?.textContent).toBe(t.added);

    await act(async () => { boxes(host)[1]!.click(); });
    await settle();
    expect(s.seen()[1]).toEqual({ id: "work.consultation-task-mark.post", params: { documentId: DOC, taskId: added.id }, body: { done: true } });
    expect(boxes(host)[1]!.checked).toBe(true);
    expect(boxes(host)[0]!.checked).toBe(false);
  });

  it("a mark the server did not confirm leaves the box as it was and says so", async () => {
    const s = server([task(1, { done: true })], [{ ok: false, status: 503, code: "unavailable" }]);
    const host = await mount(s.call);
    expect(boxes(host)[0]!.checked).toBe(true);
    await act(async () => { boxes(host)[0]!.click(); });
    await settle();
    expect(s.seen()[0]!.body).toEqual({ done: false });
    expect(boxes(host)[0]!.checked).toBe(true);
    expect(host.querySelector("[role=alert]")?.textContent).toBe(t.markFailed);
  });

  it("keeps the draft after an unknown answer, refuses a blank task, and Enter adds", async () => {
    const s = server([], [{ ok: false, status: 500 }, { ok: false, status: 422, code: "validation_failed" }]);
    const host = await mount(s.call);
    expect(host.textContent).toContain(t.empty);
    await act(async () => { button(host, t.add).click(); });
    expect(host.textContent).toContain(t.blank);
    expect(s.seen()).toEqual([]);
    await type(host, "Izmišljeni zadatak");
    await act(async () => { field(host).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    await settle();
    expect(host.querySelector("[role=alert]")?.textContent).toBe(t.addFailed);
    expect(field(host).value).toBe("Izmišljeni zadatak");
    await act(async () => { button(host, t.add).click(); });
    await settle();
    expect(host.querySelector("[role=alert]")?.textContent).toBe(t.invalid);
    expect(s.seen()).toHaveLength(2);
    expect(boxes(host)).toHaveLength(0);
  });

  it("at 20 tasks the field gives way to the limit, and a session end goes to sign-in", async () => {
    const full = server(Array.from({ length: MAX_TASKS }, (_, i) => task(i + 1)), [{ ok: false, status: 401 }]);
    const host = await mount(full.call);
    expect(boxes(host)).toHaveLength(MAX_TASKS);
    expect(host.textContent).toContain(t.full);
    expect(button(host, t.add)).toBeUndefined();
    await act(async () => { boxes(host)[0]!.click(); });
    await settle();
    expect(signedOut).toBe(1);
  });

  it("a failed read says unavailable with a retry, never the empty text", async () => {
    let calls = 0;
    const call = () => (async () => { calls++; return calls === 1 ? { ok: false, status: 503 } : { ok: true, status: 200, body: { tasks: [] } }; }) as TasksCall;
    const host = await mount(call);
    expect(host.querySelector("[role=alert]")?.textContent).toBe(t.unavailable);
    expect(host.textContent).not.toContain(t.empty);
    await act(async () => { button(host, t.retry).click(); });
    await settle();
    expect(host.textContent).toContain(t.empty);
  });
});
