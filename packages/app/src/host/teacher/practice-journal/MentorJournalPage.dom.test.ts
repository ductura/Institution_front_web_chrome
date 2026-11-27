// @vitest-environment jsdom
// WEB-V19-DNEVNIK-MENTOR: the mentor's journal page mounted in jsdom with test doubles for the client.
// Invented texts only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mentorJournalText as t } from "./messages.hr";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("../../context", () => ({ useHost: () => ({ base: "/aplikacija" }) }));
vi.mock("@/client/api", () => ({ createApi: vi.fn(), goToSignIn: signIn }));
// The teacher read hook of pages.tsx, without pulling the whole host in: the same states, read once per attempt.
vi.mock("../../pages", async () => {
  const { useEffect, useState } = await import("react");
  return {
    useTeacherRead: (_base: string, read: () => Promise<unknown>) => {
      const [result, setResult] = useState<unknown>(null);
      const [attempt, setAttempt] = useState(0);
      useEffect(() => { let live = true; void read().then((v) => { if (live) setResult(v); }); return () => { live = false; }; }, [attempt]);
      return [result, () => setAttempt((n) => n + 1)];
    },
  };
});
const { default: MentorJournalPage } = await import("./MentorJournalPage");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const NOW = () => new Date(2026, 3, 15, 12, 0, 0);
const WORK = { mentorshipId: "m1", assignmentId: "a1", documentId: null, student: { givenName: "Ana", familyName: "Izmišljenić" }, title: "Izmišljeni rad", workType: "bachelor_thesis", workState: "not_started" };
const PLACEMENT = { placementId: "11111111-1111-4111-8111-111111111111", mentorshipId: "m1", organisationName: "Izmišljena d.o.o.", startsOn: "2026-03-02", endsOn: "2026-06-30", entryCount: 2, signedThrough: null };
const E1 = { entryId: "e1", date: "2026-04-01", hours: 2, text: "Prvi izmišljeni zapis.", correctsEntryId: null, createdAt: "2026-04-01T10:00:00.000Z" };
const E2 = { entryId: "e2", date: "2026-04-03", hours: 1.5, text: "Drugi izmišljeni zapis.", correctsEntryId: null, createdAt: "2026-04-03T10:00:00.000Z" };
const SIGNOFF = { signoffId: "s1", throughDate: "2026-04-03", entryCount: 2, entriesSha256: "ab".repeat(32), comment: "Izmišljen komentar.", signedAt: "2026-04-04T08:00:00.000Z", mentor: { id: "t1", givenName: "Mentor", familyName: "Izmišljeni" } };
const ok = (body: unknown, status = 200): Answer => ({ ok: true, status, body });
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });

function apiOf(routes: Record<string, () => Answer>) {
  const calls: { id: string; input: { body?: unknown; params?: unknown } }[] = [];
  const fn = vi.fn(async (id: string, input: { body?: unknown }) => { calls.push({ id, input }); return routes[id]!(); });
  return { calls, call: () => fn as never };
}
const worksOk = (works: unknown[] = [WORK]) => () => (async () => ok({ works })) as never;

const setValue = (el: Element, value: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
};

describe("MentorJournalPage in the browser", () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); signIn.mockClear(); });
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const render = async (call: () => never, works: () => never = worksOk()) => {
    act(() => root?.unmount());
    root = createRoot(host);
    await act(async () => { root?.render(h(MentorJournalPage, { call, works, now: NOW })); });
  };
  const text = () => host.textContent ?? "";
  const forms = () => [...host.querySelectorAll("form")];
  const submit = async (form: HTMLFormElement) => { await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); };
  const openFirst = async () => { await act(async () => { host.querySelector<HTMLButtonElement>("[data-testid=placement] button")!.click(); }); };

  it("shows the 403 state with the way back and no journal for a non-teacher", async () => {
    const d = apiOf({ "practice.placements.get": () => ok({ placements: [] }) });
    await render(d.call, (() => (async () => fail(403, "forbidden")) as never) as never);
    expect(text()).toContain(t.deniedTitle);
    expect(host.querySelector<HTMLAnchorElement>(`a[href="/aplikacija/nastavnik"]`)?.textContent).toBe(t.backToOwn);
    expect(host.querySelector("[data-testid=placement]")).toBeNull();
  });

  it("frames an unavailable practice list as an alert with a retry", async () => {
    const d = apiOf({ "practice.placements.get": () => fail(503, "unavailable") });
    await render(d.call);
    const alert = host.querySelector("[role=alert]");
    expect(alert?.textContent).toContain(t.placementsUnavailable);
    expect([...host.querySelectorAll("button")].some((b) => b.textContent === t.retry)).toBe(true);
  });

  it("lists the practices with the student's name and opens one to read the entries and the history", async () => {
    const d = apiOf({ "practice.placements.get": () => ok({ placements: [PLACEMENT] }), "practice.entries.get": () => ok({ entries: [E1, E2], signoffs: [SIGNOFF] }) });
    await render(d.call);
    expect(host.querySelectorAll("[data-testid=placement]")).toHaveLength(1);
    expect(text()).toContain("Ana Izmišljenić");
    expect(host.querySelector("[data-testid=entry]")).toBeNull();
    await openFirst();
    expect(host.querySelectorAll("[data-testid=entry]")).toHaveLength(2);
    expect(d.calls.find((c) => c.id === "practice.entries.get")!.input.params).toEqual({ placementId: PLACEMENT.placementId });
    expect(text()).toContain("Izmišljen komentar.");
    expect(text()).not.toContain("ab".repeat(32));
    expect(text()).not.toContain("Sažetak zapisa");
    expect(text()).toContain("potpisano 4. travnja 2026. u 10:00");
    expect(text()).toContain("Potpisanih zapisa: 2");
    expect(text()).toContain("Komentar mentora: Izmišljen komentar.");
    expect(text()).toContain(t.signedMark);
    expect(text()).toContain(t.privateNote);
  });

  it("says loading failure, no mentorships, and no practice as different things", async () => {
    let d = apiOf({ "practice.placements.get": () => fail(503, "unavailable") });
    await render(d.call);
    expect(text()).toContain(t.placementsUnavailable);
    expect(text()).not.toContain(t.noPlacements);
    d = apiOf({ "practice.placements.get": () => ok({ placements: [] }) });
    await render(d.call);
    expect(text()).toContain(t.noPlacements);
    expect(text()).not.toContain(t.placementsUnavailable);
    await render(d.call, worksOk([]));
    expect(text()).toContain(t.noMentorships.body);
    expect(forms()).toHaveLength(0);
    await render(d.call, (() => (async () => fail(503, "unavailable")) as never) as never);
    expect(text()).toContain(t.unavailable);
    expect(text()).not.toContain(t.noMentorships.body);
  });

  it("reads entries that failed to load as an error, and another mentor's practice as not available; neither offers the signature form", async () => {
    let d = apiOf({ "practice.placements.get": () => ok({ placements: [PLACEMENT] }), "practice.entries.get": () => fail(503, "unavailable") });
    await render(d.call);
    await openFirst();
    expect(text()).toContain(t.entriesUnavailable);
    expect(text()).not.toContain(t.noEntries);
    expect(text()).not.toContain(t.signSubmit);
    d = apiOf({ "practice.placements.get": () => ok({ placements: [PLACEMENT] }), "practice.entries.get": () => fail(404, "not_found") });
    await render(d.call);
    await openFirst();
    expect(text()).toContain(t.placementGone);
    expect(text()).not.toContain(t.signSubmit);
  });

  it("refuses a bad practice without a call, and says opened only after the server answers", async () => {
    let placements: unknown[] = [];
    const d = apiOf({ "practice.placements.get": () => ok({ placements }), "practice.placements.post": () => { placements = [PLACEMENT]; return ok({ placementId: PLACEMENT.placementId }, 201); } });
    await render(d.call);
    const form = forms()[0]!;
    await submit(form);
    expect(text()).toContain(t.openErrors.mentorshipRequired);
    expect(d.calls.some((c) => c.id === "practice.placements.post")).toBe(false);
    await act(async () => {
      setValue(form.querySelector("select")!, "m1");
      const inputs = form.querySelectorAll("input");
      setValue(inputs[0]!, "Izmišljena d.o.o.");
      setValue(inputs[1]!, "2026-03-02");
      setValue(inputs[2]!, "2026-06-30");
    });
    await submit(form);
    expect(d.calls.find((c) => c.id === "practice.placements.post")!.input.body).toEqual({ mentorshipId: "m1", organisationName: "Izmišljena d.o.o.", startsOn: "2026-03-02", endsOn: "2026-06-30" });
    expect(text()).toContain(t.opened);
    expect(host.querySelectorAll("[data-testid=placement]")).toHaveLength(1);
  });

  it("shows a refused or lost opening as such, never as opened", async () => {
    const d = apiOf({ "practice.placements.get": () => ok({ placements: [] }), "practice.placements.post": () => fail(503, "unavailable") });
    await render(d.call);
    const form = forms()[0]!;
    await act(async () => {
      setValue(form.querySelector("select")!, "m1");
      const inputs = form.querySelectorAll("input");
      setValue(inputs[0]!, "Izmišljena d.o.o.");
      setValue(inputs[1]!, "2026-03-02");
      setValue(inputs[2]!, "2026-06-30");
    });
    await submit(form);
    expect(text()).toContain(t.openUnknown);
    expect(text()).not.toContain(t.opened);
  });

  it("signs through a date with a comment, says success only after the server answers, and reads the entries again", async () => {
    let signed = false;
    const d = apiOf({
      "practice.placements.get": () => ok({ placements: [PLACEMENT] }),
      "practice.entries.get": () => ok({ entries: [E1, E2], signoffs: signed ? [SIGNOFF] : [] }),
      "practice.signoffs.post": () => { signed = true; return ok({ signoffId: "s1", entryCount: 2, entriesSha256: "0".repeat(64) }, 201); },
    });
    await render(d.call);
    await openFirst();
    expect(text()).toContain(t.pendingSummary.replace("{n}", "2"));
    const form = forms().find((f) => f.querySelector("textarea"))!;
    expect(form.querySelector("input")!.value).toBe("2026-04-03");
    await act(async () => { setValue(form.querySelector("textarea")!, "Izmišljen komentar."); });
    await submit(form);
    expect(d.calls.find((c) => c.id === "practice.signoffs.post")!.input.body).toEqual({ throughDate: "2026-04-03", comment: "Izmišljen komentar." });
    expect(text()).toContain(t.signed.replace("{n}", "2"));
    expect(d.calls.filter((c) => c.id === "practice.entries.get")).toHaveLength(2);
    expect(host.querySelectorAll("[data-testid=signoff]")).toHaveLength(1);
  });

  it("does not call the server when nothing waits for a signature", async () => {
    const d = apiOf({ "practice.placements.get": () => ok({ placements: [PLACEMENT] }), "practice.entries.get": () => ok({ entries: [E1, E2], signoffs: [SIGNOFF] }) });
    await render(d.call);
    await openFirst();
    await submit(forms().find((f) => f.querySelector("textarea"))!);
    expect(text()).toContain(t.signErrors.nothingNew);
    expect(d.calls.some((c) => c.id === "practice.signoffs.post")).toBe(false);
    expect(text()).not.toContain(t.signed.replace("{n}", "2"));
  });

  it("shows nothing_to_sign, a 404 and a lost answer as refusals, not as a signature", async () => {
    for (const [answer, expected] of [[fail(409, "nothing_to_sign"), t.nothingToSign], [fail(404, "not_found"), t.signNotFound], [fail(503, "unavailable"), t.signUnknown]] as const) {
      const d = apiOf({ "practice.placements.get": () => ok({ placements: [PLACEMENT] }), "practice.entries.get": () => ok({ entries: [E1], signoffs: [] }), "practice.signoffs.post": () => answer });
      await render(d.call);
      await openFirst();
      await submit(forms().find((f) => f.querySelector("textarea"))!);
      expect(text()).toContain(expected);
      expect(text()).not.toContain(t.signed.replace("{n}", "1"));
    }
  });

  it("locks the signature form while it is sent, and unlocks it after a lost answer", async () => {
    let release: (a: Answer) => void = () => undefined;
    const pending = new Promise<Answer>((resolve) => { release = resolve; });
    const fn = vi.fn(async (id: string) => {
      if (id === "practice.placements.get") return ok({ placements: [PLACEMENT] });
      if (id === "practice.entries.get") return ok({ entries: [E1], signoffs: [] });
      return pending;
    });
    await render(() => fn as never);
    await openFirst();
    await submit(forms().find((f) => f.querySelector("textarea"))!);
    expect(host.querySelector("textarea")!.readOnly).toBe(true);
    await act(async () => { release(fail(503, "unavailable")); });
    expect(host.querySelector("textarea")!.readOnly).toBe(false);
    expect(text()).toContain(t.signUnknown);
  });

  it("goes to sign-in when the session is gone", async () => {
    const { call } = apiOf({ "practice.placements.get": () => fail(401, "unauthorized") });
    await render(call);
    expect(signIn).toHaveBeenCalledWith("/aplikacija/nastavnik/mentorstva/dnevnik-prakse");
  });
});
