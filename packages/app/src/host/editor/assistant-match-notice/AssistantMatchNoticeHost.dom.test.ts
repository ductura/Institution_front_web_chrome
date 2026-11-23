// @vitest-environment jsdom
// PIL-P1-PODUDARANJE-EDITOR: the student's notice over the real port. The route is a fake answer;
// ids and dates are invented.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Schema } from "@tiptap/pm/model";

import { createAssistantMatchCall, type SegmentPort } from "@/client/assistant-match";

import { AssistantMatchNoticeHost, type EditorWatch } from "./AssistantMatchNoticeHost";
import { noticeText } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOC = "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d01";
const FINDING = { segmentRef: "p-1", conversationId: "c-1", messageId: "m-1", runWords: 9, recordedAt: "2026-11-20T10:00:00.000Z", attachedAt: "2026-11-20T10:00:00.000Z" };

function server(answer: unknown) {
  return vi.fn(async () => answer);
}

describe("AssistantMatchNoticeHost", () => {
  let root: Root | undefined;
  let host: HTMLElement;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

  const mount = async (route: ReturnType<typeof server>) => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const call = createAssistantMatchCall(route as never);
    // No editor beside the notice: it only reads.
    const useWatch = (): EditorWatch => ({ editor: null, opened: false, synced: false, submitted: false, signedOut: false });
    await act(async () => { root?.render(h(AssistantMatchNoticeHost, { documentId: DOC, call, segments: vi.fn<SegmentPort>(), useWatch })); });
  };

  it("shows the notice when the server has recorded a match, and asks for no explanation", async () => {
    const route = server({ ok: true, status: 200, headers: {}, body: { findings: [FINDING] } });
    await mount(route);
    expect(route).toHaveBeenCalledWith("work.assistant-match.get", { params: { documentId: DOC }, query: undefined, body: undefined });
    expect(host.querySelector("[data-match='p-1']")?.textContent).toContain(noticeText.title);
    expect(host.querySelector("textarea")).toBeNull();
    expect(host.textContent).not.toContain(noticeText.send);
  });

  it("with the faculty switch off (no finding stored) shows nothing", async () => {
    await mount(server({ ok: true, status: 200, headers: {}, body: { findings: [] } }));
    expect(host.innerHTML).toBe("");
  });

  it("shows nothing on a refusal or an unavailable server", async () => {
    await mount(server({ ok: false, status: 401, code: "unauthorized" }));
    expect(host.innerHTML).toBe("");
    act(() => root?.unmount());
    await mount(server({ ok: false, status: 503, code: "unavailable" }));
    expect(host.innerHTML).toBe("");
  });

  it("never says the text was copied", async () => {
    await mount(server({ ok: true, status: 200, headers: {}, body: { findings: [FINDING] } }));
    expect(host.textContent?.toLowerCase()).not.toMatch(/prepis/u);
    for (const text of Object.values(noticeText)) expect(text.toLowerCase()).not.toMatch(/prepis/u);
  });
});

// PIL-P1-PODUDARANJE-PROVJERA-WEB: the host sends a changed paragraph after its save is confirmed
// and, when the server answers with a match, reads the notice again. The editor is a stand-in with
// a real document; the paragraphs are invented.
describe("AssistantMatchNoticeHost sends the changed paragraph", () => {
  const schema = new Schema({
    nodes: {
      doc: { content: "paragraph+" },
      paragraph: { content: "text*", attrs: { nodeId: { default: null } } },
      text: {},
    },
  });
  const OPENED = "Izmišljeni odlomak s kojim se rad otvorio ima dovoljno riječi.";
  const TYPED = "Izmišljeni odlomak koji je student upravo napisao ima dovoljno riječi.";
  const docOf = (text: string) => schema.nodes.doc!.create(null, [
    schema.nodes.paragraph!.create({ nodeId: "p-1" }, schema.text(text)),
  ]);

  let root: Root | undefined;
  let host: HTMLElement;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

  function stage(over: Partial<EditorWatch> & { editable?: boolean } = {}) {
    const editor = { isDestroyed: false, isEditable: over.editable ?? true, state: { doc: docOf(OPENED) } };
    let watch: EditorWatch = { editor: editor as unknown as EditorWatch["editor"], opened: true, synced: false, submitted: false, signedOut: false, ...over };
    const route = vi.fn(async () => ({ ok: true, status: 200, headers: {}, body: { findings: [] as unknown[] } }));
    const segments = vi.fn<SegmentPort>(async () => ({ kind: "checked", matches: 1 }));
    const call = createAssistantMatchCall(route as never);
    const render = () => root?.render(h(AssistantMatchNoticeHost, { documentId: DOC, call, segments, useWatch: () => watch }));
    return {
      route,
      segments,
      mount: async () => {
        host = document.createElement("div");
        document.body.append(host);
        root = createRoot(host);
        await act(async () => { render(); });
      },
      /** The student typed, then the server confirmed the save. */
      typeAndSave: async () => {
        editor.state = { doc: docOf(TYPED) };
        watch = { ...watch, synced: false };
        await act(async () => { render(); });
        route.mockResolvedValue({ ok: true, status: 200, headers: {}, body: { findings: [FINDING] } });
        watch = { ...watch, synced: true };
        await act(async () => { render(); });
      },
    };
  }

  it("after the save is confirmed sends the paragraph with its block id, then shows the match", async () => {
    const s = stage();
    await s.mount();
    expect(s.segments).not.toHaveBeenCalled();
    expect(host.innerHTML).toBe("");
    await s.typeAndSave();
    expect(s.segments).toHaveBeenCalledTimes(1);
    expect(s.segments).toHaveBeenCalledWith(DOC, { ref: "p-1", text: TYPED });
    expect(s.route).toHaveBeenCalledTimes(2);
    expect(host.querySelector("[data-match='p-1']")?.textContent).toContain(noticeText.title);
  });

  it.each([
    ["a submitted work", { submitted: true }],
    ["a replay or read-only editor", { editable: false }],
    ["an ended session", { signedOut: true }],
  ] as const)("sends nothing from %s", async (_, over) => {
    const s = stage(over);
    await s.mount();
    await s.typeAndSave();
    expect(s.segments).not.toHaveBeenCalled();
    expect(s.route).toHaveBeenCalledTimes(1);
  });
});
