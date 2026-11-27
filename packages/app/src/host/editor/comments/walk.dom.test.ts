// @vitest-environment jsdom
// ED-78: "Riješi redom" in the Comments card (prototype tools.js `RP.walk`). Invented texts only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentsPanel } from "./CommentsPanel";
import { FAKE_COMMENTS, fakeCommentsPort } from "./fake-port";
import { commentsHr as t } from "./messages.hr";
import type { CommentsPort, Place, Role } from "./model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ED-78 Riješi redom", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

  const mount = async (port: CommentsPort, role: Role = "student", submitted = false) => {
    const jumps: Place[] = [];
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(h(CommentsPanel, { workId: "w", role, submitted, port, selection: () => null, docSize: () => 100, onJump: (p: Place) => { jumps.push(p); } }));
    });
    return { host, jumps };
  };
  const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement | undefined;
  const press = async (label: string) => { await act(async () => { button(label)!.click(); }); };
  const type = async (value: string) => {
    const field = document.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  it("takes the open comments in the order of the text, sends the fix to the mentor and resolves each", async () => {
    const port = fakeCommentsPort();
    const { host, jumps } = await mount(port);
    // The praise asks for nothing, so two of the three comments are walked.
    await press(t.walk.start(2));
    expect(host.textContent).toContain(t.walk.at(1, 2));
    expect(host.querySelector("li[data-cid]")).toBeNull();
    expect(jumps.map((p) => p.quote)).toEqual([FAKE_COMMENTS[0]!.place.quote]);
    expect(document.activeElement?.textContent).toBe(t.walk.at(1, 2));

    await type("Dodan izvor uz tvrdnju.");
    await press(t.walk.done);
    const first = port.all().find((c) => c.id === "c1")!;
    expect(first.resolved).toBe(true);
    expect(first.replies.map((r) => r.text)).toEqual(["Dodan izvor uz tvrdnju."]);
    expect(host.textContent).toContain(t.walk.at(2, 2));
    expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe("");

    await press(t.walk.skip);
    expect(port.all().find((c) => c.id === "c2")!.resolved).toBe(false);
    expect(host.textContent).toContain(t.walk.finished);
    const summary = (document.querySelector("textarea") as HTMLTextAreaElement).value;
    expect(summary).toBe(`1. „${FAKE_COMMENTS[0]!.place.quote}”: Dodan izvor uz tvrdnju.\n2. „${FAKE_COMMENTS[1]!.place.quote}”: ${t.walk.notResolved}`);

    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await press(t.walk.copy);
    expect(writeText).toHaveBeenCalledWith(summary);
    await press(t.walk.close);
    expect(host.querySelectorAll("li[data-cid]").length).toBe(3);
    expect(button(t.walk.start(1))).toBeDefined();
  });

  it("a comment resolved without a note is listed as resolved, and Završi goes back to the list", async () => {
    const port = fakeCommentsPort();
    const { host } = await mount(port);
    await press(t.walk.start(2));
    await press(t.walk.done);
    expect(port.all().find((c) => c.id === "c1")!.replies).toEqual([]);
    await press(t.walk.end);
    expect(host.querySelectorAll("li[data-cid]").length).toBe(3);
    expect(button(t.walk.start(1))).toBeDefined();
  });

  it("a failed step keeps what was typed and stays on the comment", async () => {
    const port = { ...fakeCommentsPort(), setResolved: async () => ({ kind: "rejected" as const }) };
    const { host } = await mount(port);
    await press(t.walk.start(2));
    await type("Popravljeno.");
    await press(t.walk.done);
    expect(host.textContent).toContain(t.walk.at(1, 2));
    expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Popravljeno.");
    expect(host.textContent).toContain(t.failed);
  });

  it("is offered only to the student, before submission, while something is open", async () => {
    await mount(fakeCommentsPort(), "teacher");
    expect(button(t.walk.start(2))).toBeUndefined();
    act(() => root?.unmount()); document.body.innerHTML = "";
    await mount(fakeCommentsPort(), "student", true);
    expect(button(t.walk.start(2))).toBeUndefined();
    act(() => root?.unmount()); document.body.innerHTML = "";
    await mount(fakeCommentsPort([FAKE_COMMENTS[2]!]));
    expect([...document.querySelectorAll("button")].some((b) => b.textContent?.startsWith(t.walk.group))).toBe(false);
  });
});
