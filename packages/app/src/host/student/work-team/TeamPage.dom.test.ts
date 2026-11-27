// @vitest-environment jsdom
// WEB-V19-GRUPA: the student's team page mounted in jsdom with a test double for the client. Invented names only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { workTeamText as t } from "./messages.hr";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("../../context", () => ({ useHost: () => ({ base: "/aplikacija" }) }));
vi.mock("@/client/api", () => ({ createApi: vi.fn(), goToSignIn: signIn }));
const { default: TeamPage } = await import("./TeamPage");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no modal dialog; the shared Dialog needs these two.
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.open = true; };
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.open = false; };

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const A = "11111111-1111-4111-8111-111111111111";
const TEAM = "22222222-2222-4222-8222-222222222222";
const ok = (body: unknown, status = 200): Answer => ({ ok: true, status, body });
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });
const MEMBER_VIEW = { state: "member", team: { teamId: TEAM, members: [{ givenName: "Zora", familyName: "Vukić" }, { givenName: "Ivo", familyName: "Babić" }] } };
const NONE_CHOICE = { state: "none", formation: "student_choice", openTeams: [{ teamId: TEAM, memberCount: 2 }] };
// Counts that would put Vukić first by amount; the page must still list by name.
const READY = {
  state: "ready", notice: "not_authorship_evidence",
  members: [
    { givenName: "Zora", familyName: "Vukić", totalCodePoints: 9000, categories: [{ category: "written", codePoints: 9000 }, { category: "ai_transferred", codePoints: 0 }, { category: "pasted", codePoints: 0 }, { category: "imported", codePoints: 0 }, { category: "unattributed", codePoints: 0 }] },
    { givenName: "Ivo", familyName: "Babić", totalCodePoints: 12, categories: [{ category: "written", codePoints: 10 }, { category: "ai_transferred", codePoints: 0 }, { category: "pasted", codePoints: 2 }, { category: "imported", codePoints: 0 }, { category: "unattributed", codePoints: 0 }] },
  ],
};

function apiOf(routes: Record<string, (body?: unknown) => Answer>) {
  const calls: { id: string; input: { body?: unknown; params?: unknown } }[] = [];
  const fn = vi.fn(async (id: string, input: { body?: unknown; params?: unknown }) => { calls.push({ id, input }); return routes[id]!(input.body); });
  return { calls, call: () => fn as never };
}

describe("TeamPage in the browser", () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); signIn.mockClear(); });
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const render = async (call: () => never) => {
    act(() => root?.unmount());
    root = createRoot(host);
    await act(async () => { root?.render(h(TeamPage, { assignmentId: A, call })); });
  };
  const text = () => host.textContent ?? "";
  const click = async (el: Element | null | undefined) => { await act(async () => { (el as HTMLElement).click(); }); };
  const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label);

  it("shows the own team's members by name, a link to the own work and the contribution with its notice", async () => {
    const { call } = apiOf({ "student.work-team.get": () => ok(MEMBER_VIEW), "student.work-team-contribution.get": () => ok(READY) });
    await render(call);
    expect([...host.querySelectorAll("[data-testid=team-member]")].map((e) => e.textContent)).toEqual(["Ivo Babić", "Zora Vukić"]);
    expect(host.querySelector<HTMLAnchorElement>("a.btn")!.getAttribute("href")).toContain(`/rad/${A}`);
    expect(host.querySelector("[data-testid=contribution-notice]")!.textContent).toBe(t.contribution.notice);
    // By name, not by amount: Babić (12) comes before Vukić (9 000).
    expect([...host.querySelectorAll("[data-testid=contribution-member] strong")].map((e) => e.textContent)).toEqual(["Ivo Babić", "Zora Vukić"]);
  });

  it("shows no share, rank, mean or mark anywhere on the contribution", async () => {
    const { call } = apiOf({ "student.work-team.get": () => ok(MEMBER_VIEW), "student.work-team-contribution.get": () => ok(READY) });
    await render(call);
    expect(host.querySelector("[data-testid=contribution-table]")!.textContent).not.toMatch(/%|postotak|udio|rang|prosjek|visok|nizak|najviše|najmanje/i);
    expect(host.querySelectorAll("[data-testid=contribution-table] [style], [data-testid=contribution-table] button")).toHaveLength(0);
  });

  it("says loading, unavailable, not found and 'not in a team' as different things", async () => {
    let d = apiOf({ "student.work-team.get": () => fail(503, "unavailable"), "student.work-team-contribution.get": () => fail(503, "unavailable") });
    await render(d.call);
    expect(text()).toContain(t.unavailable);
    expect(text()).not.toContain(t.none.title);
    d = apiOf({ "student.work-team.get": () => fail(404, "not_found"), "student.work-team-contribution.get": () => fail(404, "not_found") });
    await render(d.call);
    expect(text()).toContain(t.gone);
    expect(text()).not.toContain(t.unavailable);
    d = apiOf({ "student.work-team.get": () => ok({ state: "disabled" }), "student.work-team-contribution.get": () => ok({ state: "disabled" }) });
    await render(d.call);
    expect(host.querySelector("[data-testid=team-disabled]")).not.toBeNull();
  });

  it("reads a failed contribution as an error and a pending one as 'not ready', never as an empty table", async () => {
    let d = apiOf({ "student.work-team.get": () => ok(MEMBER_VIEW), "student.work-team-contribution.get": () => fail(503, "unavailable") });
    await render(d.call);
    expect(text()).toContain(t.contribution.unavailable);
    expect(host.querySelector("[data-testid=contribution-table]")).toBeNull();
    d = apiOf({ "student.work-team.get": () => ok(MEMBER_VIEW), "student.work-team-contribution.get": () => ok({ state: "pending" }) });
    await render(d.call);
    expect(text()).toContain(t.contribution.pending);
    expect(host.querySelector("[data-testid=contribution-table]")).toBeNull();
  });

  it("offers to found or join a team only when the students form them, and joins by the team's id", async () => {
    const d = apiOf({
      "student.work-team.get": () => ok(NONE_CHOICE), "student.work-team-contribution.get": () => ok({ state: "none" }),
      "student.work-team.post": () => ok(MEMBER_VIEW),
    });
    await render(d.call);
    expect(host.querySelectorAll("[data-testid=open-team]")).toHaveLength(1);
    await click(host.querySelector("[data-testid=open-team] button"));
    expect(d.calls.find((c) => c.id === "student.work-team.post")!.input.body).toEqual({ action: "join", teamId: TEAM });
    expect(text()).toContain(t.outcome.joined);

    const assigned = apiOf({ "student.work-team.get": () => ok({ state: "none", formation: "teacher_assigned", openTeams: [] }), "student.work-team-contribution.get": () => ok({ state: "none" }) });
    await render(assigned.call);
    expect(text()).toContain(t.none.assigned);
    expect(button(t.create)).toBeUndefined();
  });

  it("says success only after the server answers, and shows a refusal as a refusal", async () => {
    const d = apiOf({
      "student.work-team.get": () => ok(NONE_CHOICE), "student.work-team-contribution.get": () => ok({ state: "none" }),
      "student.work-team.post": () => fail(409, "conflict"),
    });
    await render(d.call);
    await click(button(t.create));
    expect(d.calls.find((c) => c.id === "student.work-team.post")!.input.body).toEqual({ action: "create" });
    expect(text()).toContain(t.outcome.conflict);
    expect(text()).not.toContain(t.outcome.created);
  });

  it("asks before leaving, does nothing on 'Ostani u timu', and tells a lost answer from a success", async () => {
    const d = apiOf({
      "student.work-team.get": () => ok(MEMBER_VIEW), "student.work-team-contribution.get": () => ok(READY),
      "student.work-team.post": () => fail(503, "unavailable"),
    });
    await render(d.call);
    await click(button(t.member.leave));
    await click(button(t.confirmLeave.no));
    expect(d.calls.some((c) => c.id === "student.work-team.post")).toBe(false);
    await click(button(t.member.leave));
    await click(button(t.confirmLeave.yes));
    expect(d.calls.find((c) => c.id === "student.work-team.post")!.input.body).toEqual({ action: "leave" });
    expect(text()).toContain(t.outcome.unknown);
    expect(text()).not.toContain(t.outcome.left);
  });

  it("sends a signed-out student to sign in", async () => {
    const { call } = apiOf({ "student.work-team.get": () => fail(401, "unauthorized"), "student.work-team-contribution.get": () => fail(401, "unauthorized") });
    await render(call);
    expect(signIn).toHaveBeenCalled();
  });
});
