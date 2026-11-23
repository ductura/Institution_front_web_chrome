// @vitest-environment jsdom
// PIL-P1-PODUDARANJE-EDITOR: the student's notice over the real port. The route is a fake answer;
// ids and dates are invented.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAssistantMatchCall } from "@/client/assistant-match";

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
