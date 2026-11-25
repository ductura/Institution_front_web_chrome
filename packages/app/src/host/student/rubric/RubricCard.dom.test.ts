// @vitest-environment jsdom
// WEB-V17-RUBRIC-STUDENT: the card mounted in jsdom with a test double for the client. Invented texts only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rubricText as t } from "./messages.hr";

const signIn = vi.hoisted(() => vi.fn());
const api = vi.hoisted(() => vi.fn());
vi.mock("@/client/api", () => ({ createApi: () => api, goToSignIn: signIn }));
const { RubricCard } = await import("./RubricCard");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const A = "11111111-1111-4111-8111-111111111111";
const LEVELS = [{ label: "Slabo", descriptor: "" }, { label: "Dobro", descriptor: "Jasno." }, { label: "Odlično", descriptor: "Vrlo jasno." }];
const BODY = { version: 1, criteria: [{ id: "b", title: "Struktura", levels: LEVELS }, { id: "a", title: "Tema", levels: LEVELS }] };

let host: HTMLElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); api.mockReset(); signIn.mockReset(); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const mount = async () => { await act(async () => { root.render(h(RubricCard, { assignmentId: A, here: "/rad/x" })); }); };

describe("RubricCard", () => {
  it("lists the criteria in the contract's order with the three levels, and shows no mark, number or grade", async () => {
    api.mockResolvedValue({ ok: true, status: 200, body: BODY });
    await mount();
    const titles = [...host.querySelectorAll("[data-testid=rubric-criterion] > strong")].map((e) => e.textContent);
    expect(titles).toEqual(["Struktura", "Tema"]); // order of the answer, not sorted
    expect(host.querySelectorAll("[data-testid=rubric-criterion] li")).toHaveLength(6);
    expect(host.textContent).toContain(t.noDescriptor);
    expect(host.querySelector("[data-testid=rubric-criteria]")?.textContent).not.toMatch(/bod|%|zbroj/i);
  });
  it("loading, unavailable (with a retry that reads again), empty and not found are different states", async () => {
    api.mockResolvedValueOnce({ ok: false, status: 503, code: "unavailable" });
    await mount();
    expect(host.querySelector("[data-testid=rubric-state]")?.textContent).toBe(t.unavailable);
    api.mockResolvedValueOnce({ ok: true, status: 200, body: BODY });
    await act(async () => { (host.querySelector("button") as HTMLButtonElement).click(); });
    expect(host.querySelectorAll("[data-testid=rubric-criterion]")).toHaveLength(2);
    expect(api).toHaveBeenCalledTimes(2);
    await act(async () => { root.unmount(); }); root = createRoot(host);
    api.mockResolvedValueOnce({ ok: true, status: 200, body: { version: 0, criteria: [] } });
    await mount();
    expect(host.querySelector("[data-testid=rubric-state]")?.textContent).toBe(t.empty);
    await act(async () => { root.unmount(); }); root = createRoot(host);
    api.mockResolvedValueOnce({ ok: false, status: 404, code: "not_found" });
    await mount();
    expect(host.querySelector("[data-testid=rubric-state]")?.textContent).toBe(t.gone);
  });
  it("a lost session goes to the sign-in, back to the work", async () => {
    api.mockResolvedValue({ ok: false, status: 401, code: "unauthorized" });
    await mount();
    expect(signIn).toHaveBeenCalledWith("/rad/x");
  });
});
