// @vitest-environment jsdom
// F4-EDI-R20: "Prethodni / Sljedeći komentar" in the Comments card. Invented texts only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentsPanel } from "./CommentsPanel";
import { FAKE_COMMENTS, fakeCommentsPort } from "./fake-port";
import { commentsHr as t } from "./messages.hr";
import type { Place } from "./model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("previous / next comment", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

  const mount = async (comments = FAKE_COMMENTS) => {
    const jumps: Place[] = [];
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(h(CommentsPanel, { workId: "w", role: "student", port: fakeCommentsPort(comments), selection: () => null, docSize: () => 100, onJump: (p: Place) => { jumps.push(p); } }));
    });
    return { host, jumps };
  };
  const press = async (label: string) => { await act(async () => { ([...document.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement).click(); }); };
  const active = () => document.querySelector("li[data-cid][class*=active]")?.getAttribute("data-cid") ?? null;

  it("walks the shown comments in order, wraps around and jumps to each place", async () => {
    const { host, jumps } = await mount();
    expect(host.textContent).toContain(t.stepNone(3));
    await press(t.nextComment);
    expect(jumps.map((p) => p.quote)).toEqual([FAKE_COMMENTS[0]!.place.quote]);
    expect(host.textContent).toContain(t.stepAt(1, 3));
    await press(t.nextComment);
    await press(t.nextComment);
    expect(host.textContent).toContain(t.stepAt(3, 3));
    await press(t.nextComment);
    expect(host.textContent).toContain(t.stepAt(1, 3));
    await press(t.prevComment);
    expect(host.textContent).toContain(t.stepAt(3, 3));
    expect(jumps.at(-1)!.quote).toBe(FAKE_COMMENTS[2]!.place.quote);
  });

  it("previous from the start goes to the last comment", async () => {
    const { host } = await mount();
    await press(t.prevComment);
    expect(host.textContent).toContain(t.stepAt(3, 3));
  });

  it("does not jump to a place that is gone, and offers no stepping for one comment", async () => {
    const lost = FAKE_COMMENTS.map((c, i) => (i === 0 ? { ...c, place: { ...c.place, lost: true } } : c));
    const { jumps } = await mount(lost);
    await press(t.nextComment);
    expect(jumps).toEqual([]);
    act(() => root?.unmount());
    document.body.innerHTML = "";
    const one = await mount([FAKE_COMMENTS[0]!]);
    expect(one.host.textContent).not.toContain(t.nextComment);
  });
});
