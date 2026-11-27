// @vitest-environment jsdom
// ED-98: the comment card on a phone (prototype text2.js `#t2card`). Invented comments only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COMMENT_CARD_EVENT, cardFits, cardPosition, requestCommentCard } from "./comment-card";
import { CommentCard, commentAt, openInText } from "./CommentCard";
import { FAKE_COMMENTS } from "./fake-port";
import { commentsHr as t } from "./messages.hr";
import type { Comment } from "./model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => { act(() => root?.unmount()); root = null; host?.remove(); host = null; });

const many: Comment = { ...FAKE_COMMENTS[1]!, id: "c4", place: { from: 100, to: 120, quote: "Treći odlomak.", lost: false }, replies: [
  { id: "r1", role: "student", text: "Prvi odgovor.", ts: 1 },
  { id: "r2", role: "teacher", text: "Drugi odgovor.", ts: 2 },
  { id: "r3", role: "student", text: "Treći odgovor.", ts: 3 },
] };
const done: Comment = { ...FAKE_COMMENTS[0]!, id: "c5", resolved: true, place: { from: 12, to: 20, quote: "studenata", lost: false } };
const all: readonly Comment[] = [...FAKE_COMMENTS, many, done];

function mount(comment: Comment, submitted = false) {
  const calls = { close: 0, step: [] as number[], reply: 0, resolve: [] as boolean[] };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => { root!.render(h(CommentCard, { comment, comments: all, submitted,
    onClose: () => { calls.close += 1; }, onStep: (by) => { calls.step.push(by); },
    onReply: () => { calls.reply += 1; }, onResolve: (r) => { calls.resolve.push(r); } })); });
  return calls;
}
const button = (name: string) => [...host!.querySelectorAll("button")].find((b) => b.textContent === name || b.getAttribute("aria-label") === name);

describe("Kartica komentara na mobitelu (ED-98)", () => {
  it("orders the open comments by place and finds the one tapped", () => {
    expect(openInText(all).map((c) => c.id)).toEqual(["c3", "c1", "c2", "c4"]);
    expect(commentAt(all, 15)?.id).toBe("c1");
    expect(commentAt(all, 95)).toBeNull();
    expect(commentAt([done], 15)?.id).toBe("c5");
  });

  it("asks for the card only up to 1050 px, with a whole position", () => {
    expect(cardFits(390)).toBe(true);
    expect(cardFits(1050)).toBe(true);
    expect(cardFits(1280)).toBe(false);
    const seen: (number | null)[] = [];
    const on = (e: Event) => seen.push(cardPosition(e));
    document.addEventListener(COMMENT_CARD_EVENT, on);
    requestCommentCard(42);
    document.dispatchEvent(new CustomEvent(COMMENT_CARD_EVENT, { detail: { pos: "x" } }));
    document.removeEventListener(COMMENT_CARD_EVENT, on);
    expect(seen).toEqual([42, null]);
  });

  it("shows who, kind, i od N, the last two replies and the actions", () => {
    const calls = mount(many);
    const card = host!.querySelector("[role=dialog]")!;
    expect(card.getAttribute("aria-label")).toBe(t.card.label);
    expect(card.textContent).toContain("Mentor");
    expect(card.textContent).toContain(t.kinds.q);
    expect(card.textContent).toContain("4 od 4");
    expect(card.textContent).not.toContain("Prvi odgovor.");
    expect(card.textContent).toContain("Drugi odgovor.");
    expect(card.textContent).toContain("Treći odgovor.");
    expect(card.textContent).toContain("Još 1 raniji odgovor u Komentarima.");
    act(() => { button(t.nextComment)!.click(); button(t.prevComment)!.click(); button(t.reply)!.click(); button(t.card.resolve)!.click(); });
    expect(calls).toMatchObject({ step: [1, -1], reply: 1, resolve: [true] });
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    act(() => { button(t.card.close)!.click(); });
    expect(calls.close).toBe(2);
  });

  it("says riješeno, offers Otvori ponovno, and nothing to change on a submitted work", () => {
    const calls = mount(done);
    expect(host!.textContent).toContain(t.status.resolved);
    act(() => { button(t.card.reopen)!.click(); });
    expect(calls.resolve).toEqual([false]);
    act(() => root!.unmount()); root = null; host!.remove();
    mount(done, true);
    expect(button(t.card.reopen)).toBeUndefined();
    expect(button(t.reply)).toBeDefined();
  });

  it("has no steps with one open comment", () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => { root!.render(h(CommentCard, { comment: FAKE_COMMENTS[0]!, comments: [FAKE_COMMENTS[0]!], submitted: false,
      onClose: vi.fn(), onStep: vi.fn(), onReply: vi.fn(), onResolve: vi.fn() })); });
    expect(button(t.nextComment)).toBeUndefined();
    expect(host.textContent).toContain("1 od 1");
  });
});
