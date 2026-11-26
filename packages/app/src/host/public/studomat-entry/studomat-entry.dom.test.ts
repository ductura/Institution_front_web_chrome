// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PAGES } from "../../../routes";
import { HostContext } from "../../context";

const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), useSearchParams: () => new URLSearchParams(search) }));

import StudomatEntryRoute from "./StudomatEntryRoute";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const ID = "11111111-1111-4111-8111-111111111111";
let root: Root | null = null;
let el: HTMLElement | null = null;
const assign = vi.fn();

async function mount(status: number, role: string | null, query: string) {
  search = query;
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: unknown) => {
    calls.push(String(input instanceof URL ? input.pathname : input));
    return new Response(status === 200 ? JSON.stringify({ role }) : "", { status, headers: { "content-type": "application/json" } });
  });
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", assign, pathname: "/app/web/ulaz/studomat" }, configurable: true });
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  const page = PAGES.find((p) => p.path === "/ulaz/studomat")!;
  await act(async () => {
    root!.render(createElement(HostContext, { value: { base: "/app/web", page, role: null } }, createElement(StudomatEntryRoute)));
  });
  return calls;
}
afterEach(() => {
  act(() => root?.unmount());
  el?.remove();
  root = el = null;
  replace.mockClear();
  assign.mockClear();
  vi.unstubAllGlobals();
});

describe("StudomatEntryRoute", () => {
  it("shows only the message and reads only the session", async () => {
    const calls = await mount(401, null, "");
    expect(el!.textContent).toBe("Preusmjeravanje");
    expect(calls).toEqual(["/api/v1/me"]);
  });
  it("sends a signed-out browser to AAI@EduHr sign-in and back, without extra parameters", async () => {
    await mount(401, null, `kolegij=${ID}&osoba=x`);
    expect(assign).toHaveBeenCalledOnce();
    const href = String(assign.mock.calls[0]![0]);
    expect(decodeURIComponent(href)).toContain(`/app/web/ulaz/studomat?kolegij=${ID}`);
    expect(href).not.toContain("osoba");
  });
  it("sends a student to the enrolment and ignores a bad id", async () => {
    await mount(200, "student", `kolegij=${ID}`);
    expect(replace).toHaveBeenCalledWith(`/web/upis/kolegij/${ID}`);
  });
  it("sends a student with an external URL home", async () => {
    await mount(200, "student", "kolegij=https%3A%2F%2Fevil.example");
    expect(replace).toHaveBeenCalledWith("/web/");
    expect(assign).not.toHaveBeenCalled();
  });
  it.each([403, 500])("sends an unavailable session (%i) home and does not start login", async (status) => {
    await mount(status, null, `kolegij=${ID}`);
    expect(replace).toHaveBeenCalledWith("/web/");
    expect(assign).not.toHaveBeenCalled();
  });
  it("sends a teacher home", async () => {
    await mount(200, "teacher", `kolegij=${ID}`);
    expect(replace).toHaveBeenCalledWith("/web/");
  });
});
