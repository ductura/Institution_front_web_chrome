// @vitest-environment jsdom
// ED-42 (paritet P2-13): „Novo” from the last visit kept in this browser, and „Što sam
// promijenio/la” in the "Više" menu read from the existing route. Invented texts only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentsHost } from "./CommentsHost";
import { commentsHr as t } from "./messages.hr";
import { ORIGIN, fakeRoute } from "./fake-route.test";
import { changedBlocks, readMyChanges, sinceLine, type MyChangesSnapshot } from "./my-changes";
import { readSeen, writeSeen, type SeenStorage } from "./seen-store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no modal dialogs; the card's Dialog only needs them to open and close.
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };

const DOC = "doc-demo-1";
const KEY = `ductura.comments.seen.${DOC}`;
const SNAPSHOT: MyChangesSnapshot = {
  reviewedRevision: 3, currentRevision: 5, changed: true, blocks: [
    { kind: "paragraph", text: "Izmišljeni dodani odlomak.", change: "added" },
    { kind: "paragraph", text: "Izmišljeni uklonjeni odlomak.", change: "removed" },
    { kind: "paragraph", text: "Izmišljeni isti odlomak.", change: "unchanged" },
  ],
};

describe("seen record (ED-42)", () => {
  const memory = (): SeenStorage & { map: Map<string, string> } => {
    const map = new Map<string, string>();
    return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); } };
  };

  it("without a record nothing is new", () => {
    expect(readSeen(memory(), DOC)).toBe(Number.POSITIVE_INFINITY);
    expect(readSeen(null, DOC)).toBe(Number.POSITIVE_INFINITY);
  });

  it("keeps the time of a visit per work", () => {
    const s = memory();
    expect(writeSeen(s, DOC, 1_700_000_000_123.7)).toBe(true);
    expect(readSeen(s, DOC)).toBe(1_700_000_000_123);
    expect(readSeen(s, "drugi-rad")).toBe(Number.POSITIVE_INFINITY);
  });

  it("a broken or garbled store claims nothing", () => {
    const broken: SeenStorage = { getItem: () => { throw new Error("off"); }, setItem: () => { throw new Error("off"); } };
    expect(readSeen(broken, DOC)).toBe(Number.POSITIVE_INFINITY);
    expect(writeSeen(broken, DOC, 5)).toBe(false);
    const s = memory();
    s.map.set(KEY, "nije broj");
    expect(readSeen(s, DOC)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("my changes (ED-42)", () => {
  it("lists only the changed blocks, in the server's order, and counts the rest", () => {
    const { shown, unchanged } = changedBlocks(SNAPSHOT);
    expect(shown.map((b) => b.change)).toEqual(["added", "removed"]);
    expect(unchanged).toBe(1);
    expect(sinceLine(SNAPSHOT)).toBe(t.myChangesSince(3, 5));
    expect(sinceLine({ ...SNAPSHOT, reviewedRevision: null })).toBe(t.myChangesNoReview(5));
  });

  it("a refusal or a throw is never 'no changes'", async () => {
    const answer = (status: number) => (async () => ({ ok: false, status })) as unknown as Parameters<typeof readMyChanges>[1];
    expect(await readMyChanges(DOC, answer(401))).toEqual({ kind: "signedOut" });
    expect(await readMyChanges(DOC, answer(404))).toEqual({ kind: "unavailable" });
    const throws = (async () => { throw new Error("mreža"); }) as unknown as Parameters<typeof readMyChanges>[1];
    expect(await readMyChanges(DOC, throws)).toEqual({ kind: "unavailable" });
  });
});

describe("CommentsHost: Novo and Što sam promijenio/la (ED-42)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; localStorage.clear(); vi.unstubAllGlobals(); });

  const mount = async (changes: "ok" | "fail" = "ok") => {
    const route = fakeRoute();
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith("/changes-since-review")) {
        return changes === "ok"
          ? new Response(JSON.stringify(SNAPSHOT), { status: 200, headers: { "content-type": "application/json" } })
          : new Response(JSON.stringify({ code: "unavailable" }), { status: 503, headers: { "content-type": "application/json" } });
      }
      return route.fetchImpl(url, init);
    }) as typeof fetch;
    vi.stubGlobal("location", { origin: ORIGIN, href: `${ORIGIN}/rad/x` });
    vi.stubGlobal("fetch", fetchImpl);
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(CommentsHost, { editor: null, documentId: DOC, session: null, submitted: false })); });
    return host;
  };
  const button = (host: HTMLElement, label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement | undefined;

  it("marks as new only what the mentor wrote after the last visit", async () => {
    // The mentor's two threads are at 10:05 and 10:10; the last visit was at 10:07.
    localStorage.setItem(KEY, String(Date.parse("2026-11-20T10:07:00.000Z")));
    const host = await mount();
    expect(host.textContent).toContain(t.filters.fresh(1));
  });

  it("claims nothing new on the first visit and records the visit when the card closes", async () => {
    const host = await mount();
    expect(host.textContent).not.toContain(t.filters.fresh(1));
    expect(host.textContent).not.toContain(t.filters.fresh(2));
    expect(localStorage.getItem(KEY)).toBeNull();
    act(() => root?.unmount());
    root = undefined;
    expect(Number(localStorage.getItem(KEY))).toBeGreaterThan(0);
  });

  it("opens the student's changes from the Više menu", async () => {
    const host = await mount();
    await act(async () => { button(host, t.myChanges)!.click(); });
    const list = document.querySelector(`ol[aria-label="${t.myChanges}"]`)!;
    expect(list.querySelector("ins")?.textContent).toBe("Izmišljeni dodani odlomak.");
    expect(list.querySelector("del")?.textContent).toBe("Izmišljeni uklonjeni odlomak.");
    expect(list.textContent).not.toContain("Izmišljeni isti odlomak.");
    expect(document.body.textContent).toContain(t.myChangesUnchanged(1));
  });

  it("says so when the changes cannot be read and offers another try", async () => {
    const host = await mount("fail");
    await act(async () => { button(host, t.myChanges)!.click(); });
    expect(document.body.textContent).toContain(t.myChangesUnavailable);
    expect(button(host, t.myChangesRetry)).toBeDefined();
  });
});
