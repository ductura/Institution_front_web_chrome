// @vitest-environment jsdom
// PIL-K-KOMENTARI-EDITOR: the student's Comments card over the real port (no editor mounted): the
// threads come from the route, a reply is shown once the server lists it, a submitted work is
// read only. Invented texts only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentsHost } from "./CommentsHost";
import { commentsHr as t } from "./messages.hr";
import { ORIGIN, fakeRoute } from "./fake-route";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("CommentsHost (student)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; vi.unstubAllGlobals(); });

  const mount = async (submitted: boolean) => {
    const route = fakeRoute();
    // The card calls the client with the page's own origin and transport.
    vi.stubGlobal("location", { origin: ORIGIN, href: `${ORIGIN}/rad/x` });
    vi.stubGlobal("fetch", route.fetchImpl);
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(CommentsHost, { editor: null, documentId: "doc-demo-1", session: null, submitted })); });
    return { host, route };
  };
  const button = (host: HTMLElement, label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement | undefined;

  it("shows the threads and sends a reply through the port", async () => {
    const { host, route } = await mount(false);
    expect(host.textContent).toContain("Tvrdnja traži izvor.");
    expect(host.textContent).toContain("Dodat ću izvor.");
    expect(host.textContent).toContain("Jasan uvod.");
    await act(async () => { button(host, t.reply)!.click(); });
    const area = host.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, "Izvor je dodan.");
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { button(host, t.send)!.click(); });
    expect(route.calls.map((c) => c.action)).toEqual(["list", "reply", "list"]);
    expect(route.calls[1]!.body).toMatchObject({ body: "Izvor je dodan." });
    expect(host.textContent).toContain("Izvor je dodan.");
    expect(host.textContent).toContain(t.saved);
  });

  it("a submitted work is read only: no reply, no new comment, nothing sent", async () => {
    const { host, route } = await mount(true);
    expect(host.textContent).toContain("Tvrdnja traži izvor.");
    expect(host.textContent).toContain(t.submittedNote);
    for (const label of [t.reply, t.newTitle, t.resolve, t.reopen]) expect(button(host, label)).toBeUndefined();
    expect(host.querySelector("textarea")).toBeNull();
    expect(route.calls.map((c) => c.action)).toEqual(["list"]);
  });

  it("the student never sees the operations without a student route", async () => {
    const { host } = await mount(false);
    for (const label of [t.sendBack, t.confirm, t.alsoAdd, t.templatesTitle]) expect(button(host, label)).toBeUndefined();
  });
});
