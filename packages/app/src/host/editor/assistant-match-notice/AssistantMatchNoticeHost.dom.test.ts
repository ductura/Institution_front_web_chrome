// @vitest-environment jsdom
// PIL-P1-PODUDARANJE-EDITOR: the student's notice over the real port. The route is a fake answer;
// ids and dates are invented.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAssistantMatchCall } from "@/client/assistant-match";

import { useContextAlerts } from "../../../../../../src/components/editor/layout-prefs/context-alerts.ts";
import { AssistantMatchNoticeHost } from "./AssistantMatchNoticeHost";
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
    await act(async () => { root?.render(h(AssistantMatchNoticeHost, { documentId: DOC, call })); });
  };

  it("shows the notice when the server has recorded a match; without a writable editor it asks for no explanation", async () => {
    const route = server({ ok: true, status: 200, headers: {}, body: { findings: [FINDING] } });
    await mount(route);
    expect(route).toHaveBeenCalledWith("work.assistant-match.get", { params: { documentId: DOC }, query: undefined, body: undefined });
    const banner = host.querySelector("[data-match='p-1']");
    expect(banner?.getAttribute("role")).toBe("status");
    expect(banner?.textContent).toContain(`${noticeText.title}. ${noticeText.neutral}`);
    expect(host.textContent).not.toContain(noticeText.explainOpen);
  });

  // ED-38: the match is also a line in the "Uz tekst" alert row, which stays after the banner is hidden
  // and goes away with the editor.
  it("reports the match to the \"Uz tekst\" alert row and takes it back on unmount", async () => {
    const seen: string[] = [];
    const Probe = () => { seen.push(useContextAlerts().map((a) => `${a.group}:${a.text}`).join("|")); return null; };
    const probeRoot = createRoot(document.createElement("div"));
    act(() => probeRoot.render(h(Probe)));
    await mount(server({ ok: true, status: 200, headers: {}, body: { findings: [FINDING] } }));
    expect(seen.at(-1)).toBe(`assistant:${noticeText.row(1)}`);
    expect(noticeText.row(1)).toBe("1 mjesto se podudara s odgovorom pomoćnika");
    expect(noticeText.row(3)).toBe("3 mjesta se podudaraju s odgovorom pomoćnika");
    act(() => (host.querySelector("[data-match='p-1'] button:last-of-type") as HTMLButtonElement).click());
    expect(host.querySelector("[data-match='p-1']")).toBeNull();
    expect(seen.at(-1)).toBe(`assistant:${noticeText.row(1)}`);
    act(() => root?.unmount()); root = undefined;
    expect(seen.at(-1)).toBe("");
    act(() => probeRoot.unmount());
  });

  it("in the writable editor offers \"Objasni, ako želiš…\" (ED-13, NF2-P13)", async () => {
    const editor = document.createElement("div");
    editor.className = "ProseMirror";
    editor.setAttribute("contenteditable", "true");
    document.body.append(editor);
    await mount(server({ ok: true, status: 200, headers: {}, body: { findings: [FINDING] } }));
    const open = [...host.querySelectorAll("button")].find((b) => b.textContent === noticeText.explainOpen);
    expect(open).toBeDefined();
  });

  it("an explained match says so and asks again for nothing", async () => {
    const editor = document.createElement("div");
    editor.className = "ProseMirror";
    editor.setAttribute("contenteditable", "true");
    document.body.append(editor);
    const explanation = { text: "Izmišljeno objašnjenje.", writtenAt: "2026-11-20T11:00:00.000Z" };
    await mount(server({ ok: true, status: 200, headers: {}, body: { findings: [{ ...FINDING, explanation }] } }));
    expect(host.textContent).toContain(noticeText.explained);
    expect(host.textContent).not.toContain(noticeText.explainOpen);
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
    // ED-38: the alert-row line is a function of the count; its words are checked for 1, 2 and 5.
    const texts = Object.values(noticeText).flatMap((v) => (typeof v === "function" ? [1, 2, 5].map(v) : [v]));
    for (const text of texts) expect(text.toLowerCase()).not.toMatch(/prepis/u);
  });
});
