// @vitest-environment jsdom
// ED-48 (P2-24): "Pitaj mentora" from the chapter sheet opens a new comment in Komentari, on the
// chapter's title and with its first line written. Nothing is published by the request itself.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { ASK_WAIT_MS, askComment, askedComment, takeAskedComment, ASK_COMMENT_EVENT } from "./ask-comment";
import { CommentsPanel } from "./CommentsPanel";
import { fakeCommentsPort } from "./fake-port";
import { commentsHr as t } from "./messages.hr";
import type { Selection } from "./model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };

const FIRST = "Pitanje uz poglavlje „Uvod”: ";
const onTitle = (): Selection => ({ from: 1, to: 5, quote: "Uvod", at: Date.now(), sameParagraph: true });

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  takeAskedComment();
});

async function mount(props: { submitted?: boolean; selection?: () => Selection | null } = {}) {
  const port = fakeCommentsPort([]);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(h(CommentsPanel, { workId: "rad-demo", role: "student", submitted: props.submitted ?? false, port,
      selection: props.selection ?? onTitle, docSize: () => 200, onJump: () => {} }));
  });
  return port;
}
const openDialog = () => host!.querySelector("dialog[open]");

describe("ask the mentor from the chapter sheet (ED-48)", () => {
  it("opens a new comment on the selected title with the first line written, and publishes nothing", async () => {
    const port = await mount();
    expect(openDialog()).toBeNull();
    await act(async () => { askComment(FIRST); });
    expect(openDialog()?.querySelector("textarea")?.value).toBe(FIRST);
    expect(port.all()).toHaveLength(0);
  });

  it("a card that mounts after the click still opens it, but not after the wait", async () => {
    askComment(FIRST);
    await mount();
    expect(openDialog()?.querySelector("textarea")?.value).toBe(FIRST);
    act(() => root?.unmount());
    root = null;
    askComment(FIRST, new EventTarget(), Date.now() - ASK_WAIT_MS - 1);
    await mount();
    expect(openDialog()).toBeNull();
  });

  it("asks for a selection when there is none, and stays closed on a submitted work", async () => {
    await mount({ selection: () => null });
    await act(async () => { askComment(FIRST); });
    expect(openDialog()).toBeNull();
    expect(host!.textContent).toContain(t.needSelection);
    act(() => root?.unmount());
    root = null;
    await mount({ submitted: true });
    await act(async () => { askComment(FIRST); });
    expect(openDialog()).toBeNull();
  });

  it("takes only a text, once", () => {
    expect(askedComment(new CustomEvent(ASK_COMMENT_EVENT, { detail: 7 }))).toBeNull();
    expect(askedComment(new CustomEvent(ASK_COMMENT_EVENT, { detail: "x".repeat(2001) }))).toBeNull();
    askComment(FIRST, new EventTarget());
    expect(takeAskedComment()).toBe(FIRST);
    expect(takeAskedComment()).toBeNull();
  });
});
