// @vitest-environment jsdom
// ED-119 (prototype app.js `.cmt` click): a click on a comment in the text opens Komentari with that
// comment in focus, past the chapter scope. Invented comments only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { OPEN_PANEL_EVENT, requestedPanel } from "../../../../../../src/components/editor/layout-prefs/open-panel";
import { openComment } from "../marks/MarksHost";
import { COMMENT_CARD_EVENT, COMMENT_FOCUS_EVENT, cardPosition, requestCommentFocus, takeCommentFocus } from "./comment-card";
import { CommentsPanel } from "./CommentsPanel";
import { fakeCommentsPort } from "./fake-port";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; takeCommentFocus(); });

const mount = async () => {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(h(CommentsPanel, { workId: "w", role: "student", port: fakeCommentsPort(), selection: () => null, docSize: () => 100,
      onJump: () => {}, chapter: { title: "2. Metoda", from: 50, to: 100 } }));
  });
  return host;
};
const ids = (host: HTMLElement) => [...host.querySelectorAll("li[data-cid]")].map((li) => li.getAttribute("data-cid"));
const active = () => document.querySelector("li[data-cid][class*=active]")?.getAttribute("data-cid") ?? null;

describe("a comment clicked in the text (ED-119)", () => {
  it("is asked for once, and an old request is dropped", () => {
    requestCommentFocus(15, document, 1000);
    expect(takeCommentFocus(2000)).toBe(15);
    expect(takeCommentFocus(2000)).toBeNull();
    requestCommentFocus(15, document, 1000);
    expect(takeCommentFocus(7000)).toBeNull();
  });

  it("opens Komentari on a computer and the card up to 1050 px", () => {
    const seen: string[] = [];
    const panel = (e: Event) => seen.push(`panel:${requestedPanel(e)}`);
    const focus = (e: Event) => seen.push(`focus:${cardPosition(e)}`);
    const card = (e: Event) => seen.push(`card:${cardPosition(e)}`);
    document.addEventListener(OPEN_PANEL_EVENT, panel);
    document.addEventListener(COMMENT_FOCUS_EVENT, focus);
    document.addEventListener(COMMENT_CARD_EVENT, card);
    openComment(15, 1280);
    openComment(70, 390);
    document.removeEventListener(OPEN_PANEL_EVENT, panel);
    document.removeEventListener(COMMENT_FOCUS_EVENT, focus);
    document.removeEventListener(COMMENT_CARD_EVENT, card);
    expect(seen).toEqual(["panel:comments", "focus:15", "card:70"]);
  });

  it("brings the comment into focus in an open card, even from another chapter", async () => {
    const host = await mount();
    expect(ids(host)).toEqual(["c2"]);
    expect(active()).toBeNull();
    await act(async () => { requestCommentFocus(15); });
    expect(ids(host)).toEqual(["c1", "c2"]);
    expect(active()).toBe("c1");
  });

  it("is taken by the card that mounts after the click", async () => {
    requestCommentFocus(70);
    const host = await mount();
    expect(ids(host)).toEqual(["c2"]);
    expect(active()).toBe("c2");
  });

  it("brings nothing into focus where no comment is", async () => {
    await mount();
    await act(async () => { requestCommentFocus(95); });
    expect(active()).toBeNull();
  });
});
