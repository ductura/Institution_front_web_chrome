// @vitest-environment jsdom
// WEB-V19-DNEVNIK-STUDENT: the journal page mounted in jsdom with a test double for the client.
// Invented texts only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { practiceJournalText as t } from "./messages.hr";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("../../context", () => ({ useHost: () => ({ base: "/aplikacija" }) }));
vi.mock("@/client/api", () => ({ createApi: vi.fn(), goToSignIn: signIn }));
const { default: PracticeJournalPage } = await import("./PracticeJournalPage");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const NOW = () => new Date(2026, 3, 15, 12, 0, 0);
const PLACEMENT = { placementId: "11111111-1111-4111-8111-111111111111", mentorshipId: "m1", organisationName: "Izmišljena d.o.o.", startsOn: "2026-03-02", endsOn: "2026-06-30", entryCount: 1, signedThrough: "2026-04-05" };
const ENTRY = { entryId: "e1", date: "2026-04-01", hours: 2, text: "Izmišljeni zapis o izmišljenom poslu.", correctsEntryId: null, createdAt: "2026-04-01T10:00:00Z" };
const SIGNOFF = { signoffId: "s1", throughDate: "2026-04-05", entryCount: 1, entriesSha256: "0".repeat(64), comment: "Izmišljen komentar mentora.", signedAt: "2026-04-06T08:00:00Z", mentor: { id: "t1", givenName: "Mentor", familyName: "Izmišljeni" } };

function apiOf(routes: Record<string, () => Answer>) {
  const calls: { id: string; input: { body?: unknown } }[] = [];
  const fn = vi.fn(async (id: string, input: { body?: unknown }) => { calls.push({ id, input }); return routes[id]!(); });
  return { calls, call: () => fn as never };
}
const ok = (body: unknown, status = 200): Answer => ({ ok: true, status, body });

describe("PracticeJournalPage in the browser", () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); signIn.mockClear(); });
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  // Each render is a new visit: a new root, so no state carries over from the one before.
  const render = async (call: () => never) => {
    act(() => root?.unmount());
    root = createRoot(host);
    await act(async () => { root?.render(h(PracticeJournalPage, { call, now: NOW })); });
  };
  const text = () => host.textContent ?? "";

  it("shows the entries by date, the signed mark and the mentor's comment", async () => {
    const { call } = apiOf({ "practice.placements.get": () => ok({ placements: [PLACEMENT] }), "practice.entries.get": () => ok({ entries: [ENTRY], signoffs: [SIGNOFF] }) });
    await render(call);
    expect(host.querySelectorAll("[data-testid=entry]")).toHaveLength(1);
    expect(text()).toContain(t.signedMark);
    expect(text()).toContain("Izmišljen komentar mentora.");
    expect(text()).toContain(t.signedThrough.replace("{date}", "5. travnja 2026."));
  });

  it("says loading, error, empty and 'no active practice' as four different things", async () => {
    let d = apiOf({ "practice.placements.get": () => ({ ok: false, status: 503, code: "unavailable" }) });
    await render(d.call);
    expect(text()).toContain(t.unavailable);
    expect(text()).not.toContain(t.noPlacements.title);
    d = apiOf({ "practice.placements.get": () => ok({ placements: [] }) });
    await render(d.call);
    expect(text()).toContain(t.noPlacements.body);
    expect(text()).not.toContain(t.unavailable);
    d = apiOf({ "practice.placements.get": () => ok({ placements: [{ ...PLACEMENT, endsOn: "2026-03-31" }] }), "practice.entries.get": () => ok({ entries: [], signoffs: [] }) });
    await render(d.call);
    expect(host.querySelector("[data-testid=no-active-placement]")).not.toBeNull();
    expect(text()).toContain(t.noEntries);
  });

  it("reads entries that failed to load as an error, not as an empty practice", async () => {
    const { call } = apiOf({ "practice.placements.get": () => ok({ placements: [PLACEMENT] }), "practice.entries.get": () => ({ ok: false, status: 503, code: "unavailable" }) });
    await render(call);
    expect(text()).toContain(t.entriesUnavailable);
    expect(text()).not.toContain(t.noEntries);
  });

  it("reads another student's practice as not available", async () => {
    const { call } = apiOf({ "practice.placements.get": () => ok({ placements: [PLACEMENT] }), "practice.entries.get": () => ({ ok: false, status: 404, code: "not_found" }) });
    await render(call);
    expect(text()).toContain(t.placementGone);
  });

  it("refuses a bad entry without calling the server, and says success only after the server answers", async () => {
    const d = apiOf({
      "practice.placements.get": () => ok({ placements: [PLACEMENT] }),
      "practice.entries.get": () => ok({ entries: [], signoffs: [] }),
      "practice.entries.post": () => ok({ entryId: "e2" }, 201),
    });
    await render(d.call);
    const area = host.querySelector("textarea")!;
    const submit = async () => { await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); };
    await submit();
    expect(text()).toContain(t.errors.textRequired);
    expect(d.calls.some((c) => c.id === "practice.entries.post")).toBe(false);
    expect(text()).not.toContain(t.saved);
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      set.call(area, "Izmišljeni novi zapis.");
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await submit();
    const post = d.calls.find((c) => c.id === "practice.entries.post")!;
    expect(post.input.body).toEqual({ date: "2026-04-15", hours: 1, text: "Izmišljeni novi zapis." });
    expect(text()).toContain(t.saved);
  });

  it("sends a correction as a new entry that names the one it corrects, and shows a refusal as a refusal", async () => {
    const d = apiOf({
      "practice.placements.get": () => ok({ placements: [PLACEMENT] }),
      "practice.entries.get": () => ok({ entries: [ENTRY], signoffs: [] }),
      "practice.entries.post": () => ({ ok: false, status: 409, code: "placement_closed" }),
    });
    await render(d.call);
    await act(async () => { host.querySelector<HTMLButtonElement>("[data-testid=entry] button")!.click(); });
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    const post = d.calls.find((c) => c.id === "practice.entries.post")!;
    expect(post.input.body).toMatchObject({ date: "2026-04-01", hours: 2, correctsEntryId: "e1" });
    expect(text()).toContain(t.closed);
    expect(text()).not.toContain(t.savedCorrection);
  });

  it("locks the form while saving, so an edit cannot be lost, and unlocks it after a lost answer", async () => {
    let release: (a: Answer) => void = () => undefined;
    const pending = new Promise<Answer>((resolve) => { release = resolve; });
    const fn = vi.fn(async (id: string) => {
      if (id === "practice.placements.get") return ok({ placements: [PLACEMENT] });
      if (id === "practice.entries.get") return ok({ entries: [], signoffs: [] });
      return pending;
    });
    await render(() => fn as never);
    const area = host.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, "Izmišljeni zapis.");
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(host.querySelector("textarea")!.readOnly).toBe(true);
    expect(host.querySelector("select")!.disabled).toBe(true);
    await act(async () => { release({ ok: false, status: 503, code: "unavailable" }); });
    expect(host.querySelector("textarea")!.readOnly).toBe(false);
    expect(text()).toContain(t.unknown);
  });

  it("does not cap the text by UTF-16 units", async () => {
    const { call } = apiOf({ "practice.placements.get": () => ok({ placements: [PLACEMENT] }), "practice.entries.get": () => ok({ entries: [], signoffs: [] }) });
    await render(call);
    expect(host.querySelector("textarea")!.hasAttribute("maxlength")).toBe(false);
  });

  it("offers no form for a past practice, nor where the entries could not be read", async () => {
    let d = apiOf({ "practice.placements.get": () => ok({ placements: [{ ...PLACEMENT, endsOn: "2026-03-31" }] }), "practice.entries.get": () => ok({ entries: [ENTRY], signoffs: [] }) });
    await render(d.call);
    expect(host.querySelector("form")).toBeNull();
    expect(host.querySelector("[data-testid=entry] button")).toBeNull();
    d = apiOf({ "practice.placements.get": () => ok({ placements: [PLACEMENT] }), "practice.entries.get": () => ({ ok: false, status: 404, code: "not_found" }) });
    await render(d.call);
    expect(host.querySelector("form")).toBeNull();
    d = apiOf({ "practice.placements.get": () => ok({ placements: [PLACEMENT] }), "practice.entries.get": () => ({ ok: false, status: 503, code: "unavailable" }) });
    await render(d.call);
    expect(host.querySelector("form")).toBeNull();
  });

  it("shows the error of the hours field", async () => {
    const d = apiOf({ "practice.placements.get": () => ok({ placements: [PLACEMENT] }), "practice.entries.get": () => ok({ entries: [], signoffs: [] }) });
    await render(d.call);
    const area = host.querySelector("textarea")!;
    const select = host.querySelector("select")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, "Izmišljeni zapis.");
      area.dispatchEvent(new Event("input", { bubbles: true }));
      select.innerHTML = '<option value="13">13</option>';
      select.value = "13";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(text()).toContain(t.errors.hoursInvalid);
    expect(d.calls.some((c) => c.id === "practice.entries.post")).toBe(false);
  });

  it("goes to sign-in when the session is gone", async () => {
    const { call } = apiOf({ "practice.placements.get": () => ({ ok: false, status: 401, code: "unauthorized" }) });
    await render(call);
    expect(signIn).toHaveBeenCalledWith("/aplikacija/zadaci/dnevnik-prakse");
  });
});
