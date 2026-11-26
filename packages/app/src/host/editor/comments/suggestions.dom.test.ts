// @vitest-environment jsdom
// EDI-R10: the teacher's proposals in the student's Comments card, over the real client: Prihvati
// changes the text only after the server confirms, Odbij changes nothing, a place not found asks
// nothing, a refusal is shown (never "no proposals"), a submitted work offers no action. Invented only.
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { editorSuggestionsHr as s } from "../../../../../../src/components/editor/suggestions/index.ts";
import { CommentsHost } from "./CommentsHost";
import { commentsHr as t } from "./messages.hr";
import { ANCHOR, ORIGIN, fakeRoute } from "./fake-route.test";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const SID = "cccccccc-0000-4000-8000-000000000001";
const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: body === undefined ? {} : { "content-type": "application/json" } });
const row = (state: string) => ({ suggestionId: SID, anchor: ANCHOR, text: "kompostiranje u kućanstvu", state, isOwn: false, baseHash: "a".repeat(64), createdWindow: "2026-11-20T10:05:00.000Z", decidedWindow: null });

describe("proposals in the student's Comments card", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; vi.unstubAllGlobals(); });

  const mount = async (reply: (url: string, body: Record<string, unknown>) => Response, submitted = false, editor: unknown = null) => {
    const seen: string[] = [];
    const route = fakeRoute({}, (url, body) => { seen.push(url.split("/").at(-1)!); return reply(url, body); });
    vi.stubGlobal("location", { origin: ORIGIN, href: `${ORIGIN}/rad/x` });
    vi.stubGlobal("fetch", route.fetchImpl);
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(CommentsHost, { editor: editor as never, documentId: "doc-demo-1", session: null, submitted })); });
    return { host, seen };
  };
  const button = (host: HTMLElement, label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement | undefined;

  it("shows a pending proposal with Prihvati and Odbij; Odbij sends reject and reads again", async () => {
    let state = "pending";
    const { host, seen } = await mount((url) => url.endsWith("/list") ? json(200, { suggestions: [row(state)] }) : (state = "rejected", json(204)));
    expect(host.textContent).toContain("kompostiranje u kućanstvu");
    expect(button(host, s.accept)).toBeDefined();
    await act(async () => { button(host, s.reject)!.click(); });
    expect(seen).toEqual(["list", "reject", "list"]);
    expect(host.textContent).toContain(s.state.rejected);
    expect(button(host, s.reject)).toBeUndefined();
  });

  it("Prihvati without an editor sends nothing (place not found)", async () => {
    const { host, seen } = await mount(() => json(200, { suggestions: [row("pending")] }));
    await act(async () => { button(host, s.accept)!.click(); });
    expect(seen).toEqual(["list"]); // no text to place it in: the server is not asked
    expect(host.textContent).toContain(s.errors.invalid);
  });

  it("Prihvati asks the server, then changes the text as the student's own change; a stale 409 changes nothing", async () => {
    const schema = new Schema({
      nodes: { doc: { content: "paragraph+" }, text: { group: "inline" }, paragraph: { content: "text*", group: "block", attrs: { nodeId: { default: null } } } },
    });
    const para = schema.nodes.paragraph!.create({ nodeId: ANCHOR.nodeId }, schema.text("Tema je kućno kompostiranje u gradu"));
    const fake = (code: number) => {
      let state = EditorState.create({ doc: schema.nodes.doc!.create(null, para) });
      const editor = { get state() { return state; }, isDestroyed: false, view: { dispatch: (tr: never) => { state = state.apply(tr); } } };
      return { editor, text: () => state.doc.textContent, code };
    };
    const ok = fake(200);
    const first = await mount((url) => url.endsWith("/list") ? json(200, { suggestions: [row("pending")] }) : json(200, { suggestionId: SID, state: "accepted", baseHash: "a".repeat(64), text: "x", change: { source: "teacher-suggestion", suggestionId: SID, nodeId: ANCHOR.nodeId, start: 8, end: 27, removed: "", inserted: "" } }), false, ok.editor);
    await act(async () => { button(first.host, s.accept)!.click(); });
    expect(first.seen).toEqual(["list", "accept", "list"]);
    expect(ok.text()).toBe("Tema je kompostiranje u kućanstvu u gradu");
    act(() => root?.unmount());
    const stale = fake(409);
    const second = await mount((url) => url.endsWith("/list") ? json(200, { suggestions: [row("pending")] }) : json(409), false, stale.editor);
    await act(async () => { button(second.host, s.accept)!.click(); });
    expect(stale.text()).toBe("Tema je kućno kompostiranje u gradu");
    expect(second.host.textContent).toContain(s.errors.conflict);
  });

  it("text typed while the server answers: the place is found again, never reused", async () => {
    const schema = new Schema({
      nodes: { doc: { content: "paragraph+" }, text: { group: "inline" }, paragraph: { content: "text*", group: "block", attrs: { nodeId: { default: null } } } },
    });
    const para = schema.nodes.paragraph!.create({ nodeId: ANCHOR.nodeId }, schema.text("Tema je kućno kompostiranje u gradu"));
    let state = EditorState.create({ doc: schema.nodes.doc!.create(null, para) });
    const editor = { get state() { return state; }, isDestroyed: false, view: { dispatch: (tr: never) => { state = state.apply(tr); } } };
    const { host } = await mount((url) => {
      if (url.endsWith("/list")) return json(200, { suggestions: [row("pending")] });
      state = state.apply(state.tr.insertText("Uvod. ", 1)); // typed before the place while the request was out
      return json(200, { suggestionId: SID, state: "accepted", baseHash: "a".repeat(64), text: "x", change: { source: "teacher-suggestion", suggestionId: SID, nodeId: ANCHOR.nodeId, start: 8, end: 27, removed: "", inserted: "" } });
    }, false, editor);
    await act(async () => { button(host, s.accept)!.click(); });
    expect(state.doc.textContent).toBe("Uvod. Tema je kompostiranje u kućanstvu u gradu");
  });

  it("a submitted work shows proposals but offers no action", async () => {
    const { host } = await mount(() => json(200, { suggestions: [row("pending")] }), true);
    expect(host.textContent).toContain("kompostiranje u kućanstvu");
    expect(host.textContent).toContain(t.proposalsReadOnly);
    expect(button(host, s.accept)).toBeUndefined();
    expect(button(host, s.reject)).toBeUndefined();
  });

  it("a refused or broken list says unavailable, never 'no proposals'", async () => {
    const a = await mount(() => json(503));
    expect(a.host.textContent).toContain(t.proposalsUnavailable);
    act(() => root?.unmount());
    const b = await mount(() => json(200, { suggestions: [{ ...row("pending"), extra: 1 }] }));
    expect(b.host.textContent).toContain(t.proposalsUnavailable);
  });

  it("a missing proposals route (404), a refusal or a dropped connection never hides the comments (WEB vlak)", async () => {
    for (const reply of [() => json(404), () => json(403), () => json(401), () => { throw new TypeError("network"); }]) {
      const { host } = await mount(reply as never);
      // The thread of the comments route is on screen whatever the proposals route answered.
      expect(host.textContent).toContain("Tvrdnja traži izvor.");
      expect(host.textContent).toContain("Jasan uvod.");
      expect(button(host, t.reply)).toBeDefined();
      act(() => root?.unmount());
    }
  });

  it("no proposals: no section", async () => {
    const { host } = await mount(() => json(200, { suggestions: [] }));
    expect(host.textContent).not.toContain(s.title);
    expect(host.textContent).not.toContain(t.proposalsUnavailable);
  });
});
