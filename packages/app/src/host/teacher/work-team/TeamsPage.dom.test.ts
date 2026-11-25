// @vitest-environment jsdom
// WEB-V19-GRUPA: the teacher's teams page mounted in jsdom with a test double for the client. Invented names only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { workTeamText } from "../../student/work-team/messages.hr";
import { teacherTeamText as t } from "./messages.hr";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("../../context", () => ({ useHost: () => ({ base: "/app/web" }) }));
vi.mock("@/client/api", () => ({ createApi: vi.fn(), goToSignIn: signIn }));
const { default: TeamsPage } = await import("./TeamsPage");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const A = "11111111-1111-4111-8111-111111111111";
const T1 = "22222222-2222-4222-8222-222222222222";
const S1 = "33333333-3333-4333-8333-333333333333";
const S2 = "44444444-4444-4444-8444-444444444444";
const ok = (body: unknown, status = 200): Answer => ({ ok: true, status, body });
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });
const SETTING = { enabled: true, minSize: 2, maxSize: 3, formation: "teacher_assigned" };
const TEAMS = {
  teams: [{ teamId: T1, members: [{ studentId: S2, givenName: "Zora", familyName: "Vukić", workState: "submitted" }, { studentId: S1, givenName: "Ivo", familyName: "Babić", workState: "in_progress" }] }],
  unassigned: [{ studentId: "55555555-5555-4555-8555-555555555555", givenName: "Ema", familyName: "Čorić" }],
};
const READY = {
  state: "ready", notice: "not_authorship_evidence",
  members: [{ givenName: "Zora", familyName: "Vukić", totalCodePoints: 5, categories: [{ category: "written", codePoints: 5 }, { category: "ai_transferred", codePoints: 0 }, { category: "pasted", codePoints: 0 }, { category: "imported", codePoints: 0 }, { category: "unattributed", codePoints: 0 }] }],
};

function apiOf(routes: Record<string, (body?: unknown) => Answer>) {
  const calls: { id: string; input: { body?: unknown; params?: unknown } }[] = [];
  const fn = vi.fn(async (id: string, input: { body?: unknown; params?: unknown }) => { calls.push({ id, input }); return routes[id]!(input.body); });
  return { calls, call: () => fn as never };
}
const BASE = { "institution.assignment-team-setting.get": () => ok(SETTING), "teacher.work-teams.get": () => ok(TEAMS) };

describe("TeamsPage in the browser", () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); signIn.mockClear(); });
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const render = async (call: () => never) => {
    act(() => root?.unmount());
    root = createRoot(host);
    await act(async () => { root?.render(h(TeamsPage, { assignmentId: A, call })); });
  };
  const text = () => host.textContent ?? "";
  const click = async (el: Element | null | undefined) => { await act(async () => { (el as HTMLElement).click(); }); };
  const submit = async () => { await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); };
  const pickValue = async (el: HTMLSelectElement, value: string) => {
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(el, value); el.dispatchEvent(new Event("change", { bubbles: true })); });
  };
  const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label);

  it("lists the members and the students without a team by name, with the work state as a fact", async () => {
    const { call } = apiOf(BASE);
    await render(call);
    expect([...host.querySelectorAll("[data-testid=team-member]")].map((e) => e.textContent?.replace(/\s+/g, " ").trim().split(" (")[0])).toEqual(["Ivo Babić", "Zora Vukić"]);
    expect(text()).toContain(t.teams.state.submitted);
    expect(host.querySelectorAll("[data-testid=unassigned]")).toHaveLength(1);
  });

  it("says unavailable, not found and 'no teams yet' as different things for the setting and for the teams", async () => {
    let d = apiOf({ ...BASE, "institution.assignment-team-setting.get": () => fail(503, "unavailable") });
    await render(d.call);
    expect(text()).toContain(t.setting.unavailable);
    expect(text()).toContain(t.teams.title);
    d = apiOf({ "institution.assignment-team-setting.get": () => fail(404, "not_found"), "teacher.work-teams.get": () => fail(404, "not_found") });
    await render(d.call);
    expect(text()).toContain(t.gone);
    expect(text()).not.toContain(t.teams.none);
    d = apiOf({ ...BASE, "teacher.work-teams.get": () => fail(503, "unavailable") });
    await render(d.call);
    expect(text()).toContain(t.unavailable);
    expect(text()).not.toContain(t.teams.none);
    d = apiOf({ ...BASE, "teacher.work-teams.get": () => ok({ teams: [], unassigned: [] }) });
    await render(d.call);
    expect(text()).toContain(t.teams.none);
  });

  it("does not send a setting whose minimum is above the maximum, and says saved only after the server answers", async () => {
    const d = apiOf({ ...BASE, "institution.assignment-team-setting.put": (body) => ok(body) });
    await render(d.call);
    const selects = host.querySelectorAll("select");
    await pickValue(selects[0]!, "5");
    await submit();
    expect(text()).toContain(t.setting.errors.minAboveMax);
    expect(d.calls.some((c) => c.id === "institution.assignment-team-setting.put")).toBe(false);
    expect(text()).not.toContain(t.setting.saved);
    await pickValue(host.querySelectorAll("select")[0]!, "2");
    await pickValue(host.querySelectorAll("select")[1]!, "4");
    await submit();
    expect(d.calls.find((c) => c.id === "institution.assignment-team-setting.put")!.input.body).toEqual({ enabled: true, minSize: 2, maxSize: 4, formation: "teacher_assigned" });
    expect(text()).toContain(t.setting.saved);
  });

  it("shows a refused setting as a refusal and a lost answer as unknown", async () => {
    let d = apiOf({ ...BASE, "institution.assignment-team-setting.put": () => fail(409, "conflict") });
    await render(d.call);
    await submit();
    expect(text()).toContain(t.setting.conflict);
    expect(text()).not.toContain(t.setting.saved);
    d = apiOf({ ...BASE, "institution.assignment-team-setting.put": () => fail(503, "unavailable") });
    await render(d.call);
    await submit();
    expect(text()).toContain(t.setting.unknown);
  });

  it("adds a student to the chosen team, removes a member, and shows a refusal as a refusal", async () => {
    const d = apiOf({ ...BASE, "teacher.work-team-member.post": () => ok({ updated: true }) });
    await render(d.call);
    await click(host.querySelector("[data-testid=unassigned] button"));
    expect(d.calls.some((c) => c.id === "teacher.work-team-member.post")).toBe(false);
    await pickValue(host.querySelector<HTMLSelectElement>("[data-testid=unassigned] select")!, T1);
    await click(host.querySelector("[data-testid=unassigned] button"));
    expect(d.calls.find((c) => c.id === "teacher.work-team-member.post")).toMatchObject({ input: { params: { assignmentId: A, teamId: T1 }, body: { action: "add" } } });
    expect(text()).toContain(t.teams.added);

    const refused = apiOf({ ...BASE, "teacher.work-team-member.post": () => fail(409, "conflict") });
    await render(refused.call);
    await click(host.querySelector("[data-testid=team-member] button"));
    expect(refused.calls.find((c) => c.id === "teacher.work-team-member.post")).toMatchObject({ input: { body: { studentId: S1, action: "remove" } } });
    expect(text()).toContain(t.teams.conflict);
    expect(text()).not.toContain(t.teams.removed);
  });

  it("offers no team that is already full and no creating while teams are off", async () => {
    const full = apiOf({ ...BASE, "institution.assignment-team-setting.get": () => ok({ ...SETTING, maxSize: 2 }) });
    await render(full.call);
    expect(host.querySelector("[data-testid=unassigned] select")).toBeNull();
    expect(text()).toContain(t.unassigned.noTeams);
    const off = apiOf({ ...BASE, "institution.assignment-team-setting.get": () => ok({ ...SETTING, enabled: false }) });
    await render(off.call);
    expect(host.querySelector("[data-testid=teams-off]")).not.toBeNull();
    expect(button(t.teams.create)!.disabled).toBe(true);
  });

  it("shows the contribution of one team on request with the notice, and a pending one as 'not ready'", async () => {
    const d = apiOf({ ...BASE, "teacher.work-team-contribution.get": () => ok(READY) });
    await render(d.call);
    expect(host.querySelector("table")).toBeNull();
    await click(button(t.teams.showContribution));
    expect(d.calls.find((c) => c.id === "teacher.work-team-contribution.get")!.input.params).toEqual({ assignmentId: A, teamId: T1 });
    expect(host.querySelector("[data-testid=contribution-notice]")!.textContent).toBe(workTeamText.contribution.notice);
    expect(host.querySelector("[data-testid=contribution-table]")!.textContent).not.toMatch(/%|postotak|rang|prosjek|visok|nizak/i);
    const pending = apiOf({ ...BASE, "teacher.work-team-contribution.get": () => ok({ state: "pending" }) });
    await render(pending.call);
    await click(button(t.teams.showContribution));
    expect(text()).toContain(workTeamText.contribution.pending);
    expect(host.querySelector("table")).toBeNull();
  });

  it("sends a signed-out teacher to sign in", async () => {
    const { call } = apiOf({ "institution.assignment-team-setting.get": () => fail(401, "unauthorized"), "teacher.work-teams.get": () => fail(401, "unauthorized") });
    await render(call);
    expect(signIn).toHaveBeenCalled();
  });

  it("keeps the setting form locked until the refresh after a save has answered", async () => {
    let release: (a: Answer) => void = () => undefined;
    let gets = 0;
    const pending = new Promise<Answer>((resolve) => { release = resolve; });
    const fn = vi.fn(async (id: string, input: { body?: unknown }) => {
      if (id === "institution.assignment-team-setting.get") { gets += 1; return gets === 1 ? ok(SETTING) : pending; }
      if (id === "institution.assignment-team-setting.put") return ok(input.body);
      return ok(TEAMS);
    });
    await render(() => fn as never);
    await submit();
    expect(host.querySelector("select")!.disabled).toBe(true);
    await act(async () => { release(ok(SETTING)); });
    expect(host.querySelector("select")!.disabled).toBe(false);
  });

  it("does not submit a team choice that stopped being open", async () => {
    let max = 3;
    const d = apiOf({ ...BASE, "institution.assignment-team-setting.get": () => ok({ ...SETTING, maxSize: max }), "institution.assignment-team-setting.put": (b) => ok(b), "teacher.work-team-member.post": () => ok({ updated: true }) });
    await render(d.call);
    await pickValue(host.querySelector<HTMLSelectElement>("[data-testid=unassigned] select")!, T1);
    max = 2; // the team (two members) is now full
    await submit();
    expect(host.querySelector("[data-testid=unassigned] select")).toBeNull();
    expect(d.calls.some((c) => c.id === "teacher.work-team-member.post")).toBe(false);
  });
});
