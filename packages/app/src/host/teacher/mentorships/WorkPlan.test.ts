// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { ConsultationRecord } from "../../../../../../src/client/consultation-records";
import { AgreedCard, type RecordsRead } from "./AgreedCard";
import type { TasksCall } from "./agreed-tasks";
import { mentorPlanText as t } from "./messages.hr";
import { OpenMentorshipCard } from "./OpenMentorshipCard";
import type { OpenCall } from "./open-mentorship";
import { PlanActions } from "./PlanActions";
import type { PlanCall } from "./plan-actions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no <dialog> methods; the shared Dialog opens it as modal.
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute("open"); };

const DOC = "izmisljeni-rad-0001";
let root: Root | null = null;

async function mount(node: ReturnType<typeof h>) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(node); });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

const record = (heldOn: string, agreement: string): ConsultationRecord => ({
  id: `00000000-0000-4000-8000-0000000${heldOn.replaceAll("-", "").slice(0, 5)}`, heldOn, revision: 2, topic: "Izmišljena tema", agreement,
  additions: [{ id: "00000000-0000-4000-8000-00000000ad01", text: "Izmišljena dopuna", createdAt: "2026-11-21T10:00:00.000Z" }],
});

const button = (host: HTMLElement, name: string) =>
  [...host.ownerDocument.querySelectorAll("button")].find((b) => b.textContent === name) as HTMLButtonElement;

function type(input: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  set.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("AgreedCard (MK-5)", () => {
  it("shows the latest consultation's agreement, additions and agreed tasks, and links the log", async () => {
    const read: RecordsRead = async () => [record("2026-11-05", "Staro."), record("2026-11-20", "Izmišljeni dogovor: dovršiti uvod.")];
    const latest = record("2026-11-20", "").id;
    const task = (id: string, recordId: string, text: string) => ({ id, recordId, position: 1, text, done: false, markedAt: null, createdAt: "2026-11-20T10:00:00.000Z" });
    const tasks = () => (async () => ({ ok: true, status: 200, body: { tasks: [
      task("00000000-0000-4000-8000-00000000a001", latest, "Izmišljeni zadatak: dovršiti uvod"),
      task("00000000-0000-4000-8000-00000000a002", "00000000-0000-4000-8000-0000000a0b05", "Stari zadatak"),
    ] } })) as TasksCall;
    const host = await mount(h(AgreedCard, { documentId: DOC, base: "web", onSignedOut: () => {}, read, tasks }));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(host.textContent).toContain(t.agreed.last.replace("{date}", "20. 11. 2026.").replace("{topic}", "Izmišljena tema"));
    expect(host.textContent).toContain("Izmišljeni dogovor: dovršiti uvod.");
    expect(host.textContent).not.toContain("Staro.");
    expect(host.textContent).toContain("Izmišljena dopuna");
    expect(host.textContent).toContain(t.agreed.taskList.title);
    expect(host.querySelector("input[type=checkbox]")?.closest("label")?.textContent).toBe("Izmišljeni zadatak: dovršiti uvod");
    expect(host.textContent).not.toContain("Stari zadatak");
    expect(host.textContent).not.toContain("još nije moguće");
    expect(host.querySelector("a")?.getAttribute("href")).toContain(`/nastavnik/rad/${DOC}/konzultacije`);
  });

  it("a failed read says unavailable with a retry, never the empty text", async () => {
    let calls = 0;
    const read: RecordsRead = async () => { calls++; return calls === 1 ? null : []; };
    const host = await mount(h(AgreedCard, { documentId: DOC, base: "web", onSignedOut: () => {}, read }));
    expect(host.querySelector("[role=alert]")?.textContent).toBe(t.agreed.unavailable);
    expect(host.textContent).not.toContain(t.agreed.empty);
    await act(async () => { button(host, t.agreed.retry).click(); });
    expect(host.textContent).toContain(t.agreed.empty);
    expect(calls).toBe(2);
  });
});

describe("OpenMentorshipCard (MK-7, F4-MEN-R01)", () => {
  it("keeps 'Otvori mentorstvo' disabled until the students are read, and sends nothing on its own", async () => {
    const ids: string[] = [];
    const call: OpenCall = async (id) => { ids.push(id); return { ok: false, status: 503, code: "unavailable" }; };
    const host = await mount(h(OpenMentorshipCard, { call: () => call }));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(button(host, t.open.button).disabled).toBe(true);
    expect(host.textContent).toContain(t.open.studentsUnavailable);
    expect(host.textContent).not.toContain("još nije dostupno");
    expect(ids).toEqual(["teacher.courses.get"]);
  });
});

describe("PlanActions (MK-6)", () => {
  function setup(answers: Awaited<ReturnType<PlanCall>>[]) {
    const sent: unknown[] = [];
    let changed = 0;
    const call = () => (async (_id, input) => { sent.push(input.body); return answers.shift()!; }) as PlanCall;
    return { sent, changed: () => changed, node: h(PlanActions, { documentId: DOC, onChanged: () => { changed++; }, onSignedOut: () => {}, call }) };
  }

  it("asks for a title, keeps what was typed after an unknown answer, and reads the plan again after the server saved", async () => {
    const PLAN = { milestones: [] };
    const s = setup([{ ok: false, status: 503, code: "unavailable" }, { ok: true, status: 201, body: PLAN }]);
    const host = await mount(s.node);
    await act(async () => { button(host, t.plan.add).click(); });
    await act(async () => { button(host, t.plan.save).click(); });
    expect(document.body.textContent).toContain(t.plan.titleNeeded);
    expect(s.sent).toEqual([]);
    const title = document.querySelector("dialog input") as HTMLInputElement;
    await act(async () => { type(title, "Izmišljena etapa"); });
    await act(async () => { button(host, t.plan.save).click(); });
    expect(document.body.textContent).toContain(t.plan.unknown);
    expect((document.querySelector("dialog input") as HTMLInputElement).value).toBe("Izmišljena etapa");
    expect(s.changed()).toBe(0);
    await act(async () => { button(host, t.plan.save).click(); });
    expect(s.sent).toEqual([{ title: "Izmišljena etapa", submits: "current_version" }, { title: "Izmišljena etapa", submits: "current_version" }]);
    expect(document.querySelector("dialog")).toBeNull();
    expect(host.querySelector("[role=status]")?.textContent).toBe(t.plan.added);
    expect(s.changed()).toBe(1);
  });

  it("a template conflict closes the dialog, says so and reads again", async () => {
    const s = setup([{ ok: false, status: 409, code: "conflict" }]);
    const host = await mount(s.node);
    await act(async () => { button(host, t.plan.template).click(); });
    await act(async () => { button(host, t.plan.templateConfirm).click(); });
    expect(host.querySelector("[role=alert]")?.textContent).toBe(t.plan.conflict);
    expect(s.changed()).toBe(1);
  });
});
