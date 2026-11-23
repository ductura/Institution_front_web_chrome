// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import ChangesSinceReview from "./ChangesSinceReview";
import { FAKE_BLOCKS } from "./fake-port";
import { changesMessages as text } from "./messages.hr";
import type { ChangesPort, ChangesRead, ReviewMark } from "./model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

const ready = (reviewedRevision: number | null, changed = true): ChangesRead =>
  ({ kind: "ready", snapshot: { reviewedRevision, currentRevision: 5, changed, blocks: FAKE_BLOCKS } });

async function show(port: ChangesPort) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(createElement(ChangesSinceReview, { documentId: "d1", port })); });
  await click(text.open);
  return host;
}

async function click(label: string) {
  const button = [...host!.querySelectorAll("button")].find((b) => b.textContent === label);
  if (!button) throw new Error(`no button ${label}`);
  await act(async () => { button.click(); });
}

const buttons = () => [...host!.querySelectorAll("button")].map((b) => b.textContent);

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null; host = null;
});

describe("ChangesSinceReview card (WEB-1704)", () => {
  it("lists every block in the server's order", async () => {
    await show({ read: async () => ready(3) });
    expect([...host!.querySelectorAll("li")].map((li) => [li.dataset.change, li.textContent]))
      .toEqual(FAKE_BLOCKS.map((b) => [b.change, expect.stringContaining(b.text)]));
  });

  it("hides the review action when the contract has no route", async () => {
    await show({ read: async () => ready(3) });
    expect(buttons()).not.toContain(text.markReviewed);
  });

  it("says reviewed only after the server confirmed, then reads the server again", async () => {
    let reads = 0;
    let confirm: (mark: ReviewMark) => void = () => {};
    const port: ChangesPort = {
      read: async () => { reads += 1; return reads === 1 ? ready(3) : ready(5, false); },
      markReviewed: () => new Promise<ReviewMark>((resolve) => { confirm = resolve; }),
    };
    await show(port);
    await click(text.markReviewed);
    expect(host!.textContent).not.toContain(text.marked);
    expect(reads).toBe(1);
    await act(async () => { confirm({ kind: "marked", reviewedRevision: 5, reviewedAt: "2026-11-21T10:00:00.000Z" }); });
    expect(host!.textContent).toContain(text.marked);
    expect(reads).toBe(2);
    expect(host!.textContent).toContain(text.none);
  });

  it("keeps the list and says so when the server refused the review", async () => {
    let reads = 0;
    await show({ read: async () => { reads += 1; return ready(3); }, markReviewed: async () => ({ kind: "rejected" }) });
    await click(text.markReviewed);
    expect(host!.textContent).toContain(text.failed);
    expect(host!.textContent).not.toContain(text.marked);
    expect(reads).toBe(1);
    expect(host!.querySelectorAll("li")).toHaveLength(FAKE_BLOCKS.length);
  });
});
